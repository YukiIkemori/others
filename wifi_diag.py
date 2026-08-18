#!/usr/bin/env python3
"""
wifi_diag.py — 自宅回線 / Wi-Fi 一括診断ツール

Wi-Fi の電波品質、IPv6 (IPoE) の有無、経路、DNS、スループット、そして
「速度計には出ないがいちばん体感を殺す」バッファブロート（負荷時遅延）を
1 回のコマンドでまとめて測り、JSON に保存します。

対策の前後で 2 回走らせて --compare すると、何がどれだけ効いたかが出ます。

依存: Python 3.9+ の標準ライブラリのみ。pip install 不要。
対応: macOS / Linux / Windows（Wi-Fi 情報の取得精度は OS により差があります）

使い方:
    python3 wifi_diag.py --label before        # 対策前
    python3 wifi_diag.py --label after         # 対策後
    python3 wifi_diag.py --compare results/xxx-before.json results/yyy-after.json
    python3 wifi_diag.py --quick               # 短縮版（約 40 秒）
    python3 wifi_diag.py --no-load             # 負荷試験を行わない（回線を占有したくない時）
"""

from __future__ import annotations

import argparse
import json
import math
import os
import platform
import random
import re
import shutil
import socket
import ssl
import statistics
import struct
import subprocess
import sys
import threading
import time
import unicodedata
import http.client
from datetime import datetime, timezone

SCHEMA_VERSION = 2

# 計測に使うエンドポイント（いずれも認証キー不要）
CF_HOST = "speed.cloudflare.com"
CF_META = "/meta"
CF_DOWN = "/__down?bytes={n}"
CF_UP = "/__up"

# 下り負荷用エンドポイント。Cloudflare が最良（サイズ指定可）だが、
# 遮断されている環境向けに大きな公開ファイルへのフォールバックを持つ。
# フォールバックはストリームが尽きたら同じ URL を開き直して負荷を維持する。
DOWNLOAD_ENDPOINTS = [
    {"name": "cloudflare", "host": CF_HOST, "path": CF_DOWN.format(n=300 * 1024 * 1024)},
    {"name": "github-codeload", "host": "codeload.github.com",
     "path": "/torvalds/linux/tar.gz/refs/tags/v6.9"},
    {"name": "github-codeload-2", "host": "codeload.github.com",
     "path": "/torvalds/linux/tar.gz/refs/tags/v6.1"},
]

# 負荷時の応答性（RPM 近似）を測るための小さな HTTP エンドポイント
RPM_ENDPOINTS = [
    {"host": CF_HOST, "path": CF_DOWN.format(n=1)},
    {"host": "registry.npmjs.org", "path": "/-/ping"},
    {"host": "github.com", "path": "/manifest.json"},
]
PING_TARGETS_V4 = ["1.1.1.1", "8.8.8.8"]
PING_TARGET_V6 = "2606:4700:4700::1111"
TRACE_TARGET_V4 = "8.8.8.8"
TRACE_TARGET_V6 = "2001:4860:4860::8888"
DNS_NAMES = [
    "www.google.com",
    "www.youtube.com",
    "github.com",
    "www.amazon.co.jp",
    "zoom.us",
]

IS_MAC = sys.platform == "darwin"
IS_WIN = os.name == "nt"
IS_LINUX = sys.platform.startswith("linux")


# --------------------------------------------------------------------------
# 小道具
# --------------------------------------------------------------------------

def run(cmd, timeout=20):
    """外部コマンドを実行して stdout を返す。失敗時は None。"""
    try:
        p = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            text=True,
            errors="replace",
        )
        return p.stdout
    except subprocess.TimeoutExpired as e:
        # kill 直前までの部分出力にも使える情報がある（traceroute の途中経路など）
        out = e.stdout
        if isinstance(out, bytes):
            out = out.decode("utf-8", "replace")
        return out or None
    except (OSError, subprocess.SubprocessError):
        return None


def have(name):
    return shutil.which(name) is not None


def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def dwidth(s):
    """端末上の表示幅。日本語などの全角文字を 2 桁として数える。"""
    return sum(2 if unicodedata.east_asian_width(ch) in ("W", "F") else 1 for ch in str(s))


def pad(s, width, align="<"):
    """表示幅ベースで桁を揃える（f-string の :<24 は全角を 1 桁と数えてしまうため）。"""
    s = str(s)
    fill = max(0, width - dwidth(s))
    if align == ">":
        return " " * fill + s
    return s + " " * fill


def fmt(v, unit="", nd=1):
    if v is None:
        return "—"
    if isinstance(v, float):
        return f"{v:.{nd}f}{unit}"
    return f"{v}{unit}"


class Progress:
    """1 行で進捗を出す（--json 時は黙る）。"""

    def __init__(self, enabled=True):
        self.enabled = enabled

    def step(self, msg):
        if self.enabled:
            print(f"  ▶ {msg}", flush=True)

    def note(self, msg):
        if self.enabled:
            print(f"    {msg}", flush=True)


# --------------------------------------------------------------------------
# HTTP（IPv4 / IPv6 を明示的に選べるクライアント）
# --------------------------------------------------------------------------

def _connect(host, port, family, timeout):
    last = None
    try:
        infos = socket.getaddrinfo(host, port, family, socket.SOCK_STREAM)
    except OSError as e:
        raise OSError(f"名前解決に失敗: {host} ({e})") from e
    for af, socktype, proto, _canon, sa in infos:
        s = None
        try:
            s = socket.socket(af, socktype, proto)
            s.settimeout(timeout)
            s.connect(sa)
            return s
        except OSError as e:
            last = e
            if s is not None:
                try:
                    s.close()
                except OSError:
                    pass
    raise last or OSError(f"接続できません: {host}:{port}")


class FamilyHTTPSConnection(http.client.HTTPSConnection):
    """socket family（AF_INET / AF_INET6）を強制できる HTTPS 接続。"""

    def __init__(self, host, family=socket.AF_UNSPEC, timeout=15, context=None):
        super().__init__(host, timeout=timeout, context=context or ssl.create_default_context())
        self._family = family

    def connect(self):
        self.sock = _connect(self.host, self.port, self._family, self.timeout)
        self.sock = self._context.wrap_socket(self.sock, server_hostname=self.host)


def http_json(host, path, family=socket.AF_UNSPEC, timeout=10):
    """JSON を取得する。到達できない / 壊れた応答なら None（呼び出し側は落とさない）。"""
    conn = FamilyHTTPSConnection(host, family=family, timeout=timeout)
    try:
        conn.request("GET", path, headers={"User-Agent": "wifi_diag/1.0", "Accept": "application/json"})
        resp = conn.getresponse()
        body = resp.read()
        if resp.status != 200:
            return None
        return json.loads(body.decode("utf-8", "replace"))
    except (ValueError, http.client.HTTPException):
        return None
    finally:
        try:
            conn.close()
        except (OSError, http.client.HTTPException):
            pass


# --------------------------------------------------------------------------
# 1. システム情報
# --------------------------------------------------------------------------

def collect_system():
    return {
        "timestamp": now_iso(),
        "os": platform.platform(),
        "python": platform.python_version(),
        "hostname": socket.gethostname(),
    }


# --------------------------------------------------------------------------
# 2. Wi-Fi（SSID / RSSI / ノイズ / SNR / チャンネル / リンク速度）
# --------------------------------------------------------------------------

AIRPORT = ("/System/Library/PrivateFrameworks/Apple80211.framework/"
           "Versions/Current/Resources/airport")


def _wifi_mac():
    out = None
    if os.path.exists(AIRPORT):
        out = run([AIRPORT, "-I"], timeout=10)
    if out and "SSID" in out:
        d = {}
        for line in out.splitlines():
            if ":" in line:
                k, _, v = line.partition(":")
                d[k.strip()] = v.strip()
        rssi = _int(d.get("agrCtlRSSI"))
        noise = _int(d.get("agrCtlNoise"))
        return {
            "source": "airport",
            "ssid": d.get("SSID"),
            "bssid": d.get("BSSID"),
            "rssi_dbm": rssi,
            "noise_dbm": noise,
            "snr_db": (rssi - noise) if (rssi is not None and noise is not None) else None,
            "channel": d.get("channel"),
            "tx_rate_mbps": _int(d.get("lastTxRate")),
            "phy_mode": d.get("link auth") or d.get("op mode"),
        }

    # macOS 14.4 以降は airport が削除されているので system_profiler にフォールバック
    out = run(["system_profiler", "-json", "SPAirPortDataType"], timeout=30)
    if out:
        try:
            data = json.loads(out)
            for iface in data.get("SPAirPortDataType", []):
                for ni in iface.get("spairport_airport_interfaces", []):
                    cur = ni.get("spairport_current_network_information")
                    if not cur:
                        continue
                    sig, noi = _parse_signal_noise(cur.get("spairport_signal_noise"))
                    return {
                        "source": "system_profiler",
                        "ssid": cur.get("_name"),
                        "bssid": cur.get("spairport_network_bssid"),
                        "rssi_dbm": sig,
                        "noise_dbm": noi,
                        "snr_db": (sig - noi) if (sig is not None and noi is not None) else None,
                        "channel": cur.get("spairport_network_channel"),
                        "tx_rate_mbps": _int(cur.get("spairport_network_rate")),
                        "phy_mode": cur.get("spairport_network_phymode"),
                    }
        except (ValueError, AttributeError, TypeError):
            pass
    return {"source": None, "error": "Wi-Fi 情報を取得できませんでした（有線接続、または OS の制限）"}


def _parse_signal_noise(s):
    """'-53 dBm / -92 dBm' 形式を (signal, noise) に。"""
    if not isinstance(s, str):
        return None, None
    nums = re.findall(r"(-?\d+)\s*dBm", s)
    if len(nums) >= 2:
        return int(nums[0]), int(nums[1])
    if len(nums) == 1:
        return int(nums[0]), None
    return None, None


def _freq_to_channel(freq):
    """中心周波数 (MHz) を Wi-Fi チャンネル番号に変換する。"""
    if not freq:
        return None
    if 2412 <= freq <= 2472:
        return (freq - 2407) // 5
    if freq == 2484:
        return 14
    if 5160 <= freq <= 5885:
        return (freq - 5000) // 5
    if 5955 <= freq <= 7115:          # 6GHz (Wi-Fi 6E/7)
        return (freq - 5950) // 5
    return None


def _wifi_linux():
    dev = None
    out = run(["iw", "dev"], timeout=10) if have("iw") else None
    if out:
        m = re.search(r"Interface\s+(\S+)", out)
        if m:
            dev = m.group(1)
    if dev and have("iw"):
        link = run(["iw", "dev", dev, "link"], timeout=10) or ""
        if "Connected" in link or "SSID" in link:
            ssid = _search(r"SSID:\s*(.+)", link)
            sig = _int(_search(r"signal:\s*(-?\d+)", link))
            rate = _search(r"tx bitrate:\s*([\d.]+)", link)
            freq = _int(_search(r"freq:\s*(\d+)", link))
            channel = _freq_to_channel(freq)
            noise = None
            surv = run(["iw", "dev", dev, "survey", "dump"], timeout=10) or ""
            for block in surv.split("Survey data from"):
                if "[in use]" in block:
                    noise = _int(_search(r"noise:\s*(-?\d+)", block))
            return {
                "source": "iw",
                "interface": dev,
                "ssid": ssid,
                "bssid": _search(r"Connected to ([0-9a-f:]{17})", link),
                "rssi_dbm": sig,
                "noise_dbm": noise,
                "snr_db": (sig - noise) if (sig is not None and noise is not None) else None,
                "channel": f"{channel} ({freq} MHz)" if channel else freq,
                "freq_mhz": freq,
                "tx_rate_mbps": float(rate) if rate else None,
                "phy_mode": None,
            }
    if have("nmcli"):
        out = run(["nmcli", "-t", "-f", "ACTIVE,SSID,SIGNAL,CHAN,FREQ", "dev", "wifi"], timeout=10) or ""
        for line in out.splitlines():
            parts = line.split(":")
            if parts and parts[0] == "yes" and len(parts) >= 5:
                return {
                    "source": "nmcli",
                    "ssid": parts[1],
                    "signal_percent": _int(parts[2]),
                    "channel": parts[3],
                    "rssi_dbm": None,
                    "noise_dbm": None,
                    "snr_db": None,
                }
    return {"source": None, "error": "Wi-Fi 情報を取得できませんでした（有線接続の可能性）"}


def _wifi_windows():
    out = run(["netsh", "wlan", "show", "interfaces"], timeout=15)
    if not out or "SSID" not in out:
        return {"source": None, "error": "Wi-Fi 情報を取得できませんでした（有線接続の可能性）"}
    pct = _int(_search(r"Signal\s*:\s*(\d+)%", out))
    return {
        "source": "netsh",
        "ssid": _search(r"^\s*SSID\s*:\s*(.+)$", out, flags=re.M),
        "bssid": _search(r"BSSID\s*:\s*(\S+)", out),
        "signal_percent": pct,
        # Windows は % しか出さないので、業界慣用の換算式で dBm を近似
        "rssi_dbm": (pct / 2.0 - 100) if pct is not None else None,
        "rssi_estimated": True,
        "noise_dbm": None,
        "snr_db": None,
        "channel": _search(r"Channel\s*:\s*(\d+)", out),
        "tx_rate_mbps": _float(_search(r"Receive rate \(Mbps\)\s*:\s*([\d.]+)", out)),
        "phy_mode": _search(r"Radio type\s*:\s*(\S+)", out),
    }


def collect_wifi():
    if IS_MAC:
        return _wifi_mac()
    if IS_WIN:
        return _wifi_windows()
    return _wifi_linux()


def _search(pat, text, flags=0):
    if not text:
        return None
    m = re.search(pat, text, flags)
    return m.group(1).strip() if m else None


def _int(v):
    try:
        return int(str(v).strip().split()[0])
    except (TypeError, ValueError, IndexError):
        return None


def _float(v):
    try:
        return float(str(v).strip().split()[0])
    except (TypeError, ValueError, IndexError):
        return None


# --------------------------------------------------------------------------
# 3. ローカルのアドレスとゲートウェイ
# --------------------------------------------------------------------------

def _default_gateway():
    gw = {"v4": None, "v6": None}
    if IS_MAC:
        out = run(["route", "-n", "get", "default"], timeout=10) or ""
        gw["v4"] = _search(r"gateway:\s*(\S+)", out)
        out6 = run(["route", "-n", "get", "-inet6", "default"], timeout=10) or ""
        gw["v6"] = _search(r"gateway:\s*(\S+)", out6)
    elif IS_LINUX:
        out = run(["ip", "-4", "route", "show", "default"], timeout=10) or ""
        gw["v4"] = _search(r"default via (\S+)", out)
        out6 = run(["ip", "-6", "route", "show", "default"], timeout=10) or ""
        gw["v6"] = _search(r"default via (\S+)", out6)
    elif IS_WIN:
        out = run(["route", "print", "-4"], timeout=15) or ""
        gw["v4"] = _search(r"0\.0\.0\.0\s+0\.0\.0\.0\s+(\S+)", out)
    return gw


def _local_addresses():
    """外向きソケットを開いて、実際に使われるローカルアドレスを取る（送信はしない）。"""
    res = {"v4": None, "v6": None}
    for key, family, target in (("v4", socket.AF_INET, ("1.1.1.1", 80)),
                                ("v6", socket.AF_INET6, ("2606:4700:4700::1111", 80))):
        s = None
        try:
            # IPv6 が無効なカーネルでは socket() 自体が失敗するので、生成ごと保護する
            s = socket.socket(family, socket.SOCK_DGRAM)
            s.connect(target)          # UDP の connect はパケットを出さない
            res[key] = s.getsockname()[0]
        except OSError:
            res[key] = None
        finally:
            if s is not None:
                s.close()
    return res


def _is_global_v6(addr):
    if not addr:
        return False
    a = addr.lower().split("%")[0]
    if a.startswith("fe80:") or a.startswith("fc") or a.startswith("fd") or a == "::1":
        return False
    return ":" in a


def collect_local():
    local = _local_addresses()
    gw = _default_gateway()
    return {
        "local_ipv4": local["v4"],
        "local_ipv6": local["v6"],
        "has_global_ipv6": _is_global_v6(local["v6"]),
        "gateway_v4": gw["v4"],
        "gateway_v6": gw["v6"],
    }


# --------------------------------------------------------------------------
# 4. WAN 側（外から見た自分の IP / ASN / 接続先データセンター）
# --------------------------------------------------------------------------

def collect_wan(prog):
    out = {}
    for key, family in (("v4", socket.AF_INET), ("v6", socket.AF_INET6)):
        prog.step(f"外部から見た自分の姿を確認中 (IPv{key[1]})")
        try:
            meta = http_json(CF_HOST, CF_META, family=family, timeout=10)
        except OSError as e:
            meta = None
            out[key + "_error"] = str(e)
        if meta:
            out[key] = {
                "ip": meta.get("clientIp"),
                "asn": meta.get("asn"),
                "as_org": meta.get("asOrganization"),
                "colo": meta.get("colo"),
                "city": meta.get("city"),
            }
        else:
            out[key] = None
    out["ipv6_reachable"] = out.get("v6") is not None
    return out


# --------------------------------------------------------------------------
# 5. 経路（traceroute）
# --------------------------------------------------------------------------

def _parse_traceroute(text):
    hops = []
    if not text:
        return hops
    for line in text.splitlines():
        m = re.match(r"\s*(\d+)\s+(.*)", line)
        if not m:
            continue
        idx = int(m.group(1))
        rest = m.group(2)
        if "*" in rest and not re.search(r"[\d]+\.[\d]+ ms", rest):
            hops.append({"hop": idx, "host": None, "ip": None, "rtt_ms": None})
            continue
        host = _search(r"([A-Za-z0-9][A-Za-z0-9.\-]*\.[A-Za-z]{2,})", rest)
        ip = _search(r"\(?((?:\d{1,3}\.){3}\d{1,3})\)?", rest)
        if ip is None:
            ip = _search(r"\(?([0-9a-fA-F:]{4,})\)?", rest)
        rtt = _float(_search(r"([\d.]+)\s*ms", rest))
        hops.append({"hop": idx, "host": host, "ip": ip, "rtt_ms": rtt})
    return hops


def _traceroute_recverr(target=TRACE_TARGET_V4, port=53, max_hops=12, timeout=1.2):
    """traceroute コマンドがない Linux 向けの純 Python 実装（root 不要）。
    UDP ソケットに IP_RECVERR を立て、TTL を 1 から伸ばしながら DNS クエリを送る。
    途中のルーターが返す ICMP time-exceeded がエラーキューに載るので、
    そこから送信元（= そのホップのルーター）と RTT を読み取る。"""
    IP_RECVERR = 11
    SO_EE_ORIGIN_ICMP = 2
    ee_size = struct.calcsize("=IBBBBII")
    hops = []
    for ttl in range(1, max_hops + 1):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        hop_ip = None
        rtt = None
        reached = False
        try:
            s.setsockopt(socket.IPPROTO_IP, IP_RECVERR, 1)
            s.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, ttl)
            s.settimeout(timeout)
            pkt = _dns_query_packet(f"ttl{ttl}-{random.randrange(16 ** 6):06x}.wifi-diag.invalid")
            t0 = time.perf_counter()
            s.sendto(pkt, (target, port))
            try:
                s.recvfrom(512)                     # 普通に応答が返った = 目的地に到達
                rtt = (time.perf_counter() - t0) * 1000
                hop_ip = target
                reached = True
            except socket.timeout:
                pass
            except OSError:
                rtt = (time.perf_counter() - t0) * 1000   # ICMP エラーが届いた時刻
            if hop_ip is None:
                try:
                    _data, anc, _flags, _addr = s.recvmsg(512, 1024, socket.MSG_ERRQUEUE)
                    if rtt is None:
                        rtt = (time.perf_counter() - t0) * 1000
                    for lvl, typ, cd in anc:
                        if lvl == socket.IPPROTO_IP and typ == IP_RECVERR and len(cd) >= ee_size + 8:
                            origin = cd[4]
                            fam = struct.unpack_from("=H", cd, ee_size)[0]
                            if origin == SO_EE_ORIGIN_ICMP and fam == socket.AF_INET:
                                hop_ip = socket.inet_ntoa(cd[ee_size + 4:ee_size + 8])
                except OSError:
                    pass
        except OSError:
            s.close()
            break
        finally:
            try:
                s.close()
            except OSError:
                pass
        hops.append({"hop": ttl, "host": None, "ip": hop_ip,
                     "rtt_ms": round(rtt, 1) if rtt is not None else None})
        if reached:
            break
    return hops


def collect_traceroute(prog, max_hops=12):
    res = {}
    if IS_WIN:
        out4 = run(["tracert", "-h", str(max_hops), "-w", "1500", TRACE_TARGET_V4], timeout=90)
        out6 = run(["tracert", "-6", "-h", str(max_hops), "-w", "1500", TRACE_TARGET_V6], timeout=90)
    else:
        prog.step("経路を追跡中 (IPv4)")
        out4 = run(["traceroute", "-q", "1", "-w", "2", "-m", str(max_hops), TRACE_TARGET_V4], timeout=90)
        out6 = None
        prog.step("経路を追跡中 (IPv6)")
        if have("traceroute6"):
            out6 = run(["traceroute6", "-q", "1", "-w", "2", "-m", str(max_hops), TRACE_TARGET_V6], timeout=90)
        elif have("traceroute"):
            out6 = run(["traceroute", "-6", "-q", "1", "-w", "2", "-m", str(max_hops), TRACE_TARGET_V6],
                       timeout=90)
    res["v4"] = _parse_traceroute(out4)
    res["v6"] = _parse_traceroute(out6)
    if not res["v4"] and IS_LINUX:
        prog.step("traceroute コマンドが使えないため、純 Python 実装で経路を追跡中")
        res["v4"] = _traceroute_recverr(max_hops=max_hops)
        res["v4_source"] = "recverr-fallback"
    return res


def _is_private_v4(ip):
    """RFC1918 のプライベートアドレスか。CGNAT (100.64/10) は含めない —
    日本の IPoE (MAP-E / DS-Lite) では途中経路に CGNAT 帯が普通に現れるため、
    これを混ぜると IPoE ユーザーを「二重ルーター」と誤検出してしまう。"""
    if not ip:
        return False
    try:
        a, b = (int(x) for x in ip.split(".")[:2])
    except (ValueError, IndexError):
        return False
    if a == 10:
        return True
    if a == 172 and 16 <= b <= 31:
        return True
    if a == 192 and b == 168:
        return True
    return False


def _is_cgnat_v4(ip):
    if not ip:
        return False
    try:
        a, b = (int(x) for x in ip.split(".")[:2])
    except (ValueError, IndexError):
        return False
    return a == 100 and 64 <= b <= 127


# --------------------------------------------------------------------------
# 6. DNS
# --------------------------------------------------------------------------

def collect_dns(prog):
    """アプリと同じ経路（システムのスタブリゾルバ経由）で名前解決の時間を測る。
    同じ名前を 2 回引き、1 回目（キャッシュに乗る前）と 2 回目（キャッシュ後）を
    分けて記録する。1 回だけだと、直前の測定で温まったキャッシュに当たって
    実際より速く見えることがある。"""
    prog.step("DNS の応答を測定中")
    samples = []
    for name in DNS_NAMES:
        row = {"name": name}
        for key in ("cold_ms", "warm_ms"):
            t0 = time.perf_counter()
            try:
                socket.getaddrinfo(name, 443, socket.AF_UNSPEC, socket.SOCK_STREAM)
                row[key] = round((time.perf_counter() - t0) * 1000, 1)
            except OSError:
                row[key] = None
        row["ok"] = row["cold_ms"] is not None
        samples.append(row)
    cold = [s["cold_ms"] for s in samples if s["cold_ms"] is not None]
    warm = [s["warm_ms"] for s in samples if s["warm_ms"] is not None]
    return {
        "samples": samples,
        "mean_ms": round(statistics.mean(cold), 1) if cold else None,
        "max_ms": round(max(cold), 1) if cold else None,
        "warm_mean_ms": round(statistics.mean(warm), 1) if warm else None,
        "failures": [s["name"] for s in samples if not s["ok"]],
    }


# --------------------------------------------------------------------------
# 7. 遅延計測エンジン
#    ICMP ping が使えない環境（コンテナ、企業ネットワーク等）は珍しくないので、
#    ICMP → UDP DNS クエリ → TCP 接続時間 の三段構えで必ず何かしら測れるようにする。
# --------------------------------------------------------------------------

DNS_PROBE_SERVERS = ["8.8.8.8", "1.1.1.1", "8.8.4.4", "1.0.0.1"]


def _dns_query_packet(name, qtype=1):
    """最小限の DNS クエリパケットを手組みする（依存ライブラリなし）。"""
    tid = random.randint(0, 0xFFFF)
    header = struct.pack(">HHHHHH", tid, 0x0100, 1, 0, 0, 0)
    qname = b"".join(bytes([len(p)]) + p.encode("ascii") for p in name.split(".")) + b"\x00"
    return header + qname + struct.pack(">HH", qtype, 1)


def _series_stats(times, sent, target, method):
    if not times:
        return None
    return {
        "target": target,
        "method": method,
        "samples": len(times),
        "loss_percent": round(100.0 * (sent - len(times)) / sent, 1) if sent else 0.0,
        "min_ms": round(min(times), 1),
        "avg_ms": round(statistics.mean(times), 1),
        "p95_ms": round(sorted(times)[min(len(times) - 1, math.ceil(0.95 * len(times)) - 1)], 1),
        "max_ms": round(max(times), 1),
        # ジッタは RFC 3550 系に合わせ「隣接サンプル差の平均」。ばらつき全体は stdev_ms に
        "jitter_ms": round(statistics.mean(abs(a - b) for a, b in zip(times, times[1:])), 1)
                     if len(times) > 1 else 0.0,
        "stdev_ms": round(statistics.pstdev(times), 1) if len(times) > 1 else 0.0,
    }


def _dns_rtt_series(server, count=10, interval=0.2, timeout=2.0):
    """UDP の DNS クエリで往復時間を測る。ICMP が使えない環境の代替。
    .invalid TLD はリゾルバがローカルで即答するため（RFC 6761）、
    再帰解決の揺らぎが乗らないほぼ純粋なネットワーク RTT になる。
    毎回ユニークな名前を使い、経路上のキャッシュ応答も避ける。"""
    times = []
    sent = 0
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(timeout)
    try:
        for i in range(count):
            pkt = _dns_query_packet(f"p{i}-{random.randrange(16 ** 8):08x}.wifi-diag.invalid")
            sent += 1
            t0 = time.perf_counter()
            try:
                s.sendto(pkt, (server, 53))
                s.recvfrom(512)
                times.append((time.perf_counter() - t0) * 1000)
            except OSError:
                pass
            if i < count - 1:
                time.sleep(interval)
    finally:
        s.close()
    return _series_stats(times, sent, server, "dns")


def _tcp_rtt_series(host, port=443, count=8, interval=0.25, timeout=3.0):
    """TCP 接続確立（SYN→SYN/ACK）の所要時間 ≒ 1 往復。最後の砦。
    接続拒否（RST）も 1 往復してから返るので RTT として数えられる。"""
    times = []
    sent = 0
    for i in range(count):
        sent += 1
        t0 = time.perf_counter()
        s = None
        try:
            s = socket.create_connection((host, port), timeout=timeout)
            times.append((time.perf_counter() - t0) * 1000)
        except ConnectionRefusedError:
            times.append((time.perf_counter() - t0) * 1000)
        except OSError:
            pass
        finally:
            if s is not None:
                s.close()
        if i < count - 1:
            time.sleep(interval)
    return _series_stats(times, sent, f"{host}:{port}", "tcp")


_LATENCY_METHOD = None


def detect_latency_method():
    """この環境で使える遅延計測手段を一度だけ判定して覚える。"""
    global _LATENCY_METHOD
    if _LATENCY_METHOD:
        return _LATENCY_METHOD
    r = _ping("8.8.8.8", count=2, interval=0.2, timeout=10)
    if r and r["samples"] > 0:
        _LATENCY_METHOD = "icmp"
    elif _dns_rtt_series("8.8.8.8", count=2, interval=0.1):
        _LATENCY_METHOD = "dns"
    else:
        _LATENCY_METHOD = "tcp"
    return _LATENCY_METHOD


def measure_rtt(target, count=10, interval=0.25, timeout=30, method=None):
    """検出済みの手段で target への RTT 統計を取る。"""
    method = method or detect_latency_method()
    if method == "icmp":
        r = _ping(target, count=count, interval=interval, timeout=timeout)
        if r:
            r["method"] = "icmp"
            return r
        return None
    if method == "dns":
        return _dns_rtt_series(target, count=count, interval=interval)
    return _tcp_rtt_series(target, count=min(count, 10), interval=interval)


METHOD_LABEL = {"icmp": "ICMP ping", "dns": "DNS クエリ (UDP/53)", "tcp": "TCP 接続時間"}


# --------------------------------------------------------------------------
# 7b. 公開リゾルバのベンチマーク
#     「DNS が遅い」は体感を大きく左右するのに、どのリゾルバが自分の環境から
#     速いかは場所によって全く違う。実測して一番速いものを提示する。
# --------------------------------------------------------------------------

PUBLIC_RESOLVERS = [
    ("Google", "8.8.8.8"),
    ("Google", "8.8.4.4"),
    ("Cloudflare", "1.1.1.1"),
    ("Cloudflare", "1.0.0.1"),
    ("Quad9", "9.9.9.9"),
]


def _system_nameservers():
    ns = []
    try:
        with open("/etc/resolv.conf", encoding="utf-8", errors="replace") as fh:
            for line in fh:
                m = re.match(r"\s*nameserver\s+(\S+)", line)
                if m and ":" not in m.group(1):
                    ns.append(m.group(1))
    except OSError:
        pass
    return ns


RESOLVE_TEST_NAMES = ["www.google.com", "en.wikipedia.org", "www.amazon.co.jp", "github.com"]


def _dns_resolve_ms(server, name, timeout=2.0):
    """server に A と AAAA を問い合わせ、遅い方の所要時間を返す（体感を決めるのは遅い方）。"""
    worst = None
    for qtype in (1, 28):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(timeout)
        t0 = time.perf_counter()
        try:
            s.sendto(_dns_query_packet(name, qtype), (server, 53))
            s.recvfrom(4096)
            dt = (time.perf_counter() - t0) * 1000
            worst = dt if worst is None else max(worst, dt)
        except OSError:
            return None
        finally:
            s.close()
    return worst


def collect_resolver_bench(prog):
    prog.step("公開 DNS リゾルバの速さを比較中（RTT と実在ドメインの解決時間）")
    system_ns = _system_nameservers()
    rows = []
    seen = set()

    def bench(label, ip, is_system):
        r = _dns_rtt_series(ip, count=6, interval=0.08)
        row = {"label": label, "ip": ip, "system": is_system,
               "min_ms": r["min_ms"] if r else None,
               "avg_ms": r["avg_ms"] if r else None,
               "resolve_ms": None}
        if r:
            # 素の RTT が横並びでも、キャッシュの充実度や再帰の速さで
            # 実際の解決時間には差が出る。推奨はこちらを基準にする。
            resolved = [x for x in (_dns_resolve_ms(ip, n)
                                    for n in RESOLVE_TEST_NAMES * 2)
                        if x is not None]
            if resolved:
                row["resolve_ms"] = round(statistics.mean(resolved), 1)
        rows.append(row)

    for label, ip in PUBLIC_RESOLVERS:
        bench(label, ip, ip in system_ns)
        seen.add(ip)
    for ip in system_ns[:2]:
        if ip not in seen:
            bench("ルーター" if _is_private_v4(ip) else "システム設定", ip, True)

    def score(x):
        return x["resolve_ms"] if x["resolve_ms"] is not None else x["avg_ms"]

    ok = [x for x in rows if score(x) is not None]
    best = min(ok, key=score) if ok else None
    return {"resolvers": rows, "system_nameservers": system_ns,
            "best": {"ip": best["ip"], "label": best["label"], "avg_ms": best["avg_ms"],
                     "resolve_ms": best["resolve_ms"]} if best else None}


# --------------------------------------------------------------------------
# 7c. ping（ICMP、使える環境でのみ）
# --------------------------------------------------------------------------

def _ping(host, count=10, interval=0.25, v6=False, timeout=None):
    # Windows の ping に送信間隔オプションはなく固定 1 秒。タイムアウトは実効所要時間から求める
    eff_interval = 1.0 if IS_WIN else interval
    if timeout is None:
        timeout = count * eff_interval + 15
    if IS_WIN:
        cmd = ["ping", "-n", str(count), "-w", "2000"]
        if v6:
            cmd.append("-6")
        cmd.append(host)
    else:
        base = "ping6" if (v6 and have("ping6")) else "ping"
        cmd = [base]
        if v6 and base == "ping":
            cmd.append("-6")
        cmd += ["-c", str(count), "-i", str(interval), host]
    out = run(cmd, timeout=timeout)
    if not out:
        return None
    # ロケール非依存: 「time=12.3 ms」「時間 =4ms」「Zeit=3ms」いずれも拾う
    times = [float(x) for x in re.findall(r"[=<]\s*([\d.]+)\s*ms", out)]
    if not times:
        return None
    return _series_stats(times, count, host, "icmp")


def collect_idle_latency(prog, gateway=None):
    method = detect_latency_method()
    prog.step(f"アイドル時の遅延を測定中（計測手段: {METHOD_LABEL[method]}）")
    res = {"targets": [], "method": method}
    if gateway:
        # ルーターまでの RTT。ICMP がなければ TCP（管理画面ポート）で。
        # 接続拒否でも 1 往復は測れる。
        r = _ping(gateway, count=10) if method == "icmp" else \
            _tcp_rtt_series(gateway, port=80, count=6, interval=0.15, timeout=2.0)
        if r:
            r["role"] = "gateway"
            res["targets"].append(r)
    for t in PING_TARGETS_V4:
        r = measure_rtt(t, count=15, method=method)
        if r:
            r["role"] = "internet_v4"
            res["targets"].append(r)
    if method == "icmp":
        r6 = _ping(PING_TARGET_V6, count=10, v6=True)
        if r6:
            r6["role"] = "internet_v6"
            r6["method"] = "icmp"
            res["targets"].append(r6)
    internet = [t for t in res["targets"] if t["role"] == "internet_v4"]
    if internet:
        res["idle_avg_ms"] = round(statistics.mean(t["avg_ms"] for t in internet), 1)
        res["idle_min_ms"] = round(min(t["min_ms"] for t in internet), 1)
        # 負荷時との差分は「同じターゲット」同士で取らないと意味がないので、
        # 負荷試験が使うターゲット（先頭）の値を基準として別に持つ
        ref = next((t for t in internet if t["target"] == PING_TARGETS_V4[0]), internet[0])
        res["idle_ref_target"] = ref["target"]
        res["idle_ref_avg_ms"] = ref["avg_ms"]
    else:
        res["idle_avg_ms"] = None
        res["idle_min_ms"] = None
        res["idle_ref_avg_ms"] = None
    return res


# --------------------------------------------------------------------------
# 8. スループット
# --------------------------------------------------------------------------

_DL_ENDPOINT_CACHE = [None]


def pick_download_endpoint():
    """使える下りエンドポイントを一度だけ選んで覚える。"""
    if _DL_ENDPOINT_CACHE[0] is not None:
        return _DL_ENDPOINT_CACHE[0]
    for ep in DOWNLOAD_ENDPOINTS:
        conn = None
        try:
            conn = FamilyHTTPSConnection(ep["host"], timeout=8)
            conn.request("GET", ep["path"], headers={"User-Agent": "wifi_diag/1.0"})
            resp = conn.getresponse()
            if resp.status == 200 and resp.read(4096):
                _DL_ENDPOINT_CACHE[0] = ep
                return ep
        except (OSError, http.client.HTTPException):
            pass
        finally:
            if conn is not None:
                try:
                    conn.close()
                except (OSError, http.client.HTTPException):
                    pass
    _DL_ENDPOINT_CACHE[0] = {}          # 「探したが無い」の印
    return {}


def _download_stream(stop_event, endpoint, counter, lock, timeout=30, errors=None):
    """endpoint からダウンロードし続け、受信バイト数を counter に加算する。
    ストリームが尽きたら開き直して、stop_event まで負荷を維持する。"""
    while not stop_event.is_set():
        conn = None
        got_any = False
        try:
            conn = FamilyHTTPSConnection(endpoint["host"], timeout=timeout)
            conn.request("GET", endpoint["path"], headers={"User-Agent": "wifi_diag/1.0"})
            resp = conn.getresponse()
            if resp.status != 200:
                # エラー応答を「高速なダウンロード」と誤認しないよう、ここで打ち切る
                resp.read()
                if errors is not None:
                    with lock:
                        errors.append(f"HTTP {resp.status} {resp.reason}")
                return
            while not stop_event.is_set():
                chunk = resp.read(65536)
                if not chunk:
                    break
                got_any = True
                with lock:
                    counter[0] += len(chunk)
        except (OSError, http.client.HTTPException) as e:
            if errors is not None:
                with lock:
                    errors.append(str(e) or e.__class__.__name__)
            if not got_any:
                return                  # 1 バイトも取れずに失敗したら再試行しない
        finally:
            if conn is not None:
                try:
                    conn.close()
                except (OSError, http.client.HTTPException):
                    pass


def measure_download(prog, duration=8.0, streams=4):
    ep = pick_download_endpoint()
    if not ep:
        return {"mbps": None, "error": "利用可能なダウンロード先がありません（すべて遮断されています）"}
    prog.step(f"下り速度を測定中（{streams} 並列 / {duration:.0f} 秒 / 接続先: {ep['name']}）")
    counter = [0]
    lock = threading.Lock()
    stop = threading.Event()
    errors = []
    threads = [
        threading.Thread(target=_download_stream,
                         args=(stop, ep, counter, lock, 30, errors),
                         daemon=True)
        for _ in range(streams)
    ]
    for t in threads:
        t.start()
    time.sleep(1.0)                    # 立ち上がり（TCP スロースタート）を除外
    with lock:
        base, t0 = counter[0], time.perf_counter()
    time.sleep(duration)
    with lock:
        end, t1 = counter[0], time.perf_counter()
    elapsed = t1 - t0
    got = end - base
    stop.set()
    for t in threads:
        t.join(timeout=2)
    if got <= 0:
        reason = errors[0] if errors else "通信をブロックされている可能性があります"
        return {"mbps": None, "error": f"ダウンロードできませんでした: {reason}"}
    return {"mbps": round(got * 8 / elapsed / 1e6, 1), "bytes": got,
            "seconds": round(elapsed, 1), "endpoint": ep["name"]}


def measure_upload(prog, payload_mb=8):
    prog.step(f"上り速度を測定中（{payload_mb} MB）")
    payload = b"\x00" * (payload_mb * 1024 * 1024)
    try:
        conn = FamilyHTTPSConnection(CF_HOST, timeout=45)
        conn.connect()                      # TCP+TLS ハンドシェイクを計測から外す
        t0 = time.perf_counter()
        conn.request("POST", CF_UP, body=payload,
                     headers={"User-Agent": "wifi_diag/1.0",
                              "Content-Type": "application/octet-stream",
                              "Content-Length": str(len(payload))})
        resp = conn.getresponse()
        status, reason = resp.status, resp.reason
        resp.read()
        elapsed = time.perf_counter() - t0
        conn.close()
        if status // 100 != 2:
            # エラーが即返ってきただけの場合に非現実的な速度を報告しないようにする
            return {"mbps": None, "error": f"アップロードが拒否されました: HTTP {status} {reason}"}
        if elapsed <= 0:
            return {"mbps": None, "error": "計測時間がゼロでした"}
        return {"mbps": round(len(payload) * 8 / elapsed / 1e6, 1), "seconds": round(elapsed, 1)}
    except (OSError, http.client.HTTPException) as e:
        return {"mbps": None, "error": f"アップロードできませんでした: {e or e.__class__.__name__}"}


# --------------------------------------------------------------------------
# 9. バッファブロート / 負荷時の応答性（RPM）
# --------------------------------------------------------------------------

_RPM_ENDPOINT_CACHE = [None]


def pick_rpm_endpoint():
    if _RPM_ENDPOINT_CACHE[0] is not None:
        return _RPM_ENDPOINT_CACHE[0]
    for ep in RPM_ENDPOINTS:
        conn = None
        try:
            conn = FamilyHTTPSConnection(ep["host"], timeout=6)
            conn.request("GET", ep["path"], headers={"User-Agent": "wifi_diag/1.0"})
            resp = conn.getresponse()
            resp.read()
            if resp.status == 200:
                _RPM_ENDPOINT_CACHE[0] = ep
                return ep
        except (OSError, http.client.HTTPException):
            pass
        finally:
            if conn is not None:
                try:
                    conn.close()
                except (OSError, http.client.HTTPException):
                    pass
    _RPM_ENDPOINT_CACHE[0] = {}
    return {}


def _http_round_trips(stop_event, results, lock):
    """小さな HTTPS リクエストを繰り返し、1 往復に要する秒数を記録する。
    Apple の RPM と同じ考え方（= 実際のアプリが感じる往復）。
    接続は keep-alive で使い回す。毎回張り直すと TLS ハンドシェイク
    （3 往復ぶん）が混ざり、RPM を実際より悪く見積もってしまうため。"""
    ep = pick_rpm_endpoint()
    if not ep:
        return
    conn = None
    while not stop_event.is_set():
        t0 = time.perf_counter()
        try:
            if conn is None:
                conn = FamilyHTTPSConnection(ep["host"], timeout=15)
            conn.request("GET", ep["path"], headers={"User-Agent": "wifi_diag/1.0"})
            resp = conn.getresponse()
            resp.read()
            dt = time.perf_counter() - t0
            with lock:
                results.append(dt)
        except (OSError, http.client.HTTPException):
            # サーバー側で切られたら次の周回で張り直す
            if conn is not None:
                try:
                    conn.close()
                except (OSError, http.client.HTTPException):
                    pass
            conn = None
        time.sleep(0.05)
    if conn is not None:
        try:
            conn.close()
        except (OSError, http.client.HTTPException):
            pass


def measure_networkquality(prog):
    """macOS 12+ の内蔵ツール。Apple 公式の RPM が取れるので最優先で使う。"""
    if not (IS_MAC and have("networkQuality")):
        return None
    prog.step("networkQuality（Apple 公式の RPM 計測）を実行中 — 30 秒ほどかかります")
    out = run(["networkQuality", "-c"], timeout=180)
    if not out:
        return None
    try:
        start = out.index("{")
        data = json.loads(out[start:])
    except (ValueError, json.JSONDecodeError):
        return None
    return {
        "source": "networkQuality",
        "dl_throughput_mbps": _round(data.get("dl_throughput"), 1e6),
        "ul_throughput_mbps": _round(data.get("ul_throughput"), 1e6),
        "dl_responsiveness_rpm": data.get("dl_responsiveness"),
        "ul_responsiveness_rpm": data.get("ul_responsiveness"),
        "responsiveness_rpm": data.get("responsiveness") or data.get("dl_responsiveness"),
        "base_rtt_ms": data.get("base_rtt"),
        "raw": data,
    }


def _round(v, div, nd=1):
    try:
        return round(v / div, nd)
    except (TypeError, ZeroDivisionError):
        return None


def measure_bufferbloat(prog, idle_avg_ms, duration=10.0, streams=4):
    """自前のバッファブロート計測。回線を飽和させながら遅延と往復回数を測る。"""
    prog.step(f"負荷をかけながらの遅延を測定中（{duration:.0f} 秒）— ここが本命です")
    counter = [0]
    dl_lock = threading.Lock()
    stop = threading.Event()
    rt_results = []
    rt_lock = threading.Lock()

    ep = pick_download_endpoint()
    if not ep:
        return {"error": "利用可能なダウンロード先がなく、負荷をかけられませんでした。"}
    load_errors = []
    loaders = [
        threading.Thread(target=_download_stream,
                         args=(stop, ep, counter, dl_lock, 30, load_errors),
                         daemon=True)
        for _ in range(streams)
    ]
    for t in loaders:
        t.start()
    rt_thread = threading.Thread(target=_http_round_trips, args=(stop, rt_results, rt_lock), daemon=True)
    rt_thread.start()

    time.sleep(1.5)                     # 回線が埋まるまで待つ
    with dl_lock:
        base_bytes, t_load0 = counter[0], time.perf_counter()
    with rt_lock:
        rt_results.clear()

    method = detect_latency_method()
    n_probes = int(duration / 0.25)
    if method == "icmp" and IS_WIN:
        n_probes = max(4, int(duration))          # Windows ping は 1 秒間隔固定
    t0 = time.perf_counter()
    loaded_ping = measure_rtt(PING_TARGETS_V4[0], count=n_probes, interval=0.25,
                              timeout=duration + 25)
    elapsed = time.perf_counter() - t0

    with dl_lock:
        got, t_load1 = counter[0] - base_bytes, time.perf_counter()
    load_elapsed = t_load1 - t_load0
    with rt_lock:
        trips = list(rt_results)
    stop.set()
    for t in loaders:
        t.join(timeout=2)
    rt_thread.join(timeout=3)

    res = {
        "loaded_download_mbps": round(got * 8 / load_elapsed / 1e6, 1)
                                if got > 0 and load_elapsed > 0 else None,
        "seconds": round(load_elapsed, 1),
        "endpoint": ep["name"],
        "latency_method": detect_latency_method(),
    }
    if got <= 0:
        res["error"] = ("回線に負荷をかけられませんでした: "
                        + (load_errors[0] if load_errors else "ダウンロードが確立できません")
                        + "。この状態の負荷時遅延は参考値になりません。")
    if loaded_ping:
        res["loaded_ping"] = loaded_ping
        res["loaded_avg_ms"] = loaded_ping["avg_ms"]
        res["loaded_p95_ms"] = loaded_ping["p95_ms"]
        res["loaded_max_ms"] = loaded_ping["max_ms"]
        if idle_avg_ms is not None:
            res["latency_increase_ms"] = round(loaded_ping["avg_ms"] - idle_avg_ms, 1)
    if trips:
        mean_trip = statistics.mean(trips)
        res["http_round_trips"] = len(trips)
        res["mean_round_trip_ms"] = round(mean_trip * 1000, 1)
        res["approx_rpm"] = round(60.0 / mean_trip) if mean_trip > 0 else None
        res["rpm_note"] = "自前計測による RPM 近似値（Apple の networkQuality とは算出方法が異なります）"
    return res


# --------------------------------------------------------------------------
# 判定ロジック
# --------------------------------------------------------------------------

def grade_rpm(rpm):
    if rpm is None:
        return None, "—"
    if rpm >= 1000:
        return "A", "非常に良い（負荷時もほぼ無遅延）"
    if rpm >= 400:
        return "B", "良い（ビデオ会議も安定）"
    if rpm >= 200:
        return "C", "普通（重い時に少しもたつく）"
    if rpm >= 100:
        return "D", "悪い（同時利用でストレス）"
    return "F", "非常に悪い（典型的なバッファブロート）"


def grade_bloat(increase_ms):
    if increase_ms is None:
        return None, "—"
    if increase_ms < 30:                # 負値（測定誤差の範囲）もここに含む
        return "A", "バッファブロートなし"
    if increase_ms < 100:
        return "B", "わずかなバッファブロート"
    if increase_ms < 300:
        return "C", "はっきりしたバッファブロート"
    if increase_ms < 1000:
        return "D", "重度のバッファブロート"
    return "F", "極めて重度（通信中はほぼ操作不能）"


def analyze(r):
    """収集結果からファインディング（重大度つきの所見）を組み立てる。"""
    f = []

    def add(level, title, detail, action=None):
        f.append({"level": level, "title": title, "detail": detail, "action": action})

    # --- IPv6 / IPoE ---
    wan = r.get("wan") or {}
    local = r.get("local") or {}
    v4 = wan.get("v4") or {}
    v6 = wan.get("v6")
    if local.get("has_global_ipv6") and not v6:
        add("warn", "IPv6 アドレスはあるのに外部に到達できません",
            "端末にグローバル IPv6 が付いていますが、IPv6 での外部通信が失敗します。"
            "ISP 側の IPv6 障害、ルーターのファイアウォール、または設定の中途半端な"
            "IPv6 有効化が疑われます。この状態は「IPv6 対応サイトへの接続が"
            "タイムアウトまで待たされてから IPv4 に落ちる」遅さの原因になります。",
            "ルーターの IPv6 設定を確認し、直らなければ一時的に端末の IPv6 を無効化すると"
            "体感が改善することがあります。")
    elif not local.get("has_global_ipv6") and not v6:
        add("critical", "IPv6 が使えていません",
            "グローバル IPv6 アドレスが端末に付いておらず、IPv6 での外部到達もできません。"
            "国内主要 ISP の速度・遅延の改善はほぼ IPv6 IPoE 経由なので、"
            "この状態だと古い PPPoE 方式のまま（＝プロバイダの網終端装置がボトルネック）である可能性が高いです。",
            "契約中の ISP の IPoE（IPv4 over IPv6）に対応した機器・オプションを確認してください。"
            "SoftBank 光の場合は光BBユニットが認証を担うため、市販ルーター単体では IPoE 化できません。")
    elif not local.get("has_global_ipv6") and v6:
        add("warn", "端末に IPv6 が降りてきていません",
            "外部への IPv6 到達はあるのに端末にグローバル IPv6 が付いていません。"
            "ルーターの RA/DHCPv6 配布設定か、二重ルーターが疑わしいです。",
            "ルーターの IPv6 パススルー / RA 設定を確認してください。")
    else:
        add("ok", "IPv6 が有効です",
            f"IPv6 で外部に到達できています（{(v6 or {}).get('ip', '—')}）。IPoE 経路に乗っている可能性が高いです。")

    # --- 経路と ASN ---
    if v4.get("as_org"):
        v6org = (v6 or {}).get("as_org")
        if v6org and v6org != v4.get("as_org"):
            add("info", "IPv4 と IPv6 で経路が異なります",
                f"IPv4 は {v4.get('as_org')} (AS{v4.get('asn')})、"
                f"IPv6 は {v6org} (AS{(v6 or {}).get('asn')}) 経由です。"
                "IPv4 がまだ PPPoE 側に残っている（IPv4 over IPv6 に載っていない）可能性があります。",
                "ルーターの IPv4 over IPv6（MAP-E / DS-Lite / v6プラス等）設定を確認してください。")
        else:
            add("info", "接続先の情報",
                f"IPv4: {v4.get('ip')} / {v4.get('as_org')} (AS{v4.get('asn')}) / 接続 POP: {v4.get('colo')}")

    # --- 二重ルーター ---
    hops = (r.get("traceroute") or {}).get("v4") or []
    private_hops = [h for h in hops[:3] if _is_private_v4(h.get("ip"))]
    distinct = {h["ip"] for h in private_hops}
    if len(private_hops) >= 2 and len(distinct) >= 2:
        add("warn", "二重ルーターの疑いがあります",
            "経路の最初の 3 ホップ以内に、異なるプライベート IP が 2 つ以上ありました"
            f"（{', '.join(sorted(distinct))}）。"
            "ルーターが 2 段になっていると NAT が二重にかかり、遅延と不安定さの原因になります。",
            "ISP 提供機器をルーターとして使い、市販ルーターは「アクセスポイント（ブリッジ）モード」に切り替えてください。")
    cgnat_hops = [h for h in hops[:4] if _is_cgnat_v4(h.get("ip"))]
    if cgnat_hops:
        add("info", "経路上に CGNAT 帯 (100.64.0.0/10) を検出",
            "ISP 側でアドレス共有（CGNAT）または IPv4 over IPv6 (MAP-E / DS-Lite) が"
            "使われている痕跡です。IPoE 環境では正常な構成であり、異常ではありません。")

    gw = local.get("gateway_v4")
    if gw and gw.startswith("192.168.3."):
        add("info", "ゲートウェイが 192.168.3.x です",
            "SoftBank の光BBユニットは既定で 192.168.3.0/24 を使います。"
            "光BBユニットが直接のゲートウェイになっている可能性があります（あくまで傍証です）。")

    # --- Wi-Fi ---
    wifi = r.get("wifi") or {}
    rssi = wifi.get("rssi_dbm")
    snr = wifi.get("snr_db")
    if rssi is not None and wifi.get("rssi_estimated"):
        add("info", "Wi-Fi 信号強度は % からの換算値です",
            "Windows は信号を % でしか公開しないため、dBm は近似値です。傾向の把握には使えます。")
    if rssi is not None:
        if rssi <= -75:
            add("warn", "Wi-Fi の電波が弱いです",
                f"RSSI {rssi} dBm。-75 dBm 以下は速度が大きく落ちる領域です。",
                "ルーターに近づく、5GHz 帯に接続する、または中継機・メッシュを検討してください。")
        elif rssi <= -67:
            add("info", "Wi-Fi の電波はやや弱めです", f"RSSI {rssi} dBm（実用範囲だが最良ではありません）。")
        else:
            add("ok", "Wi-Fi の電波は良好です", f"RSSI {rssi} dBm。")
    if snr is not None:
        if snr < 20:
            add("warn", "Wi-Fi のノイズが多いです",
                f"SNR {snr} dB。20 dB を切るとリンク速度が落ち、再送が増えます。",
                "混雑の少ないチャンネル、または 5GHz / 6GHz 帯へ移してください。")
        else:
            add("ok", "Wi-Fi の S/N 比は良好です", f"SNR {snr} dB。")

    # --- DNS ---
    dns = r.get("dns") or {}
    if dns.get("mean_ms") is not None:
        if dns["mean_ms"] > 120:
            add("warn", "DNS の応答が遅いです",
                f"平均 {dns['mean_ms']} ms。ページを開いた瞬間の反応が鈍く感じる原因になります。",
                "ルーターの DNS を 1.1.1.1 / 8.8.8.8 などに変更して再測定してみてください。")
        else:
            add("ok", "DNS の応答は良好です", f"平均 {dns['mean_ms']} ms。")
    if dns.get("failures"):
        add("warn", "名前解決に失敗したドメインがあります", ", ".join(dns["failures"]))

    # --- リゾルバの改善余地 ---
    rb = r.get("resolver_bench") or {}
    best = rb.get("best")

    def _score(x):
        return x["resolve_ms"] if x.get("resolve_ms") is not None else x.get("avg_ms")

    sys_rows = [x for x in (rb.get("resolvers") or [])
                if x.get("system") and _score(x) is not None]
    if best and sys_rows:
        cur = min(sys_rows, key=_score)
        best_score = best.get("resolve_ms") or best.get("avg_ms")
        cur_score = _score(cur)
        if cur["ip"] != best["ip"] and cur_score > best_score * 1.4 \
                and cur_score - best_score > 5:
            add("warn", "いまの DNS より速いリゾルバがあります",
                f"現在の設定 {cur['ip']}（実解決 {cur_score} ms）に対し、"
                f"{best['label']} {best['ip']} は {best_score} ms でした"
                f"（約 {cur_score / best_score:.1f} 倍差）。名前解決はページを開くたびに"
                "発生するので、体感の初速に直結します。",
                f"OS またはルーターの DNS 設定を {best['ip']} に変更してください。")
        elif cur["ip"] == best["ip"]:
            add("ok", "DNS リゾルバの選択は最適です",
                f"現在の {cur['ip']} が計測した中で最速でした（実解決 {cur_score} ms）。")
    elif best and not sys_rows and rb.get("system_nameservers"):
        add("info", "現在の DNS の速度を直接測定できませんでした",
            f"参考: 計測した公開リゾルバの最速は {best['label']} {best['ip']}"
            f"（{best['avg_ms']} ms）でした。")

    # --- アイドル遅延 ---
    lat = r.get("latency") or {}
    if lat.get("idle_avg_ms") is not None:
        idle = lat["idle_avg_ms"]
        if idle > 30:
            add("warn", "アイドル時の遅延が大きいです",
                f"平均 {idle} ms。国内の光回線としては明確に高い値です（良好な IPoE 接続なら 5〜15 ms）。",
                "PPPoE の網終端装置での混雑、または経路の問題が疑われます。"
                "時間帯を変えて再測定し、夜だけ悪化するなら混雑が原因です。")
        elif idle > 15:
            add("info", "アイドル時の遅延はやや高めです",
                f"平均 {idle} ms（実用範囲ですが、良好な光回線は 5〜15 ms です）。")
        else:
            add("ok", "アイドル時の遅延は良好です", f"平均 {idle} ms。")

    # --- 本命：バッファブロート ---
    nq = r.get("networkquality") or {}
    bb = r.get("bufferbloat") or {}
    rpm = nq.get("responsiveness_rpm") or bb.get("approx_rpm")
    if rpm:
        g, label = grade_rpm(rpm)
        src = "networkQuality" if nq.get("responsiveness_rpm") else "自前計測（近似）"
        lvl = "ok" if g in ("A", "B") else ("warn" if g == "C" else "critical")
        add(lvl, f"負荷時の応答性: {rpm} RPM（評価 {g}）",
            f"{label}。1 往復あたり約 {60000 / rpm:.0f} ms 相当です。計測元: {src}。",
            None if lvl == "ok" else
            "これは「速度の天井」ではなく「詰まり」の問題です。まず IPv6 IPoE 化、"
            "次にルーターの SQM / スマートキュー（fq_codel, cake）有効化が効きます。")
    inc = bb.get("latency_increase_ms")
    if inc is not None:
        g, label = grade_bloat(inc)
        lvl = "ok" if g in ("A", "B") else ("warn" if g == "C" else "critical")
        add(lvl, f"負荷時の遅延増加: {inc:+.1f} ms（評価 {g}）",
            f"{label}。アイドル {lat.get('idle_avg_ms')} ms → 負荷時 {bb.get('loaded_avg_ms')} ms。")

    # --- 計測そのものが成立したか ---
    if not (r.get("latency") or {}).get("targets"):
        add("warn", "遅延を測定できませんでした",
            "ICMP・DNS・TCP のどの手段でも往復時間を測定できませんでした。"
            "外向き通信を強く制限されたネットワークか、VPN 配下の可能性があります。",
            "VPN を切って、自宅の Wi-Fi に直接つないだ状態で再実行してください。")
    elif (r.get("latency") or {}).get("method") == "tcp":
        add("info", "遅延は TCP 接続時間で近似しています",
            "ICMP と DNS が使えないため精度は落ちます。傾向の把握には十分です。")
    if bb.get("error"):
        add("warn", "負荷試験が成立しませんでした", bb["error"],
            "この結果のバッファブロート値は無視してください。ネットワークを変えて再実行が必要です。")
    for kind, key in (("下り", "download"), ("上り", "upload")):
        node = (r.get("throughput") or {}).get(key) or {}
        if node.get("error"):
            add("warn", f"{kind}速度を測定できませんでした", node["error"])

    # --- スループット ---
    dl = (r.get("throughput") or {}).get("download") or {}
    loaded = bb.get("loaded_download_mbps")
    if dl.get("mbps") and loaded:
        if loaded < dl["mbps"] * 0.5:
            add("info", "負荷時にスループットが落ち込みます",
                f"単独測定 {dl['mbps']} Mbps に対し、遅延測定と同時では {loaded} Mbps。"
                "キューが詰まって実効帯域が出ていない状態です。")
    return f


# --------------------------------------------------------------------------
# レポート出力
# --------------------------------------------------------------------------

ICON = {"ok": "✅", "info": "ℹ️ ", "warn": "⚠️ ", "critical": "🚨"}


def print_report(r):
    w = r.get("wifi") or {}
    local = r.get("local") or {}
    wan = r.get("wan") or {}
    lat = r.get("latency") or {}
    tp = r.get("throughput") or {}
    bb = r.get("bufferbloat") or {}
    nq = r.get("networkquality") or {}

    print()
    print("=" * 68)
    label = r.get("label")
    print(f" 回線診断レポート{f'  [{label}]' if label else ''}")
    sysinfo = r.get("system") or {}
    print(f" {sysinfo.get('timestamp', '日時不明')}   {sysinfo.get('os', 'OS 不明')}")
    print("=" * 68)

    print("\n■ Wi-Fi")
    if w.get("ssid"):
        print(f"   SSID          : {w.get('ssid')}")
        print(f"   信号 / ノイズ : {fmt(w.get('rssi_dbm'),' dBm')} / {fmt(w.get('noise_dbm'),' dBm')}"
              f"   SNR: {fmt(w.get('snr_db'),' dB')}")
        print(f"   チャンネル    : {fmt(w.get('channel'))}   リンク速度: {fmt(w.get('tx_rate_mbps'),' Mbps')}")
    else:
        print(f"   {w.get('error', '情報なし')}")

    print("\n■ アドレスと経路")
    print(f"   ローカル v4   : {fmt(local.get('local_ipv4'))}   ゲートウェイ: {fmt(local.get('gateway_v4'))}")
    print(f"   ローカル v6   : {fmt(local.get('local_ipv6'))}"
          f"   （グローバル v6: {'あり' if local.get('has_global_ipv6') else 'なし'}）")
    v4 = wan.get("v4") or {}
    v6 = wan.get("v6") or {}
    print(f"   WAN v4        : {fmt(v4.get('ip'))}  {fmt(v4.get('as_org'))}")
    print((f"   WAN v6        : {fmt(v6.get('ip')) if v6 else 'IPv6 で外部到達できません'}"
           f"  {fmt(v6.get('as_org')) if v6 else ''}").rstrip())

    hops = (r.get("traceroute") or {}).get("v4") or []
    if hops:
        via = "（純 Python 実装）" if (r.get("traceroute") or {}).get("v4_source") else ""
        print(f"\n   経路 (IPv4, 先頭 5 ホップ){via}:")
        for h in hops[:5]:
            name = h.get("host") or h.get("ip") or "*"
            print(f"     {h['hop']:>2}. {name:<44} {fmt(h.get('rtt_ms'),' ms')}")

    print("\n■ 遅延")
    if lat.get("method") and lat["method"] != "icmp":
        print(f"   （ICMP ping が使えない環境のため {METHOD_LABEL[lat['method']]} で計測）")
    if not lat.get("targets"):
        print("   どの手段でも遅延を測定できませんでした")
    for t in lat.get("targets", []):
        print(f"   {t['role']:<12} {t['target']:<24} "
              f"avg {fmt(t['avg_ms'],' ms')}  p95 {fmt(t['p95_ms'],' ms')}  "
              f"jitter {fmt(t['jitter_ms'],' ms')}  loss {fmt(t['loss_percent'],'%')}")

    dns = r.get("dns") or {}
    print(f"\n■ DNS（システム経由の名前解決）: 初回平均 {fmt(dns.get('mean_ms'),' ms')}"
          f"   最大 {fmt(dns.get('max_ms'),' ms')}"
          f"   キャッシュ後 {fmt(dns.get('warm_mean_ms'),' ms')}")
    rb = r.get("resolver_bench") or {}
    if rb.get("resolvers"):
        print("\n■ リゾルバ比較（RTT と、実在ドメインの解決時間）")
        for row in rb["resolvers"]:
            mark = "  ← 現在の設定" if row.get("system") else ""
            print("   " + pad(row["label"], 12) + pad(row["ip"], 12)
                  + f" RTT {pad(fmt(row['avg_ms'],' ms'), 9, '>')}"
                  + f"  解決 {pad(fmt(row.get('resolve_ms'),' ms'), 9, '>')}" + mark)

    print("\n■ スループット")
    dl = tp.get("download") or {}
    ul = tp.get("upload") or {}
    print(f"   下り（単独） : {fmt(dl.get('mbps'),' Mbps')}"
          f"{'   ← ' + dl['error'] if dl.get('error') else ''}")
    print(f"   上り（単独） : {fmt(ul.get('mbps'),' Mbps')}"
          f"{'   ← ' + ul['error'] if ul.get('error') else ''}")
    ep_note = f"   （接続先: {dl.get('endpoint')}）" if dl.get("endpoint") else ""
    print(f"   下り（負荷時）: {fmt(bb.get('loaded_download_mbps'),' Mbps')}{ep_note}")

    print("\n■ バッファブロート（ここが体感を決めます）")
    print(f"   アイドル遅延  : {fmt(lat.get('idle_avg_ms'),' ms')}")
    print(f"   負荷時 遅延   : avg {fmt(bb.get('loaded_avg_ms'),' ms')}  "
          f"p95 {fmt(bb.get('loaded_p95_ms'),' ms')}  max {fmt(bb.get('loaded_max_ms'),' ms')}")
    if bb.get("latency_increase_ms") is not None:
        g, lab = grade_bloat(bb["latency_increase_ms"])
        print(f"   遅延の増加    : {bb['latency_increase_ms']:+.1f} ms   評価 {g}（{lab}）")
    rpm = nq.get("responsiveness_rpm") or bb.get("approx_rpm")
    if rpm:
        g, lab = grade_rpm(rpm)
        src = "networkQuality" if nq.get("responsiveness_rpm") else "近似"
        print(f"   応答性 RPM    : {rpm}（{src}）   評価 {g}（{lab}）")

    print("\n" + "=" * 68)
    print(" 所見")
    print("=" * 68)
    order = {"critical": 0, "warn": 1, "info": 2, "ok": 3}
    for fi in sorted(r.get("findings", []), key=lambda x: order.get(x["level"], 9)):
        print(f"\n{ICON.get(fi['level'],'  ')} {fi['title']}")
        print(f"   {fi['detail']}")
        if fi.get("action"):
            print(f"   → {fi['action']}")
    print()


# --------------------------------------------------------------------------
# 比較モード
# --------------------------------------------------------------------------

def _get(d, path, default=None):
    cur = d
    for k in path.split("."):
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k)
        if cur is None:
            return default
    return cur


COMPARE_ROWS = [
    ("負荷時の応答 (RPM)",        "rpm",                            "higher"),
    ("負荷時の遅延 (ms)",         "bufferbloat.loaded_avg_ms",      "lower"),
    ("遅延の増加 (ms)",           "bufferbloat.latency_increase_ms", "lower"),
    ("アイドル遅延 (ms)",         "latency.idle_avg_ms",            "lower"),
    ("下り 単独 (Mbps)",          "throughput.download.mbps",       "higher"),
    ("下り 負荷時 (Mbps)",        "bufferbloat.loaded_download_mbps", "higher"),
    ("上り (Mbps)",               "throughput.upload.mbps",         "higher"),
    ("DNS 平均 (ms)",             "dns.mean_ms",                    "lower"),
    ("Wi-Fi RSSI (dBm)",          "wifi.rssi_dbm",                  "higher"),
]


def _rpm_of(d):
    return _get(d, "networkquality.responsiveness_rpm") or _get(d, "bufferbloat.approx_rpm")


def _delta_text(va, vb, direction):
    """「高いほど良い」「低いほど良い」を取り違えないよう、向きに応じて表記を変える。
    比率は両方が正のときだけ意味を持つ。dBm のような負値は差分で表す。"""
    if not (isinstance(va, (int, float)) and isinstance(vb, (int, float))):
        return ""
    if va == vb:
        return "変化なし"
    diff = vb - va
    improved = (diff > 0) if direction == "higher" else (diff < 0)
    mark = "✅" if improved else "⚠️"
    if va <= 0 or vb <= 0:
        return f"{mark} {diff:+.1f}"
    if direction == "higher":
        return f"{mark} {vb / va:.1f}倍"
    if diff < 0:
        if va / vb >= 1.95:
            return f"{mark} {diff:+.1f}  (1/{va / vb:.0f})"
        return f"{mark} {diff:+.1f}  ({(1 - vb / va) * 100:.0f}% 減)"
    return f"{mark} {diff:+.1f}  ({vb / va:.1f}倍に悪化)"


def compare(path_a, path_b):
    with open(path_a, encoding="utf-8") as fa:
        a = json.load(fa)
    with open(path_b, encoding="utf-8") as fb:
        b = json.load(fb)

    print()
    print("=" * 74)
    print(" 比較レポート")
    print(f"   BEFORE: {a.get('label') or os.path.basename(path_a)}   {_get(a,'system.timestamp')}")
    print(f"   AFTER : {b.get('label') or os.path.basename(path_b)}   {_get(b,'system.timestamp')}")
    print("=" * 74)
    print("\n" + pad("項目", 24) + pad("BEFORE", 12, ">") + pad("AFTER", 12, ">")
          + "   " + "変化")
    print("-" * 74)

    for name, path, direction in COMPARE_ROWS:
        va = _rpm_of(a) if path == "rpm" else _get(a, path)
        vb = _rpm_of(b) if path == "rpm" else _get(b, path)
        if va is None and vb is None:
            continue
        print((pad(name, 24) + pad(fmt(va), 12, ">") + pad(fmt(vb), 12, ">")
               + "   " + _delta_text(va, vb, direction)).rstrip())

    v6a = _get(a, "local.has_global_ipv6")
    v6b = _get(b, "local.has_global_ipv6")
    if v6b and not v6a:
        v6delta = "✅ 有効化"
    elif v6a and not v6b:
        v6delta = "⚠️ 無効化"
    else:
        v6delta = "変化なし"
    print(pad("IPv6", 24) + pad("あり" if v6a else "なし", 12, ">")
          + pad("あり" if v6b else "なし", 12, ">") + "   " + v6delta)
    print()

    orga = _get(a, "wan.v4.as_org")
    orgb = _get(b, "wan.v4.as_org")
    if orga != orgb:
        print(f"※ IPv4 の経路が変わりました: {orga} → {orgb}")
    print()


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(
        description="自宅回線 / Wi-Fi を一括診断し、バッファブロートまで測定します。",
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--label", help="この計測につけるラベル（例: before / after）")
    ap.add_argument("--outdir", default="results", help="JSON の保存先（既定: results）")
    ap.add_argument("--quick", action="store_true", help="短縮版（測定時間を約半分に）")
    ap.add_argument("--no-load", action="store_true", help="負荷試験を行わない（回線を占有しない）")
    ap.add_argument("--no-networkquality", action="store_true",
                    help="macOS の networkQuality を使わない")
    ap.add_argument("--streams", type=int, default=4, help="並列ダウンロード数（既定: 4）")
    ap.add_argument("--json", action="store_true", help="レポートを出さず JSON だけを標準出力に出す")
    ap.add_argument("--compare", nargs=2, metavar=("BEFORE", "AFTER"), help="2 つの JSON を比較")
    ap.add_argument("--show", metavar="JSON", help="保存済みの結果からレポートを再表示する")
    args = ap.parse_args()

    if args.compare:
        compare(*args.compare)
        return 0

    if args.show:
        with open(args.show, encoding="utf-8") as fh:
            saved = json.load(fh)
        if not saved.get("findings"):
            saved["findings"] = analyze(saved)
        print_report(saved)
        return 0

    prog = Progress(enabled=not args.json)
    dur_dl = 4.0 if args.quick else 8.0
    dur_bb = 6.0 if args.quick else 10.0

    if not args.json:
        print("\n回線を診断します。所要時間の目安: "
              f"{'約 1 分' if args.quick else '約 2〜3 分'}")
        print("（正確を期すため、実行中は他の大きな通信を止めてください）\n")

    r = {"schema_version": SCHEMA_VERSION, "label": args.label}
    r["system"] = collect_system()

    prog.step("Wi-Fi の状態を取得中")
    r["wifi"] = collect_wifi()

    prog.step("ローカルのアドレスとゲートウェイを確認中")
    r["local"] = collect_local()

    r["wan"] = collect_wan(prog)
    r["traceroute"] = collect_traceroute(prog)
    r["dns"] = collect_dns(prog)
    r["resolver_bench"] = collect_resolver_bench(prog)
    r["latency"] = collect_idle_latency(prog, gateway=r["local"].get("gateway_v4"))

    r["throughput"] = {}
    if not args.no_load:
        r["throughput"]["download"] = measure_download(prog, duration=dur_dl, streams=args.streams)
        time.sleep(1.5)                     # 下りの残留トラフィックが上り測定を汚さないように
        r["throughput"]["upload"] = measure_upload(prog, payload_mb=4 if args.quick else 8)
        time.sleep(1.0)
        r["bufferbloat"] = measure_bufferbloat(
            prog,
            r["latency"].get("idle_ref_avg_ms") or r["latency"].get("idle_avg_ms"),
            duration=dur_bb, streams=args.streams)
        if not args.no_networkquality:
            nq = measure_networkquality(prog)
            if nq:
                r["networkquality"] = nq
    else:
        r["bufferbloat"] = {}

    r["findings"] = analyze(r)

    os.makedirs(args.outdir, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    suffix = f"-{args.label}" if args.label else ""
    outpath = os.path.join(args.outdir, f"{stamp}{suffix}.json")
    with open(outpath, "w", encoding="utf-8") as fh:
        json.dump(r, fh, ensure_ascii=False, indent=2)

    if args.json:
        print(json.dumps(r, ensure_ascii=False, indent=2))
    else:
        print_report(r)
        print(f"結果を保存しました: {outpath}")
        print(f"対策後にもう一度実行し、次のコマンドで比較できます:\n"
              f"  python3 {os.path.basename(__file__)} --compare {outpath} results/新しい方.json\n")

    crit = sum(1 for x in r["findings"] if x["level"] == "critical")
    return 1 if crit else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n中断しました。")
        sys.exit(130)

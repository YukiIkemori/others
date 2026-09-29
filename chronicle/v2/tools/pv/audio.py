# PV の音（BGM・ボイス・効果音）を台本（edit_*.py の MUSIC・VOICE・SFX）どおりに混ぜて 1 本の WAV にする。
#   python3 v2/tools/pv/audio.py <edit.py> <出力.wav> --bgm <dist/bgm> --voice <dist/voice> --sfx <効果音の WAV のディレクトリ> [--clips <clips>]
#   - BGM は区間ごとに（src 秒から dur 秒、入りと抜けのフェード、gain dB）
#   - ボイスが鳴る間は BGM を下げる（サイドチェインのコンプ）
#   - GAMESFX: カットの音の記録（clips/<id>.audio.json）のうち効果音を、そのカットの置き場所に写して鳴らす
#   - 最後に -14 LUFS（2 回測る loudnorm）と頭打ち（-1 dBTP）
import json
import os
import re
import runpy
import subprocess
import sys

FF = os.environ.get('FFMPEG', '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2')


def arg(a, k, d=None):
    return a[a.index(k) + 1] if k in a else d


def game_sfx(E, clips, sfxdir):
    """カットの中で鳴った効果音 → [(台本の秒, 効果音のファイル, gain)]"""
    out = []
    for s in E['V']:
        g = s.get('gamesfx')
        if g is None or s.get('freeze'):
            continue
        p = os.path.join(clips, s['clip'] + '.audio.json')
        if not os.path.exists(p):
            continue
        sp = s.get('speed', 1.0)
        for e in json.load(open(p)):
            if e['fn'] not in ('sfx', 'uisfx') or not e['id']:
                continue
            f = os.path.join(sfxdir, e['id'] + '.wav')
            if not os.path.exists(f):
                continue
            tc = (e['f'] / 60.0 - s.get('src', 0)) / sp
            if 0 <= tc < s['dur'] - 0.05:
                out.append(dict(file=f, at=s['at'] + tc, gain=g))
    return out


def main():
    a = sys.argv[1:]
    edit, out = a[0], a[1]
    bgm, voice, sfx, clips = arg(a, '--bgm'), arg(a, '--voice'), arg(a, '--sfx'), arg(a, '--clips')
    E = runpy.run_path(edit)
    T = E['DURATION']
    inputs, filt = [], []
    music_lbls, voice_lbls, sfx_lbls = [], [], []

    def add_input(path, ss=None, t=None):
        o = []
        if ss is not None:
            o += ['-ss', '%.3f' % ss]
        if t is not None:
            o += ['-t', '%.3f' % t]
        inputs.extend(o + ['-i', path])
        return len(inputs_list) - 1
    inputs_list = []

    def inp(path, ss=None, t=None):
        inputs_list.append((path, ss, t))
        return len(inputs_list) - 1

    for i, m in enumerate(E.get('MUSIC', [])):
        k = inp(os.path.join(bgm, m['file'] + '.ogg'), m.get('src', 0), m['dur'] + 0.1)
        fi, fo = m.get('fin', 0.0), m.get('fout', 0.0)
        chain = 'aresample=48000,aformat=channel_layouts=stereo,volume=%.2fdB' % m.get('gain', 0)
        if fi:
            chain += ',afade=t=in:st=0:d=%.3f' % fi
        if fo:
            chain += ',afade=t=out:st=%.3f:d=%.3f' % (max(0, m['dur'] - fo), fo)
        chain += ',adelay=%d|%d' % (m['at'] * 1000, m['at'] * 1000)
        filt.append('[%d:a]%s[m%d]' % (k, chain, i))
        music_lbls.append('[m%d]' % i)
    for i, v in enumerate(E.get('VOICE', [])):
        k = inp(os.path.join(voice, v['file'] + '.ogg'), v.get('src'), v.get('dur'))
        chain = 'aresample=48000,aformat=channel_layouts=stereo,volume=%.2fdB' % v.get('gain', 0)
        if v.get('fout'):
            chain += ',afade=t=out:st=%.3f:d=%.3f' % (v['dur'] - v['fout'], v['fout'])
        chain += ',adelay=%d|%d' % (v['at'] * 1000, v['at'] * 1000)
        filt.append('[%d:a]%s[v%d]' % (k, chain, i))
        voice_lbls.append('[v%d]' % i)
    sfx_list = [dict(file=os.path.join(sfx, s['id'] + '.wav'), at=s['at'], gain=s.get('gain', 0)) for s in E.get('SFX', [])]
    if clips:
        sfx_list += game_sfx(E, clips, sfx)
    for i, s in enumerate(sfx_list):
        k = inp(s['file'])
        filt.append('[%d:a]aresample=48000,aformat=channel_layouts=stereo,volume=%.2fdB,adelay=%d|%d[s%d]' % (k, s['gain'], s['at'] * 1000, s['at'] * 1000, i))
        sfx_lbls.append('[s%d]' % i)
    # 無音の土台（長さを決める）
    k = inp('anullsrc=r=48000:cl=stereo', None, T)
    inputs_list[k] = ('anullsrc', None, T)
    filt.append('[%d:a]atrim=0:%.3f[base]' % (k, T))

    def mix(lbls, name, extra=''):
        if not lbls:
            filt.append('[base]asplit=1[%s]' % name) if False else None
            return None
        filt.append('%samix=inputs=%d:normalize=0:dropout_transition=0%s[%s]' % (''.join(lbls), len(lbls), extra, name))
        return name
    mb = mix(music_lbls, 'music')
    vb = mix(voice_lbls, 'voice')
    sb = mix(sfx_lbls, 'sfx')
    parts = []
    if mb and vb:
        filt.append('[voice]asplit=2[vk][vo]')
        # ボイスの間は BGM を下げる（-9 dB ほど）
        filt.append('[music][vk]sidechaincompress=threshold=0.02:ratio=6:attack=40:release=450:makeup=1[mduck]')
        parts += ['[mduck]', '[vo]']
    else:
        parts += ['[%s]' % x for x in (mb, vb) if x]
    if sb:
        parts.append('[sfx]')
    filt.append('[base]%samix=inputs=%d:normalize=0:dropout_transition=0,atrim=0:%.3f[mix]' % (''.join(parts), len(parts) + 1, T))
    args = [FF, '-v', 'error', '-y']
    for path, ss, t in inputs_list:
        if path == 'anullsrc':
            args += ['-f', 'lavfi', '-t', '%.3f' % t, '-i', 'anullsrc=r=48000:cl=stereo']
            continue
        if ss is not None:
            args += ['-ss', '%.3f' % ss]
        if t is not None:
            args += ['-t', '%.3f' % t]
        args += ['-i', path]
    raw = out.replace('.wav', '.raw.wav')
    fc = ';'.join(filt)
    with open(out + '.filter.txt', 'w') as f:
        f.write(fc)
    subprocess.run(args + ['-filter_complex_script', out + '.filter.txt', '-map', '[mix]', '-c:a', 'pcm_s24le', raw], check=True)
    # 大きさをそろえる（2 回測る）
    r = subprocess.run([FF, '-hide_banner', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
    js = json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', r.stderr).group(0))
    ln = 'loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=%s:measured_TP=%s:measured_LRA=%s:measured_thresh=%s:offset=%s:linear=true' % (
        js['input_i'], js['input_tp'], js['input_lra'], js['input_thresh'], js['target_offset'])
    subprocess.run([FF, '-v', 'error', '-y', '-i', raw, '-af', ln + ',alimiter=limit=0.89:level=false,aresample=48000', '-c:a', 'pcm_s16le', out], check=True)
    os.remove(raw)
    print('[audio] measured in: I=%s LUFS TP=%s → %s' % (js['input_i'], js['input_tp'], out))


if __name__ == '__main__':
    main()

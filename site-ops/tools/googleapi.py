"""Minimal Google API client for Search Console / GA4 (stdlib + openssl only).

Credentials come from the environment, never from files:
  GOOGLE_SA_JSON   service-account JSON on one line (or GOOGLE_SA_JSON_B64)
  GA4_PROPERTY_IDS name=id pairs, comma separated
"""
import base64, json, os, subprocess, tempfile, time, urllib.error, urllib.parse, urllib.request

SITES = {  # name -> Search Console property
    "mononippon": "sc-domain:mononippon.com",
    "sukinobi": "sc-domain:sukinobi.jp",
    "monometri": "sc-domain:monometri.com",
    "asiavela": "sc-domain:asiavela.com",
}


def _sa():
    raw = os.environ.get("GOOGLE_SA_JSON")
    if not raw and os.environ.get("GOOGLE_SA_JSON_B64"):
        raw = base64.b64decode(os.environ["GOOGLE_SA_JSON_B64"]).decode()
    if not raw:
        raise SystemExit("GOOGLE_SA_JSON is not set")
    return json.loads(raw)


def _b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=")


def token(scope):
    sa = _sa()
    now = int(time.time())
    head = _b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claim = _b64(json.dumps({"iss": sa["client_email"], "scope": scope, "aud": sa["token_uri"],
                             "iat": now, "exp": now + 3600}).encode())
    msg = head + b"." + claim
    with tempfile.NamedTemporaryFile("w", delete=False) as f:
        f.write(sa["private_key"])
        key = f.name
    try:
        sig = subprocess.run(["openssl", "dgst", "-sha256", "-sign", key], input=msg,
                             capture_output=True, check=True).stdout
    finally:
        os.unlink(key)
    data = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": (msg + b"." + _b64(sig)).decode()}).encode()
    return json.load(urllib.request.urlopen(urllib.request.Request(sa["token_uri"], data)))["access_token"]


def call(url, tok, body=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read().decode()[:300]}


def gsc_query(site, start, end, dimensions, row_limit=1000, tok=None):
    tok = tok or token("https://www.googleapis.com/auth/webmasters.readonly")
    url = ("https://searchconsole.googleapis.com/webmasters/v3/sites/"
           + urllib.parse.quote(SITES[site], safe="") + "/searchAnalytics/query")
    r = call(url, tok, {"startDate": start, "endDate": end, "dimensions": dimensions, "rowLimit": row_limit})
    return r.get("rows", []) if "error" not in r else r


def ga4_report(site, body, tok=None):
    tok = tok or token("https://www.googleapis.com/auth/analytics.readonly")
    ids = dict(p.split("=", 1) for p in os.environ.get("GA4_PROPERTY_IDS", "").split(",") if "=" in p)
    return call(f"https://analyticsdata.googleapis.com/v1beta/properties/{ids[site]}:runReport", tok, body)

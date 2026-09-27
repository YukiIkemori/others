"""Wait for API credits, then run the remaining jobs in priority order (skips outputs that exist).
   python3 resume.py <jobs.json>...   (probe = one tiny text-only Responses call every PROBE_MIN minutes)"""
import json, os, sys, time, urllib.request, urllib.error
sys.path.insert(0, os.path.dirname(__file__))
import gen_env
PROBE_MIN = float(os.environ.get('PROBE_MIN') or 10)

def probe():
    key = os.environ.get('OPENAI_API_KEY', '').strip()
    body = json.dumps({'model': gen_env.model(), 'input': 'ok', 'max_output_tokens': 16}).encode()
    req = urllib.request.Request(gen_env.URL, data=body, method='POST', headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            r.read(); return True, 'ok'
    except urllib.error.HTTPError as e:
        return False, 'HTTP %d %s' % (e.code, e.read().decode('utf-8', 'replace')[:120].replace('\n', ' '))
    except Exception as e:
        return False, str(e)[:120]

jobs = []
for p in sys.argv[1:]:
    j = json.load(open(p)); jobs += j if isinstance(j, list) else [j]
todo = [j for j in jobs if not os.path.exists(j['out'])]
print(time.strftime('%H:%M:%S'), 'remaining', len(todo), flush=True)
while todo:
    ok, msg = probe()
    print(time.strftime('%H:%M:%S'), 'probe', ok, msg, flush=True)
    if not ok:
        time.sleep(PROBE_MIN * 60); continue
    import concurrent.futures as cf
    batch = todo[:3]
    with cf.ThreadPoolExecutor(3) as ex:
        res = list(ex.map(gen_env.run, batch))
    print(time.strftime('%H:%M:%S'), 'batch', res, flush=True)
    todo = [j for j in todo if not os.path.exists(j['out'])]
    if not any(res):
        time.sleep(PROBE_MIN * 60)
print('done; env images used', gen_env.used(), flush=True)

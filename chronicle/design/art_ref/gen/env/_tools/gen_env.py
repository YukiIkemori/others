"""Environment art generation over the OpenAI Responses API (stdlib only).

Account settings come from the environment only (source the owner's env file in the shell first):
  OPENAI_API_KEY, OPENAI_MODEL  -- never written anywhere by this tool
Spend log: /tmp/claude-0/secrets/openai_usage.jsonl (outside the repo), one line per call, kind 'env'.
Cap: ENV_IMAGE_CAP (default 250) images of kind 'env'.

usage: python3 gen_env.py <job.json> [<job.json> ...]
job = {"out": "path.png", "prompt": "...", "size": "1024x1024", "quality": "high", "background": "opaque",
       "refs": ["img.png", ...], "tag": "..."}
"""
import base64, json, os, sys, time, random, urllib.request, urllib.error

URL = 'https://api.openai.com/v1/responses'
LOG = '/tmp/claude-0/secrets/openai_usage.jsonl'
CAP = int(os.environ.get('ENV_IMAGE_CAP') or 250)


def model():
    m = os.environ.get('OPENAI_MODEL', '').strip()
    if not m:
        sys.exit('OPENAI_MODEL not set')
    if 'astra' in m.lower():
        sys.exit('forbidden model family')
    return m


def used():
    n = 0
    if os.path.exists(LOG):
        for l in open(LOG):
            try:
                d = json.loads(l)
            except Exception:
                continue
            if d.get('kind') == 'env':
                n += int(d.get('images') or 0)
    return n


def log(e):
    e['kind'] = 'env'
    with open(LOG, 'a') as f:
        f.write(json.dumps(e, ensure_ascii=False) + '\n')


def run(job):
    if os.path.exists(job['out']) and not job.get('force'):
        print('skip (exists)', job['out']); return True
    if used() + 1 > CAP:
        print('CAP REACHED', used(), CAP); return False
    key = os.environ.get('OPENAI_API_KEY', '').strip()
    tool = {'type': 'image_generation', 'size': job.get('size', '1024x1024'), 'quality': job.get('quality', 'high')}
    if job.get('background'):
        tool['background'] = job['background']
    content = [{'type': 'input_text', 'text': job['prompt']}]
    for r in job.get('refs', []):
        content.append({'type': 'input_image', 'image_url': 'data:image/png;base64,' + base64.b64encode(open(r, 'rb').read()).decode()})
    body = {'model': model(), 'input': [{'role': 'user', 'content': content}], 'tools': [tool], 'tool_choice': {'type': 'image_generation'}}
    data = json.dumps(body).encode()
    for attempt in range(8):
        t0 = time.time()
        req = urllib.request.Request(URL, data=data, method='POST', headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=900) as r:
                js = json.loads(r.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:500]
            log(dict(t=time.strftime('%Y-%m-%dT%H:%M:%S'), tag=job.get('tag'), images=0, error='HTTP %d: %s' % (e.code, msg), settings=tool))
            if e.code == 429 or e.code >= 500:
                w = min(300, 15 * 2 ** attempt) * (0.7 + 0.6 * random.random())
                print('HTTP', e.code, 'backoff', int(w), job['out']); time.sleep(w); continue
            print('FAIL', e.code, msg[:300], job['out']); return False
        except Exception as e:
            print('net err', type(e).__name__, str(e)[:200]); time.sleep(20 * (attempt + 1)); continue
        outs = [o for o in js.get('output', []) if o.get('type') == 'image_generation_call' and o.get('result')]
        log(dict(t=time.strftime('%Y-%m-%dT%H:%M:%S'), tag=job.get('tag'), model=body['model'], images=len(outs), secs=round(time.time() - t0, 1),
                 settings=tool, n_refs=len(job.get('refs', [])), usage=js.get('usage'), out=job['out']))
        if not outs:
            print('no image', job['out'], json.dumps([o.get('type') for o in js.get('output', [])])[:200]); time.sleep(5); continue
        os.makedirs(os.path.dirname(job['out']), exist_ok=True)
        open(job['out'], 'wb').write(base64.b64decode(outs[0]['result']))
        meta = dict(job); meta.pop('refs', None); meta['refs'] = job.get('refs', []); meta['revised_prompt'] = outs[0].get('revised_prompt'); meta['model'] = body['model']
        json.dump(meta, open(job['out'][:-4] + '.gen.json', 'w'), ensure_ascii=False, indent=1)
        print('ok', job['out'], round(time.time() - t0, 1), 's')
        return True
    return False


if __name__ == '__main__':
    import concurrent.futures as cf
    jobs = []
    for p in sys.argv[1:]:
        j = json.load(open(p))
        jobs += j if isinstance(j, list) else [j]
    par = int(os.environ.get('GEN_PAR') or 3)
    with cf.ThreadPoolExecutor(par) as ex:
        list(ex.map(run, jobs))
    print('env images used:', used())

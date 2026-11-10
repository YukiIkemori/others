"""Minimal OpenAI Images API helper (generations + edits). Key from env only. Usage log outside the repo."""
import base64, json, os, sys, time, urllib.request, urllib.error, uuid
LOG = '/home/user/tw/log/usage.jsonl'

def _post(url, data, headers, timeout=900):
    req = urllib.request.Request(url, data=data, method='POST', headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError('HTTP %d: %s' % (e.code, e.read().decode('utf-8', 'replace')[:600]))

def gen(prompt, out, size='1536x1024', quality='medium', model='gpt-image-2', images=(), background=None, tag=''):
    key = os.environ['OPENAI_API_KEY']
    t0 = time.time()
    if not images:
        body = dict(model=model, prompt=prompt, size=size, quality=quality, n=1)
        if background: body['background'] = background
        js = _post('https://api.openai.com/v1/images/generations', json.dumps(body).encode(),
                   {'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    else:
        b = uuid.uuid4().hex
        parts = []
        def field(k, v):
            parts.append(('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n' % (b, k, v)).encode())
        field('model', model); field('prompt', prompt); field('size', size); field('quality', quality); field('n', '1')
        if background: field('background', background)
        for p in images:
            parts.append(('--%s\r\nContent-Disposition: form-data; name="image[]"; filename="%s"\r\nContent-Type: image/png\r\n\r\n' % (b, os.path.basename(p))).encode() + open(p, 'rb').read() + b'\r\n')
        parts.append(('--%s--\r\n' % b).encode())
        js = _post('https://api.openai.com/v1/images/edits', b''.join(parts),
                   {'Authorization': 'Bearer ' + key, 'Content-Type': 'multipart/form-data; boundary=' + b})
    png = base64.b64decode(js['data'][0]['b64_json'])
    open(out, 'wb').write(png)
    open(os.path.splitext(out)[0] + '_prompt.txt', 'w').write(prompt)
    e = dict(t=time.strftime('%Y-%m-%dT%H:%M:%S'), tag=tag, model=model, size=size, quality=quality, images=1,
             secs=round(time.time() - t0), usage=js.get('usage'), out=out)
    open(LOG, 'a').write(json.dumps(e) + '\n')
    print(json.dumps(e))
    return out

if __name__ == '__main__':
    import argparse
    a = argparse.ArgumentParser()
    a.add_argument('prompt_file'); a.add_argument('out'); a.add_argument('--size', default='1536x1024')
    a.add_argument('--quality', default='medium'); a.add_argument('--model', default='gpt-image-2')
    a.add_argument('--image', action='append', default=[]); a.add_argument('--background'); a.add_argument('--tag', default='')
    x = a.parse_args()
    gen(open(x.prompt_file).read(), x.out, x.size, x.quality, x.model, x.image, x.background, x.tag)

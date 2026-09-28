"""Image generation over the OpenAI Responses API (stdlib only), used by tools/gen_sheets.py.

Everything account-specific comes from the environment, never from repo files:
  OPENAI_API_KEY     the key (source the owner's env file in the shell; never write it anywhere)
  OPENAI_MODEL       the Responses model that hosts the image_generation tool
  OPENAI_USAGE_LOG   jsonl file that gets one line per call (usage, image count, settings) — keep it outside the repo
  GEN_IMAGE_CAP      hard cap on images for the whole task (counted from the log); calls stop at the cap

The key never goes on a command line, into a log line, an exception message or an output file.
"""
import base64
import io
import json
import os
import time
import urllib.error
import urllib.request

from pngclean import strip_png   # the provenance chunks (caBX / tEXt) carry the tool's name: never keep them

URL = 'https://api.openai.com/v1/responses'
BANNED_MODEL_PARTS = ('astra',)
OWN_TAGS = ('probe', 'arun', 'companion', 'npc')   # tags written by gen_sheets.py (the cap counts these)         # the owner's rule: the heavy model family is never used


class GenError(RuntimeError):
    pass


def _env(name, required=True):
    v = os.environ.get(name, '').strip()
    if required and not v:
        raise GenError('%s is not set (source the env file in the shell first)' % name)
    return v


def model_name():
    m = _env('OPENAI_MODEL')
    if any(b in m.lower() for b in BANNED_MODEL_PARTS):
        raise GenError('OPENAI_MODEL names a model this project must not use')
    return m


def usage_log_path():
    p = _env('OPENAI_USAGE_LOG', required=False)
    if not p:
        raise GenError('OPENAI_USAGE_LOG is not set (the spend log must live outside the repo)')
    return p


def images_used():
    p = usage_log_path()
    if not os.path.exists(p):
        return 0
    n = 0
    for line in open(p):
        try:
            e = json.loads(line)
            if not str(e.get('tag', '')).startswith(OWN_TAGS):   # the log is shared with other tools: count ours
                continue
            n += int(e.get('images', 0))
        except Exception:
            pass
    return n


def image_cap():
    try:
        return int(_env('GEN_IMAGE_CAP', required=False) or 150)
    except ValueError:
        return 150


def png_data_url(png_bytes):
    return 'data:image/png;base64,' + base64.b64encode(png_bytes).decode('ascii')


def pil_data_url(img):
    b = io.BytesIO()
    img.save(b, 'PNG', optimize=True)
    return png_data_url(b.getvalue())


def _log(entry):
    with open(usage_log_path(), 'a') as f:
        f.write(json.dumps(entry, ensure_ascii=False) + '\n')


def generate(prompt, images=(), size='1536x1024', quality='medium', background='opaque', input_fidelity=None,
             tag='', timeout=600, retries=2, extra_tool=None):
    """One image. images: list of PNG bytes or PIL images (attached as input_image data URLs, in order).
    -> (png bytes, info dict). Logs usage to OPENAI_USAGE_LOG. Raises GenError at the image cap."""
    used, cap = images_used(), image_cap()
    if used + 1 > cap:
        raise GenError('image cap reached (%d / %d); stop and report' % (used, cap))
    key = _env('OPENAI_API_KEY')
    tool = {'type': 'image_generation', 'size': size, 'quality': quality}
    if background:
        tool['background'] = background
    if input_fidelity:
        tool['input_fidelity'] = input_fidelity
    if extra_tool:
        tool.update(extra_tool)
    content = [{'type': 'input_text', 'text': prompt}]
    for im in images:
        url = png_data_url(im) if isinstance(im, (bytes, bytearray)) else pil_data_url(im)
        content.append({'type': 'input_image', 'image_url': url})
    body = {'model': model_name(), 'input': [{'role': 'user', 'content': content}], 'tools': [tool],
            'tool_choice': {'type': 'image_generation'}}
    data = json.dumps(body).encode()
    last = None
    rate_waits = 0
    attempt = 0
    while attempt <= retries:
        attempt += 1
        t0 = time.time()
        req = urllib.request.Request(URL, data=data, method='POST',
                                     headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                js = json.loads(r.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:800]
            last = 'HTTP %d: %s' % (e.code, msg)
            _log(dict(t=time.strftime('%Y-%m-%dT%H:%M:%S'), tag=tag, images=0, error=last, settings=tool))
            if e.code in (400, 401, 403, 404) or 'insufficient_quota' in msg or 'credit_balance' in msg:
                raise GenError(last)
            if e.code == 429 and rate_waits < 8:      # shared key: back off and try again (not counted as an attempt)
                rate_waits += 1
                ra = e.headers.get('retry-after') if e.headers else None
                try:
                    wait = max(float(ra), 5.0) if ra else 0
                except ValueError:
                    wait = 0
                time.sleep(wait or min(300, 20 * 2 ** (rate_waits - 1)))
                attempt -= 1
                continue
            time.sleep(5 * (attempt + 1))
            continue
        except Exception as e:           # network: retry
            last = '%s: %s' % (type(e).__name__, str(e)[:300])
            time.sleep(5 * (attempt + 1))
            continue
        outs = [o for o in js.get('output', []) if o.get('type') == 'image_generation_call']
        pngs = [strip_png(base64.b64decode(o['result'])) for o in outs if o.get('result')]   # only IHDR/PLTE/IDAT/IEND/tRNS/gAMA/sRGB/iCCP/pHYs
        info = dict(t=time.strftime('%Y-%m-%dT%H:%M:%S'), tag=tag, model=body['model'], images=len(pngs), secs=round(time.time() - t0, 1),
                    settings=tool, n_refs=len(images), usage=js.get('usage'),
                    tool_usage=js.get('tool_usage') or [o.get('usage') for o in outs if o.get('usage')] or None,
                    revised_prompt=[o.get('revised_prompt') for o in outs if o.get('revised_prompt')][:1] or None,
                    call_meta=[{k: o.get(k) for k in ('size', 'quality', 'background', 'output_format') if o.get(k)} for o in outs])
        _log(info)
        if not pngs:
            last = 'no image in the response: ' + json.dumps([o.get('type') for o in js.get('output', [])])
            texts = [c.get('text') for o in js.get('output', []) if o.get('type') == 'message' for c in o.get('content', [])]
            if texts:
                last += ' / ' + ' '.join(t for t in texts if t)[:400]
            continue
        return pngs[0], info
    raise GenError(last or 'generation failed')

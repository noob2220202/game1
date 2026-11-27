"""Episode 3 image generator = tools/gen.py (ep1/ep2) + the asset-stage money rules.

usage (repo root; refs in the job files are repo-relative):
  python tools\\gen_ep3.py tools\\jobs_ep3_pass1.json work\\gen_ep3 [--tier 1] [--ids G01,G03] [--force]
  python tools\\gen_ep3.py work\\gen_ep3\\_regen_todo.json work\\gen_ep3      # re-run every placeholder job after a top-up
  python tools\\gen_ep3.py --cost work\\gen_ep3                               # running cost from _usage.jsonl

Same requests as gen.py (/images/generations, /images/edits with image[] refs as image/png, IMG_MODEL default
gpt-image-2, PAR threads, a job with an existing output is skipped unless 'force'). Added:
  * QUOTA STOP — an HTTP error whose body says insufficient_quota / billing / exceeded your current quota (or a 429
    that mentions quota) writes <out>/_STOP_QUOTA and every job not yet sent is skipped: no retry of anything.
    A plain 429 rate limit (no quota words) waits and retries like gen.py.
  * COST CAP — before each request the running estimate (<out>/_usage.jsonl) plus this job's estimate must stay under
    CAP_USD (env, default 8.0); otherwise the job is skipped ('cap').
  * the key is read from OPENAI_API_KEY and never printed or logged.
Pricing used for the estimate (asset-stage brief): image output tokens $40/1M · image input $10/1M · text input $5/1M.
"""
import json, sys, base64, urllib.request, urllib.error, os, time, threading, concurrent.futures as cf

QUOTA_WORDS = ('insufficient_quota', 'billing', 'exceeded your current quota', 'quota')
FALLBACK_USD = {'high': 0.25, 'medium': 0.07, 'low': 0.02}       # ep2 measured per-image prices (1024x1536)
LOCK = threading.Lock()


def usage_cost(rec):
    u = rec.get('usage') or {}
    if u:
        det = u.get('input_tokens_details') or {}
        img_in = det.get('image_tokens', 0) or 0
        txt_in = det.get('text_tokens', (u.get('input_tokens', 0) or 0) - img_in) or 0
        out = u.get('output_tokens', 0) or 0
        return out * 40e-6 + img_in * 10e-6 + txt_in * 5e-6
    return FALLBACK_USD.get(rec.get('q'), 0.07) + 0.02 * rec.get('n_ref', 0)


def total_cost(out):
    p = os.path.join(out, '_usage.jsonl')
    if not os.path.exists(p): return 0.0, 0
    tot, n = 0.0, 0
    for line in open(p, encoding='utf-8'):
        line = line.strip()
        if not line: continue
        tot += usage_cost(json.loads(line)); n += 1
    return tot, n


def job_estimate(j):
    q = j.get('quality', 'high')
    base = FALLBACK_USD.get(q, 0.07)
    if j.get('size') == '1024x1024': base *= 0.66
    refs = j.get('ref') or []
    refs = refs if isinstance(refs, list) else [refs]
    return base + 0.02 * len(refs)


def is_quota(code, msg):
    m = msg.lower()
    if 'insufficient_quota' in m or 'exceeded your current quota' in m or 'billing' in m: return True
    return code == 429 and 'quota' in m


def main():
    args = sys.argv[1:]
    if args and args[0] == '--cost':
        out = args[1] if len(args) > 1 else 'work/gen_ep3'
        tot, n = total_cost(out)
        print(f'{n} images logged, estimate ${tot:.3f}')
        return
    jobs_path, out = args[0], args[1]
    tier = ids = None; force_all = False
    i = 2
    while i < len(args):
        if args[i] == '--tier': tier = int(args[i + 1]); i += 2
        elif args[i] == '--ids': ids = set(args[i + 1].split(',')); i += 2
        elif args[i] == '--force': force_all = True; i += 1
        else: raise SystemExit('unknown arg ' + args[i])
    jobs = json.load(open(jobs_path, encoding='utf-8'))
    if tier is not None: jobs = [j for j in jobs if j.get('tier') == tier]
    if ids: jobs = [j for j in jobs if j.get('id') in ids or j.get('name') in ids]
    os.makedirs(out, exist_ok=True)
    MODEL = os.environ.get('IMG_MODEL', 'gpt-image-2')
    CAP = float(os.environ.get('CAP_USD', '8.0'))
    STOP = os.path.join(out, '_STOP_QUOTA')
    KEY = os.environ.get('OPENAI_API_KEY', '')
    if not KEY: raise SystemExit('OPENAI_API_KEY not set')

    def log(rec):
        with LOCK:
            open(os.path.join(out, '_usage.jsonl'), 'a', encoding='utf-8').write(json.dumps(rec) + '\n')

    def post(url, data, ctype, j, rec):
        for a in range(3):
            if os.path.exists(STOP): return 'quota-skip'
            try:
                req = urllib.request.Request(url, data=data, headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': ctype})
                d = json.load(urllib.request.urlopen(req, timeout=400))
                open(os.path.join(out, j['name'] + '.png'), 'wb').write(base64.b64decode(d['data'][0]['b64_json']))
                rec['usage'] = d.get('usage'); rec['t'] = time.strftime('%Y-%m-%d %H:%M:%S')
                log(rec)
                return 'ok'
            except urllib.error.HTTPError as e:
                msg = e.read().decode('utf-8', 'replace')[:400]
                print(j['name'], e.code, msg.replace(KEY, '***') if KEY else msg, flush=True)
                if is_quota(e.code, msg):
                    open(STOP, 'w', encoding='utf-8').write(json.dumps({'job': j['name'], 'code': e.code, 'msg': msg[:300],
                                                                        't': time.strftime('%Y-%m-%d %H:%M:%S')}))
                    return 'QUOTA ' + str(e.code)
                if e.code == 400: return 'fail400 ' + msg[:200]
                if e.code in (401, 403): return f'fail{e.code}'
                time.sleep(15)
            except Exception as e:
                print(j['name'], repr(e)[:200], flush=True); time.sleep(10)
        return 'fail'

    def run(j):
        path = os.path.join(out, j['name'] + '.png')
        if os.path.exists(path) and not (j.get('force') or force_all): return j['name'], 'skip'
        if os.path.exists(STOP): return j['name'], 'quota-skip'
        with LOCK:
            spent, _ = total_cost(out)
            est = job_estimate(j)
            if spent + est > CAP: return j['name'], f'cap (spent ${spent:.2f} + ${est:.2f} > ${CAP:.2f})'
        q = j.get('quality', 'high'); size = j.get('size', '1024x1536')
        if not j.get('ref'):
            body = {'model': MODEL, 'prompt': j['prompt'], 'size': size, 'quality': q, 'n': 1}
            rec = {'id': j.get('id'), 'name': j['name'], 'q': q, 'size': size, 'n_ref': 0}
            return j['name'], post('https://api.openai.com/v1/images/generations', json.dumps(body).encode(),
                                   'application/json', j, rec)
        import uuid
        bnd = uuid.uuid4().hex
        parts = []
        def field(k, v): parts.append(f'--{bnd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        field('model', MODEL); field('prompt', j['prompt']); field('size', size); field('quality', q)
        if j.get('fidelity'): field('input_fidelity', j['fidelity'])
        refs = j['ref'] if isinstance(j['ref'], list) else [j['ref']]
        for r in refs:
            data = open(r, 'rb').read()
            parts.append(f'--{bnd}\r\nContent-Disposition: form-data; name="image[]"; filename="{os.path.basename(r)}"\r\n'
                         f'Content-Type: image/png\r\n\r\n'.encode() + data + b'\r\n')
        parts.append(f'--{bnd}--\r\n'.encode())
        rec = {'id': j.get('id'), 'name': j['name'], 'q': q, 'size': size, 'edit': True, 'n_ref': len(refs)}
        return j['name'], post('https://api.openai.com/v1/images/edits', b''.join(parts),
                               f'multipart/form-data; boundary={bnd}', j, rec)

    res = []
    with cf.ThreadPoolExecutor(min(3, int(os.environ.get('PAR', '3')))) as ex:
        for r in ex.map(run, jobs):
            print(*r, flush=True); res.append(r)
    tot, n = total_cost(out)
    print(f'-- running estimate: {n} images, ${tot:.3f} (cap ${CAP:.2f})')
    if os.path.exists(STOP): print('!! QUOTA STOP present:', open(STOP, encoding='utf-8').read()[:300])


if __name__ == '__main__':
    main()

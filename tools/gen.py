import json, sys, base64, urllib.request, os, time, concurrent.futures as cf
# usage: gen.py jobs.json outdir
jobs = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
MODEL = os.environ.get('IMG_MODEL','gpt-image-2')
def run(j):
    path = os.path.join(out, j['name']+'.png')
    if os.path.exists(path) and not j.get('force'): return j['name'], 'skip'
    if j.get('ref'): return edit(j, path)
    body = {'model': MODEL, 'prompt': j['prompt'], 'size': j.get('size','1024x1536'), 'quality': j.get('quality','high'), 'n':1}
    for a in range(3):
        try:
            req = urllib.request.Request('https://api.openai.com/v1/images/generations', data=json.dumps(body).encode(), headers={'Authorization':'Bearer ' + os.environ.get('OPENAI_API_KEY', 'proxy-injected'),'Content-Type':'application/json'})
            d = json.load(urllib.request.urlopen(req, timeout=400))
            open(path,'wb').write(base64.b64decode(d['data'][0]['b64_json']))
            open(os.path.join(out,'_usage.jsonl'),'a').write(json.dumps({'name':j['name'],'q':body['quality'],'size':body['size'],'usage':d.get('usage')})+'\n')
            return j['name'], 'ok'
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:300]; print(j['name'], e.code, msg, flush=True)
            if e.code == 400: return j['name'], 'fail400 '+msg
            time.sleep(10)
        except Exception as e:
            print(j['name'], e, flush=True); time.sleep(10)
    return j['name'], 'fail'
def edit(j, path):
    import uuid
    bnd = uuid.uuid4().hex
    parts = []
    def field(k, v): parts.append(f'--{bnd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    field('model', MODEL); field('prompt', j['prompt']); field('size', j.get('size','1024x1536')); field('quality', j.get('quality','high'))
    if j.get('fidelity'): field('input_fidelity', j['fidelity'])
    refs = j['ref'] if isinstance(j['ref'], list) else [j['ref']]
    for r in refs:
        data = open(r,'rb').read()
        parts.append(f'--{bnd}\r\nContent-Disposition: form-data; name="image[]"; filename="{os.path.basename(r)}"\r\nContent-Type: image/png\r\n\r\n'.encode()+data+b'\r\n')
    parts.append(f'--{bnd}--\r\n'.encode())
    body = b''.join(parts)
    for a in range(3):
        try:
            req = urllib.request.Request('https://api.openai.com/v1/images/edits', data=body, headers={'Authorization':'Bearer ' + os.environ.get('OPENAI_API_KEY', 'proxy-injected'),'Content-Type':f'multipart/form-data; boundary={bnd}'})
            d = json.load(urllib.request.urlopen(req, timeout=400))
            open(path,'wb').write(base64.b64decode(d['data'][0]['b64_json']))
            open(os.path.join(out,'_usage.jsonl'),'a').write(json.dumps({'name':j['name'],'q':j.get('quality','high'),'edit':True,'usage':d.get('usage')})+'\n')
            return j['name'], 'ok'
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:300]; print(j['name'], e.code, msg, flush=True)
            if e.code == 400: return j['name'], 'fail400 '+msg
            time.sleep(10)
        except Exception as e:
            print(j['name'], e, flush=True); time.sleep(10)
    return j['name'], 'fail'
with cf.ThreadPoolExecutor(int(os.environ.get('PAR','6'))) as ex:
    for r in ex.map(run, jobs): print(*r, flush=True)

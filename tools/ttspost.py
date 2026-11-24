import numpy as np, wave, sys, os, io
from scipy import signal
IN, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
def read(p):
    data = open(p,'rb').read()
    # API wav may have bogus sizes (streamed); parse manually
    i = data.find(b'fmt '); ch = int.from_bytes(data[i+10:i+12],'little'); sr = int.from_bytes(data[i+12:i+16],'little'); bits = int.from_bytes(data[i+22:i+24],'little')
    j = data.find(b'data'); pcm = data[j+8:]
    x = np.frombuffer(pcm[:len(pcm)//2*2], dtype='<i2').astype(np.float32) / 32768
    if ch == 2: x = x.reshape(-1,2).mean(1)
    return x, sr
def write(p, x, sr):
    x = np.clip(x, -1, 1); b = (x * 32767).astype('<i2').tobytes()
    with wave.open(p, 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(b)
def trim(x, sr, th=0.01):
    a = np.abs(x); idx = np.where(a > th)[0]
    if not len(idx): return x
    s = max(0, idx[0] - int(0.05*sr)); e = min(len(x), idx[-1] + int(0.25*sr)); return x[s:e]
def filt(x, sr, hp=None, lp=None):
    if hp: b,a = signal.butter(2, hp/(sr/2), 'high'); x = signal.lfilter(b,a,x)
    if lp: b,a = signal.butter(4, lp/(sr/2), 'low'); x = signal.lfilter(b,a,x)
    return x
def norm(x, peak=0.89): m = np.max(np.abs(x)) or 1; return x / m * peak
SR = 22050
for f in sorted(os.listdir(IN)):
    if not f.endswith('.raw.wav'): continue
    name = f[:-8]; x, sr = read(os.path.join(IN, f))
    x = trim(x, sr, 0.008)
    x = signal.resample_poly(x, SR, sr) if sr != SR else x
    if name in ('v_sea_mono', 'v_him_shh', 'v_him_ear'): x = filt(x, SR, 120, 6000)
    elif name == 'v_poweroff': x = filt(x, SR, 300, 3400); x = np.tanh(x * 3) / np.tanh(3)
    elif name == 'v_police': x = filt(x, SR, 150, 2500)  # through steel door
    elif name == 'v_neighbor': x = filt(x, SR, 200, 1800)  # through wall
    else: x = filt(x, SR, 120, 8000)
    if name == 'v_him_ear':  # proximity bass
        b,a = signal.butter(2, 250/(SR/2), 'low'); x = x + 0.6 * signal.lfilter(b,a,x)
    x = norm(x)
    write(os.path.join(OUT, name + '.wav'), x, SR)
    print(name, round(len(x)/SR, 2), 's')

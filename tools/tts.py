import json, urllib.request, sys, os, concurrent.futures as cf
OUT = sys.argv[1]
jobs = [
 ("v_sea_mono","shimmer","이거 들리면… 나 없는 거겠지. 괜찮아. 두 번째는… 이, 구. 이구야. 자는 척하면서 봤어. 그 사람 손가락. …그리고 옷장 안쪽 벽, 두드리면 통통 소리 나. 비어 있어. 콩이가 맨날 거기 대고 짖었어.",
  "A frightened young Korean woman in her twenties whispering very quietly into a phone microphone at night so that someone nearby cannot hear. Trembling, breathy, intimate, slow, with small pauses. Pure whisper, no voiced tone. Speak the digits '이, 구' slowly and clearly."),
 ("v_him_shh","onyx","쉿.","A man in his forties, very close to the microphone, a low breathy whisper. Calm, menacing, barely audible."),
 ("v_him_ear","onyx","하루야… 자?","A man in his forties whispering right into someone's ear in a dark room. Very low, slow, intimate and terrifying, breathy whisper, long pause after the name."),
 ("v_poweroff","coral","전화기가 꺼져 있어 삐 소리 후 음성사서함으로 연결됩니다.","A neutral, polite Korean telecom carrier recorded announcement voice, flat and mechanical."),
 ("v_pa","nova","404호에서 비상 호출이 접수되었습니다. 경비원이 올라갑니다.","A calm, clear Korean apartment building public-address announcement voice, measured and formal."),
 ("v_police","echo","경찰입니다. 문 열어주세요.","A firm, urgent Korean police officer speaking loudly through a closed steel door."),
 ("v_neighbor","ash","뭐야?!","A startled Korean man suddenly woken up at night, shouting in surprise."),
]
def run(j):
    name, voice, text, inst = j
    body = {"model":"gpt-4o-mini-tts","voice":voice,"input":text,"instructions":inst,"response_format":"wav"}
    req = urllib.request.Request("https://api.openai.com/v1/audio/speech", data=json.dumps(body).encode(), headers={"Authorization":"Bearer proxy-injected","Content-Type":"application/json"})
    try:
        b = urllib.request.urlopen(req, timeout=120).read()
        open(os.path.join(OUT, name + ".raw.wav"), "wb").write(b); return name, len(b)
    except urllib.error.HTTPError as e:
        return name, "ERR " + e.read().decode()[:200]
with cf.ThreadPoolExecutor(4) as ex:
    for r in ex.map(run, jobs): print(*r)

"""Reproducible sound design: recorded Kenney foley + original low resonances, and licensed score masters.
Run with a Python environment containing numpy/scipy and ffmpeg on PATH.
Source/attribution: assets/audio/README.md. Never downloads at runtime.
"""
from pathlib import Path
import subprocess, json, math
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'assets/audio/source'; OUT=ROOT/'public/audio'; SR=44100
rng=np.random.default_rng(51445)
used=set(); records=[]
for folder in ['sfx','music']:(OUT/folder).mkdir(parents=True,exist_ok=True)
def read(pack,name,rate=1,cut=7000):
 path=SRC/pack/'Audio'/f'{name}.ogg';used.add(str(path.relative_to(ROOT)))
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ac','1','-ar',str(SR),'-'])
 x=np.frombuffer(raw,dtype='<f4').copy()
 hit=np.flatnonzero(np.abs(x)>.004)
 if len(hit):x=x[max(0,hit[0]-180):min(len(x),hit[-1]+600)]
 if rate!=1:x=np.interp(np.arange(0,len(x),rate),np.arange(len(x)),x)
 x=sosfilt(butter(2,cut,fs=SR,output='sos'),x)
 return x/max(.02,np.max(np.abs(x)))
def tone(freq=66,dur=.65,drop=20,amp=.4):
 t=np.arange(int(SR*dur))/SR
 phase=2*np.pi*(freq*t+drop*.07*(1-np.exp(-t/.07)))
 return amp*(np.sin(phase)+.15*np.sin(phase*2.005))*np.exp(-t/(dur/5))*np.minimum(t/.005,1)
def mix(*parts):
 n=max(int(at*SR)+len(x) for x,at,gain in parts)
 y=np.zeros(n)
 for x,at,gain in parts:
  start=int(at*SR);y[start:start+len(x)]+=x*gain
 return y
def room(x,tail=.22,wet=.1):
 n=int(SR*tail);t=np.arange(n)/SR
 ir=rng.normal(0,1,n)*np.exp(-t/(tail/6))
 ir=sosfilt(butter(2,3200,fs=SR,output='sos'),ir);ir/=max(1,np.sqrt(np.sum(ir**2)))
 return mix((x,0,1),(fftconvolve(x,ir),.018,wet))
def save(name,x,peak=.56):
 x=sosfilt(butter(2,32,btype='highpass',fs=SR,output='sos'),x)
 x=np.tanh(x*.85)
 x=x/max(.001,np.max(np.abs(x)))*peak
 fade=min(441,len(x)//3);x[:90]*=np.linspace(0,1,90);x[-fade:]*=np.linspace(1,0,fade)
 path=OUT/'sfx'/f'{name}.mp3'
 subprocess.run(['ffmpeg','-y','-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-c:a','libmp3lame','-b:a','160k',str(path)],input=x.astype('<f4').tobytes(),check=True)
 records.append({'file':str(path.relative_to(ROOT/'public')),'seconds':round(len(x)/SR,3),'peakDb':round(20*math.log10(peak),1),'bytes':path.stat().st_size})
for i in range(3):
 card=read('casino',f'card-place-{i+1}',.91,6500)
 wood=read('impact',f'impactWood_medium_00{i}',.78,1400)
 save(f'card-{i+1}',room(mix((card,0,.9),(wood,.026,.16),(tone(94,.22,12,.11),.018,1))),.48)
 chip=read('casino',f'chip-lay-{i+1}',.84,4600)
 save(f'influence-{i+1}',room(mix((chip,0,.6),(wood,.008,.4),(tone(112,.24,18,.16),0,1))),.5)
 die=read('impact',f'impactWood_light_00{i}',.94,5400)
 save(f'dice-{i+1}',room(die,.15,.07),.45)
slide=read('casino','card-slide-2',.84,5900)
fan=read('casino','card-fan-1',.88,6200)
metal=read('impact','impactMetal_heavy_000',.58,2600)
plate=read('impact','impactPlate_heavy_001',.72,3300)
bell=read('impact','impactBell_heavy_000',.65,2800)
heavy=read('impact','impactWood_heavy_001',.7,2400)
soft=read('impact','impactSoft_medium_000',.8,1800)
save('reveal',room(mix((fan,0,.7),(slide,.08,.4)),.3,.14),.44)
save('return',room(slide,.15,.08),.32)
save('remove',room(mix((read('casino','chips-handle-2',.85,4000),0,.5),(soft,0,.4))),.4)
save('control',room(mix((plate,0,.36),(bell,.03,.24),(tone(88,1.4,5,.3),0,1)),.9,.2),.55)
save('coup',room(mix((heavy,0,.8),(metal,.02,.24),(tone(49,1.4,45,.55),0,1)),.65,.16),.76)
save('coup-fail',room(mix((soft,0,.8),(metal,.03,.1),(tone(54,.8,20,.3),0,1)),.5,.14),.5)
save('realign',room(mix((read('casino','chips-collide-2',.82,4200),0,.65),(soft,.015,.25))),.4)
save('vp',room(mix((bell,0,.25),(tone(196,.9,0,.1),0,1)),.65,.18),.38)
save('turn',room(mix((read('casino','card-shove-1',.8,3500),0,.35),(plate,.03,.12))),.32)
save('passive',room(mix((plate,0,.2),(bell,.025,.16)),.55,.2),.36)
save('crisis',room(mix((tone(55,1.15,9,.35),0,1),(tone(55,.95,6,.28),.45,1),(metal,0,.18)),.65,.16),.62)
# Original, slowly opening resonance for launch; no oscillator is created in the browser.
t=np.arange(int(SR*2.8))/SR
wind=sosfilt(butter(3,1800,fs=SR,output='sos'),rng.normal(0,1,len(t)))
wind*=np.sin(np.pi*np.clip(t/2.8,0,1))**2*.1
save('space',room(mix((wind,0,1),(bell,.55,.18),(tone(110,2.3,0,.16),.2,1)),1.1,.24),.48)
for name,notes in [('victory',[130.81,196,261.63,329.63]),('defeat',[65.41,98,138.59]),('draw',[98,146.83,220])]:
 parts=[(bell,0,.1)]
 for i,f in enumerate(notes):parts.append((tone(f,3.6,0,.12),i*.07,1))
 save(name,room(mix(*parts),1.1,.25),.5)
# Full-length music remains streamed. Subtle compression leaves orchestral dynamics intact.
for side,name in [('us','us-signal-to-noise'),('ussr','ussr-katabasis')]:
 path=OUT/'music'/f'{name}.m4a'
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(SRC/f'{side}.mp3'),'-vn','-af','highpass=f=28,loudnorm=I=-20:TP=-2:LRA=11','-ar','44100','-c:a','aac','-b:a','160k','-movflags','+faststart',str(path)],check=True)
 info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(path)]))
 records.append({'file':str(path.relative_to(ROOT/'public')),'seconds':round(float(info['format']['duration']),2),'bytes':path.stat().st_size})
(OUT/'manifest.json').write_text(json.dumps({'version':1,'assets':records},indent=2)+'\n')
(ROOT/'assets/audio/used-sources.json').write_text(json.dumps(sorted(used),indent=2)+'\n')
print(json.dumps({'assets':len(records),'megabytes':round(sum(r['bytes'] for r in records)/1e6,2),'sfxSeconds':round(sum(r['seconds'] for r in records if '/sfx/' in '/'+r['file']),2)}))

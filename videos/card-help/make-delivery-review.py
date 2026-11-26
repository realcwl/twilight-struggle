"""Review sheets from final delivered MP4/WebP files; update showcase and verification."""
import json,subprocess,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent;OUT=(R/'../../public/cards/help').resolve()
m=json.loads((OUT/'manifest.json').read_text());rows=m['videos']
assert m['version']==2 and len(rows)==22
for group in range(3):
 subset=rows[group*9:(group+1)*9]
 sheet=Image.new('RGB',(1260,780),'#071523');draw=ImageDraw.Draw(sheet)
 for i,row in enumerate(subset):
  x=i%3*420;y=i//3*260
  im=Image.open(OUT/Path(row['poster']).name).convert('RGB').resize((420,236),Image.Resampling.LANCZOS)
  sheet.paste(im,(x,y+24));draw.text((x+12,y+6),row['id']+' | 6s',fill='#fff0d0')
 sheet.save(R/f'proofs/delivery-contact-{group+1}.jpg',quality=95)
show=Image.new('RGB',(1280,1224),'#071523');d=ImageDraw.Draw(show)
for i,row in enumerate(rows):
 x=i%4*320;y=i//4*204
 im=Image.open(OUT/Path(row['poster']).name).convert('RGB').resize((320,180),Image.Resampling.LANCZOS)
 show.paste(im,(x,y+24));d.text((x+10,y+5),row['id'],fill='#fff0d0')
show.save(OUT/'showcase.jpg',quality=92)
m['showcase']='/cards/help/showcase.jpg';m['showcaseBytes']=(OUT/'showcase.jpg').stat().st_size
(OUT/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
# Decode delivered clips again for the key before/change/after evidence.
keyids=['control','coup','realignment','headline','action-round','turn']
strip=Image.new('RGB',(1260,6*260),'#071523');d=ImageDraw.Draw(strip)
for j,id in enumerate(keyids):
 for i,t in enumerate([.6,3.1,5.65]):
  name=R/f'proofs/delivered-{id}-{t}.png'
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(t),'-i',str(OUT/f'{id}.mp4'),'-frames:v','1',str(name)],check=True)
  im=Image.open(name).convert('RGB').resize((420,236),Image.Resampling.LANCZOS)
  strip.paste(im,(i*420,j*260+24));d.text((i*420+12,j*260+6),f'{id} | {t}s',fill='#fff0d0')
strip.save(R/'proofs/delivery-mechanisms.jpg',quality=95)
glossary=json.loads((R/'../../src/cards/glossary.json').read_text())
assert {x['id'] for x in rows}=={x['video'] for x in glossary}
assert len(list(OUT.glob('*.mp4')))==len(rows)==len(list(OUT.glob('*.webp')))
report={'version':2,'coverage':{'glossaryEntries':len(glossary),'uniqueVideos':22},'format':'6.000s; 960x540; 24fps; 144 frames; H.264/yuv420p; silent; faststart','videoBytes':m['totalVideoBytes'],'posterBytes':m['totalPosterBytes'],'showcaseBytes':m['showcaseBytes'],'manifestBytes':(OUT/'manifest.json').stat().st_size,'deliveryBytes':sum(p.stat().st_size for p in OUT.iterdir() if p.is_file()),'largestVideoBytes':max(r['bytes'] for r in rows),'checkPassed':json.loads((R/'real-check.json').read_text())['ok'],'proofs':['proofs/delivery-contact-1.jpg','proofs/delivery-contact-2.jpg','proofs/delivery-contact-3.jpg','proofs/delivery-mechanisms.jpg'],'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.iterdir() if p.is_file()}}
(R/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='files'},ensure_ascii=False,indent=2))

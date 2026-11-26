"""Split the HyperFrames master into verified, compressed hover media."""
import json, subprocess, struct
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

ROOT=Path(__file__).resolve().parent
OUT=(ROOT/'../../public/cards/help').resolve()
OUT.mkdir(parents=True,exist_ok=True)
DELIVERY=OUT
OUT=ROOT/'renders/map-2-staging'
OUT.mkdir(parents=True,exist_ok=True)
PLAN=json.loads((ROOT/'real-shot-plan.json').read_text())

def run(args):
    return subprocess.run(args,check=True,capture_output=True,text=True).stdout

def export(shot):
    id=shot['id'];video=OUT/f'{id}.mp4';poster=OUT/f'{id}.webp'
    args=['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(shot['start']),'-i',str(ROOT/'renders/real-master.mp4'),'-t','6','-map','0:v:0','-an','-r','24','-c:v','libx264','-preset','slow','-crf','23','-pix_fmt','yuv420p','-g','144','-movflags','+faststart',str(video)]
    run(args)
    run(['ffmpeg','-hide_banner','-loglevel','error','-y','-ss',str(shot.get('posterTime',5.65)),'-i',str(video),'-frames:v','1','-c:v','libwebp','-quality','87',str(poster)])
    probe=json.loads(run(['ffprobe','-v','error','-show_format','-show_streams','-count_frames','-of','json',str(video)]))
    streams=probe['streams'];v=streams[0];duration=float(probe['format']['duration'])
    assert len(streams)==1 and v['codec_type']=='video',(id,streams)
    assert (v['codec_name'],v['pix_fmt'],v['width'],v['height'],v['r_frame_rate'],int(v['nb_read_frames']))==('h264','yuv420p',960,540,'24/1',144),(id,v)
    assert abs(duration-6)<.001,(id,duration)
    assert video.stat().st_size<5000000,(id,video.stat().st_size)
    data=video.read_bytes();offset=0;atoms=[]
    while offset+8<=len(data):
        size,kind=struct.unpack('>I4s',data[offset:offset+8]);atoms.append(kind)
        if size==0:break
        assert size>=8
        offset+=size
    assert atoms.index(b'moov')<atoms.index(b'mdat'),(id,'faststart missing')
    (ROOT/f'proofs/real-{id}-ffprobe.json').write_text(json.dumps(probe,indent=2))
    # Compare decoded first and last diagram pixels to prove a non-static clip.
    raw=subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',str(video),'-vf','select=eq(n\\,0)+eq(n\\,136),scale=160:90,format=gray','-vsync','0','-f','rawvideo','-'],capture_output=True,check=True).stdout
    a,b=raw[:14400],raw[14400:28800]
    changed=sum(abs(x-y)>16 for x,y in zip(a,b))
    assert len(a)==len(b)==14400 and changed>20,(id,'static clip',changed)
    row={'id':id,'file':f'/cards/help/{id}.mp4','poster':f'/cards/help/{id}.webp','duration':duration,'bytes':video.stat().st_size,'posterBytes':poster.stat().st_size,'aliases':shot['aliases']}
    print(f"{id}: {row['bytes']} video bytes, {row['posterBytes']} poster bytes; {changed} moving pixels",flush=True)
    return row

with ThreadPoolExecutor(max_workers=3) as pool:rows=list(pool.map(export,PLAN['shots']))
result={'version':2,'width':960,'height':540,'fps':24,'silent':True,'codec':'h264','pixelFormat':'yuv420p','count':len(rows),'totalVideoBytes':sum(x['bytes'] for x in rows),'totalPosterBytes':sum(x['posterBytes'] for x in rows),'videos':rows}
for path in OUT.iterdir():
    if path.suffix in ('.mp4','.webp'):
        path.replace(DELIVERY/path.name)
OUT=DELIVERY
result['showcase']='/cards/help/showcase.jpg'
(OUT/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='videos'},ensure_ascii=False))

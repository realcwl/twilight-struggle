"""Real game assets, production HUD captures, deterministic camera/card choreography."""
import json,sys
from pathlib import Path
from html import escape
R=Path(__file__).resolve().parent
G=json.loads((R/'../../src/cards/glossary.json').read_text())
IDS=list(dict.fromkeys(e['video'] for e in G))
CSS='''@font-face{font-family:CardHelp;src:url('assets/fonts/card-help.woff2') format('woff2');font-weight:200 900;font-display:block}
*{box-sizing:border-box}html,body{margin:0;width:960px;height:540px;overflow:hidden;background:#061526;font-family:CardHelp,serif}#root{position:relative;width:100%;height:100%;overflow:hidden}.clip,.scene{position:absolute;inset:0;width:100%;height:100%;overflow:hidden}.camera{position:absolute;width:960px;height:540px;transform-origin:0 0}.map{position:absolute;inset:0;width:960px;height:540px}.card,.hud-capture,.prop{position:absolute;display:block;object-fit:contain}.card{transform-origin:center center}.caption{position:absolute;left:0;right:0;bottom:0;height:70px;padding:17px 22px;background:rgba(4,12,22,.88);color:#fff2d6;font-size:31px;font-weight:750;text-align:center;white-space:nowrap;z-index:30}.tag{position:absolute;left:28px;top:20px;font-size:24px;color:#fff2d6;text-shadow:0 2px 5px #000;font-weight:750;z-index:20}.cue{position:absolute;color:#fff3cb;font-size:40px;font-weight:800;text-align:center;text-shadow:0 2px 5px #000;z-index:18}.hud-capture{z-index:8}.card{z-index:10}.shade{position:absolute;inset:0;background:rgba(0,7,18,.14);pointer-events:none}
'''
class Scene:
 def __init__(self,id,title):self.id=id;self.title=title;self.parts=[];self.anims=[];self.poster=5.65
 def dom(self,id,html):self.parts.append(html.replace('ID',self.id+'-'+id));return self
 def image(self,id,file,x,y,w,kind='card'):
  return self.dom(id,f'<img id="ID" class="{kind}" src="assets/real/{file}.png" style="left:{x}px;top:{y}px;width:{w}px"/>')
 def cue(self,id,txt,x,y,w=260,size=40):return self.dom(id,f'<div id="ID" class="cue" style="left:{x}px;top:{y}px;width:{w}px;font-size:{size}px">{escape(txt)}</div>')
 def caption(self,id,txt,start=0,end=6):
  self.dom(id,f'<div id="ID" class="caption">{escape(txt)}</div>')
  if start>0:self.enter(id,start,.15)
  if end<6:self.exit(id,end,.12)
  return self
 def tween(self,id,a,b,t=0,d=.5,e='power2.inOut'):
  self.anims.append(f'tl.fromTo("#{self.id}-{id}",{json.dumps(a)},{{...{json.dumps(b)},duration:{d},ease:"{e}"}},{t});');return self
 def to(self,id,b,t=0,d=.5,e='power2.inOut'):
  self.anims.append(f'tl.to("#{self.id}-{id}",{{...{json.dumps(b)},duration:{d},ease:"{e}"}},{t});');return self
 def enter(self,id,t=0,d=.4,x=0,y=0):
  if x==0 and y==0:return self.tween(id,{'opacity':0},{'opacity':1},t,d,'power3.out')
  return self.tween(id,{'opacity':0,'x':x,'y':y},{'opacity':1,'x':0,'y':0},t,d,'power3.out')
 def exit(self,id,t,d=.25,x=0,y=0):return self.to(id,{'opacity':0,'x':x,'y':y},t,d,'power2.in')
 def world(self,file='world',scale=1.05,end=1.12,focus=(480,270)):
  self.dom('camera',f'<div id="ID" class="camera"><img class="map" src="assets/real/{file}.png"/></div>')
  self.tween('camera',{'scale':scale,'x':480-focus[0]*scale,'y':250-focus[1]*scale},{'scale':end,'x':480-focus[0]*end,'y':250-focus[1]*end},.15,5.5,'sine.inOut');return self
 def country(self,before,after=None,point=(495,247),zoom=4.6,change=2.8):
  imgs=f'<img class="map" src="assets/real/{before}.png"/>'
  if after:imgs+=f'<img id="{self.id}-state" class="map" src="assets/real/{after}.png"/>'
  self.dom('camera',f'<div id="ID" class="camera">{imgs}</div>')
  self.tween('camera',{'scale':1.6,'x':480-point[0]*1.6,'y':240-point[1]*1.6},{'scale':zoom,'x':480-point[0]*zoom,'y':235-point[1]*zoom},.2,1.25,'power3.inOut')
  if after:self.enter('state',change,.2)
  return self
 def fan(self):
  for i,card in enumerate(['021','028','006','002']):
   self.image('hand'+str(i),'card-'+card,270+i*90,450+abs(i-1.5)*9,145)
   self.tween('hand'+str(i),{'rotation':(i-1.5)*7},{'rotation':(i-1.5)*7},0,0)
  for i in range(3):self.image('opponent'+str(i),'card-back',373+i*66,-111,115)
  return self

S={}
s=Scene('control','控制 · 法国').country('france-before-clean','france-after-clean')
s.caption('before','4 − 2 = 2，尚未达到稳定度 3',0,2.65)
s.cue('add','+1',385,130,160,58).enter('add',1.8,.35,y=35).exit('add',2.65,.2,y=70)
s.caption('after','5 − 2 = 3，取得法国控制权',2.8)
S[s.id]=s

s=Scene('action-round','行动轮').world('europe',1.03,1.1).fan()
s.image('time1','time-soviet',28,48,330,'hud-capture').exit('time1',3.05,.12)
s.image('time2','time-us',28,48,330,'hud-capture').enter('time2',3.17,.12)
s.image('red','card-008',374,110,212).tween('red',{'x':90,'y':-380,'scale':.5,'rotation':14},{'x':0,'y':0,'scale':1,'rotation':-2},.35,.85)
s.to('red',{'x':-305,'y':190,'scale':.42,'rotation':-9},2.7,.6)
s.image('blue','card-004',374,110,212).tween('blue',{'x':-35,'y':420,'scale':.6,'rotation':-12},{'x':0,'y':0,'scale':1,'rotation':2},3.25,.85)
s.caption('cap1','苏联先出牌，并完整处理',0,3.1).caption('cap2','处理完成，再轮到美国',3.22)
S[s.id]=s

s=Scene('headline','头条阶段').world('world',1.15,1.26)
for side,x,card in [('us',200,'004'),('su',558,'008')]:
 s.image(side+'back','card-back',x,105,202).to(side+'back',{'scaleX':0},1.1,.22)
 s.image(side,'card-'+card,x,105,202).tween(side,{'scaleX':0},{'scaleX':1},1.32,.25,'power2.out')
s.to('us',{'x':163,'y':-20,'scale':1.13},2.05,.6)
s.to('su',{'x':105,'y':50,'scale':.73},2.05,.6)
s.to('us',{'x':-125,'y':180,'scale':.5,'rotation':-8},3.9,.55)
s.to('su',{'x':-185,'y':0,'scale':1.08},4.5,.6)
s.caption('cap1','双方秘密选牌，同时揭示',0,1.85).caption('cap2','先 3 点，再 2 点；同点美国先',2)
S[s.id]=s

centers=json.loads((R/'assets/real/country-centers.json').read_text()) if (R/'assets/real/country-centers.json').exists() else {}
def center(name,default=(1024,494)):
 p=centers.get(name,default);return (p[0]/2,p[1]/2)

# The entire event is shown: the actual Cuba render changes before the other side acts.
s=Scene('action-round','行动轮').country('cuba-before','cuba-after',center('cuba-before'),4.2,2.6).fan()
s.image('time1','time-soviet',624,45,310,'hud-capture').exit('time1',4,.12)
s.image('time2','time-us',624,45,310,'hud-capture').enter('time2',4.12,.12)
s.image('red','card-008',374,110,212).tween('red',{'x':80,'y':-380,'scale':.5,'rotation':12},{'x':0,'y':0,'scale':1,'rotation':-2},.25,.75)
s.to('red',{'x':-300,'y':35,'scale':.64,'rotation':-6},1.4,.7)
s.image('blue','card-004',706,170,165).tween('blue',{'x':-230,'y':420,'rotation':-12},{'x':0,'y':0,'rotation':3},4.2,.85)
s.caption('cap1','卡斯特罗：移除美国影响力',0,2.5).caption('cap2','古巴转为苏联控制，事件完成',2.65,4).caption('cap3','现在轮到美国行动',4.15)
S[s.id]=s

s=Scene('influence','放置影响力').country('iran-before-clean','iran-influence',(512,247),4.6,2.8)
s.image('card','card-004',35,165,155).enter('card',.2,.4,x=-150)
s.cue('cost','−2 行动点',30,120,260,35).enter('cost',1.6).exit('cost',2.7)
s.caption('first','敌方控制国家：放 1 点需 2 行动点',0,2.7).caption('last','蓝方增加 1 点，红方仍有 2 点',2.85)
S[s.id]=s

s=Scene('battleground','战场 / 普通国家').country('france-before-clean',zoom=4.2)
s.dom('ordinary','<div id="ID" class="camera"><img class="map" src="assets/real/austria.png"/></div>')
p=center('austria');s.tween('ordinary',{'scale':4.2,'x':480-p[0]*4.2,'y':235-p[1]*4.2},{'scale':4.2,'x':480-p[0]*4.2,'y':235-p[1]*4.2},0,0).tween('ordinary',{'opacity':0},{'opacity':1},3,.25)
s.caption('one','金色稳定度标记：这是战场国家',0,2.85).caption('two','普通国家也计入区域控制总数',3)
S[s.id]=s

s=Scene('coup','政变 · 伊朗').country('iran-before-clean','iran-realign-clean',(512,247),4.6,2.4)
s.dom('final','<div id="ID" class="camera" style="transform-origin:0 0"><img class="map" src="assets/real/iran-after-clean.png"/></div>')
s.tween('final',{'scale':4.6,'x':480-512*4.6,'y':235-247*4.6},{'scale':4.6,'x':480-512*4.6,'y':235-247*4.6},0,0).tween('final',{'opacity':0},{'opacity':1},3.9,.18)
s.caption('calc','骰 5 + 行动 2 − 2×稳定 2 = 3',0,2.3).caption('remove','先移除苏联 2 点影响力',2.45,3.8).caption('add','余下 1 点，变成美国影响力',3.95)
S[s.id]=s

s=Scene('realignment','调整阵营 · 伊朗').country('iran-before-clean','iran-realign-clean',(512,247),4.6,3)
s.cue('dice','6  对  4',325,110,310,46).enter('dice',1.4).exit('dice',3.7)
s.caption('one','修正后 6 对 4：移除苏联 2 点',0,3.6).caption('two','美国仍是 0：调整阵营不会加点',3.8)
S[s.id]=s

def hud_sequence(id,title,files,captions,width=620,x=170,y=90):
 s=Scene(id,title).world('world',1.1,1.2)
 for i,file in enumerate(files):
  key='hud'+str(i);s.image(key,file,x,y,width,'hud-capture')
  if i:s.enter(key,i*1.8+.2,.22)
  if i<len(files)-1:s.exit(key,(i+1)*1.8+.2,.2)
 for i,cap in enumerate(captions):s.caption('cap'+str(i),cap,0 if i==0 else i*2.7,6 if i==len(captions)-1 else (i+1)*2.7-.15)
 return s

s=hud_sequence('defcon','核战危机等级',['crisis-3','crisis-2','crisis-1'],['战场政变通常使危机等级降低 1','降到 1：当前行动方输掉游戏'],500,230,75);S[s.id]=s
s=hud_sequence('milops','军事行动点',['crisis-3'],['回合末要求 3，实际完成 1','差额 2：对手获得 2 胜利点'],500,230,75)
s.exit('hud0',3.1,.2);s.image('penalty','score-soviet2',175,120,610,'hud-capture').enter('penalty',3.35,.4,y=-30);S[s.id]=s
s=hud_sequence('turn','回合',['time-soviet','time-round2','time-turn2'],['一个回合，包含多次双方行动','回合结束后，进入下一回合'],720,120,160);S[s.id]=s
s=hud_sequence('vp','胜利点',['score-0','score-us2'],['双方共用一条胜利点轨道','美国 +2：标记朝美国方向移动'],760,100,150);S[s.id]=s

s=Scene('operations','行动点').country('france-before-clean','france-after-clean',(495,247),3.6,3.6)
s.image('card','card-004',40,105,235).enter('card',.3,.55,y=170)
s.cue('ops','3 → 2',52,52,210,43).enter('ops',2.6).exit('ops',4.3)
s.caption('one','行动点只能选择一种用途',0,2.5).caption('two','例如选放影响力：花 1 点，加 1 点',2.7)
S[s.id]=s

s=Scene('scoring','欧洲计分').world('region-domination',1.02,1.1,(480,270))
s.image('card','card-002',53,85,240).enter('card',.3,.6,y=320).to('card',{'x':-15,'y':130,'scale':.6},2.6,.55)
s.image('score','score-us5',308,105,610,'hud-capture').enter('score',3.05,.5,x=100)
s.caption('one','基础分 + 战场等加分，分别计算',0,2.8).caption('two','此例：美国 9 − 苏联 4，净得 5 分',3)
S[s.id]=s

s=Scene('hand','手牌 · 非计分牌').world('world',1.05,1.1)
for i,card in enumerate(['004','008','002']):
 s.image('card'+str(i),'card-'+card,185+i*180,215,230).tween('card'+str(i),{'rotation':(i-1)*13},{'rotation':(i-1)*13},0,0)
s.to('card0',{'y':-120,'rotation':0,'scale':1.12},1.1,.7)
s.to('card2',{'opacity':.35,'y':65},2.5,.45)
s.caption('one','自己的手牌，通常对对手隐藏',0,2.5).caption('two','选「非计分牌」时，排除计分牌',2.7)
S[s.id]=s

s=Scene('region-status','存在 → 支配').world('region-presence',1.02,1.12,(480,270))
s.dom('dom','<div id="ID" class="camera"><img class="map" src="assets/real/region-domination.png"/></div>')
s.tween('dom',{'scale':1.02,'x':480-480*1.02,'y':250-270*1.02},{'scale':1.12,'x':480-480*1.12,'y':250-270*1.12},.15,5.5,'sine.inOut').tween('dom',{'opacity':0},{'opacity':1},2.4,.25)
s.caption('one','存在：至少控制区域内 1 国',0,2.3).caption('two','支配：总数与战场都领先，且有普通国',2.5)
s.cue('counts','国家 3 > 2　战场 2 > 1',170,365,620,34).enter('counts',3.2)
S[s.id]=s

s=Scene('region-control','区域控制').world('region-domination',1.02,1.12,(480,270))
s.dom('all','<div id="ID" class="camera"><img class="map" src="assets/real/region-control.png"/></div>')
s.tween('all',{'scale':1.02,'x':480-480*1.02,'y':250-270*1.02},{'scale':1.12,'x':480-480*1.12,'y':250-270*1.12},.15,5.5,'sine.inOut').tween('all',{'opacity':0},{'opacity':1},2.5,.3)
s.cue('five','全部战场 5 / 5',285,375,390,38).enter('five',3.1)
s.caption('one','控制区域内全部战场国家',0,2.9).caption('two','国家总数也须领先；欧洲控制即胜',3.1)
S[s.id]=s

s=Scene('final-scoring','最终计分').world('world',1,1)
for i,p in enumerate([(480,170),(720,230),(580,250),(500,340),(220,265),(290,390)]):
 s.to('camera',{'scale':1.65,'x':480-p[0]*1.65,'y':250-p[1]*1.65},.15+i*.7,.55)
s.image('china','card-006',373,93,215).enter('china',4.65,.5,y=200)
s.caption('one','第 10 回合后，对六大区域最终计分',0,4.5).caption('two','中国牌持有者额外获得 1 胜利点',4.65)
S[s.id]=s

s=Scene('space','太空竞赛').world('world',1.1,1.2)
s.image('track0','space-0',310,170,620,'hud-capture').exit('track0',3.2,.2)
s.image('track1','space-1',310,170,620,'hud-capture').enter('track1',3.4,.2)
s.image('card','card-004',40,100,220).to('card',{'x':240,'y':100,'scale':.35,'opacity':0},1.9,.75)
s.caption('one','把合格行动点牌投入太空，事件不触发',0,2.8).caption('two','骰点达到本格要求，才前进一步',3)
S[s.id]=s

def piles_stage(id,title,before='piles',after=None):
 s=Scene(id,title).world('world',1.12,1.2)
 s.image('piles',before,65,87,830,'hud-capture')
 if after:s.image('pileafter',after,65,87,830,'hud-capture').enter('pileafter',3.35,.2)
 return s
s=piles_stage('draw','抽牌 · 牌堆',after='piles-drawn')
s.image('moving','card-back',356,188,135).to('moving',{'x':330,'y':220,'rotation':11,'scale':1.3},1.2,1.2)
s.caption('one','从抽牌堆取牌，加入自己的手牌',0,3).caption('two','抽到牌，不会自动触发它的事件',3.2);S[s.id]=s
s=piles_stage('discard','弃牌 · 弃牌堆',after='piles-discarded')
s.image('moving','card-028',740,346,145).to('moving',{'x':-210,'y':-162,'rotation':0,'scale':.95},1.2,1.15).exit('moving',3.2,.15)
s.caption('one','将指定手牌放进弃牌堆',0,2.8).caption('two','强制弃牌不触发事件；弃牌可再洗回',3);S[s.id]=s
s=piles_stage('removed','移出游戏','piles-empty-removed','piles')
s.image('moving','card-008',100,110,190).to('moving',{'x':610,'y':83,'scale':.67,'rotation':0},1.65,1).exit('moving',3.2,.15)
s.caption('one','带星号的事件，实际触发后',0,2.8).caption('two','通常进入移除区，不再洗回牌堆',3);S[s.id]=s

s=Scene('draft-meter','概念牌专用').world('world',1.1,1.2)
s.image('concept','concept-meter',300,40,360).tween('concept',{'y':140,'scale':.75,'opacity':0},{'y':0,'scale':1,'opacity':1},.25,.8)
s.to('concept',{'scale':1.32,'y':-58},2.3,.8)
s.caption('one','「紧张度」「声望」属于旧概念牌',0,2.65).caption('two','按这张概念牌的文字升降',2.85)
S[s.id]=s

def write():
 ids=['control','action-round','headline'] if '--proof' in sys.argv else IDS
 assert all(id in S for id in ids)
 hosts=[]
 for i,id in enumerate(ids):
  s=S[id];html=f'<template><div id="{id}-root" class="scene" data-composition-id="{id}" data-duration="6" data-width="960" data-height="540" data-fps="24" style="width:100%;height:100%" data-layout-allow-overlap="true" data-layout-allow-overflow="true">'+''.join(s.parts)+f'<div class="tag">{escape(s.title)}</div></div><script>const tl=gsap.timeline({{paused:true}});'+''.join(s.anims)+f'window.__timelines["{id}"]=tl;tl.seek(0);</script></template>'
  (R/f'compositions/{id}.html').write_text(html)
  hosts.append(f'<div id="{id}" class="clip" data-composition-id="{id}" data-composition-src="compositions/{id}.html" data-start="{i*6}" data-duration="6" data-track-index="0" data-track-kind="graphics"></div>')
 (R/'index.html').write_text(f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=960,height=540"><script src="assets/vendor/gsap.min.js"></script><style>{CSS}</style></head><body><div id="root" data-composition-id="card-help" data-width="960" data-height="540" data-fps="24" data-duration="{len(ids)*6}">'+''.join(hosts)+'<script>const tl=gsap.timeline({paused:true});window.__timelines["card-help"]=tl;tl.seek(0);</script></div></body></html>')
 (R/'real-shot-plan.json').write_text(json.dumps({'duration':6,'size':[960,540],'fps':24,'sound':False,'shots':[{'id':id,'start':i*6,'posterTime':S[id].poster,'aliases':[e['label'] for e in G if e['video']==id]} for i,id in enumerate(ids)]},ensure_ascii=False,indent=2))
 print('Built genuine-asset scenes:',','.join(ids))
write()

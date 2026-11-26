import { guardLanguageNavigation, flushLanguageChange } from '../i18n/navigation';
import { t as i18n } from '../i18n/index.js';
import type { WorldMap } from '../map/WorldMap';
import type { Hud } from '../hud/Hud';
import type { HudState } from '../hud/types';
import type { MapState, Lang } from '../map/types';
import type { GameAudio } from '../audio/GameAudio';
import { CARDS, cardFace, cardBack, fitCard, describeCard } from '../cards/deck';
import { createSpotlight } from '../play/spotlight';
import { ABORTED, type Decision, type PlaceSession, type Play, type PlayQueries } from '../play/types';
import { SoloGame, type SoloPresenter } from '../game/solo/engine';
import { Match, type MatchState } from '../game/solo/model';
import { createHeuristicAgent } from '../game/ai/heuristic';
import { completePresenter, gameMenu } from '../game/solo/presenter';
import { TutorialCoach, type CoachStep } from './coach';
import { INTRO, FINISH_LESSONS, media, type Lesson } from './lessons';
import { createTutorialSnapshot, createTutorialAgent, HUMAN_HEADLINE, COMPUTER_ACTIONS,
  plannedHumanAction, plannedHumanChoice, plannedHumanTarget, tutorialComplete } from './scenario';

const cards = { face:cardFace, back:cardBack, fit:fitCard, describe:describeCard };
const name = (id: string) => CARDS.find(c => c.id === id)?.title ?? id;
const countrySelector = (id: string) => `.wm-plate[data-id="${id}"]`;
const handSelector = (id: string) => `.hd-card[data-card="${id}"]`;
const hitSelector = (id: string) => `.hd-hit[data-card="${id}"]`;
const STORAGE = 'coldwar.tutorial.v1.coldwar';
type Saved = { version:1; mode:'guided'|'free'; snapshot:MatchState; read:string[] };
type Host = { container:HTMLElement; map:WorldMap; hud:Hud; audio:GameAudio; lang:Lang; show(hud:HudState,map:MapState):void; pace:number };

/** A separate presenter/Agent adapter and save namespace. No room or ordinary solo save is touched. */
export function startTutorial(host: Host): { dispose(): void } {
  const {container,map,hud,audio,lang,show} = host;
  let run = 0, current: SoloGame | undefined, currentPresenter: SoloPresenter | undefined;
  let currentCoach: TutorialCoach | undefined, stopWatch = () => {}, disposed = false;
  let latest: Saved | undefined, guided = true;
  let canSwitchLanguage = true, savedSuccessfully = false;
  guardLanguageNavigation(() => savedSuccessfully && (canSwitchLanguage || !!current?.result));
  const abort = new AbortController();
  const menu = hud.root.querySelector<HTMLElement>('[data-part="dial"]')!;
  menu.tabIndex = 0;menu.setAttribute('role','button');menu.setAttribute('aria-label',i18n("教学对局菜单"));
  const readSave = (): Saved | undefined => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) ?? 'null') as Saved | null;
      if (!saved || saved.version !== 1 || !['guided','free'].includes(saved.mode) || !Array.isArray(saved.read)) return;
      new Match(map.pack.scenario,undefined,saved.snapshot);
      return saved;
    } catch { return; }
  };
  function save(): void {
    if (!latest) return;
    try { localStorage.setItem(STORAGE,JSON.stringify(latest)); savedSuccessfully = true; }
    catch { savedSuccessfully = false; menu.title=i18n("教程暂时无法保存 · 请勿关闭页面"); }
  }
  function reset(): void {
    void begin(guided ? undefined : {version:1,mode:'free',snapshot:new Match(map.pack.scenario).snapshot(),read:[]});
  }
  function exit(): void { dispose();location.assign(`${import.meta.env.BASE_URL}online.html`); }
  function dispose(): void {
    if (disposed) return;
    disposed=true;run++;stopWatch();current?.stop();currentPresenter?.dispose();currentCoach?.dispose();
    hud.setStatusSpotlight(false);hud.setHandAvailability(null);abort.abort();
    container.classList.remove('tutorial-mode');
  }
  async function begin(saved?: Saved): Promise<void> {
    const serial=++run;
    canSwitchLanguage=true;
    stopWatch();current?.stop();currentPresenter?.dispose();currentCoach?.dispose();
    hud.setStatusSpotlight(false);hud.setHandAvailability(null);
    guided=saved?.mode!=='free';
    container.classList.toggle('tutorial-mode',guided);
    const read=new Set(saved?.read ?? []);
    const coach=new TutorialCoach(container,{onExit:exit,onRestart:reset});currentCoach=coach;
    const ensure=()=>{if(disposed||serial!==run)throw ABORTED;};
    const recordRead=(id:string)=>{read.add(id);if(latest){latest.read=[...read];save();}};
    let expected: string | undefined;
    let lastPlay: Play | undefined;
    const pendingLessons: Lesson[] = [];
    async function flushLessons(): Promise<void> {
      for (const step of pendingLessons.splice(0)) await lesson(step);
    }
    const game=new SoloGame({scenario:map.pack.scenario,lang,snapshot:saved?.snapshot ?? createTutorialSnapshot(map.pack.scenario),
      agent:guided?createTutorialAgent():createHeuristicAgent(),onChange:show,onCheckpoint(snapshot){
        if(serial!==run)return;
        latest={version:1,mode:guided?'guided':'free',snapshot,read:[...read]};save();
        if(savedSuccessfully)flushLanguageChange();
      }});
    current=game;
    latest={version:1,mode:guided?'guided':'free',snapshot:game.snapshot,read:[...read]};save();
    const queries: PlayQueries={
      get crisis(){return game.crisis;}, country:id=>game.country(id),card:id=>game.card(id),sideName:s=>game.sideName(s),
      options(id){const o=game.options(id);return guided&&expected&&id!==expected
        ? {...o,blocked:i18n("教学步骤：请先使用高亮的牌"),headline:{ok:false,why:i18n("教学步骤：请先使用高亮的牌")}} : o;},
    };
    const base=completePresenter(createSpotlight({...host,cards,game:queries}),cards,reset,audio);
    const progress=()=>tutorialComplete(game.match.s)?i18n("教学回合已完成"):i18n("第 {0} 回合 · {1}", [game.match.s.turn, game.match.s.phase==='headline'?'头条阶段':game.match.s.phase==='cleanup'?'回合结算':`${Math.min(6,game.match.s.actions[0]+1)} / 6 行动轮`]);
    async function lesson(step: Lesson, once=true): Promise<void> {
      ensure();if(once&&read.has(step.id))return;
      await base.idle?.();ensure();
      hud.setStatusSpotlight(!!step.status);
      if(step.countries?.length){map.frameCountries(step.countries,step.countries.length===1?3:5);await new Promise(r=>setTimeout(r,650));ensure();}
      await coach.explain({...step,progress:step.progress ?? progress()});ensure();
      recordRead(step.id);hud.setStatusSpotlight(false);coach.hide();
    }
    function action(step: CoachStep): void {ensure();coach.show({...step,progress:progress()});}
    async function waitForDecision(headline:boolean): Promise<Decision|string> {
      const plan=plannedHumanAction(game.match.s);
      const id=headline?HUMAN_HEADLINE:plan!.card;
      expected=id;
      const chapter=headline?i18n("03 · 头条阶段"):i18n("04 · 你的第 {0} 行动轮", [game.match.s.actions[0]+1]);
      let stage='';let frame=0;
      const watch=()=>{
        if(serial!==run)return;
        const choice=container.querySelector('.sp-choice');
        const state=choice?(choice.classList.contains('is-ops')?'mode':'choice'):'hand';
        if(stage!==state){stage=state;
          if(state==='hand')action({id:`play-${id}`,chapter,title:i18n("拖出《{0}》", [name(id)]),icon:'↗',body:headline?i18n("把高亮的牌拖向地图中央并松手。头条只执行事件，不使用行动点。"):i18n("从手牌中拖起这张牌，移到地图中央再松手。下一步选择用途。"),targets:[handSelector(id)],allow:[handSelector(id),hitSelector(id)]});
          else if(plan?.use==='event')action({id:`use-${id}`,chapter,title:i18n("选择执行事件"),icon:'✦',body:i18n("这张牌按事件文字执行。计分牌只会进行计分，不能当行动点使用。"),targets:['.sp-half.ev'],allow:['.sp-half.ev']});
          else if(state==='choice')action({id:`use-${id}`,chapter,title:i18n("选择右侧的行动点"),icon:'◆',body:plan?.use==='space'?i18n("从行动点入口选择太空竞赛，牌面事件不会触发。"):i18n("使用左上角的行动点。己方事件不触发，对手事件仍会执行。"),targets:['.sp-half.ops .sp-pts','.sp-half.ops .sp-big'],allow:['.sp-half.ops']});
          else {const mode=plan?.use==='space'?'space':plan!.mode!;action({id:`mode-${id}`,chapter,title:i18n("选择{0}", [{place:'放置影响力',coup:'政变',realign:'调整阵营',space:'太空竞赛'}[mode]]),icon:mode==='space'?'↗':mode==='coup'?'⚑':'＋',body:plan!.body,targets:[`.sp-band[data-key="${mode}"]`],allow:[`.sp-band[data-key="${mode}"]`]});}
        }
        frame=requestAnimationFrame(watch);
      };
      const pending=headline?base.pickHeadline():base.decide();
      watch();stopWatch=()=>cancelAnimationFrame(frame);
      try {
        const answer=await pending;ensure();
        if(headline?answer!==id:typeof answer==='string'||answer.card!==id||answer.use!==plan!.use||answer.mode!==plan!.mode)
          throw new Error(i18n("教程行动与当前步骤不一致"));
        return answer;
      } finally {cancelAnimationFrame(frame);stopWatch=()=>{};expected=undefined;coach.hide();}
    }
    async function finish(): Promise<void> {
      for(const step of FINISH_LESSONS)await lesson(step);
      await base.idle?.();ensure();
      const choice=await coach.choose({id:'complete',chapter:i18n("教程完成"),title:i18n("现在，由你来决定下一步"),icon:'★',body:i18n("已完成第 1 回合。当前第 {0} 回合，{1}。继续这盘对局，自由选择接下来的行动。", [game.match.s.turn, game.match.s.vp===0?'VP 持平':`${game.match.s.vp>0?'美国':'苏联'}领先 ${Math.abs(game.match.s.vp)} VP`]),targets:['.hud-tl'],progress:i18n("已完成")},[{id:'continue',label:i18n("继续与 AI 对战"),icon:'↗'},{id:'exit',label:i18n("退出到首页"),icon:'←'}]);
      ensure();
      if(choice==='exit'){exit();throw ABORTED;}
      guided=false;expected=undefined;coach.dispose();hud.setHandAvailability(null);hud.setStatusSpotlight(false);
      container.classList.remove('tutorial-mode');
      latest={version:1,mode:'free',snapshot:game.snapshot,read:[...read]};save();
    }
    const wrapped: SoloPresenter={...base,
      async phase(info){
        ensure();if(!guided)return base.phase(info);await flushLessons();
        coach.hide();
        if(info.kind==='turn'&&tutorialComplete(game.match.s)){
          await lesson({id:'cleanup',chapter:i18n("06 · 回合结算"),title:i18n("回合结束：先结算，再补牌"),icon:'↻',status:true,video:media('milops'),targets:['.hud-tl','[data-part="milops"]','[data-part="crisis"]'],body:i18n("军事行动不足的扣分已结算，双方军事行动清零，DEFCON 向和平恢复 1 级。中国牌恢复可用，保留手牌带入下回合，再补足手牌。")});
          await finish();return base.phase(info);
        }
        await base.phase(info);
        if(info.kind==='round'&&info.who===1){
          const a=COMPUTER_ACTIONS[info.round-1];
          await lesson({id:`ai-${info.round}`,chapter:i18n("05 · 观察对手"),title:i18n("电脑打出《{0}》", [name(a.card)]),icon:'⚑',body:info.round===1?i18n("电脑会用北约的 4 点行动在伊朗政变。虽然这是一张美国事件牌，但北约的前置事件尚未生效，因此不会触发。注意伊朗是战场国：政变会同时改变影响力、军事行动和 DEFCON。"):i18n("观察电脑这次{0}。整张牌的后果处理完，才轮到你；观察红蓝数字与右上状态的变化。", [a.use==='event'?'执行事件':a.mode==='coup'?'发动政变':'使用行动点']),countries:a.target?[a.target]:undefined,targets:a.target?[countrySelector(a.target)]:['.op'],video:info.round===1?media('coup'):undefined});
        }
      },
      async pickHeadline(){
        if(!guided)return base.pickHeadline();
        if(tutorialComplete(game.match.s)){await finish();return base.pickHeadline();}
        await lesson({id:'headline',chapter:i18n("03 · 头条阶段"),title:i18n("秘密选一张牌，同时揭示"),icon:'✦',video:media('headline'),targets:[handSelector(HUMAN_HEADLINE),'.op'],body:i18n("这次选《{0}》做头条。双方同时亮牌后，行动点高的事件先结算，同点美国先。头条不获得行动点；即使你选择的是对方事件，也要执行。计分牌作头条按 0 点处理。", [name(HUMAN_HEADLINE)])});
        return await waitForDecision(true) as string;
      },
      async showHeadline(h){coach.hide();await base.showHeadline(h);
        if(guided)await lesson({id:'headline-order',chapter:i18n("03 · 头条阶段"),title:i18n("先比较数字，再执行事件"),icon:'1',targets:['.sp-headline'],body:i18n("你选了《{0}》，电脑选了《{1}》。本次先结算《{2}》。这只是先后顺序，不会消耗接下来的 6 个行动轮。", [name(h.mine), name(h.theirs), name(h.order[0].card)])});
      },
      async decide(){
        if(!guided)return base.decide();
        const plan=plannedHumanAction(game.match.s);if(!plan)throw new Error(i18n("缺少教程行动"));
        await lesson({id:`lesson-${plan.card}`,chapter:i18n("04 · 你的第 {0} 行动轮", [game.match.s.actions[0]+1]),title:plan.title,body:plan.body,icon:plan.use==='space'?'↗':'◆',video:plan.video?media(plan.video==='opponent-event'?'operations':plan.video):undefined,targets:[handSelector(plan.card)]});
        return await waitForDecision(false) as Decision;
      },
      async place(session,play){
        if(!guided)return base.place(session,play);
        const plan=plannedHumanAction(game.match.s), places=plan?.placements;
        if(!places?.length)throw new Error(i18n("缺少教程影响力目标"));
        await base.idle?.();
        const refresh=()=>{
          const next=places[session.spent.length];
          if(next){map.frameCountries([next],3);action({id:`place-${play.card.id}-${session.spent.length}`,chapter:i18n("04 · 实际操作"),title:i18n("在{0}增加 1 点影响力", [game.country(next).name]),icon:'＋',body:i18n("点击高亮国家。还剩 {0} 行动点；本次放置花费 {1} 点。影响力通常按 1 点一个购买，敌方控制时按 2 点一个。", [session.left, session.targets().get(next)?.cost ?? 1]),targets:[countrySelector(next)],allow:[countrySelector(next)]});}
          else action({id:`confirm-${play.card.id}`,chapter:i18n("04 · 实际操作"),title:i18n("核对结果，然后完成行动"),icon:'✓',body:i18n("本张牌的影响力已经放完。点击“完成”确认这一轮，再让电脑行动。"),targets:['.sp-sub-keys .primary'],allow:['.sp-sub-keys .primary']});
        };
        const restricted:PlaceSession={side:session.side,points:session.points,canCancel:false,get left(){return session.left;},get spent(){return session.spent;},count:id=>session.count(id),
          targets(){const id=places[session.spent.length], target=session.targets().get(id);return id&&target?new Map([[id,target]]):new Map();},
          add(id){if(id!==places[session.spent.length])return null;const effect=session.add(id);if(effect)refresh();return effect;},undo:()=>false,commit:()=>session.commit?.()};
        refresh();
        const ok=await base.place(restricted,play);ensure();coach.hide();
        if(!ok||session.spent.length!==places.length||session.left!==0)throw new Error(i18n("教程影响力未放置完毕"));
        return true;
      },
      async pickTarget(req){
        if(!guided)return base.pickTarget(req);
        const id=plannedHumanTarget(req);map.frameCountries([id],3);
        action({id:`target-${req.card}`,chapter:i18n("04 · 实际操作"),title:i18n("选择{0}", [game.country(id).name]),icon:req.mode==='coup'?'⚑':'⇄',body:req.mode==='coup'?i18n("只高亮本次合法目标。目标需要有对方影响力；发动政变不要求自己与它相邻。"):i18n("点击埃及进行一次调整阵营。注意双方的邻国控制和影响力优势修正。"),targets:[countrySelector(id)],allow:[countrySelector(id)]});
        const picked=await base.pickTarget({...req,targets:new Map([[id,req.targets.get(id)!]]),optional:false,cancel:false});ensure();coach.hide();
        if(picked!==id)throw new Error(i18n("教程目标与指引不一致"));return picked;
      },
      async choose(q){
        if(!guided)return base.choose(q);
        const wanted=plannedHumanChoice(q), option=q.options.find(o=>o.id===wanted)!;
        return coach.choose({id:`choice-${wanted}`,chapter:i18n("04 · 决定执行方式"),title:q.title,icon:'◆',body:wanted==='after'?i18n("你可以决定对手事件在行动之前或之后触发。这次先完成你的行动，再让苏联执行《纳赛尔》。选择行动点不能取消红牌的事件。"):i18n("选择参加奥运会。双方各掷骰，主办方有加成，胜者得 VP。抵制会降低 DEFCON，并让对手获得额外行动。"),video:media(wanted==='after'?'operations':'vp')},[{id:wanted,label:option.label}]);
      },
      async announce(play){await flushLessons();lastPlay=play;coach.hide();await base.announce(play);},
      async roll(spec){coach.hide();await base.roll(spec);
        if(!guided)return;
        const situation=spec.situation;
        const totals=spec.dice.map(d=>i18n("{0}：骰点 {1}{2}", [d.side===0?'美':'苏', d.value, d.mods.length?`，修正后 ${d.total}`:''])).join('；');
        await lesson({id:`roll-${spec.card}-${spec.kind}`,chapter:i18n("05 · 看懂结算"),title:spec.kind==='coup'?i18n("政变：先除掉对手，再放自己的"):spec.kind==='realign'?i18n("调整阵营：比较双方总点数"):spec.kind==='space'?i18n("太空：看本格成功骰点"):i18n("事件也可能要求掷骰"),icon:'⚄',countries:spec.id?[spec.id]:undefined,status:!spec.id,targets:spec.id?[countrySelector(spec.id)]:['[data-part="space"]','[data-part="scoreRead"]'],body:i18n("{0}。{1}。{2}{3}", [totals, spec.text, situation?`接下来影响力将变为：美国 ${situation.after[0]}、苏联 ${situation.after[1]}。`:'', spec.kind==='coup'?`军事行动按使用的行动点计入，失败也算。${game.country(spec.id!).key?'这是战场国，DEFCON 将降低。':'这是非战场国，不会因此降低 DEFCON。'}`:spec.kind==='realign'?'调整阵营不增加你的影响力，也不增加军事行动，不会自行降低 DEFCON。':spec.kind==='space'?'无论成败，本次都消耗一次尝试；这张牌的事件不会触发。':spec.card==='013'?(spec.ok?'战争获胜，随后结算胜利点与目标国影响力；无论胜负都获得牌面指定的军事行动。':'这次战争失败，不得胜利点、也不夺取影响力，但苏联仍获得 2 点军事行动。'):'随后按事件规则结算胜利点。'])},false);
      },
      async step(effect,commit,cause){coach.hide();await base.step(effect,commit,cause);
        if(!guided)return;
        if(effect.t==='crisis'&&effect.d<0)await lesson({id:`defcon-${effect.to}`,chapter:i18n("05 · 核危机"),title:i18n("DEFCON 降为 {0}", [effect.to]),icon:'☢',status:true,video:media('defcon'),targets:['[data-part="crisis"]'],body:i18n("{0}禁止政变和调整阵营；放置影响力不受限制。{1}", [effect.to<=2?'欧洲、亚洲、中东':effect.to<=3?'欧洲、亚洲':'欧洲', effect.to<=2?'DEFCON 最低为 2，此时不能在战场国发动政变。':''])});
        if(effect.t==='vp'&&effect.why?.includes(i18n("军事行动不足")))await lesson({id:'milops-penalty',chapter:i18n("06 · 回合结算"),title:i18n("军事行动：少做的部分要扣分"),icon:'⚑',status:true,video:media('milops'),targets:['[data-part="milops"]','[data-part="scoreRead"]'],body:i18n("回合末要求等于当前 DEFCON（{0}）。美国完成 {1}，苏联完成 {2}；每缺 1 点就失去 1 VP。政变和战争事件能增加军事行动，放置影响力、调整阵营、太空都不能。本次：{3}。", [game.crisis, game.match.s.milops[0], game.match.s.milops[1], effect.why])});
      },
      async trigger(play){coach.hide();await base.trigger(play);
        if(guided&&play.card.id==='015')await lesson({id:`opponent-${play.card.id}`,chapter:i18n("05 · 对方事件"),title:i18n("对手事件照常触发"),icon:'!',countries:['egy'],targets:[countrySelector('egy')],body:i18n("你刚才使用的是行动点，但《纳赛尔》属于苏联，因此仍由苏联执行。你决定了先做自己的行动、后触发事件；牌在谁手里与事件为谁生效，是两回事。")});
      },
      async settle(play){coach.hide();await base.settle(play);
        if(!guided)return;
        if(play.card.id===HUMAN_HEADLINE)pendingLessons.push({id:'persistent-japan',chapter:i18n("03 · 头条阶段"),title:i18n("日本进入美国控制，条约继续生效"),icon:'◈',countries:['jpn'],targets:[countrySelector('jpn'),'.ps-shelf:not([hidden])'],body:i18n("事件已在日本放置足够影响力，并留下持续效果：苏联不能在那里政变或调整阵营。你的生效区保存这张牌的提醒；卡牌进入移除区后，效果也不会因此消失。")});
        if(play.card.id==='001')await lesson({id:'scoring-result',chapter:i18n("05 · 地区计分"),title:i18n("存在、支配、控制是三个等级"),icon:'★',status:true,video:media('region-status'),targets:['[data-part="scoreRead"]'],body:i18n("至少控制 1 国才有“存在”；国家总数更多、战场国更多，且至少有 1 个战场和 1 个非战场，才有“支配”；控制全部战场且总国家更多，达到“控制”。再加战场国和邻敌方超级大国的额外分，双方相减。本次计分后，VP 轨为 {0}（正数向美国）。欧洲达到地区控制会直接获胜。", [game.match.s.vp])});
      },
      async reveal(ids,title){if(!guided)return base.reveal(ids,title);await lesson({id:`reveal-${title}`,chapter:i18n("05 · 事件信息"),title,body:ids.length?i18n("这些是事件公开的信息：{0}。平时只能看到自己的手牌和对手数量，无法知道对手具体持有什么牌。", [ids.map(name).join('、')]):i18n("按当前步骤继续。"),icon:'◉',targets:['.op']},false);},
      dispose(){stopWatch();coach.dispose();base.dispose();},
    };
    const atDecision = <T>(decide: () => Promise<T>) => async (): Promise<T> => {
      canSwitchLanguage=true;
      if(savedSuccessfully)flushLanguageChange();
      try { return await decide(); } finally { canSwitchLanguage=false; }
    };
    wrapped.decide=atDecision(wrapped.decide.bind(wrapped));
    wrapped.pickHeadline=atDecision(wrapped.pickHeadline.bind(wrapped));
    currentPresenter=wrapped;
    Object.assign(window,{game:{map,hud,play:game,audio,presenter:()=>wrapped,tutorial:{get guided(){return guided;},get lastPlay(){return lastPlay;},restart:reset}}});
    hud.resetCardMotion(true);show(game.state,game.mapState);
    try {
      if(guided){for(const step of INTRO)await lesson(step);}
      else coach.dispose();
      ensure();canSwitchLanguage=false;await game.start(wrapped);
    } catch(error){
      if(error===ABORTED||serial!==run||disposed)return;
      console.error(i18n("教程中断"),error);game.stop();coach.dispose();base.dispose();hud.setHandAvailability(null);
      const recovery=new TutorialCoach(container,{onExit:exit,onRestart:reset});currentCoach=recovery;
      const choice=await recovery.choose({id:'recovery',chapter:i18n("教学对局"),title:i18n("恢复当前教学步骤"),icon:'↻',body:i18n("本步骤未完成。可以回到最近一次已完成的行动，再按指引继续。你的正常单机存档不受影响。")},[{id:'reload',label:i18n("恢复最近一步")},{id:'restart',label:i18n("重新开始教程")},{id:'exit',label:i18n("返回首页")}]);
      if(choice==='exit')exit();else void begin(choice==='reload'?latest:undefined);
    }
  }
  let menuOpen=false;
  async function openMenu():Promise<void>{
    if(guided||menuOpen||disposed)return;
    menuOpen=true;const choice=await gameMenu(!!latest);menuOpen=false;
    if(choice==='reload')void begin(latest);
    else if(choice==='new')reset();
  }
  menu.addEventListener('click',()=>void openMenu(),{signal:abort.signal});
  menu.addEventListener('keydown',e=>{if(e.key==='Enter')void openMenu();},{signal:abort.signal});
  window.addEventListener('keydown',e=>{
    if(guided||e.metaKey||e.ctrlKey||e.altKey||document.querySelector('dialog[open]')||
      (e.target instanceof Element && e.target.closest('input,textarea,select,[data-term],[contenteditable="true"]')))return;
    if(e.key===' '){e.preventDefault();currentPresenter?.skip();}
    if(e.key.toLowerCase()==='r')void openMenu();
  },{signal:abort.signal});
  void begin(readSave());
  return {dispose};
}

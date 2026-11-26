import {requestLanguage} from './navigation';
import {getLanguage,LANGUAGES,t} from './index.js';
import './switcher.css';
/** A reload restores the authoritative pending prompt online and the saved action locally. */
export function mountLanguageSwitcher(host:HTMLElement=document.body):void {
  const existing=document.querySelector<HTMLElement>('.language-switcher');
  if(existing){if(host!==document.body)anchor(existing,host);return;}
  const root=document.createElement('div');root.className='language-switcher';
  const button=document.createElement('button');button.type='button';button.className='language-button';
  button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/></svg><span></span>';
  button.querySelector('span')!.textContent=LANGUAGES.find(l=>l.id===getLanguage())!.label;
  button.setAttribute('aria-label',t('语言'));button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');
  const menu=document.createElement('div');menu.className='language-menu';menu.hidden=true;menu.id='language-menu';menu.setAttribute('role','menu');button.setAttribute('aria-controls',menu.id);
  const close=()=>{menu.hidden=true;button.setAttribute('aria-expanded','false')};
  for(const lang of LANGUAGES){const option=document.createElement('button');option.type='button';option.role='menuitemradio';option.lang=lang.tag;option.textContent=lang.label;option.dataset.language=lang.id;option.setAttribute('aria-checked',String(lang.id===getLanguage()));option.onclick=()=>{if(lang.id===getLanguage()){requestLanguage(lang.id);button.querySelector('span')!.textContent=lang.label;button.removeAttribute('title');root.querySelector('.language-notice')!.textContent='';close();return;}close();if(!requestLanguage(lang.id)){button.querySelector('span')!.textContent=lang.label+'…';button.title=t('语言将在本次行动结束后切换');root.querySelector('.language-notice')!.textContent=button.title;}};menu.append(option);}
  button.onclick=()=>{menu.hidden=!menu.hidden;button.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)menu.querySelector<HTMLButtonElement>('[aria-checked=true]')?.focus()};
  root.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.stopPropagation();close();button.focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();if(menu.hidden){menu.hidden=false;button.setAttribute('aria-expanded','true');}const items=[...menu.querySelectorAll('button')],i=items.indexOf(document.activeElement as HTMLButtonElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}});
  document.addEventListener('pointerdown',e=>{if(!root.contains(e.target as Node))close()});const notice=document.createElement('span');notice.className='language-notice';notice.setAttribute('role','status');root.append(button,menu,notice);document.body.append(root);if(host!==document.body)anchor(root,host);
}

/** One-time localization of authored HTML shells, before any user messages are mounted. */
export function translateShell(root:ParentNode=document):void {
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node:Node|null;
  while((node=walker.nextNode())){
    if(node.parentElement?.closest('script,style'))continue;
    const raw=node.textContent??'',trimmed=raw.trim();
    if(trimmed)node.textContent=raw.replace(trimmed,t(trimmed));
  }
  for(const el of root.querySelectorAll<HTMLElement>('[title],[aria-label],[placeholder],[alt]'))for(const attr of ['title','aria-label','placeholder','alt'])if(el.hasAttribute(attr))el.setAttribute(attr,t(el.getAttribute(attr)!));
}

function anchor(root:HTMLElement,host:HTMLElement):void {
 root.classList.add('is-anchored');
 const position=()=>{const r=host.getBoundingClientRect();root.style.left=Math.max(8,r.left+8)+'px';root.style.top=Math.max(8,r.bottom+8)+'px';};
 new ResizeObserver(position).observe(host);window.addEventListener('resize',position);position();
}

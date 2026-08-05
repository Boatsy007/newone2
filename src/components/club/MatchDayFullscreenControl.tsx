import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Expand, Minimize2 } from 'lucide-react'

type OrientationLock={lock?:(orientation:string)=>Promise<void>;unlock?:()=>void}
type FullscreenDocument=Document&{webkitFullscreenElement?:Element|null;webkitExitFullscreen?:()=>Promise<void>|void}
type FullscreenElement=HTMLElement&{webkitRequestFullscreen?:()=>Promise<void>|void}
type StatKey='i50'|'clr'|'r50'|'one'|'tkl'|'opm'|'fa'
type Side='home'|'away'
type QuarterStats=Record<Side,Record<StatKey,number>>
type SavedStats=Record<string,QuarterStats>

const STAT_ROWS:[StatKey,string,string][]=[['i50','I50','Inside 50s'],['clr','CLR','Clearances'],['r50','R50','Rebound 50s'],['one','1%','One percenters'],['tkl','TKL','Tackles'],['opm','OPM','Opposition marks'],['fa','FA','Frees against']]
const blank=():QuarterStats=>({home:{i50:0,clr:0,r50:0,one:0,tkl:0,opm:0,fa:0},away:{i50:0,clr:0,r50:0,one:0,tkl:0,opm:0,fa:0}})

export default function MatchDayFullscreenControl(){
 const[host,setHost]=useState<HTMLElement|null>(null)
 const[board,setBoard]=useState<HTMLElement|null>(null)
 const[active,setActive]=useState(false)
 const[sheetId,setSheetId]=useState('current')
 const[quarter,setQuarter]=useState(1)
 const[stats,setStats]=useState<SavedStats>({})
 const key=useMemo(()=>`playfooty.matchday.stats.v1.${location.pathname}.${sheetId}`,[sheetId])

 useEffect(()=>{
  let mounted=true
  const attach=()=>{
   if(!mounted)return
   const matchBoard=document.querySelector<HTMLElement>('.md')
   const actions=document.querySelector<HTMLElement>('.md-header-actions')
   if(matchBoard)setBoard(matchBoard)
   if(actions){let next=document.getElementById('pf-match-day-fullscreen-host');if(!next){next=document.createElement('div');next.id='pf-match-day-fullscreen-host';actions.prepend(next)}setHost(next)}
   const selected=document.querySelector<HTMLSelectElement>('.md-picker select')?.value
   if(selected)setSheetId(selected)
   const q=Number((document.querySelector<HTMLElement>('.md-clock>span')?.textContent||'Q1').replace(/\D/g,''))
   if(q>=1&&q<=4)setQuarter(q)
  }
  const sync=()=>{const doc=document as FullscreenDocument;setActive(Boolean(document.fullscreenElement||doc.webkitFullscreenElement||document.body.classList.contains('pf-match-day-focus')));attach()}
  attach()
  const observer=new MutationObserver(attach);observer.observe(document.body,{childList:true,subtree:true,characterData:true})
  document.addEventListener('change',attach,true);document.addEventListener('fullscreenchange',sync);document.addEventListener('webkitfullscreenchange',sync as EventListener)
  return()=>{mounted=false;observer.disconnect();document.removeEventListener('change',attach,true);document.removeEventListener('fullscreenchange',sync);document.removeEventListener('webkitfullscreenchange',sync as EventListener);document.getElementById('pf-match-day-fullscreen-host')?.remove();document.body.classList.remove('pf-match-day-focus')}
 },[])
 useEffect(()=>{try{setStats(JSON.parse(localStorage.getItem(key)||'{}'))}catch{setStats({})}},[key])

 async function toggle(){
  if(!board)return
  const doc=document as FullscreenDocument
  const fullscreen=Boolean(document.fullscreenElement||doc.webkitFullscreenElement)
  if(fullscreen||document.body.classList.contains('pf-match-day-focus')){
   if(fullscreen){if(document.exitFullscreen)await document.exitFullscreen().catch(()=>{});else await Promise.resolve(doc.webkitExitFullscreen?.()).catch(()=>{})}
   document.body.classList.remove('pf-match-day-focus')
   ;(screen.orientation as OrientationLock|undefined)?.unlock?.()
   setActive(false)
   return
  }

  // Enter the locked Match Day layout immediately. Native fullscreen is a
  // best-effort enhancement because iPad Safari can reject or exit it.
  document.body.classList.add('pf-match-day-focus')
  setActive(true)

  try{
   if(board.requestFullscreen)await board.requestFullscreen({navigationUI:'hide'}).catch(()=>board.requestFullscreen())
   else if((board as FullscreenElement).webkitRequestFullscreen)await Promise.resolve((board as FullscreenElement).webkitRequestFullscreen?.())
  }catch{}

  try{await(screen.orientation as OrientationLock|undefined)?.lock?.('landscape')}catch{}
 }
 function change(side:Side,stat:StatKey,delta:number){setStats(previous=>{const next={...previous};const existing=next[String(quarter)]||blank();next[String(quarter)]={...existing,[side]:{...existing[side],[stat]:Math.max(0,(existing[side][stat]||0)+delta)}};localStorage.setItem(key,JSON.stringify(next));window.dispatchEvent(new CustomEvent('playfooty:matchday-stats',{detail:{sheetId,quarter,stats:next}}));return next})}
 function click(selector:string,index:number){document.querySelectorAll<HTMLButtonElement>(selector)[index]?.click()}

 const current=stats[String(quarter)]||blank()
 if(!host)return null
 return <>
  {createPortal(<button className="md-fullscreen-button" type="button" onClick={()=>void toggle()} aria-label={active?'Exit full screen':'Open Match Day full screen'}>{active?<Minimize2 size={17}/>:<Expand size={17}/>}<span>{active?'Exit full screen':'Full screen'}</span></button>,host)}
  {active&&board&&createPortal(<>
   <section className="md-fs-stats">
    <div className="md-fs-tabs">{[1,2,3,4].map(q=><button key={q} className={quarter===q?'active':''} onClick={()=>setQuarter(q)}>Q{q}</button>)}</div>
    <div className="md-fs-head"><span>Your team</span><span>Stat</span><span>Opposition</span></div>
    <div className="md-fs-list">{STAT_ROWS.map(([stat,label,name])=><div className="md-fs-row" key={stat}><div className="md-fs-count"><button onClick={()=>change('home',stat,-1)}>−</button><strong>{current.home[stat]}</strong><button onClick={()=>change('home',stat,1)}>+</button></div><div className="md-fs-name"><b>{label}</b><small>{name}</small></div><div className="md-fs-count"><button onClick={()=>change('away',stat,-1)}>−</button><strong>{current.away[stat]}</strong><button onClick={()=>change('away',stat,1)}>+</button></div></div>)}</div>
   </section>
   <div className="md-fs-score md-fs-score-top"><button className="start" onClick={()=>click('.md-clock button',0)}>Start</button><button className="next" onClick={()=>click('.md-clock button',1)}>Next quarter</button><button className="rushed" onClick={()=>click('.md-team-actions button',1)}>Rushed behind</button><button className="goal" onClick={()=>click('.md-opposition-actions button',0)}>Opp goal</button><button className="behind" onClick={()=>click('.md-opposition-actions button',1)}>Opp behind</button><button className="undo" onClick={()=>click('.md-opposition-actions button',2)}>Undo</button></div>
  </>,board)}
  <style>{fullscreenStyles}</style>
 </>
}

const fullscreenStyles=`
.md:fullscreen,.md:-webkit-full-screen,body.pf-match-day-focus .md{position:relative!important;width:100vw!important;height:100vh!important;min-height:100vh!important;max-width:none!important;padding:0!important;overflow:hidden!important;background:#07111c!important}.md:fullscreen>header,.md:-webkit-full-screen>header,body.pf-match-day-focus .md>header{position:absolute!important;z-index:90!important;top:8px!important;right:8px!important;width:auto!important;margin:0!important;padding:0!important;background:transparent!important}.md:fullscreen>header>div:first-child,.md:-webkit-full-screen>header>div:first-child,body.pf-match-day-focus .md>header>div:first-child,.md:fullscreen .md-header-actions>button,.md:-webkit-full-screen .md-header-actions>button,body.pf-match-day-focus .md-header-actions>button{display:none!important}.md:fullscreen .md-header-actions #pf-match-day-fullscreen-host,.md:-webkit-full-screen .md-header-actions #pf-match-day-fullscreen-host,body.pf-match-day-focus .md-header-actions #pf-match-day-fullscreen-host{display:inline-flex!important}.md:fullscreen .md-fullscreen-button,.md:-webkit-full-screen .md-fullscreen-button,body.pf-match-day-focus .md-fullscreen-button{display:grid!important;width:38px!important;height:38px!important;padding:0!important;border-radius:10px!important;background:rgba(5,14,22,.9)!important}.md:fullscreen .md-fullscreen-button span,.md:-webkit-full-screen .md-fullscreen-button span,body.pf-match-day-focus .md-fullscreen-button span,.md:fullscreen .md-picker,.md:-webkit-full-screen .md-picker,body.pf-match-day-focus .md-picker,.md:fullscreen .md-sync-error,.md:-webkit-full-screen .md-sync-error,body.pf-match-day-focus .md-sync-error{display:none!important}.md:fullscreen .md-layout,.md:-webkit-full-screen .md-layout,body.pf-match-day-focus .md-layout{position:absolute!important;inset:0!important;display:block!important;width:100%!important;height:100%!important;max-width:none!important;margin:0!important}.md:fullscreen .md-layout>aside,.md:-webkit-full-screen .md-layout>aside,body.pf-match-day-focus .md-layout>aside,.md:fullscreen .md-bench-head,.md:-webkit-full-screen .md-bench-head,body.pf-match-day-focus .md-bench-head,.md:fullscreen .md-bench,.md:-webkit-full-screen .md-bench,body.pf-match-day-focus .md-bench,.md:fullscreen .md-field-head,.md:-webkit-full-screen .md-field-head,body.pf-match-day-focus .md-field-head{display:none!important}.md:fullscreen .md-field-panel,.md:-webkit-full-screen .md-field-panel,body.pf-match-day-focus .md-field-panel{position:absolute!important;left:0!important;top:0!important;width:50vw!important;height:100vh!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:#07111c!important;overflow:hidden!important}.md:fullscreen .md-ground-wrap,.md:-webkit-full-screen .md-ground-wrap,body.pf-match-day-focus .md-ground-wrap{position:absolute!important;inset:0!important;display:grid!important;place-items:center!important;width:100%!important;height:100%!important;margin:0!important;border-radius:0!important;background:#07111c!important;overflow:hidden!important}.md:fullscreen .md-ground,.md:-webkit-full-screen .md-ground,body.pf-match-day-focus .md-ground{width:min(45vw,72vh)!important;height:auto!important;min-height:0!important;max-width:none!important;aspect-ratio:.72!important;border-width:3px!important;transform:none!important}.md:fullscreen .md-player.on-field,.md:-webkit-full-screen .md-player.on-field,body.pf-match-day-focus .md-player.on-field{width:24%!important;max-width:104px!important;transform:translate(-50%,-50%)!important;border-radius:7px!important}.md:fullscreen .md-player.on-field.selected,.md:-webkit-full-screen .md-player.on-field.selected,body.pf-match-day-focus .md-player.on-field.selected{transform:translate(-50%,-54%)!important}.md:fullscreen .md-player-main,.md:-webkit-full-screen .md-player-main,body.pf-match-day-focus .md-player-main{grid-template-columns:25px minmax(0,1fr) 20px!important}.md:fullscreen .md-player-main .number,.md:-webkit-full-screen .md-player-main .number,body.pf-match-day-focus .md-player-main .number{min-width:25px!important;font-size:10px!important}.md:fullscreen .md-player-main strong,.md:-webkit-full-screen .md-player-main strong,body.pf-match-day-focus .md-player-main strong{min-height:22px!important;padding:4px 3px 0!important;font-size:8px!important;line-height:1!important;white-space:normal!important}.md:fullscreen .md-player-main small,.md:-webkit-full-screen .md-player-main small,body.pf-match-day-focus .md-player-main small{padding:0 3px 3px!important;font-size:6px!important}.md:fullscreen .md-player-main em,.md:-webkit-full-screen .md-player-main em,body.pf-match-day-focus .md-player-main em{padding:0 2px!important;font-size:8px!important}.md:fullscreen .md-player-score,.md:-webkit-full-screen .md-player-score,body.pf-match-day-focus .md-player-score{gap:2px!important;padding:2px!important}.md:fullscreen .md-player-score button,.md:-webkit-full-screen .md-player-score button,body.pf-match-day-focus .md-player-score button{min-height:20px!important;padding:1px!important;font-size:8px!important}.md:fullscreen .md-toolbar,.md:-webkit-full-screen .md-toolbar,body.pf-match-day-focus .md-toolbar{position:absolute!important;z-index:70!important;top:7px!important;left:25vw!important;transform:translateX(-50%) scale(.82)!important;transform-origin:top center!important;display:flex!important;align-items:center!important;gap:5px!important;width:auto!important;max-width:48vw!important;margin:0!important;padding:4px 6px!important;border:1px solid rgba(255,255,255,.22)!important;border-radius:9px!important;background:rgba(5,14,22,.9)!important}.md:fullscreen .md-score-actions,.md:-webkit-full-screen .md-score-actions,body.pf-match-day-focus .md-score-actions{display:none!important}.md:fullscreen .md-clock,.md:-webkit-full-screen .md-clock,body.pf-match-day-focus .md-clock{display:none!important}.md:fullscreen .md-scoreboard,.md:-webkit-full-screen .md-scoreboard,body.pf-match-day-focus .md-scoreboard{display:grid!important;grid-template-columns:auto auto auto!important;gap:5px!important;min-width:165px!important}.md:fullscreen .md-scoreboard strong,.md:-webkit-full-screen .md-scoreboard strong,body.pf-match-day-focus .md-scoreboard strong{font-size:22px!important}.md:fullscreen .md-scoreboard small,.md:-webkit-full-screen .md-scoreboard small,body.pf-match-day-focus .md-scoreboard small{font-size:6px!important;max-width:62px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.md:fullscreen .md-scoreboard div>span,.md:-webkit-full-screen .md-scoreboard div>span,body.pf-match-day-focus .md-scoreboard div>span{display:none!important}.md-fs-stats{position:absolute;z-index:65;top:58px;right:12px;width:calc(50vw - 24px);height:calc(50vh - 66px);min-height:300px;overflow:hidden;border:1px solid #263946;border-radius:14px;background:rgba(7,17,28,.97);color:#fff}.md-fs-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:7px}.md-fs-tabs button{border:1px solid #263946;border-radius:7px;background:#101b25;color:#aebac4;padding:6px;font-weight:950}.md-fs-tabs button.active{background:#0caf68;color:#fff}.md-fs-head,.md-fs-row{display:grid;grid-template-columns:1fr 86px 1fr;align-items:center}.md-fs-head{padding:4px 9px;color:#8394a2;font-size:8px;font-weight:950;text-align:center;text-transform:uppercase}.md-fs-list{height:calc(100% - 70px);overflow:hidden}.md-fs-row{min-height:calc((100% - 4px)/7);border-top:1px solid #21313d}.md-fs-name{text-align:center}.md-fs-name b,.md-fs-name small{display:block}.md-fs-name b{font-family:'Bebas Neue',Impact,sans-serif;font-size:20px}.md-fs-name small{color:#8999a5;font-size:7px}.md-fs-count{display:grid;grid-template-columns:30px 1fr 30px;align-items:center;gap:5px;padding:0 7px}.md-fs-count strong{text-align:center;font-size:20px}.md-fs-count button{width:30px;height:28px;border:0;border-radius:7px;background:#0caf68;color:#fff;font-size:20px;font-weight:950}.md-fs-count button:first-child{background:#d52c35}.md-fs-score.md-fs-score-top{position:absolute!important;z-index:95!important;top:8px!important;left:calc(50vw + 12px)!important;right:12px!important;width:auto!important;height:42px!important;display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;align-items:stretch!important;gap:6px!important;margin:0!important;padding:0!important;transform:none!important}.md-fs-score.md-fs-score-top button{position:static!important;inset:auto!important;display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;min-width:0!important;max-width:none!important;height:42px!important;min-height:42px!important;margin:0!important;padding:4px!important;border:0!important;border-radius:9px!important;color:#fff!important;font-size:7px!important;font-weight:950!important;line-height:1!important;text-align:center!important;text-transform:uppercase!important;white-space:normal!important;writing-mode:horizontal-tb!important;transform:none!important}.md-fs-score .start{background:#08c98b!important}.md-fs-score .next{background:#173043!important}.md-fs-score .rushed{background:#3e4850!important}.md-fs-score .goal{background:#c92e36!important}.md-fs-score .behind{background:#b88608!important}.md-fs-score .undo{background:#17232d!important}@media(max-height:620px){.md:fullscreen .md-ground,.md:-webkit-full-screen .md-ground,body.pf-match-day-focus .md-ground{width:min(43vw,68vh)!important}.md-fs-stats{top:48px;height:calc(50vh - 54px);min-height:260px}.md-fs-score.md-fs-score-top{top:6px!important;height:36px!important}.md-fs-score.md-fs-score-top button{height:36px!important;min-height:36px!important;font-size:6px!important}.md-fs-name b{font-size:17px}.md-fs-count strong{font-size:17px}}
`
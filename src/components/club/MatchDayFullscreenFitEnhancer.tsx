import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import MatchDayAIAssistant from './MatchDayAIAssistant'

type FullscreenDocument=Document&{webkitFullscreenElement?:Element|null}

function normalise(value:string){return value.toLowerCase().replace(/[^a-z0-9]/g,'')}

export default function MatchDayFullscreenFitEnhancer(){
 const[board,setBoard]=useState<HTMLElement|null>(null)
 const[active,setActive]=useState(false)
 useEffect(()=>{
  let mounted=true
  const sync=()=>{
   if(!mounted)return
   const doc=document as FullscreenDocument
   setBoard(document.querySelector<HTMLElement>('.md'))
   setActive(Boolean(document.fullscreenElement||doc.webkitFullscreenElement||document.body.classList.contains('pf-match-day-focus')))
  }
  sync()
  const observer=new MutationObserver(sync)
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})
  document.addEventListener('fullscreenchange',sync)
  document.addEventListener('webkitfullscreenchange',sync as EventListener)
  return()=>{mounted=false;observer.disconnect();document.removeEventListener('fullscreenchange',sync);document.removeEventListener('webkitfullscreenchange',sync as EventListener)}
 },[])

 useEffect(()=>{
  if(!active||!board)return
  let mounted=true
  const attachLogos=()=>{
   if(!mounted)return
   const scoreboard=board.querySelector<HTMLElement>('.md-scoreboard')
   const sides=scoreboard?.querySelectorAll<HTMLElement>(':scope>div')
   if(!scoreboard||!sides||sides.length<2)return
   const home=sides[0]
   const away=sides[sides.length-1]
   const homeName=home.querySelector('small')?.textContent||''
   const awayName=away.querySelector('small')?.textContent||''
   const images=[...document.querySelectorAll<HTMLImageElement>('img')].filter(img=>img.src&&!/playfooty/i.test(`${img.alt} ${img.title} ${img.src}`))
   const find=(name:string,homeSide:boolean)=>{
    const target=normalise(name)
    const exact=images.find(img=>{const text=normalise(`${img.alt} ${img.title} ${img.src}`);return target.length>2&&text.includes(target)})
    if(exact)return exact.src
    if(homeSide){
     const nav=document.querySelector<HTMLImageElement>('.club-portal-app-nav img,.club-portal-nav img,.club-hq-header img,[class*="club"] img')
     if(nav&&!/playfooty/i.test(`${nav.alt} ${nav.src}`))return nav.src
    }
    return ''
   }
   const add=(side:HTMLElement,kind:'home'|'away',src:string,name:string)=>{
    side.classList.add(`md-score-side-${kind}`)
    let logo=side.querySelector<HTMLImageElement>(`.md-score-logo.${kind}`)
    if(!src){logo?.remove();return}
    if(!logo){logo=document.createElement('img');logo.className=`md-score-logo ${kind}`;logo.alt=`${name} logo`;side.appendChild(logo)}
    if(logo.src!==src)logo.src=src
   }
   add(home,'home',find(homeName,true),homeName)
   add(away,'away',find(awayName,false),awayName)
  }
  attachLogos()
  const observer=new MutationObserver(attachLogos)
  observer.observe(board,{childList:true,subtree:true,characterData:true})
  const timer=window.setInterval(attachLogos,1000)
  return()=>{mounted=false;observer.disconnect();window.clearInterval(timer)}
 },[active,board])

 return <>
  {active&&board&&createPortal(<section className="md-ai-coach-placeholder" aria-label="AI assistant coach"><MatchDayAIAssistant/></section>,board)}
  <style>{styles}</style>
 </>
}

const styles=`
.md:fullscreen .md-ground-wrap,.md:-webkit-full-screen .md-ground-wrap,body.pf-match-day-focus .md-ground-wrap{inset:124px 10px 142px 10px!important;width:auto!important;height:auto!important;place-items:center!important;transform:translateY(8px)!important;overflow:visible!important}
.md:fullscreen .md-ground,.md:-webkit-full-screen .md-ground,body.pf-match-day-focus .md-ground{width:min(39vw,51vh)!important;height:auto!important;max-height:calc(100vh - 270px)!important;aspect-ratio:.72!important;transform:none!important}
.md:fullscreen .md-bench-head,.md:-webkit-full-screen .md-bench-head,body.pf-match-day-focus .md-bench-head{position:absolute!important;z-index:56!important;left:16px!important;bottom:116px!important;display:block!important;margin:0!important;color:#42b8ff!important;font-size:8px!important;letter-spacing:.12em!important;text-transform:uppercase!important}
.md:fullscreen .md-bench-head h2,.md:-webkit-full-screen .md-bench-head h2,body.pf-match-day-focus .md-bench-head h2{display:none!important}
.md:fullscreen .md-bench,.md:-webkit-full-screen .md-bench,body.pf-match-day-focus .md-bench{position:absolute!important;z-index:55!important;left:14px!important;right:14px!important;bottom:25px!important;display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:7px!important;width:auto!important;margin:0!important;padding:9px!important;border:1px solid #263946!important;border-radius:11px!important;background:rgba(5,14,22,.93)!important}
.md:fullscreen .md-bench .md-player,.md:-webkit-full-screen .md-bench .md-player,body.pf-match-day-focus .md-bench .md-player{min-width:0!important;border-radius:6px!important;box-shadow:0 3px 9px rgba(0,0,0,.32)!important}
.md:fullscreen .md-bench .md-player-main,.md:-webkit-full-screen .md-bench .md-player-main,body.pf-match-day-focus .md-bench .md-player-main{grid-template-columns:22px minmax(0,1fr) 18px!important}
.md:fullscreen .md-bench .md-player-main .number,.md:-webkit-full-screen .md-bench .md-player-main .number,body.pf-match-day-focus .md-bench .md-player-main .number{min-width:22px!important;font-size:8px!important}
.md:fullscreen .md-bench .md-player-main strong,.md:-webkit-full-screen .md-bench .md-player-main strong,body.pf-match-day-focus .md-bench .md-player-main strong{min-height:18px!important;padding:3px 2px 0!important;font-size:7px!important;line-height:1!important;white-space:normal!important}
.md:fullscreen .md-bench .md-player-main small,.md:-webkit-full-screen .md-bench .md-player-main small,body.pf-match-day-focus .md-bench .md-player-main small{padding:0 2px 2px!important;font-size:5px!important}
.md:fullscreen .md-bench .md-player-main em,.md:-webkit-full-screen .md-bench .md-player-main em,body.pf-match-day-focus .md-bench .md-player-main em{padding:0 2px!important;font-size:7px!important}
.md:fullscreen .md-bench .md-player-score,.md:-webkit-full-screen .md-bench .md-player-score,body.pf-match-day-focus .md-bench .md-player-score{gap:2px!important;padding:2px!important}
.md:fullscreen .md-bench .md-player-score button,.md:-webkit-full-screen .md-bench .md-player-score button,body.pf-match-day-focus .md-bench .md-player-score button{min-height:18px!important;padding:0!important;font-size:7px!important}

.md:fullscreen .md-toolbar,.md:-webkit-full-screen .md-toolbar,body.pf-match-day-focus .md-toolbar{top:7px!important;left:25vw!important;width:calc(50vw - 30px)!important;max-width:none!important;min-height:104px!important;transform:translateX(-50%)!important;display:grid!important;grid-template-columns:110px minmax(0,1fr)!important;gap:10px!important;padding:6px 10px!important;border:0!important;background:transparent!important;box-shadow:none!important}
.md:fullscreen .md-clock,.md:-webkit-full-screen .md-clock,body.pf-match-day-focus .md-clock{display:grid!important;grid-template-columns:34px 1fr!important;grid-template-rows:1fr 1fr!important;align-items:center!important;gap:0 7px!important;padding:7px 8px!important;border:1px solid #263946!important;border-radius:12px!important;background:rgba(5,14,22,.94)!important}
.md:fullscreen .md-clock>span,.md:-webkit-full-screen .md-clock>span,body.pf-match-day-focus .md-clock>span{grid-row:1/3!important;width:34px!important;height:58px!important;font-size:13px!important;border-radius:8px!important}
.md:fullscreen .md-clock>strong,.md:-webkit-full-screen .md-clock>strong,body.pf-match-day-focus .md-clock>strong{min-width:0!important;font-size:28px!important;line-height:1!important}
.md:fullscreen .md-clock button,.md:-webkit-full-screen .md-clock button,body.pf-match-day-focus .md-clock button{min-height:23px!important;padding:2px 5px!important;font-size:7px!important}
.md:fullscreen .md-scoreboard,.md:-webkit-full-screen .md-scoreboard,body.pf-match-day-focus .md-scoreboard{display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;align-items:center!important;gap:14px!important;min-width:0!important;height:88px!important;padding:8px 15px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
.md:fullscreen .md-scoreboard div,.md:-webkit-full-screen .md-scoreboard div,body.pf-match-day-focus .md-scoreboard div{position:relative!important;text-align:center!important}
.md:fullscreen .md-scoreboard strong,.md:-webkit-full-screen .md-scoreboard strong,body.pf-match-day-focus .md-scoreboard strong{font-size:58px!important;line-height:.78!important;color:#fff!important;text-shadow:0 4px 18px rgba(0,0,0,.5)!important}
.md:fullscreen .md-scoreboard small,.md:-webkit-full-screen .md-scoreboard small,body.pf-match-day-focus .md-scoreboard small{max-width:100%!important;font-size:9px!important;color:#d9e4eb!important;font-weight:950!important}
.md:fullscreen .md-scoreboard div>span,.md:-webkit-full-screen .md-scoreboard div>span,body.pf-match-day-focus .md-scoreboard div>span{display:block!important;margin-top:5px!important;color:#fff!important;font-size:12px!important;font-weight:950!important}
.md:fullscreen .md-scoreboard>b,.md:-webkit-full-screen .md-scoreboard>b,body.pf-match-day-focus .md-scoreboard>b{font-size:13px!important;color:#21d878!important}
.md-score-logo{position:absolute!important;top:50%!important;width:46px!important;height:46px!important;border-radius:50%!important;object-fit:contain!important;background:rgba(255,255,255,.96)!important;padding:3px!important;box-sizing:border-box!important;transform:translateY(-50%)!important;box-shadow:0 4px 14px rgba(0,0,0,.35)!important}
.md-score-logo.home{right:calc(100% + 8px)!important}.md-score-logo.away{left:calc(100% + 8px)!important}

.md:fullscreen .md-fs-score,.md:-webkit-full-screen .md-fs-score,body.pf-match-day-focus .md-fs-score{top:8px!important;right:12px!important;width:calc(50vw - 76px)!important;display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px!important;z-index:78!important}
.md:fullscreen .md-fs-score button,.md:-webkit-full-screen .md-fs-score button,body.pf-match-day-focus .md-fs-score button{min-height:45px!important;padding:7px 9px!important;border-radius:10px!important;font-size:9px!important;box-shadow:0 6px 16px rgba(0,0,0,.25)!important}
.md:fullscreen .md-fs-stats,.md:-webkit-full-screen .md-fs-stats,body.pf-match-day-focus .md-fs-stats{top:62px!important;height:calc(50vh - 8px)!important;min-height:0!important}
.md-ai-coach-placeholder{position:absolute;z-index:64;right:12px;bottom:14px;width:calc(50vw - 24px);height:calc(50vh - 98px);display:block;border:1px solid #314654;border-radius:14px;background:rgba(5,12,19,.9);color:#667480;text-align:left;pointer-events:auto;overflow:hidden}
@media(max-height:620px){.md:fullscreen .md-ground-wrap,.md:-webkit-full-screen .md-ground-wrap,body.pf-match-day-focus .md-ground-wrap{inset:112px 10px 126px 10px!important;transform:translateY(6px)!important}.md:fullscreen .md-ground,.md:-webkit-full-screen .md-ground,body.pf-match-day-focus .md-ground{width:min(37vw,47vh)!important;max-height:calc(100vh - 238px)!important}.md:fullscreen .md-bench-head,.md:-webkit-full-screen .md-bench-head,body.pf-match-day-focus .md-bench-head{bottom:101px!important}.md:fullscreen .md-bench,.md:-webkit-full-screen .md-bench,body.pf-match-day-focus .md-bench{bottom:17px!important;padding:6px!important}.md:fullscreen .md-toolbar,.md:-webkit-full-screen .md-toolbar,body.pf-match-day-focus .md-toolbar{min-height:94px!important;grid-template-columns:100px minmax(0,1fr)!important}.md:fullscreen .md-scoreboard strong,.md:-webkit-full-screen .md-scoreboard strong,body.pf-match-day-focus .md-scoreboard strong{font-size:48px!important}.md-score-logo{width:42px!important;height:42px!important}.md:fullscreen .md-fs-score,.md:-webkit-full-screen .md-fs-score,body.pf-match-day-focus .md-fs-score{top:6px!important}.md:fullscreen .md-fs-stats,.md:-webkit-full-screen .md-fs-stats,body.pf-match-day-focus .md-fs-stats{top:58px!important;height:calc(50vh - 4px)!important}.md-ai-coach-placeholder{bottom:10px;height:calc(50vh - 90px)}}
`

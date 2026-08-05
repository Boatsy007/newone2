import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Expand, Radio, ShieldCheck } from 'lucide-react'

export default function MatchDayCommandCentre({children}:{children:ReactNode}){
 const[launched,setLaunched]=useState(false)
 const pendingLaunch=useRef(false)

 useEffect(()=>{
  if(!launched||!pendingLaunch.current)return
  let attempts=0
  const open=()=>{
   const button=document.querySelector<HTMLButtonElement>('.md-fullscreen-button')
   if(button){pendingLaunch.current=false;button.click();return}
   attempts+=1
   if(attempts<30)window.setTimeout(open,50)
  }
  window.setTimeout(open,0)
 },[launched])

 function launch(){pendingLaunch.current=true;setLaunched(true)}

 if(launched)return <>{children}</>
 return <main className="md-command-centre">
  <header><span>Match Day</span><h1>Command Centre</h1><p>Open the live match workspace when you are ready to begin.</p></header>
  <section className="md-command-grid">
   <button className="md-command-live" type="button" onClick={launch}>
    <div className="md-command-icon"><Radio size={31}/></div>
    <div><span>Live Match</span><strong>Open full-screen match centre</strong><p>Field, score, timer, rotations, statistics, Game Plan, Whiteboard and AI Assistant Coach.</p></div>
    <Expand size={23}/>
   </button>
   <article><ShieldCheck size={22}/><div><strong>Game-day mode</strong><span>The live workspace opens directly in its locked landscape layout.</span></div></article>
  </section>
  <style>{styles}</style>
 </main>
}

const styles=`
.md-command-centre{min-height:calc(100vh - 150px);display:grid;align-content:start;gap:22px;padding:clamp(22px,5vw,58px);border-radius:22px;background:linear-gradient(145deg,#07111c,#0d1c29);color:#fff}.md-command-centre header>span{color:#42b8ff;font-size:11px;font-weight:950;letter-spacing:.18em;text-transform:uppercase}.md-command-centre h1{margin:7px 0 5px;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(48px,8vw,86px);line-height:.9;text-transform:uppercase}.md-command-centre header p{margin:0;color:#91a1ad;font-size:14px}.md-command-grid{display:grid;grid-template-columns:minmax(0,720px);gap:13px}.md-command-live{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:17px;width:100%;padding:22px;border:1px solid #2b485b;border-radius:17px;background:linear-gradient(135deg,#0b80bd,#075b89);color:#fff;text-align:left;box-shadow:0 18px 40px rgba(0,0,0,.25);cursor:pointer}.md-command-icon{width:62px;height:62px;display:grid;place-items:center;border-radius:15px;background:rgba(4,18,29,.34)}.md-command-live span,.md-command-live strong{display:block}.md-command-live span{font-family:'Bebas Neue',Impact,sans-serif;font-size:37px;line-height:1;text-transform:uppercase}.md-command-live strong{margin-top:4px;font-size:13px}.md-command-live p{margin:5px 0 0;color:#d0ecfb;font-size:10px;line-height:1.45}.md-command-grid article{display:flex;align-items:center;gap:11px;padding:15px 17px;border:1px solid #213644;border-radius:13px;background:#0b1721;color:#dce6ed}.md-command-grid article svg{color:#36ce83}.md-command-grid article strong,.md-command-grid article span{display:block}.md-command-grid article strong{font-size:12px;text-transform:uppercase}.md-command-grid article span{margin-top:2px;color:#81939f;font-size:10px}@media(max-width:650px){.md-command-centre{min-height:calc(100vh - 110px);padding:20px 14px}.md-command-live{grid-template-columns:auto 1fr;padding:17px}.md-command-live>svg{display:none}.md-command-icon{width:50px;height:50px}.md-command-live span{font-size:30px}}
`

import { RefreshCw } from 'lucide-react'

type Props={message?:string}

export default function PlayFootyLoadingScreen({message='Loading…'}:Props){
 return <main className="playfooty-loading-screen" role="status" aria-live="polite" aria-label={message}>
  <style>{styles}</style>
  <div className="playfooty-loading-content"><RefreshCw aria-hidden="true"/><strong>{message}</strong></div>
 </main>
}

const styles=`
.playfooty-loading-screen{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;min-height:100dvh;width:100%;padding:24px;background:#06131d;color:#fff;font-family:Barlow,Inter,Arial,sans-serif;box-sizing:border-box}.playfooty-loading-content{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;transform:translateY(-2vh);text-align:center}.playfooty-loading-screen svg{width:62px;height:62px;color:#3dbbff;stroke-width:2.5;animation:playfooty-loading-spin 1s linear infinite}.playfooty-loading-screen strong{color:#fff;font-size:clamp(22px,3vw,32px);line-height:1.15;font-weight:900;letter-spacing:.01em}@keyframes playfooty-loading-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.playfooty-loading-screen svg{animation-duration:2s}}
`

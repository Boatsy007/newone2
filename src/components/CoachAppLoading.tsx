import { RefreshCw } from 'lucide-react'

type Props = { message?: string }

export default function CoachAppLoading({ message = 'Opening your team…' }: Props) {
  return (
    <main className="coach-app-loading" role="status" aria-live="polite" aria-label={message}>
      <style>{styles}</style>
      <div className="coach-app-loading-content">
        <RefreshCw aria-hidden="true" />
        <strong>{message}</strong>
      </div>
    </main>
  )
}

const styles = `
.coach-app-loading{
  position:fixed;
  inset:0;
  z-index:99999;
  display:grid;
  place-items:center;
  min-height:100dvh;
  width:100%;
  padding:24px;
  background:#06131d;
  color:#fff;
  font-family:Barlow,Inter,Arial,sans-serif;
  box-sizing:border-box;
}
.coach-app-loading-content{
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:28px;
  transform:translateY(-2vh);
  text-align:center;
}
.coach-app-loading svg{
  width:62px;
  height:62px;
  color:#3dbbff;
  stroke-width:2.5;
  animation:coach-app-loading-spin 1s linear infinite;
}
.coach-app-loading strong{
  color:#fff;
  font-size:clamp(22px,3vw,32px);
  line-height:1.15;
  font-weight:900;
  letter-spacing:.01em;
}
@keyframes coach-app-loading-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.coach-app-loading svg{animation-duration:2s}}
`

export default function MatchDayFullscreenFitEnhancer(){
 return <style>{styles}</style>
}

const styles=`
.md:fullscreen .md-ground-wrap,.md:-webkit-full-screen .md-ground-wrap,body.pf-match-day-focus .md-ground-wrap{inset:56px 6px 88px 6px!important;width:auto!important;height:auto!important;place-items:center!important;transform:translateY(10px)!important;overflow:visible!important}
.md:fullscreen .md-ground,.md:-webkit-full-screen .md-ground,body.pf-match-day-focus .md-ground{width:min(39vw,58vh)!important;height:auto!important;max-height:calc(100vh - 158px)!important;aspect-ratio:.72!important;transform:none!important}
.md:fullscreen .md-bench-head,.md:-webkit-full-screen .md-bench-head,body.pf-match-day-focus .md-bench-head{display:none!important}
.md:fullscreen .md-bench,.md:-webkit-full-screen .md-bench,body.pf-match-day-focus .md-bench{position:absolute!important;z-index:55!important;left:8px!important;right:8px!important;bottom:7px!important;display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:5px!important;width:auto!important;margin:0!important;padding:0!important}
.md:fullscreen .md-bench .md-player,.md:-webkit-full-screen .md-bench .md-player,body.pf-match-day-focus .md-bench .md-player{min-width:0!important;border-radius:6px!important;box-shadow:0 3px 9px rgba(0,0,0,.32)!important}
.md:fullscreen .md-bench .md-player-main,.md:-webkit-full-screen .md-bench .md-player-main,body.pf-match-day-focus .md-bench .md-player-main{grid-template-columns:22px minmax(0,1fr) 18px!important}
.md:fullscreen .md-bench .md-player-main .number,.md:-webkit-full-screen .md-bench .md-player-main .number,body.pf-match-day-focus .md-bench .md-player-main .number{min-width:22px!important;font-size:8px!important}
.md:fullscreen .md-bench .md-player-main strong,.md:-webkit-full-screen .md-bench .md-player-main strong,body.pf-match-day-focus .md-bench .md-player-main strong{min-height:18px!important;padding:3px 2px 0!important;font-size:7px!important;line-height:1!important;white-space:normal!important}
.md:fullscreen .md-bench .md-player-main small,.md:-webkit-full-screen .md-bench .md-player-main small,body.pf-match-day-focus .md-bench .md-player-main small{padding:0 2px 2px!important;font-size:5px!important}
.md:fullscreen .md-bench .md-player-main em,.md:-webkit-full-screen .md-bench .md-player-main em,body.pf-match-day-focus .md-bench .md-player-main em{padding:0 2px!important;font-size:7px!important}
.md:fullscreen .md-bench .md-player-score,.md:-webkit-full-screen .md-bench .md-player-score,body.pf-match-day-focus .md-bench .md-player-score{gap:2px!important;padding:2px!important}
.md:fullscreen .md-bench .md-player-score button,.md:-webkit-full-screen .md-bench .md-player-score button,body.pf-match-day-focus .md-bench .md-player-score button{min-height:18px!important;padding:0!important;font-size:7px!important}
@media(max-height:620px){.md:fullscreen .md-ground-wrap,.md:-webkit-full-screen .md-ground-wrap,body.pf-match-day-focus .md-ground-wrap{inset:50px 8px 78px 8px!important;transform:translateY(8px)!important}.md:fullscreen .md-ground,.md:-webkit-full-screen .md-ground,body.pf-match-day-focus .md-ground{width:min(37vw,54vh)!important;max-height:calc(100vh - 136px)!important}.md:fullscreen .md-bench,.md:-webkit-full-screen .md-bench,body.pf-match-day-focus .md-bench{bottom:5px!important}}
`

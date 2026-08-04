import { ChevronDown, Goal, Layers3, Shield, Sparkles, Target, Trophy, Users } from 'lucide-react'

type Slot = {
  clubPlayerId: string
  playerName: string
  jumperNumber: number | null
  positionCode: string
  onGround: boolean
  plusMinus: number
  goals?: number
  behinds?: number
}

type MatchEvent = {
  id: string
  quarter: number
  seconds: number
  kind: 'SCORE' | 'SWAP' | 'QUARTER'
  label: string
  delta?: number
  affected?: string[]
  before?: Slot[]
}

type MatchState = {
  sheetId: string
  quarter: number
  elapsed: number
  homeGoals: number
  homeBehinds: number
  awayGoals: number
  awayBehinds: number
  slots: Slot[]
  events: MatchEvent[]
}

type LineKey = 'defence' | 'midfield' | 'forwards'
type Combination = {
  key: string
  players: Slot[]
  plusMinus: number
  forPoints: number
  againstPoints: number
  scoringEvents: number
  quarters: number[]
  firstSecond: number
  lastSecond: number
  goalScorers: string[]
}

type Pair = {
  ids: string[]
  names: string[]
  plusMinus: number
  scoringEvents: number
}

const GROUPS: Record<LineKey, Set<string>> = {
  defence: new Set(['BP_LEFT', 'FB', 'BP_RIGHT', 'HBF_LEFT', 'CHB', 'HBF_RIGHT']),
  midfield: new Set(['WING_LEFT', 'CENTRE', 'WING_RIGHT', 'RUCK', 'RUCK_ROVER', 'ROVER']),
  forwards: new Set(['HFF_LEFT', 'CHF', 'HFF_RIGHT', 'FP_LEFT', 'FF', 'FP_RIGHT']),
}

function points(goals: number, behinds: number) {
  return goals * 6 + behinds
}

function plus(value: number) {
  return `${value > 0 ? '+' : ''}${value}`
}

function clock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

function scorerFromEvent(event: MatchEvent, slots: Slot[]) {
  if (event.kind !== 'SCORE' || event.delta !== 6) return null
  const normalized = event.label.toLowerCase()
  return slots.find(slot => normalized.startsWith(slot.playerName.toLowerCase()))?.playerName ?? null
}

function buildCombinations(state: MatchState, group: LineKey): Combination[] {
  const rows = new Map<string, Combination & { scorerSet: Set<string>; quarterSet: Set<number> }>()
  const chronological = [...state.events].reverse().filter(event => event.kind === 'SCORE' && event.delta)

  chronological.forEach(event => {
    const snapshot = event.before?.length ? event.before : state.slots
    const players = snapshot
      .filter(slot => slot.onGround && GROUPS[group].has(slot.positionCode))
      .sort((left, right) => left.positionCode.localeCompare(right.positionCode))
    if (!players.length) return

    const key = players.map(slot => slot.clubPlayerId).sort().join('|')
    const existing = rows.get(key) ?? {
      key,
      players,
      plusMinus: 0,
      forPoints: 0,
      againstPoints: 0,
      scoringEvents: 0,
      quarters: [],
      firstSecond: event.seconds,
      lastSecond: event.seconds,
      goalScorers: [],
      scorerSet: new Set<string>(),
      quarterSet: new Set<number>(),
    }

    existing.plusMinus += event.delta || 0
    existing.scoringEvents += 1
    existing.firstSecond = Math.min(existing.firstSecond, event.seconds)
    existing.lastSecond = Math.max(existing.lastSecond, event.seconds)
    existing.quarterSet.add(event.quarter)
    if ((event.delta || 0) > 0) existing.forPoints += event.delta || 0
    if ((event.delta || 0) < 0) existing.againstPoints += Math.abs(event.delta || 0)
    const scorer = group === 'forwards' ? scorerFromEvent(event, players) : null
    if (scorer) existing.scorerSet.add(scorer)
    rows.set(key, existing)
  })

  return [...rows.values()]
    .map(row => ({
      ...row,
      goalScorers: [...row.scorerSet],
      quarters: [...row.quarterSet].sort((a, b) => a - b),
    }))
    .sort((left, right) => right.plusMinus - left.plusMinus || right.scoringEvents - left.scoringEvents)
}

function buildPairs(state: MatchState): Pair[] {
  const rows = new Map<string, Pair>()
  state.events.filter(event => event.kind === 'SCORE' && event.delta && event.affected?.length).forEach(event => {
    const ids = [...new Set(event.affected || [])].sort()
    for (let first = 0; first < ids.length; first += 1) {
      for (let second = first + 1; second < ids.length; second += 1) {
        const pairIds = [ids[first], ids[second]]
        const key = pairIds.join('|')
        const existing = rows.get(key) ?? {
          ids: pairIds,
          names: pairIds.map(id => state.slots.find(slot => slot.clubPlayerId === id)?.playerName || 'Player'),
          plusMinus: 0,
          scoringEvents: 0,
        }
        existing.plusMinus += event.delta || 0
        existing.scoringEvents += 1
        rows.set(key, existing)
      }
    }
  })
  return [...rows.values()].sort((left, right) => right.plusMinus - left.plusMinus || right.scoringEvents - left.scoringEvents).slice(0, 12)
}

export default function MatchDayGameSummary({ state, opponent, clubId }: { state: MatchState; opponent: string; clubId: string }) {
  const home = points(state.homeGoals, state.homeBehinds)
  const away = points(state.awayGoals, state.awayBehinds)
  const result = home === away ? 'Draw' : home > away ? `Won by ${home - away}` : `Lost by ${away - home}`
  const best22 = [...state.slots]
    .sort((left, right) => {
      const leftScore = left.plusMinus + (left.goals || 0) * 8 + (left.behinds || 0) * 2
      const rightScore = right.plusMinus + (right.goals || 0) * 8 + (right.behinds || 0) * 2
      return rightScore - leftScore
    })
    .slice(0, 22)
  const defence = buildCombinations(state, 'defence')
  const midfield = buildCombinations(state, 'midfield')
  const forwards = buildCombinations(state, 'forwards')
  const pairs = buildPairs(state)

  return <section className="mdgs">
    <header className="mdgs-head">
      <div><span>Full time analysis</span><h2>Who played well together?</h2><p>Tap any card to expand the combinations and periods behind the result.</p></div>
      <strong>{result}</strong>
    </header>

    <div className="mdgs-score">
      <div><span>Your team</span><b>{state.homeGoals}.{state.homeBehinds}</b><strong>{home}</strong></div>
      <em>FINAL</em>
      <div><span>{opponent}</span><b>{state.awayGoals}.{state.awayBehinds}</b><strong>{away}</strong></div>
    </div>

    <div className="mdgs-cards">
      <SummaryCard icon={Trophy} title="Best 22" subtitle="Ranked using plus/minus and scoring impact" badge={`${best22.length} players`}>
        <div className="mdgs-player-list">{best22.map((player, index) => <article key={player.clubPlayerId}>
          <i>{index + 1}</i><span><b>{player.jumperNumber ? `#${player.jumperNumber} ` : ''}{player.playerName}</b><small>{player.positionCode.replaceAll('_', ' ')}</small></span>
          <em className={player.plusMinus > 0 ? 'positive' : player.plusMinus < 0 ? 'negative' : ''}>{plus(player.plusMinus)}</em>
          <strong>{player.goals || 0}.{player.behinds || 0}</strong>
        </article>)}</div>
      </SummaryCard>

      <CombinationCard icon={Shield} title="Best back combinations" subtitle="Defensive groups with the strongest scoring differential" rows={defence}/>
      <CombinationCard icon={Layers3} title="Best midfield combinations" subtitle="Midfield groups that won the scoreboard while together" rows={midfield}/>
      <CombinationCard icon={Goal} title="Best forward combinations" subtitle="Includes goals and how many forwards hit the scoreboard" rows={forwards} forward/>

      <SummaryCard icon={Users} title="Best player pairs" subtitle="Two-player combinations with the best recorded plus/minus" badge={pairs.length ? `${pairs[0].names.join(' + ')} ${plus(pairs[0].plusMinus)}` : 'No data'}>
        {pairs.length ? <div className="mdgs-pairs">{pairs.map((pair, index) => <article key={pair.ids.join('-')}>
          <i>{index + 1}</i><span><b>{pair.names.join(' + ')}</b><small>{pair.scoringEvents} scoring events together</small></span><strong className={pair.plusMinus > 0 ? 'positive' : pair.plusMinus < 0 ? 'negative' : ''}>{plus(pair.plusMinus)}</strong>
        </article>)}</div> : <Empty/>}
      </SummaryCard>

      <SummaryCard icon={Sparkles} title="How to read this" subtitle="A quick guide to the combination data" badge="Method">
        <div className="mdgs-method">
          <p><b>Plus/minus</b> is the scoring margin while that exact group was on the ground.</p>
          <p><b>Forwards scoring</b> shows how many of the six forwards kicked at least one recorded goal during that combination.</p>
          <p><b>Sample size matters.</b> Combinations with more scoring events are more reliable than groups recorded for only one event.</p>
        </div>
      </SummaryCard>
    </div>

    <footer className="mdgs-footer">
      <a href={`/club-portal/${clubId}/media`}>Open Media Centre</a>
      <a href={`/club-portal/${clubId}/coaching`}>Return to coaching</a>
      <button onClick={() => window.print()}>Print summary</button>
    </footer>
    <style>{styles}</style>
  </section>
}

function SummaryCard({ icon: Icon, title, subtitle, badge, children }: { icon: typeof Trophy; title: string; subtitle: string; badge: string; children: React.ReactNode }) {
  return <details className="mdgs-card">
    <summary><span className="mdgs-icon"><Icon size={21}/></span><span><b>{title}</b><small>{subtitle}</small></span><em>{badge}</em><ChevronDown size={20}/></summary>
    <div className="mdgs-card-body">{children}</div>
  </details>
}

function CombinationCard({ icon, title, subtitle, rows, forward = false }: { icon: typeof Target; title: string; subtitle: string; rows: Combination[]; forward?: boolean }) {
  const best = rows[0]
  const badge = best ? `${plus(best.plusMinus)} · ${best.scoringEvents} events` : 'No data'
  return <SummaryCard icon={icon} title={title} subtitle={subtitle} badge={badge}>
    {rows.length ? <div className="mdgs-combos">{rows.slice(0, 8).map((row, index) => <article key={row.key}>
      <header><i>{index + 1}</i><span><b>{row.players.map(player => player.playerName).join(' · ')}</b><small>{row.quarters.length === 1 ? `Q${row.quarters[0]} ${clock(row.firstSecond)}–${clock(row.lastSecond)}` : `Q${row.quarters.join(', Q')} · ${row.scoringEvents} scoring events`}</small></span><strong className={row.plusMinus > 0 ? 'positive' : row.plusMinus < 0 ? 'negative' : ''}>{plus(row.plusMinus)}</strong></header>
      <div className="mdgs-combo-metrics"><span><b>{row.forPoints}</b> points for</span><span><b>{row.againstPoints}</b> points against</span><span><b>{row.scoringEvents}</b> events</span>{forward && <span className="goal"><b>{row.goalScorers.length} of {row.players.length}</b> kicked goals</span>}</div>
      {forward && row.goalScorers.length > 0 && <p><Goal size={15}/>Goals from {row.goalScorers.join(', ')}</p>}
    </article>)}</div> : <Empty/>}
  </SummaryCard>
}

function Empty() {
  return <div className="mdgs-empty">More scoring and interchange events are needed before this combination can be measured.</div>
}

const styles = `
.mdgs{margin-top:14px;padding:18px;border:1px solid #d5dee5;border-radius:18px;background:#f8fafb;color:#101820}.mdgs-head{display:flex;align-items:end;justify-content:space-between;gap:16px;padding:4px 2px 16px}.mdgs-head span{color:#0783c9;font-size:10px;font-weight:950;letter-spacing:.15em;text-transform:uppercase}.mdgs-head h2{margin:5px 0 3px;font:clamp(34px,5vw,54px)/.95 'Bebas Neue',Impact,sans-serif;text-transform:uppercase}.mdgs-head p{margin:0;color:#687580;font-size:13px}.mdgs-head>strong{flex:0 0 auto;padding:9px 13px;border-radius:999px;background:#dff5e9;color:#087943;font-size:12px;text-transform:uppercase}.mdgs-score{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;padding:17px;border-radius:15px;background:#0d1a24;color:#fff;text-align:center}.mdgs-score div{display:grid}.mdgs-score span{font-size:12px;font-weight:900}.mdgs-score b{font:38px/1 'Bebas Neue',Impact,sans-serif}.mdgs-score strong{font:58px/.9 'Bebas Neue',Impact,sans-serif}.mdgs-score em{color:#6ed0ff;font-size:11px;font-style:normal;font-weight:950}.mdgs-cards{display:grid;gap:10px;margin-top:12px}.mdgs-card{overflow:hidden;border:1px solid #dce4ea;border-radius:14px;background:#fff}.mdgs-card summary{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:11px;padding:15px;cursor:pointer;list-style:none}.mdgs-card summary::-webkit-details-marker{display:none}.mdgs-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:11px;background:#e5f5fe;color:#087fbe}.mdgs-card summary span b,.mdgs-card summary span small{display:block}.mdgs-card summary span b{font-size:15px}.mdgs-card summary span small{margin-top:3px;color:#74818b;font-size:10px}.mdgs-card summary>em{max-width:190px;overflow:hidden;text-overflow:ellipsis;padding:7px 9px;border-radius:999px;background:#eef3f6;color:#33414c;font-size:9px;font-style:normal;font-weight:900;white-space:nowrap}.mdgs-card summary>svg{transition:.2s}.mdgs-card[open] summary>svg{transform:rotate(180deg)}.mdgs-card-body{padding:0 14px 14px}.mdgs-player-list,.mdgs-pairs,.mdgs-combos{display:grid;gap:7px}.mdgs-player-list article,.mdgs-pairs article{display:grid;grid-template-columns:28px minmax(0,1fr) auto auto;align-items:center;gap:9px;padding:11px;border-radius:10px;background:#f3f6f8}.mdgs-player-list i,.mdgs-pairs i,.mdgs-combos header i{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#111c26;color:#fff;font-size:10px;font-style:normal;font-weight:900}.mdgs-player-list span b,.mdgs-player-list span small,.mdgs-pairs span b,.mdgs-pairs span small{display:block}.mdgs-player-list span small,.mdgs-pairs span small{margin-top:2px;color:#7b8790;font-size:9px;text-transform:capitalize}.mdgs-player-list em{font:24px/1 'Bebas Neue',Impact,sans-serif;font-style:normal}.mdgs-player-list>article>strong{min-width:34px;text-align:right;font-size:11px}.positive{color:#11834c!important}.negative{color:#c4333b!important}.mdgs-combos article{padding:12px;border:1px solid #e0e7ec;border-radius:11px}.mdgs-combos article>header{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:9px}.mdgs-combos header span b,.mdgs-combos header span small{display:block}.mdgs-combos header span b{font-size:12px;line-height:1.3}.mdgs-combos header span small{margin-top:3px;color:#7c8993;font-size:9px}.mdgs-combos header>strong{font:27px/1 'Bebas Neue',Impact,sans-serif}.mdgs-combo-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:10px}.mdgs-combo-metrics span{padding:8px;border-radius:8px;background:#eef3f6;color:#66737d;font-size:8px;text-align:center;text-transform:uppercase}.mdgs-combo-metrics span b{display:block;color:#17212a;font-size:14px}.mdgs-combo-metrics .goal{background:#e2f8eb;color:#167347}.mdgs-combos article>p{display:flex;align-items:center;gap:6px;margin:9px 0 0;color:#167347;font-size:10px;font-weight:800}.mdgs-method{display:grid;gap:8px}.mdgs-method p{margin:0;padding:11px;border-radius:10px;background:#f3f6f8;color:#5f6d77;font-size:11px;line-height:1.45}.mdgs-method p b{color:#111}.mdgs-empty{padding:24px;border-radius:10px;background:#f3f6f8;color:#6c7983;text-align:center;font-size:11px}.mdgs-footer{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}.mdgs-footer a,.mdgs-footer button{border:0;border-radius:9px;background:#111c26;color:#fff;padding:10px 12px;text-decoration:none;font-size:10px;font-weight:900;text-transform:uppercase}.mdgs-footer a:first-child{background:#1689c7}@media(max-width:640px){.mdgs{padding:12px;border-radius:13px}.mdgs-head{display:block}.mdgs-head>strong{display:inline-block;margin-top:12px}.mdgs-score{padding:13px}.mdgs-score strong{font-size:47px}.mdgs-card summary{grid-template-columns:auto minmax(0,1fr) auto;padding:12px}.mdgs-card summary>em{grid-column:2;justify-self:start;max-width:150px}.mdgs-card summary>svg{grid-column:3;grid-row:1/3}.mdgs-combo-metrics{grid-template-columns:1fr 1fr}.mdgs-player-list article{grid-template-columns:25px minmax(0,1fr) auto}.mdgs-player-list>article>strong{display:none}.mdgs-pairs article{grid-template-columns:25px minmax(0,1fr) auto}}
`

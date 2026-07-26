/**
 * League ladder + national club ranking cards. Editorial tables and cards,
 * built on the Phase 2 system. Leader, top four and last place are marked;
 * form/streak/movement come from the national ranking entries for the same
 * clubs. Every row and card links to the club profile.
 */
import { Link, useNavigate } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { teamPath, type LeagueDetail, type LeagueRankedTeam, type FormResult } from '../../lib/rankings'
import { ladderRowKey, normaliseLeagueLadder } from '../../lib/leagueLadder'
import { TeamLogo, FormPips } from '../rankings/bits'
import { Section, SectionHead, Reveal, Move, TEXT, MUTE, FAINT, LINE, PINK, GOLD, GOLD_DK, UP } from '../home/ui'
import { leagueAccent, winStreak, LeagueClubSearch } from './sections'

const TOP4_BG = 'rgba(244,193,77,0.055)'

export function LeagueLadder({ league, query, onQuery }: { league: LeagueDetail; query: string; onQuery: (v: string) => void }) {
  const navigate = useNavigate()
  const id = leagueAccent(league.name)
  const canonicalLadder = normaliseLeagueLadder(league.ladder)
  const formByClub = new Map(league.rankedTeams.map(team => [team.clubId, team]))
  const q = query.trim().toLowerCase()
  const rows = canonicalLadder.filter(row => !q || row.clubName.toLowerCase().includes(q))
  const last = canonicalLadder.length > 1 ? canonicalLadder[canonicalLadder.length - 1] : null

  return (
    <Section id="ladder">
      <SectionHead
        kicker={league.currentSeason ?? undefined}
        title={<>THE <span style={{ color: id.accent }}>LADDER</span></>}
        sub="Live standings. The top four play finals; every club links to its full profile."
      />
      <LeagueClubSearch league={{ ...league, ladder: canonicalLadder }} value={query} onChange={onQuery} />

      <Reveal>
        <div className="gn-card" style={{ overflow: 'hidden' }}>
          <div className="font-condensed lad-grid" style={{ display: 'grid', gap: 10, alignItems: 'center', padding: '12px clamp(12px, 2vw, 22px)', borderBottom: `2px solid ${TEXT}`, fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: FAINT }}>
            <span>Pos</span><span>Club</span>
            <span className="hide-sm" style={{ textAlign: 'center' }}>P</span>
            <span className="hide-sm" style={{ textAlign: 'center' }}>W</span>
            <span className="hide-sm" style={{ textAlign: 'center' }}>L</span>
            <span className="hide-sm" style={{ textAlign: 'center' }}>D</span>
            <span className="hide-sm" style={{ textAlign: 'right' }}>%</span>
            <span className="hide-sm" style={{ textAlign: 'right' }}>Nat.</span>
            <span className="hide-sm" style={{ textAlign: 'center' }}>Form</span>
            <span style={{ textAlign: 'right' }}>Pts</span>
          </div>

          {rows.length === 0 && (
            <div className="font-condensed" style={{ padding: 34, textAlign: 'center', color: MUTE, fontSize: 12.5, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {q ? `No clubs matching "${query.trim()}"` : 'Ladder publishes with the first round.'}
            </div>
          )}

          {rows.map(row => {
            const position = row.position ?? canonicalLadder.indexOf(row) + 1
            const ranked = formByClub.get(row.clubId)
            const isLeader = position === 1
            const isTopFour = position <= 4
            const isLast = last != null && row.clubId === last.clubId && position > 4
            const streak = winStreak(ranked?.recentForm)
            return (
              <button key={ladderRowKey(row)} onClick={() => navigate(teamPath(row.clubId))} className="gn-row lad-grid"
                aria-label={`${row.clubName}, position ${position}${isLeader ? ', ladder leader' : ''}`}
                style={{
                  width: '100%', display: 'grid', gap: 10, alignItems: 'center', textAlign: 'left', font: 'inherit', color: TEXT,
                  padding: '13px clamp(12px, 2vw, 22px)', border: 'none', cursor: 'pointer',
                  borderBottom: `1px solid ${LINE}`,
                  borderLeft: `3px solid ${isLeader ? GOLD : isTopFour ? id.accent : 'transparent'}`,
                  background: isLeader ? 'linear-gradient(90deg, rgba(244,193,77,0.12), transparent 45%)' : isTopFour ? TOP4_BG : isLast ? 'rgba(17,17,17,0.02)' : 'transparent',
                }}>
                <span className="font-display" style={{ fontSize: 21, color: isLeader ? GOLD_DK : isTopFour ? TEXT : FAINT, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {isLeader && <Trophy size={13} color={GOLD_DK} aria-hidden />}{position}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <TeamLogo name={row.clubName} src={row.logoUrl ?? undefined} size={34} />
                  <span style={{ minWidth: 0 }}>
                    <span className="font-display" style={{ display: 'block', fontSize: 16.5, lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.clubName.toUpperCase()}</span>
                    <span className="font-condensed" style={{ display: 'flex', gap: 8, color: MUTE, fontSize: 11, marginTop: 2, alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                      {ranked && <span>#{ranked.rank} nationally</span>}
                      {ranked && <Move delta={ranked.rankMovement ?? 0} size={10.5} />}
                      {streak >= 3 && <span style={{ color: UP, fontWeight: 800 }} title={`${streak}-game winning streak`}>{streak}W</span>}
                      {isLast && <span style={{ color: FAINT }}>Last place</span>}
                    </span>
                  </span>
                </span>
                <span className="hide-sm" style={{ textAlign: 'center', color: MUTE, fontSize: 13 }}>{row.played}</span>
                <span className="hide-sm font-display" style={{ textAlign: 'center', fontSize: 15.5 }}>{row.wins}</span>
                <span className="hide-sm font-display" style={{ textAlign: 'center', fontSize: 15.5 }}>{row.losses}</span>
                <span className="hide-sm font-display" style={{ textAlign: 'center', fontSize: 15.5 }}>{row.draws}</span>
                <span className="hide-sm" style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: row.percentage >= 100 ? TEXT : MUTE }}>{row.percentage ? row.percentage.toFixed(0) : '·'}</span>
                <span className="hide-sm font-display" style={{ textAlign: 'right', fontSize: 15.5, color: ranked ? PINK : FAINT }}>{ranked ? `#${ranked.rank}` : '·'}</span>
                <span className="hide-sm" style={{ display: 'flex', justifyContent: 'center' }}>{ranked?.recentForm?.length ? <FormPips form={ranked.recentForm} /> : <span style={{ color: FAINT }}>·</span>}</span>
                <span className="font-display" style={{ textAlign: 'right', fontSize: 19, color: isLeader ? GOLD_DK : TEXT }}>{row.points}<small className="show-sm" style={{ display: 'none', color: MUTE, fontSize: 11, marginLeft: 6 }}>{row.wins}-{row.losses}{row.draws > 0 ? `-${row.draws}` : ''}</small></span>
              </button>
            )
          })}

          {canonicalLadder.length > 4 && (
            <div className="font-condensed" style={{ display: 'flex', gap: 18, padding: '11px clamp(12px, 2vw, 22px)', color: FAINT, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', flexWrap: 'wrap' }}>
              <span><span style={{ color: GOLD, marginRight: 5 }}>&#9679;</span>Leader</span>
              <span><span style={{ color: id.accent, marginRight: 5 }}>&#9679;</span>Top four · finals</span>
              <span>Form shows the last five results</span>
            </div>
          )}
        </div>
      </Reveal>
      <style>{`
        .lad-grid { grid-template-columns: 44px minmax(0,1fr) 40px 38px 38px 38px 52px 58px 118px 52px; }
        @media (max-width: 820px) { .lad-grid { grid-template-columns: 34px minmax(0,1fr) 64px; } .show-sm{display:inline!important} }
      `}</style>
    </Section>
  )
}

export function ClubRankingCards({ league, query, totalRanked }: { league: LeagueDetail; query: string; totalRanked?: number }) {
  const id = leagueAccent(league.name)
  const canonicalLadder = normaliseLeagueLadder(league.ladder)
  const positionByClub = new Map(canonicalLadder.map(row => [row.clubId, row.position]))
  const q = query.trim().toLowerCase()
  const teams = league.rankedTeams.filter(team => !q || team.clubName.toLowerCase().includes(q))

  return (
    <Section id="clubs" band>
      <SectionHead
        kicker="On the national ladder"
        title={<>CLUB <span style={{ color: id.accent }}>RANKINGS</span></>}
        sub={`Where every ${league.name} club stands in Australia${totalRanked ? ` among ${totalRanked} ranked clubs` : ''}.`}
        to="/rankings" toLabel="Full rankings"
      />
      {teams.length === 0 && (
        <div className="gn-card" style={{ padding: 30 }}>
          <span className="font-condensed" style={{ color: MUTE, fontSize: 13 }}>
            {q ? `No ranked clubs matching "${query.trim()}".` : 'Clubs from this league enter the national rankings once results are recorded.'}
          </span>
        </div>
      )}
      {teams.length > 0 && <RankedClubTable teams={teams} posByClub={positionByClub} />}
      <div className="crc-grid" style={{ display: 'grid', gap: 14 }}>
        {teams.map((team, index) => (
          <Reveal key={team.clubId} delay={Math.min(index, 6) * 0.04}>
            <ClubCard t={team} ladderPos={positionByClub.get(team.clubId) ?? null} accent={id.accent} />
          </Reveal>
        ))}
      </div>
      <style>{`
        .crc-grid { display:none!important; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
        .ranked-table-wrap{overflow:auto}.ranked-table{width:100%;min-width:760px;border-collapse:separate;border-spacing:0;overflow:hidden}.ranked-table th{background:#062a5f;color:#fff;text-align:left;padding:12px 14px;font-size:10.5px;text-transform:uppercase;letter-spacing:.14em}.ranked-table td{padding:13px 14px;border-bottom:1px solid ${LINE};vertical-align:middle}.ranked-table tr.top25{background:linear-gradient(90deg,rgba(215,25,32,.07),transparent 42%)}.ranked-club-cell{display:flex;align-items:center;gap:10px;min-width:0}.ranked-club-cell span{min-width:0}.ranked-club-cell b,.ranked-club-cell small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ranked-club-cell small{color:${MUTE};font-size:11px}.ranked-rank{font-size:23px;color:${PINK};font-weight:950;letter-spacing:-.06em}.ranked-rating{font-size:20px;color:${TEXT};font-weight:950}.ranked-table a{color:inherit;text-decoration:none}
        @media (max-width: 760px) { .ranked-table-wrap{display:none}.crc-grid { display:grid!important; } }
      `}</style>
    </Section>
  )
}

function RankedClubTable({ teams, posByClub }: { teams: LeagueRankedTeam[]; posByClub: Map<string, number | null> }) {
  return (
    <Reveal>
      <div className="gn-card ranked-table-wrap" style={{ overflow: 'hidden' }}>
        <table className="ranked-table">
          <thead><tr><th>National Rank</th><th>Move</th><th>Club</th><th>Rating</th><th>Ladder</th><th>Form</th></tr></thead>
          <tbody>{teams.map(team => (
            <tr key={team.clubId} className={team.rank <= 25 ? 'top25' : ''}>
              <td><Link to={teamPath(team.clubId)} className="ranked-rank">#{team.rank}</Link></td>
              <td><Move delta={team.rankMovement ?? 0} /></td>
              <td><Link to={teamPath(team.clubId)} className="ranked-club-cell"><TeamLogo name={team.clubName} size={38} /><span><b>{team.clubName}</b><small>{team.state}</small></span></Link></td>
              <td><span className="ranked-rating">{team.powerRating.toFixed(1)}</span></td>
              <td>{posByClub.get(team.clubId) != null ? ordinalPos(posByClub.get(team.clubId)!) : '—'}</td>
              <td>{team.recentForm && team.recentForm.length > 0 ? <FormPips form={team.recentForm as FormResult[]} /> : <span style={{ color: FAINT }}>—</span>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Reveal>
  )
}

function ClubCard({ t, ladderPos, accent }: { t: LeagueRankedTeam; ladderPos: number | null; accent: string }) {
  const podium = t.rank <= 3
  return (
    <Link to={teamPath(t.clubId)} className="gn-card gn-card-hover" aria-label={`${t.clubName}, ranked ${t.rank} nationally`}
      style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '18px 20px', textDecoration: 'none', color: TEXT, height: '100%', borderTop: `3px solid ${podium ? GOLD : accent}` }}>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span className="font-condensed" style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: podium ? GOLD_DK : FAINT, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {podium && <Trophy size={12} aria-hidden />} National rank
        </span>
        <Move delta={t.rankMovement ?? 0} />
      </span>

      <span style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
        <TeamLogo name={t.clubName} size={46} />
        <span style={{ minWidth: 0 }}>
          <span className="font-display" style={{ display: 'block', fontSize: 20, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.clubName.toUpperCase()}</span>
          <span className="font-condensed" style={{ display: 'block', color: MUTE, fontSize: 11.5, marginTop: 3 }}>
            {ladderPos != null ? `${ordinalPos(ladderPos)} on the ladder · ` : ''}{t.state}
          </span>
        </span>
      </span>

      <span style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto', borderTop: `1px solid ${LINE}`, paddingTop: 11 }}>
        <span>
          <span className="font-display" style={{ display: 'block', fontSize: 30, lineHeight: 0.9, color: podium ? GOLD_DK : PINK }}>#{t.rank}</span>
          <span className="font-condensed" style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: FAINT }}>Rating {t.powerRating.toFixed(1)}</span>
        </span>
        {t.recentForm && t.recentForm.length > 0 && <FormPips form={t.recentForm as FormResult[]} />}
      </span>
    </Link>
  )
}

function ordinalPos(n: number) {
  const suffixes = ['th', 'st', 'nd', 'rd'], value = n % 100
  return n + (suffixes[(value - 20) % 10] ?? suffixes[value] ?? suffixes[0])
}

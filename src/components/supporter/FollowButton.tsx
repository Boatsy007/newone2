import { Bell, BellRing, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { listFollows, setFollow, type FollowEntity } from '../../lib/supporter'

export default function FollowButton({ entityType, entityId, compact = false }: { entityType: FollowEntity; entityId: string; compact?: boolean }) {
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    listFollows().then(rows => {
      if (active) setFollowing(rows.some(row => row.entityType === entityType && row.entityId === entityId))
    }).catch(() => { if (active) setError('Follow unavailable') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [entityId, entityType])

  const toggle = async () => {
    if (saving) return
    setSaving(true); setError('')
    try {
      await setFollow(entityType, entityId, !following)
      setFollowing(value => !value)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update follow') }
    finally { setSaving(false) }
  }

  return <div className={`pf-follow-wrap ${compact ? 'compact' : ''}`}>
    <button type="button" className={following ? 'following' : ''} onClick={toggle} disabled={loading || saving} aria-pressed={following}>
      {loading || saving ? <Loader2 size={17} className="spin" /> : following ? <BellRing size={17} /> : <Bell size={17} />}
      {following ? 'Following' : `Follow ${entityType.toLowerCase()}`}
    </button>
    {error && <small>{error}</small>}
    <style>{`
      .pf-follow-wrap{display:inline-flex;flex-direction:column;align-items:flex-start;gap:5px}.pf-follow-wrap button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #2daaf5;background:#2daaf5;color:#050505;border-radius:999px;padding:11px 17px;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:950;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;box-shadow:0 8px 20px rgba(45,170,245,.18)}.pf-follow-wrap button.following{background:#fff;color:#111318;border-color:#d7dee6;box-shadow:none}.pf-follow-wrap button:disabled{opacity:.68;cursor:wait}.pf-follow-wrap small{color:#d71920;font-size:10px;font-weight:800}.pf-follow-wrap.compact button{padding:9px 13px;font-size:11px}.pf-follow-wrap .spin{animation:pf-spin .8s linear infinite}@keyframes pf-spin{to{transform:rotate(360deg)}}
    `}</style>
  </div>
}

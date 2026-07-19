import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const REVIEW_HEADINGS = ['Action', 'Player name', 'Extracted club', 'Matched club', 'Existing player record', 'Goals', 'Matches', 'Confidence', 'Warning']

export default function GoalKickerReviewEnhancer() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (pathname !== '/admin/goal-kicker-images') return

    let scheduled = false
    const enhance = () => {
      scheduled = false
      for (const table of document.querySelectorAll<HTMLTableElement>('table')) {
        const headings = Array.from(table.querySelectorAll('thead th')).map(cell => cell.textContent?.trim() ?? '')
        if (!REVIEW_HEADINGS.every((heading, index) => headings[index] === heading)) continue
        enhanceTable(table)
      }
    }
    const schedule = () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(enhance)
    }

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('input', schedule, true)
    document.addEventListener('change', schedule, true)
    schedule()

    return () => {
      observer.disconnect()
      document.removeEventListener('input', schedule, true)
      document.removeEventListener('change', schedule, true)
    }
  }, [pathname])

  if (pathname !== '/admin/goal-kicker-images') return null
  return <style>{styles}</style>
}

function enhanceTable(table: HTMLTableElement) {
  table.classList.add('gk-review-table')
  const section = table.closest<HTMLElement>('section')
  if (!section) return
  section.classList.add('gk-review-section')

  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr'))
  let updating = 0
  let creating = 0
  let unchanged = 0
  let older = 0
  let skipped = 0
  let unresolved = 0
  let lowConfidence = 0

  rows.forEach((row, rowIndex) => {
    const cells = Array.from(row.cells)
    if (cells.length < 9) return
    cells.forEach((cell, index) => {
      const label = REVIEW_HEADINGS[index] ?? ''
      if (cell.dataset.label !== label) cell.dataset.label = label
    })

    const decision = cells[0].querySelector<HTMLSelectElement>('select')
    const player = cells[1].querySelector<HTMLInputElement>('input')
    const club = cells[2].querySelector<HTMLInputElement>('input')
    const clubMatch = cells[3].querySelector<HTMLSelectElement>('select')
    const goals = cells[5].querySelector<HTMLInputElement>('input')
    const confidence = Number.parseInt(cells[7].textContent ?? '', 10)

    if (row.dataset.originalExistingText == null) row.dataset.originalExistingText = cells[4].textContent?.trim() ?? ''
    if (row.dataset.existingGoals == null) {
      const match = cells[8].textContent?.match(/existing\s+(\d+)\s+goals/i)
      row.dataset.existingGoals = match ? match[1] : ''
    }
    const existingText = row.dataset.originalExistingText ?? ''
    const existingGoals = row.dataset.existingGoals ? Number(row.dataset.existingGoals) : null
    const proposedGoals = Number(goals?.value)
    const active = decision?.value !== 'skip'
    const invalid = active && (!player?.value.trim() || !club?.value.trim() || !clubMatch?.value || !Number.isFinite(proposedGoals) || proposedGoals < 0)
    const low = active && Number.isFinite(confidence) && confidence < 80

    row.classList.toggle('is-skipped', !active)
    row.classList.toggle('is-invalid', invalid)
    row.classList.toggle('is-low-confidence', low)
    if (row.dataset.reviewRow !== String(rowIndex + 1)) row.dataset.reviewRow = String(rowIndex + 1)

    if (!active) skipped++
    else {
      if (invalid) unresolved++
      if (low) lowConfidence++
      if (existingGoals == null || existingText === 'New record') creating++
      else if (proposedGoals < existingGoals) older++
      else if (proposedGoals === existingGoals) unchanged++
      else updating++
    }

    if (existingGoals != null && Number.isFinite(proposedGoals)) {
      const comparison = `<strong>${escapeHtml(String(existingGoals))} → ${escapeHtml(String(proposedGoals))} goals</strong><small>${escapeHtml(existingText)}</small>`
      if (cells[4].innerHTML !== comparison) cells[4].innerHTML = comparison
    }

    const messages: string[] = []
    if (!active) messages.push('Skipped — this row will not be imported')
    else {
      if (!clubMatch?.value) messages.push('Choose the correct matched club')
      if (!player?.value.trim()) messages.push('Player name is required')
      if (!club?.value.trim()) messages.push('Extracted club is required')
      if (!Number.isFinite(proposedGoals) || proposedGoals < 0) messages.push('Enter a valid goal total')
      if (low) messages.push(`Low club-match confidence (${confidence}%) — check this row`)
      if (existingGoals != null && proposedGoals < existingGoals) messages.push(`Older total: ${proposedGoals} will be ignored; current total is ${existingGoals}`)
      else if (existingGoals != null && proposedGoals === existingGoals) messages.push('No change — this total is already saved')
      else if (existingGoals != null) messages.push(`Will update ${existingGoals} → ${proposedGoals} goals`)
      else messages.push('Will create a new player record')
    }
    const warningText = messages.join(' · ')
    if (cells[8].textContent !== warningText) cells[8].textContent = warningText

    let actions = cells[0].querySelector<HTMLElement>('.gk-quick-actions')
    if (!actions && decision) {
      actions = document.createElement('div')
      actions.className = 'gk-quick-actions'
      const importButton = document.createElement('button')
      importButton.type = 'button'
      importButton.textContent = 'Import'
      const skipButton = document.createElement('button')
      skipButton.type = 'button'
      skipButton.textContent = 'Skip'
      const setDecision = (value: 'import' | 'skip') => {
        decision.value = value
        decision.dispatchEvent(new Event('change', { bubbles: true }))
      }
      importButton.addEventListener('click', () => setDecision('import'))
      skipButton.addEventListener('click', () => setDecision('skip'))
      actions.append(importButton, skipButton)
      cells[0].append(actions)
    }
    actions?.querySelectorAll('button').forEach((actionButton, index) => actionButton.classList.toggle('active', index === (active ? 0 : 1)))
  })

  let summary = section.querySelector<HTMLElement>('.gk-review-summary')
  if (!summary) {
    summary = document.createElement('div')
    summary.className = 'gk-review-summary'
    section.querySelector('header')?.insertAdjacentElement('afterend', summary)
  }
  const summaryHtml = [
    stat('Updating', updating), stat('New players', creating), stat('Unchanged', unchanged),
    stat('Older ignored', older), stat('Skipped', skipped), stat('Needs fixing', unresolved), stat('Low confidence', lowConfidence),
  ].join('')
  if (summary.innerHTML !== summaryHtml) summary.innerHTML = summaryHtml
  summary.classList.toggle('has-errors', unresolved > 0)

  const approve = section.querySelector<HTMLButtonElement>('header button')
  if (approve && !approve.textContent?.includes('Updated')) {
    if (!approve.dataset.originalLabel) approve.dataset.originalLabel = approve.textContent?.trim() ?? 'Approve & update'
    approve.disabled = unresolved > 0
    approve.dataset.reviewBlocked = unresolved > 0 ? 'true' : 'false'
    approve.title = unresolved > 0 ? `Fix ${unresolved} included row${unresolved === 1 ? '' : 's'} before approval.` : ''
    const nextLabel = unresolved > 0 ? `Fix ${unresolved} row${unresolved === 1 ? '' : 's'} before approval` : approve.dataset.originalLabel
    if (approve.textContent !== nextLabel) approve.textContent = nextLabel
  }
}

function stat(label: string, value: number) {
  return `<div><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character)
}

const styles = `
.gk-review-summary{display:grid;grid-template-columns:repeat(7,minmax(90px,1fr));gap:8px;padding:12px 16px;background:#f5f8fb;border-top:1px solid #e3e8ee;border-bottom:1px solid #e3e8ee}.gk-review-summary>div{background:#fff;border:1px solid #dce3eb;border-radius:10px;padding:10px;text-align:center}.gk-review-summary strong,.gk-review-summary span{display:block}.gk-review-summary strong{font-size:21px}.gk-review-summary span{font-size:10px;text-transform:uppercase;font-weight:900;color:#687385;letter-spacing:.05em}.gk-review-summary.has-errors>div:nth-last-child(2){border-color:#e45555;background:#fff2f2;color:#9f1c1c}.gk-review-table td{padding:9px;border-bottom:1px solid #edf0f3;vertical-align:top}.gk-review-table tr.is-invalid{background:#fff1f1}.gk-review-table tr.is-low-confidence:not(.is-invalid){background:#fff9df}.gk-review-table tr.is-skipped{opacity:.5}.gk-review-table td:nth-child(5) strong,.gk-review-table td:nth-child(5) small{display:block}.gk-review-table td:nth-child(5) small{margin-top:4px;color:#687385}.gk-review-table td:nth-child(9){min-width:210px;font-size:12px;font-weight:700;color:#687385}.gk-review-table tr.is-invalid td:nth-child(9){color:#a11d1d}.gk-review-table tr.is-low-confidence td:nth-child(9){color:#7b5d00}.gk-quick-actions{display:none;gap:6px;margin-top:7px}.gk-quick-actions button{border:1px solid #cfd7e1;background:#fff;border-radius:8px;padding:8px 10px;font-weight:900}.gk-quick-actions button.active{background:#050505;color:#fff;border-color:#050505}.gk-review-section header button[data-review-blocked="true"]{background:#c7cdd4!important;color:#5d6670!important;cursor:not-allowed!important}
@media(max-width:760px){.gk-review-section{overflow:visible!important}.gk-review-section header{align-items:flex-start!important;flex-direction:column!important}.gk-review-section header button{width:100%;min-height:48px}.gk-review-summary{grid-template-columns:repeat(2,minmax(0,1fr));padding:12px}.gk-review-table{min-width:0!important;display:block}.gk-review-table thead{display:none}.gk-review-table tbody{display:grid;gap:12px;padding:12px;background:#eef2f6}.gk-review-table tr{display:block;background:#fff;border:1px solid #dce3eb;border-radius:14px;padding:8px;box-shadow:0 4px 12px rgba(17,24,39,.04)}.gk-review-table tr.is-invalid{border-color:#e45555;background:#fff5f5}.gk-review-table tr.is-low-confidence:not(.is-invalid){border-color:#dfbd42;background:#fffbed}.gk-review-table td{display:grid;grid-template-columns:105px minmax(0,1fr);gap:10px;align-items:center;border-bottom:1px solid #edf0f3;padding:10px 7px}.gk-review-table td:last-child{border-bottom:0}.gk-review-table td:before{content:attr(data-label);font-size:10px;text-transform:uppercase;font-weight:900;letter-spacing:.05em;color:#687385}.gk-review-table td:nth-child(1) select{display:none}.gk-quick-actions{display:flex}.gk-review-table input,.gk-review-table select{min-width:0!important;font-size:16px!important}.gk-review-table td:nth-child(9){min-width:0}.gk-review-table tr.is-skipped{opacity:.62}}
`

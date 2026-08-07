from pathlib import Path

path = Path('src/pages/CoachAppTrainingPlan.tsx')
text = path.read_text()

state_anchor = " const[view,setView]=useState<'PLAN'|'LIBRARY'>('PLAN'),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')\n"
state_replacement = state_anchor + " const[openFocusGroup,setOpenFocusGroup]=useState<string>('')\n"
if "openFocusGroup" not in text:
    if state_anchor not in text:
        raise SystemExit('state anchor not found')
    text = text.replace(state_anchor, state_replacement, 1)

old = """   <section className=\"catp-focus\"><div className=\"catp-focus-head\"><div><span>Main focus</span><h2>What are we working on?</h2><p>Tap every focus that applies. Choose as many as needed.</p></div><b>{selectedFocus.size} selected</b></div><div className=\"catp-focus-groups\">{focusGroups.map(group=><section key={group.label}><h3>{group.label}</h3><div>{group.options.map(option=><button type=\"button\" key={option} className={selectedFocus.has(option)?'active':''} aria-pressed={selectedFocus.has(option)} onClick={()=>toggleFocus(option)}>{selectedFocus.has(option)?'✓ ':''}{option}</button>)}</div></section>)}</div>{selectedFocus.size>0&&<div className=\"catp-focus-clear\"><span>{Array.from(selectedFocus).join(' · ')}</span><button type=\"button\" onClick={()=>setFocus('')}>Clear all</button></div>}</section>\n   <section className=\"catp-meta catp-meta-after-focus\"></section>"""
new = """   <section className=\"catp-focus\"><div className=\"catp-focus-head\"><div><span>Main focus</span><h2>What are we working on?</h2><p>Open a category, then tap every option that applies.</p></div><b>{selectedFocus.size} selected</b></div><div className=\"catp-focus-accordion\">{focusGroups.map(group=>{const open=openFocusGroup===group.label;const selectedCount=group.options.filter(option=>selectedFocus.has(option)).length;return <section key={group.label} className={open?'open':''}><button type=\"button\" className=\"catp-focus-toggle\" onClick={()=>setOpenFocusGroup(current=>current===group.label?'':group.label)} aria-expanded={open}><span><strong>{group.label}</strong><small>{selectedCount?`${selectedCount} selected`:'Tap to choose'}</small></span><b>{selectedCount||''}</b>{open?<ChevronUp/>:<ChevronDown/>}</button>{open&&<div className=\"catp-focus-options\">{group.options.map(option=><button type=\"button\" key={option} className={selectedFocus.has(option)?'active':''} aria-pressed={selectedFocus.has(option)} onClick={()=>toggleFocus(option)}>{selectedFocus.has(option)?'✓ ':''}{option}</button>)}</div>}</section>})}</div>{selectedFocus.size>0&&<div className=\"catp-focus-clear\"><span>{Array.from(selectedFocus).join(' · ')}</span><button type=\"button\" onClick={()=>setFocus('')}>Clear all</button></div>}</section>"""
if old not in text:
    raise SystemExit('focus markup anchor not found')
text = text.replace(old, new, 1)

css = """
.catp-focus{margin-top:11px;padding:14px;border:1px solid #d5e0e7;border-radius:16px;background:#fff}.catp-focus-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.catp-focus-head span{color:#168fcb;font-size:10px;font-weight:950;letter-spacing:.12em;text-transform:uppercase}.catp-focus-head h2{margin:3px 0 2px;font-size:28px}.catp-focus-head p{margin:0;color:#71808a}.catp-focus-head>b{white-space:nowrap;border-radius:999px;background:#e5f4fc;padding:7px 10px;color:#117db5;font-size:11px}.catp-focus-accordion{display:grid;gap:7px;margin-top:12px}.catp-focus-accordion>section{overflow:hidden;border:1px solid #d9e3e9;border-radius:12px;background:#f8fafb}.catp-focus-accordion>section.open{border-color:#35aee8;background:#fff}.catp-focus-toggle{display:grid;grid-template-columns:minmax(0,1fr) auto 22px;align-items:center;gap:9px;width:100%;min-height:58px;border:0;background:transparent;padding:10px 12px;text-align:left}.catp-focus-toggle span,.catp-focus-toggle strong,.catp-focus-toggle small{display:block}.catp-focus-toggle strong{font-size:15px}.catp-focus-toggle small{margin-top:3px;color:#758590;font-size:10px;font-weight:800}.catp-focus-toggle>b{display:grid;place-items:center;min-width:25px;height:25px;border-radius:999px;background:#dff5e9;color:#087343;font-size:11px}.catp-focus-toggle>b:empty{display:none}.catp-focus-toggle svg{width:20px;color:#52636e}.catp-focus-options{display:flex;flex-wrap:wrap;gap:7px;padding:0 12px 12px}.catp-focus-options button{min-height:39px;border:1px solid #ccd9e1;border-radius:999px;background:#fff;padding:0 12px;color:#26343d;font-weight:850}.catp-focus-options button.active{border-color:#16b966;background:#dff8e9;color:#075d36;box-shadow:inset 0 0 0 1px #16b966}.catp-focus-clear{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:11px;padding-top:11px;border-top:1px solid #e2e8ec}.catp-focus-clear span{overflow:hidden;color:#5f707b;font-size:11px;white-space:nowrap;text-overflow:ellipsis}.catp-focus-clear button{flex:0 0 auto;border:0;border-radius:8px;background:#edf2f5;padding:8px 10px;font-weight:900}@media(max-width:540px){.catp-focus-head h2{font-size:24px}.catp-focus-head p{font-size:12px}.catp-focus-options button{min-height:42px}.catp-focus-clear span{display:none}}
"""
if css.strip() not in text:
    marker = "\n`"
    if marker not in text:
        raise SystemExit('style closing marker not found')
    text = text.replace(marker, css + marker, 1)

path.write_text(text)

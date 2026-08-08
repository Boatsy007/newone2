from pathlib import Path
import re

p=Path('src/pages/CoachAppWhiteboardStage2.tsx')
s=p.read_text()

if "type DialogKind=" not in s:
    s=s.replace("type Props={clubId:string;sheetId:string;token:string;fixtureLabel:string;returnToMatch:boolean;onExit:()=>void}", "type Props={clubId:string;sheetId:string;token:string;fixtureLabel:string;returnToMatch:boolean;onExit:()=>void}\ntype DialogKind='CLEAR'|'RENAME_FRAME'|'DELETE_FRAME'|'SAVE_PLAY'|'GENERIC'|'SMART_SETUP'|'OUTCOME'\ntype UiDialog={kind:DialogKind;team?:'US'|'THEM'}|null\ntype ToastState={message:string;tone:'SUCCESS'|'ERROR'|'INFO'}|null")

state_marker="  const[moreOpen,setMoreOpen]=useState(false)"
if "const[uiDialog,setUiDialog]" not in s:
    s=s.replace(state_marker, state_marker+"\n  const[uiDialog,setUiDialog]=useState<UiDialog>(null)\n  const[dialogValue,setDialogValue]=useState('')\n  const[dialogSecondary,setDialogSecondary]=useState('')\n  const[toast,setToast]=useState<ToastState>(null)\n  const[resultPanel,setResultPanel]=useState<{title:string;body:string}|null>(null)")

hook_marker="  useEffect(()=>()=>{if(timerRef.current)window.clearTimeout(timerRef.current)},[])"
if "if(!toast)return" not in s:
    s=s.replace(hook_marker, hook_marker+"\n  useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(null),2600);return()=>window.clearTimeout(id)},[toast])")

helper_marker="  function snapshot(){setUndo(current=>[...current.slice(-39),clonePlay(play)]);setRedo([])}"
if "function notify(" not in s:
    helper="""  function notify(message:string,tone:ToastState extends infer T?never:never){}
"""
    # Avoid conditional-type oddity; insert real helper directly.
    helper="""  function notify(message:string,tone:'SUCCESS'|'ERROR'|'INFO'='INFO'){setToast({message,tone})}
  function openDialog(kind:DialogKind,value='',secondary='',team?:'US'|'THEM'){setDialogValue(value);setDialogSecondary(secondary);setUiDialog({kind,team})}
  function closeDialog(){setUiDialog(null);setDialogValue('');setDialogSecondary('')}
  async function submitDialog(){
    if(!uiDialog)return
    const value=dialogValue.trim()
    if(uiDialog.kind==='CLEAR'){updateState({magnets:[],strokes:[]});notify('Frame cleared','SUCCESS');closeDialog();return}
    if(uiDialog.kind==='RENAME_FRAME'){if(!value)return; snapshot();setPlay(current=>({...current,frames:current.frames.map(frame=>frame.id===current.activeFrameId?{...frame,name:value}:frame)}));notify('Frame renamed','SUCCESS');closeDialog();return}
    if(uiDialog.kind==='DELETE_FRAME'){if(play.frames.length===1)return; snapshot();setPlay(current=>{const index=current.frames.findIndex(frame=>frame.id===current.activeFrameId);const frames=current.frames.filter(frame=>frame.id!==current.activeFrameId);return{...current,frames,activeFrameId:frames[Math.max(0,index-1)].id}});notify('Frame deleted','SUCCESS');closeDialog();return}
    if(uiDialog.kind==='SAVE_PLAY'){if(!value)return;const item:SavedPlay={id:crypto.randomUUID(),name:value,fixtureLabel,savedAt:new Date().toISOString(),play:clonePlay(play)};const next=[item,...saved];setSaved(next);localStorage.setItem(libraryKey,JSON.stringify(next));setLibraryOpen(true);notify('Tactic saved locally','SUCCESS');closeDialog();return}
    if(uiDialog.kind==='GENERIC'){if(!value||!uiDialog.team)return;const parsed=dialogSecondary.trim()?Number(dialogSecondary):null;togglePlayer({id:`generic-${uiDialog.team.toLowerCase()}-${crypto.randomUUID()}`,name:value,number:typeof parsed==='number'&&Number.isFinite(parsed)?parsed:null,team:uiDialog.team});notify('Player added to this frame','SUCCESS');closeDialog();return}
    if(uiDialog.kind==='SMART_SETUP'){
      const focus=(value||'BALANCED').toUpperCase();closeDialog()
      try{const r=await fetch(`/api/whiteboard-intelligence/clubs/${encodeURIComponent(clubId)}/generate`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({frame:activeFrame,focus,fixtureLabel})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to generate setup');snapshot();const frame=j.data.frame as Frame;setPlay(current=>({...current,frames:[...current.frames,frame],activeFrameId:frame.id}));setResultPanel({title:'Smart setup created',body:`Structure score ${j.data.before.score} → ${j.data.after.score}. ${j.data.reason}`});notify('AI adjustment added as a new frame','SUCCESS')}catch(e){notify(e instanceof Error?e.message:'Unable to generate setup','ERROR')}return
    }
    if(uiDialog.kind==='OUTCOME'){
      const outcome=(value||'NEUTRAL').toUpperCase();const notes=dialogSecondary.trim();closeDialog();let stats:unknown={}
      try{const mr=await fetch(`/api/club-portal/match-day/clubs/${encodeURIComponent(clubId)}/sheets/${encodeURIComponent(sheetId)}`,{headers:{authorization:`Bearer ${token}`},cache:'no-store'});if(mr.ok){const mj=await mr.json() as SheetPayload;stats=mj.data?.state?.teamStats||{}}}catch{}
      try{const r=await fetch(`/api/whiteboard-intelligence/clubs/${encodeURIComponent(clubId)}/usage`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({playId:selectedCloudId,fixtureLabel,frameId:activeFrame.id,outcome,notes,afterStats:stats})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to record outcome');notify('Tactic outcome saved for review','SUCCESS')}catch(e){notify(e instanceof Error?e.message:'Unable to record outcome','ERROR')}return
    }
  }
"""
    s=s.replace(helper_marker, helper+helper_marker)

replacements={
"  function clearBoard(){if(!confirm('Clear this tactical frame?'))return;updateState({magnets:[],strokes:[]})}":"  function clearBoard(){openDialog('CLEAR')}",
"  function addGeneric(team:'US'|'THEM'){\n    const label=prompt(team==='US'?'Player name':'Opponent name',team==='US'?'Player':'Opponent')?.trim();if(!label)return\n    const numberText=prompt('Number (optional)','')||'';const parsed=numberText.trim()?Number(numberText):null\n    togglePlayer({id:`generic-${team.toLowerCase()}-${crypto.randomUUID()}`,name:label,number:typeof parsed==='number'&&Number.isFinite(parsed)?parsed:null,team})\n  }":"  function addGeneric(team:'US'|'THEM'){openDialog('GENERIC',team==='US'?'Player':'Opponent','',team)}",
"  function renameFrame(){const name=prompt('Frame name',activeFrame.name)?.trim();if(!name)return;snapshot();setPlay(current=>({...current,frames:current.frames.map(frame=>frame.id===current.activeFrameId?{...frame,name}:frame)}))}":"  function renameFrame(){openDialog('RENAME_FRAME',activeFrame.name)}",
"  function deleteFrame(){if(play.frames.length===1)return;if(!confirm(`Delete ${activeFrame.name}?`))return;snapshot();setPlay(current=>{const index=current.frames.findIndex(frame=>frame.id===current.activeFrameId);const frames=current.frames.filter(frame=>frame.id!==current.activeFrameId);return{...current,frames,activeFrameId:frames[Math.max(0,index-1)].id}})}":"  function deleteFrame(){if(play.frames.length===1){notify('A play must keep at least one frame','INFO');return}openDialog('DELETE_FRAME')}",
"  function savePlay(){const name=prompt('Name this animated tactic',`Animated play ${saved.length+1}`)?.trim();if(!name)return;const item:SavedPlay={id:crypto.randomUUID(),name,fixtureLabel,savedAt:new Date().toISOString(),play:clonePlay(play)};const next=[item,...saved];setSaved(next);localStorage.setItem(libraryKey,JSON.stringify(next));setLibraryOpen(true)}":"  function savePlay(){openDialog('SAVE_PLAY',`Animated play ${saved.length+1}`)}",
}
for old,new in replacements.items():
    if old not in s: raise SystemExit('missing replacement target: '+old[:70])
    s=s.replace(old,new)

# Replace Smart Setup and Outcome implementations while retaining button bindings.
s,n=re.subn(r"  async function smartSetup\(\)\{.*?\n  \}\n  async function compareFrames", "  async function smartSetup(){openDialog('SMART_SETUP','BALANCED')}\n  async function compareFrames", s, count=1, flags=re.S)
if n!=1: raise SystemExit('smartSetup function not found')
s,n=re.subn(r"  async function recordOutcome\(\)\{.*?\n  \}\n  async function tacticalReview", "  async function recordOutcome(){openDialog('OUTCOME','WORKED','')}\n  async function tacticalReview", s, count=1, flags=re.S)
if n!=1: raise SystemExit('recordOutcome function not found')

# Convert comparison/review alerts to branded result panels where the exact strings are present.
s=s.replace("alert(`${other.name}: ${j.data.a.score}/100\\n${activeFrame.name}: ${j.data.b.score}/100\\n\\n${j.data.summary}\\n\\nCurrent frame uncovered: ${(j.data.b.uncovered||[]).join(', ')||'None'}\\nCongestion pairs: ${j.data.b.congestion}`)", "setResultPanel({title:'Frame comparison',body:`${other.name}: ${j.data.a.score}/100\\n${activeFrame.name}: ${j.data.b.score}/100\\n\\n${j.data.summary}\\n\\nCurrent frame uncovered: ${(j.data.b.uncovered||[]).join(', ')||'None'}\\nCongestion pairs: ${j.data.b.congestion}`})")
s=s.replace("alert(`TACTICAL REVIEW\\n\\nUsed: ${x.total}\\nWorked: ${x.improved}\\nNeutral: ${x.neutral}\\nFailed: ${x.declined}\\n\\n${recent||'No tactics have been rated yet.'}`)", "setResultPanel({title:'Tactical review',body:`Used: ${x.total}\\nWorked: ${x.improved}\\nNeutral: ${x.neutral}\\nFailed: ${x.declined}\\n\\n${recent||'No tactics have been rated yet.'}`})")

modal_marker="    {moreOpen&&!presenting&&"
if "className=\"wb-native-dialog\"" not in s:
    modal="""    {toast&&<div className={`wb-toast ${toast.tone.toLowerCase()}`} role="status">{toast.message}</div>}
    {resultPanel&&<div className="cawb2-modal"><section className="wb-result-panel"><header><div><span>PLAYFOOTY WHITEBOARD</span><h2>{resultPanel.title}</h2></div><button onClick={()=>setResultPanel(null)}><X/></button></header><pre>{resultPanel.body}</pre><div className="wb-dialog-actions"><button className="primary" onClick={()=>setResultPanel(null)}>Done</button></div></section></div>}
    {uiDialog&&<div className="cawb2-modal"><section className="wb-native-dialog"><header><div><span>PLAYFOOTY WHITEBOARD</span><h2>{uiDialog.kind==='CLEAR'?'Clear this frame?':uiDialog.kind==='RENAME_FRAME'?'Rename frame':uiDialog.kind==='DELETE_FRAME'?'Delete frame?':uiDialog.kind==='SAVE_PLAY'?'Save tactic':uiDialog.kind==='GENERIC'?'Add player':uiDialog.kind==='SMART_SETUP'?'Smart Setup':'Record outcome'}</h2><p>{uiDialog.kind==='CLEAR'?'Players and drawings will be removed from this frame only.':uiDialog.kind==='DELETE_FRAME'?`${activeFrame.name} will be removed from this play.`:uiDialog.kind==='SMART_SETUP'?'Choose the structure you want the AI to prioritise.':uiDialog.kind==='OUTCOME'?'Record what happened when this tactic was used.':'Complete the details below.'}</p></div><button onClick={closeDialog}><X/></button></header>{!['CLEAR','DELETE_FRAME'].includes(uiDialog.kind)&&<div className="wb-dialog-fields">{uiDialog.kind==='SMART_SETUP'?<div className="wb-choice-grid">{['BALANCED','ATTACK','DEFENCE','WIDTH'].map(option=><button key={option} className={dialogValue===option?'active':''} onClick={()=>setDialogValue(option)}>{option}</button>)}</div>:uiDialog.kind==='OUTCOME'?<><div className="wb-choice-grid">{['WORKED','NEUTRAL','FAILED'].map(option=><button key={option} className={dialogValue===option?'active':''} onClick={()=>setDialogValue(option)}>{option}</button>)}</div><label>Coaching notes<textarea value={dialogSecondary} onChange={event=>setDialogSecondary(event.target.value)} placeholder="What happened when the tactic was used?"/></label></>:<><label>{uiDialog.kind==='GENERIC'?'Name':uiDialog.kind==='RENAME_FRAME'?'Frame name':'Tactic name'}<input autoFocus value={dialogValue} onChange={event=>setDialogValue(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')void submitDialog()}}/></label>{uiDialog.kind==='GENERIC'&&<label>Number <span>(optional)</span><input inputMode="numeric" value={dialogSecondary} onChange={event=>setDialogSecondary(event.target.value)} placeholder="e.g. 23"/></label>}</>}</div>}<div className="wb-dialog-actions"><button onClick={closeDialog}>Cancel</button><button className={uiDialog.kind==='DELETE_FRAME'||uiDialog.kind==='CLEAR'?'danger':'primary'} onClick={()=>void submitDialog()}>{uiDialog.kind==='CLEAR'?'Clear frame':uiDialog.kind==='DELETE_FRAME'?'Delete frame':uiDialog.kind==='SMART_SETUP'?'Create setup':uiDialog.kind==='OUTCOME'?'Save outcome':'Save'}</button></div></section></div>}
"""
    if modal_marker not in s: raise SystemExit('modal insertion marker missing')
    s=s.replace(modal_marker,modal+modal_marker,1)

idx=s.rfind('`')
if idx<0: raise SystemExit('style terminator missing')
css="""
/* Stage 8 Priority 2 — native dialogs and notifications */
.wb-native-dialog,.wb-result-panel{width:min(560px,92vw);max-height:88dvh;overflow:auto;background:#071923;border:1px solid #31505f;border-radius:22px;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.55)}
.wb-native-dialog header,.wb-result-panel header{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:16px!important;border:0!important;padding:0 0 14px!important;background:transparent!important}.wb-native-dialog header div,.wb-result-panel header div{display:block!important}.wb-native-dialog header span,.wb-result-panel header span{color:#20b8ff;font-size:10px;font-weight:900;letter-spacing:.12em}.wb-native-dialog h2,.wb-result-panel h2{margin:4px 0 5px;font-size:22px}.wb-native-dialog p{margin:0;color:#9fb5c2;line-height:1.45}.wb-native-dialog header>button,.wb-result-panel header>button{width:44px;height:44px;padding:0;justify-content:center;flex:0 0 auto}
.wb-dialog-fields{display:grid;gap:14px;padding:8px 0}.wb-dialog-fields label{display:grid;gap:7px;font-size:12px;font-weight:900;color:#d9e8ef}.wb-dialog-fields label span{font-weight:500;color:#8ca9b7}.wb-dialog-fields input,.wb-dialog-fields textarea{width:100%;box-sizing:border-box;border:1px solid #31505f;background:#0b2532;color:#fff;border-radius:12px;padding:12px 13px;font:inherit;outline:none}.wb-dialog-fields input:focus,.wb-dialog-fields textarea:focus{border-color:#20b8ff;box-shadow:0 0 0 3px rgba(32,184,255,.14)}.wb-dialog-fields textarea{min-height:110px;resize:vertical}
.wb-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.wb-choice-grid button{min-height:50px;border:1px solid #31505f;background:#0b2532;color:#fff;border-radius:12px;font-weight:900}.wb-choice-grid button.active{background:#109ee8;border-color:#53c8ff;box-shadow:0 0 0 3px rgba(32,184,255,.14)}
.wb-dialog-actions{display:flex;justify-content:flex-end;gap:9px;padding-top:15px;border-top:1px solid #173844}.wb-dialog-actions button{min-height:46px;border-radius:12px;padding:10px 16px;font-weight:900;border:1px solid #31505f;background:#0b2532;color:#fff}.wb-dialog-actions .primary{background:#109ee8;border-color:#20b8ff}.wb-dialog-actions .danger{background:#b32634;border-color:#e0535f}
.wb-result-panel pre{white-space:pre-wrap;font:600 14px/1.55 inherit;color:#d9e8ef;background:#0a202b;border:1px solid #244554;border-radius:14px;padding:14px;margin:0 0 15px}
.wb-toast{position:fixed;left:50%;bottom:112px;transform:translateX(-50%);z-index:250;max-width:min(520px,88vw);padding:12px 16px;border-radius:13px;background:#0b2532;border:1px solid #31505f;color:#fff;font-weight:850;box-shadow:0 14px 45px rgba(0,0,0,.45);animation:wbToastIn .18s ease-out}.wb-toast.success{border-color:#36b875;background:#0b3026}.wb-toast.error{border-color:#e0535f;background:#36151a}.wb-toast.info{border-color:#20b8ff}@keyframes wbToastIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}
@media(max-width:640px){.wb-choice-grid{grid-template-columns:1fr}.wb-dialog-actions button{flex:1}.wb-toast{bottom:104px}}
"""
s=s[:idx]+css+s[idx:]
p.write_text(s)

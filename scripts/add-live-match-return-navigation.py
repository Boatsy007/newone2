from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing expected {label}")
    return text.replace(old, new, 1)

coach_path = Path('src/pages/CoachApp.tsx')
coach = coach_path.read_text()
coach = replace_once(
    coach,
    "  const[screen,setScreen]=useState<Screen>('DASHBOARD')\n",
    "  const[screen,setScreen]=useState<Screen>(()=>new URLSearchParams(window.location.search).get('screen')==='match-day'?'MATCH_DAY':'DASHBOARD')\n  const[gamePlanFromMatch,setGamePlanFromMatch]=useState(false)\n",
    'Coach App screen state',
)
coach = replace_once(
    coach,
    "      setClubs([]);setContext(next);setScreen('DASHBOARD')\n",
    "      setClubs([]);setContext(next);setScreen(new URLSearchParams(window.location.search).get('screen')==='match-day'?'MATCH_DAY':'DASHBOARD')\n",
    'Coach App context destination',
)
coach = replace_once(
    coach,
    "{screen==='GAME_PLAN'?<CoachAppGamePlan clubId={context.club.id} clubName={context.club.name} token={session.access_token} fixture={context.fixture} onExit={()=>setScreen('DASHBOARD')} onContinue={()=>setScreen('MATCH_DAY')}/>",
    "{screen==='GAME_PLAN'?<CoachAppGamePlan clubId={context.club.id} clubName={context.club.name} token={session.access_token} fixture={context.fixture} returnToMatch={gamePlanFromMatch} onExit={()=>{setScreen(gamePlanFromMatch?'MATCH_DAY':'DASHBOARD');setGamePlanFromMatch(false)}} onContinue={()=>{setScreen('MATCH_DAY');setGamePlanFromMatch(false)}}/>",
    'Game Plan render',
)
coach = replace_once(
    coach,
    "onGamePlan={()=>setScreen('GAME_PLAN')} onWhiteboard={()=>navigate(`/club-portal/${encodeURIComponent(context.club.id)}/coaching?source=coach-app&section=whiteboard`)}",
    "onGamePlan={()=>{setGamePlanFromMatch(true);setScreen('GAME_PLAN')}} onWhiteboard={()=>navigate(`/club-portal/${encodeURIComponent(context.club.id)}/coaching?source=coach-app&section=whiteboard&returnToMatch=1`)}",
    'Match Day tool navigation',
)
coach_path.write_text(coach)

game_path = Path('src/pages/CoachAppGamePlan.tsx')
game = game_path.read_text()
game = replace_once(
    game,
    "type Props={clubId:string;clubName:string;token:string;fixture:{id:string;leagueId:string;season:string;grade:string;round:string|null;homeClubId:string|null;awayClubId:string|null;homeName:string;awayName:string;matchDate:string|null;venue:string|null}|null;onExit:()=>void;onContinue:()=>void}",
    "type Props={clubId:string;clubName:string;token:string;fixture:{id:string;leagueId:string;season:string;grade:string;round:string|null;homeClubId:string|null;awayClubId:string|null;homeName:string;awayName:string;matchDate:string|null;venue:string|null}|null;returnToMatch?:boolean;onExit:()=>void;onContinue:()=>void}",
    'Game Plan props',
)
game = replace_once(
    game,
    "export default function CoachAppGamePlan({clubId,clubName,token,fixture,onExit,onContinue}:Props){",
    "export default function CoachAppGamePlan({clubId,clubName,token,fixture,returnToMatch=false,onExit,onContinue}:Props){",
    'Game Plan function props',
)
game = replace_once(
    game,
    "<button onClick={onExit}><ArrowLeft/>Coach Tools</button>",
    "<button className={returnToMatch?'return-match':''} onClick={onExit}><ArrowLeft/>{returnToMatch?'Return to Match':'Coach Tools'}</button>",
    'Game Plan back button',
)
game = replace_once(
    game,
    ".cgp-top>button{display:flex;align-items:center;gap:7px;border:0;background:none;color:#fff;font-weight:900}",
    ".cgp-top>button{display:flex;align-items:center;gap:7px;border:0;background:none;color:#fff;font-weight:900}.cgp-top>button.return-match{padding:10px 13px;border-radius:10px;background:#22c77a;color:#06130c;box-shadow:0 3px 0 #0b7546}.cgp-top>button.return-match:active{transform:translateY(3px);box-shadow:none}",
    'Game Plan return button style',
)
game_path.write_text(game)

whiteboard_path = Path('src/pages/ClubPortalWhiteboard.tsx')
whiteboard = whiteboard_path.read_text()
whiteboard = replace_once(
    whiteboard,
    "import { Link, useParams } from 'react-router-dom'",
    "import { Link, useLocation, useParams } from 'react-router-dom'",
    'Whiteboard router imports',
)
whiteboard = replace_once(
    whiteboard,
    "export default function ClubPortalWhiteboard(){\n const{clubId=''}=useParams();",
    "export default function ClubPortalWhiteboard(){\n const location=useLocation();const returnToMatch=new URLSearchParams(location.search).get('returnToMatch')==='1';\n const{clubId=''}=useParams();",
    'Whiteboard return context',
)
# Add a persistent return control immediately inside the page's main JSX, without changing whiteboard tools.
marker = " return <"
index = whiteboard.find(marker)
if index < 0:
    raise SystemExit('Missing Whiteboard return JSX')
# Locate first opening element end after return and insert conditional link as its first child.
open_end = whiteboard.find('>', index + len(marker))
if open_end < 0:
    raise SystemExit('Missing Whiteboard root opening tag')
insert = "{returnToMatch&&<Link to=\"/coach-app?screen=match-day\" className=\"cpw-return-match\"><ArrowLeft/>Return to Match</Link>}"
whiteboard = whiteboard[:open_end+1] + insert + whiteboard[open_end+1:]
# Append standalone styling before final template-literal close.
style_marker = "\n`\n"
pos = whiteboard.rfind(style_marker)
if pos < 0:
    raise SystemExit('Missing Whiteboard styles close')
return_css = "\n.cpw-return-match{position:fixed;z-index:2200;top:max(12px,env(safe-area-inset-top));right:max(14px,env(safe-area-inset-right));display:flex;align-items:center;gap:7px;min-height:44px;padding:10px 15px;border-radius:11px;background:#22c77a;color:#06130c;text-decoration:none;font-weight:950;text-transform:uppercase;box-shadow:0 4px 0 #0b7546,0 8px 22px rgba(0,0,0,.3)}.cpw-return-match:active{transform:translateY(4px);box-shadow:0 0 0 #0b7546,0 3px 8px rgba(0,0,0,.2)}.cpw-return-match svg{width:18px;height:18px}\n"
whiteboard = whiteboard[:pos] + return_css + whiteboard[pos:]
whiteboard_path.write_text(whiteboard)

print('Connected Game Plan and Whiteboard return navigation to the live Match Day screen')

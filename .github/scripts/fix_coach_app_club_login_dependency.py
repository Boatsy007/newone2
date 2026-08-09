from pathlib import Path

p=Path('src/pages/CoachApp.tsx')
s=p.read_text()
old="""      if(next.fixture&&!next.teamSheet){
        const sheetResponse=await fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(next.club.id)}/sheets`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({fixtureId:next.fixture.id})})
        const sheetPayload=await sheetResponse.json().catch(()=>({}))
        if(!sheetResponse.ok)throw new Error(sheetPayload.error||'Unable to open team selection')
        next=await fetchContext(next.club.id)
        if(!next)return
      }
"""
new="""      if(next.fixture&&!next.teamSheet){
        try{
          const sheetResponse=await fetch(`/api/club-portal/team-sheets/clubs/${encodeURIComponent(next.club.id)}/sheets`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({fixtureId:next.fixture.id})})
          if(sheetResponse.ok){
            const refreshed=await fetchContext(next.club.id)
            if(refreshed)next=refreshed
          }
        }catch{
          // Team-sheet setup is not allowed to block access to an authorised club.
        }
      }
"""
if old not in s:
    raise SystemExit('automatic team sheet block not found')
s=s.replace(old,new,1)
old2="  function chooseClub(id:string){setClubId(id);localStorage.setItem(CLUB_KEY,id);void loadContext(id)}"
new2="  function chooseClub(id:string){setClubs([]);setContext(null);setClubId(id);localStorage.setItem(CLUB_KEY,id);void loadContext(id)}"
if old2 not in s:
    raise SystemExit('chooseClub function not found')
s=s.replace(old2,new2,1)
p.write_text(s)

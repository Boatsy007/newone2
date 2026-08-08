from pathlib import Path

path = Path('src/pages/CoachAppMatchDay.tsx')
text = path.read_text()

anchor = "  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}},[])\n"

injection = """  useEffect(()=>{\n    const removeLegacyStrip=()=>{\n      const groups=Array.from(document.querySelectorAll<HTMLElement>('nav,div,section'))\n      for(const group of groups){\n        const directButtons=Array.from(group.children).filter((child):child is HTMLButtonElement=>child instanceof HTMLButtonElement)\n        if(directButtons.length!==3)continue\n        const labels=directButtons.map(button=>(button.textContent||'').replace(/\\s+/g,' ').trim().toUpperCase())\n        if(labels[0].includes('WHITEBOARD')&&labels[1].includes('GAME PLAN')&&labels[2].includes('KPI')){\n          group.remove()\n        }\n      }\n    }\n    removeLegacyStrip()\n    const observer=new MutationObserver(removeLegacyStrip)\n    observer.observe(document.body,{childList:true,subtree:true})\n    return()=>observer.disconnect()\n  },[])\n"""

if injection in text:
    print('Legacy strip removal already installed')
elif anchor not in text:
    raise SystemExit('Could not find Match Day effect insertion point')
else:
    text = text.replace(anchor, anchor + injection, 1)
    path.write_text(text)
    print('Installed direct rendered-strip removal')

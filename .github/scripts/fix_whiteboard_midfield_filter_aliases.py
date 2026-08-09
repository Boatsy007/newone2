from pathlib import Path

path = Path('src/pages/CoachAppWhiteboardStage2.tsx')
text = path.read_text()
old = """  const areaPositionCodes:Record<'FWD'|'MID'|'DEF',Set<string>>={
    FWD:new Set(['FF','FP_LEFT','FP_RIGHT','CHF','HFF_LEFT','HFF_RIGHT']),
    MID:new Set(['RUCK','RR','ROVER','C','W_LEFT','W_RIGHT']),
    DEF:new Set(['FB','BP_LEFT','BP_RIGHT','CHB','HBF_LEFT','HBF_RIGHT']),
  }
  const trayPlayers=(playerTab==='US'?ourPlayers:oppositionPlayers).filter(option=>playerArea==='ALL'||Boolean(option.positionCode&&areaPositionCodes[playerArea].has(option.positionCode)))
"""
new = """  const normalisePositionCode=(value?:string)=>String(value||'').trim().toUpperCase().replace(/[\\s-]+/g,'_')
  const areaPositionCodes:Record<'FWD'|'MID'|'DEF',Set<string>>={
    FWD:new Set(['FF','FP_LEFT','FP_RIGHT','CHF','HFF_LEFT','HFF_RIGHT']),
    MID:new Set([
      'RUCK','R','RK',
      'RR','RUCK_ROVER','RUCKROVER',
      'ROVER','ROV',
      'C','CENTRE','CENTER',
      'W_LEFT','LEFT_WING','WING_LEFT','LEFTWING','LW',
      'W_RIGHT','RIGHT_WING','WING_RIGHT','RIGHTWING','RW',
    ]),
    DEF:new Set(['FB','BP_LEFT','BP_RIGHT','CHB','HBF_LEFT','HBF_RIGHT']),
  }
  const trayPlayers=(playerTab==='US'?ourPlayers:oppositionPlayers).filter(option=>playerArea==='ALL'||areaPositionCodes[playerArea].has(normalisePositionCode(option.positionCode)))
"""
if old not in text:
    raise SystemExit('Expected Whiteboard area filter block not found')
path.write_text(text.replace(old, new, 1))

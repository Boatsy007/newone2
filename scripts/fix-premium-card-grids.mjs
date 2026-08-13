import fs from 'node:fs'

function patchFile(file, replacers){
  let src=fs.readFileSync(file,'utf8')
  for(const {from,to,label} of replacers){
    if(!src.includes(from)) throw new Error(`${file}: could not locate ${label}`)
    src=src.replace(from,to)
  }
  fs.writeFileSync(file,src,'utf8')
  console.log(`Fixed ${file}`)
}

patchFile('apps/ipad/src/screens/CoachingScreen.tsx',[
  {
    label:'football operations grid',
    from:`<View style={s.stepGrid}>{steps.map((step,index)=><ActionTile key={step.title} icon={step.icon} title={step.title} copy={step.copy} tone={step.tone} onPress={step.onPress} badge={step.ready?'READY':\`STEP ${'${index+1}'}\`}/>)}</View>`,
    to:`<View style={s.stepGrid}>{steps.map((step,index)=><View key={step.title} style={s.stepCard}><ActionTile icon={step.icon} title={step.title} copy={step.copy} tone={step.tone} onPress={step.onPress} badge={step.ready?'READY':\`STEP ${'${index+1}'}\`}/></View>)}</View>`
  },
  {
    label:'coaching grid styles',
    from:`metrics:{flexDirection:'row',gap:12},stepGrid:{flexDirection:'row',flexWrap:'wrap',gap:12},tools:{flexDirection:'row',gap:12},`,
    to:`metrics:{flexDirection:'row',gap:12},stepGrid:{flexDirection:'row',flexWrap:'wrap',gap:14,alignItems:'stretch'},stepCard:{width:'31.8%',minWidth:250},tools:{flexDirection:'row',gap:14},`
  }
])

patchFile('apps/ipad/src/screens/StudioScreen.tsx',[
  {
    label:'studio tools grid',
    from:`<View style={s.toolGrid}>{TOOLS.map(tool=><ActionTile key={tool.key} icon={tool.icon} title={tool.title} copy={tool.copy} tone={tool.tone} onPress={()=>onOpen(tool.key)} badge={tool.eyebrow}/>)}</View>`,
    to:`<View style={s.toolGrid}>{TOOLS.map(tool=><View key={tool.key} style={s.toolCard}><ActionTile icon={tool.icon} title={tool.title} copy={tool.copy} tone={tool.tone} onPress={()=>onOpen(tool.key)} badge={tool.eyebrow}/></View>)}</View>`
  },
  {
    label:'studio grid styles',
    from:`metrics:{flexDirection:'row',gap:12},toolGrid:{flexDirection:'row',flexWrap:'wrap',gap:12}})`,
    to:`metrics:{flexDirection:'row',gap:12},toolGrid:{flexDirection:'row',flexWrap:'wrap',gap:14,alignItems:'stretch'},toolCard:{width:'31.8%',minWidth:250}})`
  }
])

console.log('Premium card grids repaired: Coaching uses a 3-column workflow grid and Studio uses a 3-column tools grid.')
console.log('Existing onPress handlers and connected workflows are unchanged.')

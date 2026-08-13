import type { LucideIcon } from 'lucide-react-native'
import { ChevronRight, Search } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Line, Path } from 'react-native-svg'
import { palette } from '../theme'

export const premium={
 canvas:'#F5F7FB',surface:'#FFFFFF',surfaceAlt:'#FAFBFD',border:'#E8EDF4',ink:'#171C27',muted:'#7F8998',muted2:'#A3ABB8',blue:'#176BFF',blueSoft:'#EEF4FF',green:'#23B26D',orange:'#FF9F2D',red:'#EF5B78',purple:'#7C4DFF',shadow:'#1E2A3A'
}

export function ScreenHeader({eyebrow,title,subtitle,right}:{eyebrow?:string;title:string;subtitle?:string;right?:React.ReactNode}){
 return <View style={s.header}><View style={s.headerCopy}>{eyebrow?<Text style={s.eyebrow}>{eyebrow}</Text>:null}<Text style={s.title}>{title}</Text>{subtitle?<Text style={s.subtitle}>{subtitle}</Text>:null}</View><View style={s.search}><Search size={16} color={premium.muted2}/><Text style={s.searchText}>Search club, players, matches, tools...</Text></View>{right}</View>
}

export function Surface({children,style}:{children:React.ReactNode;style?:object}){return <View style={[s.surface,style]}>{children}</View>}

export function MetricTile({icon:Icon,label,value,meta,tone=premium.blue,trend}:{icon:LucideIcon;label:string;value:string;meta?:string;tone?:string;trend?:number[]}){
 return <View style={s.metric}><View style={s.metricTop}><View style={[s.metricIcon,{backgroundColor:`${tone}14`}]}><Icon size={19} color={tone}/></View>{trend?.length?<MiniSparkline data={trend} tone={tone}/>:null}</View><Text style={s.metricLabel}>{label}</Text><Text style={s.metricValue}>{value}</Text>{meta?<Text style={s.metricMeta}>{meta}</Text>:null}</View>
}

export function SectionHeader({eyebrow,title,detail}:{eyebrow?:string;title:string;detail?:string}){return <View style={s.sectionHead}><View>{eyebrow?<Text style={s.eyebrow}>{eyebrow}</Text>:null}<Text style={s.sectionTitle}>{title}</Text></View>{detail?<Text style={s.sectionDetail}>{detail}</Text>:null}</View>}

export function ActionTile({icon:Icon,title,copy,tone=premium.blue,onPress,badge}:{icon:LucideIcon;title:string;copy:string;tone?:string;onPress?:()=>void;badge?:string}){
 return <Pressable onPress={onPress} disabled={!onPress} style={({pressed})=>[s.action,pressed&&onPress&&s.pressed]}><View style={s.actionTop}><View style={[s.actionIcon,{backgroundColor:`${tone}13`}]}><Icon size={21} color={tone}/></View>{badge?<View style={[s.badge,{backgroundColor:`${tone}12`}]}><Text style={[s.badgeText,{color:tone}]}>{badge}</Text></View>:null}</View><Text style={s.actionTitle}>{title}</Text><Text style={s.actionCopy}>{copy}</Text>{onPress?<View style={s.actionArrow}><ChevronRight size={17} color={premium.muted2}/></View>:null}</Pressable>
}

export function StatusPill({label,tone=premium.blue}:{label:string;tone?:string}){return <View style={[s.pill,{backgroundColor:`${tone}12`}]}><View style={[s.pillDot,{backgroundColor:tone}]}/><Text style={[s.pillText,{color:tone}]}>{label}</Text></View>}

export function Donut({value,max,label,tone=premium.blue,size=132}:{value:number;max:number;label:string;tone?:string;size?:number}){
 const safe=Math.max(0,Math.min(max,value)),pct=max?safe/max:0,r=size*.38,c=size/2,circ=2*Math.PI*r
 return <View style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}><Svg width={size} height={size}><Circle cx={c} cy={c} r={r} stroke="#EDF1F6" strokeWidth={size*.085} fill="none"/><Circle cx={c} cy={c} r={r} stroke={tone} strokeWidth={size*.085} fill="none" strokeLinecap="round" strokeDasharray={`${pct*circ} ${circ}`} rotation="-90" origin={`${c},${c}`}/></Svg><View style={s.donutCopy}><Text style={s.donutValue}>{value}</Text><Text style={s.donutLabel}>{label}</Text></View></View>
}

export function MiniSparkline({data,tone=premium.blue,width=90,height=30}:{data:number[];tone?:string;width?:number;height?:number}){
 const clean=data.length>1?data:[0,0],min=Math.min(...clean),max=Math.max(...clean),span=Math.max(1,max-min),step=width/(clean.length-1)
 const points=clean.map((v,i)=>`${i===0?'M':'L'} ${i*step} ${height-3-((v-min)/span)*(height-6)}`).join(' ')
 return <Svg width={width} height={height}><Line x1="0" y1={height-2} x2={width} y2={height-2} stroke="#EEF1F5" strokeWidth="1"/><Path d={points} stroke={tone} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></Svg>
}

export function ProgressBar({label,value,max,tone=premium.blue,suffix='' }:{label:string;value:number;max:number;tone?:string;suffix?:string}){const pct=Math.max(0,Math.min(100,max?(value/max)*100:0));return <View style={s.progress}><View style={s.progressHead}><Text style={s.progressLabel}>{label}</Text><Text style={s.progressValue}>{value}{suffix}</Text></View><View style={s.track}><View style={[s.fill,{width:`${pct}%`,backgroundColor:tone}]}/></View></View>}

const s=StyleSheet.create({
 header:{height:76,backgroundColor:premium.surface,borderBottomWidth:1,borderBottomColor:premium.border,paddingHorizontal:24,flexDirection:'row',alignItems:'center',gap:14},headerCopy:{minWidth:230},eyebrow:{fontSize:9,fontWeight:'900',letterSpacing:1.3,color:premium.blue},title:{fontSize:24,fontWeight:'900',color:premium.ink,letterSpacing:-.4,marginTop:2},subtitle:{fontSize:11.5,color:premium.muted,marginTop:3},search:{marginLeft:'auto',width:290,height:38,borderRadius:11,backgroundColor:premium.surfaceAlt,borderWidth:1,borderColor:premium.border,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:8},searchText:{fontSize:10.5,color:premium.muted2,flex:1},
 surface:{backgroundColor:premium.surface,borderRadius:18,borderWidth:1,borderColor:premium.border,shadowColor:premium.shadow,shadowOpacity:.055,shadowRadius:14,shadowOffset:{width:0,height:6}},
 metric:{flex:1,minHeight:112,backgroundColor:premium.surface,borderRadius:16,borderWidth:1,borderColor:premium.border,padding:15,shadowColor:premium.shadow,shadowOpacity:.045,shadowRadius:10,shadowOffset:{width:0,height:4}},metricTop:{height:32,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},metricIcon:{width:34,height:34,borderRadius:10,alignItems:'center',justifyContent:'center'},metricLabel:{fontSize:10.5,fontWeight:'700',color:premium.muted,marginTop:6},metricValue:{fontSize:26,fontWeight:'900',color:premium.ink,letterSpacing:-.4,marginTop:2},metricMeta:{fontSize:9.5,color:premium.muted2,marginTop:2},
 sectionHead:{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:16},sectionTitle:{fontSize:21,fontWeight:'900',color:premium.ink,marginTop:3},sectionDetail:{fontSize:10.5,color:premium.muted,maxWidth:360,textAlign:'right'},
 action:{flex:1,minHeight:128,backgroundColor:premium.surface,borderWidth:1,borderColor:premium.border,borderRadius:16,padding:15,position:'relative',shadowColor:premium.shadow,shadowOpacity:.04,shadowRadius:10,shadowOffset:{width:0,height:4}},actionTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},actionIcon:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center'},badge:{paddingHorizontal:9,paddingVertical:5,borderRadius:999},badgeText:{fontSize:8.5,fontWeight:'900'},actionTitle:{fontSize:16,fontWeight:'900',color:premium.ink,marginTop:12},actionCopy:{fontSize:10.5,lineHeight:15,color:premium.muted,marginTop:4,paddingRight:22},actionArrow:{position:'absolute',right:12,bottom:12},pressed:{transform:[{scale:.99}],opacity:.86},
 pill:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:9,paddingVertical:6,borderRadius:999},pillDot:{width:6,height:6,borderRadius:3},pillText:{fontSize:8.5,fontWeight:'900'},donutCopy:{position:'absolute',alignItems:'center'},donutValue:{fontSize:24,fontWeight:'900',color:premium.ink},donutLabel:{fontSize:8,fontWeight:'900',color:premium.muted,letterSpacing:.8,marginTop:1},
 progress:{gap:5},progressHead:{flexDirection:'row',justifyContent:'space-between'},progressLabel:{fontSize:10,fontWeight:'700',color:premium.muted},progressValue:{fontSize:10,fontWeight:'900',color:premium.ink},track:{height:7,borderRadius:4,backgroundColor:'#EEF1F5',overflow:'hidden'},fill:{height:7,borderRadius:4}
})

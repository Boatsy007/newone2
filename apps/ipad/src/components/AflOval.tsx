import { StyleSheet, View } from 'react-native'
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Pattern, Rect } from 'react-native-svg'

type Props={dark?:boolean;markings?:boolean;classic?:boolean;horizontal?:boolean}

const DEFAULT_SHAPE='M350 8 C545 8 682 58 682 136 L682 664 C682 742 545 792 350 792 C155 792 18 742 18 664 L18 136 C18 58 155 8 350 8 Z'
const CLASSIC_AFL_SHAPE='M350 8 C545 8 682 150 682 400 C682 650 545 792 350 792 C155 792 18 650 18 400 C18 150 155 8 350 8 Z'
const HORIZONTAL_AFL_SHAPE='M8 350 C8 155 150 18 400 18 C650 18 792 155 792 350 C792 545 650 682 400 682 C150 682 8 545 8 350 Z'

export function AflOval({dark=false,markings=true,classic=false,horizontal=false}:Props){
 const edge=dark?'#2CF18F':classic?'#315628':'#557A3D'
 const line=dark?'rgba(255,255,255,.55)':'rgba(255,255,255,.68)'
 const clip=horizontal?'oval-horizontal':classic?'oval-classic':dark?'oval-dark':'oval-light'
 const turf=horizontal?'turf-horizontal':classic?'turf-classic':dark?'turf-dark':'turf-light'
 const shape=horizontal?HORIZONTAL_AFL_SHAPE:classic?CLASSIC_AFL_SHAPE:DEFAULT_SHAPE
 const viewBox=horizontal?'0 0 800 700':'0 0 700 800'
 const turfOne=dark?'#078B40':classic?'#4D8A36':'#ACD781'
 const turfTwo=dark?'#067B39':classic?'#417A2E':'#9FCD75'
 const base=dark?'#07833D':classic?'#477F32':'#A7D07A'
 return <View pointerEvents="none" style={StyleSheet.absoluteFill}><Svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="none"><Defs><ClipPath id={clip}><Path d={shape}/></ClipPath><Pattern id={turf} width="80" height="80" patternUnits="userSpaceOnUse"><Rect width="80" height="80" fill={turfOne}/><Rect x="40" width="40" height="40" fill={turfTwo}/><Rect y="40" width="40" height="40" fill={turfTwo}/></Pattern></Defs><Path d={shape} fill={base} stroke={edge} strokeWidth={dark?7:4}/><G clipPath={`url(#${clip})`}><Rect width={horizontal?800:700} height={horizontal?700:800} fill={`url(#${turf})`}/>{markings&&(horizontal?<G fill="none" stroke={line} strokeWidth="3"><Line x1="400" y1="28" x2="400" y2="672"/><Rect x="330" y="262" width="140" height="176"/><Circle cx="400" cy="350" r="31"/><Path d="M166 145 C266 210 266 490 166 555"/><Path d="M634 145 C534 210 534 490 634 555"/><Line x1="8" y1="305" x2="38" y2="305"/><Line x1="8" y1="338" x2="62" y2="338"/><Line x1="8" y1="362" x2="62" y2="362"/><Line x1="8" y1="395" x2="38" y2="395"/><Line x1="792" y1="305" x2="762" y2="305"/><Line x1="792" y1="338" x2="738" y2="338"/><Line x1="792" y1="362" x2="738" y2="362"/><Line x1="792" y1="395" x2="762" y2="395"/></G>:<G fill="none" stroke={line} strokeWidth="3"><Line x1="28" y1="400" x2="672" y2="400"/><Rect x="262" y="330" width="176" height="140"/><Circle cx="350" cy="400" r="31"/><Path d="M145 166 C210 266 490 266 555 166"/><Path d="M145 634 C210 534 490 534 555 634"/><Line x1="305" y1="8" x2="305" y2="38"/><Line x1="338" y1="8" x2="338" y2="62"/><Line x1="362" y1="8" x2="362" y2="62"/><Line x1="395" y1="8" x2="395" y2="38"/><Line x1="305" y1="792" x2="305" y2="762"/><Line x1="338" y1="792" x2="338" y2="738"/><Line x1="362" y1="792" x2="362" y2="738"/><Line x1="395" y1="792" x2="395" y2="762"/></G>)}</G><Path d={shape} fill="none" stroke={edge} strokeWidth={dark?7:4}/></Svg></View>
}

import { StyleSheet, View } from 'react-native'
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Pattern, Rect } from 'react-native-svg'

type Props={dark?:boolean;markings?:boolean;classic?:boolean}

const DEFAULT_SHAPE='M350 8 C545 8 682 58 682 136 L682 664 C682 742 545 792 350 792 C155 792 18 742 18 664 L18 136 C18 58 155 8 350 8 Z'
const CLASSIC_AFL_SHAPE='M350 8 C545 8 682 150 682 400 C682 650 545 792 350 792 C155 792 18 650 18 400 C18 150 155 8 350 8 Z'

export function AflOval({dark=false,markings=true,classic=false}:Props){
 const edge=dark?'#2CF18F':'#557A3D',line=dark?'rgba(255,255,255,.55)':'rgba(255,255,255,.58)',clip=classic?'oval-classic':dark?'oval-dark':'oval-light',turf=classic?'turf-classic':dark?'turf-dark':'turf-light',shape=classic?CLASSIC_AFL_SHAPE:DEFAULT_SHAPE
 return <View pointerEvents="none" style={StyleSheet.absoluteFill}><Svg width="100%" height="100%" viewBox="0 0 700 800" preserveAspectRatio="none"><Defs><ClipPath id={clip}><Path d={shape}/></ClipPath><Pattern id={turf} width="80" height="80" patternUnits="userSpaceOnUse"><Rect width="80" height="40" fill={dark?'#078B40':'#ACD781'}/><Rect y="40" width="80" height="40" fill={dark?'#067B39':'#9FCD75'}/></Pattern></Defs><Path d={shape} fill={dark?'#07833D':'#A7D07A'} stroke={edge} strokeWidth={dark?7:4}/><G clipPath={`url(#${clip})`}><Rect width="700" height="800" fill={`url(#${turf})`}/>{markings&&<G fill="none" stroke={line} strokeWidth="3"><Line x1="28" y1="400" x2="672" y2="400"/><Rect x="262" y="330" width="176" height="140"/><Circle cx="350" cy="400" r="31"/><Path d="M145 166 C210 266 490 266 555 166"/><Path d="M145 634 C210 534 490 534 555 634"/><Path d="M300 9 L300 68 L400 68 L400 9"/><Path d="M300 791 L300 732 L400 732 L400 791"/><Line x1="320" y1="8" x2="320" y2="42"/><Line x1="342" y1="8" x2="342" y2="48"/><Line x1="358" y1="8" x2="358" y2="48"/><Line x1="380" y1="8" x2="380" y2="42"/><Line x1="320" y1="792" x2="320" y2="758"/><Line x1="342" y1="792" x2="342" y2="752"/><Line x1="358" y1="792" x2="358" y2="752"/><Line x1="380" y1="792" x2="380" y2="758"/></G>}</G><Path d={shape} fill="none" stroke={edge} strokeWidth={dark?7:4}/></Svg></View>
}

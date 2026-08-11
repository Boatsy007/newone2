import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg'

type Props = { color: string; compact?: boolean }

const points = [34, 31, 37, 29, 26, 33, 25, 20, 24, 16, 19, 10]

export function LineChart({ color, compact = false }: Props) {
  const width = compact ? 210 : 720
  const height = compact ? 54 : 170
  const step = width / (points.length - 1)
  const scale = compact ? 1 : 2.7
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${index * step} ${point * scale}`).join(' ')
  const area = `${path} L ${width} ${height} L 0 ${height} Z`
  const gradientId = `line-${color.replace('#', '')}-${compact ? 'small' : 'large'}`
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <Defs><LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity="0.22"/><Stop offset="1" stopColor={color} stopOpacity="0"/></LinearGradient></Defs>
      {!compact && <Path d={area} fill={`url(#${gradientId})`}/>} 
      <Path d={path} fill="none" stroke={color} strokeWidth={compact ? 3 : 2.4}/>
      {!compact && points.map((point, index) => <Circle key={index} cx={index * step} cy={point * scale} r="4" fill="#fff" stroke={color} strokeWidth="2"/>)}
    </Svg>
  )
}

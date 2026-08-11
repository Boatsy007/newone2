import Svg, { Path } from 'react-native-svg'

type Props = { color: string; compact?: boolean }

export function LineChart({ color, compact = false }: Props) {
  const width = compact ? 210 : 720
  const height = compact ? 54 : 170
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <Path d={`M 0 ${height / 2} L ${width} ${height / 2}`} fill="none" stroke={color} strokeOpacity="0.22" strokeWidth={compact ? 2 : 1.5} strokeDasharray="7 7"/>
    </Svg>
  )
}

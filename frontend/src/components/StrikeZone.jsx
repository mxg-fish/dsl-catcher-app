/**
 * Interactive strike zone + home plate.
 * - Tap/click to set pitch location (normalized 0-1 x/y)
 * - Shows previous pitches as colored dots
 * - selected: {x, y} | null
 * - onSelect: ({x,y}) => void
 * - pitches: [{pitch_x, pitch_y, quality, is_strike}]
 */

const ZONE_W = 280
const ZONE_H = 300
const PLATE_H = 40

// Strike zone occupies middle ~55% wide, 60% tall of the canvas
const SZ = {
  left:   ZONE_W * 0.22,
  right:  ZONE_W * 0.78,
  top:    ZONE_H * 0.10,
  bottom: ZONE_H * 0.70,
}
const SZ_W = SZ.right - SZ.left
const SZ_H = SZ.bottom - SZ.top

// Convert normalized (0-1) coords to SVG pixel coords
// x: 0=left edge, 1=right edge of full zone canvas
// y: 0=bottom (low), 1=top (high)
function toSVG(nx, ny) {
  return {
    cx: ZONE_W * nx,
    cy: ZONE_H * (1 - ny),
  }
}

// Convert SVG click coords to normalized
function fromSVG(svgX, svgY) {
  return {
    x: svgX / ZONE_W,
    y: 1 - svgY / ZONE_H,
  }
}

export default function StrikeZone({ selected, onSelect, pitches = [] }) {
  function handleClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width)  * ZONE_W
    const svgY = ((e.clientY - rect.top)  / rect.height) * ZONE_H
    onSelect(fromSVG(svgX, svgY))
  }

  // 9-zone grid lines
  const thirds = [1/3, 2/3]
  const vLines = thirds.map(t => SZ.left  + SZ_W * t)
  const hLines = thirds.map(t => SZ.top   + SZ_H * t)

  return (
    <div style={{ userSelect:'none', touchAction:'none' }}>
      <svg
        viewBox={`0 0 ${ZONE_W} ${ZONE_H + PLATE_H}`}
        width="100%" style={{ cursor:'crosshair', maxWidth: ZONE_W, display:'block', margin:'0 auto' }}
        onClick={handleClick}
      >
        {/* Background */}
        <rect width={ZONE_W} height={ZONE_H + PLATE_H} fill="#1a1a1a" rx="6" />

        {/* Shadow zone (slightly larger outline) */}
        <rect
          x={SZ.left - 14} y={SZ.top - 14}
          width={SZ_W + 28} height={SZ_H + 28}
          fill="none" stroke="#333" strokeWidth="1" strokeDasharray="4 3" rx="2"
        />

        {/* Strike zone box */}
        <rect x={SZ.left} y={SZ.top} width={SZ_W} height={SZ_H}
          fill="rgba(255,255,255,0.04)" stroke="#555" strokeWidth="2" />

        {/* 9-zone grid */}
        {vLines.map((x,i) => (
          <line key={`v${i}`} x1={x} y1={SZ.top} x2={x} y2={SZ.bottom} stroke="#333" strokeWidth="1" />
        ))}
        {hLines.map((y,i) => (
          <line key={`h${i}`} x1={SZ.left} y1={y} x2={SZ.right} y2={y} stroke="#333" strokeWidth="1" />
        ))}

        {/* Label */}
        <text x={ZONE_W/2} y={SZ.top - 18} textAnchor="middle" fill="#555" fontSize="11">ZONA</text>

        {/* Home plate */}
        {(() => {
          const py = ZONE_H + 6
          const pw = 60; const ph = PLATE_H - 12
          const cx = ZONE_W / 2
          const pts = `${cx},${py+ph} ${cx-pw/2},${py+ph*0.6} ${cx-pw/2},${py} ${cx+pw/2},${py} ${cx+pw/2},${py+ph*0.6}`
          return <polygon points={pts} fill="none" stroke="#666" strokeWidth="2" />
        })()}
        <text x={ZONE_W/2} y={ZONE_H + PLATE_H - 2} textAnchor="middle" fill="#444" fontSize="10">HOME</text>

        {/* Past pitches */}
        {pitches.map((p, i) => {
          if (p.pitch_x == null) return null
          const { cx, cy } = toSVG(p.pitch_x, p.pitch_y)
          const color = p.quality === 'good'
            ? (p.is_strike ? '#00b894' : '#74b9ff')
            : (p.is_strike ? '#e17055' : '#d63031')
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r="7" fill={color} fillOpacity="0.6" stroke={color} strokeWidth="1.5" />
              <text x={cx} y={cy+4} textAnchor="middle" fontSize="7" fill="#fff" fontWeight="bold">
                {p.quality === 'good' ? '✓' : '✗'}
              </text>
            </g>
          )
        })}

        {/* Selected location crosshair */}
        {selected && (() => {
          const { cx, cy } = toSVG(selected.x, selected.y)
          return (
            <g>
              <circle cx={cx} cy={cy} r="10" fill="none" stroke="#e63946" strokeWidth="2.5" />
              <line x1={cx-14} y1={cy} x2={cx+14} y2={cy} stroke="#e63946" strokeWidth="1.5" />
              <line x1={cx} y1={cy-14} x2={cx} y2={cy+14} stroke="#e63946" strokeWidth="1.5" />
            </g>
          )
        })()}
      </svg>

      {/* Legend */}
      <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:6, flexWrap:'wrap', fontSize:11, color:'#888' }}>
        <span><span style={{ color:'#00b894' }}>●</span> Buen Mov Strike</span>
        <span><span style={{ color:'#74b9ff' }}>●</span> Buen Mov Bola</span>
        <span><span style={{ color:'#e17055' }}>●</span> Mal Mov Strike</span>
        <span><span style={{ color:'#d63031' }}>●</span> Mal Mov Bola</span>
      </div>
    </div>
  )
}

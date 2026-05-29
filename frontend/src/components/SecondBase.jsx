/**
 * Field-level perspective view of second base.
 * Camera at ~4ft height looking toward 2B. One corner of the bag points
 * toward the camera (standard baseball orientation from home plate side).
 * 1ft × 1ft perspective grid on the ground.
 * Kill / target zones float in the air to the RIGHT (1B side).
 *
 * Click coordinate origin = kill zone center (ideal throw).
 *   x: + = right (1B),  - = left (SS)
 *   y: + = high,        - = low
 */

const W = 520, H = 380

// ── Perspective camera ────────────────────────────────────────────────────────
const VP_X  = W / 2
const VP_Y  = 80           // horizon
const CAM_H = 5.5          // camera height, feet
const Z_REF = 16
const F     = 500

/** Project world (wx ft, wy ft, wh ft) → SVG {x, y} */
function proj(wx, wy, wh = 0) {
  const z = Z_REF - wy
  if (z < 0.5) return { x: VP_X, y: -999 }
  return {
    x: VP_X + (wx * F) / z,
    y: VP_Y + ((CAM_H - wh) * F) / z,
  }
}

const PX_FT = F / Z_REF

// ── Kill / target zone — along 1B baseline (45° diagonal) ────────────────────
// ── 1B baseline: starts at bag right corner (bagHalf, 0), direction (+1,+1) ───
// A point t feet along this baseline: wx = bagHalf + t,  wy = t
const bagHalfConst = 0.625
const blPt = (t, wh = 0) => proj(bagHalfConst + t, t, wh)

// Zone at t=2.5 along baseline, spans wh=0 to wh=4, center wh=2
const ZONE_T   = 1.2                            // closer to the bag
const ZONE_WX  = bagHalfConst + ZONE_T
const ZONE_WY  = ZONE_T
const ZONE_Z   = Z_REF - ZONE_WY
const ZONE_SCALE = F / ZONE_Z
const ZONE     = proj(ZONE_WX, ZONE_WY, 2.5)   // center midpoint between 0.5 and 4.5ft
const ZONE_BOT = proj(ZONE_WX, ZONE_WY, 0.5)   // bottom just above ground
const ZONE_TOP = proj(ZONE_WX, ZONE_WY, 4.5)   // top at 4.5ft
const TARG_RY  = (ZONE_BOT.y - ZONE_TOP.y) / 2
const TARG_R   = 3.175 * ZONE_SCALE             // right edge at 5ft from bag center
const KILL_RY  = TARG_RY * 0.45
const KILL_R   = 1.1 * ZONE_SCALE

// ── World-to/from-SVG for click handling (relative to kill zone center) ───────
function svgToWorld(sx, sy) {
  return {
    x:  (sx - ZONE.x) / ZONE_SCALE,
    y: -(sy - ZONE.y) / ZONE_SCALE,
  }
}
function worldToSvg(wx, wy) {
  return { x: ZONE.x + wx * ZONE_SCALE, y: ZONE.y - wy * ZONE_SCALE }
}

// ── Grid definition ───────────────────────────────────────────────────────────
const XS = [-9,-8,-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7,8,9]
const YS = [-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7]

export default function SecondBase({ selected, onSelect, throws = [] }) {

  function handleClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const sx = ((e.clientX - rect.left) / rect.width)  * W
    const sy = ((e.clientY - rect.top)  / rect.height) * H
    // Only register clicks on the ground area (below horizon)
    if (sy < VP_Y + 5) return
    const inZone = ((sx - ZONE.x) / TARG_R) ** 2 + ((sy - ZONE.y) / TARG_RY) ** 2 <= 1
    onSelect({ ...svgToWorld(sx, sy), inZone })
  }

  // ── Bag corners (1.25ft square, rotated 45°, on ground) ──────────────────
  // One point toward camera (+wy), one away (-wy), two to the sides
  const bagHalf = 0.625  // half of 1.25ft
  const bagTop   = proj(0,  -bagHalf, 0)     // far corner (toward CF)
  const bagRight = proj(+bagHalf, 0, 0)      // right corner
  const bagBot   = proj(0,  +bagHalf, 0)     // near corner (toward pitcher)
  const bagLeft  = proj(-bagHalf, 0, 0)      // left corner

  // Bag top face (at bag thickness ~0.3ft) — gives 3D appearance
  const BAG_THICK = 0.28
  const bagTopT  = proj(0,  -bagHalf, BAG_THICK)
  const bagRightT= proj(+bagHalf, 0,  BAG_THICK)
  const bagBotT  = proj(0,  +bagHalf, BAG_THICK)
  const bagLeftT = proj(-bagHalf, 0,  BAG_THICK)

  const bagTopFace  = `${bagTopT.x},${bagTopT.y} ${bagRightT.x},${bagRightT.y} ${bagBotT.x},${bagBotT.y} ${bagLeftT.x},${bagLeftT.y}`
  // Front face of bag (the two closer bottom/top points + their top equivalents)
  const bagFrontFace = `${bagLeft.x},${bagLeft.y} ${bagBot.x},${bagBot.y} ${bagBotT.x},${bagBotT.y} ${bagLeftT.x},${bagLeftT.y}`
  const bagRightFace = `${bagBot.x},${bagBot.y} ${bagRight.x},${bagRight.y} ${bagRightT.x},${bagRightT.y} ${bagBotT.x},${bagBotT.y}`

  return (
    <div style={{ userSelect:'none', touchAction:'none' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ cursor:'crosshair', maxWidth:W, display:'block', margin:'0 auto', borderRadius:8 }}
        onClick={handleClick}
      >
        <defs>
          <linearGradient id="sky4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#4a9cc8"/>
            <stop offset="100%" stopColor="#a8d8f0"/>
          </linearGradient>
          <linearGradient id="grass4" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#4a8c38"/>
            <stop offset="100%" stopColor="#2d6122"/>
          </linearGradient>
          {/* Kill zone radial gradient */}
          <radialGradient id="kz4" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#e63946" stopOpacity="0.95"/>
            <stop offset="40%"  stopColor="#e63946" stopOpacity="0.60"/>
            <stop offset="100%" stopColor="#e63946" stopOpacity="0.0"/>
          </radialGradient>
          <radialGradient id="kzglow4" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#e63946" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#e63946" stopOpacity="0.0"/>
          </radialGradient>
          <filter id="blur6"><feGaussianBlur stdDeviation="6"/></filter>
          <filter id="blur2b"><feGaussianBlur stdDeviation="2"/></filter>
          {/* Clip zone at bag centre line — creates flat left edge */}
          <clipPath id="zoneClip">
            <rect x={VP_X} y={0} width={W} height={H}/>
          </clipPath>
        </defs>

        {/* ── Sky ── */}
        <rect x={0} y={0} width={W} height={VP_Y + 1} fill="url(#sky4)"/>

        {/* ── Ground (all grass) ── */}
        <polygon
          points={`0,${VP_Y} ${W},${VP_Y} ${W},${H} 0,${H}`}
          fill="url(#grass4)"
        />

        {/* ── Horizon ── */}
        <line x1={0} y1={VP_Y} x2={W} y2={VP_Y} stroke="#78b8d8" strokeWidth="0.8"/>

        {/* ── 1ft × 1ft perspective grid ── */}
        {/* Lateral lines (left-right, constant depth) */}
        {YS.map(wy => {
          const left  = proj(-6.5, wy)
          const right = proj(+6.5, wy)
          if (left.y < VP_Y || left.y > H + 10) return null
          return (
            <line key={`gy${wy}`}
              x1={left.x} y1={left.y} x2={right.x} y2={right.y}
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={wy === 0 ? 1.0 : 0.6}
              strokeOpacity={wy === 0 ? 0.65 : 0.35}
            />
          )
        })}

        {/* Depth lines (converge to VP, constant lateral position) */}
        {XS.map(wx => {
          const near = proj(wx, 5.5)
          const far  = proj(wx, -4.5)
          if (near.y < VP_Y) return null
          const farClipped = far.y < VP_Y ? { x: VP_X + (wx * F)/(Z_REF+4.5), y: VP_Y } : far
          return (
            <line key={`gx${wx}`}
              x1={farClipped.x} y1={farClipped.y}
              x2={near.x} y2={Math.min(near.y, H)}
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={wx === 0 ? 1.0 : 0.6}
              strokeOpacity={wx === 0 ? 0.65 : 0.35}
            />
          )
        })}


        {/* ── Bag bottom face (ground contact, slight darker edge) ── */}
        <polygon
          points={`${bagTop.x},${bagTop.y} ${bagRight.x},${bagRight.y} ${bagBot.x},${bagBot.y} ${bagLeft.x},${bagLeft.y}`}
          fill="#d0cdb8" stroke="none"
        />

        {/* ── Bag side faces (visible near edges — subtle 3D) ── */}
        <polygon points={bagFrontFace}  fill="#c8c5b0"/>
        <polygon points={bagRightFace}  fill="#c0bda8"/>

        {/* ── Bag top face (white) ── */}
        <polygon points={bagTopFace}
          fill="#f8f8f0" stroke="#bbb" strokeWidth="1"/>


        {/* ── Basepaths ── use T_MAX=5 so endpoint stays inside viewport (no Y-clamp) ── */}
        {(() => {
          // T=5: blPt(5,0)=proj(5.625,5,0) → x≈516, y≈330 — within 520×380 viewport
          const r0 = blPt(0, 0), r1 = blPt(5, 0)
          const l0 = proj(-bagHalf, 0, 0), l1 = proj(-bagHalf - 5, 5, 0)
          return (
            <g stroke="#e8d898" strokeWidth="1.6" strokeOpacity="0.8" strokeDasharray="5 4">
              <line x1={r0.x} y1={r0.y} x2={r1.x} y2={r1.y}/>
              <line x1={l0.x} y1={l0.y} x2={l1.x} y2={l1.y}/>
            </g>
          )
        })()}

        {/* ── Vertical 1ft×1ft grid along 1B baseline ── */}
        {(() => {
          // Same T_MAX=5 — no clamping, endpoints stay in viewport
          const T_MIN = 0, T_MAX = 5
          const tSteps = [0,1,2,3,4,5]
          const hSteps = [0,1,2,3,4,5]
          return (
            <g stroke="rgba(255,255,255,0.65)" strokeWidth="0.8" strokeOpacity="0.6">
              {hSteps.map(wh => {
                const a = blPt(T_MIN, wh), b = blPt(T_MAX, wh)
                return <line key={`bh${wh}`}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  strokeWidth={wh === 0 ? 1.6 : 0.8}
                  strokeOpacity={wh === 0 ? 0.9 : 0.55}
                />
              })}
              {tSteps.map(t => {
                const a = blPt(t, 0), b = blPt(t, 5)
                return <line key={`bv${t}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}/>
              })}
            </g>
          )
        })()}

        {/* ── Zones — clipped at bag centre line for flat left edge ── */}
        <g clipPath="url(#zoneClip)">
          <ellipse cx={ZONE.x} cy={ZONE.y}
            rx={TARG_R * 1.3} ry={TARG_RY * 1.3}
            fill="url(#kzglow4)" filter="url(#blur6)"/>
          <ellipse cx={ZONE.x} cy={ZONE.y}
            rx={TARG_R * 1.05} ry={TARG_RY * 1.05}
            fill="url(#kz4)"/>
          <ellipse cx={ZONE.x} cy={ZONE.y}
            rx={TARG_R} ry={TARG_RY}
            fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6"/>
          <ellipse cx={ZONE.x} cy={ZONE.y}
            rx={KILL_R} ry={KILL_RY}
            fill="rgba(180,20,30,0.12)"
            stroke="rgba(10,0,0,0.85)" strokeWidth="1.6"/>
        </g>
        <text x={ZONE.x + TARG_R * 0.15} y={ZONE.y - TARG_RY - 6}
          textAnchor="middle" fill="#fff"
          fontSize="9.5" fontWeight="800" letterSpacing="1.3">TARGET ZONE</text>
        <text x={ZONE.x} y={ZONE.y + 4}
          textAnchor="middle" fill="#fff"
          fontSize="9" fontWeight="800" letterSpacing="1">KILL ZONE</text>


        {/* ── Past throws ── */}
        {throws.map((t, i) => {
          if (t.throw_x == null) return null
          const { x: sx, y: sy } = worldToSvg(t.throw_x, t.throw_y ?? 0)
          const color = t.accurate ? '#00c896' : '#aaaaaa'
          return (
            <g key={i}>
              {t.in_dirt && (
                <circle cx={sx} cy={sy} r={10}
                  fill="none" stroke="#9a6020"
                  strokeWidth="1.5" strokeDasharray="3 2"/>
              )}
              <circle cx={sx} cy={sy} r={7}
                fill={color} fillOpacity={0.80}
                stroke="rgba(0,0,0,0.25)" strokeWidth={1}/>
              <text x={sx} y={sy+3} textAnchor="middle"
                fill="#fff" fontSize="7" fontWeight="800">
                {t.accurate ? '✓' : '✗'}
              </text>
            </g>
          )
        })}

        {/* ── Selected crosshair ── */}
        {selected && (() => {
          const { x: sx, y: sy } = worldToSvg(selected.x, selected.y ?? 0)
          return (
            <g>
              <circle cx={sx} cy={sy} r={6}
                fill="none" stroke="#fff" strokeWidth="1.8"/>
              <circle cx={sx} cy={sy} r={2} fill="#e63946"/>
              <line x1={sx-9} y1={sy} x2={sx+9} y2={sy}
                stroke="#fff" strokeWidth="1.2"/>
              <line x1={sx} y1={sy-9} x2={sx} y2={sy+9}
                stroke="#fff" strokeWidth="1.2"/>
            </g>
          )
        })()}

      </svg>

      <div style={{display:'flex',gap:14,justifyContent:'center',marginTop:6,flexWrap:'wrap',fontSize:11,color:'#888'}}>
        <span><span style={{color:'#00c896'}}>●</span> Preciso</span>
        <span><span style={{color:'#aaa'}}>●</span> No preciso</span>
        <span>◌ En tierra</span>
      </div>

      {selected && (
        <p style={{textAlign:'center',fontSize:11,color:'#666',marginTop:4}}>
          {Math.abs(selected.x).toFixed(1)}ft {selected.x>0.1?'→ 1B':selected.x<-0.1?'← SS':'centro'} ·{' '}
          {Math.abs(selected.y??0).toFixed(1)}ft {(selected.y??0)>0.1?'↑ alto':(selected.y??0)<-0.1?'↓ bajo':'centro'}
        </p>
      )}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'

const BLUE = '#00A3E0'
const RED  = '#EF3340'
const GRAY = '#41748D'
const BLACK = '#000000'

// ── Strike zone SVG inline ─────────────────────────────────────────────────
function ZonePlot({ pitches }) {
  const W = 220, H = 240
  const SZ = { left: W*0.22, right: W*0.78, top: H*0.10, bottom: H*0.70 }
  function toSVG(nx, ny) {
    return { cx: W*nx, cy: H*(1-ny) }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display:'block', margin:'0 auto' }}>
      <rect width={W} height={H} fill="#111" rx="4"/>
      <rect x={SZ.left} y={SZ.top} width={SZ.right-SZ.left} height={SZ.bottom-SZ.top}
        fill="rgba(255,255,255,0.04)" stroke="#444" strokeWidth="1.5"/>
      {[1/3,2/3].map((t,i) => (
        <g key={i}>
          <line x1={SZ.left+(SZ.right-SZ.left)*t} y1={SZ.top} x2={SZ.left+(SZ.right-SZ.left)*t} y2={SZ.bottom} stroke="#333" strokeWidth="0.8"/>
          <line x1={SZ.left} y1={SZ.top+(SZ.bottom-SZ.top)*t} x2={SZ.right} y2={SZ.top+(SZ.bottom-SZ.top)*t} stroke="#333" strokeWidth="0.8"/>
        </g>
      ))}
      {/* Home plate */}
      {(() => {
        const py = H*0.82, pw = 44, ph = 20, cx = W/2
        return <polygon points={`${cx},${py+ph} ${cx-pw/2},${py+ph*0.6} ${cx-pw/2},${py} ${cx+pw/2},${py} ${cx+pw/2},${py+ph*0.6}`} fill="none" stroke="#555" strokeWidth="1.5"/>
      })()}
      {pitches.map((p, i) => {
        if (p.x == null) return null
        const { cx, cy } = toSVG(p.x, p.y)
        const dotColor = p.is_strike ? RED : BLUE
        const softColor = p.is_strike ? '#ff8888' : '#88ccff'
        const ringColor = p.quality === 'great' ? RED : p.quality === 'good' ? '#FF8C00' : '#003366'
        const ringWidth = p.quality === 'bad' ? 1.5 : 2.5
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={8} fill={p.quality === 'bad' ? softColor : softColor} fillOpacity="0.9"/>
            <circle cx={cx} cy={cy} r={8} fill="none" stroke={ringColor} strokeWidth={ringWidth}/>
          </g>
        )
      })}
    </svg>
  )
}

// ── Second base throw plot ─────────────────────────────────────────────────
function ThrowPlot({ throws }) {
  const W = 220, H = 180
  const VP_X = W/2, VP_Y = 50, F = 350, Z_REF = 14, CAM_H = 5
  function proj(wx, wy, wh=0) {
    const z = Z_REF - wy
    if (z < 0.5) return { x: VP_X, y: -999 }
    return { x: VP_X + (wx*F)/z, y: VP_Y + ((CAM_H-wh)*F)/z }
  }
  const ZONE_SCALE = F / Z_REF
  const bagHalf = 0.625
  const bagTop = proj(0, -bagHalf, 0), bagRight = proj(bagHalf, 0, 0)
  const bagBot = proj(0, bagHalf, 0),  bagLeft  = proj(-bagHalf, 0, 0)
  const bagTopT = proj(0, -bagHalf, 0.28), bagRightT = proj(bagHalf, 0, 0.28)
  const bagBotT = proj(0, bagHalf, 0.28),  bagLeftT  = proj(-bagHalf, 0, 0.28)
  const ZONE = proj(bagHalf + 1.2, 1.2, 2.5)

  function worldToSvg(wx, wy) {
    return { x: ZONE.x + wx*ZONE_SCALE, y: ZONE.y - (wy||0)*ZONE_SCALE }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display:'block', margin:'0 auto' }}>
      <rect width={W} height={H} fill="#2d5a1b" rx="4"/>
      <line x1={VP_X} y1={VP_Y} x2={W} y2={VP_Y} stroke="#4a8c38" strokeWidth="0.5"/>
      <polygon points={`${bagTop.x},${bagTop.y} ${bagRight.x},${bagRight.y} ${bagBot.x},${bagBot.y} ${bagLeft.x},${bagLeft.y}`} fill="#d0cdb8"/>
      <polygon points={`${bagLeft.x},${bagLeft.y} ${bagBot.x},${bagBot.y} ${bagBotT.x},${bagBotT.y} ${bagLeftT.x},${bagLeftT.y}`} fill="#c0bda8"/>
      <polygon points={`${bagTop.x},${bagTop.y} ${bagRight.x},${bagRight.y} ${bagRightT.x},${bagRightT.y} ${bagTopT.x},${bagTopT.y}`} fill="#c8c5b0"/>
      <polygon points={`${bagTopT.x},${bagTopT.y} ${bagRightT.x},${bagRightT.y} ${bagBotT.x},${bagBotT.y} ${bagLeftT.x},${bagLeftT.y}`} fill="#f8f8f0" stroke="#bbb" strokeWidth="0.8"/>
      {throws.map((t, i) => {
        if (t.x == null) return null
        const { x, y } = worldToSvg(t.x, t.y || 0)
        const color = t.accurate ? '#00c896' : '#ff6b6b'
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={6} fill={color} fillOpacity={0.85} stroke="rgba(0,0,0,0.3)" strokeWidth={1}/>
          </g>
        )
      })}
    </svg>
  )
}

// ── Block plate plot ────────────────────────────────────────────────────────
function BlockPlot({ blocks }) {
  const W = 220, H = 180
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display:'block', margin:'0 auto' }}>
      <rect width={W} height={H} fill="#2a1f14" rx="4"/>
      {[0,1,2,3,4,5,6,7].map(i => (
        <g key={i}>
          <line x1={i*W/7} y1={0} x2={i*W/7} y2={H} stroke="#333" strokeWidth="0.4"/>
          <line x1={0} y1={i*H/7} x2={W} y2={i*H/7} stroke="#333" strokeWidth="0.4"/>
        </g>
      ))}
      <polygon points={`${W/2},${H*0.85} ${W*0.33},${H*0.72} ${W*0.33},${H*0.45} ${W*0.67},${H*0.45} ${W*0.67},${H*0.72}`} fill="#3a3a3a" stroke="#888" strokeWidth="1.5"/>
      {blocks.map((b, i) => {
        if (b.x == null) return null
        const cx = b.x * W, cy = b.y * H
        const color = b.blocked ? '#00c896' : b.is_pick ? BLUE : '#ff6b6b'
        return <circle key={i} cx={cx} cy={cy} r={7} fill={color} fillOpacity={0.85} stroke="rgba(0,0,0,0.3)" strokeWidth={1}/>
      })}
    </svg>
  )
}

// ── Stat box ────────────────────────────────────────────────────────────────
function StatBox({ label, value, sub, color }) {
  return (
    <div style={{ background:'#111', borderRadius:8, padding:'10px 8px', textAlign:'center', flex:1 }}>
      <div style={{ fontSize:22, fontWeight:700, color: color || BLUE }}>{value ?? '—'}</div>
      <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:10, color:'#666' }}>{sub}</div>}
    </div>
  )
}

// ── Catcher card ────────────────────────────────────────────────────────────
function CatcherCard({ catcher, gameDate, opponent }) {
  const t = catcher.throws
  const b = catcher.blocks
  const r = catcher.receiving

  return (
    <div style={{
      background: BLACK, borderRadius: 12, marginBottom: 32,
      border: `1px solid ${GRAY}`, overflow:'hidden',
      pageBreakInside: 'avoid',
    }}>
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg, ${BLACK} 0%, #0a1628 100%)`, padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`2px solid ${BLUE}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <img src="/marlins-logo.png" alt="Marlins" style={{ width:56, height:56, objectFit:'contain' }}/>
          <div>
            <div style={{ fontSize:24, fontWeight:900, color:'#fff', letterSpacing:1, textTransform:'uppercase' }}>{catcher.player_name}</div>
            <div style={{ fontSize:12, color:BLUE, marginTop:2 }}>{gameDate}{opponent ? ` · vs ${opponent}` : ''} · DSL MIAMI</div>
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:11, color:'#666' }}>SCORE</div>
          <div style={{ fontSize:32, fontWeight:900, color:RED }}>{catcher.total_score ?? '—'}</div>
        </div>
      </div>

      <div style={{ padding:'16px 20px' }}>

        {/* ── THROWS ── */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:BLUE, letterSpacing:2, marginBottom:10 }}>TIROS</div>
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            <StatBox label="TIROS" value={t.total}/>
            <StatBox label="POP TIME" value={t.avg_pop ? `${t.avg_pop}s` : '—'} color="#fff"/>
            <StatBox label="PRECISO %" value={`${t.accurate_pct}%`} color={t.accurate_pct >= 70 ? '#00c896' : RED}/>
            <StatBox label="CS" value={t.cs} color="#00c896"/>
            <StatBox label="BP" value={t.back_picks}/>
            <StatBox label="ERR. INT." value={t.exchange_errors} color={t.exchange_errors > 0 ? RED : '#888'}/>
          </div>
          {t.locations.length > 0 && (
            <div style={{ maxWidth:220 }}>
              <ThrowPlot throws={t.locations}/>
            </div>
          )}
        </div>

        <div style={{ borderTop:`1px solid #222`, marginBottom:20 }}/>

        {/* ── BLOCKS ── */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:BLUE, letterSpacing:2, marginBottom:10 }}>BLOQUEOS</div>
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            <StatBox label="BLOQUEOS" value={`${b.blocked}/${b.total}`}/>
            <StatBox label="BLOCK %" value={`${b.block_pct}%`} color={b.block_pct >= 80 ? '#00c896' : RED}/>
            <StatBox label="PB" value={b.passed_balls} color={b.passed_balls > 0 ? RED : '#888'}/>
            <StatBox label="WP" value={b.wild_pitches} color={b.wild_pitches > 0 ? RED : '#888'}/>
            <StatBox label="PICKS" value={b.picks} color={BLUE}/>
          </div>
          {b.locations.length > 0 && (
            <div style={{ maxWidth:220 }}>
              <BlockPlot blocks={b.locations}/>
            </div>
          )}
        </div>

        <div style={{ borderTop:`1px solid #222`, marginBottom:20 }}/>

        {/* ── RECEIVING ── */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:BLUE, letterSpacing:2, marginBottom:10 }}>RECIBIR</div>
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            <StatBox label="GRAN MOV" value={r.great} color={RED}/>
            <StatBox label="BUEN MOV" value={r.good} color="#FF8C00"/>
            <StatBox label="MAL MOV" value={r.bad} color="#003399"/>
            <StatBox label="MOV %" value={r.mov_pct != null ? `${r.mov_pct}%` : '—'} color={r.mov_pct >= 80 ? '#00c896' : RED}/>
            <StatBox label="STRIKES" value={r.strikes} color={RED}/>
            <StatBox label="BOLAS" value={r.balls} color={BLUE}/>
          </div>

          {/* Pitch type breakdown */}
          {(r.by_hand.R || r.by_hand.L) && (
            <div style={{ display:'flex', gap:12, marginBottom:12 }}>
              {['R','L'].map(hand => (
                <div key={hand} style={{ flex:1, background:'#111', borderRadius:8, padding:'10px 12px' }}>
                  <div style={{ fontSize:11, fontWeight:700, color: hand==='R' ? '#e17055' : '#74b9ff', marginBottom:6 }}>
                    {hand === 'R' ? 'RHP →' : '← LHP'}
                  </div>
                  {['hard','soft','breaking'].map(pt => (
                    <div key={pt} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#aaa', marginBottom:3 }}>
                      <span>{pt === 'hard' ? '🔥 Dura' : pt === 'soft' ? '🫧 Suave' : '🌀 Curva'}</span>
                      <span style={{ color:'#fff', fontWeight:700 }}>{r.by_hand[hand][pt]}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {r.locations.length > 0 && (
            <div style={{ maxWidth:220 }}>
              <div style={{ fontSize:10, color:'#666', marginBottom:4 }}>
                <span style={{ color:RED }}>● </span>Strike
                <span style={{ color:'#88ccff' }}> ● </span>Bola
                <span style={{ color:RED }}> ○ </span>Gran mov
                <span style={{ color:'#FF8C00' }}> ○ </span>Buen mov
                <span style={{ color:'#003366' }}> ○ </span>Mal mov
              </div>
              <ZonePlot pitches={r.locations}/>
            </div>
          )}
        </div>

      </div>

      {/* Footer */}
      <div style={{ background:'#0a0a0a', padding:'10px 20px', display:'flex', justifyContent:'space-between', borderTop:`1px solid #222` }}>
        <span style={{ fontSize:10, color:'#444' }}>DSL Miami Marlins · Catchers</span>
        <span style={{ fontSize:10, color:'#444' }}>{gameDate}</span>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function GameSummary() {
  const { gameId } = useParams()
  const nav = useNavigate()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const printRef = useRef()

  useEffect(() => {
    api.get(`/games/${gameId}/summary`).then(r => {
      setSummary(r.data)
      setLoading(false)
    })
  }, [gameId])

  function handlePrint() {
    window.print()
  }

  if (loading) return <div className="page" style={{ color:'#888' }}>Cargando resumen...</div>
  if (!summary || summary.catchers.length === 0) return <div className="page" style={{ color:'#888' }}>Sin datos para este juego.</div>

  const game = summary.game

  return (
    <div className="page" ref={printRef}>
      <style>{`
        @media print {
          nav, .no-print { display: none !important; }
          body { background: #000 !important; }
        }
      `}</style>

      <div className="no-print" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <button className="btn-ghost" onClick={() => nav(-1)}>← Volver</button>
        <h2 style={{ margin:0 }}>Resumen del Juego</h2>
        <button className="btn-primary" onClick={handlePrint}>🖨️ Imprimir / PDF</button>
      </div>

      <div style={{ color:'#888', fontSize:13, marginBottom:20 }}>
        {game.game_date}{game.opponent ? ` · vs ${game.opponent}` : ''}
      </div>

      {summary.catchers.map(c => (
        <CatcherCard
          key={c.player_id}
          catcher={c}
          gameDate={game.game_date}
          opponent={game.opponent}
        />
      ))}
    </div>
  )
}
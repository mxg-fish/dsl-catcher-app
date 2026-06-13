import { useState, useEffect, useCallback } from 'react'
import api from '../api'
import { enqueue } from '../offlineQueue'
import StrikeZone from '../components/StrikeZone'
import SecondBase from '../components/SecondBase'

const TABS = ['⚡ Tirar', '🛡️ Bloquear', '🤲 Recibir']

// ── Inning Review Modal ───────────────────────────────────────────────────────
function InningReview({ pitches, inning, onClose, onNextInning }) {
  const strikes = pitches.filter(p => p.is_strike)
  const balls   = pitches.filter(p => !p.is_strike)
  const good    = pitches.filter(p => p.quality === 'good')
  const bad     = pitches.filter(p => p.quality === 'bad')

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
      zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 16
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <h2 style={{ textAlign: 'center', marginBottom: 4 }}>Entrada {inning} — Revisión</h2>
        <p style={{ textAlign: 'center', color: '#888', fontSize: 13, marginBottom: 16 }}>
          Muéstrale esto al catcher antes de continuar
        </p>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { val: pitches.length, lbl: 'Total', color: '#e0e0e0' },
            { val: strikes.length, lbl: 'Strikes', color: '#e63946' },
            { val: balls.length,   lbl: 'Bolas',   color: '#74b9ff' },
            { val: good.length,    lbl: 'Buenos',  color: '#00b894' },
            { val: bad.length,     lbl: 'Malos',   color: '#e17055' },
          ].map(s => (
            <div key={s.lbl} style={{ flex: 1, background: '#1a1a1a', borderRadius: 8, padding: '10px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 10, color: '#888' }}>{s.lbl}</div>
            </div>
          ))}
        </div>

        {/* Full zone with all pitches */}
        <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <StrikeZone pitches={pitches} selected={null} onSelect={() => {}} reviewMode />
        </div>

        {/* Pitch list */}
        <div style={{ background: '#1a1a1a', borderRadius: 8, padding: 12, marginBottom: 16, maxHeight: 160, overflowY: 'auto' }}>
          {pitches.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #222', fontSize: 13 }}>
              <span>#{i + 1} {p.quality === 'good' ? '✅ Buen Mov.' : '❌ Mal Mov.'}</span>
              <span style={{ color: p.is_strike ? '#e63946' : '#74b9ff' }}>{p.is_strike ? 'Strike' : 'Bola'}</span>
              {p.note && <span style={{ color: '#666', fontSize: 11 }}>{p.note}</span>}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost col" onClick={onClose}>← Volver</button>
          <button className="btn-primary col btn-lg" onClick={onNextInning}>
            Siguiente Entrada →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function GameTracker() {
  const [seasons, setSeasons] = useState([])
  const [weeks,   setWeeks]   = useState([])
  const [games,   setGames]   = useState([])
  const [players, setPlayers] = useState([])

  const [seasonId, setSeasonId] = useState('')
  const [weekId,   setWeekId]   = useState('')
  const [gameId,   setGameId]   = useState('')
  const [playerId, setPlayerId] = useState('')
  const [tab,      setTab]      = useState(0)
  const [inning,   setInning]   = useState(1)

  const [log, setLog] = useState({ throws: [], blocks: [], receiving: [] })

  // New game form
  const [newDate,     setNewDate]     = useState(new Date().toISOString().slice(0, 10))
  const [newOpponent, setNewOpponent] = useState('')
  const [showNewGame, setShowNewGame] = useState(false)

  // ── Throw form state ───────────────────────────────────────────────────────
  const [popTime,   setPopTime]   = useState('')
  const [accurate,  setAccurate]  = useState(true)
  const [exchange,  setExchange]  = useState(false)
  const [cs,        setCs]        = useState(false)
  const [throwLoc,  setThrowLoc]  = useState(null)   // {x, y} in feet from center of bag
  const [inDirt,    setInDirt]    = useState(false)
  const [throwType, setThrowType] = useState('game')

  // ── Back pick state (per base) ─────────────────────────────────────────────
  const [bpState, setBpState] = useState({
    '1B': { accurate: true, out: false },
    '2B': { accurate: true, out: false },
    '3B': { accurate: true, out: false },
  })

  // ── Block form state ───────────────────────────────────────────────────────
  const [blockLoc,   setBlockLoc]   = useState('middle')
  const [blocked,    setBlocked]    = useState(true)
  const [passedBall, setPassedBall] = useState(false)
  const [wildPitch,  setWildPitch]  = useState(false)
  const [isPick,     setIsPick]     = useState(false)
  const [blockXY,    setBlockXY]    = useState(null)
  
  // ── Receiving form state ───────────────────────────────────────────────────
  const [recvQuality, setRecvQuality] = useState('good')
  const [recvStrike,  setRecvStrike]  = useState(true)
  const [recvNote,    setRecvNote]    = useState('')
  const [pitchLoc,    setPitchLoc]    = useState(null)
  const [pitcherHand, setPitcherHand] = useState(null)  // 'R' | 'L'
  const [pitchType,   setPitchType]   = useState(null)  // 'hard' | 'soft' | 'breaking'

  // Inning buffer — pitches logged this inning before submission
  const [inningBuffer, setInningBuffer] = useState([])
  const [showReview,   setShowReview]   = useState(false)

  const [toast, setToast] = useState('')

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2000) }

  // ── Data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/seasons').then(r => { setSeasons(r.data); if (r.data[0]) setSeasonId(String(r.data[0].id)) })
    api.get('/players').then(r => { setPlayers(r.data); if (r.data[0]) setPlayerId(String(r.data[0].id)) })
  }, [])

  useEffect(() => {
    if (!seasonId) return
    api.get(`/seasons/${seasonId}/weeks`).then(r => {
      setWeeks(r.data)
      if (r.data.at(-1)) setWeekId(String(r.data.at(-1).id))
    })
  }, [seasonId])

  useEffect(() => {
    if (!weekId) return
    api.get(`/weeks/${weekId}/games`).then(r => {
      setGames(r.data)
      if (r.data.at(-1)) setGameId(String(r.data.at(-1).id))
    })
  }, [weekId])

  const loadLog = useCallback(() => {
    if (!gameId) return
    api.get(`/games/${gameId}/log`).then(r => setLog(r.data)).catch(() => {})
  }, [gameId])

  useEffect(() => { loadLog() }, [loadLog])

  // ── Post helper (online/offline) ───────────────────────────────────────────
  async function postEvent(endpoint, payload, queueType) {
    if (navigator.onLine) {
      try {
        await api.post(endpoint, payload)
        loadLog()
        return true
      } catch { /* fall through */ }
    }
    await enqueue(parseInt(gameId), queueType, payload)
    const playerName = players.find(p => String(p.id) === playerId)?.name
    setLog(prev => ({
      ...prev,
      [queueType + 's']: [{ ...payload, player_name: playerName, _offline: true, id: Date.now() }, ...prev[queueType + 's']]
    }))
    return false
  }

  // ── Add game ───────────────────────────────────────────────────────────────
  async function addGame() {
    if (!weekId) return
    const { data } = await api.post(`/weeks/${weekId}/games`, { game_date: newDate, opponent: newOpponent })
    const updated  = await api.get(`/weeks/${weekId}/games`)
    setGames(updated.data)
    setGameId(String(data.id))
    setShowNewGame(false)
    setNewOpponent('')
  }

  // ── Log throw ──────────────────────────────────────────────────────────────
  async function logThrow() {
    if (!gameId || !playerId) return showToast('Selecciona juego y catcher')
    const online = await postEvent(`/games/${gameId}/throws`, {
      player_id: parseInt(playerId),
      pop_time: popTime ? parseFloat(popTime) : null,
      accurate, exchange_error: exchange, back_pick: false, caught_stealing: cs,
      throw_x: throwLoc?.x ?? null,
      throw_y: throwLoc?.y ?? null,
      in_dirt: inDirt,
      inning,
      throw_type: throwType,
    }, 'throw')
    showToast(online ? '✅ Tiro registrado' : '📥 Guardado offline')
    setPopTime(''); setAccurate(true); setExchange(false)
    setCs(false); setThrowLoc(null); setInDirt(false); setThrowType('game')
  }

  // ── Log back pick ──────────────────────────────────────────────────────────
  async function logBackPick(base) {
    if (!gameId) return showToast('Selecciona un juego primero')
    if (!playerId) return showToast('Selecciona un catcher primero')
    try {
      const bp = bpState[base]
      const online = await postEvent(`/games/${gameId}/throws`, {
        player_id: parseInt(playerId),
        back_pick: true,
        back_pick_base: base,
        accurate: bp.accurate,
        bp_out: bp.out,
        inning,
      }, 'throw')
      showToast(online ? `✅ BP ${base} registrado` : '📥 Guardado offline')
      setBpState(prev => ({ ...prev, [base]: { accurate: true, out: false } }))
    } catch (err) {
      showToast(`❌ Error: ${err?.message || 'desconocido'}`)
    }
  }

  // ── Log block ──────────────────────────────────────────────────────────────
  async function logBlock() {
    if (!gameId || !playerId) return showToast('Selecciona juego y catcher')
    const online = await postEvent(`/games/${gameId}/blocks`, {
      player_id: parseInt(playerId), location: blockLoc,
      blocked, passed_ball: passedBall, wild_pitch: wildPitch,
      is_pick: isPick,
      block_x: blockXY?.x ?? null,
      block_y: blockXY?.y ?? null,
    }, 'block')
    showToast(online ? '✅ Bloqueo registrado' : '📥 Guardado offline')
    setBlocked(true); setPassedBall(false); setWildPitch(false)
    setIsPick(false); setBlockXY(null)
  }

  // ── Log receiving (to inning buffer first) ─────────────────────────────────
  function addToInningBuffer() {
    if (!pitchLoc) return showToast('Toca la zona para marcar ubicación')
    if (!pitcherHand || !pitchType) return showToast('Selecciona tipo de lanzador y pitcheo')
    const pitch = {
      player_id: parseInt(playerId),
      quality: recvQuality,
      is_strike: recvStrike,
      pitch_x: pitchLoc.x,
      pitch_y: pitchLoc.y,
      note: recvNote,
      inning,
      pitcher_hand: pitcherHand,
      pitch_type: pitchType,
      player_name: players.find(p => String(p.id) === playerId)?.name,
      id: Date.now(),
    }
    setInningBuffer(prev => [...prev, pitch])
    setPitchLoc(null); setRecvNote('')
    setPitcherHand(null); setPitchType(null)
    showToast('✅ Añadido a la entrada')
  }

  // Submit entire inning buffer to the server
  async function submitInningBuffer() {
    if (!gameId || !playerId) return
    for (const pitch of inningBuffer) {
      const { player_name, id, ...payload } = pitch
      await postEvent(`/games/${gameId}/receiving`, payload, 'receiving')
    }
    setShowReview(true)
  }

  function nextInning() {
    setInningBuffer([])
    setShowReview(false)
    setInning(i => i + 1)
    showToast(`Entrada ${inning + 1}`)
  }

  async function undoLast(type) {
    if (!gameId || !playerId) return
    if (type === 'receiving' && inningBuffer.length > 0) {
      setInningBuffer(prev => prev.slice(0, -1))
      showToast('↩ Deshecho del buffer')
      return
    }
    await api.delete(`/games/${gameId}/last-event?event_type=${type}&player_id=${playerId}`)
    loadLog()
    showToast('↩ Deshecho')
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const myThrows = log.throws.filter(t => String(t.player_id) === playerId)
  const myBlocks = log.blocks.filter(b => String(b.player_id) === playerId)
  const myRecv   = log.receiving.filter(r => String(r.player_id) === playerId)
  const accuratePct = myThrows.length ? Math.round((myThrows.filter(t => t.accurate).length / myThrows.length) * 100) : 0
  const blockPct    = myBlocks.length ? Math.round((myBlocks.filter(b => b.blocked).length  / myBlocks.length) * 100) : 0

  // Throws for the 2B diagram (current player, current game)
  const throwsForDiagram = myThrows.filter(t => t.throw_x != null)

  // All receiving events for the zone (submitted + current buffer)
  const allRecvForZone = [...myRecv, ...inningBuffer]

  return (
    <div className="page">
      {showReview && (
        <InningReview
          pitches={inningBuffer}
          inning={inning}
          onClose={() => setShowReview(false)}
          onNextInning={nextInning}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', top: 48, left: '50%', transform: 'translateX(-50%)', background: '#222', padding: '8px 20px', borderRadius: 20, fontSize: 14, zIndex: 200 }}>
          {toast}
        </div>
      )}

      {/* Setup row */}
      <div className="card">
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="col">
            <label>Temporada</label>
            <select value={seasonId} onChange={e => setSeasonId(e.target.value)}>
              {seasons.map(s => <option key={s.id} value={s.id}>{s.year}</option>)}
            </select>
          </div>
          <div className="col">
            <label>Semana</label>
            <select value={weekId} onChange={e => setWeekId(e.target.value)}>
              {weeks.map(w => <option key={w.id} value={w.id}>Semana {w.week_number}</option>)}
            </select>
          </div>
          <div className="col">
            <label>Juego</label>
            <select value={gameId} onChange={e => setGameId(e.target.value)}>
              {games.map(g => <option key={g.id} value={g.id}>{g.game_date} {g.opponent ? `vs ${g.opponent}` : ''}</option>)}
            </select>
          </div>
          <div style={{ alignSelf: 'flex-end', display:'flex', gap:8 }}>
            <button className="btn-success" onClick={() => setShowNewGame(!showNewGame)}>+ Juego</button>
            {gameId && (
              <button className="btn-primary" onClick={async () => {
                await api.patch(`/games/${gameId}/complete`)
                window.location.href = `/summary/${gameId}`
              }}>Finalizar Juego →</button>
            )}
          </div>
        </div>
        {showNewGame && (
          <div className="row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
            <div className="col"><label>Fecha</label><input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} /></div>
            <div className="col"><label>Oponente</label><input value={newOpponent} onChange={e => setNewOpponent(e.target.value)} placeholder="ej. Tigres" /></div>
            <div style={{ alignSelf: 'flex-end' }}><button className="btn-primary" onClick={addGame}>Crear</button></div>
          </div>
        )}
      </div>

      {/* Catcher + Inning selector */}
      <div className="card">
        <div className="row" style={{ gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label>Catcher</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {players.map(p => (
                <button key={p.id}
                  onClick={() => setPlayerId(String(p.id))}
                  style={{
                    padding: '8px 14px', borderRadius: 20, fontSize: 13,
                    background: String(p.id) === playerId ? '#e63946' : '#2a2a2a',
                    color: String(p.id) === playerId ? '#fff' : '#aaa',
                  }}>
                  {p.name.split(' ').slice(-1)[0]}
                </button>
              ))}
            </div>
          </div>
          <div style={{ minWidth: 100 }}>
            <label>Entrada</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <button className="btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setInning(i => Math.max(1, i - 1))}>−</button>
              <span style={{ fontWeight: 700, fontSize: 18, minWidth: 24, textAlign: 'center' }}>{inning}</span>
              <button className="btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setInning(i => i + 1)}>+</button>
            </div>
          </div>
        </div>
      </div>

      {/* Live stats */}
      {gameId && (
        <div className="row" style={{ gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Tiros', val: `${myThrows.filter(t => t.accurate).length}/${myThrows.length}`, sub: `${accuratePct}% preciso` },
            { label: 'Bloqueos', val: `${myBlocks.filter(b => b.blocked).length}/${myBlocks.length}`, sub: `${blockPct}%` },
            { label: 'Buenos', val: myRecv.filter(r => r.quality === 'good').length + inningBuffer.filter(r => r.quality === 'good').length },
            { label: 'Malos',  val: myRecv.filter(r => r.quality === 'bad').length  + inningBuffer.filter(r => r.quality === 'bad').length },
            { label: 'Buffer', val: inningBuffer.length, sub: 'esta entrada', color: '#e9c46a' },
          ].map(s => (
            <div key={s.label} className="card col center" style={{ padding: '10px 4px', margin: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color || '#e63946' }}>{s.val}</div>
              <div style={{ fontSize: 10, color: '#888' }}>{s.label}</div>
              {s.sub && <div style={{ fontSize: 10, color: '#666' }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Event tabs */}
      <div className="card">
        <div style={{ display: 'flex', borderBottom: '1px solid #2a2a2a', marginBottom: 16 }}>
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              style={{
                flex: 1, background: 'none', borderRadius: 0,
                borderBottom: i === tab ? '2px solid #e63946' : '2px solid transparent',
                color: i === tab ? '#fff' : '#888', padding: '10px 4px', fontSize: 13,
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* ── TIRAR ── */}
        {tab === 0 && (
          <div>
            <label>Tipo de Tiro</label>
            <div className="row" style={{ marginTop: 4, marginBottom: 12 }}>
              {[['game', '⚾ Juego'], ['between', '↔ Entre Entradas'], ['practice', '🏋️ Práctica']].map(([val, lbl]) => (
                <button key={val} className="col"
                  style={{
                    background: throwType === val ? '#1a3a5c' : '#2a2a2a',
                    color: throwType === val ? '#74b9ff' : '#888',
                    fontSize: 12,
                  }}
                  onClick={() => setThrowType(val)}>{lbl}</button>
              ))}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="col">
                <label>Tiempo (seg)</label>
                <input type="number" step="0.01" min="1.5" max="4" value={popTime}
                  onChange={e => setPopTime(e.target.value)} placeholder="2.05" />
              </div>
              <div className="col">
                <label>¿Preciso?</label>
                <div className="row" style={{ marginTop: 4 }}>
                  <button className={accurate  ? 'btn-success col' : 'btn-ghost col'} onClick={() => setAccurate(true)}>✅ Sí</button>
                  <button className={!accurate ? 'btn-danger col'  : 'btn-ghost col'} onClick={() => setAccurate(false)}>❌ No</button>
                </div>
              </div>
            </div>

            <div className="row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
              {[
                ['exchange', exchange, setExchange, 'Error Intercambio'],
                ['cs',       cs,       setCs,       'CS (Out)'],
              ].map(([k, val, set, lbl]) => (
                <button key={k} onClick={() => set(!val)}
                  style={{
                    flex: '0 0 auto', padding: '8px 14px', fontSize: 12, borderRadius: 20,
                    background: val ? '#1a3a5c' : '#2a2a2a', color: val ? '#74b9ff' : '#666',
                  }}>
                  {val ? '✓' : '○'} {lbl}
                </button>
              ))}
            </div>

            {/* In-dirt toggle */}
            <div style={{ marginTop: 14 }}>
              <button onClick={() => setInDirt(!inDirt)}
                style={{
                  padding: '8px 18px', borderRadius: 20, fontSize: 13,
                  background: inDirt ? '#3d2b1a' : '#2a2a2a', color: inDirt ? '#cd8b4a' : '#666',
                  border: inDirt ? '1px solid #8b5a2b' : '1px solid transparent',
                }}>
                {inDirt ? '🟫 En tierra' : '○ En tierra'}
              </button>
            </div>

            {/* 2B diagram */}
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                Toca donde llegó el tiro en segunda base (cada cuadro = 1 pie):
              </p>
              <SecondBase
                selected={throwLoc}
                onSelect={loc => { setThrowLoc(loc); setAccurate(loc.inZone) }}
                throws={throwsForDiagram}
              />
            </div>

            <div className="row" style={{ marginTop: 14, gap: 8 }}>
              <button className="btn-primary btn-full btn-lg" onClick={logThrow}>Registrar Tiro</button>
              <button className="btn-ghost" onClick={() => undoLast('throw')} title="Deshacer">↩</button>
            </div>

            {/* ── Back Picks ── */}
            <div style={{ marginTop: 24, borderTop: '1px solid #2a2a2a', paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#aaa', marginBottom: 12, letterSpacing: 1 }}>
                BACK PICKS
              </div>
              {['1B', '2B', '3B'].map(base => {
                const bp = bpState[base]
                return (
                  <div key={base} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 10, background: '#1a1a1a', borderRadius: 10, padding: '10px 12px',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#e63946', minWidth: 24 }}>{base}</span>
                    {/* Accurate toggle */}
                    <button
                      onClick={() => setBpState(p => ({ ...p, [base]: { ...p[base], accurate: !p[base].accurate } }))}
                      style={{
                        padding: '5px 12px', borderRadius: 16, fontSize: 12,
                        background: bp.accurate ? '#1a3a1a' : '#3a1a1a',
                        color: bp.accurate ? '#6fcf97' : '#eb5757',
                      }}>
                      {bp.accurate ? '✅ Preciso' : '❌ Impreciso'}
                    </button>
                    {/* Out toggle */}
                    <button
                      onClick={() => setBpState(p => ({ ...p, [base]: { ...p[base], out: !p[base].out } }))}
                      style={{
                        padding: '5px 12px', borderRadius: 16, fontSize: 12,
                        background: bp.out ? '#1a3a5c' : '#2a2a2a',
                        color: bp.out ? '#74b9ff' : '#666',
                      }}>
                      {bp.out ? '✓ Out (+1)' : '○ Out'}
                    </button>
                    {/* Log button */}
                    <button
                      onClick={() => logBackPick(base)}
                      style={{
                        marginLeft: 'auto', padding: '6px 14px', borderRadius: 16,
                        fontSize: 12, background: '#e63946', color: '#fff', fontWeight: 700,
                      }}>
                      Registrar
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── BLOQUEAR ── */}
        {tab === 1 && (
          <div>
            <label>Ubicación</label>
            <div className="row" style={{ marginTop: 4 }}>
              {[['middle', 'Centro'], ['gloveside', 'Guante'], ['armside', 'Brazo']].map(([val, lbl]) => (
                <button key={val} className="col"
                  style={{ background: blockLoc === val ? '#1a3a5c' : '#2a2a2a', color: blockLoc === val ? '#74b9ff' : '#888' }}
                  onClick={() => setBlockLoc(val)}>{lbl}</button>
              ))}
            </div>
            <label style={{ marginTop: 14 }}>Resultado</label>
            <div className="row" style={{ marginTop: 4 }}>
              <button className={blocked     ? 'btn-success col' : 'btn-ghost col'} onClick={() => { setBlocked(true);  setPassedBall(false); setWildPitch(false) }}>✅ Bloqueado</button>
              <button className={passedBall  ? 'btn-danger col'  : 'btn-ghost col'} onClick={() => { setBlocked(false); setPassedBall(true);  setWildPitch(false) }}>PB</button>
              <button className={wildPitch   ? 'btn-danger col'  : 'btn-ghost col'} onClick={() => { setBlocked(false); setPassedBall(false); setWildPitch(true)  }}>WP</button>
              <button className={!blocked && !passedBall && !wildPitch ? 'btn-danger col' : 'btn-ghost col'}
                onClick={() => { setBlocked(false); setPassedBall(false); setWildPitch(false) }}>❌ No Bloq.</button>
            </div>
            {/* Pick toggle */}
            <div style={{ marginTop: 14 }}>
              <button onClick={() => setIsPick(!isPick)}
                style={{
                  padding: '8px 18px', borderRadius: 20, fontSize: 13,
                  background: isPick ? '#1a3a5c' : '#2a2a2a',
                  color: isPick ? '#74b9ff' : '#666',
                  border: isPick ? '1px solid #2980b9' : '1px solid transparent',
                }}>
                {isPick ? '🧤 Pick' : '○ Pick'}
              </button>
            </div>

            {/* Overhead plate grid */}
            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                Toca donde bloqueó — sin toque = bola en el aire:
              </p>
              <svg viewBox="0 0 300 300" width="100%" style={{ maxWidth: 300, display: 'block', margin: '0 auto', cursor: 'crosshair', background: '#1a1a1a', borderRadius: 8 }}
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = (e.clientX - rect.left) / rect.width
                  const y = (e.clientY - rect.top) / rect.height
                  setBlockXY({ x, y })
                }}>
                {/* Dirt area background */}
                <rect x="0" y="0" width="300" height="300" fill="#2a1f14" rx="8"/>
                {/* Grid lines every ~30px = 1ft */}
                {[0,1,2,3,4,5,6,7,8,9,10].map(i => (
                  <line key={`gv${i}`} x1={i*30} y1={0} x2={i*30} y2={300} stroke="#333" strokeWidth="0.5"/>
                ))}
                {[0,1,2,3,4,5,6,7,8,9,10].map(i => (
                  <line key={`gh${i}`} x1={0} y1={i*30} x2={300} y2={i*30} stroke="#333" strokeWidth="0.5"/>
                ))}
                {/* Home plate — centered at 150,180, ~60px wide */}
                <polygon points="150,240 110,215 110,155 190,155 190,215" fill="#3a3a3a" stroke="#888" strokeWidth="2"/>
                {/* Plate inner white */}
                <polygon points="150,232 116,210 116,162 184,162 184,210" fill="#555" stroke="#aaa" strokeWidth="1"/>
                {/* Center dot */}
                <circle cx="150" cy="190" r="3" fill="#888"/>
                {/* Labels */}
                <text x="150" y="148" fill="#666" fontSize="9" textAnchor="middle">5ft</text>
                <text x="150" y="295" fill="#666" fontSize="9" textAnchor="middle">HOME</text>
                <text x="8" y="150" fill="#666" fontSize="9">5ft</text>
                <text x="270" y="150" fill="#666" fontSize="9">5ft</text>
                <text x="60" y="185" fill="#555" fontSize="8" textAnchor="middle">GS</text>
                <text x="240" y="185" fill="#555" fontSize="8" textAnchor="middle">AS</text>
                {/* Selected dot */}
                {blockXY && (
                  <circle cx={blockXY.x * 300} cy={blockXY.y * 300} r="8"
                    fill="#e63946" fillOpacity="0.85" stroke="#fff" strokeWidth="1.5"/>
                )}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                {blockXY ? (
                  <p style={{ fontSize: 11, color: '#e9c46a', margin: 0 }}>
                    🟫 En tierra — {blockXY.x < 0.4 ? 'Lado Guante' : blockXY.x > 0.6 ? 'Lado Brazo' : 'Centro'}
                  </p>
                ) : (
                  <p style={{ fontSize: 11, color: '#74b9ff', margin: 0 }}>🌀 Bola en el aire</p>
                )}
                {blockXY && (
                  <button onClick={() => setBlockXY(null)}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 12, background: '#2a2a2a', color: '#888' }}>
                    ✕ Limpiar
                  </button>
                )}
              </div>
            </div>
            <div className="row" style={{ marginTop: 14, gap: 8 }}>
              <button className="btn-primary btn-full btn-lg" onClick={logBlock}>Registrar Bloqueo</button>
              <button className="btn-ghost" onClick={() => undoLast('block')} title="Deshacer">↩</button>
            </div>
          </div>
        )}
        {/* ── RECIBIR ── */}
        {tab === 2 && (
          <div>
            <div className="row" style={{ marginBottom: 12, gap: 4 }}>
              <button className={recvQuality === 'great' ? 'btn-success col btn-lg' : 'btn-ghost col btn-lg'} onClick={() => setRecvQuality('great')}>⭐ Gran Mov.</button>
              <button className={recvQuality === 'good'  ? 'btn-success col btn-lg' : 'btn-ghost col btn-lg'} onClick={() => setRecvQuality('good')}>✅ Buen Mov.</button>
              <button className={recvQuality === 'bad'   ? 'btn-danger col btn-lg'  : 'btn-ghost col btn-lg'} onClick={() => setRecvQuality('bad')}>❌ Mal Mov.</button>
            </div>
            <div className="row" style={{ marginBottom: 12 }}>
              <button className={recvStrike  ? 'btn-primary col' : 'btn-ghost col'} onClick={() => setRecvStrike(true)}>Strike</button>
              <button className={!recvStrike ? 'btn-primary col' : 'btn-ghost col'} onClick={() => setRecvStrike(false)}>Bola</button>
            </div>

            {/* Pitcher hand + pitch type selector flanking the zone */}
            <p style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
              Selecciona lanzador y tipo, luego toca la zona:
            </p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>

              {/* LEFT — LHP */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 72 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#74b9ff', textAlign: 'center', marginBottom: 2 }}>← LHP</div>
                {['hard','soft','breaking'].map(pt => (
                  <button key={pt} onClick={() => { setPitcherHand('L'); setPitchType(pt) }}
                    style={{
                      padding: '8px 4px', borderRadius: 8, fontSize: 11, textAlign: 'center',
                      background: pitcherHand === 'L' && pitchType === pt ? '#1a3a5c' : '#2a2a2a',
                      color: pitcherHand === 'L' && pitchType === pt ? '#74b9ff' : '#666',
                      border: pitcherHand === 'L' && pitchType === pt ? '1px solid #2980b9' : '1px solid transparent',
                      fontWeight: pitcherHand === 'L' && pitchType === pt ? 700 : 400,
                    }}>
                    {pt === 'hard' ? '🔥 Dura' : pt === 'soft' ? '🫧 Suave' : '🌀 Curva'}
                  </button>
                ))}
              </div>

              {/* CENTER — Strike zone */}
              <div style={{ flex: 1 }}>
                <StrikeZone
                  selected={pitchLoc}
                  onSelect={setPitchLoc}
                  pitches={allRecvForZone.filter(r => r.pitch_x != null && r.inning === inning)}
                />
              </div>

              {/* RIGHT — RHP */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 72 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#e17055', textAlign: 'center', marginBottom: 2 }}>RHP →</div>
                {['hard','soft','breaking'].map(pt => (
                  <button key={pt} onClick={() => { setPitcherHand('R'); setPitchType(pt) }}
                    style={{
                      padding: '8px 4px', borderRadius: 8, fontSize: 11, textAlign: 'center',
                      background: pitcherHand === 'R' && pitchType === pt ? '#3a1a1a' : '#2a2a2a',
                      color: pitcherHand === 'R' && pitchType === pt ? '#e17055' : '#666',
                      border: pitcherHand === 'R' && pitchType === pt ? '1px solid #c0392b' : '1px solid transparent',
                      fontWeight: pitcherHand === 'R' && pitchType === pt ? 700 : 400,
                    }}>
                    {pt === 'hard' ? '🔥 Dura' : pt === 'soft' ? '🫧 Suave' : '🌀 Curva'}
                  </button>
                ))}
              </div>
            </div>

            {/* Selection confirmation */}
            {(pitcherHand || pitchType) && (
              <p style={{ fontSize: 11, color: pitcherHand === 'L' ? '#74b9ff' : '#e17055', textAlign: 'center', marginTop: 6 }}>
                {pitcherHand === 'L' ? 'LHP' : 'RHP'} — {pitchType === 'hard' ? '🔥 Dura' : pitchType === 'soft' ? '🫧 Suave' : '🌀 Curva'}
              </p>
            )}

            {pitchLoc && (
              <p style={{ fontSize: 11, color: '#555', textAlign: 'center', marginTop: 4 }}>
                Seleccionado — listo para añadir
              </p>
            )}

            <label>Nota (opcional)</label>
            <input value={recvNote} onChange={e => setRecvNote(e.target.value)} placeholder="ej. Framing strike exterior" />

            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <button className="btn-success col btn-lg" onClick={addToInningBuffer}>
                + Añadir a Entrada {inning}
              </button>
              <button className="btn-ghost" onClick={() => undoLast('receiving')} title="Deshacer último">↩</button>
            </div>

            {/* Inning buffer preview */}
            {inningBuffer.length > 0 && (
              <div style={{ marginTop: 14, background: '#111', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: '#888' }}>Entrada {inning} — {inningBuffer.length} lanzamiento{inningBuffer.length !== 1 ? 's' : ''}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ color: '#e63946', fontSize: 12 }}>{inningBuffer.filter(p => p.is_strike).length} Strikes</span>
                    <span style={{ color: '#74b9ff', fontSize: 12 }}>{inningBuffer.filter(p => !p.is_strike).length} Bolas</span>
                  </div>
                </div>
                {inningBuffer.map((p, i) => (
                  <div key={p.id} style={{ fontSize: 12, color: '#aaa', padding: '3px 0', borderBottom: '1px solid #1a1a1a' }}>
                    #{i + 1} {p.quality === 'great' ? '⭐' : p.quality === 'good' ? '✅' : '❌'} {p.is_strike ? <span style={{ color: '#e63946' }}>Strike</span> : <span style={{ color: '#74b9ff' }}>Bola</span>}
                    {' '}{p.pitcher_hand}{p.pitch_type ? ` ${p.pitch_type}` : ''}
                    {p.note && <span style={{ color: '#555' }}> — {p.note}</span>}
                  </div>
                ))}
                <button className="btn-primary btn-full" style={{ marginTop: 12 }} onClick={submitInningBuffer}>
                  Terminar Entrada {inning} — Ver Resumen
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Recent events */}
      <div className="card" style={{ maxHeight: 220, overflowY: 'auto' }}>
        <h3 style={{ marginBottom: 8 }}>Eventos del Juego</h3>
        {log.throws.slice(0, 6).map(t => (
          <div key={t.id} className="badge badge-blue" style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
            E{t.inning ?? '?'} {t.player_name} — {t.throw_type === 'between' ? '↔' : t.throw_type === 'practice' ? '🏋️' : '⚾'} Tiro {t.accurate ? '✅' : '❌'} {t.pop_time ? `${t.pop_time}s` : ''} {t.in_dirt ? '🟫' : ''} {t._offline ? '📥' : ''}
          </div>
        ))}
        {log.blocks.slice(0, 6).map(b => (
          <div key={b.id} className={`badge ${b.blocked ? 'badge-green' : 'badge-red'}`} style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
            {b.player_name} — Bloqueo {b.blocked ? '✅' : '❌'} ({b.location}) {b._offline ? '📥' : ''}
          </div>
        ))}
        {log.receiving.slice(0, 6).map(r => (
          <div key={r.id} className={`badge ${r.quality === 'great' ? 'badge-green' : r.quality === 'good' ? 'badge-green' : 'badge-red'}`} style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>
            E{r.inning ?? '?'} {r.player_name} — {r.quality === 'great' ? '⭐ Gran' : r.quality === 'good' ? '✅ Buen' : '❌ Mal'} Mov {r.is_strike ? 'Strike' : 'Bola'} {r._offline ? '📥' : ''}
          </div>
        ))}
        {log.throws.length + log.blocks.length + log.receiving.length === 0 && (
          <p style={{ color: '#666', fontSize: 13 }}>Sin eventos aún.</p>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import api from '../api'

const CATS = [
  ['liderazgo','Liderazgo',12,'#4ecdc4'],
  ['recibir','Recibir',30,'#45b7d1'],
  ['practica','Práctica',24,'#96ceb4'],
  ['blockear','Blockear',17,'#ffeaa7'],
  ['tirar','Tirar',17,'#e63946'],
]

function ScoreBar({ value, max, color }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div style={{ background:'#2a2a2a', borderRadius:4, height:6, width:'100%' }}>
      <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:4, transition:'width .4s' }} />
    </div>
  )
}

export default function Weekly() {
  const [seasons, setSeasons] = useState([])
  const [weeks,   setWeeks]   = useState([])
  const [seasonId, setSeasonId] = useState('')
  const [weekId,   setWeekId]   = useState('')
  const [scores,   setScores]   = useState([])
  const [loading,  setLoading]  = useState(false)

  useEffect(() => { api.get('/seasons').then(r => { setSeasons(r.data); if (r.data[0]) setSeasonId(String(r.data[0].id)) }) }, [])
  useEffect(() => {
    if (!seasonId) return
    api.get(`/seasons/${seasonId}/weeks`).then(r => { setWeeks(r.data); if (r.data.at(-1)) setWeekId(String(r.data.at(-1).id)) })
  }, [seasonId])
  useEffect(() => {
    if (!weekId) return
    setLoading(true)
    api.get(`/weeks/${weekId}/leaderboard`).then(r => setScores(r.data)).finally(() => setLoading(false))
  }, [weekId])

  const medals = ['🥇','🥈','🥉']

  return (
    <div className="page">
      <h2>🏆 Leaderboard Semanal</h2>
      <div className="row" style={{ marginBottom:16, gap:8 }}>
        <div className="col">
          <select value={seasonId} onChange={e=>setSeasonId(e.target.value)}>
            {seasons.map(s=><option key={s.id} value={s.id}>{s.year}</option>)}
          </select>
        </div>
        <div className="col">
          <select value={weekId} onChange={e=>setWeekId(e.target.value)}>
            {weeks.map(w=><option key={w.id} value={w.id}>Semana {w.week_number} ({w.start_date})</option>)}
          </select>
        </div>
      </div>

      {loading && <p style={{ color:'#888' }}>Cargando...</p>}

      {scores.map((s, i) => (
        <div key={s.player_id} className="card" style={{ borderLeft: i===0 ? '3px solid #FFD700' : i===1 ? '3px solid #C0C0C0' : i===2 ? '3px solid #CD7F32' : '3px solid #2a2a2a' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:22 }}>{medals[i] || `#${s.rank}`}</span>
              <span style={{ fontWeight:700, fontSize:16 }}>{s.player_name}</span>
            </div>
            <span style={{ fontSize:22, fontWeight:700, color:'#e63946' }}>{s.total}</span>
          </div>
          {CATS.map(([key, label, max, color]) => (
            <div key={key} style={{ marginBottom:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#888', marginBottom:2 }}>
                <span>{label}</span><span>{s[key]} / {max}</span>
              </div>
              <ScoreBar value={s[key]} max={max} color={color} />
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap', fontSize:11, color:'#666' }}>
            <span>Tiros: {s.accurate_throws}/{s.throw_opps} ({s.accurate_throw_pct}%)</span>
            <span>Pop: {s.avg_pop_time ?? '—'}s</span>
            <span>Bloqueos: {s.blocks}/{s.block_chances} ({s.block_pct}%)</span>
            <span>SL+: {s.sl_plus ?? '—'}</span>
            <span>Buenos: {s.good_moves} | Malos: {s.bad_moves}</span>
          </div>
        </div>
      ))}

      {!loading && scores.length === 0 && <p style={{ color:'#666' }}>Sin datos para esta semana. Registra eventos en el Game Tracker.</p>}
    </div>
  )
}

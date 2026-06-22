import { useState, useEffect } from 'react'
import api from '../api'

const CATS = [
  ['recibir','Recibir',30,'#45b7d1'],
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

function getWeekTrainingDays(startDate, endDate) {
  const days = []
  let d = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (d <= end) {
    if (d.getDay() !== 0) {  // skip Sunday
      days.push(d.toISOString().slice(0,10))
    }
    d.setDate(d.getDate() + 1)
  }
  return days
}

function SegmentedBar({ label, value, max, trainingDays, breakdown, field }) {
  const byDate = {}
  breakdown.forEach(b => { byDate[b.date] = b[field] })
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#888', marginBottom:4 }}>
        <span>{label}</span><span>{value} / {max}</span>
      </div>
      <div style={{ display:'flex', gap:3 }}>
        {trainingDays.map(date => {
          const got = byDate[date] > 0
          return (
            <div key={date} title={date}
              style={{ flex:1, height:10, borderRadius:3, background: got ? '#00c896' : '#1a1a1a', border: got ? 'none' : '1px solid #333' }} />
          )
        })}
      </div>
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
  const [weekDates, setWeekDates] = useState(null)

  useEffect(() => { api.get('/seasons').then(r => { setSeasons(r.data); if (r.data[0]) setSeasonId(String(r.data[0].id)) }) }, [])
  useEffect(() => {
    if (!seasonId) return
    api.get(`/seasons/${seasonId}/weeks`).then(r => { setWeeks(r.data); if (r.data.at(-1)) setWeekId(String(r.data.at(-1).id)) })
  }, [seasonId])
  useEffect(() => {
    if (!weekId) return
    setLoading(true)
    api.get(`/weeks/${weekId}/leaderboard`).then(r => setScores(r.data)).finally(() => setLoading(false))
    const w = weeks.find(w => String(w.id) === weekId)
    if (w) setWeekDates({ start: w.start_date, end: w.end_date })
  }, [weekId, weeks])

  const medals = ['🥇','🥈','🥉']
  const trainingDays = weekDates ? getWeekTrainingDays(weekDates.start, weekDates.end) : []

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
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:22 }}>{medals[i] || `#${s.rank}`}</span>
              <span style={{ fontWeight:700, fontSize:16 }}>{s.player_name}</span>
            </div>
            <span style={{ fontSize:22, fontWeight:700, color:'#e63946' }}>{s.total}</span>
          </div>

          <SegmentedBar label="Liderazgo" value={s.liderazgo} max={12} trainingDays={trainingDays} breakdown={s.daily_breakdown || []} field="liderazgo" />
          <SegmentedBar label="Práctica" value={s.practica} max={24} trainingDays={trainingDays} breakdown={s.daily_breakdown || []} field="practica" />

          <div style={{ borderTop:'1px solid #2a2a2a', margin:'12px 0' }} />

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
            <span>Gran: {s.great_moves} | Buenos: {s.good_moves} | Malos: {s.bad_moves}</span>
          </div>
        </div>
      ))}

      {!loading && scores.length === 0 && <p style={{ color:'#666' }}>Sin datos para esta semana. Registra eventos en el Game Tracker.</p>}
    </div>
  )
}

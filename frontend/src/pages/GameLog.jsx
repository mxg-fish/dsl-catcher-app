import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function GameLog() {
  const [seasons, setSeasons] = useState([])
  const [weeks,   setWeeks]   = useState([])
  const [games,   setGames]   = useState([])
  const [seasonId, setSeasonId] = useState('')
  const [weekId,   setWeekId]   = useState('')
  const nav = useNavigate()

  useEffect(() => {
    api.get('/seasons').then(r => {
      setSeasons(r.data)
      if (r.data[0]) setSeasonId(String(r.data[0].id))
    })
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
    api.get(`/weeks/${weekId}/games`).then(r => setGames(r.data))
  }, [weekId])

  return (
    <div className="page">
      <h2>📋 Registro de Juegos</h2>
      <div className="row" style={{ gap:8, marginBottom:16 }}>
        <div className="col">
          <select value={seasonId} onChange={e => setSeasonId(e.target.value)}>
            {seasons.map(s => <option key={s.id} value={s.id}>{s.year}</option>)}
          </select>
        </div>
        <div className="col">
          <select value={weekId} onChange={e => setWeekId(e.target.value)}>
            {weeks.map(w => <option key={w.id} value={w.id}>Semana {w.week_number}</option>)}
          </select>
        </div>
      </div>

      {games.length === 0 && <p style={{ color:'#666' }}>Sin juegos esta semana.</p>}

      {games.map(g => (
        <div key={g.id} className="card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:600 }}>{g.game_date}{g.opponent ? ` vs ${g.opponent}` : ''}</div>
            <div style={{ fontSize:12, color:'#888', marginTop:2 }}>
              {g.completed ? <span style={{ color:'#00c896' }}>✅ Completado</span> : <span style={{ color:'#e9c46a' }}>⏳ En progreso</span>}
            </div>
          </div>
          <button className="btn-primary" onClick={() => nav(`/summary/${g.id}`)}>
            Ver Resumen →
          </button>
        </div>
      ))}
    </div>
  )
}
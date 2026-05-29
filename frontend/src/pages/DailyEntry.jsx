import { useState, useEffect } from 'react'
import api from '../api'

export default function DailyEntry() {
  const [seasons,  setSeasons]  = useState([])
  const [weeks,    setWeeks]    = useState([])
  const [players,  setPlayers]  = useState([])
  const [seasonId, setSeasonId] = useState('')
  const [weekId,   setWeekId]   = useState('')
  const [entries,  setEntries]  = useState([])
  const [date,     setDate]     = useState(new Date().toISOString().slice(0,10))
  const [toast,    setToast]    = useState('')

  useEffect(() => { api.get('/seasons').then(r => { setSeasons(r.data); if (r.data[0]) setSeasonId(String(r.data[0].id)) }) }, [])
  useEffect(() => { api.get('/players').then(r => setPlayers(r.data)) }, [])
  useEffect(() => {
    if (!seasonId) return
    api.get(`/seasons/${seasonId}/weeks`).then(r => { setWeeks(r.data); if (r.data.at(-1)) setWeekId(String(r.data.at(-1).id)) })
  }, [seasonId])
  useEffect(() => {
    if (weekId) api.get(`/weeks/${weekId}/daily`).then(r => setEntries(r.data))
  }, [weekId])

  function showToast(m) { setToast(m); setTimeout(()=>setToast(''),2000) }

  async function save(playerId, liderazgo, practica) {
    await api.post('/daily', { player_id: playerId, entry_date: date, liderazgo, practica })
    api.get(`/weeks/${weekId}/daily`).then(r => setEntries(r.data))
    showToast('✅ Guardado')
  }

  return (
    <div className="page">
      {toast && <div style={{ position:'fixed', top:48, left:'50%', transform:'translateX(-50%)', background:'#222', padding:'8px 20px', borderRadius:20, fontSize:14, zIndex:200 }}>{toast}</div>}
      <h2>📋 Entradas Diarias</h2>
      <div className="row" style={{ gap:8, marginBottom:12 }}>
        <div className="col"><select value={seasonId} onChange={e=>setSeasonId(e.target.value)}>{seasons.map(s=><option key={s.id} value={s.id}>{s.year}</option>)}</select></div>
        <div className="col"><select value={weekId} onChange={e=>setWeekId(e.target.value)}>{weeks.map(w=><option key={w.id} value={w.id}>Semana {w.week_number}</option>)}</select></div>
        <div className="col"><input type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>
      </div>

      {players.map(p => (
        <div key={p.id} className="card">
          <div style={{ fontWeight:600, marginBottom:10 }}>{p.name}</div>
          <div className="row" style={{ gap:12 }}>
            <div className="col">
              <label>Liderazgo (máx 2)</label>
              <div className="row" style={{ marginTop:4 }}>
                <button className="btn-ghost col" onClick={()=>save(p.id,0,0)}>0</button>
                <button className="btn-success col" onClick={()=>save(p.id,2,0)}>2 ✓</button>
              </div>
            </div>
            <div className="col">
              <label>Práctica (máx 4)</label>
              <div className="row" style={{ marginTop:4 }}>
                <button className="btn-ghost col" onClick={()=>save(p.id,0,0)}>0</button>
                <button className="btn-success col" onClick={()=>save(p.id,0,4)}>4 ✓</button>
              </div>
            </div>
            <div className="col">
              <label>Ambos</label>
              <button className="btn-primary btn-full" style={{ marginTop:4 }} onClick={()=>save(p.id,2,4)}>2 + 4 ✓</button>
            </div>
          </div>
        </div>
      ))}

      {entries.length > 0 && (
        <div className="card" style={{ overflowX:'auto' }}>
          <h3 style={{ marginBottom:8 }}>Entradas de la Semana</h3>
          <table>
            <thead><tr><th>Fecha</th><th>Jugador</th><th>Liderazgo</th><th>Práctica</th></tr></thead>
            <tbody>
              {entries.map(e=>(
                <tr key={e.id}><td>{e.entry_date}</td><td>{e.player_name}</td><td>{e.liderazgo}</td><td>{e.practica}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

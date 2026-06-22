import { useState, useEffect } from 'react'
import api from '../api'

export default function PlayerProfile() {
  const [players, setPlayers]   = useState([])
  const [seasons, setSeasons]   = useState([])
  const [playerId, setPlayerId] = useState('')
  const [seasonId, setSeasonId] = useState('')
  const [history,  setHistory]  = useState([])
  const [videos,   setVideos]   = useState([])
  const [notes,    setNotes]    = useState([])

  // Video form
  const [vidTitle,  setVidTitle]  = useState('')
  const [vidDate,   setVidDate]   = useState(new Date().toISOString().slice(0,10))
  const [vidType,   setVidType]   = useState('practice')
  const [vidUrl,    setVidUrl]    = useState('')
  const [vidNotes,  setVidNotes]  = useState('')

  useEffect(() => {
    api.get('/players').then(r => { setPlayers(r.data); if (r.data[0]) setPlayerId(String(r.data[0].id)) })
    api.get('/seasons').then(r => { setSeasons(r.data); if (r.data[0]) setSeasonId(String(r.data[0].id)) })
  }, [])

  function load() {
    if (!playerId || !seasonId) return
    api.get(`/players/${playerId}/history/${seasonId}`).then(r => setHistory(r.data))
    api.get(`/players/${playerId}/videos`).then(r => setVideos(r.data))
    api.get(`/players/${playerId}/notes`).then(r => setNotes(r.data))
  }
  useEffect(load, [playerId, seasonId])

  async function saveVideo() {
    if (!playerId || !vidUrl) return
    await api.post('/videos', { player_id: parseInt(playerId), title: vidTitle, session_date: vidDate, session_type: vidType, video_url: vidUrl, notes: vidNotes })
    setVidTitle(''); setVidUrl(''); setVidNotes('')
    api.get(`/players/${playerId}/videos`).then(r => setVideos(r.data))
  }

  const typeLabels = { practice:'Práctica', game:'Juego', bullpen:'Bullpen', other:'Otro' }

  return (
    <div className="page">
      <h2>👤 Perfil del Jugador</h2>
      <div className="row" style={{ gap:8, marginBottom:16 }}>
        <div className="col">
          <select value={playerId} onChange={e=>setPlayerId(e.target.value)}>
            {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="col">
          <select value={seasonId} onChange={e=>setSeasonId(e.target.value)}>
            {seasons.map(s=><option key={s.id} value={s.id}>{s.year}</option>)}
          </select>
        </div>
      </div>

      {/* Weekly history table */}
      {history.length > 0 && (
        <div className="card" style={{ overflowX:'auto', marginBottom:20 }}>
          <h3 style={{ marginBottom:10 }}>Historial Semanal</h3>
          <table>
            <thead><tr>
              <th>Sem.</th><th>Lid.</th><th>Recibir</th><th>Prác.</th><th>Block.</th><th>Tirar</th><th style={{ color:'#e63946' }}>Total</th>
              <th>Pop</th><th>Block%</th><th>Tiro%</th>
            </tr></thead>
            <tbody>
              {history.map(h => (
                <tr key={h.week_id}>
                  <td>S{h.week_number}</td>
                  <td>{h.liderazgo}</td><td>{h.recibir}</td><td>{h.practica}</td>
                  <td>{h.blockear}</td><td>{h.tirar}</td>
                  <td style={{ fontWeight:700, color:'#e63946' }}>{h.total}</td>
                  <td>{h.avg_pop_time ?? '—'}s</td>
                  <td>{h.block_pct}%</td>
                  <td>{h.accurate_throw_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes feed */}
      <div className="card" style={{ marginBottom:20 }}>
        <h3 style={{ marginBottom:10 }}>📝 Notas</h3>
        {notes.length === 0 && <p style={{ color:'#666', fontSize:13 }}>Sin notas aún.</p>}
        {notes.map(n => (
          <div key={n.id} style={{ borderBottom:'1px solid #222', padding:'8px 0' }}>
            <div style={{ fontSize:11, color:'#888' }}>{n.note_date}</div>
            <div style={{ fontSize:13, color:'#ddd', marginTop:2 }}>{n.note_text}</div>
          </div>
        ))}
      </div>

      {/* Add video */}
      <div className="card">
        <h3>Agregar Video</h3>
        <label>Título</label>
        <input value={vidTitle} onChange={e=>setVidTitle(e.target.value)} placeholder="ej. Bullpen Semana 3" />
        <div className="row">
          <div className="col"><label>Fecha</label><input type="date" value={vidDate} onChange={e=>setVidDate(e.target.value)} /></div>
          <div className="col"><label>Tipo</label>
            <select value={vidType} onChange={e=>setVidType(e.target.value)}>
              {Object.entries(typeLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <label>URL del Video</label>
        <input value={vidUrl} onChange={e=>setVidUrl(e.target.value)} placeholder="https://..." />
        <label>Notas</label>
        <input value={vidNotes} onChange={e=>setVidNotes(e.target.value)} placeholder="opcional" />
        <button className="btn-success btn-full" style={{ marginTop:12 }} onClick={saveVideo}>Guardar Video</button>
      </div>

      {/* Video gallery */}
      {videos.map(v => (
        <div key={v.id} className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontWeight:600 }}>{v.title}</div>
              <div style={{ color:'#888', fontSize:12, marginTop:2 }}>{v.session_date} · {typeLabels[v.session_type]}</div>
              {v.notes && <div style={{ color:'#aaa', fontSize:12, marginTop:4 }}>{v.notes}</div>}
            </div>
            <a href={v.video_url} target="_blank" rel="noreferrer"
               style={{ background:'#e63946', color:'#fff', padding:'6px 14px', borderRadius:6, textDecoration:'none', fontSize:13, whiteSpace:'nowrap' }}>
              ▶ Ver
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}

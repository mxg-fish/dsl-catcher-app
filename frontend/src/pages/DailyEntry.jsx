import { useState, useEffect } from 'react'
import api from '../api'

export default function DailyEntry() {
  const [players,  setPlayers]  = useState([])
  const [date,     setDate]     = useState(new Date().toISOString().slice(0,10))
  const [entries,  setEntries]  = useState({})
  const [toast,    setToast]    = useState('')
  const [openNote, setOpenNote] = useState(null)
  const [openVideo, setOpenVideo] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [vidTitle, setVidTitle] = useState('')
  const [vidUrl,   setVidUrl]   = useState('')
  const [vidType,  setVidType]  = useState('practice')
  const [todayLog, setTodayLog] = useState({})

  useEffect(() => { api.get('/players').then(r => setPlayers(r.data)) }, [])

  function loadToday() {
    api.get(`/weeks/0/daily`).catch(() => {})
    // Pull each player's entry for this date by checking the daily entries directly
    players.forEach(p => {
      // lightweight: rely on entries state we manage locally after save
    })
  }

  function showToast(m) { setToast(m); setTimeout(()=>setToast(''),2000) }

  async function saveLiderazgo(playerId, val) {
    const practica = entries[playerId]?.practica ?? 0
    await api.post('/daily', { player_id: playerId, entry_date: date, liderazgo: val, practica })
    setEntries(e => ({ ...e, [playerId]: { ...e[playerId], liderazgo: val, practica } }))
    showToast('✅ Guardado')
  }

  async function savePractica(playerId, val) {
    const liderazgo = entries[playerId]?.liderazgo ?? 0
    await api.post('/daily', { player_id: playerId, entry_date: date, liderazgo, practica: val })
    setEntries(e => ({ ...e, [playerId]: { ...e[playerId], liderazgo, practica: val } }))
    showToast('✅ Guardado')
  }

  async function saveNote(playerId) {
    if (!noteText.trim()) return
    await api.post('/notes', { player_id: playerId, note_date: date, note_text: noteText.trim() })
    setNoteText('')
    setOpenNote(null)
    showToast('✅ Nota guardada')
  }

  async function saveVideo(playerId) {
    if (!vidUrl.trim()) return
    await api.post('/videos', {
      player_id: playerId, title: vidTitle || 'Sin título', session_date: date,
      session_type: vidType, video_url: vidUrl.trim(), notes: ''
    })
    setVidTitle(''); setVidUrl(''); setVidType('practice')
    setOpenVideo(null)
    showToast('✅ Video guardado')
  }

  return (
    <div className="page">
      {toast && <div style={{ position:'fixed', top:48, left:'50%', transform:'translateX(-50%)', background:'#222', padding:'8px 20px', borderRadius:20, fontSize:14, zIndex:200 }}>{toast}</div>}
      <h2>📋 Entradas Diarias</h2>

      <div style={{ marginBottom:16 }}>
        <label>Fecha</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
      </div>

      {players.map(p => {
        const lid = entries[p.id]?.liderazgo
        const prac = entries[p.id]?.practica
        return (
          <div key={p.id} className="card">
            <div style={{ fontWeight:600, marginBottom:10, fontSize:16 }}>{p.name}</div>

            <label>Liderazgo (0-2)</label>
            <div className="row" style={{ marginTop:4, marginBottom:12, gap:4 }}>
              {[0,1,2].map(v => (
                <button key={v} className="col"
                  style={{ background: lid === v ? '#1a3a5c' : '#2a2a2a', color: lid === v ? '#74b9ff' : '#888', fontWeight: lid === v ? 700 : 400 }}
                  onClick={() => saveLiderazgo(p.id, v)}>{v}</button>
              ))}
            </div>

            <label>Práctica (0-4)</label>
            <div className="row" style={{ marginTop:4, marginBottom:12, gap:4 }}>
              {[0,1,2,3,4].map(v => (
                <button key={v} className="col"
                  style={{ background: prac === v ? '#1a3a5c' : '#2a2a2a', color: prac === v ? '#74b9ff' : '#888', fontWeight: prac === v ? 700 : 400 }}
                  onClick={() => savePractica(p.id, v)}>{v}</button>
              ))}
            </div>

            <div className="row" style={{ gap:8 }}>
              <button className="btn-ghost col" onClick={() => { setOpenNote(openNote === p.id ? null : p.id); setOpenVideo(null) }}>
                📝 {openNote === p.id ? 'Cerrar' : '+ Nota'}
              </button>
              <button className="btn-ghost col" onClick={() => { setOpenVideo(openVideo === p.id ? null : p.id); setOpenNote(null) }}>
                🎥 {openVideo === p.id ? 'Cerrar' : '+ Video'}
              </button>
            </div>

            {openNote === p.id && (
              <div style={{ marginTop:10 }}>
                <label>Nota</label>
                <input value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="ej. Trabajó bien el bloqueo hoy" />
                <button className="btn-success btn-full" style={{ marginTop:8 }} onClick={() => saveNote(p.id)}>Guardar Nota</button>
              </div>
            )}

            {openVideo === p.id && (
              <div style={{ marginTop:10 }}>
                <label>Título</label>
                <input value={vidTitle} onChange={e=>setVidTitle(e.target.value)} placeholder="ej. Bullpen del día" />
                <label style={{ marginTop:8 }}>Tipo</label>
                <select value={vidType} onChange={e=>setVidType(e.target.value)}>
                  <option value="practice">Práctica</option>
                  <option value="game">Juego</option>
                  <option value="bullpen">Bullpen</option>
                  <option value="other">Otro</option>
                </select>
                <label style={{ marginTop:8 }}>Link de Google Drive</label>
                <input value={vidUrl} onChange={e=>setVidUrl(e.target.value)} placeholder="https://drive.google.com/..." />
                <button className="btn-success btn-full" style={{ marginTop:8 }} onClick={() => saveVideo(p.id)}>Guardar Video</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
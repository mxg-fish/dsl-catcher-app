import { useState, useEffect } from 'react'
import api from '../api'

export default function Admin() {
  const role = localStorage.getItem('role')
  const [seasons, setSeasons] = useState([])
  const [players, setPlayers] = useState([])
  const [seasonId, setSeasonId] = useState('')
  const [toast, setToast] = useState('')

  // Week form
  const [weekNum,    setWeekNum]    = useState(1)
  const [startDate,  setStartDate]  = useState(new Date().toISOString().slice(0,10))
  const [endDate,    setEndDate]    = useState('')
  const [lgAvg,      setLgAvg]      = useState(115)

  // User form (admin only)
  const [newUser, setNewUser] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newRole, setNewRole] = useState('coach')

  // Player form
  const [newPlayer, setNewPlayer] = useState('')

  // Season form
  const [newYear, setNewYear] = useState(2026)

  useEffect(() => {
    api.get('/seasons').then(r => { setSeasons(r.data); if (r.data[0]) setSeasonId(String(r.data[0].id)) })
    api.get('/players').then(r => setPlayers(r.data))
  }, [])

  function showToast(m) { setToast(m); setTimeout(()=>setToast(''),2500) }

  async function addSeason() {
    await api.post('/seasons', { year: newYear })
    api.get('/seasons').then(r => setSeasons(r.data))
    showToast('✅ Temporada creada')
  }

  async function addWeek() {
    if (!seasonId) return
    await api.post(`/seasons/${seasonId}/weeks`, {
      week_number: weekNum, start_date: startDate,
      end_date: endDate || startDate, league_avg_sl_plus: lgAvg
    })
    showToast('✅ Semana creada')
    setWeekNum(w => w + 1)
  }

  async function addPlayer() {
    if (!newPlayer.trim()) return
    await api.post('/players', { name: newPlayer.trim() })
    api.get('/players').then(r => setPlayers(r.data))
    setNewPlayer('')
    showToast('✅ Catcher agregado')
  }

  async function createUser() {
    if (!newUser || !newPass) return
    await api.post('/users', { username: newUser, password: newPass, role: newRole })
    setNewUser(''); setNewPass('')
    showToast('✅ Usuario creado')
  }

  return (
    <div className="page">
      {toast && <div style={{ position:'fixed', top:48, left:'50%', transform:'translateX(-50%)', background:'#222', padding:'8px 20px', borderRadius:20, fontSize:14, zIndex:200 }}>{toast}</div>}
      <h2>⚙️ Administración</h2>

      {/* Season */}
      <div className="card">
        <h3>Nueva Temporada</h3>
        <div className="row" style={{ alignItems:'flex-end', gap:8 }}>
          <div className="col"><label>Año</label><input type="number" value={newYear} onChange={e=>setNewYear(parseInt(e.target.value))} /></div>
          <button className="btn-success" onClick={addSeason}>Crear</button>
        </div>
      </div>

      {/* Week */}
      <div className="card">
        <h3>Nueva Semana</h3>
        <div className="row" style={{ gap:8, flexWrap:'wrap' }}>
          <div className="col">
            <label>Temporada</label>
            <select value={seasonId} onChange={e=>setSeasonId(e.target.value)}>
              {seasons.map(s=><option key={s.id} value={s.id}>{s.year}</option>)}
            </select>
          </div>
          <div className="col"><label># Semana</label><input type="number" value={weekNum} onChange={e=>setWeekNum(parseInt(e.target.value))} /></div>
          <div className="col"><label>Inicio</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} /></div>
          <div className="col"><label>Fin</label><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} /></div>
          <div className="col"><label>Liga Avg SL+</label><input type="number" value={lgAvg} onChange={e=>setLgAvg(parseFloat(e.target.value))} /></div>
        </div>
        <button className="btn-success btn-full" style={{ marginTop:12 }} onClick={addWeek}>Crear Semana</button>
      </div>

      {/* Player */}
      <div className="card">
        <h3>Agregar Catcher</h3>
        <div className="row" style={{ gap:8, alignItems:'flex-end' }}>
          <div className="col"><label>Nombre Completo</label><input value={newPlayer} onChange={e=>setNewPlayer(e.target.value)} placeholder="ej. Juan Pérez" /></div>
          <button className="btn-success" onClick={addPlayer}>Agregar</button>
        </div>
        <div style={{ marginTop:12, display:'flex', flexWrap:'wrap', gap:6 }}>
          {players.map(p=><span key={p.id} className="badge badge-blue">{p.name}</span>)}
        </div>
      </div>

      {/* User management (admin only) */}
      {role === 'admin' && (
        <div className="card">
          <h3>Crear Usuario</h3>
          <div className="row" style={{ gap:8, flexWrap:'wrap' }}>
            <div className="col"><label>Usuario</label><input value={newUser} onChange={e=>setNewUser(e.target.value)} /></div>
            <div className="col"><label>Contraseña</label><input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} /></div>
            <div className="col">
              <label>Rol</label>
              <select value={newRole} onChange={e=>setNewRole(e.target.value)}>
                <option value="coach">Coach</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button className="btn-primary btn-full" style={{ marginTop:12 }} onClick={createUser}>Crear Usuario</button>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import api from '../api'

export default function SLEntry() {
  const [seasons,  setSeasons]  = useState([])
  const [weeks,    setWeeks]    = useState([])
  const [players,  setPlayers]  = useState([])
  const [seasonId, setSeasonId] = useState('')
  const [weekId,   setWeekId]   = useState('')
  const [entries,  setEntries]  = useState([])
  const [leagueAvg, setLeagueAvg] = useState(115)
  const [toast, setToast] = useState('')

  // Per-player form state
  const [form, setForm] = useState({})

  useEffect(() => { api.get('/seasons').then(r => { setSeasons(r.data); if (r.data[0]) setSeasonId(String(r.data[0].id)) }) }, [])
  useEffect(() => { api.get('/players').then(r => setPlayers(r.data)) }, [])
  useEffect(() => {
    if (!seasonId) return
    api.get(`/seasons/${seasonId}/weeks`).then(r => { setWeeks(r.data); if (r.data.at(-1)) setWeekId(String(r.data.at(-1).id)) })
  }, [seasonId])
  useEffect(() => {
    if (!weekId) return
    api.get(`/weeks/${weekId}/sl`).then(r => {
      setEntries(r.data)
      const f = {}
      r.data.forEach(e => { f[e.player_id] = { sl_plus: e.sl_plus ?? '', shadow: e.shadow_strike_pct ? Math.round(e.shadow_strike_pct*100) : '', rank: e.lg_rank ?? '' }})
      setForm(f)
    })
    // get league avg from week
    api.get(`/seasons/${seasonId}/weeks`).then(r => {
      const w = r.data.find(w=>String(w.id)===weekId)
      if (w) setLeagueAvg(w.league_avg_sl_plus)
    })
  }, [weekId])

  function showToast(m) { setToast(m); setTimeout(()=>setToast(''),2000) }

  function setField(pid, field, val) {
    setForm(f => ({ ...f, [pid]: { ...f[pid], [field]: val } }))
  }

  async function save(pid) {
    const f = form[pid] || {}
    await api.post(`/weeks/${weekId}/sl`, {
      player_id: pid,
      sl_plus: f.sl_plus ? parseFloat(f.sl_plus) : null,
      shadow_strike_pct: f.shadow ? parseFloat(f.shadow) : null,
      lg_rank: f.rank || null,
    })
    api.get(`/weeks/${weekId}/sl`).then(r => setEntries(r.data))
    showToast('✅ Guardado')
  }

  async function updateAvg() {
    await api.patch(`/weeks/${weekId}/league-avg`, { league_avg_sl_plus: leagueAvg })
    showToast('✅ Promedio actualizado')
  }

  return (
    <div className="page">
      {toast && <div style={{ position:'fixed', top:48, left:'50%', transform:'translateX(-50%)', background:'#222', padding:'8px 20px', borderRadius:20, fontSize:14, zIndex:200 }}>{toast}</div>}
      <h2>📊 SL+ / Recibir</h2>
      <div className="row" style={{ gap:8, marginBottom:12 }}>
        <div className="col"><select value={seasonId} onChange={e=>setSeasonId(e.target.value)}>{seasons.map(s=><option key={s.id} value={s.id}>{s.year}</option>)}</select></div>
        <div className="col"><select value={weekId} onChange={e=>setWeekId(e.target.value)}>{weeks.map(w=><option key={w.id} value={w.id}>Semana {w.week_number}</option>)}</select></div>
      </div>

      <div className="card">
        <div className="row" style={{ alignItems:'flex-end', gap:8 }}>
          <div className="col">
            <label>Liga Promedio SL+</label>
            <input type="number" value={leagueAvg} onChange={e=>setLeagueAvg(parseFloat(e.target.value))} />
          </div>
          <button className="btn-success" onClick={updateAvg}>Actualizar</button>
        </div>
      </div>

      {players.map(p => {
        const f = form[p.id] || { sl_plus:'', shadow:'', rank:'' }
        const score = f.sl_plus && leagueAvg ? ((parseFloat(f.sl_plus)/leagueAvg)*30).toFixed(1) : '—'
        return (
          <div key={p.id} className="card">
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontWeight:600 }}>{p.name}</span>
              <span style={{ color:'#e63946', fontWeight:700 }}>Score: {score} / 30</span>
            </div>
            <div className="row" style={{ gap:8, flexWrap:'wrap' }}>
              <div className="col"><label>SL+</label><input type="number" value={f.sl_plus} onChange={e=>setField(p.id,'sl_plus',e.target.value)} placeholder="ej. 115" /></div>
              <div className="col"><label>Shadow Strike %</label><input type="number" value={f.shadow} onChange={e=>setField(p.id,'shadow',e.target.value)} placeholder="ej. 32" /></div>
              <div className="col"><label>Rango Liga</label><input value={f.rank} onChange={e=>setField(p.id,'rank',e.target.value)} placeholder="ej. 58th" /></div>
              <div style={{ alignSelf:'flex-end' }}><button className="btn-primary" onClick={()=>save(p.id)}>Guardar</button></div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

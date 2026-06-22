
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
  const [leagueAvgPbwp, setLeagueAvgPbwp] = useState(100)
  const [toast, setToast] = useState('')

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
      r.data.forEach(e => {
        f[e.player_id] = {
          sl_plus: e.sl_plus ?? '',
          shadow: e.shadow_strike_pct ? Math.round(e.shadow_strike_pct*100) : '',
          rank: e.lg_rank ?? '',
          pbwp_plus: e.pbwp_plus ?? '',
          pitches_caught: e.pitches_caught ?? '',
          sl_rank: e.sl_rank ?? '',
          pbwp_rank: e.pbwp_rank ?? '',
        }
      })
      setForm(f)
    })
    api.get(`/seasons/${seasonId}/weeks`).then(r => {
      const w = r.data.find(w=>String(w.id)===weekId)
      if (w) {
        setLeagueAvg(w.league_avg_sl_plus)
        setLeagueAvgPbwp(w.league_avg_pbwp ?? 100)
      }
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
      pbwp_plus: f.pbwp_plus ? parseFloat(f.pbwp_plus) : null,
      pitches_caught: f.pitches_caught ? parseInt(f.pitches_caught) : null,
      sl_rank: f.sl_rank ? parseInt(f.sl_rank) : null,
      pbwp_rank: f.pbwp_rank ? parseInt(f.pbwp_rank) : null,
    })
    api.get(`/weeks/${weekId}/sl`).then(r => setEntries(r.data))
    showToast('✅ Guardado')
  }

  async function updateAvg() {
    await api.patch(`/weeks/${weekId}/league-avg`, { league_avg_sl_plus: leagueAvg })
    showToast('✅ Promedio SL+ actualizado')
  }

  async function updateAvgPbwp() {
    await api.patch(`/weeks/${weekId}/league-avg-pbwp`, { league_avg_pbwp: leagueAvgPbwp })
    showToast('✅ Promedio PBWP+ actualizado')
  }

  return (
    <div className="page">
      {toast && <div style={{ position:'fixed', top:48, left:'50%', transform:'translateX(-50%)', background:'#222', padding:'8px 20px', borderRadius:20, fontSize:14, zIndex:200 }}>{toast}</div>}
      <h2>📊 SL+ / PBWP+ / Recibir</h2>
      <div className="row" style={{ gap:8, marginBottom:12 }}>
        <div className="col"><select value={seasonId} onChange={e=>setSeasonId(e.target.value)}>{seasons.map(s=><option key={s.id} value={s.id}>{s.year}</option>)}</select></div>
        <div className="col"><select value={weekId} onChange={e=>setWeekId(e.target.value)}>{weeks.map(w=><option key={w.id} value={w.id}>Semana {w.week_number}</option>)}</select></div>
      </div>

      <div className="card">
        <div className="row" style={{ alignItems:'flex-end', gap:8, marginBottom:12 }}>
          <div className="col">
            <label>Liga Promedio SL+</label>
            <input type="number" value={leagueAvg} onChange={e=>setLeagueAvg(parseFloat(e.target.value))} />
          </div>
          <button className="btn-success" onClick={updateAvg}>Actualizar</button>
        </div>
      </div>

      {players.map(p => {
        const f = form[p.id] || { sl_plus:'', shadow:'', rank:'', pbwp_plus:'', pitches_caught:'', sl_rank:'', pbwp_rank:'' }
        const slScore = f.sl_plus && leagueAvg ? ((parseFloat(f.sl_plus)/leagueAvg)*20).toFixed(1) : '—'
        const pbwpScore = f.pbwp_plus ? (() => {
          const v = parseFloat(f.pbwp_plus)
          if (v >= 45) return (5 + 5.5 * Math.pow(Math.min((v-45)/(150-45), 1.0), 1.5)).toFixed(1)
          return (5 * Math.pow(Math.max((v-10)/(45-10), 0), 1.5)).toFixed(1)
        })() : '—'
        return (
          <div key={p.id} className="card">
            <div style={{ fontWeight:600, marginBottom:8, fontSize:15 }}>{p.name}</div>

            <div style={{ fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Recibir</div>
            <div className="row" style={{ gap:8, flexWrap:'wrap', marginBottom:10 }}>
              <div className="col"><label>Lanzamientos Atrapados</label><input type="number" value={f.pitches_caught} onChange={e=>setField(p.id,'pitches_caught',e.target.value)} placeholder="ej. 180" /></div>
              <div className="col"><label>SL+</label><input type="number" value={f.sl_plus} onChange={e=>setField(p.id,'sl_plus',e.target.value)} placeholder="ej. 115" /></div>
              <div className="col"><label>Shadow Strike %</label><input type="number" value={f.shadow} onChange={e=>setField(p.id,'shadow',e.target.value)} placeholder="ej. 32" /></div>
              <div className="col"><label>Rango Liga SL+</label><input type="number" value={f.sl_rank} onChange={e=>setField(p.id,'sl_rank',e.target.value)} placeholder="ej. 8" /></div>
            </div>
            <div style={{ fontSize:12, color:'#74b9ff', marginBottom:12 }}>SL+ Score (sin ajuste de volumen): {slScore} / 20</div>

            <div style={{ fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Bloquear</div>
            <div className="row" style={{ gap:8, flexWrap:'wrap', marginBottom:10 }}>
              <div className="col"><label>PBWP+</label><input type="number" value={f.pbwp_plus} onChange={e=>setField(p.id,'pbwp_plus',e.target.value)} placeholder="ej. 105" /></div>
              <div className="col"><label>Rango Liga PBWP+</label><input type="number" value={f.pbwp_rank} onChange={e=>setField(p.id,'pbwp_rank',e.target.value)} placeholder="ej. 12" /></div>
            </div>
            <div style={{ fontSize:12, color:'#ffeaa7', marginBottom:12 }}>PBWP+ Score: {pbwpScore} / 8.5</div>

            <button className="btn-primary btn-full" onClick={()=>save(p.id)}>Guardar</button>
          </div>
        )
      })}
    </div>
  )
}

import { useState, useEffect } from 'react'
import api from '../api'

export default function Season() {
  const [seasons, setSeasons] = useState([])
  const [seasonId, setSeasonId] = useState('')
  const [scores, setScores] = useState([])
  const medals = ['🥇','🥈','🥉']

  useEffect(() => { api.get('/seasons').then(r => { setSeasons(r.data); if (r.data[0]) setSeasonId(String(r.data[0].id)) }) }, [])
  useEffect(() => {
    if (!seasonId) return
    api.get(`/seasons/${seasonId}/leaderboard`).then(r => setScores(r.data))
  }, [seasonId])

  const cats = [
    ['liderazgo','Lid.'],['recibir','Rec.'],['practica','Prác.'],['blockear','Block.'],['tirar','Tirar'],
  ]

  return (
    <div className="page">
      <h2>📅 Temporada Completa</h2>
      <div style={{ marginBottom:16 }}>
        <select value={seasonId} onChange={e=>setSeasonId(e.target.value)}>
          {seasons.map(s=><option key={s.id} value={s.id}>{s.year}</option>)}
        </select>
      </div>

      <div className="card" style={{ overflowX:'auto' }}>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Jugador</th>
              {cats.map(([k,l])=><th key={k} style={{ textAlign:'center' }}>{l}</th>)}
              <th style={{ textAlign:'center', color:'#e63946' }}>Total</th>
              <th style={{ textAlign:'center' }}>Semanas</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s,i) => (
              <tr key={s.player_id} style={{ background: i===0 ? '#1e2a1e' : i===1 ? '#1a1a2e' : i===2 ? '#1c1a1a' : 'transparent' }}>
                <td>{medals[i] || s.rank}</td>
                <td style={{ fontWeight:600 }}>{s.player_name}</td>
                {cats.map(([k])=><td key={k} style={{ textAlign:'center' }}>{s[k]}</td>)}
                <td style={{ textAlign:'center', fontWeight:700, color:'#e63946' }}>{s.total}</td>
                <td style={{ textAlign:'center', color:'#888' }}>{s.weeks_played}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {scores.length === 0 && <p style={{ color:'#666' }}>Sin datos de temporada aún.</p>}
    </div>
  )
}

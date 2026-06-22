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
          pbwp_plus: e.pbwp_plus

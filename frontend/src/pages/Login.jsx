import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/login', { username, password })
      localStorage.setItem('token', data.token)
      localStorage.setItem('username', data.username)
      localStorage.setItem('role', data.role)
      nav('/')
    } catch {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#111' }}>
      <div style={{ width: 340 }}>
        <div style={{ textAlign:'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>⚾</div>
          <h1 style={{ color:'#e63946', marginTop: 8 }}>DSL Catchers</h1>
          <p style={{ color:'#888', fontSize: 13, marginTop: 4 }}>Miami Marlins</p>
        </div>
        <div className="card">
          <form onSubmit={submit}>
            <label>Usuario</label>
            <input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" autoFocus />
            <label>Contraseña</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" />
            {error && <p style={{ color:'#e63946', fontSize:13, marginTop:8 }}>{error}</p>}
            <button className="btn-primary btn-full btn-lg" style={{ marginTop:16 }} disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

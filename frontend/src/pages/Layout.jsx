import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getPendingCount, flushQueue } from '../offlineQueue'

const NAV = [
  { to: '/game',    label: '🎮 Juego'     },
  { to: '/weekly',  label: '🏆 Semana'    },
  { to: '/season',  label: '📅 Temporada' },
  { to: '/player',  label: '👤 Jugador'   },
  { to: '/daily',   label: '📋 Diario'    },
  { to: '/sl',      label: '📊 SL+'       },
  { to: '/admin',   label: '⚙️ Admin'     },
  { to: '/gamelog', label: '📋 Log' },
]

export default function Layout() {
  const nav = useNavigate()
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    const on  = () => { setOnline(true);  flushQueue().then(() => getPendingCount().then(setPending)) }
    const off = () => setOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    getPendingCount().then(setPending)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  function logout() {
    localStorage.clear()
    nav('/login')
  }

  return (
    <div>
      {!online && (
        <div className="offline-banner">
          ⚠️ Sin conexión — los eventos se guardarán localmente y se sincronizarán al reconectar
          {pending > 0 && ` (${pending} pendientes)`}
        </div>
      )}
      {online && pending > 0 && (
        <div className="offline-banner" style={{ background:'#1a4731', color:'#55efc4' }}>
          ✅ Conectado — sincronizando {pending} eventos...
        </div>
      )}

      {/* Header */}
      <div style={{ background:'#1a1a1a', borderBottom:'1px solid #2a2a2a', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ color:'#e63946', fontWeight:700, fontSize:17 }}>⚾ DSL Catchers</span>
        <button className="btn-ghost" style={{ padding:'6px 12px', fontSize:12 }} onClick={logout}>
          {localStorage.getItem('username')} · Salir
        </button>
      </div>

      {/* Bottom nav (mobile-first) */}
      <nav style={{ position:'fixed', bottom:0, left:0, right:0, background:'#1a1a1a', borderTop:'1px solid #2a2a2a', display:'flex', overflowX:'auto', zIndex:100 }}>
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to}
            style={({ isActive }) => ({
              flex:'0 0 auto', padding:'8px 14px', fontSize:12, textDecoration:'none', whiteSpace:'nowrap',
              color: isActive ? '#e63946' : '#888',
              borderTop: isActive ? '2px solid #e63946' : '2px solid transparent',
            })}>
            {n.label}
          </NavLink>
        ))}
      </nav>

      {/* Main content — padded above bottom nav */}
      <div style={{ paddingBottom: 60, paddingTop: (!online || pending > 0) ? 36 : 0 }}>
        <Outlet />
      </div>
    </div>
  )
}

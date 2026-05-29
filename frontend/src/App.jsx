import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Layout from './pages/Layout'
import GameTracker from './pages/GameTracker'
import Weekly from './pages/Weekly'
import Season from './pages/Season'
import PlayerProfile from './pages/PlayerProfile'
import DailyEntry from './pages/DailyEntry'
import SLEntry from './pages/SLEntry'
import Admin from './pages/Admin'

function RequireAuth({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Navigate to="/game" replace />} />
          <Route path="game"    element={<GameTracker />} />
          <Route path="weekly"  element={<Weekly />} />
          <Route path="season"  element={<Season />} />
          <Route path="player"  element={<PlayerProfile />} />
          <Route path="daily"   element={<DailyEntry />} />
          <Route path="sl"      element={<SLEntry />} />
          <Route path="admin"   element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

import { useState, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import PanelDashboard from '../components/PanelDashboard'
import GestionAlumnas from '../components/GestionAlumnas'
import GestionPagos from '../components/GestionPagos'
import GestionTurnos from '../components/GestionTurnos'
import Notificaciones from '../components/Notificaciones'

export default function ProfePanel() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('dashboard')
  const [notifNoLeidas, setNotifNoLeidas] = useState(0)

  useEffect(() => {
    const q = query(collection(db, 'notificaciones'), where('leida', '==', false))
    const unsub = onSnapshot(q, snap => setNotifNoLeidas(snap.size))
    return unsub
  }, [])

  async function logout() {
    await signOut(auth)
    navigate('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f7f2' }}>
      <nav className="navbar">
        <span className="navbar-brand">ANIMA PILATES — Profesional</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#5a6b60', fontSize: '0.9rem' }}>
            {perfil?.nombre}
          </span>
          <button className="btn btn-ghost" onClick={logout} style={{ padding: '8px 16px', minHeight: 38, fontSize: '0.88rem' }}>
            Salir
          </button>
        </div>
      </nav>

      <div className="page-container">
        <div className="tabs">
          <button className={`tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>
            📊 Hoy
          </button>
          <button className={`tab ${tab === 'alumnas' ? 'active' : ''}`} onClick={() => setTab('alumnas')}>
            👥 Alumnas
          </button>
          <button className={`tab ${tab === 'turnos' ? 'active' : ''}`} onClick={() => setTab('turnos')}>
            📅 Turnos
          </button>
          <button className={`tab ${tab === 'pagos' ? 'active' : ''}`} onClick={() => setTab('pagos')}>
            💰 Pagos
          </button>
          <button className={`tab ${tab === 'notif' ? 'active' : ''}`} onClick={() => setTab('notif')}>
            🔔 Avisos
            {notifNoLeidas > 0 && <span className="notif-dot" />}
          </button>
        </div>

        {tab === 'dashboard' && <PanelDashboard />}
        {tab === 'alumnas' && <GestionAlumnas />}
        {tab === 'turnos' && <GestionTurnos />}
        {tab === 'pagos' && <GestionPagos />}
        {tab === 'notif' && <Notificaciones />}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import PanelDashboard from '../components/PanelDashboard'
import GestionAlumnas from '../components/GestionAlumnas'
import GestionPagos from '../components/GestionPagos'
import GestionTurnos from '../components/GestionTurnos'
import Notificaciones from '../components/Notificaciones'
import HistorialAsistencias from '../components/HistorialAsistencias'
import Sincronizar from '../components/Sincronizar'

function RecordatorioPago({ onCerrar }) {
  return (
    <div style={{
      background: '#fff8e6',
      border: '1.5px solid #EF9F27',
      borderRadius: 12,
      padding: '18px 20px',
      marginBottom: 20,
      display: 'flex',
      gap: 14,
      alignItems: 'flex-start'
    }}>
      <div style={{
        width: 36, height: 36, background: '#FAEEDA', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BA7517" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#BA7517', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Recordatorio importante
        </div>
        <div style={{ fontSize: '0.92rem', color: '#633806', lineHeight: 1.7 }}>
          <span style={{ fontWeight: 700 }}>Recordatorio de pago:</span> Sres. clientes, el abono mensual por el mantenimiento y hosting del sistema web vence el día 1 del mes entrante. Para asegurar el funcionamiento continuo de la plataforma, le pedimos efectuar el pago antes de esa fecha al alias{' '}
          <span style={{ fontWeight: 700, background: '#FAEEDA', padding: '1px 7px', borderRadius: 5 }}>francosap</span>.
          {' '}Ante cualquier consulta, no dude en contactarnos.
        </div>
        <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#854F0B', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#854F0B" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Este aviso se muestra los últimos 4 días del mes
        </div>
      </div>
      <button onClick={onCerrar} style={{
        background: '#FAEEDA', border: 'none', cursor: 'pointer',
        color: '#BA7517', fontSize: '1.1rem', lineHeight: 1,
        padding: '2px 8px', borderRadius: 6
      }}>×</button>
    </div>
  )
}

function mostrarRecordatorio() {
  const hoy = new Date()
  const dia = hoy.getDate()
  const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
  return dia >= ultimoDia - 3 // últimos 4 días del mes
}

export default function ProfePanel() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('dashboard')
  const [notifNoLeidas, setNotifNoLeidas] = useState(0)
  const [mostrarAviso, setMostrarAviso] = useState(false)

  useEffect(() => {
    cargarNotif()
    // Verificar si hay que mostrar el recordatorio
    if (mostrarRecordatorio()) {
      // Verificar si ya lo cerró hoy
      const hoy = new Date().toISOString().split('T')[0]
      const cerradoEl = localStorage.getItem('recordatorio_cerrado')
      if (cerradoEl !== hoy) {
        setMostrarAviso(true)
      }
    }
  }, [])

  function cerrarAviso() {
    const hoy = new Date().toISOString().split('T')[0]
    localStorage.setItem('recordatorio_cerrado', hoy)
    setMostrarAviso(false)
  }

  async function cargarNotif() {
    try {
      const snap = await getDocs(query(collection(db, 'notificaciones'), where('leida', '==', false)))
      setNotifNoLeidas(snap.size)
    } catch { }
  }

  async function logout() {
    await signOut(auth)
    navigate('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f7f2' }}>
      <nav className="navbar">
        <span className="navbar-brand">ANIMA PILATES — Profesional</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#5a6b60', fontSize: '0.9rem' }}>{perfil?.nombre}</span>
          <button className="btn btn-ghost" onClick={logout} style={{ padding: '8px 16px', minHeight: 38, fontSize: '0.88rem' }}>
            Salir
          </button>
        </div>
      </nav>

      <div className="page-container">
        {mostrarAviso && <RecordatorioPago onCerrar={cerrarAviso} />}

        <div className="tabs">
          <button className={`tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>📊 Hoy</button>
          <button className={`tab ${tab === 'alumnas' ? 'active' : ''}`} onClick={() => setTab('alumnas')}>👥 Alumnas</button>
          <button className={`tab ${tab === 'turnos' ? 'active' : ''}`} onClick={() => setTab('turnos')}>📅 Turnos</button>
          <button className={`tab ${tab === 'pagos' ? 'active' : ''}`} onClick={() => setTab('pagos')}>💰 Pagos</button>
          <button className={`tab ${tab === 'historial' ? 'active' : ''}`} onClick={() => setTab('historial')}>📋 Historial</button>
          <button className={`tab ${tab === 'notif' ? 'active' : ''}`} onClick={() => { setTab('notif'); setNotifNoLeidas(0) }}>
            🔔 Avisos
            {notifNoLeidas > 0 && <span className="notif-dot" />}
          </button>
          <button className={`tab ${tab === 'sincronizar' ? 'active' : ''}`} onClick={() => setTab('sincronizar')}>🔄 Sincronizar</button>
        </div>

        {tab === 'dashboard' && <PanelDashboard />}
        {tab === 'alumnas' && <GestionAlumnas />}
        {tab === 'turnos' && <GestionTurnos />}
        {tab === 'pagos' && <GestionPagos />}
        {tab === 'historial' && <HistorialAsistencias />}
        {tab === 'notif' && <Notificaciones />}
        {tab === 'sincronizar' && <Sincronizar />}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { useAuth } from '../context/AuthContext'
import MiPlan from '../components/MiPlan'
import ReservarTurno from '../components/ReservarTurno'
import MisReservas from '../components/MisReservas'
import AvisoAlumna from '../components/AvisoAlumna'

export default function AlumnaPanel() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('reservar')

  async function logout() {
    await signOut(auth)
    navigate('/')
  }

  const bloqueada = perfil?.deuda || perfil?.estado === 'inactiva'

  return (
    <div style={{ minHeight: '100vh', background: '#f0f7f2' }}>
      <nav className="navbar">
        <span className="navbar-brand">ANIMA PILATES</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#5a6b60', fontSize: '0.9rem' }}>
            Hola, {perfil?.nombre}
          </span>
          <button className="btn btn-ghost" onClick={logout} style={{ padding: '8px 16px', minHeight: 38, fontSize: '0.88rem' }}>
            Salir
          </button>
        </div>
      </nav>

      <div className="page-container">
        {/* Aviso de la profe */}
        <AvisoAlumna />

        {/* Alerta de bloqueo */}
        {bloqueada && (
          <div className="alert alert-error" style={{ fontSize: '1rem', marginBottom: 20 }}>
            🚫 <strong>Tu cuenta está bloqueada.</strong>{' '}
            {perfil?.deuda
              ? 'Tenés una cuota pendiente de pago.'
              : perfil?.planVencimiento
              ? `Tu plan venció. Contactá a la profesora para renovarlo.`
              : 'No tenés un plan activo.'
            }{' '}
            Escribile a la profesora para continuar.
          </div>
        )}

        <div className="tabs">
          <button className={`tab ${tab === 'reservar' ? 'active' : ''}`} onClick={() => setTab('reservar')}>
            📅 Reservar
          </button>
          <button className={`tab ${tab === 'mis-reservas' ? 'active' : ''}`} onClick={() => setTab('mis-reservas')}>
            📋 Mis turnos
          </button>
          <button className={`tab ${tab === 'mi-plan' ? 'active' : ''}`} onClick={() => setTab('mi-plan')}>
            🌿 Mi plan
          </button>
        </div>

        <div style={{ display: tab === 'reservar' ? 'block' : 'none' }}>
          <ReservarTurno bloqueada={bloqueada} />
        </div>
        <div style={{ display: tab === 'mis-reservas' ? 'block' : 'none' }}>
          <MisReservas />
        </div>
        <div style={{ display: tab === 'mi-plan' ? 'block' : 'none' }}>
          <MiPlan />
        </div>
      </div>
    </div>
  )
}

import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'

export default function Landing() {
  const { user, perfil, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user && perfil) {
      if (perfil.rol === 'profe') navigate('/profe')
      else if (perfil.rol === 'alumna') navigate('/alumna')
    }
  }, [user, perfil, loading, navigate])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f0f7f2 0%, #faf8f4 60%, #e8f4ec 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      textAlign: 'center'
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 32 }}>
        <img
          src="/logo.png"
          alt="Anima Pilates"
          style={{ width: 200, height: 200, objectFit: 'contain' }}
          onError={(e) => {
            e.target.style.display = 'none'
            document.getElementById('logo-fallback').style.display = 'flex'
          }}
        />
        <div id="logo-fallback" style={{
          display: 'none',
          width: 200,
          height: 200,
          background: 'white',
          borderRadius: '50%',
          border: '3px solid #4a7c59',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          margin: '0 auto'
        }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2rem', color: '#4a7c59', letterSpacing: '0.15em' }}>ANIMA</div>
          <div style={{ fontFamily: 'Lato, sans-serif', fontSize: '0.85rem', color: '#6a9c79', letterSpacing: '0.3em', marginTop: 4 }}>PILATES</div>
        </div>
      </div>

      <h1 style={{ color: '#2d5a3a', marginBottom: 12, fontSize: '2.8rem' }}>ANIMA</h1>
      <p style={{
        fontFamily: 'Lato, sans-serif',
        letterSpacing: '0.35em',
        color: '#6a9c79',
        fontSize: '1rem',
        marginBottom: 8
      }}>P I L A T E S</p>
      <p style={{ color: '#5a6b60', fontSize: '1.1rem', maxWidth: 380, marginBottom: 48, lineHeight: 1.6 }}>
        Reservá tu clase de manera simple y rápida
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 340 }}>
        <Link to="/registro" className="btn btn-primary" style={{ fontSize: '1.15rem', minHeight: 60 }}>
          📅 Quiero reservar mi turno
        </Link>
        <Link to="/login" className="btn btn-secondary" style={{ fontSize: '1.05rem', minHeight: 56 }}>
          Soy alumna — Ingresar
        </Link>
      </div>

      {/* Acceso profesional discreto */}
      <div style={{ marginTop: 48, borderTop: '1px solid #c8ddd0', paddingTop: 20, width: '100%', maxWidth: 340 }}>
        <Link to="/login?rol=profe" style={{ color: '#5a6b60', fontSize: '0.88rem', textDecoration: 'none' }}>
          Acceso profesional
        </Link>
      </div>
    </div>
  )
}

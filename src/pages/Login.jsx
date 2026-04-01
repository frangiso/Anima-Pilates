import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [modoReset, setModoReset] = useState(false)
  const [resetMsg, setResetMsg] = useState('')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const esProfe = params.get('rol') === 'profe'
  const { user, perfil, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && user && perfil) {
      if (perfil.rol === 'profe') navigate('/profe', { replace: true })
      else navigate('/alumna', { replace: true })
    }
  }, [user, perfil, authLoading])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Login directo con email — 1 sola lectura, sin buscar en colección
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), pass)
      const snap = await getDoc(doc(db, 'usuarios', cred.user.uid))
      if (!snap.exists()) {
        setError('Usuario no encontrado. Contactá a la profesora.')
        setLoading(false)
        return
      }
      const p = snap.data()
      if (p.rol === 'profe') navigate('/profe', { replace: true })
      else navigate('/alumna', { replace: true })
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Email o contraseña incorrectos.')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Demasiados intentos. Esperá unos minutos.')
      } else {
        setError('Error al ingresar. Revisá los datos.')
      }
      setLoading(false)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    setResetMsg('')
    setError('')
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setResetMsg('Te enviamos un email. Revisá tu correo.')
    } catch {
      setError('No encontramos ese correo.')
    }
  }

  if (authLoading) return <div className="spinner" style={{ minHeight: '100vh' }} />

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f0f7f2 0%, #faf8f4 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px'
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/"><h2 style={{ color: '#4a7c59', letterSpacing: '0.1em' }}>ANIMA PILATES</h2></Link>
          <p style={{ color: '#5a6b60', marginTop: 8 }}>
            {modoReset ? 'Restablecer contraseña' : esProfe ? 'Acceso profesional' : 'Bienvenida de vuelta'}
          </p>
        </div>

        <div className="card">
          {!modoReset ? (
            <form onSubmit={handleLogin} autoComplete="off">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="input-group">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tucorreo@email.com"
                  required
                  autoComplete="email"
                  style={{ fontSize: '1.05rem' }}
                />
              </div>
              <div className="input-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  style={{ fontSize: '1.1rem' }}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}
                style={{ width: '100%', marginTop: 8, fontSize: '1.1rem' }}>
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
              <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.88rem' }}>
                <button type="button" onClick={() => setModoReset(true)}
                  style={{ background: 'none', border: 'none', color: '#5a6b60', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.88rem' }}>
                  Olvidé mi contraseña
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleReset}>
              {error && <div className="alert alert-error">{error}</div>}
              {resetMsg && <div className="alert alert-exito">{resetMsg}</div>}
              <p style={{ color: '#5a6b60', marginBottom: 18, fontSize: '0.95rem' }}>
                Ingresá tu correo y te mandamos un link para cambiar la contraseña.
              </p>
              <div className="input-group">
                <label>Correo electrónico</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tucorreo@email.com" required />
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>
                Enviar email
              </button>
              <p style={{ textAlign: 'center', marginTop: 16 }}>
                <button type="button" onClick={() => setModoReset(false)}
                  style={{ background: 'none', border: 'none', color: '#4a7c59', cursor: 'pointer', fontWeight: 700, fontSize: '0.92rem' }}>
                  ← Volver
                </button>
              </p>
            </form>
          )}
          <p style={{ textAlign: 'center', marginTop: 20, color: '#5a6b60', fontSize: '0.95rem' }}>
            ¿Es tu primera vez?{' '}
            <Link to="/registro" style={{ color: '#4a7c59', fontWeight: 700 }}>Registrate acá</Link>
          </p>
        </div>
        <p style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/" style={{ color: '#5a6b60', fontSize: '0.9rem' }}>← Volver al inicio</Link>
        </p>
      </div>
    </div>
  )
}

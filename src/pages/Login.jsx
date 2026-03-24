import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const esProfe = params.get('rol') === 'profe'

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setMensaje('')
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass)
      const snap = await getDoc(doc(db, 'users', cred.user.uid))
      if (!snap.exists()) { setError('Usuario no encontrado.'); setLoading(false); return }
      const perfil = snap.data()
      if (perfil.rol === 'profe') navigate('/profe')
      else navigate('/alumna')
    } catch (err) {
      setError('Email o contraseña incorrectos. Revisá los datos.')
      setLoading(false)
    }
  }

  async function resetPassword() {
    setError('')
    setMensaje('')
    if (!email.trim()) {
      setError('Ingresá tu email primero y luego hacé clic en olvidé mi contraseña.')
      return
    }
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setMensaje('Te enviamos un email para restablecer tu contraseña. Revisá tu bandeja de entrada.')
    } catch (err) {
      setError('No encontramos una cuenta con ese email.')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f0f7f2 0%, #faf8f4 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px'
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/" style={{ display: 'inline-block' }}>
            <h2 style={{ color: '#4a7c59', letterSpacing: '0.1em' }}>ANIMA PILATES</h2>
          </Link>
          <p style={{ color: '#5a6b60', marginTop: 8 }}>
            {esProfe ? 'Acceso profesional' : 'Bienvenida de vuelta'}
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleLogin}>
            {error && <div className="alert alert-error">{error}</div>}
            {mensaje && (
              <div className="alert" style={{ background: '#e6f4ec', color: '#2d6a4f', border: '1px solid #b7dfc8', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                ✅ {mensaje}
              </div>
            )}

            <div className="input-group">
              <label>Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tucorreo@email.com"
                required
                autoComplete="email"
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
              />
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', marginTop: 8 }}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          {!esProfe && (
            <p style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                onClick={resetPassword}
                style={{ background: 'none', border: 'none', color: '#4a7c59', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </p>
          )}

          {!esProfe && (
            <p style={{ textAlign: 'center', marginTop: 16, color: '#5a6b60', fontSize: '0.95rem' }}>
              ¿Es tu primera vez?{' '}
              <Link to="/registro" style={{ color: '#4a7c59', fontWeight: 700 }}>Registrate acá</Link>
            </p>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/" style={{ color: '#5a6b60', fontSize: '0.9rem' }}>← Volver al inicio</Link>
        </p>
      </div>
    </div>
  )
}

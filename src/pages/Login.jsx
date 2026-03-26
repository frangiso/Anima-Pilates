import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [telefono, setTelefono] = useState('')
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
      if (esProfe) {
        await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), pass)
        navigate('/profe', { replace: true })
        return
      }

      // Traer TODOS los usuarios y filtrar en el cliente
      // Así evitamos cualquier problema de índices o queries
      const telBuscado = telefono.trim().replace(/\s/g, '')
      const snap = await getDocs(collection(db, 'usuarios'))
      
      const alumna = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find(u => {
          if (u.rol !== 'alumna') return false
          const telGuardado = (u.telefono || '').replace(/\s/g, '')
          // Comparar con y sin 0 adelante
          return (
            telGuardado === telBuscado ||
            telGuardado === '0' + telBuscado ||
            '0' + telGuardado === telBuscado
          )
        })

      if (!alumna) {
        setError('No encontramos una alumna con ese teléfono. Revisá el número.')
        setLoading(false)
        return
      }

      await signInWithEmailAndPassword(auth, alumna.email, pass)
      navigate('/alumna', { replace: true })

    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Contraseña incorrecta.')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Demasiados intentos. Esperá unos minutos.')
      } else {
        setError('Error al ingresar: ' + err.code)
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
      setResetMsg('Te enviamos un email para restablecer tu contraseña.')
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

              {esProfe ? (
                <div className="input-group">
                  <label>Correo electrónico</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="tucorreo@email.com" required autoComplete="email" />
                </div>
              ) : (
                <div className="input-group">
                  <label>Tu número de teléfono</label>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={e => setTelefono(e.target.value)}
                    placeholder="Ej: 2664123456"
                    required
                    autoComplete="off"
                    inputMode="numeric"
                    style={{ fontSize: '1.3rem', letterSpacing: '0.08em' }}
                  />
                  <span style={{ fontSize: '0.82rem', color: '#5a6b60', marginTop: 4 }}>
                    El mismo número que diste al registrarte
                  </span>
                </div>
              )}

              <div className="input-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  style={{ fontSize: '1.2rem' }}
                />
              </div>

              <button className="btn btn-primary" type="submit" disabled={loading}
                style={{ width: '100%', marginTop: 8, fontSize: '1.1rem' }}>
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>

              {!esProfe && (
                <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.88rem' }}>
                  <button type="button" onClick={() => setModoReset(true)}
                    style={{ background: 'none', border: 'none', color: '#5a6b60', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.88rem' }}>
                    Olvidé mi contraseña
                  </button>
                </p>
              )}
            </form>
          ) : (
            <form onSubmit={handleReset}>
              {error && <div className="alert alert-error">{error}</div>}
              {resetMsg && <div className="alert alert-exito">{resetMsg}</div>}
              <p style={{ color: '#5a6b60', marginBottom: 18, fontSize: '0.95rem' }}>
                Ingresá el correo con el que te registraste y te mandamos un link para cambiar la contraseña.
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

          {!modoReset && !esProfe && (
            <p style={{ textAlign: 'center', marginTop: 20, color: '#5a6b60', fontSize: '0.95rem' }}>
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

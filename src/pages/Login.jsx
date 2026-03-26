import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '../firebase'

export default function Login() {
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [modoReset, setModoReset] = useState(false)
  const [resetMsg, setResetMsg] = useState('')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const esProfe = params.get('rol') === 'profe'

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (esProfe) {
        // Profe ingresa con email directamente
        const cred = await signInWithEmailAndPassword(auth, email.trim(), pass)
        navigate('/profe')
        return
      }
      // Alumna: buscar email por nombre + apellido
      const q = query(
        collection(db, 'usuarios'),
        where('nombre', '==', nombre.trim()),
        where('apellido', '==', apellido.trim()),
        where('rol', '==', 'alumna')
      )
      const snap = await getDocs(q)
      if (snap.empty) {
        setError('No encontramos una alumna con ese nombre y apellido. Revisá los datos.')
        setLoading(false)
        return
      }
      const perfil = snap.docs[0].data()
      await signInWithEmailAndPassword(auth, perfil.email, pass)
      navigate('/alumna')
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Contraseña incorrecta. Revisá los datos.')
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
      setResetMsg('Te enviamos un email para restablecer tu contraseña. Revisá tu correo.')
    } catch {
      setError('No encontramos ese correo. Revisá que sea el que usaste al registrarte.')
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
            {modoReset ? 'Restablecer contraseña' : esProfe ? 'Acceso profesional' : 'Bienvenida de vuelta'}
          </p>
        </div>

        <div className="card">
          {!modoReset ? (
            <form onSubmit={handleLogin}>
              {error && <div className="alert alert-error">{error}</div>}

              {esProfe ? (
                <div className="input-group">
                  <label>Correo electrónico</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="tucorreo@email.com" required autoComplete="email" />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  <div className="input-group">
                    <label>Nombre</label>
                    <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                      placeholder="María" required autoComplete="given-name" />
                  </div>
                  <div className="input-group">
                    <label>Apellido</label>
                    <input type="text" value={apellido} onChange={e => setApellido(e.target.value)}
                      placeholder="García" required autoComplete="family-name" />
                  </div>
                </div>
              )}

              <div className="input-group">
                <label>Contraseña</label>
                <input type="password" value={pass} onChange={e => setPass(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password" />
              </div>

              <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
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
                Ingresá el correo con el que te registraste y te enviamos un link para cambiar tu contraseña.
              </p>
              <div className="input-group">
                <label>Correo electrónico</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tucorreo@email.com" required />
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>
                Enviar email de restablecimiento
              </button>
              <p style={{ textAlign: 'center', marginTop: 16 }}>
                <button type="button" onClick={() => setModoReset(false)}
                  style={{ background: 'none', border: 'none', color: '#4a7c59', cursor: 'pointer', fontWeight: 700, fontSize: '0.92rem' }}>
                  ← Volver al inicio de sesión
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

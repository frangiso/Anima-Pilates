import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

export default function Register() {
  const [form, setForm] = useState({ nombre: '', apellido: '', telefono: '', email: '', pass: '', pass2: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function setF(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })) }

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    if (form.pass !== form.pass2) { setError('Las contraseñas no coinciden.'); return }
    if (form.pass.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (!form.telefono) { setError('El teléfono es obligatorio.'); return }
    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.pass)
      await setDoc(doc(db, 'usuarios', cred.user.uid), {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim().toLowerCase(),
        rol: 'alumna',
        estado: 'activa',
        plan: null,
        clasesRestantes: 0,
        clasesUsadas: 0,
        deuda: false,
        planVencimiento: null,
        creadoEn: serverTimestamp()
      })
      // Notificación para la profe
      await addDoc(collection(db, 'notificaciones'), {
        tipo: 'nueva_alumna',
        titulo: 'Nueva alumna registrada',
        mensaje: `${form.nombre} ${form.apellido} se registró y espera ser activada.`,
        leida: false,
        creadoEn: serverTimestamp(),
        datos: { uid: cred.user.uid, nombre: form.nombre, apellido: form.apellido }
      })
      navigate('/alumna')
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Ese email ya está registrado. Intentá iniciar sesión.')
      else setError('Ocurrió un error. Intentá nuevamente.')
      setLoading(false)
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
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link to="/" style={{ display: 'inline-block' }}>
            <h2 style={{ color: '#4a7c59', letterSpacing: '0.1em' }}>ANIMA PILATES</h2>
          </Link>
          <p style={{ color: '#5a6b60', marginTop: 8 }}>Creá tu cuenta para reservar clases</p>
        </div>

        <div className="card">
          <form onSubmit={handleRegister}>
            {error && <div className="alert alert-error">{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div className="input-group">
                <label>Nombre</label>
                <input type="text" value={form.nombre} onChange={setF('nombre')} placeholder="María" required />
              </div>
              <div className="input-group">
                <label>Apellido</label>
                <input type="text" value={form.apellido} onChange={setF('apellido')} placeholder="García" required />
              </div>
            </div>
            <div className="input-group">
              <label>Teléfono (WhatsApp)</label>
              <input type="tel" value={form.telefono} onChange={setF('telefono')} placeholder="2664 123456" required />
            </div>
            <div className="input-group">
              <label>Correo electrónico</label>
              <input type="email" value={form.email} onChange={setF('email')} placeholder="tucorreo@email.com" required autoComplete="email" />
            </div>
            <div className="input-group">
              <label>Contraseña</label>
              <input type="password" value={form.pass} onChange={setF('pass')} placeholder="Mínimo 6 caracteres" required />
            </div>
            <div className="input-group">
              <label>Repetir contraseña</label>
              <input type="password" value={form.pass2} onChange={setF('pass2')} placeholder="••••••••" required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
              {loading ? 'Registrando...' : 'Crear mi cuenta'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, color: '#5a6b60', fontSize: '0.95rem' }}>
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" style={{ color: '#4a7c59', fontWeight: 700 }}>Iniciar sesión</Link>
          </p>
        </div>

        <div className="alert alert-info" style={{ marginTop: 16, fontSize: '0.9rem' }}>
          💡 Una vez registrada, la profesional te asignará tu plan y podrás empezar a reservar tus clases.
        </div>

        <p style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/" style={{ color: '#5a6b60', fontSize: '0.9rem' }}>← Volver al inicio</Link>
        </p>
      </div>
    </div>
  )
}

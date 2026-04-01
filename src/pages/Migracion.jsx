import { useState } from 'react'
import { collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Migracion() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [estado, setEstado] = useState('idle') // idle | corriendo | listo | error
  const [log, setLog] = useState([])
  const [stats, setStats] = useState({ total: 0, ok: 0, sinTel: 0, error: 0 })

  // Solo la profe puede acceder
  if (perfil?.rol !== 'profe') {
    navigate('/')
    return null
  }

  async function migrar() {
    setEstado('corriendo')
    setLog([])
    setStats({ total: 0, ok: 0, sinTel: 0, error: 0 })

    try {
      const snap = await getDocs(query(collection(db, 'usuarios'), where('rol', '==', 'alumna')))
      const alumnas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      
      let ok = 0, sinTel = 0, errores = 0
      const nuevosLogs = []

      for (const a of alumnas) {
        const tel = (a.telefono || '').trim().replace(/\s/g, '')
        const nombre = `${a.nombre} ${a.apellido}`

        if (!tel) {
          nuevosLogs.push({ tipo: 'warn', msg: `${nombre} — sin teléfono, omitida` })
          sinTel++
          continue
        }

        try {
          // Guardar con y sin 0 adelante por las dudas
          await setDoc(doc(db, 'telefonos', tel), { uid: a.id, nombre })
          if (tel.startsWith('0')) {
            await setDoc(doc(db, 'telefonos', tel.slice(1)), { uid: a.id, nombre })
          } else {
            await setDoc(doc(db, 'telefonos', '0' + tel), { uid: a.id, nombre })
          }
          nuevosLogs.push({ tipo: 'ok', msg: `${nombre} — ${tel} ✓` })
          ok++
        } catch (e) {
          nuevosLogs.push({ tipo: 'error', msg: `${nombre} — error: ${e.message}` })
          errores++
        }
      }

      setLog(nuevosLogs)
      setStats({ total: alumnas.length, ok, sinTel, error: errores })
      setEstado('listo')
    } catch (e) {
      setLog([{ tipo: 'error', msg: 'Error al leer alumnas: ' + e.message }])
      setEstado('error')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f0f7f2 0%, #faf8f4 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px'
    }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h2 style={{ color: '#4a7c59' }}>ANIMA PILATES</h2>
          <p style={{ color: '#5a6b60', marginTop: 8 }}>Migración de teléfonos</p>
        </div>

        <div className="card">
          <h3 style={{ color: '#2d5a3a', marginBottom: 12 }}>Configurar login por teléfono</h3>
          <p style={{ color: '#5a6b60', fontSize: '0.95rem', marginBottom: 20, lineHeight: 1.6 }}>
            Este proceso lee todas las alumnas registradas y crea los registros necesarios para que puedan ingresar con su número de teléfono. Solo hay que hacerlo una vez.
          </p>

          {estado === 'idle' && (
            <button className="btn btn-primary" onClick={migrar} style={{ width: '100%' }}>
              Iniciar migración
            </button>
          )}

          {estado === 'corriendo' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div className="spinner" style={{ minHeight: 60 }} />
              <p style={{ color: '#5a6b60', marginTop: 12 }}>Procesando alumnas...</p>
            </div>
          )}

          {(estado === 'listo' || estado === 'error') && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                <div style={{ background: '#d4edda', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontFamily: 'Cormorant Garamond, serif', color: '#1a6630', fontWeight: 600 }}>{stats.ok}</div>
                  <div style={{ fontSize: '0.78rem', color: '#1a6630' }}>Migradas OK</div>
                </div>
                <div style={{ background: '#fef3cd', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontFamily: 'Cormorant Garamond, serif', color: '#856404', fontWeight: 600 }}>{stats.sinTel}</div>
                  <div style={{ fontSize: '0.78rem', color: '#856404' }}>Sin teléfono</div>
                </div>
                <div style={{ background: '#fde8e8', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.6rem', fontFamily: 'Cormorant Garamond, serif', color: '#c0392b', fontWeight: 600 }}>{stats.error}</div>
                  <div style={{ fontSize: '0.78rem', color: '#c0392b' }}>Con error</div>
                </div>
              </div>

              {estado === 'listo' && stats.error === 0 && (
                <div className="alert alert-exito" style={{ marginBottom: 16 }}>
                  ✅ ¡Listo! Todas las alumnas ya pueden entrar con su teléfono.
                </div>
              )}

              <div style={{ background: '#f8fdf9', borderRadius: 8, padding: 14, maxHeight: 260, overflowY: 'auto', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                {log.map((l, i) => (
                  <div key={i} style={{ color: l.tipo === 'ok' ? '#1a6630' : l.tipo === 'warn' ? '#856404' : '#c0392b', padding: '2px 0' }}>
                    {l.msg}
                  </div>
                ))}
              </div>

              <button className="btn btn-ghost" onClick={() => navigate('/profe')} style={{ width: '100%', marginTop: 16 }}>
                Volver al panel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore'
import { db } from '../firebase'

export default function Sincronizar() {
  const [estado, setEstado] = useState('idle')
  const [log, setLog] = useState([])
  const [stats, setStats] = useState({ total: 0, ok: 0, sinTel: 0, error: 0 })

  async function sincronizar() {
    setEstado('corriendo')
    setLog([])
    setStats({ total: 0, ok: 0, sinTel: 0, error: 0 })

    try {
      const snap = await getDocs(query(collection(db, 'usuarios'), where('rol', '==', 'alumna')))
      const alumnas = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      let ok = 0, sinTel = 0, errores = 0
      const nuevosLogs = []

      for (const a of alumnas) {
        const tel = (a.telefono || '').trim().replace(/[\s\-\(\)\.]/g, '')
        const nombre = `${a.nombre} ${a.apellido}`

        if (!tel) {
          nuevosLogs.push({ tipo: 'warn', msg: `${nombre} — sin teléfono, omitida` })
          sinTel++
          continue
        }

        try {
          const sinCero = tel.startsWith('0') ? tel.slice(1) : tel
          const conCero = '0' + sinCero

          await setDoc(doc(db, 'telefonos', sinCero), { uid: a.id, nombre })
          await setDoc(doc(db, 'telefonos', conCero), { uid: a.id, nombre })

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
    <div>
      <h3 style={{ color: '#2d5a3a', marginBottom: 8 }}>Sincronizar accesos</h3>
      <p style={{ color: '#5a6b60', fontSize: '0.95rem', marginBottom: 20 }}>
        Si alguna alumna no puede entrar con su teléfono, ejecutá esta sincronización. Actualiza los accesos de todas las alumnas sin modificar sus datos ni contraseñas.
      </p>

      {estado === 'idle' && (
        <button className="btn btn-primary" onClick={sincronizar} style={{ minHeight: 52, fontSize: '1rem', padding: '14px 28px' }}>
          🔄 Sincronizar alumnas
        </button>
      )}

      {estado === 'corriendo' && (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <div className="spinner" style={{ minHeight: 60 }} />
          <p style={{ color: '#5a6b60', marginTop: 12 }}>Sincronizando alumnas...</p>
        </div>
      )}

      {(estado === 'listo' || estado === 'error') && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            <div style={{ background: '#d4edda', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontFamily: 'Cormorant Garamond, serif', color: '#1a6630', fontWeight: 600 }}>{stats.ok}</div>
              <div style={{ fontSize: '0.78rem', color: '#1a6630' }}>Sincronizadas</div>
            </div>
            <div style={{ background: '#fef3cd', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontFamily: 'Cormorant Garamond, serif', color: '#856404', fontWeight: 600 }}>{stats.sinTel}</div>
              <div style={{ fontSize: '0.78rem', color: '#856404' }}>Sin teléfono</div>
            </div>
            <div style={{ background: '#fde8e8', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontFamily: 'Cormorant Garamond, serif', color: '#c0392b', fontWeight: 600 }}>{stats.error}</div>
              <div style={{ fontSize: '0.78rem', color: '#c0392b' }}>Con error</div>
            </div>
          </div>

          {estado === 'listo' && stats.error === 0 && (
            <div className="alert alert-exito" style={{ marginBottom: 16 }}>
              ✅ ¡Listo! Todas las alumnas pueden entrar con su teléfono.
            </div>
          )}

          <div style={{ background: '#f8fdf9', borderRadius: 8, padding: 14, maxHeight: 260, overflowY: 'auto', fontSize: '0.82rem', fontFamily: 'monospace', marginBottom: 16 }}>
            {log.map((l, i) => (
              <div key={i} style={{ color: l.tipo === 'ok' ? '#1a6630' : l.tipo === 'warn' ? '#856404' : '#c0392b', padding: '2px 0' }}>
                {l.msg}
              </div>
            ))}
          </div>

          <button className="btn btn-ghost" onClick={() => { setEstado('idle'); setLog([]); setStats({ total: 0, ok: 0, sinTel: 0, error: 0 }) }}
            style={{ minHeight: 44 }}>
            Volver
          </button>
        </>
      )}
    </div>
  )
}

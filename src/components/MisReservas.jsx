import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

export default function MisReservas() {
  const { user } = useAuth()
  const [reservas, setReservas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [cancelando, setCancelando] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const q = query(
      collection(db, 'reservas'),
      where('alumnaId', '==', user.uid),
      where('estado', 'in', ['confirmada', 'pendiente'])
    )
    const snap = await getDocs(q)
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    lista.sort((a, b) => a.fecha.localeCompare(b.fecha))
    setReservas(lista)
    setCargando(false)
  }

  async function cancelar(id, fecha, hora) {
    const hoy = new Date()
    const hs = hora ? hora.split(':')[0] : '12'
    const fechaTurno = new Date(fecha + 'T' + hs.padStart(2,'0') + ':00:00')
    const diffHs = (fechaTurno - hoy) / (1000 * 60 * 60)
    if (diffHs < 2) {
      setMsg({ tipo: 'error', texto: 'No podés cancelar con menos de 2 horas de anticipación. La clase se da por perdida.' })
      return
    }
    setCancelando(id)
    await updateDoc(doc(db, 'reservas', id), { estado: 'cancelada' })
    setMsg({ tipo: 'exito', texto: 'Turno cancelado correctamente.' })
    await cargar()
    setCancelando(null)
  }

  if (cargando) return <div className="spinner" />

  const hoy = new Date().toISOString().split('T')[0]
  const proximas = reservas.filter(r => r.fecha >= hoy)
  const pasadas = reservas.filter(r => r.fecha < hoy)

  return (
    <div>
      <h3 style={{ color: '#2d5a3a', marginBottom: 20 }}>Mis turnos</h3>

      {msg && (
        <div className={`alert alert-${msg.tipo}`} style={{ marginBottom: 16 }}>
          {msg.texto}
          <button onClick={() => setMsg(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
        </div>
      )}

      {proximas.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40, marginBottom: 20 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📅</div>
          <p style={{ color: '#5a6b60' }}>No tenés turnos próximos.<br />¡Reservá una clase desde la sección "Reservar"!</p>
        </div>
      )}

      {proximas.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h4 style={{ color: '#4a7c59', marginBottom: 16, fontSize: '1.1rem' }}>Próximos turnos</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {proximas.map(r => {
              const fechaStr = new Date(r.fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
              const hs = r.hora ? r.hora.split(':')[0].padStart(2,'0') : '12'
              const diffHs = (new Date(r.fecha + 'T' + hs + ':00:00') - new Date()) / (1000 * 60 * 60)
              const puedeCancelar = diffHs >= 2
              return (
                <div key={r.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 16px',
                  background: '#f8fdf9',
                  borderRadius: 10,
                  border: '1px solid #c8ddd0',
                  flexWrap: 'wrap',
                  gap: 10
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', textTransform: 'capitalize' }}>{fechaStr}</div>
                    <div style={{ color: '#5a6b60', fontSize: '0.9rem', marginTop: 2 }}>
                      🕐 {r.hora} hs
                      {r.tipo === 'fija' && ' · Turno fijo'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`badge ${r.estado === 'pendiente' ? 'badge-amarillo' : 'badge-verde'}`}>
                      {r.estado === 'pendiente' ? '⏳ Pendiente' : '✓ Confirmado'}
                    </span>
                    {puedeCancelar && (
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '6px 12px', minHeight: 34, fontSize: '0.85rem' }}
                        onClick={() => cancelar(r.id, r.fecha, r.hora)}
                        disabled={cancelando === r.id}
                      >
                        {cancelando === r.id ? '...' : 'Cancelar'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {pasadas.length > 0 && (
        <div className="card">
          <h4 style={{ color: '#5a6b60', marginBottom: 16, fontSize: '1rem' }}>Historial</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pasadas.slice(0, 10).map(r => (
              <div key={r.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#f8f8f6',
                borderRadius: 8,
                fontSize: '0.9rem',
                color: '#5a6b60'
              }}>
                <span style={{ textTransform: 'capitalize' }}>
                  {new Date(r.fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })} · {r.hora} hs
                </span>
                <span className={`badge ${r.asistio === false ? 'badge-rojo' : 'badge-verde'}`}>{r.asistio === false ? '✗ Faltó' : '✓ Asistida'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, doc, updateDoc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

const DIA_GETDAY = { lun: 1, mar: 2, mie: 3, jue: 4, vie: 5 }

function getProximasOcurrencias(turnosFijos) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const result = []
  for (let i = 0; i < 28; i++) {
    const d = new Date(hoy)
    d.setDate(d.getDate() + i)
    const fecha = d.toISOString().split('T')[0]
    for (const t of turnosFijos) {
      if (d.getDay() === DIA_GETDAY[t.dia]) {
        result.push({ fecha, hora: t.hora, tipo: 'fija', virtual: true })
      }
    }
  }
  return result
}

export default function MisReservas() {
  const { user, perfil } = useAuth()
  const [reservas, setReservas] = useState([])
  const [canceladasFijas, setCanceladasFijas] = useState(new Set())
  const [cargando, setCargando] = useState(true)
  const [cancelando, setCancelando] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => { if (user) cargar() }, [user?.uid])

  async function cargar() {
    setCargando(true)
    try {
      const snap = await getDocs(query(
        collection(db, 'reservas'),
        where('alumnaId', '==', user.uid),
        where('estado', 'in', ['confirmada', 'pendiente'])
      ))
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      lista.sort((a, b) => a.fecha.localeCompare(b.fecha))
      setReservas(lista)

      // Two-field query (avoids composite index requirement); filter tipo client-side
      const canceladasSnap = await getDocs(query(
        collection(db, 'reservas'),
        where('alumnaId', '==', user.uid),
        where('estado', '==', 'cancelada')
      ))
      setCanceladasFijas(new Set(
        canceladasSnap.docs
          .filter(d => d.data().tipo === 'fija')
          .map(d => `${d.data().fecha}_${d.data().hora}`)
      ))
    } catch (err) {
      console.error('Error cargando reservas:', err)
    }
    setCargando(false)
  }

  async function cancelar(id, fecha, hora) {
    const hoy = new Date()
    const hs = hora ? hora.split(':')[0] : '12'
    const fechaTurno = new Date(fecha + 'T' + hs.padStart(2,'0') + ':00:00')
    const diffHs = (fechaTurno - hoy) / (1000 * 60 * 60)
    const reserva = reservas.find(r => r.id === id)

    if (diffHs < 2) {
      setMsg({ tipo: 'error', texto: 'No podés cancelar con menos de 2 horas de anticipación. La clase se da por perdida.' })
      return
    }

    setCancelando(id)
    await updateDoc(doc(db, 'reservas', id), { estado: 'cancelada' })

    if (reserva?.estado === 'confirmada' && reserva?.alumnaId) {
      const alumnaSnap = await getDoc(doc(db, 'usuarios', reserva.alumnaId))
      if (alumnaSnap.exists()) {
        const alumna = alumnaSnap.data()
        const clases = alumna.clasesRestantes ?? null
        const updates = {}

        if (clases !== null) {
          updates.clasesRestantes = clases + 1
          updates.clasesUsadas = Math.max(0, (alumna.clasesUsadas || 0) - 1)
        }

        if (reserva.tipo === 'fija') {
          const mesActual = new Date().toISOString().substring(0, 7)
          const mismoMes = alumna.recuperacionesMes === mesActual
          const slotsActuales = mismoMes ? (alumna.recuperacionesDisponibles ?? 0) : 0
          if (slotsActuales < 2) {
            updates.recuperacionesDisponibles = slotsActuales + 1
            updates.recuperacionesMes = mesActual
          }
        }

        if (alumna.deuda && clases === 0) updates.deuda = false
        await updateDoc(doc(db, 'usuarios', reserva.alumnaId), updates)
      }
    }

    setMsg({ tipo: 'exito', texto: reserva?.estado === 'confirmada'
      ? 'Turno cancelado. Tu clase fue devuelta.'
      : 'Turno cancelado correctamente.'
    })
    await cargar()
    setCancelando(null)
  }

  // Cancel a virtual turnoFijo occurrence (no prior reservation doc, class not yet deducted)
  async function cancelarVirtual(fecha, hora) {
    const hs = hora ? hora.split(':')[0] : '12'
    const fechaTurno = new Date(fecha + 'T' + hs.padStart(2,'0') + ':00:00')
    const diffHs = (fechaTurno - new Date()) / (1000 * 60 * 60)

    if (diffHs < 2) {
      setMsg({ tipo: 'error', texto: 'No podés cancelar con menos de 2 horas de anticipación. La clase se da por perdida.' })
      return
    }

    const cancelKey = `v_${fecha}_${hora}`
    setCancelando(cancelKey)

    // Create a cancelled doc so this occurrence doesn't reappear
    await addDoc(collection(db, 'reservas'), {
      alumnaId: user.uid,
      alumnaNombre: `${perfil.nombre} ${perfil.apellido}`,
      alumnaEmail: perfil.email || '',
      alumnaPhone: perfil.telefono || '',
      fecha, hora,
      tipo: 'fija',
      estado: 'cancelada',
      creadoEn: serverTimestamp()
    })

    // Grant recovery slot (class wasn't deducted yet — that happens when teacher marks attendance)
    const alumnaSnap = await getDoc(doc(db, 'usuarios', user.uid))
    if (alumnaSnap.exists()) {
      const alumna = alumnaSnap.data()
      const mesActual = new Date().toISOString().substring(0, 7)
      const mismoMes = alumna.recuperacionesMes === mesActual
      const slotsActuales = mismoMes ? (alumna.recuperacionesDisponibles ?? 0) : 0
      if (slotsActuales < 2) {
        await updateDoc(doc(db, 'usuarios', user.uid), {
          recuperacionesDisponibles: slotsActuales + 1,
          recuperacionesMes: mesActual
        })
      }
    }

    setMsg({ tipo: 'exito', texto: 'Turno cancelado. Ganaste 1 clase de recuperación.' })
    await cargar()
    setCancelando(null)
  }

  if (cargando) return <div className="spinner" />

  const hoy = new Date().toISOString().split('T')[0]

  // Compute upcoming virtual turnosFijo occurrences
  const turnosFijos = perfil?.turnosFijos || []
  const fechasConDoc = new Set(reservas.map(r => `${r.fecha}_${r.hora}`))
  const virtuales = turnosFijos.length > 0
    ? getProximasOcurrencias(turnosFijos).filter(v =>
        !fechasConDoc.has(`${v.fecha}_${v.hora}`) &&
        !canceladasFijas.has(`${v.fecha}_${v.hora}`)
      )
    : []

  const proximas = [
    ...reservas.filter(r => r.fecha >= hoy),
    ...virtuales
  ].sort((a, b) => {
    const d = a.fecha.localeCompare(b.fecha)
    return d !== 0 ? d : a.hora.localeCompare(b.hora)
  })
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
              const rowKey = r.virtual ? `virt_${r.fecha}_${r.hora}` : r.id
              const cancelKey = r.virtual ? `v_${r.fecha}_${r.hora}` : r.id
              const fechaStr = new Date(r.fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
              const hs = r.hora ? r.hora.split(':')[0].padStart(2,'0') : '12'
              const diffHs = (new Date(r.fecha + 'T' + hs + ':00:00') - new Date()) / (1000 * 60 * 60)
              const puedeCancelar = diffHs >= 2
              return (
                <div key={rowKey} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px', background: '#f8fdf9', borderRadius: 10,
                  border: '1px solid #c8ddd0', flexWrap: 'wrap', gap: 10
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', textTransform: 'capitalize' }}>{fechaStr}</div>
                    <div style={{ color: '#5a6b60', fontSize: '0.9rem', marginTop: 2 }}>
                      🕐 {r.hora} hs
                      {r.tipo === 'fija' && ' · Turno fijo'}
                      {r.tipo === 'recuperacion' && ' · Recuperación'}
                    </div>
                    {!puedeCancelar && !r.virtual && r.estado === 'confirmada' && (
                      <div style={{ fontSize: '0.78rem', color: '#c0392b', marginTop: 4 }}>
                        ⚠️ Ya no se puede cancelar
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {r.virtual ? (
                      <span className="badge badge-gris">📌 Fijo</span>
                    ) : (
                      <span className={`badge ${r.estado === 'pendiente' ? 'badge-amarillo' : 'badge-verde'}`}>
                        {r.estado === 'pendiente' ? '⏳ Pendiente' : '✓ Confirmado'}
                      </span>
                    )}
                    {puedeCancelar && (
                      <button className="btn btn-ghost"
                        style={{ padding: '6px 12px', minHeight: 34, fontSize: '0.85rem' }}
                        onClick={() => r.virtual ? cancelarVirtual(r.fecha, r.hora) : cancelar(r.id, r.fecha, r.hora)}
                        disabled={cancelando === cancelKey}>
                        {cancelando === cancelKey ? '...' : 'Cancelar'}
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
                display: 'flex', justifyContent: 'space-between',
                padding: '10px 14px', background: '#f8f8f6', borderRadius: 8, fontSize: '0.9rem', color: '#5a6b60'
              }}>
                <span style={{ textTransform: 'capitalize' }}>
                  {new Date(r.fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })} · {r.hora} hs
                </span>
                <span className={`badge ${r.asistio === false ? 'badge-rojo' : 'badge-verde'}`}>
                  {r.asistio === false ? '✗ Faltó' : '✓ Asistida'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

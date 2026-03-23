import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const CUPOS_MAX = 5

function getHoras() {
  const horas = []
  for (let h = 8; h <= 20; h++) horas.push(`${h.toString().padStart(2,'0')}:00`)
  return horas
}

function getLunes(fecha) {
  const d = new Date(fecha)
  const dia = d.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + diff)
  d.setHours(0,0,0,0)
  return d
}

function fechaISO(d) {
  return d.toISOString().split('T')[0]
}

function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export default function ReservarTurno({ bloqueada }) {
  const { user, perfil } = useAuth()
  const [semana, setSemana] = useState(getLunes(new Date()))
  const [reservas, setReservas] = useState({})
  const [misReservas, setMisReservas] = useState({})
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [tipoReserva, setTipoReserva] = useState('unica')

  const horas = getHoras()

  useEffect(() => {
    cargarSemana()
  }, [semana])

  async function cargarSemana() {
    setCargando(true)
    const fechas = DIAS.map((_, i) => fechaISO(addDays(semana, i)))
    const snap = await getDocs(query(collection(db, 'reservas'),
      where('fecha', 'in', fechas),
      where('estado', 'in', ['confirmada', 'pendiente'])
    ))
    const mapa = {}
    const mias = {}
    snap.forEach(d => {
      const r = d.data()
      const key = `${r.fecha}_${r.hora}`
      mapa[key] = (mapa[key] || 0) + 1
      if (r.alumnaId === user.uid) mias[key] = { id: d.id, ...r }
    })
    setReservas(mapa)
    setMisReservas(mias)
    setCargando(false)
  }

  function getCelda(diaIdx, hora) {
    const fecha = fechaISO(addDays(semana, diaIdx))
    const key = `${fecha}_${hora}`
    const ocupados = reservas[key] || 0
    const mia = misReservas[key]
    if (mia) return { estado: 'mia', key, fecha, hora, reservaId: mia.id, estadoReserva: mia.estado }
    if (ocupados >= CUPOS_MAX) return { estado: 'lleno', key, fecha, hora }
    return { estado: 'libre', key, fecha, hora, cuposLibres: CUPOS_MAX - ocupados }
  }

  async function confirmarReserva() {
    if (!modal) return
    setGuardando(true)
    try {
      await addDoc(collection(db, 'reservas'), {
        alumnaId: user.uid,
        alumnaNombre: `${perfil.nombre} ${perfil.apellido}`,
        alumnaEmail: perfil.email,
        alumnaPhone: perfil.telefono || '',
        fecha: modal.fecha,
        hora: modal.hora,
        tipo: tipoReserva,
        estado: tipoReserva === 'fija' ? 'pendiente' : 'confirmada',
        creadoEn: serverTimestamp()
      })
      // Notificación
      await addDoc(collection(db, 'notificaciones'), {
        tipo: tipoReserva === 'fija' ? 'turno_fijo_solicitado' : 'nueva_reserva',
        titulo: tipoReserva === 'fija' ? 'Solicitud de turno fijo' : 'Nueva reserva',
        mensaje: `${perfil.nombre} ${perfil.apellido} reservó el ${modal.fecha} a las ${modal.hora}hs.`,
        leida: false,
        creadoEn: serverTimestamp(),
        datos: { alumnaId: user.uid, fecha: modal.fecha, hora: modal.hora }
      })
      setMsg({ tipo: 'exito', texto: tipoReserva === 'fija' ? '¡Solicitud enviada! La profesora la confirmará pronto.' : '¡Turno reservado con éxito!' })
      setModal(null)
      await cargarSemana()
    } catch {
      setMsg({ tipo: 'error', texto: 'Error al reservar. Intentá nuevamente.' })
    }
    setGuardando(false)
  }

  if (cargando) return <div className="spinner" />

  const hoy = fechaISO(new Date())
  const lunes = fechaISO(semana)
  const semanaAnteriorHabilitada = lunes > hoy

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ color: '#2d5a3a' }}>Elegí tu turno</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => setSemana(addDays(semana, -7))}
            disabled={!semanaAnteriorHabilitada} style={{ padding: '8px 14px', minHeight: 38 }}>← Anterior</button>
          <span style={{ fontSize: '0.9rem', color: '#5a6b60', fontWeight: 700 }}>
            {addDays(semana, 0).toLocaleDateString('es-AR', { day:'numeric', month:'short' })} –{' '}
            {addDays(semana, 4).toLocaleDateString('es-AR', { day:'numeric', month:'short' })}
          </span>
          <button className="btn btn-ghost" onClick={() => setSemana(addDays(semana, 7))}
            style={{ padding: '8px 14px', minHeight: 38 }}>Siguiente →</button>
        </div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.tipo}`} style={{ marginBottom: 16 }}>
          {msg.texto}
          <button onClick={() => setMsg(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
        </div>
      )}

      {bloqueada ? (
        <div className="alert alert-error">🚫 No podés reservar turnos hasta regularizar tu situación.</div>
      ) : (
        <>
          {/* Leyenda */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: '#d4edda', border: '1px solid #b8ddc4', display: 'inline-block' }} /> Libre
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: '#4a7c59', display: 'inline-block' }} /> Mi turno
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: '#fde8e8', border: '1px solid #f5c6c6', display: 'inline-block' }} /> Lleno
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div className="grilla-semana">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
              {DIAS.map((dia, i) => (
                <div key={dia} className="grilla-header">
                  {dia}<br />
                  <span style={{ fontSize: '0.78rem', opacity: 0.85 }}>
                    {addDays(semana, i).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
              {horas.map(hora => (
                <>
                  <div key={`h${hora}`} className="grilla-hora">{hora}</div>
                  {DIAS.map((_, di) => {
                    const celda = getCelda(di, hora)
                    const fechaDia = fechaISO(addDays(semana, di))
                    const pasado = fechaDia < hoy
                    if (pasado) return (
                      <div key={`${di}_${hora}`} className="turno-cell turno-bloqueado" />
                    )
                    if (celda.estado === 'mia') return (
                      <div key={celda.key} className="turno-cell turno-reservado">
                        <span style={{ fontSize: '0.9rem' }}>✓</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>
                          {celda.estadoReserva === 'pendiente' ? 'Pend.' : 'Tuyo'}
                        </span>
                      </div>
                    )
                    if (celda.estado === 'lleno') return (
                      <div key={celda.key} className="turno-cell turno-lleno">
                        <span style={{ fontSize: '0.8rem' }}>Lleno</span>
                      </div>
                    )
                    return (
                      <div key={celda.key} className="turno-cell turno-libre"
                        onClick={() => setModal(celda)}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{celda.cuposLibres}</span>
                        <span style={{ fontSize: '0.7rem' }}>lugar{celda.cuposLibres !== 1 ? 'es' : ''}</span>
                      </div>
                    )
                  })}
                </>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modal confirmación */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Confirmar reserva</h3>
            <p style={{ color: '#5a6b60', marginBottom: 20 }}>
              📅 {new Date(modal.fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}<br />
              🕐 {modal.hora} hs
            </p>

            <div className="input-group">
              <label>Tipo de reserva</label>
              <select value={tipoReserva} onChange={e => setTipoReserva(e.target.value)}>
                <option value="unica">Clase suelta (una sola vez)</option>
                <option value="fija">Turno fijo semanal (necesita aprobación)</option>
              </select>
            </div>

            {tipoReserva === 'fija' && (
              <div className="alert alert-info" style={{ fontSize: '0.88rem' }}>
                💡 Los turnos fijos quedan pendientes hasta que la profesora los apruebe. Te avisaremos.
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={confirmarReserva} disabled={guardando} style={{ flex: 1 }}>
                {guardando ? 'Guardando...' : 'Confirmar'}
              </button>
              <button className="btn btn-ghost" onClick={() => setModal(null)} style={{ flex: 1 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

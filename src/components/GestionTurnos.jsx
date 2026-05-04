import { useState, useEffect, useRef } from 'react'
import { collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const CUPOS_MAX = 5

function getHoras() {
  const h = []
  for (let i = 8; i <= 20; i++) h.push(`${i.toString().padStart(2,'0')}:00`)
  return h
}

function getLunes(fecha) {
  const d = new Date(fecha)
  const dia = d.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + diff)
  d.setHours(0,0,0,0)
  return d
}

function fechaISO(d) { return d.toISOString().split('T')[0] }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

export default function GestionTurnos() {
  const [semana, setSemana] = useState(getLunes(new Date()))
  const [reservas, setReservas] = useState([])
  const [bloqueados, setBloqueados] = useState([])
  const [feriados, setFeriados] = useState([])
  const [alumnas, setAlumnas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState('pendientes')
  const [msg, setMsg] = useState(null)

  const [modalReserva, setModalReserva] = useState(null)
  const [modalDetalle, setModalDetalle] = useState(null)
  const [alumnaSelec, setAlumnaSelec] = useState('')
  const [tipoReserva, setTipoReserva] = useState('unica')
  const [guardando, setGuardando] = useState(false)
  const [modoExterno, setModoExterno] = useState(false)
  const [nombreExterno, setNombreExterno] = useState('')
  const [telefonoExterno, setTelefonoExterno] = useState('')

  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevaDesc, setNuevaDesc] = useState('')
  const feriadosCargados = useRef(false)

  async function quitarDeTurnoGrilla(reservaId, alumnaNombre) {
    if (!window.confirm(`¿Querés quitar a ${alumnaNombre} de este turno?`)) return
    await deleteDoc(doc(db, 'reservas', reservaId))
    setReservas(prev => prev.filter(r => r.id !== reservaId))
    setModalDetalle(null)
    setMsg({ tipo: 'exito', texto: `${alumnaNombre} quitada del turno.` })
  }

  useEffect(() => { cargarAlumnas() }, [])

  // Feriados: se cargan una sola vez al montar el componente
  useEffect(() => {
    if (feriadosCargados.current) return
    feriadosCargados.current = true
    getDocs(collection(db, 'feriados'))
      .then(snap => setFeriados(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  useEffect(() => { cargar() }, [semana])

  async function cargarAlumnas() {
    const snap = await getDocs(query(collection(db, 'usuarios'), where('rol', '==', 'alumna')))
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.estado !== 'inactiva')
    lista.sort((a, b) => (a.apellido || '').localeCompare(b.apellido || ''))
    setAlumnas(lista)
  }

  async function cargar() {
    setCargando(true)
    const fechas = DIAS.map((_, i) => fechaISO(addDays(semana, i)))
    const [snapRes, snapBloq] = await Promise.all([
      getDocs(query(collection(db, 'reservas'), where('fecha', 'in', fechas))),
      getDocs(query(collection(db, 'bloqueados'), where('fecha', 'in', fechas))),
    ])
    setReservas(snapRes.docs.map(d => ({ id: d.id, ...d.data() })))
    setBloqueados(snapBloq.docs.map(d => ({ id: d.id, ...d.data() })))
    setCargando(false)
  }

  async function aprobar(id, alumnaId, fecha, hora, alumnaNombre) {
    await updateDoc(doc(db, 'reservas', id), { estado: 'confirmada' })
    const fechaStr = fecha ? new Date(fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
    await addDoc(collection(db, 'notificaciones'), {
      tipo: 'turno_aprobado',
      titulo: 'Turno confirmado',
      mensaje: `Turno de ${alumnaNombre || 'alumna'}${fechaStr ? ` — ${fechaStr}` : ''}${hora ? ` a las ${hora}hs` : ''} confirmado.`,
      leida: false,
      creadoEn: serverTimestamp()
    })
    if (alumnaId) {
      await addDoc(collection(db, 'avisos'), {
        alumnaId,
        tipo: 'turno_aprobado',
        titulo: '✅ Turno confirmado',
        mensaje: `Tu solicitud de turno${fechaStr ? ` del ${fechaStr}` : ''}${hora ? ` a las ${hora}hs` : ''} fue aprobada. ¡Te esperamos!`,
        leido: false,
        creadoEn: serverTimestamp()
      })
    }
    setReservas(prev => prev.map(r => r.id === id ? { ...r, estado: 'confirmada' } : r))
    setMsg({ tipo: 'exito', texto: 'Turno aprobado.' })
  }

  async function rechazar(id, alumnaId, fecha, hora, alumnaNombre) {
    await updateDoc(doc(db, 'reservas', id), { estado: 'cancelada' })
    const fechaStr = fecha ? new Date(fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
    await addDoc(collection(db, 'notificaciones'), {
      tipo: 'turno_rechazado',
      titulo: 'Turno rechazado',
      mensaje: `Solicitud de ${alumnaNombre || 'alumna'}${fechaStr ? ` — ${fechaStr}` : ''}${hora ? ` a las ${hora}hs` : ''} rechazada.`,
      leida: false,
      creadoEn: serverTimestamp()
    })
    if (alumnaId) {
      await addDoc(collection(db, 'avisos'), {
        alumnaId,
        tipo: 'turno_rechazado',
        titulo: '❌ Turno no aprobado',
        mensaje: `Tu solicitud de turno${fechaStr ? ` del ${fechaStr}` : ''}${hora ? ` a las ${hora}hs` : ''} no pudo ser aprobada. Contactá a la profesora para más información.`,
        leido: false,
        creadoEn: serverTimestamp()
      })
    }
    setReservas(prev => prev.map(r => r.id === id ? { ...r, estado: 'cancelada' } : r))
    setMsg({ tipo: 'exito', texto: 'Turno rechazado.' })
  }

  async function toggleBloqueo(fecha, hora) {
    const existe = bloqueados.find(b => b.fecha === fecha && b.hora === hora)
    if (existe) {
      await deleteDoc(doc(db, 'bloqueados', existe.id))
      setBloqueados(prev => prev.filter(b => b.id !== existe.id))
    } else {
      const ref = await addDoc(collection(db, 'bloqueados'), { fecha, hora, creadoEn: serverTimestamp() })
      setBloqueados(prev => [...prev, { id: ref.id, fecha, hora }])
    }
  }

  async function reservarPorAlumna() {
    if (!modalReserva) return
    if (modoExterno && !nombreExterno.trim()) return
    if (!modoExterno && !alumnaSelec) return
    setGuardando(true)
    try {
      if (modoExterno) {
        await addDoc(collection(db, 'reservas'), {
          alumnaId: null,
          alumnaNombre: nombreExterno.trim(),
          alumnaEmail: '',
          alumnaPhone: telefonoExterno.trim(),
          fecha: modalReserva.fecha,
          hora: modalReserva.hora,
          tipo: tipoReserva,
          estado: 'confirmada',
          creadaPorProfe: true,
          sinCuenta: true,
          creadoEn: serverTimestamp()
        })
        setMsg({ tipo: 'exito', texto: `Turno reservado para ${nombreExterno.trim()}.` })
      } else {
        const alumna = alumnas.find(a => a.id === alumnaSelec)
        if (!alumna) { setGuardando(false); return }
        await addDoc(collection(db, 'reservas'), {
          alumnaId: alumna.id,
          alumnaNombre: `${alumna.nombre} ${alumna.apellido}`,
          alumnaEmail: alumna.email,
          alumnaPhone: alumna.telefono || '',
          fecha: modalReserva.fecha,
          hora: modalReserva.hora,
          tipo: tipoReserva,
          estado: 'confirmada',
          creadaPorProfe: true,
          creadoEn: serverTimestamp()
        })
        if (tipoReserva === 'fija') {
          const diaStr = new Date(modalReserva.fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long' })
          const turnoActual = alumna.turnoFijo ? alumna.turnoFijo + ' · ' : ''
          await updateDoc(doc(db, 'usuarios', alumna.id), {
            turnoFijo: turnoActual + `${diaStr} ${modalReserva.hora}hs`
          })
        }
        setMsg({ tipo: 'exito', texto: `Turno reservado para ${alumna.nombre} ${alumna.apellido}.` })
      }
      setModalReserva(null)
      setAlumnaSelec('')
      setNombreExterno('')
      setTelefonoExterno('')
      setTipoReserva('unica')
      setModoExterno(false)
      // Recargar la semana para reflejar la nueva reserva en la grilla
      await cargar()
    } catch {
      setMsg({ tipo: 'error', texto: 'Error al reservar. Intentá nuevamente.' })
    }
    setGuardando(false)
  }

  async function agregarFeriado() {
    if (!nuevaFecha) return
    const existe = feriados.find(f => f.fecha === nuevaFecha)
    if (existe) { setMsg({ tipo: 'error', texto: 'Ese día ya está marcado como feriado.' }); return }
    const ref = await addDoc(collection(db, 'feriados'), { fecha: nuevaFecha, descripcion: nuevaDesc || 'Feriado', creadoEn: serverTimestamp() })
    setFeriados(prev => [...prev, { id: ref.id, fecha: nuevaFecha, descripcion: nuevaDesc || 'Feriado' }])
    setMsg({ tipo: 'exito', texto: 'Feriado agregado.' })
    setNuevaFecha('')
    setNuevaDesc('')
  }

  async function eliminarFeriado(id) {
    await deleteDoc(doc(db, 'feriados', id))
    setFeriados(prev => prev.filter(f => f.id !== id))
    setMsg({ tipo: 'exito', texto: 'Feriado eliminado.' })
  }

  const pendientes = reservas.filter(r => r.estado === 'pendiente')
  const horas = getHoras()

  if (cargando) return <div className="spinner" />

  return (
    <div>
      <h3 style={{ color: '#2d5a3a', marginBottom: 16 }}>Gestión de turnos</h3>

      {msg && (
        <div className={`alert alert-${msg.tipo}`} style={{ marginBottom: 16 }}>
          {msg.texto}
          <button onClick={() => setMsg(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'pendientes', label: '⏳ Pendientes', badge: pendientes.length },
          { key: 'grilla', label: '📅 Grilla semanal' },
          { key: 'feriados', label: '🗓️ Feriados' },
        ].map(t => (
          <button key={t.key}
            className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '8px 16px', minHeight: 38, fontSize: '0.9rem' }}
            onClick={() => setTab(t.key)}>
            {t.label}
            {t.badge > 0 && (
              <span style={{ background: '#c0392b', color: 'white', borderRadius: '50%', width: 18, height: 18,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', marginLeft: 6 }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* PENDIENTES */}
      {tab === 'pendientes' && (
        <div>
          {pendientes.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✓</div>
              <p style={{ color: '#5a6b60' }}>No hay solicitudes pendientes.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pendientes.map(r => (
                <div key={r.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{r.alumnaNombre}</div>
                    <div style={{ color: '#5a6b60', fontSize: '0.9rem', marginTop: 4 }}>
                      📅 {new Date(r.fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      {' '} · 🕐 {r.hora} hs
                    </div>
                    <span className={`badge ${r.tipo === 'recuperacion' ? 'badge-amarillo' : 'badge-gris'}`} style={{ marginTop: 6 }}>
                      {r.tipo === 'recuperacion' ? 'Clase de recuperación' : 'Turno fijo solicitado'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" style={{ padding: '8px 16px', minHeight: 38, fontSize: '0.88rem' }}
                      onClick={() => aprobar(r.id, r.alumnaId, r.fecha, r.hora, r.alumnaNombre)}>✓ Aprobar</button>
                    <button className="btn btn-danger" style={{ padding: '8px 16px', minHeight: 38, fontSize: '0.88rem' }}
                      onClick={() => rechazar(r.id, r.alumnaId, r.fecha, r.hora, r.alumnaNombre)}>✗ Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* GRILLA */}
      {tab === 'grilla' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setSemana(addDays(semana, -7))} style={{ padding: '8px 14px', minHeight: 38 }}>← Anterior</button>
              <span style={{ fontSize: '0.9rem', color: '#5a6b60', fontWeight: 700 }}>
                {addDays(semana, 0).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} –{' '}
                {addDays(semana, 4).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
              </span>
              <button className="btn btn-ghost" onClick={() => setSemana(addDays(semana, 7))} style={{ padding: '8px 14px', minHeight: 38 }}>Siguiente →</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: '0.82rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: '#d4edda', display: 'inline-block' }} /> Libre
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: '#4a7c59', display: 'inline-block' }} /> Con alumnas
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: '#e9ecef', display: 'inline-block' }} /> Bloqueado
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: '#fde8e8', display: 'inline-block' }} /> Feriado
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div className="grilla-semana">
              <div />
              {DIAS.map((d, i) => {
                const fecha = fechaISO(addDays(semana, i))
                const esFeriado = feriados.find(f => f.fecha === fecha)
                return (
                  <div key={d} className="grilla-header" style={{ background: esFeriado ? '#c0392b' : undefined }}>
                    {d}<br />
                    <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                      {addDays(semana, i).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </span>
                    {esFeriado && <div style={{ fontSize: '0.65rem', opacity: 0.9 }}>Feriado</div>}
                  </div>
                )
              })}
              {horas.map(hora => (
                <>
                  <div key={`h${hora}`} className="grilla-hora">{hora}</div>
                  {DIAS.map((_, di) => {
                    const fecha = fechaISO(addDays(semana, di))
                    const esFeriado = feriados.find(f => f.fecha === fecha)
                    const bloq = bloqueados.find(b => b.fecha === fecha && b.hora === hora)
                    const resHora = reservas.filter(r => r.fecha === fecha && r.hora === hora && r.estado !== 'cancelada')
                    const ocupados = resHora.length
                    const hayPendiente = resHora.some(r => r.estado === 'pendiente')
                    const lleno = ocupados >= CUPOS_MAX

                    if (esFeriado) return (
                      <div key={`${di}_${hora}`} className="turno-cell turno-lleno" style={{ background: '#fde8e8', cursor: 'not-allowed' }} />
                    )
                    if (bloq) return (
                      <div key={`${di}_${hora}`} className="turno-cell turno-bloqueado"
                        onClick={() => toggleBloqueo(fecha, hora)} style={{ cursor: 'pointer' }}>
                        <span style={{ fontSize: '0.78rem' }}>🔒</span>
                      </div>
                    )
                    if (lleno) return (
                      <div key={`${di}_${hora}`} className="turno-cell turno-reservado"
                        onClick={() => setModalDetalle({ fecha, hora, resHora })} style={{ cursor: 'pointer' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>5/5</span>
                        {hayPendiente && <span style={{ fontSize: '0.68rem', background: '#fef3cd', color: '#856404', borderRadius: 4, padding: '1px 4px' }}>⏳</span>}
                        <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>Ver / +</span>
                      </div>
                    )
                    if (ocupados > 0) return (
                      <div key={`${di}_${hora}`} className="turno-cell turno-reservado"
                        onClick={() => setModalDetalle({ fecha, hora, resHora })} style={{ cursor: 'pointer' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{ocupados}/5</span>
                        {hayPendiente && <span style={{ fontSize: '0.68rem', background: '#fef3cd', color: '#856404', borderRadius: 4, padding: '1px 4px' }}>⏳</span>}
                        <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>Ver / +</span>
                      </div>
                    )
                    return (
                      <div key={`${di}_${hora}`} className="turno-cell turno-libre"
                        onClick={() => setModalReserva({ fecha, hora })}>
                        <span style={{ fontSize: '0.75rem' }}>+ Agregar</span>
                      </div>
                    )
                  })}
                </>
              ))}
            </div>
          </div>
        </>
      )}

      {/* FERIADOS */}
      {tab === 'feriados' && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <h4 style={{ color: '#4a7c59', marginBottom: 16, fontSize: '1.1rem' }}>Agregar feriado o día sin clases</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Fecha</label>
                <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label>Descripción (opcional)</label>
                <input type="text" value={nuevaDesc} onChange={e => setNuevaDesc(e.target.value)} placeholder="Ej: Año Nuevo..." />
              </div>
              <button className="btn btn-primary" onClick={agregarFeriado} disabled={!nuevaFecha} style={{ minHeight: 50 }}>
                + Agregar
              </button>
            </div>
          </div>

          {feriados.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ color: '#5a6b60' }}>No hay feriados cargados.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="tabla">
                <thead><tr><th>Fecha</th><th>Descripción</th><th>Acción</th></tr></thead>
                <tbody>
                  {feriados.sort((a, b) => a.fecha.localeCompare(b.fecha)).map(f => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 700 }}>
                        {new Date(f.fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </td>
                      <td style={{ color: '#5a6b60' }}>{f.descripcion}</td>
                      <td>
                        <button className="btn btn-danger" style={{ padding: '7px 14px', minHeight: 34, fontSize: '0.85rem' }}
                          onClick={() => eliminarFeriado(f.id)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal detalle turno */}
      {modalDetalle && (
        <div className="modal-overlay" onClick={() => setModalDetalle(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <h3>
              {new Date(modalDetalle.fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} · {modalDetalle.hora} hs
            </h3>
            <p style={{ color: '#5a6b60', fontSize: '0.9rem', marginBottom: 16 }}>{modalDetalle.resHora.length}/5 lugares ocupados</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {modalDetalle.resHora.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f8fdf9', borderRadius: 8, border: '1px solid #c8ddd0' }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>{r.alumnaNombre}</span>
                    {r.tipo === 'fija' && <span className="badge badge-gris" style={{ marginLeft: 8, fontSize: '0.72rem' }}>Fija</span>}
                    {r.tipo === 'recuperacion' && <span className="badge badge-amarillo" style={{ marginLeft: 8, fontSize: '0.72rem' }}>Recuperación</span>}
                    {r.estado === 'pendiente' && <span className="badge badge-amarillo" style={{ marginLeft: 8, fontSize: '0.72rem' }}>Pendiente</span>}
                  </div>
                  <button className="btn btn-danger" style={{ padding: '6px 12px', minHeight: 32, fontSize: '0.82rem' }}
                    onClick={() => quitarDeTurnoGrilla(r.id, r.alumnaNombre)}>Quitar</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={() => { setModalDetalle(null); setModalReserva({ fecha: modalDetalle.fecha, hora: modalDetalle.hora }) }}>
                + Agregar alumna
              </button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModalDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reservar por alumna */}
      {modalReserva && (
        <div className="modal-overlay" onClick={() => setModalReserva(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <h3>Reservar turno para alumna</h3>
            <p style={{ color: '#5a6b60', marginBottom: 20 }}>
              📅 {new Date(modalReserva.fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' '} · 🕐 {modalReserva.hora} hs
            </p>

            {(() => {
              const yaAnotadas = reservas.filter(r => r.fecha === modalReserva.fecha && r.hora === modalReserva.hora && r.estado !== 'cancelada')
              return yaAnotadas.length > 0 && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f0f7f2', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#5a6b60', marginBottom: 6 }}>Ya anotadas ({yaAnotadas.length}/5):</div>
                  {yaAnotadas.map(r => <div key={r.id} style={{ fontSize: '0.9rem', color: '#2d5a3a' }}>· {r.alumnaNombre}</div>)}
                </div>
              )
            })()}

            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              <button className={`btn ${!modoExterno ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, padding: '10px', minHeight: 44, fontSize: '0.9rem' }}
                onClick={() => { setModoExterno(false); setNombreExterno(''); setTelefonoExterno('') }}>
                👤 Alumna registrada
              </button>
              <button className={`btn ${modoExterno ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, padding: '10px', minHeight: 44, fontSize: '0.9rem' }}
                onClick={() => { setModoExterno(true); setAlumnaSelec('') }}>
                ✏️ Sin cuenta en la app
              </button>
            </div>

            {!modoExterno ? (
              <div className="input-group">
                <label>Alumna registrada</label>
                <select value={alumnaSelec} onChange={e => setAlumnaSelec(e.target.value)} required>
                  <option value="">— Seleccioná una alumna —</option>
                  {alumnas.map(a => {
                    const yaAnotada = reservas.some(r => r.fecha === modalReserva.fecha && r.hora === modalReserva.hora && r.alumnaId === a.id && r.estado !== 'cancelada')
                    return (
                      <option key={a.id} value={a.id} disabled={yaAnotada}>
                        {a.nombre} {a.apellido}{yaAnotada ? ' (ya anotada)' : ''}
                      </option>
                    )
                  })}
                </select>
              </div>
            ) : (
              <>
                <div className="input-group">
                  <label>Nombre completo</label>
                  <input type="text" value={nombreExterno} onChange={e => setNombreExterno(e.target.value)} placeholder="Ej: María García" required />
                </div>
                <div className="input-group">
                  <label>Teléfono (opcional)</label>
                  <input type="tel" value={telefonoExterno} onChange={e => setTelefonoExterno(e.target.value)} placeholder="2664123456" />
                </div>
              </>
            )}

            <div className="input-group">
              <label>Tipo de reserva</label>
              <select value={tipoReserva} onChange={e => setTipoReserva(e.target.value)}>
                <option value="unica">Clase suelta (una sola vez)</option>
                <option value="fija">Turno fijo semanal</option>
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={reservarPorAlumna}
                disabled={guardando || (modoExterno ? !nombreExterno.trim() : !alumnaSelec)} style={{ flex: 1 }}>
                {guardando ? 'Guardando...' : 'Confirmar reserva'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setModalReserva(null); setAlumnaSelec(''); setTipoReserva('unica'); setModoExterno(false); setNombreExterno(''); setTelefonoExterno('') }}
                style={{ flex: 1 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

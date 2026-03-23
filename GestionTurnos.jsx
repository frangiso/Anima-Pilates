import { useState, useEffect } from 'react'
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
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState('grilla')
  const [msg, setMsg] = useState(null)

  useEffect(() => { cargar() }, [semana])

  async function cargar() {
    setCargando(true)
    const fechas = DIAS.map((_, i) => fechaISO(addDays(semana, i)))
    const [snapRes, snapBloq] = await Promise.all([
      getDocs(query(collection(db, 'reservas'), where('fecha', 'in', fechas))),
      getDocs(query(collection(db, 'bloqueados'), where('fecha', 'in', fechas)))
    ])
    setReservas(snapRes.docs.map(d => ({ id: d.id, ...d.data() })))
    setBloqueados(snapBloq.docs.map(d => ({ id: d.id, ...d.data() })))
    setCargando(false)
  }

  async function aprobar(id, alumnaId) {
    await updateDoc(doc(db, 'reservas', id), { estado: 'confirmada' })
    await addDoc(collection(db, 'notificaciones'), {
      tipo: 'turno_aprobado',
      titulo: 'Turno fijo aprobado',
      mensaje: 'Tu solicitud de turno fijo fue aprobada.',
      alumnaId,
      leida: false,
      creadoEn: serverTimestamp()
    })
    setMsg({ tipo: 'exito', texto: 'Turno aprobado.' })
    await cargar()
  }

  async function rechazar(id, alumnaId) {
    await updateDoc(doc(db, 'reservas', id), { estado: 'cancelada' })
    await addDoc(collection(db, 'notificaciones'), {
      tipo: 'turno_rechazado',
      titulo: 'Turno fijo no aprobado',
      mensaje: 'Tu solicitud de turno fijo no pudo ser aprobada. Contactá a la profesora.',
      alumnaId,
      leida: false,
      creadoEn: serverTimestamp()
    })
    setMsg({ tipo: 'exito', texto: 'Turno rechazado.' })
    await cargar()
  }

  async function toggleBloqueo(fecha, hora) {
    const existe = bloqueados.find(b => b.fecha === fecha && b.hora === hora)
    if (existe) {
      await deleteDoc(doc(db, 'bloqueados', existe.id))
    } else {
      await addDoc(collection(db, 'bloqueados'), { fecha, hora, creadoEn: serverTimestamp() })
    }
    await cargar()
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={`btn ${tab === 'grilla' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '8px 16px', minHeight: 38, fontSize: '0.9rem' }}
          onClick={() => setTab('grilla')}>
          📅 Grilla semanal
        </button>
        <button className={`btn ${tab === 'pendientes' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '8px 16px', minHeight: 38, fontSize: '0.9rem', position: 'relative' }}
          onClick={() => setTab('pendientes')}>
          ⏳ Pendientes
          {pendientes.length > 0 && (
            <span style={{ background: '#c0392b', color: 'white', borderRadius: '50%', width: 18, height: 18,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem',
              marginLeft: 6 }}>{pendientes.length}</span>
          )}
        </button>
      </div>

      {tab === 'pendientes' && (
        <div>
          {pendientes.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✓</div>
              <p style={{ color: '#5a6b60' }}>No hay solicitudes pendientes de aprobación.</p>
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
                    <span className="badge badge-amarillo" style={{ marginTop: 6 }}>Turno fijo solicitado</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" style={{ padding: '8px 16px', minHeight: 38, fontSize: '0.88rem' }}
                      onClick={() => aprobar(r.id, r.alumnaId)}>✓ Aprobar</button>
                    <button className="btn btn-danger" style={{ padding: '8px 16px', minHeight: 38, fontSize: '0.88rem' }}
                      onClick={() => rechazar(r.id, r.alumnaId)}>✗ Rechazar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'grilla' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setSemana(addDays(semana, -7))}
                style={{ padding: '8px 14px', minHeight: 38 }}>← Anterior</button>
              <span style={{ fontSize: '0.9rem', color: '#5a6b60', fontWeight: 700 }}>
                {addDays(semana, 0).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} –{' '}
                {addDays(semana, 4).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
              </span>
              <button className="btn btn-ghost" onClick={() => setSemana(addDays(semana, 7))}
                style={{ padding: '8px 14px', minHeight: 38 }}>Siguiente →</button>
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
            <span style={{ color: '#5a6b60' }}>· Clic para bloquear/desbloquear</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div className="grilla-semana">
              <div />
              {DIAS.map((d, i) => (
                <div key={d} className="grilla-header">
                  {d}<br />
                  <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                    {addDays(semana, i).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
              {horas.map(hora => (
                <>
                  <div key={`h${hora}`} className="grilla-hora">{hora}</div>
                  {DIAS.map((_, di) => {
                    const fecha = fechaISO(addDays(semana, di))
                    const bloq = bloqueados.find(b => b.fecha === fecha && b.hora === hora)
                    const resHora = reservas.filter(r => r.fecha === fecha && r.hora === hora && r.estado !== 'cancelada')
                    const ocupados = resHora.length
                    const hayPendiente = resHora.some(r => r.estado === 'pendiente')

                    if (bloq) return (
                      <div key={`${di}_${hora}`} className="turno-cell turno-bloqueado"
                        onClick={() => toggleBloqueo(fecha, hora)} style={{ cursor: 'pointer' }}>
                        <span style={{ fontSize: '0.78rem' }}>🔒 Bloq.</span>
                      </div>
                    )
                    if (ocupados === 0) return (
                      <div key={`${di}_${hora}`} className="turno-cell turno-libre"
                        onClick={() => toggleBloqueo(fecha, hora)}>
                        <span style={{ fontSize: '0.78rem' }}>Libre</span>
                      </div>
                    )
                    return (
                      <div key={`${di}_${hora}`} className="turno-cell turno-reservado"
                        style={{ cursor: 'default' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{ocupados}/5</span>
                        {hayPendiente && <span style={{ fontSize: '0.68rem', background: '#fef3cd', color: '#856404', borderRadius: 4, padding: '1px 4px' }}>⏳</span>}
                      </div>
                    )
                  })}
                </>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

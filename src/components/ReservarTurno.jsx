import { useState, useEffect, useRef } from 'react'
import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, increment, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { getAlumnas } from '../alumnaCache'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const DIA_KEYS = ['lun', 'mar', 'mie', 'jue', 'vie']
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

function fechaISO(d) { return d.toISOString().split('T')[0] }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

export default function ReservarTurno({ bloqueada }) {
  const { user, perfil } = useAuth()
  const [semana, setSemana] = useState(getLunes(new Date()))
  const [reservas, setReservas] = useState({})
  const [misReservas, setMisReservas] = useState({})
  const [misCanceladas, setMisCanceladas] = useState(new Set())
  const [feriados, setFeriados] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [tipoReserva, setTipoReserva] = useState('fija')
  const [alumnaActual, setAlumnaActual] = useState(null)

  const horas = getHoras()
  const feriadosCargados = useRef(false)
  const alumnasFijosRef = useRef(null) // cache: cargado una sola vez por sesión

  // Carga feriados, alumnas y datos frescos de la alumna actual al montar
  useEffect(() => {
    if (feriadosCargados.current) return
    feriadosCargados.current = true
    Promise.all([
      getDocs(collection(db, 'feriados')),
      getAlumnas(),
      getDoc(doc(db, 'usuarios', user.uid))
    ]).then(([snapFer, todasAlumnas, alumnaSnap]) => {
      setFeriados(snapFer.docs.map(d => d.data().fecha))
      alumnasFijosRef.current = todasAlumnas.filter(a => a.estado !== 'inactiva')
      if (alumnaSnap.exists()) setAlumnaActual(alumnaSnap.data())
    })
  }, [])

  useEffect(() => { cargarSemana() }, [semana])

  async function cargarSemana() {
    setCargando(true)
    const fechas = DIAS.map((_, i) => fechaISO(addDays(semana, i)))
    // Cargamos TODOS los docs (incluyendo cancelados) para saber si alguien ya tiene doc para esa fecha
    const snapRes = await getDocs(query(collection(db, 'reservas'), where('fecha', 'in', fechas)))
    const mapa = {}
    const mias = {}
    const alumnaDocKeys = new Set() // alumnaId_fecha_hora (todos los estados, para no contar virtuales si hay doc)
    const canceladasPropias = new Set() // fecha_hora donde la alumna actual canceló su turno fijo

    snapRes.forEach(d => {
      const r = d.data()
      const key = `${r.fecha}_${r.hora}`
      if (r.alumnaId) alumnaDocKeys.add(`${r.alumnaId}_${r.fecha}_${r.hora}`)
      if (r.estado === 'cancelada') {
        if (r.alumnaId === user.uid) canceladasPropias.add(key)
        return // canceladas no cuentan para el cupo
      }
      mapa[key] = (mapa[key] || 0) + 1
      if (r.alumnaId === user.uid) mias[key] = { id: d.id, ...r }
    })

    // Contar slots virtuales de turnosFijos para que se descuenten del cupo
    for (const a of (alumnasFijosRef.current || [])) {
      if (a.estado === 'inactiva') continue
      for (const t of (a.turnosFijos || [])) {
        const diaIdx = DIA_KEYS.indexOf(t.dia)
        if (diaIdx === -1) continue
        const fecha = fechaISO(addDays(semana, diaIdx))
        if (!alumnaDocKeys.has(`${a.id}_${fecha}_${t.hora}`)) {
          const key = `${fecha}_${t.hora}`
          mapa[key] = (mapa[key] || 0) + 1
        }
      }
    }
    setReservas(mapa)
    setMisReservas(mias)
    setMisCanceladas(canceladasPropias)
    setCargando(false)
  }

  function esBloqueadoFijo(diaIdx, hora) {
    if ((diaIdx === 1 || diaIdx === 3) && hora === '14:00') return true
    if ((diaIdx === 0 || diaIdx === 2 || diaIdx === 4) && hora === '12:00') return true
    return false
  }

  function getCelda(diaIdx, hora) {
    const fecha = fechaISO(addDays(semana, diaIdx))
    const key = `${fecha}_${hora}`
    const ocupados = reservas[key] || 0
    const mia = misReservas[key]
    const esFeriado = feriados.includes(fecha)
    const esTurnoFijo = (perfil?.turnosFijos || []).some(t => t.dia === DIA_KEYS[diaIdx] && t.hora === hora)
    if (esFeriado) return { estado: 'feriado', key, fecha, hora }
    if (esBloqueadoFijo(diaIdx, hora)) return { estado: 'no-disponible', key, fecha, hora }
    // Solo mostrar como "mia-fija" si no canceló específicamente esta fecha
    if (esTurnoFijo && !misCanceladas.has(key)) return { estado: 'mia-fija', key, fecha, hora }
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
        usaSlotRecuperacion: tipoReserva === 'recuperacion',
        estado: (tipoReserva === 'fija' || tipoReserva === 'recuperacion') ? 'pendiente' : 'confirmada',
        creadoEn: serverTimestamp()
      })
      if (tipoReserva === 'recuperacion') {
        await updateDoc(doc(db, 'usuarios', user.uid), { recuperacionesDisponibles: increment(-1) })
        setAlumnaActual(prev => prev ? { ...prev, recuperacionesDisponibles: (prev.recuperacionesDisponibles ?? 1) - 1 } : prev)
      }
      await addDoc(collection(db, 'notificaciones'), {
        tipo: tipoReserva === 'fija' ? 'turno_fijo_solicitado' : 'nueva_reserva',
        titulo: tipoReserva === 'fija' ? 'Solicitud de turno fijo' : 'Clase de recuperación',
        mensaje: `${perfil.nombre} ${perfil.apellido} reservó el ${modal.fecha} a las ${modal.hora}hs.`,
        leida: false,
        creadoEn: serverTimestamp(),
        datos: { alumnaId: user.uid, fecha: modal.fecha, hora: modal.hora }
      })
      setMsg({ tipo: 'exito', texto: '¡Solicitud enviada! La profesora la confirmará pronto.' })
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
  const tieneTurnosFijos = (perfil?.turnosFijos || []).length > 0
  // Use fresh Firestore data for booking eligibility; fall back to perfil while loading
  const mesActual = new Date().toISOString().substring(0, 7)
  const datosAlumna = alumnaActual ?? perfil
  const sinClases = !bloqueada && (datosAlumna?.clasesRestantes ?? 0) <= 0
  const tieneRecuperacion = datosAlumna?.recuperacionesMes === mesActual && (datosAlumna?.recuperacionesDisponibles ?? 0) > 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ color: '#2d5a3a' }}>Elegí tu turno</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => setSemana(addDays(semana, -7))}
            disabled={!semanaAnteriorHabilitada} style={{ padding: '8px 14px', minHeight: 38 }}>← Anterior</button>
          <span style={{ fontSize: '0.9rem', color: '#5a6b60', fontWeight: 700 }}>
            {addDays(semana, 0).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} –{' '}
            {addDays(semana, 4).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
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
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: '#d4edda', border: '1px solid #b8ddc4', display: 'inline-block' }} /> Libre
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: '#4a7c59', display: 'inline-block' }} /> Mi turno
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: '#fde8e8', border: '1px solid #f5c6c6', display: 'inline-block' }} /> Lleno / Feriado
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div className="grilla-semana">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
              {DIAS.map((dia, i) => {
                const fecha = fechaISO(addDays(semana, i))
                const esFeriado = feriados.includes(fecha)
                return (
                  <div key={dia} className="grilla-header" style={{ background: esFeriado ? '#c0392b' : undefined }}>
                    {dia}<br />
                    <span style={{ fontSize: '0.78rem', opacity: 0.85 }}>
                      {addDays(semana, i).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </span>
                    {esFeriado && <div style={{ fontSize: '0.65rem' }}>Feriado</div>}
                  </div>
                )
              })}
              {horas.map(hora => (
                <>
                  <div key={`h${hora}`} className="grilla-hora">{hora}</div>
                  {DIAS.map((_, di) => {
                    const celda = getCelda(di, hora)
                    const fechaDia = fechaISO(addDays(semana, di))
                    const pasado = fechaDia < hoy

                    if (celda.estado === 'no-disponible') return (
                      <div key={celda.key} className="turno-cell turno-bloqueado" style={{ background: '#e9ecef', cursor: 'not-allowed' }}>
                        <span style={{ fontSize: '0.7rem', color: '#adb5bd' }}>No disp.</span>
                      </div>
                    )
                    if (pasado || celda.estado === 'feriado') return (
                      <div key={`${di}_${hora}`} className="turno-cell turno-bloqueado"
                        style={{ background: celda.estado === 'feriado' ? '#fde8e8' : undefined }} />
                    )
                    if (celda.estado === 'mia-fija') return (
                      <div key={celda.key} className="turno-cell turno-reservado">
                        <span style={{ fontSize: '0.9rem' }}>📌</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>Tuyo</span>
                      </div>
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
                    // Libre cell: students with fixed schedule can only book recovery classes
                    const puedeSolicitarLibre = tieneTurnosFijos
                      ? tieneRecuperacion
                      : (!sinClases || tieneRecuperacion)
                    return (
                      <div key={celda.key} className="turno-cell turno-libre"
                        onClick={() => {
                          if (!puedeSolicitarLibre) {
                            if (tieneTurnosFijos) {
                              setMsg({ tipo: 'info', texto: 'Para reservar una clase extra necesitás tener recuperaciones disponibles este mes.' })
                            } else {
                              setMsg({ tipo: 'info', texto: 'No tenés clases disponibles en tu plan. Hablá con la profesora.' })
                            }
                            return
                          }
                          setTipoReserva(tieneTurnosFijos ? 'recuperacion' : (sinClases ? 'recuperacion' : 'fija'))
                          setModal(celda)
                        }}
                        style={!puedeSolicitarLibre ? { cursor: 'not-allowed', opacity: 0.5 } : {}}>
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

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Confirmar reserva</h3>
            <p style={{ color: '#5a6b60', marginBottom: 20 }}>
              📅 {new Date(modal.fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}<br />
              🕐 {modal.hora} hs
            </p>
            {tieneRecuperacion && (
              <div className="alert alert-info" style={{ fontSize: '0.88rem', marginBottom: 12 }}>
                🔄 Tenés {datosAlumna?.recuperacionesDisponibles ?? 0} de 2 recuperaciones disponibles este mes.
              </div>
            )}

            <div className="input-group">
              <label>Tipo de reserva</label>
              <select value={tipoReserva} onChange={e => setTipoReserva(e.target.value)}>
                {tieneRecuperacion && <option value="recuperacion">Clase de recuperación (necesita aprobación)</option>}
                {!sinClases && !tieneTurnosFijos && <option value="fija">Turno fijo semanal (necesita aprobación)</option>}
              </select>
            </div>

            {tipoReserva === 'fija' && (
              <div className="alert alert-info" style={{ fontSize: '0.88rem' }}>
                💡 Los turnos fijos quedan pendientes hasta que la profesora los apruebe.
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={confirmarReserva}
                disabled={guardando}
                style={{ flex: 1 }}>
                {guardando ? 'Guardando...' : 'Confirmar'}
              </button>
              <button className="btn btn-ghost" onClick={() => setModal(null)} style={{ flex: 1 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

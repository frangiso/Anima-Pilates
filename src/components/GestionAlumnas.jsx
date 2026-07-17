import { useState } from 'react'
import { collection, getDocs, doc, updateDoc, addDoc, query, where, Timestamp, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { invalidateAlumnas } from '../alumnaCache'

const PLANES = ['Plan mensual — 2 veces/semana', 'Plan mensual — 3 veces/semana', 'Plan mensual — libre', 'Pack 8 clases', 'Pack 12 clases', 'Clase suelta']

const DIAS_FIJOS = [
  { key: 'lun', label: 'Lunes' },
  { key: 'mar', label: 'Martes' },
  { key: 'mie', label: 'Miércoles' },
  { key: 'jue', label: 'Jueves' },
  { key: 'vie', label: 'Viernes' },
]
const HORAS_FIJAS = Array.from({ length: 13 }, (_, i) => `${(8 + i).toString().padStart(2, '0')}:00`)

export default function GestionAlumnas() {
  const [alumnas, setAlumnas] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [editando, setEditando] = useState(null)
  const [eliminando, setEliminando] = useState(null)
  const [form, setForm] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [filtro, setFiltro] = useState('todas')
  const [diaSlot, setDiaSlot] = useState('lun')
  const [horaSlot, setHoraSlot] = useState('08:00')

  function aplicarFiltro(lista, textoBusqueda, filtroActual) {
    const resultado = lista.filter(a => {
      const texto = `${a.nombre} ${a.apellido} ${a.telefono} ${a.email}`.toLowerCase()
      const coincideTexto = !textoBusqueda.trim() || texto.includes(textoBusqueda.toLowerCase())
      const coincideFiltro =
        filtroActual === 'todas' ? true :
        filtroActual === 'deuda' ? a.deuda :
        filtroActual === 'inactiva' ? a.estado === 'inactiva' :
        filtroActual === 'sin-plan' ? !a.plan : true
      return coincideTexto && coincideFiltro
    })
    resultado.sort((a, b) => (a.apellido || '').localeCompare(b.apellido || ''))
    return resultado
  }

  async function buscar() {
    setCargando(true)
    setBuscado(true)

    const snap = await getDocs(query(collection(db, 'usuarios'), where('rol', '==', 'alumna')))
    const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    setAlumnas(aplicarFiltro(todas, busqueda, filtro))
    setCargando(false)
  }

  function abrirEdicion(alumna) {
    setEditando(alumna.id)
    setDiaSlot('lun')
    setHoraSlot('08:00')
    setForm({
      plan: alumna.plan || '',
      clasesRestantes: alumna.clasesRestantes || 0,
      planVencimiento: alumna.planVencimiento
        ? (alumna.planVencimiento.toDate ? alumna.planVencimiento.toDate().toISOString().split('T')[0] : alumna.planVencimiento)
        : '',
      deuda: alumna.deuda || false,
      estado: alumna.estado || 'activa',
      turnosFijos: alumna.turnosFijos || [],
      notas: alumna.notas || ''
    })
  }

  function agregarSlot() {
    const yaExiste = (form.turnosFijos || []).some(t => t.dia === diaSlot && t.hora === horaSlot)
    if (yaExiste) return
    setForm(f => ({ ...f, turnosFijos: [...(f.turnosFijos || []), { dia: diaSlot, hora: horaSlot }] }))
  }

  async function guardar() {
    setGuardando(true)
    const datos = {
      plan: form.plan,
      clasesRestantes: parseInt(form.clasesRestantes) || 0,
      deuda: form.deuda,
      estado: form.estado,
      turnosFijos: form.turnosFijos || [],
      notas: form.notas,
    }
    if (form.planVencimiento) {
      datos.planVencimiento = Timestamp.fromDate(new Date(form.planVencimiento + 'T12:00'))
    }
    await updateDoc(doc(db, 'usuarios', editando), datos)
    invalidateAlumnas()

    // Si se asignó o cambió el plan, crear aviso para la alumna
    const alumnaActual = alumnas.find(a => a.id === editando)
    if (form.plan && form.plan !== alumnaActual?.plan) {
      await addDoc(collection(db, 'avisos'), {
        alumnaId: editando,
        tipo: 'plan_renovado',
        titulo: '🌿 Plan renovado',
        mensaje: `Tu plan en Anima Pilates ha sido renovado con éxito. Plan activo: ${form.plan}. ¡Te esperamos en clase!`,
        leido: false,
        creadoEn: serverTimestamp()
      })
    }

    setAlumnas(prev => aplicarFiltro(
      prev.map(a => a.id === editando ? { ...a, ...datos } : a),
      busqueda, filtro
    ))
    setMsg({ tipo: 'exito', texto: 'Alumna actualizada correctamente.' })
    setEditando(null)
    setGuardando(false)
  }

  async function otorgarRecuperacion(alumna) {
    if (!window.confirm(`¿Otorgar 1 clase de recuperación a ${alumna.nombre} ${alumna.apellido}?`)) return
    const mesActual = new Date().toISOString().substring(0, 7)
    const mismoMes = alumna.recuperacionesMes === mesActual
    const slotsActuales = mismoMes ? (alumna.recuperacionesDisponibles ?? 0) : 0
    await updateDoc(doc(db, 'usuarios', alumna.id), {
      recuperacionesDisponibles: slotsActuales + 1,
      recuperacionesMes: mesActual
    })
    await addDoc(collection(db, 'avisos'), {
      alumnaId: alumna.id,
      tipo: 'recuperacion_otorgada',
      titulo: '🔄 Clase de recuperación',
      mensaje: 'La profesora te otorgó 1 clase de recuperación. Podés usarla para reservar en cualquier horario disponible.',
      leido: false,
      creadoEn: serverTimestamp()
    })
    setAlumnas(prev => prev.map(a => a.id === alumna.id
      ? { ...a, recuperacionesDisponibles: slotsActuales + 1, recuperacionesMes: mesActual }
      : a
    ))
    setMsg({ tipo: 'exito', texto: `Se otorgó 1 recuperación a ${alumna.nombre} ${alumna.apellido}.` })
  }

  async function confirmarEliminar() {
    if (!eliminando) return
    setGuardando(true)
    await updateDoc(doc(db, 'usuarios', eliminando.id), { estado: 'inactiva' })
    invalidateAlumnas()
    setAlumnas(prev => prev.map(a => a.id === eliminando.id ? { ...a, estado: 'inactiva' } : a))
    setMsg({ tipo: 'exito', texto: `${eliminando.nombre} ${eliminando.apellido} fue dada de baja.` })
    setEliminando(null)
    setGuardando(false)
  }

  return (
    <div>
      <h3 style={{ color: '#2d5a3a', marginBottom: 20 }}>Gestión de alumnas</h3>

      {msg && (
        <div className={`alert alert-${msg.tipo}`} style={{ marginBottom: 16 }}>
          {msg.texto}
          <button onClick={() => setMsg(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Buscador */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          style={{ flex: 1, minWidth: 200, padding: '12px 16px', border: '2px solid #c8ddd0', borderRadius: 10, fontSize: '1rem', fontFamily: 'Lato, sans-serif' }}
          placeholder="🔍 Nombre, apellido o teléfono..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()}
        />
        <select
          style={{ padding: '12px 14px', border: '2px solid #c8ddd0', borderRadius: 10, fontSize: '0.92rem', fontFamily: 'Lato, sans-serif', background: 'white' }}
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
        >
          <option value="todas">Todas</option>
          <option value="inactiva">Inactivas</option>
          <option value="sin-plan">Sin plan</option>
        </select>
        <button className="btn btn-primary" onClick={buscar} disabled={cargando}
          style={{ padding: '12px 20px', minHeight: 48, fontSize: '1rem' }}>
          {cargando ? '...' : 'Buscar'}
        </button>
      </div>

      {/* Estado inicial */}
      {!buscado && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</div>
          <p style={{ color: '#5a6b60' }}>Escribí el nombre, apellido o teléfono de una alumna y presioná Buscar.</p>
          <p style={{ color: '#5a6b60', fontSize: '0.88rem', marginTop: 8 }}>También podés usar los filtros para buscar por deuda, inactivas o sin plan.</p>
        </div>
      )}

      {/* Sin resultados */}
      {buscado && !cargando && alumnas.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#5a6b60' }}>No encontramos alumnas con ese criterio.</p>
        </div>
      )}

      {/* Resultados */}
      {alumnas.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: '#f0f7f2', borderBottom: '1px solid #c8ddd0', fontSize: '0.85rem', color: '#5a6b60' }}>
            {alumnas.length} resultado{alumnas.length !== 1 ? 's' : ''}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Alumna</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {alumnas.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{a.nombre} {a.apellido}</div>
                      <div style={{ fontSize: '0.82rem', color: '#5a6b60' }}>{a.telefono}</div>
                      <div style={{ fontSize: '0.78rem', color: '#5a6b60' }}>{a.email}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.88rem' }}>{a.plan || <span style={{ color: '#aaa' }}>Sin plan</span>}</div>
                      {a.clasesRestantes > 0 && (
                        <div style={{ fontSize: '0.78rem', color: '#4a7c59' }}>{a.clasesRestantes} clases restantes</div>
                      )}
                      {(() => {
                        const mesActual = new Date().toISOString().substring(0, 7)
                        const slots = a.recuperacionesMes === mesActual ? (a.recuperacionesDisponibles ?? 0) : 0
                        return slots > 0 ? (
                          <div style={{ fontSize: '0.78rem', color: '#b8860b' }}>🔄 {slots} recuperación{slots !== 1 ? 'es' : ''}</div>
                        ) : null
                      })()}
                      {(a.turnosFijos?.length > 0) ? (
                        a.turnosFijos.map((t, i) => (
                          <div key={i} style={{ fontSize: '0.78rem', color: '#5a6b60' }}>
                            📌 {DIAS_FIJOS.find(d => d.key === t.dia)?.label} {t.hora}
                          </div>
                        ))
                      ) : a.turnoFijo ? (
                        <div style={{ fontSize: '0.78rem', color: '#5a6b60' }}>📌 {a.turnoFijo}</div>
                      ) : null}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className={`badge ${a.estado === 'inactiva' ? 'badge-rojo' : 'badge-verde'}`} style={{ width: 'fit-content' }}>
                          {a.estado === 'inactiva' ? 'Inactiva' : 'Activa'}
                        </span>
                        {a.deuda && <span className="badge badge-rojo" style={{ width: 'fit-content' }}>Con deuda</span>}
                        {!a.plan && <span className="badge badge-amarillo" style={{ width: 'fit-content' }}>Sin plan</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary" style={{ padding: '8px 14px', minHeight: 36, fontSize: '0.88rem' }}
                          onClick={() => abrirEdicion(a)}>
                          Editar
                        </button>
                        <button className="btn btn-ghost" style={{ padding: '8px 14px', minHeight: 36, fontSize: '0.85rem' }}
                          onClick={() => otorgarRecuperacion(a)}>
                          + Recuperación
                        </button>
                        <button className="btn btn-danger" style={{ padding: '8px 14px', minHeight: 36, fontSize: '0.85rem' }}
                          onClick={() => setEliminando(a)}>
                          Dar de baja
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal edición */}
      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h3>Editar alumna</h3>
            <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
              <div className="input-group">
                <label>Plan</label>
                <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                  <option value="">Sin plan</option>
                  {PLANES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Clases restantes</label>
                <input type="number" min="0" value={form.clasesRestantes}
                  onChange={e => setForm(f => ({ ...f, clasesRestantes: e.target.value }))} />
              </div>
              <div className="input-group">
                <label>Vencimiento del plan</label>
                <input type="date" value={form.planVencimiento}
                  onChange={e => setForm(f => ({ ...f, planVencimiento: e.target.value }))} />
              </div>
              <div className="input-group">
                <label>Turnos fijos</label>
                <div style={{ marginBottom: 8 }}>
                  {(form.turnosFijos || []).length === 0 && (
                    <div style={{ color: '#aaa', fontSize: '0.88rem', marginBottom: 8 }}>Sin turnos fijos asignados</div>
                  )}
                  {(form.turnosFijos || []).map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#f0f7f2', borderRadius: 8, border: '1px solid #c8ddd0', marginBottom: 6 }}>
                      <span style={{ flex: 1, fontWeight: 600 }}>{DIAS_FIJOS.find(d => d.key === t.dia)?.label} {t.hora} hs</span>
                      <button type="button"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontWeight: 700, fontSize: '1rem', lineHeight: 1 }}
                        onClick={() => setForm(f => ({ ...f, turnosFijos: f.turnosFijos.filter((_, j) => j !== i) }))}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={diaSlot} onChange={e => setDiaSlot(e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', border: '2px solid #c8ddd0', borderRadius: 8, fontFamily: 'Lato, sans-serif', fontSize: '0.92rem' }}>
                    {DIAS_FIJOS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                  <select value={horaSlot} onChange={e => setHoraSlot(e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', border: '2px solid #c8ddd0', borderRadius: 8, fontFamily: 'Lato, sans-serif', fontSize: '0.92rem' }}>
                    {HORAS_FIJAS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <button type="button" className="btn btn-secondary"
                    style={{ padding: '10px 14px', minHeight: 46, fontSize: '0.88rem', whiteSpace: 'nowrap' }}
                    onClick={agregarSlot}>+ Agregar</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 18, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, color: '#5a6b60' }}>
                  <input type="checkbox" checked={form.deuda} onChange={e => setForm(f => ({ ...f, deuda: e.target.checked }))}
                    style={{ width: 20, height: 20, accentColor: '#c0392b' }} />
                  Tiene deuda
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, color: '#5a6b60' }}>
                  <input type="checkbox" checked={form.estado === 'inactiva'} onChange={e => setForm(f => ({ ...f, estado: e.target.checked ? 'inactiva' : 'activa' }))}
                    style={{ width: 20, height: 20, accentColor: '#c0392b' }} />
                  Cuenta inactiva
                </label>
              </div>
              <div className="input-group">
                <label>Notas internas</label>
                <textarea value={form.notas} rows={3} placeholder="Observaciones sobre la alumna..."
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={guardar} disabled={guardando} style={{ flex: 1 }}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button className="btn btn-ghost" onClick={() => setEditando(null)} style={{ flex: 1 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {eliminando && (
        <div className="modal-overlay" onClick={() => setEliminando(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#c0392b' }}>Dar de baja</h3>
            <p style={{ color: '#5a6b60', margin: '16px 0' }}>
              ¿Dar de baja a <strong>{eliminando.nombre} {eliminando.apellido}</strong>?
            </p>
            <div className="alert alert-error" style={{ fontSize: '0.9rem' }}>
              La cuenta queda inactiva. Si vuelve, podés reactivarla desde Editar → Estado.
            </div>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={confirmarEliminar} disabled={guardando} style={{ flex: 1 }}>
                {guardando ? 'Procesando...' : 'Sí, dar de baja'}
              </button>
              <button className="btn btn-ghost" onClick={() => setEliminando(null)} style={{ flex: 1 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

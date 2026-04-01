import { useState } from 'react'
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { db } from '../firebase'

export default function GestionPagos() {
  const [alumnas, setAlumnas] = useState([])
  const [cargando, setCargando] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('deuda')
  const [modal, setModal] = useState(null)
  const [monto, setMonto] = useState('')
  const [detalle, setDetalle] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  async function buscar() {
    setCargando(true)
    setBuscado(true)
    const snap = await getDocs(query(collection(db, 'usuarios'), where('rol', '==', 'alumna')))
    const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    const resultado = todas.filter(a => {
      const texto = `${a.nombre} ${a.apellido} ${a.telefono}`.toLowerCase()
      const coincideTexto = !busqueda.trim() || texto.includes(busqueda.toLowerCase())
      const coincideFiltro =
        filtro === 'deuda' ? a.deuda :
        filtro === 'al-dia' ? !a.deuda :
        true
      return coincideTexto && coincideFiltro
    })

    resultado.sort((a, b) => {
      if (a.deuda && !b.deuda) return -1
      if (!a.deuda && b.deuda) return 1
      return (a.apellido || '').localeCompare(b.apellido || '')
    })

    setAlumnas(resultado)
    setCargando(false)
  }

  async function registrarPago() {
    if (!monto) return
    setGuardando(true)
    const a = modal
    await addDoc(collection(db, 'pagos'), {
      alumnaId: a.id,
      alumnaNombre: `${a.nombre} ${a.apellido}`,
      monto: parseFloat(monto),
      detalle: detalle || 'Cuota mensual',
      fecha: new Date().toISOString().split('T')[0],
      creadoEn: serverTimestamp()
    })
    await updateDoc(doc(db, 'usuarios', a.id), { deuda: false })
    await addDoc(collection(db, 'notificaciones'), {
      tipo: 'pago_registrado',
      titulo: 'Pago registrado',
      mensaje: `Pago de ${a.nombre} ${a.apellido} por $${monto} registrado.`,
      leida: false,
      creadoEn: serverTimestamp()
    })
    setMsg({ tipo: 'exito', texto: `Pago de ${a.nombre} registrado.` })
    setModal(null)
    setMonto('')
    setDetalle('')
    await buscar()
    setGuardando(false)
  }

  async function toggleDeuda(a) {
    await updateDoc(doc(db, 'usuarios', a.id), { deuda: !a.deuda })
    await buscar()
  }

  const conDeuda = alumnas.filter(a => a.deuda).length
  const sinDeuda = alumnas.filter(a => !a.deuda).length

  return (
    <div>
      <h3 style={{ color: '#2d5a3a', marginBottom: 20 }}>Gestión de pagos</h3>

      {msg && (
        <div className={`alert alert-${msg.tipo}`} style={{ marginBottom: 16 }}>
          {msg.texto}
          <button onClick={() => setMsg(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Buscador */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          style={{ flex: 1, minWidth: 180, padding: '12px 16px', border: '2px solid #c8ddd0', borderRadius: 10, fontSize: '1rem', fontFamily: 'Lato, sans-serif' }}
          placeholder="🔍 Nombre o teléfono..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()}
        />
        <select
          style={{ padding: '12px 14px', border: '2px solid #c8ddd0', borderRadius: 10, fontSize: '0.92rem', fontFamily: 'Lato, sans-serif', background: 'white' }}
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
        >
          <option value="deuda">Con deuda</option>
          <option value="al-dia">Al día</option>
          <option value="todas">Todas</option>
        </select>
        <button className="btn btn-primary" onClick={buscar} disabled={cargando}
          style={{ padding: '12px 20px', minHeight: 48, fontSize: '1rem' }}>
          {cargando ? '...' : 'Buscar'}
        </button>
      </div>

      {/* Estado inicial */}
      {!buscado && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>💰</div>
          <p style={{ color: '#5a6b60' }}>Usá el filtro "Con deuda" y presioná Buscar para ver quién debe.</p>
          <p style={{ color: '#5a6b60', fontSize: '0.88rem', marginTop: 8 }}>También podés buscar por nombre o teléfono.</p>
        </div>
      )}

      {/* Sin resultados */}
      {buscado && !cargando && alumnas.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🎉</div>
          <p style={{ color: '#5a6b60' }}>
            {filtro === 'deuda' ? '¡No hay alumnas con deuda!' : 'No hay resultados con ese criterio.'}
          </p>
        </div>
      )}

      {/* Estadísticas rápidas si hay resultados */}
      {alumnas.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#fde8e8', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontFamily: 'Cormorant Garamond, serif', color: '#c0392b', fontWeight: 600 }}>{conDeuda}</div>
              <div style={{ fontSize: '0.75rem', color: '#c0392b' }}>Con deuda</div>
            </div>
            <div style={{ background: '#d4edda', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontFamily: 'Cormorant Garamond, serif', color: '#1a6630', fontWeight: 600 }}>{sinDeuda}</div>
              <div style={{ fontSize: '0.75rem', color: '#1a6630' }}>Al día</div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                    </td>
                    <td style={{ fontSize: '0.88rem' }}>{a.plan || <span style={{ color: '#aaa' }}>Sin plan</span>}</td>
                    <td>
                      <span className={`badge ${a.deuda ? 'badge-rojo' : 'badge-verde'}`}>
                        {a.deuda ? '⚠️ Adeuda' : '✓ Al día'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {a.deuda && (
                          <button className="btn btn-primary" style={{ padding: '7px 14px', minHeight: 36, fontSize: '0.85rem' }}
                            onClick={() => setModal(a)}>
                            💰 Registrar pago
                          </button>
                        )}
                        <button className={`btn ${a.deuda ? 'btn-ghost' : 'btn-danger'}`}
                          style={{ padding: '7px 14px', minHeight: 36, fontSize: '0.82rem' }}
                          onClick={() => toggleDeuda(a)}>
                          {a.deuda ? 'Quitar deuda' : 'Marcar deuda'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal pago */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Registrar pago</h3>
            <p style={{ color: '#5a6b60', marginBottom: 20 }}>
              Alumna: <strong>{modal.nombre} {modal.apellido}</strong>
            </p>
            <div className="input-group">
              <label>Monto ($)</label>
              <input type="number" min="0" value={monto} onChange={e => setMonto(e.target.value)}
                placeholder="Ej: 15000" autoFocus />
            </div>
            <div className="input-group">
              <label>Detalle (opcional)</label>
              <input type="text" value={detalle} onChange={e => setDetalle(e.target.value)}
                placeholder="Cuota marzo, Pack 8 clases..." />
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={registrarPago} disabled={guardando || !monto} style={{ flex: 1 }}>
                {guardando ? 'Guardando...' : 'Confirmar pago'}
              </button>
              <button className="btn btn-ghost" onClick={() => setModal(null)} style={{ flex: 1 }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

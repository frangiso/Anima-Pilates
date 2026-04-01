import { useState, useEffect } from 'react'
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore'
import { db } from '../firebase'

export default function GestionPagos() {
  const [alumnas, setAlumnas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null)
  const [monto, setMonto] = useState('')
  const [detalle, setDetalle] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [filtro, setFiltro] = useState('todas')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const snap = await getDocs(query(collection(db, 'usuarios'), where('rol', '==', 'alumna')))
    const lista = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.rol === 'alumna')
    lista.sort((a, b) => {
      if (a.deuda && !b.deuda) return -1
      if (!a.deuda && b.deuda) return 1
      return (a.apellido || '').localeCompare(b.apellido || '')
    })
    setAlumnas(lista)
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
    setMsg({ tipo: 'exito', texto: `Pago de ${a.nombre} registrado correctamente.` })
    setModal(null)
    setMonto('')
    setDetalle('')
    await cargar()
    setGuardando(false)
  }

  async function toggleDeuda(a) {
    await updateDoc(doc(db, 'usuarios', a.id), { deuda: !a.deuda })
    await cargar()
  }

  if (cargando) return <div className="spinner" />

  const conDeuda = alumnas.filter(a => a.deuda)
  const sinDeuda = alumnas.filter(a => !a.deuda)
  const mostrar = filtro === 'deuda' ? conDeuda : filtro === 'al-dia' ? sinDeuda : alumnas

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ color: '#2d5a3a' }}>Gestión de pagos</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ background: '#fde8e8', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontFamily: 'Cormorant Garamond, serif', color: '#c0392b', fontWeight: 600 }}>{conDeuda.length}</div>
            <div style={{ fontSize: '0.75rem', color: '#c0392b' }}>Con deuda</div>
          </div>
          <div style={{ background: '#d4edda', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontFamily: 'Cormorant Garamond, serif', color: '#1a6630', fontWeight: 600 }}>{sinDeuda.length}</div>
            <div style={{ fontSize: '0.75rem', color: '#1a6630' }}>Al día</div>
          </div>
        </div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.tipo}`} style={{ marginBottom: 16 }}>
          {msg.texto}
          <button onClick={() => setMsg(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['todas', 'deuda', 'al-dia'].map(f => (
          <button key={f} className={`btn ${filtro === f ? 'btn-primary' : 'btn-ghost'}`}
            style={{ padding: '8px 16px', minHeight: 38, fontSize: '0.88rem' }}
            onClick={() => setFiltro(f)}>
            {f === 'todas' ? 'Todas' : f === 'deuda' ? '⚠️ Con deuda' : '✓ Al día'}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tabla">
          <thead>
            <tr>
              <th>Alumna</th>
              <th>Plan</th>
              <th>Estado de pago</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {mostrar.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: '#5a6b60' }}>
                {filtro === 'deuda' ? '🎉 No hay alumnas con deuda.' : 'No hay alumnas.'}
              </td></tr>
            )}
            {mostrar.map(a => (
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
                  <div style={{ display: 'flex', gap: 6 }}>
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

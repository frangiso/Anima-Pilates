import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../firebase'

export default function HistorialAsistencias() {
  const [reservas, setReservas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtroAlumna, setFiltroAlumna] = useState('')
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('')
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('')
  const [filtroHora, setFiltroHora] = useState('')
  const [vistaAgrupada, setVistaAgrupada] = useState('fecha')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const snap = await getDocs(query(
      collection(db, 'reservas'),
      where('estado', 'in', ['confirmada', 'cancelada'])
    ))
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    lista.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.hora.localeCompare(b.hora))
    setReservas(lista)
    setCargando(false)
  }

  const hoy = new Date().toISOString().split('T')[0]

  const filtradas = reservas.filter(r => {
    if (r.fecha > hoy) return false // solo pasadas
    if (filtroAlumna && !r.alumnaNombre?.toLowerCase().includes(filtroAlumna.toLowerCase())) return false
    if (filtroFechaDesde && r.fecha < filtroFechaDesde) return false
    if (filtroFechaHasta && r.fecha > filtroFechaHasta) return false
    if (filtroHora && r.hora !== filtroHora) return false
    return true
  })

  const asistieron = filtradas.filter(r => r.asistio === true)
  const faltaron = filtradas.filter(r => r.asistio === false)
  const sinMarcar = filtradas.filter(r => r.asistio === undefined && r.estado === 'confirmada')

  // Agrupar por fecha
  const porFecha = {}
  filtradas.forEach(r => {
    if (!porFecha[r.fecha]) porFecha[r.fecha] = []
    porFecha[r.fecha].push(r)
  })

  // Agrupar por alumna
  const porAlumna = {}
  filtradas.forEach(r => {
    const k = r.alumnaNombre || 'Sin nombre'
    if (!porAlumna[k]) porAlumna[k] = []
    porAlumna[k].push(r)
  })

  const HORAS = Array.from({ length: 13 }, (_, i) => `${(8+i).toString().padStart(2,'0')}:00`)

  if (cargando) return <div className="spinner" />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ color: '#2d5a3a' }}>Historial de asistencias</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ background: '#d4edda', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontFamily: 'Cormorant Garamond, serif', color: '#1a6630', fontWeight: 600 }}>{asistieron.length}</div>
            <div style={{ fontSize: '0.72rem', color: '#1a6630' }}>Asistieron</div>
          </div>
          <div style={{ background: '#fde8e8', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontFamily: 'Cormorant Garamond, serif', color: '#c0392b', fontWeight: 600 }}>{faltaron.length}</div>
            <div style={{ fontSize: '0.72rem', color: '#c0392b' }}>Faltaron</div>
          </div>
          {sinMarcar.length > 0 && (
            <div style={{ background: '#fef3cd', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontFamily: 'Cormorant Garamond, serif', color: '#856404', fontWeight: 600 }}>{sinMarcar.length}</div>
              <div style={{ fontSize: '0.72rem', color: '#856404' }}>Sin marcar</div>
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#5a6b60', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Alumna</label>
            <input
              style={{ width: '100%', padding: '8px 12px', border: '2px solid #c8ddd0', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'Lato, sans-serif' }}
              placeholder="Buscar..."
              value={filtroAlumna}
              onChange={e => setFiltroAlumna(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#5a6b60', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Desde</label>
            <input type="date" value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '2px solid #c8ddd0', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'Lato, sans-serif' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#5a6b60', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Hasta</label>
            <input type="date" value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '2px solid #c8ddd0', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'Lato, sans-serif' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#5a6b60', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Horario</label>
            <select value={filtroHora} onChange={e => setFiltroHora(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '2px solid #c8ddd0', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'Lato, sans-serif', background: 'white' }}>
              <option value="">Todos</option>
              {HORAS.map(h => <option key={h} value={h}>{h} hs</option>)}
            </select>
          </div>
        </div>
        {(filtroAlumna || filtroFechaDesde || filtroFechaHasta || filtroHora) && (
          <button className="btn btn-ghost" style={{ marginTop: 10, padding: '6px 14px', minHeight: 34, fontSize: '0.85rem' }}
            onClick={() => { setFiltroAlumna(''); setFiltroFechaDesde(''); setFiltroFechaHasta(''); setFiltroHora('') }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Vista agrupada */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${vistaAgrupada === 'fecha' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '8px 16px', minHeight: 38, fontSize: '0.88rem' }}
          onClick={() => setVistaAgrupada('fecha')}>
          Por fecha
        </button>
        <button className={`btn ${vistaAgrupada === 'alumna' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '8px 16px', minHeight: 38, fontSize: '0.88rem' }}
          onClick={() => setVistaAgrupada('alumna')}>
          Por alumna
        </button>
      </div>

      {filtradas.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
          <p style={{ color: '#5a6b60' }}>No hay registros con ese criterio.</p>
        </div>
      )}

      {/* Vista por fecha */}
      {vistaAgrupada === 'fecha' && Object.keys(porFecha).sort((a,b) => b.localeCompare(a)).map(fecha => (
        <div key={fecha} className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
          <div style={{ background: '#f0f7f2', padding: '10px 18px', borderBottom: '1px solid #c8ddd0' }}>
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.15rem', color: '#2d5a3a', fontWeight: 600, textTransform: 'capitalize' }}>
              {new Date(fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span style={{ marginLeft: 12, fontSize: '0.82rem', color: '#5a6b60' }}>
              {porFecha[fecha].filter(r => r.asistio).length}/{porFecha[fecha].length} asistencias
            </span>
          </div>
          <div style={{ padding: '8px 0' }}>
            {porFecha[fecha].sort((a,b) => a.hora.localeCompare(b.hora)).map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 18px', borderBottom: '1px solid #f0f7f2' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{r.alumnaNombre}</span>
                  <span style={{ color: '#5a6b60', fontSize: '0.85rem', marginLeft: 10 }}>🕐 {r.hora} hs</span>
                  {r.tipo === 'fija' && <span className="badge badge-gris" style={{ marginLeft: 8, fontSize: '0.72rem' }}>Fija</span>}
                </div>
                <span className={`badge ${r.estado === 'cancelada' ? 'badge-gris' : r.asistio === true ? 'badge-verde' : r.asistio === false ? 'badge-rojo' : 'badge-amarillo'}`}>
                  {r.estado === 'cancelada' ? 'Canceló' : r.asistio === true ? '✓ Asistió' : r.asistio === false ? '✗ Faltó' : '⏳ Sin marcar'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Vista por alumna */}
      {vistaAgrupada === 'alumna' && Object.keys(porAlumna).sort().map(nombre => {
        const clases = porAlumna[nombre]
        const asist = clases.filter(r => r.asistio === true).length
        const total = clases.filter(r => r.estado !== 'cancelada').length
        return (
          <div key={nombre} className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
            <div style={{ background: '#f0f7f2', padding: '10px 18px', borderBottom: '1px solid #c8ddd0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: '#2d5a3a' }}>{nombre}</span>
              <span style={{ fontSize: '0.85rem', color: '#5a6b60' }}>
                {asist}/{total} clases asistidas
                {total > 0 && <span style={{ marginLeft: 8, color: '#4a7c59', fontWeight: 700 }}>{Math.round(asist/total*100)}%</span>}
              </span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {clases.sort((a,b) => b.fecha.localeCompare(a.fecha)).slice(0, 10).map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 18px', borderBottom: '1px solid #f0f7f2' }}>
                  <span style={{ fontSize: '0.9rem', color: '#5a6b60', textTransform: 'capitalize' }}>
                    {new Date(r.fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })} · {r.hora} hs
                  </span>
                  <span className={`badge ${r.estado === 'cancelada' ? 'badge-gris' : r.asistio === true ? 'badge-verde' : r.asistio === false ? 'badge-rojo' : 'badge-amarillo'}`}>
                    {r.estado === 'cancelada' ? 'Canceló' : r.asistio === true ? '✓ Asistió' : r.asistio === false ? '✗ Faltó' : '⏳ Sin marcar'}
                  </span>
                </div>
              ))}
              {clases.length > 10 && (
                <div style={{ padding: '8px 18px', fontSize: '0.82rem', color: '#5a6b60' }}>
                  + {clases.length - 10} registros más. Usá los filtros para ver más.
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

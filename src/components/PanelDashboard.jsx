import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, doc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'

const HORAS = Array.from({ length: 13 }, (_, i) => `${(8+i).toString().padStart(2,'0')}:00`)

export default function PanelDashboard() {
  const [reservasHoy, setReservasHoy] = useState([])
  const [cargando, setCargando] = useState(true)
  const [horaSelec, setHoraSelec] = useState(null)

  const hoy = new Date().toISOString().split('T')[0]
  const hoySemana = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const snap = await getDocs(query(
      collection(db, 'reservas'),
      where('fecha', '==', hoy),
      where('estado', 'in', ['confirmada', 'pendiente'])
    ))
    setReservasHoy(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setCargando(false)
  }

  async function descontarClase(alumnaId, devolver = false) {
    // Trae el perfil actualizado de Firestore antes de operar
    const snap = await getDoc(doc(db, 'usuarios', alumnaId))
    if (!snap.exists()) return
    const alumna = snap.data()
    const clases = alumna.clasesRestantes ?? null
    const usadas = alumna.clasesUsadas ?? 0
    if (clases === null || clases === undefined) return // sin plan por clases, no toca nada

    if (!devolver) {
      // Descontar: asistió O faltó → igual se consume la clase
      const nuevas = Math.max(0, clases - 1)
      await updateDoc(doc(db, 'usuarios', alumnaId), {
        clasesRestantes: nuevas,
        clasesUsadas: usadas + 1
      })
      if (nuevas === 0) {
        await updateDoc(doc(db, 'usuarios', alumnaId), { deuda: true })
      }
    } else {
      // Devolver: se revierte el descuento (al usar "Corregir" desde sin-marcar)
      await updateDoc(doc(db, 'usuarios', alumnaId), {
        clasesRestantes: clases + 1,
        clasesUsadas: Math.max(0, usadas - 1)
      })
    }
  }

  async function marcarAsistencia(id, alumnaId, asistio, yaMarcada) {
    // Actualizar la reserva
    await updateDoc(doc(db, 'reservas', id), { asistio, estado: 'confirmada' })

    if (alumnaId) {
      if (yaMarcada === undefined || yaMarcada === null) {
        // Primera vez que se marca (asistió o faltó) → descontar clase
        await descontarClase(alumnaId, false)
      } else if (yaMarcada !== undefined) {
        // Ya estaba marcada y se corrige → NO descontar ni devolver
        // La clase ya fue descontada la primera vez, el cambio asistió↔faltó no afecta el conteo
      }
    }

    setReservasHoy(prev => prev.map(r => r.id === id ? { ...r, asistio, estado: 'confirmada' } : r))
  }

  async function quitarDeTurno(reservaId, alumnaNombre) {
    if (!window.confirm(`¿Querés quitar a ${alumnaNombre} de este turno?`)) return
    await deleteDoc(doc(db, 'reservas', reservaId))
    setReservasHoy(prev => prev.filter(r => r.id !== reservaId))
  }

  if (cargando) return <div className="spinner" />

  const porHora = {}
  HORAS.forEach(h => { porHora[h] = reservasHoy.filter(r => r.hora === h) })

  const totalHoy = reservasHoy.filter(r => r.estado === 'confirmada').length
  const pendientes = reservasHoy.filter(r => r.estado === 'pendiente').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ color: '#2d5a3a', marginBottom: 4 }}>Dashboard del día</h2>
          <p style={{ color: '#5a6b60', textTransform: 'capitalize' }}>{hoySemana}</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ background: '#d4edda', borderRadius: 10, padding: '10px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontFamily: 'Cormorant Garamond, serif', color: '#1a6630', fontWeight: 600 }}>{totalHoy}</div>
            <div style={{ fontSize: '0.78rem', color: '#1a6630' }}>Clases hoy</div>
          </div>
          {pendientes > 0 && (
            <div style={{ background: '#fef3cd', borderRadius: 10, padding: '10px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontFamily: 'Cormorant Garamond, serif', color: '#856404', fontWeight: 600 }}>{pendientes}</div>
              <div style={{ fontSize: '0.78rem', color: '#856404' }}>Pendientes</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {HORAS.map(hora => {
          const alumnas = porHora[hora]
          const ocupados = alumnas.length
          const vacio = ocupados === 0
          return (
            <div key={hora} className="card" style={{
              padding: '14px 18px',
              opacity: vacio ? 0.5 : 1,
              cursor: ocupados > 0 ? 'pointer' : 'default',
              border: horaSelec === hora ? '2px solid #4a7c59' : '1px solid #c8ddd0',
              transition: 'all 0.15s'
            }} onClick={() => setHoraSelec(horaSelec === hora ? null : hora)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', color: '#4a7c59', fontWeight: 600 }}>{hora}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <div key={i} style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: i < ocupados ? '#4a7c59' : '#c8ddd0'
                      }} />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.88rem', color: '#5a6b60' }}>{ocupados}/5</span>
                  {ocupados > 0 && (
                    <span style={{ color: '#4a7c59', fontSize: '0.85rem' }}>{horaSelec === hora ? '▲' : '▼'}</span>
                  )}
                </div>
              </div>

              {horaSelec === hora && ocupados > 0 && (
                <div style={{ marginTop: 14, borderTop: '1px solid #e0f0e6', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {alumnas.map(a => (
                    <div key={a.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                      padding: '10px 12px',
                      background: '#f8fdf9',
                      borderRadius: 8
                    }}>
                      <div>
                        <span style={{ fontWeight: 700 }}>{a.alumnaNombre}</span>
                        {a.tipo === 'fija' && <span className="badge badge-gris" style={{ marginLeft: 8, fontSize: '0.75rem' }}>Fija</span>}
                        {a.estado === 'pendiente' && <span className="badge badge-amarillo" style={{ marginLeft: 8, fontSize: '0.75rem' }}>Pendiente</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {(a.asistio === undefined || a.asistio === null) ? (
                          <>
                            <button className="btn btn-secondary"
                              style={{ padding: '6px 14px', minHeight: 34, fontSize: '0.85rem' }}
                              onClick={e => { e.stopPropagation(); marcarAsistencia(a.id, a.alumnaId, true, undefined) }}>
                              ✓ Asistió
                            </button>
                            <button className="btn btn-ghost"
                              style={{ padding: '6px 14px', minHeight: 34, fontSize: '0.85rem' }}
                              onClick={e => { e.stopPropagation(); marcarAsistencia(a.id, a.alumnaId, false, undefined) }}>
                              ✗ Faltó
                            </button>
                            <button className="btn btn-danger"
                              style={{ padding: '6px 10px', minHeight: 34, fontSize: '0.82rem' }}
                              onClick={e => { e.stopPropagation(); quitarDeTurno(a.id, a.alumnaNombre) }}>
                              Quitar
                            </button>
                          </>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className={`badge ${a.asistio ? 'badge-verde' : 'badge-rojo'}`}>
                              {a.asistio ? '✓ Asistió' : '✗ Faltó'}
                            </span>
                            <button className="btn btn-ghost"
                              style={{ padding: '4px 10px', minHeight: 28, fontSize: '0.78rem' }}
                              onClick={e => { e.stopPropagation(); marcarAsistencia(a.id, a.alumnaId, !a.asistio, a.asistio) }}>
                              Corregir
                            </button>
                            <button className="btn btn-danger"
                              style={{ padding: '4px 10px', minHeight: 28, fontSize: '0.78rem' }}
                              onClick={e => { e.stopPropagation(); quitarDeTurno(a.id, a.alumnaNombre) }}>
                              Quitar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

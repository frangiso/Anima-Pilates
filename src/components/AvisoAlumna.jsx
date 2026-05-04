import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

export default function AvisoAlumna() {
  const { user } = useAuth()
  const [avisos, setAvisos] = useState([])

  useEffect(() => {
    if (user) cargarAvisos()
  }, [user])

  async function cargarAvisos() {
    try {
      // Sin orderBy para evitar necesidad de índice compuesto
      const snap = await getDocs(query(
        collection(db, 'avisos'),
        where('alumnaId', '==', user.uid),
        where('leido', '==', false)
      ))
      if (!snap.empty) {
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        // Ordenar en el cliente
        lista.sort((a, b) => {
          const ta = a.creadoEn?.seconds || 0
          const tb = b.creadoEn?.seconds || 0
          return tb - ta
        })
        setAvisos(lista)
      }
    } catch (e) {
      console.error('Error cargando avisos:', e)
    }
  }

  async function cerrar(id) {
    await updateDoc(doc(db, 'avisos', id), { leido: true })
    setAvisos(prev => prev.filter(a => a.id !== id))
  }

  if (avisos.length === 0) return null

  const colores = {
    turno_aprobado: { bg: '#d4edda', border: '#27ae60', texto: '#1a6630' },
    turno_rechazado: { bg: '#fde8e8', border: '#c0392b', texto: '#a93226' },
    plan_renovado: { bg: '#f0f7f2', border: '#4a7c59', texto: '#2d5a3a' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
      {avisos.map(aviso => {
        const color = colores[aviso.tipo] || colores.plan_renovado
        return (
          <div key={aviso.id} style={{
            background: color.bg,
            border: `1.5px solid ${color.border}`,
            borderRadius: 12,
            padding: '16px 18px',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: color.texto, fontSize: '0.95rem', marginBottom: 6 }}>
                {aviso.titulo}
              </div>
              <div style={{ color: color.texto, fontSize: '0.9rem', lineHeight: 1.6 }}>
                {aviso.mensaje}
              </div>
            </div>
            <button onClick={() => cerrar(aviso.id)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: color.texto, fontSize: '1.3rem', lineHeight: 1,
              padding: '0 4px', opacity: 0.7, flexShrink: 0
            }}>×</button>
          </div>
        )
      })}
    </div>
  )
}

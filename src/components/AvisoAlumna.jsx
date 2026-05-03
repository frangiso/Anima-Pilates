import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, doc, updateDoc, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'

export default function AvisoAlumna() {
  const { user } = useAuth()
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    if (user) cargarAviso()
  }, [user])

  async function cargarAviso() {
    try {
      const snap = await getDocs(query(
        collection(db, 'avisos'),
        where('alumnaId', '==', user.uid),
        where('leido', '==', false),
        orderBy('creadoEn', 'desc'),
        limit(1)
      ))
      if (!snap.empty) {
        setAviso({ id: snap.docs[0].id, ...snap.docs[0].data() })
      }
    } catch { }
  }

  async function cerrar() {
    if (!aviso) return
    await updateDoc(doc(db, 'avisos', aviso.id), { leido: true })
    setAviso(null)
  }

  if (!aviso) return null

  const colores = {
    turno_aprobado: { bg: '#d4edda', border: '#27ae60', texto: '#1a6630' },
    turno_rechazado: { bg: '#fde8e8', border: '#c0392b', texto: '#a93226' },
    plan_renovado: { bg: '#f0f7f2', border: '#4a7c59', texto: '#2d5a3a' },
  }

  const color = colores[aviso.tipo] || colores.plan_renovado

  return (
    <div style={{
      background: color.bg,
      border: `1.5px solid ${color.border}`,
      borderRadius: 12,
      padding: '16px 18px',
      marginBottom: 20,
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
      <button onClick={cerrar} style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: color.texto, fontSize: '1.2rem', lineHeight: 1,
        padding: '0 4px', opacity: 0.7
      }}>×</button>
    </div>
  )
}

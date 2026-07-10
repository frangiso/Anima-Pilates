import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from './firebase'

let _cache = null
let _loadedAt = 0
const TTL_MS = 10 * 60 * 1000 // 10 minutos

/**
 * Devuelve la lista de alumnas. Usa caché si tiene menos de 10 min.
 * Pasar forceRefresh=true para siempre ir a Firestore (ej: búsqueda explícita).
 */
export async function getAlumnas(forceRefresh = false) {
  const ahora = Date.now()
  if (!forceRefresh && _cache && (ahora - _loadedAt) < TTL_MS) return _cache
  const snap = await getDocs(query(collection(db, 'usuarios'), where('rol', '==', 'alumna')))
  _cache = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  _loadedAt = ahora
  return _cache
}

/** Invalida el caché tras agregar, editar o eliminar una alumna. */
export function invalidateAlumnas() {
  _cache = null
  _loadedAt = 0
}

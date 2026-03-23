import { useAuth } from '../context/AuthContext'

function diasHasta(fecha) {
  if (!fecha) return null
  const hoy = new Date()
  const venc = fecha.toDate ? fecha.toDate() : new Date(fecha)
  const diff = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24))
  return diff
}

export default function MiPlan() {
  const { perfil } = useAuth()

  if (!perfil?.plan) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <p>Sin plan activo</p>
      </div>
    )
  }

  return (
    <div>
      <p>{perfil.plan}</p>
    </div>
  )
}

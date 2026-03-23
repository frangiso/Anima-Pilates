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
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🌿</div>
        <h3 style={{ color: '#4a7c59', marginBottom: 12 }}>Sin plan activo</h3>
        <p style={{ color: '#5a6b60', lineHeight: 1.7 }}>
          Todavía no tenés un plan asignado.<br />
          La profesora te lo configurará en breve.<br />
          <strong>Si te registraste hace poco, esperá que te contacte.</strong>
        </p>
      </div>
    )
  }

  const dias = diasHasta(perfil.planVencimiento)
  const vencido = dias !== null && dias < 0
  const porVencer = dias !== null && dias >= 0 && dias <= 3

  return (
    <div>
      <div className="plan-card">
        <h3 style={{ marginBottom: 4 }}>{perfil.plan}</h3>
        <p style={{ opacity: 0.85, fontSize: '0.92rem' }}>Plan activo</p>

        <div className="plan-stats">
          {perfil.clasesRestantes !== undefined && perfil.clasesRestantes !== null && (
            <div className="plan-stat">
              <div className="numero">{perfil.clasesRestantes}</div>
              <div className="label">Clases restantes</div>
            </div>
          )}
          {perfil.clasesUsadas !== undefined && (
            <div className="plan-stat">
              <div className="numero">{perfil.clasesUsadas || 0}</div>
              <div className="label">Clases tomadas</div>
            </div>
          )}
          {dias !== null && (
            <div className="plan-stat">
              <div className="numero">{vencido ? '✕' : dias}</div>
              <div className="label">{vencido ? 'Vencido' : 'Días restantes'}</div>
            </div>
          )}
        </div>
      </div>

      {vencido && (
        <div className="alert alert-error">
          ⚠️ Tu plan venció. Contactá a la profesora para renovarlo y seguir reservando clases.
        </div>
      )}
      {porVencer && !vencido && (
        <div className="alert alert-alerta">
          ⏰ Tu plan vence en {dias} día{dias !== 1 ? 's' : ''}. ¡Recordá renovarlo!
        </div>
      )}
      {perfil.deuda && (
        <div className="alert alert-error">
          💳 Tenés una cuota pendiente. Contactá a la profesora para regularizar y seguir reservando.
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ color: '#4a7c59', marginBottom: 16, fontSize: '1.2rem' }}>Detalle del plan</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <InfoRow label="Tipo de plan" value={perfil.plan} />
          {perfil.planVencimiento && (
            <InfoRow
              label="Vencimiento"
              value={
                perfil.planVencimiento.toDate
                  ? perfil.planVencimiento.toDate().toLocaleDateString('es-AR')
                  : new Date(perfil.planVencimiento).toLocaleDateString('es-AR')
              }
            />
          )}
          {perfil.turnoFijo && (
            <InfoRow label="Turno fijo" value={perfil.turnoFijo} />
          )}
          <InfoRow
            label="Estado"
            value={
              <span className={`badge ${perfil.deuda || perfil.estado === 'inactiva' ? 'badge-rojo' : 'badge-verde'}`}>
                {perfil.deuda ? 'Con deuda' : perfil.estado === 'inactiva' ? 'Inactiva' : 'Al día ✓'}
              </span>
            }
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, background: '#f0f7f2' }}>
        <p style={{ color: '#5a6b60', fontSize: '0.92rem', textAlign: 'center' }}>
          ¿Consultas sobre tu plan? Hablá con la profesora por WhatsApp 📱
        </p>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #e0f0e6' }}>
      <span style={{ color: '#5a6b60', fontSize: '0.95rem' }}>{label}</span>
      <span style={{ fontWeight: 700, color: '#1e2a22' }}>{value}</span>
    </div>
  )
}

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No autorizado' })

  try {
    const auth = getAuth()
    const db = getFirestore()

    const decoded = await auth.verifyIdToken(token)

    const callerSnap = await db.collection('usuarios').doc(decoded.uid).get()
    if (!callerSnap.exists || callerSnap.data().rol !== 'profe') {
      return res.status(403).json({ error: 'Solo la profesora puede hacer esto' })
    }

    const { uid, newPassword } = req.body
    if (!uid || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
    }

    await auth.updateUser(uid, { password: newPassword })
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('set-password error:', err)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}

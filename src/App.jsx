import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import AlumnaPanel from './pages/AlumnaPanel'
import ProfePanel from './pages/ProfePanel'
import Migracion from './pages/Migracion'

function RutaProtegida({ children, rol }) {
  const { user, perfil, loading } = useAuth()
  if (loading) return <div className="spinner" style={{ minHeight: '100vh' }} />
  if (!user || !perfil) return <Navigate to="/login" replace />
  if (rol && perfil.rol !== rol) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/alumna" element={
            <RutaProtegida rol="alumna"><AlumnaPanel /></RutaProtegida>
          } />
          <Route path="/profe" element={
            <RutaProtegida rol="profe"><ProfePanel /></RutaProtegida>
          } />
          <Route path="/migracion" element={
            <RutaProtegida rol="profe"><Migracion /></RutaProtegida>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import RutaCero from './pages/RutaCero';
import RutaCeroClasses from './pages/RutaCeroClasses';
import RutaCeroLearning from './pages/RutaCeroLearning';
import logo from './assets/ruta-cero-logo.png';
import './ruta-cero-brand.css';

function Portal() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) return <p className="p-8 text-sys-text-sec">Preparando tu espacio…</p>;

  return (
    <div className="min-h-screen bg-sys-bg text-sys-text-main">
      {user && (
        <header className="flex items-center justify-between border-b border-sys-border px-6 py-4">
          <Link to="/" aria-label="Inicio de Ruta Cero"><img src={logo} alt="Ruta Cero" className="w-36" /></Link>
          <nav className="flex flex-wrap gap-3 text-sm" aria-label="Portal">
            <Link to="/" className="hover:text-sys-accent">Mi ruta</Link>
            <Link to="/clases" className="hover:text-sys-accent">Clases</Link>
            <Link to="/asistentes" className="hover:text-sys-accent">Asistentes y Workbook</Link>
          </nav>
          <button className="text-sm hover:text-amber-400" onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}>Cerrar sesión</button>
        </header>
      )}
      <main>
        <Routes>
          <Route path="/" element={user ? <RutaCeroLearning /> : <Navigate to="/login" replace />} />
          <Route path="/clases" element={user ? <RutaCeroClasses /> : <Navigate to="/login" replace />} />
          <Route path="/asistentes" element={user ? <RutaCero /> : <Navigate to="/login" replace />} />
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login rutaCeroLogo={logo} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function RutaCeroApp() {
  return <ErrorBoundary><AuthProvider><BrowserRouter><Portal /></BrowserRouter></AuthProvider></ErrorBoundary>;
}

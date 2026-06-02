import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import ErrorBoundary from './components/ErrorBoundary';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Activate from './pages/Activate';
import Dashboard from './pages/Dashboard';
import DiagnosisFlow from './pages/DiagnosisFlow';
import Results from './pages/Results';
import Classes from './pages/Classes';
import AdminPanel from './pages/AdminPanel';
import Navbar from './components/Navbar';
import { GlobalSpeechIndicator } from './components/GlobalSpeechIndicator';
import { Toaster } from 'react-hot-toast';

function PrivateRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-sys-bg">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sys-accent"></div>
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && !isAdmin) return <Navigate to="/diagnostico" />;

  return <>{children}</>;
}

function AppContent() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-sys-bg text-sys-text-main flex flex-col">
      {!isAdminRoute && <GlobalSpeechIndicator />}
      {!isAdminRoute && <Navbar />}
      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Navigate to="/activar" replace />} />
          <Route path="/registro" element={<Navigate to="/activar" replace />} />
          <Route path="/registrar" element={<Navigate to="/activar" replace />} />
          <Route path="/activar" element={<Activate />} />
          
          <Route path="/diagnostico" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/dashboard" element={<Navigate to="/diagnostico" replace />} />
          <Route path="/bloque/:blockId" element={<PrivateRoute><DiagnosisFlow /></PrivateRoute>} />
          <Route path="/diagnosis/:blockId" element={<Navigate to={`/bloque/${location.pathname.split('/').pop()}`} replace />} />
          <Route path="/resultados" element={<PrivateRoute><Results /></PrivateRoute>} />
          <Route path="/results" element={<Navigate to="/resultados" replace />} />
          <Route path="/clases" element={<PrivateRoute><Classes /></PrivateRoute>} />
          
          <Route path="/admin/*" element={
            <PrivateRoute adminOnly={true}>
              <AdminPanel />
            </PrivateRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <Toaster position="top-right" toastOptions={{
        className: 'card-geometric border border-sys-border bg-sys-bg text-sys-text-main text-sm font-bold',
        duration: 4000,
        style: {
          borderRadius: '4px',
          background: '#0a0b10',
          color: '#fff',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }
      }} />
      {!isAdminRoute && (
        <footer className="py-12 px-4 border-t border-sys-border text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-6 h-6 bg-sys-input flex items-center justify-center rounded-sm">
               <span className="logo-text text-sys-text-sec text-[10px]">s.</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-sys-text-sec">SysTeam Mentoría</span>
          </div>
          <p className="text-[10px] text-sys-text-mut uppercase tracking-widest">
            &copy; {new Date().getFullYear()} SYSTEAM LATAM. Todos los derechos reservados.
          </p>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

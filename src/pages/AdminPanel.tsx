import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';
import { 
  LayoutDashboard, 
  Users, 
  MailPlus, 
  Settings, 
  LogOut,
  ChevronRight,
  Shield,
  Key,
  Tag
} from 'lucide-react';
import { parseDate } from '../lib/dateUtils';
import { ensureSuperAdmin, ensureAdmin } from '../lib/db';

import AdminDashboard from './admin/AdminDashboard';
import AdminStudents from './admin/AdminStudents';
import AdminStudentDetail from './admin/AdminStudentDetail';
import AdminInvitations from './admin/AdminInvitations';
import AdminSettings from './admin/AdminSettings';
import AdminRoleManagement from './admin/AdminRoleManagement';
import AdminTags from './admin/AdminTags';

export default function AdminPanel() {
  const { logout, profile, user, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      ensureSuperAdmin(user.uid, user.email);
      ensureAdmin(user.uid, user.email);
    }
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, 'invitations'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data: any[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setPendingInvitations(data);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin', exact: true, icon: LayoutDashboard },
    { name: 'Alumnos', path: '/admin/students', exact: false, icon: Users },
    { 
      name: 'Invitaciones', 
      path: '/admin/invitations', 
      exact: false, 
      icon: MailPlus,
      badge: pendingInvitations.length > 0 ? pendingInvitations.length : null,
      needsAttention: pendingInvitations.some(i => !i.lastSentAt && Math.floor((new Date().getTime() - (parseDate(i.createdAt)?.getTime() || 0)) / (1000 * 3600 * 24)) > 7)
    },
    ...(isSuperAdmin ? [{ name: 'Gestión de Roles', path: '/admin/roles', exact: false, icon: Shield }] : []),
    { name: 'Etiquetas', path: '/admin/tags', exact: false, icon: Tag },
    { name: 'Configuración', path: '/admin/settings', exact: false, icon: Settings },
  ];

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-sys-bg text-sys-text-main relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 items-start gap-8">
      {/* Sidebar */}
      <aside className="w-full md:w-64 shrink-0 flex flex-col gap-2 relative">
        <div className="card-geometric p-4 flex flex-col gap-2">
          <div className="px-4 py-3 mb-2 flex flex-col gap-1 border-b border-sys-border">
            <span className="font-sans font-bold tracking-tight lowercase text-sys-text-main text-xl leading-none flex items-center">
              systeam<span className="text-sys-accent">.</span> 
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sys-text-sec text-[10px] bg-sys-input rounded px-1 uppercase tracking-widest font-black">
                ADMIN
              </span>
              {isSuperAdmin ? (
                <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-tighter">
                  <Shield size={10} /> Super
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] bg-sys-accent-alpha text-sys-accent px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-tighter">
                  <Key size={10} /> Staff
                </span>
              )}
            </div>
          </div>

          <nav className="flex flex-col gap-1 flex-1">
            {navItems.map((item) => {
              const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-[8px] transition-colors text-sm font-semibold ${
                    isActive 
                      ? 'bg-sys-accent-alpha text-sys-accent border-l-2 border-l-sys-accent' 
                      : 'text-sys-text-sec hover:bg-sys-input border-l-2 border-l-transparent'
                  }`}
                >
                  <item.icon size={18} />
                  <span className="flex-1">{item.name}</span>
                  {item.badge != null && (
                    <span className="relative flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-sys-accent text-sys-bg rounded-md ml-auto">
                      {item.badge}
                      {item.needsAttention && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-sys-bg"></span>
                      )}
                    </span>
                  )}
                  {isActive && !item.badge && <ChevronRight size={16} className="ml-auto" />}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 pt-4 border-t border-sys-border flex flex-col gap-1">
            <Link
              to="/diagnostico"
              className="flex w-full items-center gap-3 px-4 py-3 rounded-[8px] transition-colors text-sm font-semibold text-sys-text-sec hover:text-sys-accent hover:bg-sys-accent-alpha"
            >
              <LayoutDashboard size={18} />
              Ir a la App
            </Link>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-3 rounded-[8px] transition-colors text-sm font-semibold text-sys-text-mut hover:text-sys-error hover:bg-sys-error/10"
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 w-full min-w-0">
        <div className="flex items-center justify-end mb-6">
           <div className="flex items-center gap-3">
             <div className="text-right hidden sm:block">
               <div className="text-sm font-bold flex items-center justify-end gap-2">
                 {profile?.fullName || 'Administrador'}
                 {isSuperAdmin && <Shield size={14} className="text-amber-500" />}
               </div>
               <div className="text-xs text-sys-text-mut uppercase tracking-widest font-bold">
                 {isSuperAdmin ? 'Super Administrador' : 'Administrador'}
               </div>
             </div>
             <div className="w-10 h-10 rounded-full bg-sys-input border border-sys-border flex items-center justify-center text-sys-accent font-bold">
               {profile?.fullName?.substring(0, 2).toUpperCase() || 'AD'}
             </div>
           </div>
        </div>
        <Routes>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/students" element={<AdminStudents />} />
          <Route path="/students/:id" element={<AdminStudentDetail />} />
          <Route path="/invitations" element={<AdminInvitations />} />
          <Route path="/roles" element={isSuperAdmin ? <AdminRoleManagement /> : <Navigate to="/admin" />} />
          <Route path="/tags" element={<AdminTags />} />
          <Route path="/settings" element={<AdminSettings />} />
        </Routes>
      </main>
    </div>
  );
}

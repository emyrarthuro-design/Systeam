import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { Shield, User, Trash2, UserPlus, ArrowDown, History, AlertTriangle, X, Check } from 'lucide-react';
import { formatDate } from '../../lib/dateUtils';
import { toast } from 'react-hot-toast';
import { logActivity } from '../../lib/db';
import { UserProfile, UserRole } from '../../types';
import { isSuperAdmin as checkSuperAdmin, SUPER_ADMIN_EMAILS } from '../../lib/admins';

export default function AdminRoleManagement() {
  const { profile: currentAdmin, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'admins' | 'create' | 'super' | 'logs'>('admins');
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Inline confirmation states
  const [pendingRoleChange, setPendingRoleChange] = useState<{email: string, role: string} | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<string | null>(null);

  // Create Admin form
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;

    const q = query(collection(db, 'users'), where('role', 'in', ['admin', 'super_admin']));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data: UserProfile[] = [];
      snap.forEach(d => data.push({ uid: d.id, ...d.data() } as UserProfile));
      setAdmins(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (activeTab === 'logs' && isSuperAdmin) {
      const q = query(collection(db, 'activity_logs'), where('action', 'in', ['change_role', 'delete_student', 'delete_invitation', 'delete_admin', 'mass_delete']));
      const unsubscribe = onSnapshot(q, (snap) => {
        const data: any[] = [];
        snap.forEach(d => data.push({ id: d.id, ...d.data() }));
        data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLogs(data);
      });
      return () => unsubscribe();
    }
  }, [activeTab, isSuperAdmin]);

  const executeRoleChange = async (userId: string, targetEmail: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      await logActivity({
        action: 'change_role',
        executorId: currentAdmin?.uid || 'unknown',
        executorName: currentAdmin?.fullName || 'Super Admin',
        executorEmail: currentAdmin?.email || '',
        targetId: userId,
        targetEmail: targetEmail,
        details: { newRole }
      });
      toast.success(`Rol actualizado a ${newRole}`);
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
      toast.error('Error al actualizar rol');
    } finally {
      setPendingRoleChange(null);
    }
  };

  const handleRoleChange = async (userId: string, targetEmail: string, newRole: UserRole) => {
    if (checkSuperAdmin(targetEmail)) {
      toast.error('No se puede cambiar el rol del Super Admin principal.');
      return;
    }

    setPendingRoleChange({ email: targetEmail, role: newRole });
  };

  const handleDeleteAdmin = async (userId: string, targetEmail: string) => {
    if (checkSuperAdmin(targetEmail)) {
      toast.error('No se puede eliminar la cuenta del Super Admin principal.');
      return;
    }

    if (userId === currentAdmin?.uid) {
      toast.error('No puedes eliminar tu propia cuenta.');
      return;
    }

    const confirm = window.prompt(`Esta acción eliminará permanentemente la cuenta de administrador de ${targetEmail}. Escribe el email del administrador para confirmar:`);
    if (confirm !== targetEmail) {
      if (confirm !== null) toast.error('Email incorrecto');
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));
      await logActivity({
        action: 'delete_admin',
        executorId: currentAdmin?.uid || 'unknown',
        executorName: currentAdmin?.fullName || 'Super Admin',
        executorEmail: currentAdmin?.email || '',
        targetId: userId,
        targetEmail: targetEmail
      });
      toast.success('Cuenta de administrador eliminada');
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
      toast.error('Error al eliminar cuenta');
    }
  };

  const executePromotion = async (emailToPromote: string) => {
    setIsSubmitting(true);
    try {
      const userQ = query(collection(db, 'users'), where('email', '==', emailToPromote));
      const userSnap = await (await import('firebase/firestore')).getDocs(userQ);
      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        const userData = userDoc.data();
        await updateDoc(doc(db, 'users', userDoc.id), { role: 'admin' });
        await logActivity({
          action: 'change_role',
          executorId: currentAdmin?.uid || 'unknown',
          executorName: currentAdmin?.fullName || 'Super Admin',
          executorEmail: currentAdmin?.email || '',
          targetId: userDoc.id,
          targetEmail: emailToPromote,
          details: { newRole: 'admin', previousRole: userData.role }
        });
        toast.success('Usuario promovido a Administrador');
        setActiveTab('admins');
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
      toast.error('Error al promover usuario');
    } finally {
      setIsSubmitting(false);
      setPendingPromotion(null);
      setEmail('');
      setFullName('');
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      // Check if user already exists
      const userQ = query(collection(db, 'users'), where('email', '==', normalizedEmail));
      const userSnap = await (await import('firebase/firestore')).getDocs(userQ);

      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        const userData = userDoc.data();
        if (userData.role === 'admin' || userData.role === 'super_admin') {
          toast.error('Este usuario ya es administrador.');
          setIsSubmitting(false);
          return;
        }

        setPendingPromotion(normalizedEmail);
        setIsSubmitting(false);
        return;
      } else {
        // Create invitation with admin flag
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        const code = `ADM-${randomPart}`;
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        
        await setDoc(doc(db, 'invitations', code), {
          code,
          fullName: fullName,
          email: normalizedEmail,
          country: 'Panamá',
          status: 'pending',
          createdAt: new Date().toISOString(),
          createdBy: currentAdmin?.email || 'super_admin',
          expiresAt,
          activatedAt: null,
          isAdminInvite: true,
          internalNotes: 'Invitación para nuevo administrador'
        });

        await logActivity({
          action: 'invite_admin',
          executorId: currentAdmin?.uid || 'unknown',
          executorName: currentAdmin?.fullName || 'Super Admin',
          executorEmail: currentAdmin?.email || '',
          targetEmail: normalizedEmail,
          details: { code }
        });

        toast.success('Invitación de administrador creada');
        setEmail('');
        setFullName('');
        setActiveTab('admins');
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
      toast.error('Error al procesar solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isSuperAdmin) {
    return <div className="p-12 text-center text-sys-error">Acceso restringido</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-sans flex items-center gap-3">
          <Shield className="text-amber-500" /> Gestión de Roles
        </h1>
        <button 
          onClick={() => setActiveTab('create')} 
          className="btn-geometric-primary py-2 px-4 flex items-center gap-2"
        >
          <UserPlus size={16} /> Nuevo Admin
        </button>
      </div>

      <div className="flex gap-2 border-b border-sys-border pb-px">
        {[
          { id: 'admins', label: 'Administradores', icon: Shield },
          { id: 'create', label: 'Crear Admin', icon: UserPlus },
          { id: 'super', label: 'Super Admin', icon: Shield },
          { id: 'logs', label: 'Logs', icon: History }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 text-xs font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${
              activeTab === tab.id 
                ? 'border-sys-accent text-sys-accent bg-sys-accent-alpha' 
                : 'border-transparent text-sys-text-mut hover:text-sys-text-sec'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'admins' && (
          <div className="card-geometric p-0 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-sys-input/50 text-sys-text-sec text-[10px] uppercase font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Administrador</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Desde</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sys-border">
                {admins.map(admin => (
                  <tr key={admin.uid} className="hover:bg-sys-input/20">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-sys-accent/10 border border-sys-accent/20 flex items-center justify-center font-bold text-sys-accent text-xs">
                          {admin.fullName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold flex items-center gap-2">
                            {admin.fullName}
                            {checkSuperAdmin(admin.email) && <Shield size={12} className="text-amber-500" />}
                          </div>
                          <div className="text-xs text-sys-text-mut">{admin.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                        admin.role === 'super_admin' ? 'bg-amber-500/10 text-amber-500' : 'bg-sys-accent-alpha text-sys-accent'
                      }`}>
                        {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sys-text-mut text-xs">
                      {formatDate(admin.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!checkSuperAdmin(admin.email) && admin.uid !== currentAdmin?.uid ? (
                        pendingRoleChange?.email === admin.email ? (
                          <div className="flex flex-col items-end gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded">
                            <span className="text-xs text-red-400 font-bold">¿Cambiar a {pendingRoleChange.role}?</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => executeRoleChange(admin.uid, pendingRoleChange.email, pendingRoleChange.role)} className="px-3 py-1 bg-red-500 text-white rounded text-[10px] font-bold uppercase hover:bg-red-600 transition-colors">Confirmar</button>
                              <button onClick={() => setPendingRoleChange(null)} className="px-3 py-1 bg-sys-input text-white border border-sys-border rounded text-[10px] font-bold uppercase hover:bg-sys-border transition-colors">Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleRoleChange(admin.uid, admin.email, admin.role === 'admin' ? 'student' : 'admin')}
                              className="p-2 text-sys-text-mut hover:text-sys-accent hover:bg-sys-accent-alpha rounded-sm transition-all"
                              title="Degradar a alumno"
                            >
                              <ArrowDown size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteAdmin(admin.uid, admin.email)}
                              className="p-2 text-sys-text-mut hover:text-sys-error hover:bg-sys-error/10 rounded-sm transition-all"
                              title="Eliminar administrador"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )
                      ) : (
                        <span className="text-[10px] text-sys-text-mut uppercase font-bold px-2 italic">Protegido</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="max-w-xl">
            <div className="card-geometric p-8">
              <h2 className="text-xl font-bold mb-6">Crear nuevo administrador</h2>
              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase text-sys-text-sec mb-2">Nombre completo</label>
                  <input 
                    required 
                    type="text" 
                    value={fullName} 
                    onChange={e => setFullName(e.target.value)} 
                    className="w-full bg-sys-input border border-sys-border rounded p-3 text-sm focus:border-sys-accent outline-none"
                    placeholder="Ej: Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-sys-text-sec mb-2">Email corporativo</label>
                  <input 
                    required 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="w-full bg-sys-input border border-sys-border rounded p-3 text-sm focus:border-sys-accent outline-none"
                    placeholder="admin@ejemplo.com"
                  />
                </div>
                <div className="p-4 bg-sys-accent-alpha border border-sys-accent/20 rounded-sm text-xs text-sys-text-sec leading-relaxed">
                  <p>Si el email ya existe como alumno, se le asignará el rol de administrador. Si es nuevo, se generará una invitación especial que le otorgará permisos de administrador al activarse.</p>
                </div>
                {!pendingPromotion ? (
                  <button 
                    disabled={isSubmitting} 
                    type="submit" 
                    className="w-full btn-geometric-primary py-4 font-black uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? 'Procesando...' : (
                      <>
                        <UserPlus size={18} /> Crear Administrador
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded mb-4">
                    <p className="text-sm text-red-400 font-bold mb-4">{pendingPromotion} ya existe como alumno. ¿Seguro que deseas promoverlo a Administrador?</p>
                    <div className="flex items-center gap-3">
                      <button 
                        type="button"
                        onClick={() => executePromotion(pendingPromotion)}
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-red-500 text-white rounded text-xs font-bold uppercase disabled:opacity-50"
                      >
                        {isSubmitting ? 'Procesando...' : 'Sí, Promover'}
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setPendingPromotion(null); setIsSubmitting(false); }}
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-sys-input text-white border border-sys-border rounded text-xs font-bold uppercase transition-colors hover:bg-sys-border disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {activeTab === 'super' && (
          <div className="max-w-xl">
            <div className="card-geometric p-8 space-y-6">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-4">
                <Shield size={32} />
              </div>
              <h2 className="text-xl font-bold uppercase tracking-tight">Super Administrador Maestro</h2>
              <div className="p-4 bg-sys-input border-l-4 border-amber-500 rounded-sm">
                <div className="text-xs text-sys-text-mut uppercase font-black mb-1">Email Principal</div>
                <div className="font-bold text-white text-lg">{SUPER_ADMIN_EMAILS[0]}</div>
              </div>
              <p className="text-sm text-sys-text-sec leading-relaxed">
                El rol de Super Administrador principal está protegido a nivel de código y base de datos. Tiene permisos totales para gestionar otros administradores, roles y flujos críticos del sistema.
              </p>
              <div className="p-4 border border-sys-border rounded-sm flex items-start gap-3 bg-sys-bg">
                <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-sys-text-mut italic">
                  Este rol no puede ser transferido ni eliminado desde esta interfaz por motivos de alta seguridad. Si necesitas realizar cambios estructurales, contacta al soporte técnico.
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="card-geometric p-0 overflow-hidden">
            <div className="p-4 border-b border-sys-border bg-sys-input/20">
              <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <History size={16} /> Registro de actividad crítica
              </h2>
            </div>
            <div className="divide-y divide-sys-border max-h-[600px] overflow-y-auto">
              {logs.length > 0 ? logs.map(log => (
                <div key={log.id} className="p-4 text-sm hover:bg-sys-input/10 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      log.action === 'delete_student' || log.action === 'delete_admin' ? 'bg-red-500/10 text-red-500' :
                      log.action === 'change_role' ? 'bg-sys-accent-alpha text-sys-accent' :
                      'bg-sys-input text-sys-text-sec'
                    }`}>
                      {log.action.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-mono text-sys-text-mut">{formatDate(log.timestamp)}</span>
                  </div>
                  <div className="text-sys-text-sec">
                    <span className="font-bold text-white">{log.executorName || log.executorEmail}</span>
                    {log.action === 'change_role' && (
                       <> cambió el rol de <span className="text-white">{log.targetEmail}</span> a <span className="text-sys-accent font-bold uppercase">{log.details?.newRole}</span></>
                    )}
                    {log.action === 'delete_student' && (
                       <> eliminó permanentemente al alumno <span className="text-red-400 font-bold">{log.targetEmail}</span></>
                    )}
                    {log.action === 'delete_invitation' && (
                       <> eliminó la invitación de <span className="text-white">{log.targetEmail}</span></>
                    )}
                    {log.action === 'delete_admin' && (
                       <> revocó el acceso de <span className="text-red-400 font-bold">{log.targetEmail}</span></>
                    )}
                    {log.action === 'invite_admin' && (
                       <> envió invitación de admin a <span className="text-sys-accent font-bold">{log.targetEmail}</span></>
                    )}
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center text-sys-text-mut italic">No hay logs de actividad recientes.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

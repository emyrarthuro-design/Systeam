import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Link } from 'react-router-dom';
import { UserPlus, AlertTriangle, MessageSquare, Mail } from 'lucide-react';
import { parseDate } from '../../lib/dateUtils';

import { APP_PUBLIC_URL } from '../../constants';

const buildMessage = (name: string, isHtml: boolean = false) => {
  const link = `${APP_PUBLIC_URL}/activar`;
  const nl = isHtml ? '%0D%0A' : '\\n';
  return `Hola ${name},

Te invito a completar tu Diagnóstico Inicial del Experto de SysTeam.

Este diagnóstico te ayudará a identificar desde dónde estás construyendo tu marca, tu oferta y tus resultados. Dura aproximadamente 30 a 40 minutos y puedes pausarlo y retomarlo cuando quieras.

Para acceder, entra aquí: ${link}
Cuando te pida tu email, usa este mismo donde recibiste este mensaje.

Si tienes cualquier duda, escríbeme directamente.

— SysTeam`;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    pendingInvites: 0,
  });
  const [recent, setRecent] = useState<any[]>([]);
  const [unsentInvites, setUnsentInvites] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const diagSnap = await getDocs(collection(db, 'diagnostics'));
        const invSnap = await getDocs(collection(db, 'invitations'));
        
        let students = 0;
        usersSnap.forEach(d => {
          if (d.data().role !== 'admin') students++;
        });
        
        let completed = 0;
        let inProgress = 0;
        diagSnap.forEach(d => {
          if (d.data().status === 'completed') completed++;
          else inProgress++;
        });
        
        let pendingInv = 0;
        const unsent: any[] = [];
        invSnap.forEach(d => {
          const data = d.data();
          if (data.status === 'pending') {
            pendingInv++;
            if (!data.lastSentAt) {
              unsent.push({ id: d.id, ...data });
            }
          }
        });
        setUnsentInvites(unsent.sort((a,b) => (parseDate(a.createdAt)?.getTime() || 0) - (parseDate(b.createdAt)?.getTime() || 0)));
        
        setStats({
          total: students,
          completed,
          inProgress,
          pendingInvites: pendingInv
        });
        
        const recentList: any[] = [];
        diagSnap.forEach(d => {
          if(d.data().status === 'completed') recentList.push({ id: d.id, ...d.data() });
        });
        recentList.sort((a,b) => {
          const dateA = a.completedAt ? parseDate(a.completedAt)?.getTime() || 0 : 0;
          const dateB = b.completedAt ? parseDate(b.completedAt)?.getTime() || 0 : 0;
          return dateB - dateA;
        });
        setRecent(recentList.slice(0, 5));
      } catch (err: any) {
        console.error("Error in AdminDashboard loadData:", err);
      }
    }
    loadData();
  }, []);

  const markAsSent = async (id: string, channel: 'whatsapp' | 'gmail') => {
    try {
      await updateDoc(doc(db, 'invitations', id), {
        lastSentAt: new Date().toISOString(),
        sentChannel: channel,
      });
      // Removing locally instead of reloading for speed
      setUnsentInvites(prev => prev.filter(i => i.id !== id));
      setStats(prev => ({...prev, pendingInvites: prev.pendingInvites}));
    } catch (error) {
      console.error(error);
    }
  };

  const handleWhatsApp = (name: string, id: string, whatsapp: string | null) => {
    if (!whatsapp) return;
    const msg = encodeURIComponent(buildMessage(name, true));
    const cleanNumber = whatsapp.replace(/[\s\-\(\)]/g, '');
    window.open(`https://wa.me/${cleanNumber}?text=${msg}`, '_blank');
    markAsSent(id, 'whatsapp');
  };

  const handleGmail = (name: string, id: string, email: string) => {
    const subject = encodeURIComponent('Tu acceso al Diagnóstico Inicial del Experto — SysTeam');
    const msg = encodeURIComponent(buildMessage(name, true));
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${msg}`, '_blank');
    markAsSent(id, 'gmail');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-sans">Panel General</h1>
        <Link to="/admin/invitations" className="btn-geometric-primary py-2 px-4 flex items-center gap-2">
          <UserPlus size={16} />
          Invitar alumno
        </Link>
      </div>

      {unsentInvites.length > 0 && (
        <div className="bg-sys-accent/10 border border-sys-accent text-sys-text-main p-4 rounded-xl flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sys-accent font-bold">
            <AlertTriangle size={18} />
            <h2>Invitaciones pendientes de envío ({unsentInvites.length})</h2>
          </div>
          <div className="space-y-2">
            {unsentInvites.slice(0, 5).map(inv => (
              <div key={inv.id} className="flex justify-between items-center bg-sys-bg p-3 rounded border border-sys-border">
                <div className="text-sm">
                  <span className="font-bold">{inv.fullName}</span> <span className="text-sys-text-mut ml-2 text-xs">{inv.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  {inv.whatsapp && (
                    <button onClick={() => handleWhatsApp(inv.fullName, inv.id, inv.whatsapp)} className="p-1.5 text-white rounded bg-[#25D366] hover:bg-[#20bd5a] transition-colors" title="Enviar por WhatsApp">
                      <MessageSquare size={14} />
                    </button>
                  )}
                  <button onClick={() => handleGmail(inv.fullName, inv.id, inv.email)} className="p-1.5 text-white rounded bg-[#EA4335] hover:opacity-90 transition-opacity" title="Enviar por Gmail">
                    <Mail size={14} />
                  </button>
                  <Link to="/admin/invitations" className="text-xs font-bold text-sys-accent hover:underline ml-2">Ver →</Link>
                </div>
              </div>
            ))}
            {unsentInvites.length > 5 && (
              <div className="text-xs text-sys-text-mut pt-2">Y {unsentInvites.length - 5} más... <Link to="/admin/invitations" className="text-sys-accent hover:underline">Ver todas</Link></div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Total Alumnos", value: stats.total },
          { title: "Diagnósticos Completados", value: stats.completed },
          { title: "Diagnósticos En Progreso", value: stats.inProgress },
          { title: "Invitaciones Pendientes", value: stats.pendingInvites },
        ].map(stat => (
          <div key={stat.title} className="card-geometric p-6">
             <div className="text-xs uppercase tracking-widest text-sys-text-sec mb-2 font-bold">{stat.title}</div>
             <div className="text-3xl font-black text-sys-text-main">{stat.value}</div>
          </div>
        ))}
      </div>
      
      {/* Últimos completados */}
      <div className="card-geometric p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold font-sans">Últimos Completados</h2>
          <Link to="/admin/students" className="text-xs font-bold uppercase tracking-widest text-sys-accent hover:underline">
            Ver todos →
          </Link>
        </div>
        
        {recent.length === 0 ? (
          <div className="text-sys-text-mut text-sm py-4 text-center border-t border-sys-border">
            No hay diagnósticos completados recientemente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="text-sys-text-sec text-[10px] uppercase font-black tracking-widest border-b border-sys-border">
                <tr>
                  <th className="pb-3 pr-6">Alumno</th>
                  <th className="pb-3 px-6">Fecha completado</th>
                  <th className="pb-3 px-6">Perfil predominante</th>
                  <th className="pb-3 px-6 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sys-border">
                {recent.map((diag) => (
                  <tr key={diag.id} className="hover:bg-sys-input/30 transition-colors">
                    <td className="py-4 pr-6">
                      <div className="font-bold text-sys-text-main">{diag.userName || 'Usuario'}</div>
                    </td>
                    <td className="py-4 px-6 text-sys-text-mut">
                      {diag.completedAt ? parseDate(diag.completedAt)?.toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-4 px-6 text-sys-text-sec">
                      {diag.analysis?.perfil_predominante || diag.result?.primaryProfile || '—'}
                    </td>
                    <td className="py-4 pl-6 text-right">
                      <Link to={`/admin/students/${diag.id}`} className="text-xs font-bold bg-sys-input hover:bg-sys-border px-3 py-1.5 rounded-sm transition-colors text-sys-text-main">
                        Ver ficha
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

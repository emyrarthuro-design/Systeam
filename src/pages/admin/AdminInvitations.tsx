import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, updateDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../components/AuthProvider';
import { Search, Plus, Filter, MoreHorizontal, Mail, Link as LinkIcon, RefreshCw, XCircle, Download, MessageSquare, Copy, Trash2, User, Clock, AlertTriangle, CheckCircle2, Check, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate, formatIso, parseDate } from '../../lib/dateUtils';
import { downloadCSV } from '../../lib/csv';
import { APP_PUBLIC_URL } from '../../constants';
import { logActivity, deleteInvitation as dbDeleteInvitation } from '../../lib/db';
import { toast } from 'react-hot-toast';

const COUNTRY_PREFIXES: Record<string, string> = {
  'Argentina': '+54',
  'Bolivia': '+591',
  'Chile': '+56',
  'Colombia': '+57',
  'Costa Rica': '+506',
  'Cuba': '+53',
  'Ecuador': '+593',
  'El Salvador': '+503',
  'España': '+34',
  'Guatemala': '+502',
  'Honduras': '+504',
  'México': '+52',
  'Nicaragua': '+505',
  'Panamá': '+507',
  'Paraguay': '+595',
  'Perú': '+51',
  'Puerto Rico': '+1',
  'República Dominicana': '+1',
  'Uruguay': '+598',
  'Venezuela': '+58',
};

const buildMessage = (name: string, email: string) => {
  return `Hola ${name},

Te invito a completar tu Diagnóstico Inicial del Experto de SysTeam.

Este diagnóstico te ayudará a identificar desde dónde estás construyendo tu marca, tu oferta y tus resultados. Dura aproximadamente 30 a 40 minutos y puedes pausarlo y retomarlo cuando quieras.

Para acceder, entra aquí: ${APP_PUBLIC_URL}/activar

Cuando te pida tu email, usa este mismo donde recibiste este mensaje: ${email}

Si tienes cualquier duda, escríbeme directamente.

— SysTeam`;
};

export default function AdminInvitations() {
  const { profile, isSuperAdmin } = useAuth();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState<any>(null); // { type: 'single' | 'bulk', data: any }
  const [confirmText, setConfirmText] = useState('');

  // Modal states
  const [formData, setFormData] = useState({ name: '', email: '', country: 'México', whatsapp: '+52 ', notes: '' });
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [createdWhatsapp, setCreatedWhatsapp] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = () => setActiveDropdown(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'invitations'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data: any[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setInvitations(data);
      setLoading(false);
    }, (err) => {
      if (import.meta.env.DEV) console.error(err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loadInvitations = () => {
    // Left empty for compatibility where loadInvitations is called
  };

  const handleExport = () => {
    const headers = [
      'código', 'nombre', 'email', 'país', 'estado', 
      'fecha_creación', 'fecha_expiración', 'fecha_activación', 'notas_internas'
    ];
    
    const data = invitations.map(i => [
      i.code,
      i.fullName,
      i.email,
      i.country || '',
      i.status,
      formatIso(i.createdAt),
      formatIso(i.expiresAt),
      formatIso(i.activatedAt),
      i.internalNotes || ''
    ]);

    downloadCSV('systeam_invitaciones.csv', headers, data);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `STM-${randomPart}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const normalizedEmail = formData.email.trim().toLowerCase();
      const cleanWhatsapp = formData.whatsapp.trim();
      
      await setDoc(doc(db, 'invitations', code), {
        code,
        fullName: formData.name,
        email: normalizedEmail,
        country: formData.country,
        whatsapp: cleanWhatsapp !== (COUNTRY_PREFIXES[formData.country] + ' ').trim() && cleanWhatsapp !== COUNTRY_PREFIXES[formData.country] && cleanWhatsapp !== '' ? cleanWhatsapp : null,
        internalNotes: formData.notes,
        status: 'pending',
        createdAt: now.toISOString(),
        createdBy: profile?.email || 'admin',
        expiresAt,
        activatedAt: null,
      });
      
      setCreatedCode(code);
      setCreatedName(formData.name);
      setCreatedWhatsapp(cleanWhatsapp !== (COUNTRY_PREFIXES[formData.country] + ' ').trim() && cleanWhatsapp !== COUNTRY_PREFIXES[formData.country] ? cleanWhatsapp : null);
      setCreatedEmail(normalizedEmail);
      setFormData({ name: '', email: '', country: 'México', whatsapp: '+52 ', notes: '' });
      toast.success('Invitación generada');
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
      toast.error('Error al crear invitación');
    }
  };

  const executeDelete = async () => {
    const expectedConfirmText = showDeleteModal.type === 'bulk' ? `ELIMINAR ${selectedIds.length}` : 'ELIMINAR';
    if (confirmText !== expectedConfirmText) {
      return;
    }

    try {
      if (showDeleteModal.type === 'single') {
        const inv = showDeleteModal.data;
        await dbDeleteInvitation(inv.id);
        await logActivity({
          action: 'delete_invitation',
          executorId: profile?.uid || 'unknown',
          executorName: profile?.fullName || 'Admin',
          executorEmail: profile?.email || '',
          targetId: inv.id,
          targetEmail: inv.email
        });
      } else {
        // Bulk delete
        for (const id of selectedIds) {
          const inv = invitations.find(i => i.id === id);
          await dbDeleteInvitation(id);
          if (inv) {
            await logActivity({
              action: 'delete_invitation',
              executorId: profile?.uid || 'unknown',
              executorName: profile?.fullName || 'Admin',
              executorEmail: profile?.email || '',
              targetId: id,
              targetEmail: inv.email
            });
          }
        }
        setSelectedIds([]);
      }
      toast.success('Invitación(es) eliminada(s)');
      setShowDeleteModal(null);
      setConfirmText('');
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
      toast.error('Error al eliminar');
    }
  };

  const deleteInvitation = async (id: string) => {
    // This is now handled by the modal and executeDelete
  };

  const markAsSent = async (id: string, channel: 'whatsapp' | 'gmail' | 'manual') => {
    try {
      await updateDoc(doc(db, 'invitations', id), {
        lastSentAt: new Date().toISOString(),
        sentChannel: channel,
      });
      loadInvitations();
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
    }
  };

  const handleCopyMessage = (name: string, email: string, id: string) => {
    navigator.clipboard.writeText(buildMessage(name, email));
    toast.success('Mensaje copiado.');
    markAsSent(id, 'manual');
  };

  const handleWhatsApp = (name: string, email: string, id: string, whatsapp: string | null) => {
    if (!whatsapp) return;
    const msg = encodeURIComponent(buildMessage(name, email));
    const cleanNumber = whatsapp.replace(/[\s\-\(\)\+]/g, '');
    window.open(`https://wa.me/${cleanNumber}?text=${msg}`, '_blank');
    markAsSent(id, 'whatsapp');
  };

  const handleGmail = (name: string, id: string, email: string) => {
    const subject = encodeURIComponent('Tu acceso al Diagnóstico Inicial del Experto — SysTeam');
    const msg = encodeURIComponent(buildMessage(invitations.find(i => i.id === id)?.fullName || '', email));
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${msg}`, '_blank');
    markAsSent(id, 'gmail');
  };

  const filteredInvitations = invitations.filter(i => (i.fullName + i.email).toLowerCase().includes(search.toLowerCase()));

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredInvitations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredInvitations.map(i => i.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Rest of rendering
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-sans">Invitaciones</h1>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-geometric-secondary border-sys-border py-2 px-4 flex items-center gap-2 shadow-none">
            <Download size={16} /> Exportar CSV
          </button>
          <button onClick={() => setShowModal(true)} className="btn-geometric-primary py-2 px-4 flex items-center gap-2">
            <Plus size={16} /> Invitar alumno
          </button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-40 bg-sys-accent shadow-2xl p-4 rounded-sm flex items-center justify-between text-sys-bg animate-in slide-in-from-top-4">
          <div className="font-black uppercase tracking-widest text-xs flex items-center gap-2">
            <span className="bg-sys-bg text-sys-accent px-2 py-1 rounded">{selectedIds.length}</span>
            Invitaciones seleccionadas
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSelectedIds([])} className="px-4 py-2 border border-sys-bg/20 hover:bg-sys-bg/10 rounded-sm text-xs font-bold uppercase">
              Cancelar
            </button>
            <button 
              onClick={() => {
                setShowDeleteModal({ type: 'bulk', data: null });
                setConfirmText('');
              }}
              className="px-4 py-2 bg-sys-bg text-sys-accent hover:bg-sys-bg/90 rounded-sm text-xs font-black uppercase flex items-center gap-2"
            >
              <Trash2 size={14} /> Eliminar seleccionadas
            </button>
          </div>
        </div>
      )}

      <div className="card-geometric p-0 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-sys-border flex gap-4">
             <div className="relative flex-1">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sys-text-mut" size={18} />
               <input 
                 type="text" 
                 placeholder="Buscar por nombre o email..." 
                 className="w-full bg-sys-input border border-sys-border rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-sys-accent text-sys-text-main"
                 value={search}
                 onChange={e => setSearch(e.target.value)}
               />
             </div>
          </div>
          
          <div className="overflow-x-auto">
             <table className="w-full text-left text-sm whitespace-nowrap">
               <thead className="bg-sys-input/50 text-sys-text-sec text-[10px] uppercase font-black tracking-widest text-left">
                 <tr>
                   <th className="px-6 py-3">
                     <button onClick={toggleSelectAll} className="w-5 h-5 rounded border border-sys-border flex items-center justify-center bg-sys-bg text-sys-accent transition-colors hover:border-sys-accent">
                        {selectedIds.length === filteredInvitations.length && filteredInvitations.length > 0 && <Check size={14} />}
                     </button>
                   </th>
                   <th className="px-6 py-3">Email</th>
                   <th className="px-6 py-3">Alumno</th>
                   <th className="px-6 py-3">País</th>
                   <th className="px-6 py-3">Estado</th>
                   <th className="px-6 py-3">Fecha</th>
                   <th className="px-6 py-3"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-sys-border">
                   {filteredInvitations.map(inv => {
                    const daysSinceCreation = Math.floor((new Date().getTime() - new Date(inv.createdAt).getTime()) / (1000 * 3600 * 24));
                    const isPending = inv.status === 'pending';
                    const notSent = isPending && !inv.lastSentAt;
                    const isSelected = selectedIds.includes(inv.id);
                    
                    return (
                    <tr key={inv.id} className={`hover:bg-sys-input/30 group transition-colors ${isSelected ? 'bg-sys-accent-alpha/20' : ''}`}>
                      <td className="px-6 py-4">
                        <button onClick={() => toggleSelect(inv.id)} className={`w-5 h-5 rounded border transition-colors flex items-center justify-center ${isSelected ? 'bg-sys-accent border-sys-accent text-sys-bg' : 'border-sys-border bg-sys-bg text-transparent hover:border-sys-accent'}`}>
                            <Check size={14} />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        {isPending && (
                          <div className="mb-2">
                            {notSent && daysSinceCreation <= 3 && <span className="inline-flex py-0.5 px-2 bg-sys-accent/20 text-sys-accent text-[10px] rounded font-bold uppercase tracking-wider items-center gap-1"><AlertTriangle size={10} /> Pendiente de envío</span>}
                            {notSent && daysSinceCreation > 3 && daysSinceCreation <= 14 && <span className="inline-flex py-0.5 px-2 bg-orange-500/20 text-orange-500 text-[10px] rounded font-bold uppercase tracking-wider items-center gap-1"><Clock size={10} /> Recordatorio: enviar</span>}
                            {notSent && daysSinceCreation > 14 && <span className="inline-flex py-0.5 px-2 bg-red-500/20 text-red-500 text-[10px] rounded font-bold uppercase tracking-wider items-center gap-1"><AlertTriangle size={10} /> Por expirar</span>}
                          </div>
                        )}
                        {inv.isAdminInvite && (
                          <div className="mb-2">
                             <span className="inline-flex py-0.5 px-2 bg-amber-500/20 text-amber-500 text-[10px] rounded font-bold uppercase tracking-wider items-center gap-1"><Shield size={10} /> Nuevo Administrador</span>
                          </div>
                        )}
                        <span className="font-mono text-sys-text-sec text-sm">{inv.email}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold flex items-center gap-2">
                          {inv.fullName}
                          {inv.whatsapp && <span title={`WhatsApp: ${inv.whatsapp}`}><MessageSquare size={12} className="text-[#25D366]" /></span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sys-text-sec">{inv.country}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wider ${
                          inv.status === 'activated' ? 'bg-green-500/10 text-green-500' :
                          inv.status === 'pending' ? 'bg-sys-accent/10 text-sys-accent' :
                          'bg-red-500/10 text-red-500'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                         <div className="text-sys-text-sec text-xs">{formatDate(inv.createdAt)}</div>
                         <div className="text-[10px] text-sys-text-mut mt-1">
                           {inv.lastSentAt ? (
                             <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-green-500" /> Enviado {formatDate(inv.lastSentAt)}</span>
                           ) : (
                             '—'
                           )}
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex items-center justify-end gap-1 relative">
                           {inv.status === 'pending' && (
                             <>
                               {inv.whatsapp && (
                                 <button onClick={() => handleWhatsApp(inv.fullName, inv.email, inv.id, inv.whatsapp)} className="p-1.5 text-white rounded bg-[#25D366] hover:bg-[#20bd5a] transition-colors" title="Enviar rápido por WhatsApp">
                                   <MessageSquare size={14} />
                                 </button>
                               )}
                               <button onClick={() => handleCopyMessage(inv.fullName, inv.email, inv.id)} className="p-1.5 text-sys-bg rounded bg-sys-accent hover:opacity-90 transition-opacity" title="Copiar mensaje completo">
                                 <Copy size={14} />
                               </button>
                             </>
                           )}
                           
                           <button 
                             onClick={(e) => {
                               e.stopPropagation();
                               setActiveDropdown(activeDropdown === inv.id ? null : inv.id);
                             }} 
                             className="p-1.5 text-sys-text-mut hover:text-sys-accent transition-colors ml-2"
                           >
                             <MoreHorizontal size={18} />
                           </button>
                           
                           {activeDropdown === inv.id && (
                              <div className="absolute top-10 right-0 w-48 bg-sys-bg border border-sys-border rounded shadow-xl z-50 text-left overflow-hidden">
                                {inv.status === 'pending' && (
                                  <>
                                    {inv.whatsapp && (
                                      <button onClick={() => { handleWhatsApp(inv.fullName, inv.email, inv.id, inv.whatsapp); setActiveDropdown(null); }} className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-sys-input flex items-center gap-2">
                                        <MessageSquare size={14} className="text-[#25D366]" /> Enviar por WhatsApp
                                      </button>
                                    )}
                                    <button onClick={() => { handleGmail(inv.fullName, inv.id, inv.email); setActiveDropdown(null); }} className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-sys-input flex items-center gap-2">
                                      <Mail size={14} className="text-[#EA4335]" /> Enviar por Gmail
                                    </button>
                                    <button onClick={() => { handleCopyMessage(inv.fullName, inv.email, inv.id); setActiveDropdown(null); }} className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-sys-input flex items-center gap-2">
                                      <Copy size={14} className="text-sys-accent" /> Copiar mensaje completo
                                    </button>
                                    <button onClick={() => { navigator.clipboard.writeText(`${APP_PUBLIC_URL}/activar`); toast.success('Link copiado'); setActiveDropdown(null); }} className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-sys-input flex items-center gap-2">
                                      <LinkIcon size={14} className="text-sys-text-sec" /> Copiar link
                                    </button>
                                    <div className="h-px bg-sys-border my-1"></div>
                                    <button 
                                      onClick={() => { 
                                        setShowDeleteModal({ type: 'single', data: inv }); 
                                        setConfirmText('');
                                        setActiveDropdown(null); 
                                      }} 
                                      className="w-full text-left px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 flex items-center gap-2"
                                    >
                                      <Trash2 size={14} /> Eliminar invitación
                                    </button>
                                  </>
                                )}
                                {inv.status === 'activated' && (
                                  <>
                                    <button onClick={() => { window.location.href = `/admin/students/${inv.id}`; setActiveDropdown(null); }} className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-sys-input flex items-center gap-2">
                                      <User size={14} className="text-sys-text-sec" /> Ver alumno
                                    </button>
                                    <button 
                                      onClick={() => { 
                                        setShowDeleteModal({ type: 'single', data: inv }); 
                                        setConfirmText('');
                                        setActiveDropdown(null); 
                                      }} 
                                      className="w-full text-left px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 flex items-center gap-2"
                                    >
                                      <Trash2 size={14} /> Limpiar registro
                                    </button>
                                  </>
                                )}
                                {inv.status === 'expired' && (
                                  <>
                                    <button 
                                      onClick={() => { 
                                        setShowDeleteModal({ type: 'single', data: inv }); 
                                        setConfirmText('');
                                        setActiveDropdown(null); 
                                      }} 
                                      className="w-full text-left px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 flex items-center gap-2"
                                    >
                                      <Trash2 size={14} /> Eliminar invitación
                                    </button>
                                  </>
                                )}
                              </div>
                           )}
                         </div>
                      </td>
                    </tr>
                   )})}
               </tbody>
             </table>
          </div>
      </div>
      
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-sys-bg border border-sys-border p-6 rounded-xl w-full max-w-md card-geometric relative">
             <button onClick={() => {setShowModal(false); setCreatedCode(null);}} className="absolute top-4 right-4 text-sys-text-mut hover:text-sys-text-main"><XCircle size={20} /></button>
             
             {!createdCode ? (
                <form onSubmit={handleCreate} className="space-y-4">
                  <h2 className="text-xl font-bold font-sans">Nueva Invitación</h2>
                  <div>
                    <label className="block text-xs font-bold text-sys-text-sec mb-1">NOMBRE COMPLETO</label>
                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-sys-input border border-sys-border rounded p-2 focus:border-sys-accent outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-sys-text-sec mb-1">EMAIL</label>
                    <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-sys-input border border-sys-border rounded p-2 focus:border-sys-accent outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-sys-text-sec mb-1">PAÍS</label>
                    <select value={formData.country} onChange={e => setFormData({...formData, country: e.target.value, whatsapp: (COUNTRY_PREFIXES[e.target.value] || '') + ' '})} className="w-full bg-sys-input border border-sys-border rounded p-2 focus:border-sys-accent outline-none">
                      <option>Argentina</option>
                      <option>Bolivia</option>
                      <option>Chile</option>
                      <option>Colombia</option>
                      <option>Costa Rica</option>
                      <option>Cuba</option>
                      <option>Ecuador</option>
                      <option>El Salvador</option>
                      <option>España</option>
                      <option>Guatemala</option>
                      <option>Honduras</option>
                      <option>México</option>
                      <option>Nicaragua</option>
                      <option>Panamá</option>
                      <option>Paraguay</option>
                      <option>Perú</option>
                      <option>Puerto Rico</option>
                      <option>República Dominicana</option>
                      <option>Uruguay</option>
                      <option>Venezuela</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-sys-text-sec mb-1">WHATSAPP (Opcional)</label>
                    <input type="tel" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} className="w-full bg-sys-input border border-sys-border rounded p-2 focus:border-sys-accent outline-none font-mono" placeholder="Ej: +52 55 1234 5678" />
                    <p className="text-[10px] text-sys-text-mut mt-1">Si lo agregas, podrás enviar la invitación con un click por WhatsApp</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-sys-text-sec mb-1">NOTAS INTERNAS (Opcional)</label>
                    <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-sys-input border border-sys-border rounded p-2 focus:border-sys-accent outline-none text-sm" placeholder="No se mostrará al alumno" rows={2} />
                  </div>
                  <button type="submit" className="w-full btn-geometric-primary py-3">Generar Invitación</button>
                </form>
             ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-xl font-bold font-sans mb-1 text-white uppercase tracking-tight">Invitación creada</h2>
                    <p className="text-sm text-sys-text-sec font-medium">Envíasela a <strong className="text-white">{createdName}</strong> por el canal que prefieras</p>
                  </div>
                  
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-sm text-sm text-amber-500 text-center">
                    <div className="flex items-center justify-center gap-2 font-black uppercase tracking-widest mb-1">
                      <AlertTriangle size={14} /> Importante
                    </div>
                    El alumno <strong className="text-amber-400">DEBE</strong> usar el email <span className="font-bold underline">{createdEmail}</span> para activar su cuenta.
                  </div>

                  <div className="flex bg-sys-input border border-sys-border rounded-sm overflow-hidden">
                    <div className="flex-1 px-4 py-3 text-sm truncate text-sys-text-sec flex items-center font-mono">
                      {APP_PUBLIC_URL}/activar
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <button 
                      onClick={() => handleWhatsApp(createdName || '', createdEmail || '', createdCode || '', createdWhatsapp)}
                      disabled={!createdWhatsapp}
                      className="w-full flex items-center justify-center gap-3 py-4 px-4 rounded-sm font-black uppercase tracking-widest text-white transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ backgroundColor: createdWhatsapp ? '#25D366' : '#222' }}
                    >
                      <MessageSquare size={18} /> WhatsApp
                    </button>
                    
                    <button 
                      onClick={() => handleGmail(createdName || '', createdCode || '', createdEmail || '')}
                      className="w-full flex items-center justify-center gap-3 py-4 px-4 rounded-sm font-black uppercase tracking-widest text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: '#EA4335' }}
                    >
                      <Mail size={18} /> Gmail
                    </button>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleCopyMessage(createdName || '', createdEmail || '', createdCode || '')}
                        className="flex items-center justify-center gap-2 py-4 px-4 rounded-sm font-black uppercase tracking-tighter text-[10px] transition-colors bg-sys-accent text-sys-bg hover:opacity-90 shadow-lg shadow-sys-accent/20"
                      >
                        <Copy size={16} /> Copiar mensaje
                      </button>

                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(`${APP_PUBLIC_URL}/activar`);
                          toast.success('Link copiado al portapapeles');
                        }}
                        className="flex items-center justify-center gap-2 py-4 px-4 rounded-sm font-black uppercase tracking-tighter text-[10px] transition-colors bg-sys-input border border-sys-border hover:bg-sys-border text-sys-text-main"
                      >
                        <LinkIcon size={16} /> Copiar link
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-sys-border">
                    <button onClick={() => {setShowModal(false); setCreatedCode(null);}} className="w-full text-sys-text-mut hover:text-white text-xs font-black uppercase tracking-[0.3em] py-2 transition-colors">
                      Cerrar y volver
                    </button>
                  </div>
                </div>
             )}
          </div>
        </div>
      )}
      {/* showModal (creation) remains similar but updated with toast */}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-sys-bg border border-sys-border p-8 rounded-xl w-full max-w-lg card-geometric relative space-y-6">
            <div className="flex items-start gap-4 text-left">
              <div className="w-12 h-12 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold font-sans uppercase tracking-tight text-white">
                  {showDeleteModal.type === 'bulk' ? `¿Eliminar ${selectedIds.length} invitaciones?` : '¿Eliminar esta invitación?'}
                </h2>
                <div className="text-sm text-sys-text-sec mt-2 leading-relaxed">
                  {showDeleteModal.type === 'single' ? (
                    <>
                      {showDeleteModal.data.status === 'pending' && `La invitación de ${showDeleteModal.data.fullName} se eliminará permanentemente. El alumno NO podrá usar el link para activar su cuenta. Esta acción no se puede deshacer.`}
                      {showDeleteModal.data.status === 'activated' && `Se eliminará el registro de invitación de ${showDeleteModal.data.fullName}. El alumno seguirá teniendo acceso normal a su cuenta. Esta acción solo limpia tu lista de invitaciones.`}
                      {showDeleteModal.data.status === 'expired' && `Se eliminará permanentemente esta invitación expirada. Si necesitas invitar a esta persona nuevamente, deberás crear una nueva invitación.`}
                    </>
                  ) : (
                    `Se eliminarán permanentemente ${selectedIds.length} invitaciones. Esta acción no se puede deshacer.`
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
               <label className="block text-xs font-black uppercase tracking-widest text-sys-text-mut text-left">
                 Para confirmar, escribe <span className="text-white">{"ELIMINAR" + (showDeleteModal.type === 'bulk' ? ` ${selectedIds.length}` : '')}</span>
               </label>
               <input 
                 type="text" 
                 value={confirmText}
                 onChange={e => setConfirmText(e.target.value)}
                 className="w-full bg-sys-input border border-sys-border rounded p-3 text-sm focus:border-red-500 outline-none font-mono text-white"
                 placeholder="Escribe aquí..."
               />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
               <button onClick={() => setShowDeleteModal(null)} className="flex-1 px-6 py-3 rounded-sm font-black uppercase tracking-widest text-xs border border-sys-border hover:bg-sys-input transition-colors text-white">
                 Cancelar
               </button>
               <button 
                 disabled={confirmText !== ('ELIMINAR' + (showDeleteModal.type === 'bulk' ? ` ${selectedIds.length}` : ''))}
                 onClick={executeDelete} 
                 className="flex-1 bg-red-500 text-white px-6 py-3 rounded-sm font-black uppercase tracking-widest text-xs disabled:opacity-30 transition-all hover:bg-red-600 shadow-xl shadow-red-500/20"
               >
                 Confirmar eliminación
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

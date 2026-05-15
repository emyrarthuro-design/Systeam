import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ChevronLeft, Save, Loader2, Trash2, AlertTriangle, Shield, History } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { formatDateTime } from '../../lib/dateUtils';
import { useAuth } from '../../components/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { logActivity, deleteUserCompletely } from '../../lib/db';
import { toast } from 'react-hot-toast';

export default function AdminStudentDetail() {
  const { id } = useParams();
  const { profile: currentAdmin, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [student, setStudent] = useState<any>(null);
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ficha');
  const [internalNotes, setInternalNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const isSystemAdmin = student?.role === 'admin' || student?.role === 'super_admin';
  const canDelete = isSuperAdmin || (!isSystemAdmin);

  useEffect(() => {
    async function loadData() {
      if(!id) return;
      try {
        const uSnap = await getDoc(doc(db, 'users', id));
        if (uSnap.exists()) {
          const sData = uSnap.data();
          setStudent({ id: uSnap.id, ...sData });
          if (sData.internalNotes) {
            setInternalNotes(sData.internalNotes);
          }
        }
        
        const dSnap = await getDoc(doc(db, 'diagnostics', id));
        if (dSnap.exists()) {
          setDiagnosis(dSnap.data());
        }
      } catch(err) {
        console.error(err);
      }
      setLoading(false);
    }
    loadData();
  }, [id]);

  const handleSaveNotes = async () => {
    if(!id) return;
    setSavingNotes(true);
    setSaveSuccess(false);
    try {
      await updateDoc(doc(db, 'users', id), {
        internalNotes
      });
      
      // Update local state
      setStudent((prev: any) => ({...prev, internalNotes}));
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      toast.success('Notas guardadas');
    } catch(err) {
      console.error("Error saving notes:", err);
      toast.error('Error al guardar notas');
    }
    setSavingNotes(false);
  };

  const handleDelete = async () => {
    const expectedConfirmText = (student.fullName || student.name || '').trim().toLowerCase();
    
    if (confirmText.trim().toLowerCase() !== expectedConfirmText) {
      return;
    }

    setDeleting(true);
    setDeleteError('');

    try {
      const response = await deleteUserCompletely({
        targetUid: student.id,
        targetEmail: student.email,
        confirmationName: confirmText.trim()
      });

      if (response.success) {
        toast.success(`Alumno eliminado permanentemente. ${response.summary?.diagnosticsArchived || 0} diagnósticos archivados, ${response.summary?.invitationsDeleted || 0} invitaciones borradas.`);
        navigate('/admin/students');
      } else {
        setDeleteError(response.error || 'Error desconocido');
      }
    } catch (error: any) {
      console.error(error);
      setDeleteError(error.message || 'Error al comunicarse con el servidor');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="animate-spin text-sys-accent" size={40} />
      <p className="text-sys-text-mut uppercase font-black tracking-widest text-xs">Cargando expediente...</p>
    </div>
  );
  if (!student) return <div className="p-20 text-center text-sys-error">Alumno no encontrado</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/admin/students" className="text-sys-text-mut hover:text-sys-accent flex items-center gap-1 text-sm font-bold">
          <ChevronLeft size={16} /> Volver a alumnos
        </Link>
        
        {isAdmin && canDelete && student && (
          <button 
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-500/60 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} /> Eliminar Expediente
          </button>
        )}
      </div>
      
      <div className="card-geometric p-6">
         <h1 className="text-3xl font-black">{student.fullName}</h1>
         <div className="text-sys-text-sec text-sm mt-1">{student.email} • {student.country || 'Sin país'}</div>
         
         <div className="flex flex-wrap gap-2 mt-4">
            <span className={`px-2 py-1 rounded text-xs font-bold ${
              diagnosis?.status === 'completed' ? 'bg-green-500/10 text-green-500' :
              diagnosis?.status === 'in_progress' ? 'bg-sys-accent/10 text-sys-accent' :
              'bg-gray-500/10 text-gray-400'
            }`}>
              {diagnosis?.status === 'completed' ? 'COMPLETADO' : diagnosis?.status === 'in_progress' ? 'EN PROGRESO' : 'NO INICIADO'}
            </span>
            {diagnosis?.result?.primaryProfile && (
               <span className="px-2 py-1 bg-sys-accent/10 text-sys-accent border border-sys-accent/30 rounded text-xs">
                 Predominante: {diagnosis.result.primaryProfile}
               </span>
            )}
         </div>
      </div>
      
      <div className="flex border-b border-sys-border">
         {['ficha', 'nota', 'respuestas', 'metadatos'].map(tab => (
           <button 
             key={tab}
             onClick={() => setActiveTab(tab)}
             className={`px-4 py-3 text-sm font-bold uppercase tracking-widest border-b-2 transition-colors ${
               activeTab === tab ? 'border-sys-accent text-sys-accent' : 'border-transparent text-sys-text-sec hover:text-sys-text-main'
             }`}
           >
             {tab === 'ficha' ? 'Ficha Completa' : tab === 'nota' ? 'Nota Interna' : tab === 'respuestas' ? 'Respuestas' : 'Metadatos'}
           </button>
         ))}
      </div>
      
      <div className="mt-6">
        {activeTab === 'ficha' && (
           <div className="card-geometric">
             {diagnosis?.result ? (
                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown>{diagnosis.result.feedback || '*No hay feedback generado*'}</ReactMarkdown>
                </div>
             ) : (
                <div className="text-sys-text-mut text-center py-8">El alumno aún no ha completado el diagnóstico o no se generaron resultados.</div>
             )}
           </div>
        )}
        {activeTab === 'nota' && (
           <div className="card-geometric border-sys-accent/30 bg-sys-accent/5">
              <div className="bg-sys-accent text-sys-bg text-xs font-bold uppercase py-1 px-3 inline-block rounded mb-4">
                 🔒 Solo visible para SysTeam
              </div>
              
              {!isAdmin ? (
                <p className="text-sm text-sys-text-mut">No tienes permisos para ver las notas internas.</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-sys-text-mut">Añade observaciones, comentarios de reuniones o información relevante de este alumno.</p>
                  
                  <textarea 
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    className="w-full bg-sys-input/50 border border-sys-border rounded p-4 text-sys-text-main h-64 focus:outline-none focus:border-sys-accent transition-colors"
                    placeholder="Escribe notas internas aquí..."
                  />
                  
                  <div className="flex justify-end items-center gap-4">
                    {saveSuccess && <span className="text-sm text-green-500 font-bold">¡Notas guardadas!</span>}
                    <button 
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      className="btn-primary flex items-center gap-2"
                    >
                      {savingNotes ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      {savingNotes ? 'Guardando...' : 'Guardar Notas'}
                    </button>
                  </div>
                </div>
              )}
           </div>
        )}
        {activeTab === 'respuestas' && (
           <div className="card-geometric">
             {diagnosis?.responses ? (
                <pre className="text-xs bg-sys-input p-4 rounded overflow-auto max-h-[500px] border border-sys-border">
                   {JSON.stringify(diagnosis.responses, null, 2)}
                </pre>
             ) : (
                <div className="text-sys-text-mut text-center py-8">No hay respuestas registradas.</div>
             )}
           </div>
        )}
        {activeTab === 'metadatos' && (
           <div className="card-geometric space-y-4">
              <div>
                <div className="text-xs text-sys-text-mut font-bold">FECHA REGISTRO</div>
                <div>{formatDateTime(student.createdAt)}</div>
              </div>
              {diagnosis?.completedAt && (
                <div>
                  <div className="text-xs text-sys-text-mut font-bold">FECHA FINALIZACIÓN</div>
                  <div>{formatDateTime(diagnosis.completedAt)}</div>
                </div>
              )}
           </div>
        )}
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-sys-bg border border-sys-border p-8 rounded-xl w-full max-w-lg card-geometric relative space-y-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center shrink-0">
                <Trash2 size={24} />
              </div>
              <h2 className="text-xl font-bold font-sans uppercase tracking-tight text-white line-height-1">
                Eliminar alumno permanentemente
              </h2>
              <p className="text-sm text-sys-text-sec leading-relaxed">
                Esta acción borra la cuenta de Auth, el perfil y las invitaciones de <span className="text-white font-bold">{student.fullName}</span>. Los diagnósticos se archivan. No se puede deshacer.
              </p>
            </div>

            {deleteError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-3 rounded-sm font-bold">
                 <AlertTriangle size={18} className="shrink-0" />
                 {deleteError}
              </div>
            )}

            <div className="space-y-3">
               <label className="block text-xs font-black uppercase tracking-widest text-sys-text-mut text-center">
                 Para confirmar, escribe el nombre completo del alumno: <span className="text-white font-bold">{student.fullName}</span>
               </label>
               <input 
                 type="text" 
                 value={confirmText}
                 onChange={e => setConfirmText(e.target.value)}
                 className="w-full bg-sys-input border border-sys-border rounded p-3 text-sm focus:border-red-500 outline-none text-center font-mono text-white"
                 placeholder="Escribe aquí..."
               />
            </div>

            <div className="flex flex-col gap-2 pt-2">
               <button 
                 disabled={deleting || confirmText.trim().toLowerCase() !== (student.fullName || '').trim().toLowerCase()}
                 onClick={handleDelete} 
                 className="w-full h-[48px] bg-red-500 text-white rounded-sm font-black uppercase tracking-widest text-xs disabled:opacity-30 transition-all hover:bg-red-600 shadow-xl shadow-red-500/20 flex items-center justify-center gap-2"
               >
                 {deleting ? <Loader2 size={16} className="animate-spin" /> : 'Eliminar definitivamente'}
               </button>
               <button 
                 disabled={deleting}
                 onClick={() => {
                   setShowDeleteModal(false);
                   setDeleteError('');
                 }} 
                 className="w-full py-3 text-sys-text-mut hover:text-white transition-colors text-xs font-black uppercase tracking-widest disabled:opacity-50"
               >
                 Cancelar
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

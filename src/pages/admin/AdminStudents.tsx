import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Search, Download, FileText, CheckCircle, Trash2, Shield, AlertTriangle, Check, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { downloadCSV } from '../../lib/csv';
import { formatDate, formatIso, parseDate } from '../../lib/dateUtils';
import { useAuth } from '../../components/AuthProvider';
import { logActivity, deleteStudent } from '../../lib/db';
import { toast } from 'react-hot-toast';

export default function AdminStudents() {
  const { profile: currentAdmin, isAdmin, isSuperAdmin } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState<any>(null); // { type: 'single' | 'bulk', data: any }
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    // We use real-time listeners for students list
    const q = query(collection(db, 'users'), where('role', 'in', ['student', 'user']));
    const unsubscribe = onSnapshot(q, async (snap) => {
      try {
        const diagsSnap = await getDocs(collection(db, 'diagnostics'));
        const diagMap = new Map();
        diagsSnap.forEach(d => diagMap.set(d.data().userId, d.data()));

        const studentData: any[] = [];
        snap.forEach(u => {
          const user = { id: u.id, ...u.data() };
          const diag = diagMap.get(user.id);
          
          // Calculate percentage progress
          let progressPct = 0;
          if (diag) {
            if (diag.status === 'completed') {
              progressPct = 100;
            } else if (diag.responses) {
              // Count blocks answered (1-8)
              const answeredBlocks = new Set();
              Object.keys(diag.responses).forEach(key => {
                const blockMatch = key.match(/^block(\d+)/);
                if (blockMatch) answeredBlocks.add(blockMatch[1]);
              });
              progressPct = Math.round((answeredBlocks.size / 8) * 100);
            }
          }

          studentData.push({
            ...user,
            diagnosticData: diag,
            progressPct,
            diagnosticStatus: diag ? diag.status : 'not_started',
            profile: diag ? diag.result?.primaryProfile : null,
          });
        });
        
        studentData.sort((a,b) => (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0));
        setStudents(studentData);
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'diagnostics');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  const handleExport = () => {
    const headers = [
      'nombre', 'email', 'país', 'fecha_registro', 'progreso_pct', 'estado', 'perfil_predominante'
    ];
    
    const data = students.map(s => [
      s.fullName, 
      s.email, 
      s.country || '', 
      s.createdAt ? formatIso(s.createdAt) : '',
      s.progressPct + '%',
      s.diagnosticStatus,
      s.profile || ''
    ]);

    downloadCSV('systeam_alumnos.csv', headers, data);
  };

  const executeDelete = async () => {
    const expectedConfirmText = showDeleteModal.type === 'bulk' ? `ELIMINAR ${selectedIds.length}` : 'ELIMINAR';
    if (confirmText !== expectedConfirmText) {
      return;
    }

    try {
      if (showDeleteModal.type === 'single') {
        const student = showDeleteModal.data;
        await deleteStudent(student.id);
        await logActivity({
          action: 'delete_student',
          executorId: currentAdmin?.uid || 'unknown',
          executorName: currentAdmin?.fullName || 'Admin',
          executorEmail: currentAdmin?.email || '',
          targetId: student.id,
          targetEmail: student.email
        });
      } else {
        // Bulk delete
        for (const id of selectedIds) {
          const student = students.find(s => s.id === id);
          await deleteStudent(id);
          if (student) {
            await logActivity({
              action: 'delete_student',
              executorId: currentAdmin?.uid || 'unknown',
              executorName: currentAdmin?.fullName || 'Admin',
              executorEmail: currentAdmin?.email || '',
              targetId: id,
              targetEmail: student.email
            });
          }
        }
        setSelectedIds([]);
      }
      toast.success('Alumno(s) eliminado(s) permanentemente');
      setShowDeleteModal(null);
      setConfirmText('');
    } catch (error) {
      console.error(error);
      toast.error('Error al realizar la eliminación');
    }
  };

  const filteredStudents = students.filter(s => (s.fullName + s.email).toLowerCase().includes(search.toLowerCase()));

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStudents.map(s => s.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-sans">Alumnos registrados</h1>
        <button onClick={handleExport} className="btn-geometric-secondary border-sys-border flex items-center gap-2 py-2 px-4 shadow-none">
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      {selectedIds.length > 0 && isAdmin && (
        <div className="sticky top-4 z-40 bg-red-600 shadow-2xl p-4 rounded-sm flex items-center justify-between text-white animate-in slide-in-from-top-4">
          <div className="font-black uppercase tracking-widest text-xs flex items-center gap-2">
            <span className="bg-white text-red-600 px-2 py-1 rounded">{selectedIds.length}</span>
            Alumnos seleccionados
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSelectedIds([])} className="px-4 py-2 border border-white/20 hover:bg-white/10 rounded-sm text-xs font-bold uppercase transition-colors">
              Cancelar
            </button>
            <button 
              onClick={() => {
                setShowDeleteModal({ type: 'bulk', data: null });
                setConfirmText('');
              }}
              className="px-4 py-2 bg-white text-red-600 hover:bg-white/90 rounded-sm text-xs font-black uppercase flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
            >
              <Trash2 size={14} /> Eliminar permanentemente
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
                 className="w-full bg-sys-input border border-sys-border rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-sys-accent text-sys-text-main placeholder:text-sys-text-mut"
                 value={search}
                 onChange={e => setSearch(e.target.value)}
               />
             </div>
          </div>
          
          <div className="overflow-x-auto">
             <table className="w-full text-left text-sm whitespace-nowrap">
               <thead className="bg-sys-input/50 text-sys-text-sec text-[10px] uppercase font-black tracking-widest">
                 <tr>
                   <th className="px-6 py-3">
                     <button onClick={toggleSelectAll} className="w-5 h-5 rounded border border-sys-border flex items-center justify-center bg-sys-bg text-sys-accent transition-colors hover:border-sys-accent">
                        {selectedIds.length === filteredStudents.length && filteredStudents.length > 0 && <Check size={14} />}
                     </button>
                   </th>
                   <th className="px-6 py-3">Alumno</th>
                   <th className="px-6 py-3">Progreso</th>
                   <th className="px-6 py-3">Estado</th>
                   <th className="px-6 py-3">Perfil</th>
                   <th className="px-6 py-3">Registro</th>
                   <th className="px-6 py-3"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-sys-border">
                  {filteredStudents.map(student => {
                    const isSelected = selectedIds.includes(student.id);
                    return (
                    <tr key={student.id} className={`hover:bg-sys-input/30 group transition-colors ${isSelected ? 'bg-red-500/5' : ''}`}>
                      <td className="px-6 py-4">
                        <button onClick={() => toggleSelect(student.id)} className={`w-5 h-5 rounded border transition-colors flex items-center justify-center ${isSelected ? 'bg-red-600 border-red-600 text-white' : 'border-sys-border bg-sys-bg text-transparent hover:border-red-600'}`}>
                            <Check size={14} />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 text-left">
                           <div className="w-8 h-8 rounded-full bg-sys-accent/20 text-sys-accent flex items-center justify-center font-bold text-xs uppercase border border-sys-accent/10">
                             {(student.fullName || 'NN').substring(0,2)}
                           </div>
                           <div>
                             <div className="font-bold flex items-center gap-2">
                               {student.fullName}
                               {student.isSystemUser && <Shield size={12} className="text-sys-accent" />}
                             </div>
                             <div className="text-xs text-sys-text-mut">{student.email}</div>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3 min-w-[120px]">
                          <div className="flex-1 bg-sys-input h-1 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${student.progressPct === 100 ? 'bg-green-500' : 'bg-sys-accent'}`} 
                              style={{ width: `${student.progressPct}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-black w-8 text-right ${student.progressPct === 100 ? 'text-green-500' : 'text-sys-text-sec'}`}>
                            {student.progressPct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          student.diagnosticStatus === 'completed' ? 'bg-green-500/10 text-green-500' :
                          student.diagnosticStatus === 'in_progress' ? 'bg-sys-accent/10 text-sys-accent' :
                          'bg-gray-500/10 text-gray-400'
                        }`}>
                          {student.diagnosticStatus === 'completed' ? 'COMPLETADO' : student.diagnosticStatus === 'in_progress' ? 'EN PROGRESO' : 'NO INICIADO'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                         {student.profile ? (
                           <span className="px-2 py-1 bg-sys-input/50 border border-sys-border rounded-sm text-[10px] font-bold uppercase text-sys-text-sec">
                             {student.profile}
                           </span>
                         ) : <span className="text-sys-text-mut">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sys-text-mut text-xs">
                         {formatDate(student.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex items-center justify-end gap-2">
                            <Link to={`/admin/students/${student.id}`} className="text-sys-bg bg-sys-text-sec hover:bg-sys-text-main py-1.5 px-4 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all">
                                Ver ficha
                            </Link>
                            {isAdmin && (
                              <button 
                                onClick={() => {
                                  setShowDeleteModal({ type: 'single', data: student });
                                  setConfirmText('');
                                }}
                                className="p-2 text-sys-text-mut hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                         </div>
                      </td>
                    </tr>
                   )})}
               </tbody>
             </table>
          </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-sys-bg border border-sys-border p-8 rounded-xl w-full max-w-lg card-geometric relative space-y-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center shrink-0">
                <Trash2 size={24} />
              </div>
              <h2 className="text-xl font-bold font-sans uppercase tracking-tight text-white line-height-1">
                {showDeleteModal.type === 'bulk' ? `¿Eliminar ${selectedIds.length} alumnos?` : '¿Eliminar alumno?'}
              </h2>
              <p className="text-sm text-sys-text-sec leading-relaxed">
                {showDeleteModal.type === 'single' 
                  ? `Se eliminará permanentemente a ${showDeleteModal.data.fullName} y todos sus datos de diagnóstico.` 
                  : `Se eliminarán permanentemente ${selectedIds.length} alumnos. Esta acción no se puede deshacer.`}
              </p>
            </div>

            <div className="space-y-3">
               <label className="block text-xs font-black uppercase tracking-widest text-sys-text-mut text-center">
                 Para confirmar, escribe <span className="text-white">{"ELIMINAR" + (showDeleteModal.type === 'bulk' ? ` ${selectedIds.length}` : '')}</span>
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
                 disabled={confirmText !== ('ELIMINAR' + (showDeleteModal.type === 'bulk' ? ` ${selectedIds.length}` : ''))}
                 onClick={executeDelete} 
                 className="w-full bg-red-500 text-white py-4 rounded-sm font-black uppercase tracking-widest text-xs disabled:opacity-30 transition-all hover:bg-red-600 shadow-xl shadow-red-500/20"
               >
                 Confirmar eliminación permanente
               </button>
               <button onClick={() => setShowDeleteModal(null)} className="w-full py-3 text-sys-text-mut hover:text-white transition-colors text-xs font-black uppercase tracking-widest">
                 Cancelar
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

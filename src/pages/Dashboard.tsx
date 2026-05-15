import { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { Diagnosis } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Circle, Clock, ChevronRight, BarChart3, ArrowUpRight, AlertTriangle, Lock as LockIcon } from 'lucide-react';
import { fetchDiagnosis, saveDiagnosisDebounced, updateUserDiagnosisStatus } from '../lib/db';

const BLOCKS = [
  { id: 1, name: 'Punto de Partida' },
  { id: 2, name: 'Biología del Experto' },
  { id: 3, name: 'Creencias Limitantes' },
  { id: 4, name: 'ADN de Marca' },
  { id: 5, name: 'Avatar Emocional' },
  { id: 6, name: 'Oferta y Promesa' },
  { id: 7, name: 'Comunicación' },
  { id: 8, name: 'Entorno y Sostén' }
];

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        const data = await fetchDiagnosis(user.uid);
        if (data) {
          let diag = data as Diagnosis;
          
          // MIGRACION: Fix diagnoses incorrectly marked as completed due to previous bug
          const hasAnalysis = diag.analysis?.perfil_predominante || (diag as any).results?.perfil_predominante || (diag as any).results?.profile_predominant;
          if (diag.status === 'completed' && !hasAnalysis) {
            diag.status = 'in_progress';
            await saveDiagnosisDebounced(user.uid, diag);
            await updateUserDiagnosisStatus(user.uid, 'in_progress');
          }
          
          setDiagnosis(diag);
        }
      } catch (err) {
        console.error("Error loading diagnosis", err);
      }
      setLoading(false);
    };

    loadData();
  }, [user]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-sys-bg">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sys-accent"></div>
    </div>
  );

  const isCompleted = diagnosis?.status === 'completed';
  const progress = diagnosis?.progress || 0;
  
  const completedBlocks = Object.keys(diagnosis?.answers || {}).filter(k => k.startsWith('block_') && k !== 'block_0' && k !== 'block_9').length;
  
  const completedDate = diagnosis?.completedAt ? new Date(diagnosis.completedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  const handleStartProcess = async () => {
    if (!user) return;
    let currentDiag = diagnosis;
    if (!currentDiag) {
      currentDiag = {
        uid: user.uid,
        userEmail: profile?.email || user.email || '',
        userName: profile?.fullName || '',
        status: 'in_progress',
        progress: 0,
        currentBlock: 0,
        answers: {},
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Diagnosis;
      await saveDiagnosisDebounced(user.uid, currentDiag);
      await updateUserDiagnosisStatus(user.uid, 'in_progress');
      setDiagnosis(currentDiag);
    }
    
    // Crucial: Set localStorage so DiagnosisFlow picks it up
    localStorage.setItem('systeam_diagnosis', JSON.stringify(currentDiag));
    navigate(`/bloque/${currentDiag.currentBlock || 0}`);
  };

  const handleRestart = async () => {
    if (!user) return;
    const newData = {
      uid: user.uid,
      userEmail: profile?.email || user.email || '',
      userName: profile?.fullName || '',
      answers: {},
      progress: 0,
      status: 'in_progress',
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentBlock: 1
    } as Diagnosis;
    await saveDiagnosisDebounced(user.uid, newData);
    await updateUserDiagnosisStatus(user.uid, 'in_progress');
    setDiagnosis(newData);
    localStorage.setItem('systeam_diagnosis', JSON.stringify(newData));
    setShowRestartConfirm(false);
    navigate('/bloque/1');
  };


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 relative z-10">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] font-black text-amber-500 mb-2">
            {isCompleted ? (completedDate ? `Tu diagnóstico — Completado el ${completedDate}` : 'Tu diagnóstico — Completado') : 'Tu diagnóstico — En progreso'}
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white uppercase font-sans">
            Hola{profile?.fullName ? <>, <span className="text-amber-500">{profile.fullName.split(' ')[0]}</span></> : ''}
          </h1>
        </div>
        <div className="text-slate-500 text-sm max-w-sm flex flex-col items-end gap-2">
          {!isCompleted && (
            <p className="text-right font-medium text-slate-400">Bienvenido a la Incubadora SysTeam. Completa los 8 bloques para recibir tu diagnóstico.</p>
          )}
          <button onClick={() => setShowRestartConfirm(true)} className="text-[10px] text-rose-500 hover:text-rose-400 uppercase font-bold tracking-widest transition-colors py-1">
             Reiniciar diagnóstico (Borrar todo)
          </button>
        </div>
      </header>

      {isCompleted && (
        <div className="mb-12 bg-amber-500/10 border border-amber-500/20 p-6 md:p-8 rounded-sm flex flex-col md:flex-row items-center gap-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
          <div className="w-12 h-12 bg-amber-500 rounded-[8px] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
            <LockIcon size={24} className="text-slate-950" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <p className="text-amber-200 font-medium text-base">
              Tu diagnóstico fue enviado el <span className="text-amber-400 font-bold">{completedDate}</span>. Puedes consultar tus respuestas pero ya no son editables.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/results" className="btn-geometric-primary shrink-0 py-3 px-8 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.3)] text-center">
              Ver mis resultados
            </Link>
            <Link to="/results" className="shrink-0 py-3 px-6 bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors rounded-sm text-center">
              Descargar mi ficha en PDF
            </Link>
          </div>
        </div>
      )}

      {/* Main Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        <div className="lg:col-span-2 card-geometric p-8 md:p-12 bg-slate-900/60 relative overflow-hidden group shadow-xl border-slate-800 backdrop-blur-sm">
          <div className="absolute -right-16 -bottom-16 opacity-5 group-hover:opacity-10 transition-all duration-700 text-amber-500">
            <BarChart3 size={400} />
          </div>
          
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-10">
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em]">Estado del Diagnóstico ({completedBlocks} de 8 bloques)</span>
                <h2 className="text-7xl md:text-8xl font-black text-white">{progress}<span className="text-amber-500 text-4xl md:text-5xl">%</span></h2>
              </div>
              
              {!isCompleted ? (
                 <button 
                  onClick={() => {
                    if (progress >= 100) navigate('/bloque/9');
                    else handleStartProcess();
                  }}
                  className={`btn-geometric-primary flex items-center gap-3 py-4 px-10 group text-[#0A0A0A] font-black tracking-wide border-none transition-all ${
                    progress >= 100 
                      ? 'bg-amber-400 hover:bg-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.4)] hover:shadow-[0_0_30px_rgba(251,191,36,0.6)]' 
                      : 'bg-sys-accent hover:bg-sys-accent-hover shadow-[0_0_20px_rgba(201,169,97,0.2)] hover:shadow-[0_0_30px_rgba(201,169,97,0.4)]'
                  }`}
                >
                  {progress >= 100 
                    ? 'Enviar diagnóstico final' 
                    : diagnosis?.currentBlock === 0 || !diagnosis?.currentBlock 
                      ? 'Iniciar proceso' 
                      : 'Continuar diagnóstico'}
                  <ArrowUpRight size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </button>
              ) : (
                <Link to="/results" className="btn-geometric-primary py-4 px-10 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black tracking-wide flex items-center gap-3 border-none shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  Ver mis resultados
                  <ChevronRight size={18} />
                </Link>
              )}
            </div>
            
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="bg-amber-500 h-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"
              />
            </div>
          </div>
        </div>

        <div className="card-geometric p-8 bg-slate-900/60 flex flex-col justify-between border-slate-800 shadow-xl backdrop-blur-sm">
          <div>
            <h3 className="text-lg font-black mb-4 text-white uppercase tracking-tight">Instrucciones</h3>
            <ul className="space-y-4 mb-6">
              {[
                "Responde con total honestidad",
                "Tus respuestas se guardan solas",
                "Puedes pausar y retomar luego",
                "Al finalizar, recibirás tu análisis"
              ].map((text, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-300 items-start font-medium">
                  <div className="w-5 h-5 rounded-full border border-slate-700 bg-slate-900 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-slate-400">
                    {i+1}
                  </div>
                  {text}
                </li>
              ))}
            </ul>
            <div className="bg-sys-info/10 border border-sys-info/20 p-4 rounded-[8px]">
              <p className="text-xs text-sys-info leading-relaxed font-medium">
                <span className="font-bold mr-1">💡 Tip:</span> Puedes responder por voz. En cada pregunta verás un ícono de micrófono. Tócalo y habla con naturalidad. Tus palabras se transcribirán.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de bloques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {BLOCKS.map((block) => {
          const blockAnswers = diagnosis?.answers?.[`block_${block.id}`];
          const isBlockCompleted = blockAnswers && Object.keys(blockAnswers).length > 0;
          
          return (
            <Link 
              key={block.id}
              to={`/bloque/${block.id}`}
              title={isCompleted ? "Diagnóstico ya enviado. Solo lectura." : isBlockCompleted ? "Ya respondiste este bloque. Puedes modificarlo si quieres." : ""}
              className={`p-6 border transition-all flex flex-col justify-between h-48 rounded-sm group relative ${
                isCompleted 
                ? 'bg-slate-900 border-slate-800 shadow-md opacity-85' 
                : isBlockCompleted 
                  ? 'bg-slate-900/60 border-amber-500/30 hover:border-amber-500/50 hover:bg-slate-800/80 shadow-md' 
                  : 'bg-slate-900/40 border-slate-800 hover:border-amber-500/50 hover:bg-slate-900 shadow-md'
              }`}
            >
              {isCompleted && (
                <div className="absolute top-2 right-2 text-slate-700">
                  <LockIcon size={12} />
                </div>
              )}
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isBlockCompleted ? 'text-amber-500' : 'text-slate-500'}`}>
                  {isBlockCompleted ? '✓ Completado' : `Bloque ${block.id}`}
                </p>
                <h3 className="font-bold text-lg leading-tight uppercase font-sans text-slate-200 group-hover:text-white transition-colors">{block.name}</h3>
              </div>
              
              <div className="flex items-center justify-between mt-4">
                {isBlockCompleted ? (
                   <CheckCircle2 size={18} className={isCompleted ? 'text-slate-600' : 'text-amber-500'} />
                ) : (
                   <Circle size={18} className="text-slate-700 group-hover:text-amber-500/50 transition-colors" />
                )}
                <div className={`text-[10px] uppercase font-bold tracking-tighter px-2 py-1 rounded-sm border ${
                  isCompleted 
                    ? 'border-slate-800 text-slate-500 group-hover:border-slate-700 group-hover:text-slate-400'
                    : isBlockCompleted
                      ? 'border-amber-500/30 text-amber-500 group-hover:border-amber-500' 
                      : 'border-slate-800 text-slate-600 group-hover:border-amber-500/50 group-hover:text-amber-500'
                }`}>
                  {isCompleted ? 'Ver respuestas' : isBlockCompleted ? 'Modificar respuestas' : 'Continuar'}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {isCompleted && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-12 card-geometric p-8 bg-amber-500/5 border-amber-500/20 flex flex-col md:flex-row items-center gap-8 shadow-xl"
        >
          <div className="w-16 h-16 bg-amber-500 rounded-sm rotate-45 flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
            <Clock size={24} className="text-slate-950 -rotate-45" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-2xl font-black mb-2 uppercase tracking-tight text-white">Diagnóstico Procesado</h3>
            <p className="text-slate-300 font-medium">
              Tu análisis estratégico completo ya está disponible. No vamos a construir una marca desde la urgencia, la copia o el miedo. Vamos a construir desde tu identidad real.
            </p>
          </div>
          <Link to="/results" className="btn-geometric-primary shrink-0 w-full md:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 border-none font-black tracking-wide shadow-[0_0_20px_rgba(245,158,11,0.3)]">
            Ver Análisis
          </Link>
        </motion.div>
      )}

      {/* Restart Confirmation Modal */}
      <AnimatePresence>
        {showRestartConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-sm shadow-2xl overflow-hidden"
            >
              <div className="p-6 sm:p-8">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-6 text-rose-500 mx-auto">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="text-xl font-black uppercase text-white text-center mb-4 tracking-tight">
                  ¿Reiniciar Diagnóstico?
                </h3>
                <p className="text-slate-300 text-sm text-center font-medium leading-relaxed mb-8">
                  Esta es una versión de prueba. Tus respuestas se guardan solo en este navegador. <strong className="text-rose-400 font-bold">Si reinicias, perderás todo el progreso actual de forma permanente.</strong>
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={() => setShowRestartConfirm(false)}
                    className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-widest rounded-sm transition-colors border border-slate-700"
                  >
                    Mantener Progreso
                  </button>
                  <button 
                    onClick={handleRestart}
                    className="flex-1 py-3 px-4 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold uppercase tracking-widest rounded-sm transition-colors shadow-[0_0_15px_rgba(243,24,103,0.3)]"
                  >
                    Sí, Borrar Todo
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

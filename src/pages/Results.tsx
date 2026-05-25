import { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { Diagnosis } from '../types';
import { ShieldCheck, Target, CheckCircle2, ChevronLeft, Printer, AlertTriangle, Lightbulb, RotateCcw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { DiagnosisReport } from '../components/DiagnosisReport';
import { ConfirmModal } from '../components/ConfirmModal';
import { toast } from 'react-hot-toast';

export default function Results() {
  const { user } = useAuth();
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<'redo' | 'regenerate' | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      // 1. Try local storage first
      const localData = localStorage.getItem('systeam_diagnosis');
      if (localData) {
        setDiagnosis(JSON.parse(localData) as Diagnosis);
        setLoading(false);
        return;
      }

      // 2. Try Firestore if local is empty
      try {
        const { fetchDiagnosis: fetchDbDiag } = await import('../lib/db');
        const dbData = await fetchDbDiag(user.uid);
        if (dbData) {
          const typedData = dbData as Diagnosis;
          setDiagnosis(typedData);
          localStorage.setItem('systeam_diagnosis', JSON.stringify(typedData));
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error("Error loading results from DB", err);
      }
      setLoading(false);
    };

    loadData();
  }, [user]);

  const handleRedoDiagnosis = () => {
    setConfirmAction('redo');
  };

  const executeRedoDiagnosis = async () => {
    setConfirmAction(null);
    if (!user) return;
    
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      try {
        await deleteDoc(doc(db, 'diagnostics', user.uid));
      } catch (err) {
      }

      const newData = {
        uid: user.uid,
        userEmail: user.email || '',
        userName: '',
        answers: {},
        progress: 0,
        status: 'in_progress' as const,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentBlock: 1
      } as Diagnosis;
      
      const { saveDiagnosisDebounced, updateUserDiagnosisStatus } = await import('../lib/db');
      await saveDiagnosisDebounced(user.uid, newData);
      await updateUserDiagnosisStatus(user.uid, 'in_progress');
      

      localStorage.setItem('systeam_diagnosis', JSON.stringify(newData));
      navigate('/bloque/1');
    } catch (err) {
      if (import.meta.env.DEV) console.error("Error restarting diagnosis:", err);
      toast.error("Hubo un error al reiniciar el diagnóstico.");
    }
  };

  const handleRegenerateAnalysis = () => {
    setConfirmAction('regenerate');
  };

  const executeRegenerateAnalysis = async () => {
    setConfirmAction(null);
    if (!user || !diagnosis) return;

    try {
      setLoading(true);
      const { calculateCapa1, calculateCapa2, extractTextAnswers } = await import('../lib/scoring');
      const { generateDiagnosisReasoning } = await import('../lib/gemini');

      const answersObj = diagnosis.answers || {};
      const scores = calculateCapa1(answersObj);
      const affinities = calculateCapa2(scores);
      const textualAnswers = extractTextAnswers(answersObj);

      const aiAnalysisData = await generateDiagnosisReasoning(scores, affinities, textualAnswers);

      const updatedData: Diagnosis = {
        ...diagnosis,
        analysis: aiAnalysisData,
        updatedAt: new Date().toISOString()
      };
      
      const { saveDiagnosisDebounced } = await import('../lib/db');
      await saveDiagnosisDebounced(user.uid, updatedData);
      
      localStorage.setItem('systeam_diagnosis', JSON.stringify(updatedData));
      setDiagnosis(updatedData);
      toast.success('Análisis regenerado con éxito');
    } catch (err: any) {
      if (import.meta.env.DEV) console.error("Error regenerating analysis:", err);
      toast.error("Hubo un error al regenerar el análisis: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    try {
      window.print();
    } catch (e) {
      toast.error('La función de impresión no está disponible en este entorno. Abre la app en una nueva pestaña usando el botón superior derecho de AI Studio.', {
        duration: 5000,
      });
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-slate-950">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
    </div>
  );

  if (!diagnosis || diagnosis.status !== 'completed') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 p-8 text-center text-slate-400">
        <h1 className="text-2xl font-bold mb-4 uppercase italic tracking-wide">Resultados no disponibles</h1>
        <p>Aún no has completado tu diagnóstico inicial.</p>
        <Link to="/dashboard" className="mt-8 px-8 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold uppercase tracking-wide rounded-sm transition-colors shadow-[0_0_15px_rgba(245,158,11,0.2)]">Volver al Panel</Link>
      </div>
    );
  }

  const ai = diagnosis.analysis;

  return (
    <div className="flex-1 bg-slate-950 overflow-y-auto print:bg-white print:text-black pb-24 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Print-only Logo Header */}
      <div className="hidden print:block mb-8 text-center border-b border-gray-200 pb-8 pt-8">
        <img 
          src="https://lh3.googleusercontent.com/d/1zXqu1TlWTrc2neVP2Vy62F703BUWHFvZ" 
          alt="SysTeam Logo" 
          className="h-20 object-contain mx-auto mb-4"
        />
        <h1 className="text-2xl font-black uppercase tracking-widest text-gray-900">REPORTE OFICIAL DE DIAGNÓSTICO</h1>
        <p className="text-sm text-gray-500 uppercase">SysTeam Latam Incubadora</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12 print:py-0 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-12 print:hidden gap-4">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
            <ChevronLeft size={16} />
            Volver al Panel
          </Link>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleRegenerateAnalysis}
              className="text-xs uppercase font-bold text-amber-500 hover:text-amber-400 flex items-center gap-2 py-2 px-3 border border-amber-500/30 hover:bg-amber-500/10 rounded-sm transition-colors"
            >
              <RotateCcw size={14} /> Regenerar Análisis (IA)
            </button>
            <button 
              onClick={handleRedoDiagnosis}
              className="text-xs uppercase font-bold text-rose-500 hover:text-rose-400 flex items-center gap-2 py-2 px-3 border border-rose-500/30 hover:bg-rose-500/10 rounded-sm transition-colors"
            >
              <RotateCcw size={14} /> Rehacer Diagnóstico
            </button>
            <button 
              onClick={handleExportPDF} 
              className="btn-geometric-secondary text-xs flex items-center gap-2 py-2 border-slate-700 hover:border-amber-500 hover:text-amber-500"
            >
              <Printer size={16} /> Exportar PDF
            </button>
          </div>
        </div>

        <header className="mb-12">
          <div className="text-[10px] uppercase tracking-[0.3em] font-black text-emerald-500 mb-4 flex items-center gap-2 print:text-emerald-700">
            <CheckCircle2 size={14} /> DIAGNÓSTICO ENVIADO A ADMINISTRACIÓN
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white print:text-black uppercase font-sans mb-6">
            Síntesis <span className="text-amber-500 print:text-amber-600">Estratégica</span>
          </h1>
        </header>

        {ai ? (
          <DiagnosisReport diagnosis={diagnosis} />
        ) : (
          <div className="card-geometric p-12 text-center bg-slate-900/40 print:hidden border border-slate-800">
            <div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-amber-500 animate-spin mx-auto mb-6"></div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Procesando Información...</p>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmAction === 'redo'}
        title="Rehacer Diagnóstico"
        message="¿Estás seguro de que deseas borrar este análisis por completo e iniciar de nuevo? Esta acción eliminará todas tus respuestas y no se puede deshacer."
        confirmText="Rehacer"
        isDestructive={true}
        onConfirm={executeRedoDiagnosis}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmModal
        isOpen={confirmAction === 'regenerate'}
        title="Regenerar Análisis"
        message="¿Estás seguro de que deseas regenerar el análisis? Esto usará tus respuestas guardadas y creará un nuevo diagnóstico final."
        confirmText="Regenerar"
        onConfirm={executeRegenerateAnalysis}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

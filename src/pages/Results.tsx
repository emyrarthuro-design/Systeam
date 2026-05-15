import { useEffect, useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { Diagnosis } from '../types';
import { ShieldCheck, Target, CheckCircle2, ChevronLeft, Printer, AlertTriangle, Lightbulb, RotateCcw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

export default function Results() {
  const { user } = useAuth();
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(true);
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
        console.error("Error loading results from DB", err);
      }
      setLoading(false);
    };

    loadData();
  }, [user]);

  const handleRedoDiagnosis = () => {
    if (!user) return;
    if (window.confirm("¿Estás seguro de que deseas borrar este análisis por completo e iniciar de nuevo? Esta acción eliminará todas tus respuestas y no se puede deshacer.")) {
      try {
        const newData = {
          uid: user.uid,
          answers: {},
          progress: 0,
          status: 'not_started' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          currentBlock: 1
        };
        localStorage.setItem('systeam_diagnosis', JSON.stringify(newData));
        navigate('/diagnosis/1');
      } catch (err) {
        console.error("Error restarting diagnosis:", err);
        alert("Hubo un error al reiniciar el diagnóstico.");
      }
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
  
  // Transform scores for the radar chart
  const radarData = ai?.variables_scores ? [
    { subject: 'Autoridad (AE)', A: ai.variables_scores.AE, fullMark: 5 },
    { subject: 'Seguridad (SE)', A: ai.variables_scores.SE, fullMark: 5 },
    { subject: 'Claridad Identidad (CI)', A: ai.variables_scores.CI, fullMark: 5 },
    { subject: 'Claridad Avatar (CA)', A: ai.variables_scores.CA, fullMark: 5 },
    { subject: 'Claridad Oferta (CO)', A: ai.variables_scores.CO, fullMark: 5 },
    { subject: 'Comunicación (CC)', A: ai.variables_scores.CC, fullMark: 5 },
    { subject: 'Sistema Ventas (SV)', A: ai.variables_scores.SV, fullMark: 5 },
    { subject: 'Sostén (ES)', A: ai.variables_scores.ES, fullMark: 5 },
  ] : [];

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
              onClick={handleRedoDiagnosis}
              className="text-xs uppercase font-bold text-rose-500 hover:text-rose-400 flex items-center gap-2 py-2 px-3 border border-rose-500/30 hover:bg-rose-500/10 rounded-sm transition-colors"
            >
              <RotateCcw size={14} /> Rehacer Diagnóstico
            </button>
            <button 
              onClick={() => window.print()} 
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
          <div className="space-y-12">
            
            {/* Perfil Header */}
            <div className="card-geometric p-8 md:p-12 bg-slate-900/40 relative overflow-hidden print:bg-white print:border-gray-200 print:shadow-none border border-slate-800">
              <div className="absolute top-0 right-0 p-8 opacity-5 print:hidden text-amber-500">
                <ShieldCheck size={200} />
              </div>
              <div className="text-[10px] text-amber-500 tracking-[0.2em] uppercase font-bold mb-2">Perfil Predominante</div>
              <div className="flex items-end gap-4 mb-4 flex-wrap">
                <h2 className="text-4xl font-black uppercase text-white print:text-black tracking-tight relative z-10">{ai.perfil_predominante}</h2>
                <div className="text-xl text-amber-400/80 font-mono mb-1 relative z-10">{ai.afinidad_predominante}% Afinidad</div>
              </div>
              
              {ai.perfil_secundario && (
                <div className="text-sm text-slate-400 font-medium relative z-10">
                  Componente secundario detectado: <span className="text-white">{ai.perfil_secundario}</span>
                </div>
              )}

              {ai.devolucion_personalizada && (
                <div className="mt-8 pt-8 border-t border-slate-800 print:border-gray-200 relative z-10">
                  <p className="text-slate-300 print:text-gray-800 leading-relaxed font-serif text-lg whitespace-pre-wrap">
                    {ai.devolucion_personalizada}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Radar Chart */}
              <div className="card-geometric p-8 bg-slate-900/40 print:bg-white print:border-gray-200 print:shadow-none border border-slate-800 flex flex-col min-h-[400px]">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">Radar de Variables</h3>
                <div className="flex-1 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="90%" minHeight={250}>
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: '#475569' }} tickCount={6} />
                      <Radar name="Alumno" dataKey="A" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bloqueo y Oportunidad */}
              <div className="space-y-8">
                <div className="card-geometric p-8 bg-slate-900/40 print:bg-white print:border-gray-200 print:shadow-none h-full border border-slate-800">
                  <div className="mb-8">
                     <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-500 mb-2 flex items-center gap-2">
                       <AlertTriangle size={14} /> Cuello de Botella Principal
                     </h3>
                     <p className="text-white print:text-black font-medium">{ai.bloqueo_principal || ai.razonamiento?.diagnostico_central}</p>
                  </div>
                  <div className="mb-8">
                     <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500 mb-2 flex items-center gap-2">
                       <Lightbulb size={14} /> Creencia Limitante Principal
                     </h3>
                     <p className="text-white print:text-black font-medium">{ai.creencia_limitante_principal}</p>
                  </div>
                  <div>
                     <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500 mb-2 flex items-center gap-2">
                       <Target size={14} /> Oportunidad o Siguiente Acción
                     </h3>
                     <p className="text-white print:text-black font-medium">{ai.oportunidad_principal || ai.primera_accion_sugerida}</p>
                  </div>
                  {ai.prioridad_incubadora && (
                    <div className="mt-8 pt-8 border-t border-slate-800 print:border-gray-200">
                       <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-500 mb-2">Prioridad para Incubadora</h3>
                       <p className="text-white print:text-black font-medium">{ai.prioridad_incubadora}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {ai.recomendaciones && ai.recomendaciones.length > 0 && (
              <div className="card-geometric p-8 md:p-12 bg-slate-900/40 print:bg-white print:border-gray-200 print:shadow-none border border-slate-800">
                <h3 className="text-xl font-black uppercase text-white print:text-black mb-6 tracking-tight flex items-center gap-3">
                  <div className="w-8 h-8 rounded-sm bg-emerald-500/10 border border-emerald-500/30 print:border-emerald-500 print:text-emerald-700 flex items-center justify-center text-emerald-500">
                    <Target size={16} />
                  </div>
                  Pasos de Acción Inmediata
                </h3>
                <ul className="space-y-4">
                  {ai.recomendaciones.map((rec: string, i: number) => (
                    <li key={i} className="flex gap-4 items-start">
                      <span className="text-amber-500 font-mono mt-0.5">0{i + 1}</span>
                      <p className="text-slate-300 print:text-black font-medium leading-relaxed">{rec}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Evidencias del Razonamiento */}
            {ai.razonamiento && ai.razonamiento.evidencias && ai.razonamiento.evidencias.length > 0 && (
              <div className="card-geometric p-8 md:p-12 bg-slate-900/40 print:bg-white print:border-gray-200 print:shadow-none border border-slate-800">
                <h3 className="text-xl font-black uppercase text-white print:text-black mb-6 tracking-tight flex items-center gap-3">
                  <div className="w-8 h-8 rounded-sm bg-amber-500/10 border border-amber-500/30 print:border-amber-500 print:text-amber-700 flex items-center justify-center text-amber-500 font-bold font-serif italic">?</div>
                  ¿Por qué este perfil?
                </h3>
                <p className="text-slate-400 mb-8">{ai.razonamiento.por_que_este_perfil_y_no_otro}</p>
                <div className="space-y-6">
                  {ai.razonamiento.evidencias.map((ev: any, i: number) => (
                    <div key={i} className="pl-6 border-l-2 border-slate-800 print:border-gray-200 relative">
                      <div className="absolute top-0 -left-[9px] w-4 h-4 rounded-full bg-slate-900 border-2 border-slate-800 print:bg-white print:border-gray-200 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                      </div>
                      <p className="text-sm text-slate-300 print:text-gray-800 mb-2">{ev.observacion}</p>
                      <div className="p-4 bg-slate-950/50 print:bg-gray-50 rounded-sm italic text-slate-500 print:text-gray-600 font-serif text-sm">
                        "{ev.cita_alumno}" <span className="text-[10px] text-amber-500 ml-2 not-italic font-mono">{ev.bloque}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="card-geometric p-12 text-center bg-slate-900/40 print:hidden border border-slate-800">
            <div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-amber-500 animate-spin mx-auto mb-6"></div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Procesando Información...</p>
          </div>
        )}
      </div>
    </div>
  );
}

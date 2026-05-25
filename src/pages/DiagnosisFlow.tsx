import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";
import { Diagnosis } from "../types";
import { DictationTextarea } from "../components/DictationTextarea";
import { DIAGNOSIS_STRUCTURE } from "../constants";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  Lock as LockIcon,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

const BLOCKS_NAV = [
  { id: 1, name: "Punto de Partida" },
  { id: 2, name: "Biología del Experto" },
  { id: 3, name: "Creencias Limitantes" },
  { id: 4, name: "ADN de Marca" },
  { id: 5, name: "Avatar Emocional" },
  { id: 6, name: "Oferta y Promesa" },
  { id: 7, name: "Comunicación" },
  { id: 8, name: "Entorno y Sostén" },
];

export default function DiagnosisFlow() {
  const { blockId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [localAnswers, setLocalAnswers] = useState<Record<string, any>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  const currentBlockIndex = parseInt(blockId || "0");
  const currentBlock = DIAGNOSIS_STRUCTURE.find(
    (b) => b.id === currentBlockIndex,
  );
  const isCompleted = diagnosis?.status === "completed";

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        const { fetchDiagnosis: fetchDbDiag } = await import("../lib/db");

        const [localDataStr, dbData] = await Promise.all([
          Promise.resolve(localStorage.getItem("systeam_diagnosis")),
          fetchDbDiag(user.uid).catch((err) => {
            if (import.meta.env.DEV) console.error("Error fetching from DB", err);
            return null;
          }),
        ]);

        let parsedLocal: Diagnosis | null = null;
        if (localDataStr) {
          try {
            parsedLocal = JSON.parse(localDataStr) as Diagnosis;
          } catch (e) {
            if (import.meta.env.DEV) console.error("Error parsing local data", e);
          }
        }

        let parsedDb = dbData as Diagnosis | null;
        let winner: Diagnosis | null = null;

        if (parsedLocal && parsedDb) {
          const localTime = new Date(parsedLocal.updatedAt || 0).getTime();
          const dbTime = new Date(parsedDb.updatedAt || 0).getTime();
          winner = localTime >= dbTime ? parsedLocal : parsedDb;
        } else {
          winner = parsedLocal || parsedDb;
        }

        if (winner) {
          const hasAnalysis =
            winner.analysis?.perfil_predominante ||
            (winner as any).results?.perfil_predominante ||
            (winner as any).results?.profile_predominant;
          if (winner.status === "completed" && !hasAnalysis) {
            winner.status = "in_progress";
            if (winner === parsedDb) {
              const { saveDiagnosisDebounced, updateUserDiagnosisStatus } =
                await import("../lib/db");
              await saveDiagnosisDebounced(user.uid, winner);
              await updateUserDiagnosisStatus(user.uid, "in_progress");
            }
          }

          setDiagnosis(winner);
          setLocalAnswers(winner.answers[`block_${currentBlockIndex}`] || {});
          localStorage.setItem("systeam_diagnosis", JSON.stringify(winner));
        } else {
          const newDiag: Diagnosis = {
            uid: user.uid,
            userEmail: profile?.email || user.email || "",
            userName: profile?.fullName || "",
            status: "in_progress",
            progress: 0,
            currentBlock: currentBlockIndex,
            answers: {},
            createdAt: new Date().toISOString(),
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setDiagnosis(newDiag);
          localStorage.setItem("systeam_diagnosis", JSON.stringify(newDiag));
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error("Error loading data", err);
      }
      setLoading(false);
    };

    loadData();
  }, [user, blockId, profile]);

  useEffect(() => {
    // If completed or analyzing, don't autosave
    if (!diagnosis || !user || loading || analyzing || isCompleted) return;

    const timer = setTimeout(async () => {
      // Autosave current localAnswers to the diagnosis object
      const updatedAnswers = {
        ...diagnosis.answers,
        [`block_${currentBlockIndex}`]: localAnswers,
      };

      const updatedDiagnosis: Diagnosis = {
        ...diagnosis,
        answers: updatedAnswers,
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem(
        "systeam_diagnosis",
        JSON.stringify(updatedDiagnosis),
      );

      const { saveDiagnosisDebounced } = await import("../lib/db");
      await saveDiagnosisDebounced(user.uid, updatedDiagnosis);
    }, 1000); // reduced to 1s as per request

    return () => clearTimeout(timer);
  }, [localAnswers]);

  useEffect(() => {
    if (analyzing) {
      const steps = 4;
      let currentStep = 0;
      const interval = setInterval(() => {
        currentStep++;
        if (currentStep >= steps) {
          clearInterval(interval);
        } else {
          setAnalysisStep(currentStep);
        }
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [analyzing]);

  const saveProgress = async (
    answers: Record<string, any>,
    nextBlock?: number,
  ) => {
    if (!user || !diagnosis || isCompleted) return;
    setSaving(true);

    const updatedAnswers = {
      ...diagnosis.answers,
      [`block_${currentBlockIndex}`]: answers,
    };

    const totalBlocks = 8;
    const completedBlocks = Object.keys(updatedAnswers).filter(
      (k) => k.startsWith("block_") && k !== "block_0" && k !== "block_9",
    ).length;
    const progress = Math.min(
      Math.round((completedBlocks / totalBlocks) * 100),
      100,
    );

    const updatedDiagnosis: Diagnosis = {
      ...diagnosis,
      answers: updatedAnswers,
      currentBlock: nextBlock !== undefined ? nextBlock : currentBlockIndex,
      progress: progress,
      status: "in_progress",
      updatedAt: new Date().toISOString(),
    };

    // Save locally
    localStorage.setItem("systeam_diagnosis", JSON.stringify(updatedDiagnosis));
    setDiagnosis(updatedDiagnosis);

    // Save to Firebase
    try {
      const { saveDiagnosisDebounced } = await import("../lib/db");
      await saveDiagnosisDebounced(user.uid, updatedDiagnosis);
    } catch (err) {
      if (import.meta.env.DEV) console.error("Error saving to Firebase:", err);
    }

    // Simulate slight delay for UX
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
  };

  const handleInputChange = (id: string, value: any, multiple?: boolean) => {
    if (isCompleted) return; // Prevent changes if completed

    if (multiple) {
      const currentValues = Array.isArray(localAnswers[id])
        ? localAnswers[id]
        : [];
      let newValues;
      if (currentValues.includes(value)) {
        newValues = currentValues.filter((v: any) => v !== value);
      } else {
        newValues = [...currentValues, value];
      }
      setLocalAnswers({ ...localAnswers, [id]: newValues });
    } else {
      setLocalAnswers({ ...localAnswers, [id]: value });
    }
  };

  const handleNext = async () => {
    if (currentBlockIndex === 9) {
      if (isCompleted) {
        navigate("/results");
        return;
      }
      setShowConfirmModal(true);
      return;
    }
    if (!isCompleted) {
      await saveProgress(localAnswers, currentBlockIndex + 1);
    }
    navigate(`/bloque/${currentBlockIndex + 1}`);
  };

  const finalizeDiagnosis = async () => {
    if (!user || !diagnosis || isCompleted) return;
    setShowConfirmModal(false);
    setAnalyzing(true);

    try {
      // Ensure we have the latest answers from block 9 included
      const updatedAnswers = {
        ...diagnosis.answers,
        [`block_${currentBlockIndex}`]: localAnswers,
      };

      const { calculateCapa1, calculateCapa2, extractTextAnswers } =
        await import("../lib/scoring");
      const { generateDiagnosisReasoning } = await import("../lib/gemini");

      const scores = calculateCapa1(updatedAnswers);
      const affinities = calculateCapa2(scores);
      const textualAnswers = extractTextAnswers(updatedAnswers);

      let aiAnalysisData;
      try {
        aiAnalysisData = await generateDiagnosisReasoning(
          scores,
          affinities,
          textualAnswers,
        );
      } catch (genErr) {
        if (import.meta.env.DEV) console.error("Error generating reasoning. Fallback to basic.", genErr);
        aiAnalysisData = {
          perfil_predominante: affinities[0]?.name || "No identificado",
          perfil_secundario:
            (affinities[1]?.affinity || 0) >= 45
              ? affinities[1].name
              : "Ninguno",
          afinidad_predominante: affinities[0]?.affinity || 0,
          razonamiento: {
            diagnostico_central:
              "Error al generar análisis cualitativo profundo. Revisa la configuración de API.",
            evidencias: [],
            contradicciones: [],
            por_que_este_perfil_y_no_otro: "",
          },
          variables_scores: scores,
          bloqueo_principal: "No identificado",
          oportunidad_principal: "Refinar sistema de respuesta",
          creencia_limitante_principal: "No identificada",
          prioridad_incubadora: "Revisar arquitectura base",
          primera_accion_sugerida: "Completar la ficha base manualmente",
          recomendaciones: [
            "Resolver la conexión con tu avatar",
            "Clarificar tu oferta",
            "Comenzar a documentar",
          ],
          devolucion_personalizada:
            "Basado en tu perfil cuantitativo, estás priorizando áreas técnicas. Necesitamos indagar cualitativamente en sesión.",
        };
      }

      const updatedDiagnosis: Diagnosis = {
        ...diagnosis,
        answers: updatedAnswers,
        progress: 100,
        status: "completed",
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        analysis: aiAnalysisData,
      };

      // Save locally
      localStorage.setItem(
        "systeam_diagnosis",
        JSON.stringify(updatedDiagnosis),
      );
      setDiagnosis(updatedDiagnosis);

      // Save to Firebase
      const { saveDiagnosisDebounced, updateUserDiagnosisStatus } =
        await import("../lib/db");
      await saveDiagnosisDebounced(user.uid, updatedDiagnosis);
      await updateUserDiagnosisStatus(user.uid, "completed");

      navigate(`/results`);
    } catch (err) {
      if (import.meta.env.DEV) console.error("Error completing diagnosis:", err);
      setAnalyzing(false);
      setAnalysisError(
        "Hubo un error al procesar el análisis. Por favor intenta de nuevo.",
      );
    }
  };

  const handleBack = () => {
    if (currentBlockIndex > 0) {
      navigate(`/bloque/${currentBlockIndex - 1}`);
    }
  };

  const handleNavigateBlock = (id: number) => {
    navigate(`/bloque/${id}`);
  };

  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );

  if (analyzing) {
    const messages = [
      "Interpretando variables maestras...",
      "Cruzando datos con patrones de éxito...",
      "Identificando bloqueos invisibles...",
      "Construyendo ruta de incubación...",
    ];
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 p-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-500/10 blur-[100px] rounded-full" />
        <div className="relative z-10 flex flex-col items-center max-w-sm w-full">
          <div className="relative w-24 h-24 mb-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              className="absolute inset-0 border-t-2 border-amber-500 rounded-full"
              style={{
                borderRightColor: "transparent",
                borderBottomColor: "transparent",
                borderLeftColor: "transparent",
              }}
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
              className="absolute inset-2 border-l-2 border-amber-400/50 rounded-full"
              style={{
                borderTopColor: "transparent",
                borderRightColor: "transparent",
                borderBottomColor: "transparent",
              }}
            />
            <div className="absolute inset-4 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <span className="text-amber-500 text-xs font-bold font-mono">
                {Math.min(analysisStep * 25 + 10, 99)}%
              </span>
            </div>
          </div>

          <div className="h-12 w-full text-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={analysisStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-slate-300 font-medium tracking-wide"
              >
                {messages[analysisStep] || "Finalizando..."}
              </motion.p>
            </AnimatePresence>
          </div>
          <p className="mt-8 text-[11px] text-slate-500 uppercase tracking-widest text-center">
            EL MOTOR DE SYSTEAM ESTÁ PROCESANDO TU INFORMACIÓN
          </p>
        </div>
      </div>
    );
  }

  const totalBlocks = 8;
  const completedBlocksCount = Object.keys(diagnosis?.answers || {}).filter(
    (k) => k.startsWith("block_") && k !== "block_0" && k !== "block_9",
  ).length;
  const currentProgress = Math.min(
    Math.round((completedBlocksCount / totalBlocks) * 100),
    100,
  );

  if (!currentBlock) return <div>Bloque no encontrado</div>;

  const visibleQuestions = currentBlock.questions.filter((q) => {
    if (!q.condition) return true;
    const answer = localAnswers[q.condition.field];
    if (Array.isArray(q.condition.value)) {
      return q.condition.value.includes(answer);
    }
    return answer === q.condition.value;
  });

  return (
    <>
      {analysisError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-6 py-4 rounded-sm shadow-2xl backdrop-blur-md max-w-md w-full mx-4">
          <AlertTriangle size={18} className="shrink-0" />
          <span className="text-sm font-bold">{analysisError}</span>
          <button
            onClick={() => setAnalysisError("")}
            className="ml-auto text-red-400 hover:text-white transition-colors font-black"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex-1 flex overflow-hidden h-[calc(100vh-64px)]">
        {/* Sidebar navigation */}
        <aside className="w-72 border-r border-slate-800 bg-slate-900/30 hidden lg:flex flex-col">
          <div className="p-6 flex-1 overflow-y-auto">
            <ul className="space-y-1">
              <li
                onClick={() => handleNavigateBlock(0)}
                className={`flex items-center gap-3 p-3 rounded-r-md group transition-all cursor-pointer ${currentBlockIndex === 0 ? "bg-amber-500/10 border-l-2 border-amber-500" : "opacity-60 hover:opacity-100"}`}
              >
                <div
                  className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold ${currentBlockIndex === 0 ? "border-amber-500 text-amber-500" : "border-slate-600"}`}
                >
                  00
                </div>
                <span
                  className={`text-sm font-semibold ${currentBlockIndex === 0 ? "text-white" : ""}`}
                >
                  Bienvenida
                </span>
              </li>
              {BLOCKS_NAV.map((block) => {
                const blockAnswers = diagnosis?.answers?.[`block_${block.id}`];
                const isBlockCompleted =
                  blockAnswers && Object.keys(blockAnswers).length > 0;
                const isActive = currentBlockIndex === block.id;

                return (
                  <li
                    key={block.id}
                    onClick={() => handleNavigateBlock(block.id)}
                    title={
                      isCompleted
                        ? "Diagnóstico ya enviado. Solo lectura."
                        : isBlockCompleted
                          ? "Ya respondiste este bloque. Puedes modificarlo si quieres."
                          : ""
                    }
                    className={`flex items-center gap-3 p-3 rounded-r-md group transition-all cursor-pointer ${
                      isActive
                        ? "bg-amber-500/10 border-l-2 border-amber-500"
                        : isBlockCompleted
                          ? "opacity-100"
                          : "opacity-40 hover:opacity-100"
                    }`}
                  >
                    <div
                      className={`relative w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold transition-colors ${
                        isActive
                          ? "border-amber-500 text-amber-500"
                          : isBlockCompleted
                            ? "border-amber-500 text-amber-500"
                            : "border-slate-600"
                      }`}
                    >
                      {isBlockCompleted && !isActive ? (
                        <CheckCircle2 size={10} />
                      ) : (
                        block.id.toString().padStart(2, "0")
                      )}
                      {isCompleted && isBlockCompleted && (
                        <div className="absolute -bottom-1 -right-1 bg-slate-950 rounded-full">
                          <LockIcon size={8} className="text-slate-500" />
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-sm font-medium ${isActive ? "text-white font-semibold" : ""}`}
                    >
                      {block.name}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="p-6 border-t border-slate-800 text-[10px] text-slate-500 tracking-wider leading-relaxed">
            SISTEMA DE DIAGNÓSTICO ESTRATÉGICO v2.4
            <br />
            SYSTEAM LATAM © 2026
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 bg-slate-950 overflow-hidden flex flex-col pt-0 relative">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-900 z-10 hidden lg:block">
            <motion.div
              className="h-full bg-amber-500 rounded-r-full"
              initial={{ width: 0 }}
              animate={{ width: `${currentProgress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          {/* Mobile progress header */}
          <div className="lg:hidden bg-slate-900 border-b border-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-black uppercase tracking-widest">
                Progreso
              </span>
              <span className="text-xs text-amber-500 font-black">
                {currentProgress}%
              </span>
            </div>
            <div className="h-1.5 bg-slate-800 w-full rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-amber-500"
                initial={{ width: 0 }}
                animate={{ width: `${currentProgress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-12 pt-0 pb-20">
            <div className="max-w-3xl mx-auto py-8 md:py-12">
              <div className="flex items-center justify-between mb-8 lg:mb-12">
                <div className="hidden lg:flex items-center gap-4">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest border border-slate-800 px-3 py-1 rounded-full">
                    {completedBlocksCount} de 8 bloques completados
                  </span>
                  <span className="text-[10px] text-amber-500 uppercase font-black tracking-widest">
                    {currentProgress}% completado
                  </span>
                </div>
              </div>

              {isCompleted && (
                <div className="mb-10 bg-amber-500/10 border border-amber-500/20 p-4 rounded-sm flex items-center gap-4">
                  <LockIcon size={20} className="text-amber-500 shrink-0" />
                  <p className="text-amber-200 text-sm font-medium">
                    Diagnóstico completado. Las respuestas ya no son editables.
                  </p>
                </div>
              )}

              {currentBlock.type === "welcome" ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  <div className="bg-slate-900 border border-slate-800 p-8 md:p-12 rounded-xl shadow-2xl relative mb-12">
                    <div className="absolute -top-3 left-8 px-4 py-1 bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-tighter rounded-sm">
                      Mensaje de Bienvenida
                    </div>
                    <p className="text-xl md:text-2xl leading-relaxed text-slate-300 italic font-serif">
                      "Antes de comenzar la Incubadora, quiero invitarte a hacer
                      este diagnóstico con total honestidad.{" "}
                      <span className="text-amber-400">
                        Este no es un examen. Es un mapa.
                      </span>{" "}
                      La mayoría de los expertos cree que necesita más contenido
                      o más estrategia. Pero muchas veces el bloqueo está en la
                      identidad desde la que estás construyendo... responde
                      desde la verdad, no desde lo que crees que 'debería' ser."
                    </p>
                  </div>
                  <div className="prose prose-invert max-w-none text-slate-400 text-lg space-y-6">
                    <p>
                      Cuanto más honesta sea tu respuesta, más potente será tu
                      proceso.
                    </p>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-12">
                  <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4">
                    <h2 className="text-3xl md:text-4xl font-light text-white">
                      {currentBlock.title}
                    </h2>
                    {currentBlockIndex !== 9 && (
                      <span className="text-amber-500 font-mono mb-1 tracking-widest text-sm uppercase">
                        BLOQUE_{currentBlockIndex.toString().padStart(2, "0")}
                      </span>
                    )}
                  </div>

                  <form
                    className="space-y-12"
                    onSubmit={(e) => e.preventDefault()}
                  >
                    {visibleQuestions.map((q) => (
                      <div
                        key={q.id}
                        className={`space-y-4 ${isCompleted ? "opacity-80" : ""}`}
                      >
                        <label className="label-geometric">
                          {q.label}{" "}
                          {q.multiple && !isCompleted && (
                            <span className="text-[10px] text-amber-500 lowercase ml-2 font-normal tracking-normal">
                              (Multi-selección)
                            </span>
                          )}
                        </label>

                        {q.type === "text" && (
                          <DictationTextarea
                            className="input-geometric min-h-[120px] focus:border-amber-500/50"
                            placeholder={
                              isCompleted
                                ? "Diagnóstico completado."
                                : "Escribe tu respuesta..."
                            }
                            value={localAnswers[q.id] || ""}
                            onChange={(val) => handleInputChange(q.id, val)}
                            country={profile?.country}
                            disabled={isCompleted}
                          />
                        )}

                        {q.type === "select" && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {q.options?.map((opt) => {
                              const isSelected = q.multiple
                                ? Array.isArray(localAnswers[q.id]) &&
                                  localAnswers[q.id].includes(opt)
                                : localAnswers[q.id] === opt;

                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  disabled={isCompleted}
                                  onClick={() =>
                                    handleInputChange(q.id, opt, q.multiple)
                                  }
                                  className={`text-left p-4 border rounded transition-all text-sm group ${
                                    isSelected
                                      ? "border-amber-500 bg-amber-500/10 text-white"
                                      : "border-slate-800 bg-slate-900 text-slate-400 hover:border-amber-500/50"
                                  } ${isCompleted && !isSelected ? "opacity-40" : ""} ${isCompleted ? "cursor-default" : ""}`}
                                >
                                  <span
                                    className={`mr-2 transition-colors inline-block ${isSelected ? "text-amber-500" : "group-hover:text-amber-500"}`}
                                  >
                                    {q.multiple
                                      ? isSelected
                                        ? "☒"
                                        : "☐"
                                      : "•"}
                                  </span>
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {q.type === "scale" && (
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest hidden sm:inline-block">
                              Nada
                            </span>
                            <div
                              className={`flex-grow flex justify-between bg-slate-900 p-1 rounded-sm border border-slate-800 overflow-x-auto gap-1 ${isCompleted ? "cursor-default" : ""}`}
                            >
                              {[1, 2, 3, 4, 5].map((val) => (
                                <button
                                  key={val}
                                  type="button"
                                  disabled={isCompleted}
                                  onClick={() => handleInputChange(q.id, val)}
                                  className={`min-w-[40px] h-10 md:min-w-[48px] md:h-12 rounded-sm flex items-center justify-center transition-all text-sm font-bold flex-1 ${
                                    localAnswers[q.id] === val
                                      ? "bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                                      : "text-slate-500 hover:bg-slate-800 hover:text-white"
                                  } ${isCompleted && localAnswers[q.id] !== val ? "opacity-40" : ""}`}
                                >
                                  {val}
                                </button>
                              ))}
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest hidden sm:inline-block">
                              Total
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Floating Action Footer */}
          <div className="mt-auto flex flex-col md:flex-row items-center justify-between p-6 md:px-12 border-t border-slate-900 bg-slate-950">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              {!isCompleted ? (
                <>
                  <div
                    className={`w-2 h-2 rounded-full ${saving ? "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]" : "bg-slate-600"}`}
                  ></div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                    {saving ? "Guardando..." : "Autoguardado activado"}
                  </span>
                </>
              ) : (
                <span className="text-[10px] text-amber-500 uppercase tracking-widest font-bold flex items-center gap-2">
                  <LockIcon size={12} /> solo lectura
                </span>
              )}
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <button
                onClick={handleBack}
                disabled={currentBlockIndex === 0}
                className="flex-1 md:flex-none px-6 py-4 border border-slate-800 rounded-sm font-bold text-sm text-slate-400 hover:bg-slate-900 hover:text-white transition-all disabled:opacity-0 uppercase tracking-wide"
              >
                Anterior
              </button>
              <button
                onClick={handleNext}
                className="flex-1 md:flex-none btn-geometric-primary bg-amber-500 hover:bg-amber-400 text-slate-950 border-none shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] uppercase tracking-wide px-10"
              >
                {currentBlockIndex === 9
                  ? isCompleted
                    ? "Ir a resultados"
                    : "Finalizar y Analizar"
                  : "Siguiente"}
              </button>
            </div>
          </div>
        </div>

        {/* Finalize Confirmation Modal */}
        <AnimatePresence>
          {showConfirmModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-sm shadow-2xl overflow-hidden"
              >
                <div className="p-8">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-6 text-amber-500 mx-auto">
                    <AlertTriangle size={32} />
                  </div>
                  <h3 className="text-2xl font-black uppercase text-white text-center mb-4 tracking-tight">
                    ¿Enviar diagnóstico?
                  </h3>
                  <p className="text-slate-300 text-sm text-center font-medium leading-relaxed mb-10">
                    Una vez enviado,{" "}
                    <strong className="text-amber-400 font-bold text-base">
                      no podrás modificar tus respuestas.
                    </strong>{" "}
                    Recibirás tu perfil personalizado y tus recomendaciones
                    estratégicas inmediatamente.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={finalizeDiagnosis}
                      className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-black uppercase tracking-[0.2em] rounded-sm transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                    >
                      Sí, enviar mi diagnóstico
                    </button>
                    <button
                      onClick={() => setShowConfirmModal(false)}
                      className="w-full py-4 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
                    >
                      Seguir revisando
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

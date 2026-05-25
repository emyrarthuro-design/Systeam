import React, { useState, useEffect, useRef } from 'react';
import { Mic, Wand2, RotateCcw, AlertTriangle, Lock } from 'lucide-react';
import { improveTextWithAI } from '../lib/gemini';
import { useSpeechToText } from '../hooks/useSpeechToText';

interface DictationTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  country?: string;
  disabled?: boolean;
}

export function DictationTextarea({ value, onChange, placeholder, className, country, disabled }: DictationTextareaProps) {
  const [isImproving, setIsImproving] = useState(false);
  const [originalText, setOriginalText] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  
  const valueRef = useRef(value);
  const startSessionValueRef = useRef('');

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Handle results from the hook
  const handleSpeechResult = (transcript: string) => {
    const base = startSessionValueRef.current;
    const separator = base && !base.endsWith(' ') && !transcript.startsWith(' ') ? ' ' : '';
    onChange(base + separator + transcript);
  };

  // Determine language code
  let lang = 'es-419';
  switch (country) {
    case 'Argentina': lang = 'es-AR'; break;
    case 'Bolivia': lang = 'es-BO'; break;
    case 'Chile': lang = 'es-CL'; break;
    case 'Colombia': lang = 'es-CO'; break;
    case 'Costa Rica': lang = 'es-CR'; break;
    case 'Cuba': lang = 'es-CU'; break;
    case 'Ecuador': lang = 'es-EC'; break;
    case 'El Salvador': lang = 'es-SV'; break;
    case 'España': lang = 'es-ES'; break;
    case 'Guatemala': lang = 'es-GT'; break;
    case 'Honduras': lang = 'es-HN'; break;
    case 'México': lang = 'es-MX'; break;
    case 'Nicaragua': lang = 'es-NI'; break;
    case 'Panamá': lang = 'es-PA'; break;
    case 'Paraguay': lang = 'es-PY'; break;
    case 'Perú': lang = 'es-PE'; break;
    case 'Puerto Rico': lang = 'es-PR'; break;
    case 'República Dominicana': lang = 'es-DO'; break;
    case 'Uruguay': lang = 'es-UY'; break;
    case 'Venezuela': lang = 'es-VE'; break;
  }

  const { isListening, error, startListening, stopListening } = useSpeechToText({
    onResult: handleSpeechResult,
    lang
  });

  useEffect(() => {
    if (error === 'not-allowed') {
      setMicPermissionDenied(true);
    }
  }, [error]);

  const toggleListening = () => {
    if (disabled) return;
    if (isListening) {
      stopListening();
    } else {
      setMicPermissionDenied(false);
      startSessionValueRef.current = valueRef.current;
      startListening();
    }
  };

  const handleImproveWithAI = async () => {
    if (!value || isImproving || disabled) return;
    setIsImproving(true);
    try {
      const improved = await improveTextWithAI(value);
      setOriginalText(value);
      onChange(improved);
      setToastMessage("Texto mejorado. Puedes seguir editando manualmente.");
      setTimeout(() => setToastMessage(null), 5000);
    } catch (error) {
      if (import.meta.env.DEV) console.error("Error mejorando texto", error);
      setToastMessage("Hubo un error al mejorar el texto.");
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsImproving(false);
    }
  };

  const handleRevert = () => {
    if (originalText !== null && !disabled) {
      onChange(originalText);
      setOriginalText(null);
      setToastMessage("Se restauró el texto original.");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const isSupported = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return (
    <div className={`relative group/dictation w-full ${disabled ? 'opacity-70 cursor-not-allowed' : ''}`}>
      <div className="relative w-full">
        <textarea
          className={`${className} pr-14 ${disabled ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed' : ''}`}
          placeholder={disabled ? "Diagnóstico completado." : placeholder}
          value={value}
          onChange={(e) => !disabled && onChange(e.target.value)}
          disabled={isImproving || disabled}
          readOnly={disabled}
        />
        
        {isSupported && !disabled && (
          <button
            type="button"
            onClick={toggleListening}
            disabled={disabled}
            className={`absolute top-2 right-2 md:top-3 md:right-3 p-2.5 md:p-2 rounded-full transition-all flex items-center justify-center ${
              isListening 
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse' 
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white hover:shadow-md disabled:hidden'
            }`}
            aria-label={isListening ? "Detener dictado" : "Activar dictado por voz"}
            title="Dictado por voz"
          >
            <Mic size={20} className={isListening ? "scale-110 transition-transform" : "transition-transform"} />
          </button>
        )}

        {disabled && (
          <div className="absolute top-2 right-2 md:top-3 md:right-3 p-2.5 md:p-2 text-slate-600">
            <Lock size={20} />
          </div>
        )}

        {!isSupported && !disabled && (
          <div className="absolute top-3 right-3 text-slate-500 cursor-help" title="Dictado por voz no disponible en este navegador.">
            <Mic size={20} className="opacity-50" />
          </div>
        )}
      </div>

      {micPermissionDenied && !disabled && (
        <div className="text-rose-400 text-xs mt-2 flex items-center gap-1 bg-rose-500/10 p-2 rounded-sm border border-rose-500/20">
          <AlertTriangle size={14} />
          Activa el micrófono en tu navegador para usar el dictado.
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mt-2 min-h-[24px]">
        <div className="flex-1">
          {isListening && !disabled && (
            <div className="text-amber-500 text-xs animate-pulse flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              Escuchando... habla con naturalidad
            </div>
          )}
          
          {toastMessage && !disabled && (
            <div className="text-emerald-400 text-[10px] uppercase font-bold tracking-widest bg-emerald-500/10 p-1.5 px-3 rounded-sm border border-emerald-500/20 inline-block">
              {toastMessage}
            </div>
          )}
        </div>

        {!disabled && (
          <div className="flex flex-wrap gap-2 shrink-0 md:justify-end">
            {originalText && !isListening && (
              <button
                type="button"
                onClick={handleRevert}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors px-2 py-1 rounded-sm border border-slate-700 hover:border-slate-500 bg-slate-800"
              >
                <RotateCcw size={12} />
                Volver
              </button>
            )}

            {value && !isListening && (
              <button
                type="button"
                onClick={handleImproveWithAI}
                disabled={isImproving}
                className={`text-xs font-semibold flex items-center gap-1 transition-colors px-3 py-1.5 rounded-sm border ${
                  isImproving 
                    ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-indigo-500/30 text-indigo-300 hover:from-indigo-500/30 hover:text-white shadow-sm'
                }`}
              >
                <Wand2 size={12} className={isImproving ? 'animate-spin' : ''} />
                {isImproving ? "Mejorando..." : "✨ Mejorar con IA"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

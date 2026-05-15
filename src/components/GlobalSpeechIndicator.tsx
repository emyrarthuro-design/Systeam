import React, { useEffect, useState } from 'react';

export function GlobalSpeechIndicator() {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    const handleStart = () => setIsRecording(true);
    const handleEnd = () => setIsRecording(false);

    window.addEventListener('speech-listening-start', handleStart as EventListener);
    window.addEventListener('speech-listening-end', handleEnd as EventListener);

    return () => {
      window.removeEventListener('speech-listening-start', handleStart as EventListener);
      window.removeEventListener('speech-listening-end', handleEnd as EventListener);
    };
  }, []);

  if (!isRecording) return null;

  return (
    <div 
      role="status" 
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-800 rounded-full px-4 py-2 flex items-center gap-2 shadow-xl shadow-black/50 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="relative flex h-3 w-3" aria-hidden="true">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
      </div>
      <span className="text-xs font-bold uppercase tracking-widest text-slate-300">🎙️ Grabando...</span>
    </div>
  );
}

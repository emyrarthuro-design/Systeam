import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isDestructive = false,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md p-6 relative card-geometric transform transition-all animate-in zoom-in-95 duration-200">
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-12 h-12 flex flex-shrink-0 items-center justify-center rounded-sm border ${isDestructive ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-lg md:text-xl font-black uppercase tracking-tight text-white">{title}</h2>
        </div>
        
        <p className="text-slate-300 mb-8 font-medium text-sm md:text-base leading-relaxed">
          {message}
        </p>
        
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4">
          <button 
            onClick={onCancel}
            className="w-full sm:w-auto px-6 py-3 sm:py-2 border border-slate-700 text-white font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-colors rounded-sm"
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            className={`w-full sm:w-auto px-6 py-3 sm:py-2 font-bold text-xs uppercase tracking-widest transition-colors rounded-sm shadow-lg ${
              isDestructive 
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20' 
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

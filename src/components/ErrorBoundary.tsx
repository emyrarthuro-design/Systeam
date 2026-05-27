import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("Uncaught error:", error, errorInfo);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-lg max-w-md w-full flex flex-col items-center gap-6">
            <AlertTriangle className="w-16 h-16 text-amber-500 animate-pulse" />
            <div className="space-y-2">
              <h1 className="text-2xl font-black uppercase tracking-tight text-white">
                Algo salió mal
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                No te preocupes, tu progreso está guardado. Recarga la página para continuar.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-sm transition-colors text-xs uppercase tracking-widest cursor-pointer"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

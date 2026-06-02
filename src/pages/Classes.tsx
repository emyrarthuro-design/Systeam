import React, { useState, useEffect } from 'react';
import { fetchClasses } from '../lib/db';
import { PlayCircle, ExternalLink, X, Video, Lock } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';

// Convierte un link de Google Drive a su formato embebido /preview
function toEmbedUrl(url: string): string | null {
  if (!url) return null;
  // Formato archivo: https://drive.google.com/file/d/FILE_ID/view
  const fileMatch = url.match(/\/file\/d\/([^/]+)/);
  if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  // Formato open?id=
  const openMatch = url.match(/[?&]id=([^&]+)/);
  if (openMatch) return `https://drive.google.com/file/d/${openMatch[1]}/preview`;
  return null;
}

export default function Classes() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeClass, setActiveClass] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      const data = await fetchClasses();
      setClasses(data);
      setLoading(false);
    };
    load();
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-sys-bg flex items-center justify-center">
        <p className="text-sys-text-mut">Inicia sesión para ver las clases.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sys-bg px-6 py-10 max-w-6xl mx-auto">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Video className="text-sys-accent" size={28} />
          <h1 className="text-3xl font-bold font-sans">Incubadora de Expertos</h1>
        </div>
        <p className="text-sys-text-sec font-sans text-sm">Clases grabadas de la mentoría. Avanza a tu ritmo.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => (
            <div key={i} className="card-geometric animate-pulse h-48 bg-sys-input/50"></div>
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="card-geometric text-center py-16">
          <Lock size={40} className="text-sys-text-mut mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2 text-sys-text-main">Aún no hay clases disponibles</h3>
          <p className="text-sys-text-mut text-sm">Las clases de la mentoría aparecerán aquí muy pronto.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveClass(c)}
              className="card-geometric text-left group hover:border-sys-accent transition-all duration-200 flex flex-col cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="inline-flex items-center justify-center min-w-[44px] h-11 px-3 rounded-[10px] bg-sys-accent/15 text-sys-accent font-bold text-lg">
                  {c.classNumber}
                </span>
                <PlayCircle className="text-sys-text-mut group-hover:text-sys-accent transition-colors" size={28} />
              </div>
              {c.module && (
                <span className="text-[10px] uppercase tracking-[0.15em] text-sys-accent font-bold mb-1">{c.module}</span>
              )}
              <h3 className="text-base font-bold text-sys-text-main mb-2 leading-snug">{c.title}</h3>
              {c.description && (
                <p className="text-xs text-sys-text-mut line-clamp-3 flex-1">{c.description}</p>
              )}
              <span className="mt-4 text-xs font-bold text-sys-accent flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                Ver clase <PlayCircle size={14} />
              </span>
            </button>
          ))}
        </div>
      )}

      {activeClass && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setActiveClass(null)}>
          <div className="bg-sys-input border border-sys-border rounded-[12px] max-w-4xl w-full overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-sys-border">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center min-w-[36px] h-9 px-2 rounded-[8px] bg-sys-accent/15 text-sys-accent font-bold">
                  {activeClass.classNumber}
                </span>
                <div>
                  <h2 className="text-base font-bold leading-tight text-sys-text-main">{activeClass.title}</h2>
                  {activeClass.module && <span className="text-[10px] uppercase tracking-wider text-sys-accent font-bold">{activeClass.module}</span>}
                </div>
              </div>
              <button onClick={() => setActiveClass(null)} className="text-sys-text-mut hover:text-white transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="aspect-video bg-black">
              {toEmbedUrl(activeClass.driveUrl) ? (
                <iframe
                  src={toEmbedUrl(activeClass.driveUrl) || ''}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  title={activeClass.title}
                ></iframe>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                  <p className="text-sys-text-mut text-sm">Este video no se puede reproducir embebido.</p>
                  <a href={activeClass.driveUrl} target="_blank" rel="noopener noreferrer" className="btn-geometric-primary inline-flex items-center gap-2">
                    Abrir en Drive <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>
            {activeClass.description && (
              <div className="p-5 border-t border-sys-border">
                <p className="text-sm text-sys-text-sec">{activeClass.description}</p>
              </div>
            )}
            <div className="p-5 pt-2 flex justify-end">
              <a href={activeClass.driveUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-sys-text-mut hover:text-sys-accent flex items-center gap-1.5 transition-colors">
                Abrir en Google Drive <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

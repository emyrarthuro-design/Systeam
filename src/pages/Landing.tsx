import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { ChevronRight, Clock, Save, Mic } from 'lucide-react';

export default function Landing() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (profile.diagnosticStatus === 'completed') {
        navigate('/resultados');
      } else {
        navigate('/diagnostico');
      }
    }
  }, [user, profile, navigate]);

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-slate-950">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-sys-accent-alpha blur-[120px] rounded-full -z-10 pointer-events-none" />
      <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-sys-accent-light blur-[100px] rounded-full -z-10 pointer-events-none" />

      <section className="relative py-12 px-4 flex-1 flex flex-col justify-center">
        <div className="max-w-3xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex justify-center mb-10 w-full">
              <span className="font-sans font-bold tracking-tight lowercase text-sys-text-main text-[80px] md:text-[100px] leading-none">
                systeam<span className="text-sys-accent">.</span>
              </span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-sans font-bold mb-4 tracking-[-0.02em] leading-none text-sys-text-main text-center">
              Diagnóstico Inicial del <span className="text-sys-accent">Experto</span>
            </h1>
            <p className="text-center text-sys-text-sec text-lg md:text-xl font-medium tracking-wide mb-12">
              Descubre desde dónde estás construyendo tu marca, tu oferta y tus resultados.
            </p>

            <div className="card-geometric mb-8">
              <p className="text-lg text-sys-text-main leading-relaxed mb-6 font-medium">
                Antes de comenzar la Incubadora, quiero invitarte a hacer este diagnóstico con total honestidad. Este no es un examen. Es un mapa.
              </p>
              <p className="text-sys-text-sec leading-relaxed mb-6">
                La mayoría de los expertos cree que necesita más contenido, más herramientas o más estrategia. Pero muchas veces el verdadero bloqueo está en otro lugar: en la identidad desde la que estás construyendo, en la biología que no sostiene la exposición, en creencias que limitan la venta, en una oferta poco clara o en un entorno que no acompaña tu expansión.
              </p>
              <p className="text-sys-accent leading-relaxed mb-8 font-medium italic">
                Responde desde la verdad, no desde lo que crees que 'debería' ser. Cuanto más honesta sea tu respuesta, más potente será tu proceso.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-sys-input/50 border border-sys-border p-4 rounded-[8px] flex flex-col items-center text-center gap-2">
                  <Clock className="text-sys-accent" size={24} />
                  <span className="text-xs text-sys-text-sec font-medium leading-tight">⏱️ Tiempo estimado:<br/>30-40 minutos</span>
                </div>
                <div className="bg-sys-input/50 border border-sys-border p-4 rounded-[8px] flex flex-col items-center text-center gap-2">
                  <Save className="text-sys-accent" size={24} />
                  <span className="text-xs text-sys-text-sec font-medium leading-tight">💾 Puedes pausar<br/>y retomar</span>
                </div>
                <div className="bg-sys-input/50 border border-sys-border p-4 rounded-[8px] flex flex-col items-center text-center gap-2">
                  <Mic className="text-sys-accent" size={24} />
                  <span className="text-xs text-sys-text-sec font-medium leading-tight">🎙️ Puedes responder<br/>por voz en cada pregunta</span>
                </div>
              </div>
            </div>

            <div className="card-geometric max-w-xl mx-auto text-center">
              <h2 className="text-[13px] uppercase font-bold tracking-[0.05em] text-sys-text-sec mb-6">Acceso exclusivo por invitación</h2>
              
              <p className="text-sm text-sys-text-sec mb-8">
                Este diagnóstico inicial es la puerta de entrada a la Incubadora SysTeam. Si ya recibiste tu link de invitación o ya tienes una cuenta, puedes iniciar sesión.
              </p>
              
              <button 
                onClick={() => navigate('/login')}
                className="btn-geometric-primary w-full flex items-center justify-center p-4 text-base mb-4"
              >
                Iniciar sesión
                <ChevronRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
              <p className="text-xs text-sys-text-mut whitespace-nowrap">
                ¿Recibiste una invitación? <Link to="/activar" className="text-sys-accent font-bold hover:underline">Activa tu cuenta aquí</Link>
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

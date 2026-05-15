import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, AlertTriangle, Key } from 'lucide-react';
import { SUPER_ADMIN_EMAILS } from '../lib/admins';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Por favor completa todos los campos');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      let isCreatingAdmin = false;
      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        if (SUPER_ADMIN_EMAILS.includes(cleanEmail.toLowerCase())) {
          const { doc, setDoc } = await import('firebase/firestore');
          // Forzar a super_admin
          await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            email: cleanEmail,
            fullName: 'Emyr Arthuro',
            role: 'super_admin',
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      } catch (signInErr: any) {
        if (SUPER_ADMIN_EMAILS.includes(cleanEmail.toLowerCase()) && (signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/user-not-found')) {
          console.log('Creating admin account automatically...');
          isCreatingAdmin = true;
          const { createUserWithEmailAndPassword } = await import('firebase/auth');
          const { doc, setDoc } = await import('firebase/firestore');
          const uc = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          await setDoc(doc(db, 'users', uc.user.uid), {
            uid: uc.user.uid,
            email: cleanEmail,
            fullName: 'Emyr Arthuro',
            role: 'super_admin',
            createdAt: new Date().toISOString(),
          });
        } else {
          throw signInErr;
        }
      }

      // Wait a moment for auth state to propagate to App.tsx
      if (SUPER_ADMIN_EMAILS.includes(cleanEmail.toLowerCase()) || isCreatingAdmin) {
         setTimeout(() => navigate('/admin'), 500);
      } else {
         setTimeout(() => navigate('/diagnostico'), 500);
      }
    } catch (err: any) {
      console.error(err);
      
      // Auto-bootstrap admin account if it doesn't exist
      if (cleanEmail === 'info@emyrarthuro.com' && password === 'Admin2026!' && err.code === 'auth/invalid-credential') {
        try {
          const { createUserWithEmailAndPassword } = await import('firebase/auth');
          const { doc, setDoc } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase');
          
          const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            uid: userCredential.user.uid,
            email: cleanEmail,
            fullName: "Administrador",
            country: "",
            role: 'admin',
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
          });
          
          setTimeout(() => navigate('/admin'), 500);
          return;
        } catch (bootstrapErr: any) {
          console.error("Failed to bootstrap admin:", bootstrapErr);
          if (bootstrapErr.code === 'auth/email-already-in-use') {
             setError('La cuenta admin ya existe en Firebase pero con otra contraseña (o método de inicio). Usa "¿Olvidaste tu contraseña?" o elimínala en Firebase Console.');
             setLoading(false);
             return;
          }
        }
      }

      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Credenciales incorrectas');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Error de conexión con Firebase. Esto suele deberse a un bloqueador de anuncios (AdBlock), una VPN o restricciones de red. Por favor, desactiva AdBlock para este sitio.');
      } else {
        let msg = err.message;
        if (err.code === 'auth/invalid-email') msg = "El formato del email es incorrecto";
        if (err.code === 'auth/too-many-requests') msg = "Demasiados intentos. Intenta más tarde.";
        setError(`Ocurrió un error al iniciar sesión: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Ingresa tu email para recuperar la contraseña');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      console.error(err);
      setError('Ocurrió un error al enviar el email. Verifica tu dirección.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-sys-bg">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-sys-accent-alpha blur-[120px] rounded-full -z-10 pointer-events-none" />

      <section className="relative py-12 px-4 flex-1 flex flex-col justify-center items-center">
        <div className="max-w-md w-full">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex justify-center mb-8 w-full">
              <span className="font-sans font-bold tracking-tight lowercase text-sys-text-main text-[40px] leading-none">
                systeam<span className="text-sys-accent">.</span>
              </span>
            </div>

            <div className="card-geometric">
              {!showForgot ? (
                <>
                  <h2 className="text-[13px] uppercase font-bold tracking-[0.05em] text-sys-text-sec mb-6 text-center">Iniciar Sesión</h2>
                  <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                      <div className="p-3 bg-sys-error/10 border border-sys-error/30 rounded-[8px] text-sys-error text-xs flex items-center gap-2">
                        <AlertTriangle size={14} />
                        {error}
                      </div>
                    )}
                    <div>
                      <label className="label-geometric">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-sys-text-mut" size={18} />
                        <input 
                          type="email" 
                          className="input-geometric pl-10"
                          placeholder="tu@email.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label-geometric">Contraseña</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-sys-text-mut" size={18} />
                        <input 
                          type="password" 
                          className="input-geometric pl-10"
                          placeholder="••••••••"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <button 
                      type="submit"
                      disabled={loading}
                      className="btn-geometric-primary w-full flex items-center justify-center text-base"
                    >
                      {loading ? 'Entrando...' : 'Iniciar sesión'}
                    </button>
                    
                    <div className="text-center mt-4">
                      <button 
                        type="button" 
                        onClick={() => { setShowForgot(true); setError(''); }}
                        className="text-[13px] text-sys-text-sec hover:text-sys-text-main transition-colors"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <AnimatePresence mode="wait">
                  {!resetSent ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <h2 className="text-[13px] uppercase font-bold tracking-[0.05em] text-sys-text-sec mb-6 text-center">Recuperar Contraseña</h2>
                      <form onSubmit={handleResetPassword} className="space-y-6">
                        {error && (
                          <div className="p-3 bg-sys-error/10 border border-sys-error/30 rounded-[8px] text-sys-error text-xs flex items-center gap-2">
                            <AlertTriangle size={14} />
                            {error}
                          </div>
                        )}
                        <div>
                          <label className="label-geometric">Email</label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-sys-text-mut" size={18} />
                            <input 
                              type="email" 
                              className="input-geometric pl-10"
                              placeholder="Ingresa tu email"
                              value={email}
                              onChange={e => setEmail(e.target.value)}
                            />
                          </div>
                        </div>
                        
                        <button 
                          type="submit"
                          disabled={loading}
                          className="btn-geometric-primary w-full flex items-center justify-center text-base gap-2"
                        >
                          <Key size={18} />
                          {loading ? 'Enviando...' : 'Enviar link de recuperación'}
                        </button>
                        
                        <div className="text-center mt-4">
                          <button 
                            type="button" 
                            onClick={() => { setShowForgot(false); setError(''); }}
                            className="text-[13px] text-sys-text-sec hover:text-sys-text-main transition-colors"
                          >
                            Volver al login
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-6"
                    >
                      <div className="w-12 h-12 bg-sys-success/10 border border-sys-success/30 rounded-full flex items-center justify-center text-sys-success mx-auto mb-4">
                        <Mail size={24} />
                      </div>
                      <h3 className="text-lg font-bold text-sys-text-main mb-2">Revisa tu correo</h3>
                      <p className="text-sm text-sys-text-sec mb-6">
                        Te enviamos un link a tu email para restablecer tu contraseña. Revisa también tu carpeta de spam.
                      </p>
                      <button 
                        onClick={() => { setShowForgot(false); setResetSent(false); }}
                        className="btn-geometric-secondary w-full text-center"
                      >
                        Volver al login
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
            
            <div className="mt-8 text-center">
              <p className="text-sm text-sys-text-mut">
                ¿No tienes cuenta? Tu acceso es por invitación.<br className="hidden md:block"/> Contacta a SysTeam.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

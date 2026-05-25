import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { createOrUpdateStudentProfile } from '../lib/db';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, ShieldCheck, CheckCircle2, AlertTriangle, Eye, EyeOff, Clock, User, ChevronRight, ArrowLeft } from 'lucide-react';
import { Invitation } from '../types';
import { parseDate } from '../lib/dateUtils';

export default function Activate() {
  const navigate = useNavigate();
  
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [email, setEmail] = useState('');
  const [validating, setValidating] = useState(false);
  
  const [errorType, setErrorType] = useState<'none' | 'already_active' | 'not_found' | 'expired'>('none');
  const [invitation, setInvitation] = useState<Invitation | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [creating, setCreating] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleValidateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedInput = email.toLowerCase().trim();
    if (!normalizedInput || !normalizedInput.includes('@')) return;
    
    setValidating(true);
    setErrorType('none');
    
    try {
      const response = await fetch('/api/invitations/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedInput })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.invitation) {
        if (response.status === 429) {
          setErrorType('not_found'); // Mute it as not_found or better, show error
          setGlobalError(result.error);
        } else {
          setErrorType('not_found');
        }
        setStep(2);
        return;
      }
      
      const invData = result.invitation as Invitation;
      
      if (invData.status === 'activated') {
        setErrorType('already_active');
        setStep(2);
        return;
      }
      
      const expiresAt = invData.expiresAt ? new Date(invData.expiresAt).getTime() : 0;
      if (expiresAt < Date.now()) {
        setErrorType('expired');
        setStep(2);
        return;
      }
      
      setInvitation(invData);
      setStep(3); // Password form
      
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      setErrorType('not_found');
      setStep(2);
    } finally {
      setValidating(false);
    }
  };

  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  let strength = 0;
  if (hasMinLength) strength++;
  if (hasLetter) strength++;
  if (hasNumber) strength++;

  const isFormValid = hasMinLength && hasLetter && hasNumber && passwordsMatch && acceptedTerms && !creating;

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !isFormValid) return;

    setCreating(true);
    setGlobalError('');

    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, invitation.email, password);
      const newUser = userCredential.user;

      // 2. Create user document
      await createOrUpdateStudentProfile(newUser, invitation);

      // 3. Update invitation
      try {
        const idToken = await newUser.getIdToken();
        const response = await fetch('/api/invitations/activate', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ invitationId: invitation.id })
        });
        
        if (!response.ok) {
          throw new Error('API returned an error');
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[ACTIVATE] Failed to mark invitation as used:', 
          { invitationId: invitation.id, error: err });
      }

      // 4. Success state
      setStep(4);
      
      setTimeout(() => {
        navigate('/diagnostico');
      }, 2000);
      
    } catch (err: any) {
      if (import.meta.env.DEV) console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setStep(5);
        setCreating(false);
        return;
      } else if (err.code === 'auth/weak-password') {
        setGlobalError('La contraseña no cumple los requisitos.');
      } else if (err.code === 'auth/network-request-failed') {
        setGlobalError('Sin conexión. Verifica tu internet.');
      } else {
        setGlobalError('Error inesperado. Intenta de nuevo o contacta a SysTeam.');
      }
      setCreating(false);
    }
  };

  const handleRecoverAndActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !password) return;

    setLoggingIn(true);
    setGlobalError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, invitation.email, password);
      const user = userCredential.user;

      if (user.email !== invitation.email) {
        setGlobalError('El email del usuario no coincide con la invitación.');
        setLoggingIn(false);
        return;
      }


      await createOrUpdateStudentProfile(user, invitation);

      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/invitations/activate', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ invitationId: invitation.id })
        });
        
        if (!response.ok) {
          throw new Error('API returned an error');
        }
        
        if (invitation.status === 'activated') {
        } else {
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[ACTIVATE] Failed to mark invitation as used:', { invitationId: invitation.id, error: err });
      }

      setStep(4);
      setTimeout(() => {
        navigate('/diagnostico');
      }, 2000);

    } catch (err: any) {
      if (import.meta.env.DEV) console.error('[ACTIVATE-RECOVER] Failed to sign in:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setGlobalError('Contraseña incorrecta. Intenta nuevamente.');
      } else {
        setGlobalError('Error al iniciar sesión. Contacta a soporte.');
      }
      setLoggingIn(false);
    }
  };

  const handleResetPassword = async () => {
    if (!invitation) return;
    try {
      await sendPasswordResetEmail(auth, invitation.email);
      setResetSent(true);
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-amber-500/5 blur-[120px] rounded-full -z-10 pointer-events-none" />
      
      <div className="mb-10 select-none flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-amber-500 rounded-sm flex items-center justify-center">
           <span className="text-slate-950 font-black text-2xl">s.</span>
        </div>
        <span className="text-xs font-black uppercase tracking-[0.5em] text-white/40">SysTeam Mentoría</span>
      </div>

      <div className="w-full max-w-[480px]">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-[#111111] p-10 rounded-sm border border-slate-900 shadow-2xl"
            >
              <div className="text-center mb-10">
                <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-3">Activa tu cuenta</h1>
                <p className="text-slate-400 text-sm font-medium">Ingresa el email donde recibiste tu invitación de SysTeam</p>
              </div>

              <form onSubmit={handleValidateEmail} className="space-y-8">
                <div>
                  <label className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 mb-3 block">Email de invitación</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={20} />
                    <input 
                      type="email" 
                      className="w-full bg-slate-950 border border-slate-800 rounded-sm py-4 pl-12 pr-4 text-white placeholder-slate-700 outline-none focus:border-amber-500 transition-colors"
                      placeholder="tu@email.com"
                      autoComplete="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={validating || !email.trim() || !email.includes('@')}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-widest rounded-sm transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] disabled:opacity-20 flex items-center justify-center gap-2"
                >
                  {validating ? 'Verificando...' : (
                    <>
                      Continuar <ChevronRight size={18} />
                    </>
                  )}
                </button>

                <div className="pt-6 border-t border-slate-900 text-center">
                  <p className="text-slate-500 text-xs">
                    ¿Ya activaste tu cuenta? <Link to="/login" className="text-amber-500 font-bold hover:underline ml-1">Inicia sesión aquí</Link>
                  </p>
                </div>
              </form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111111] p-10 rounded-sm border border-slate-900 shadow-2xl text-center"
            >
              {errorType === 'already_active' && (
                <>
                  <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-6">
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Tu cuenta ya está activa</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-10">
                    Este email ya tiene una cuenta de SysTeam. Inicia sesión con tu contraseña.
                  </p>
                  <div className="space-y-4">
                    <Link to="/login" className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-widest rounded-sm flex items-center justify-center transition-all">
                      Iniciar sesión
                    </Link>
                    <Link to="/login" className="text-xs font-bold text-slate-500 hover:text-white uppercase tracking-widest block transition-colors">
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                </>
              )}

              {errorType === 'not_found' && (
                <>
                  <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center text-amber-500 mx-auto mb-6">
                    <AlertTriangle size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-4">No encontramos tu invitación</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-10">
                    Este email no tiene una invitación activa de SysTeam. Verifica que estés usando el mismo email donde te enviaron la invitación.
                  </p>
                  <div className="space-y-4">
                    <button onClick={() => setStep(1)} className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-widest rounded-sm flex items-center justify-center transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                      Intentar con otro email
                    </button>
                    <a href="mailto:info@emyrarthuro.com" className="text-xs font-bold text-slate-500 hover:text-white uppercase tracking-widest block transition-colors">
                      Contactar a SysTeam
                    </a>
                  </div>
                </>
              )}

              {errorType === 'expired' && (
                <>
                  <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
                    <Clock size={32} />
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Tu invitación expiró</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-10">
                    La invitación enviada a este email ya no es válida (vencen a los 30 días). Contacta a SysTeam para recibir una nueva.
                  </p>
                  <div className="space-y-4">
                    <a href="mailto:info@emyrarthuro.com" className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-widest rounded-sm flex items-center justify-center transition-all">
                      Solicitar nueva invitación
                    </a>
                    <button onClick={() => setStep(1)} className="text-xs font-bold text-slate-500 hover:text-white uppercase tracking-widest block transition-colors">
                      Probar otro email
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {step === 3 && invitation && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-[#111111] p-10 rounded-sm border border-slate-900 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-20 h-20 rounded-full bg-amber-500 border-4 border-slate-900 flex items-center justify-center font-black text-3xl text-slate-950 mb-4 shadow-xl shadow-amber-500/10">
                  {invitation.fullName.substring(0, 1).toUpperCase()}
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">¡Hola, {invitation.fullName.split(' ')[0]}!</h2>
                <p className="text-slate-400 text-sm font-medium">Crea tu contraseña para acceder a tu diagnóstico</p>
              </div>

              {globalError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs mb-8 flex items-center gap-3 rounded-sm font-bold">
                  <AlertTriangle size={18} className="shrink-0" />
                  {globalError}
                </div>
              )}

              <div className="space-y-3 mb-10">
                 <div className="flex items-center gap-4 p-4 bg-slate-950/50 border border-slate-900/50 rounded-sm opacity-60">
                    <User size={18} className="text-slate-600" />
                    <div className="flex-1">
                       <p className="text-[10px] uppercase font-black tracking-widest text-slate-700">Nombre completo</p>
                       <p className="text-sm font-bold text-slate-400">{invitation.fullName}</p>
                    </div>
                    <Lock size={14} className="text-slate-700" />
                 </div>
                 <div className="flex items-center gap-4 p-4 bg-slate-950/50 border border-slate-900/50 rounded-sm opacity-60">
                    <Mail size={18} className="text-slate-600" />
                    <div className="flex-1">
                       <p className="text-[10px] uppercase font-black tracking-widest text-slate-700">Email beneficiario</p>
                       <p className="text-sm font-bold text-slate-400">{invitation.email}</p>
                    </div>
                    <Lock size={14} className="text-slate-700" />
                 </div>
                 <div className="flex items-center gap-4 p-4 bg-slate-950/50 border border-slate-900/50 rounded-sm opacity-60">
                    <div className="text-lg">🌎</div>
                    <div className="flex-1">
                       <p className="text-[10px] uppercase font-black tracking-widest text-slate-700">País</p>
                       <p className="text-sm font-bold text-slate-400">{invitation.country || 'No especificado'}</p>
                    </div>
                    <Lock size={14} className="text-slate-700" />
                 </div>
              </div>

              <form onSubmit={handleCreateAccount} className="space-y-6">
                <div>
                  <label className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 mb-3 block">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={20} />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-sm py-4 pl-12 pr-12 text-white placeholder-slate-700 outline-none focus:border-amber-500 transition-colors"
                      placeholder="Define tu acceso"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  
                  {password && (
                    <div className="mt-4">
                      <div className="flex h-1 gap-1 mb-3">
                        <div className={`flex-1 rounded-full ${strength >= 1 ? 'bg-red-500' : 'bg-slate-900'}`}></div>
                        <div className={`flex-1 rounded-full ${strength >= 2 ? 'bg-amber-500' : 'bg-slate-900'}`}></div>
                        <div className={`flex-1 rounded-full ${strength >= 3 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-slate-900'}`}></div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div className={`flex items-center gap-2 text-[10px] font-bold uppercase ${hasMinLength ? 'text-amber-500' : 'text-slate-700'}`}>
                          {hasMinLength ? <CheckCircle2 size={12} /> : <div className="w-1 h-1 rounded-full bg-current" />} Mín. 8 caracteres
                        </div>
                        <div className={`flex items-center gap-2 text-[10px] font-bold uppercase ${hasLetter ? 'text-amber-500' : 'text-slate-700'}`}>
                          {hasLetter ? <CheckCircle2 size={12} /> : <div className="w-1 h-1 rounded-full bg-current" />} Al menos 1 letra
                        </div>
                        <div className={`flex items-center gap-2 text-[10px] font-bold uppercase ${hasNumber ? 'text-amber-500' : 'text-slate-700'}`}>
                          {hasNumber ? <CheckCircle2 size={12} /> : <div className="w-1 h-1 rounded-full bg-current" />} Al menos 1 número
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 mb-3 block">Confirmar contraseña</label>
                  <div className="relative">
                    <ShieldCheck className={`absolute left-4 top-1/2 -translate-y-1/2 ${confirmPassword && passwordsMatch ? 'text-emerald-500' : 'text-slate-600'}`} size={20} />
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      className={`w-full bg-slate-950 border rounded-sm py-4 pl-12 pr-12 text-white placeholder-slate-700 outline-none transition-colors ${
                        confirmPassword && !passwordsMatch ? 'border-red-500' : 
                        confirmPassword && passwordsMatch ? 'border-emerald-500/50' : 'border-slate-800 focus:border-amber-500'
                      }`}
                      placeholder="Repite tu contraseña"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-3 py-2">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    className="mt-1 flex-shrink-0 cursor-pointer accent-amber-500 bg-slate-950 border-slate-800 w-4 h-4 rounded-sm"
                  />
                  <label htmlFor="terms" className="text-[10px] text-slate-500 uppercase font-bold leading-relaxed cursor-pointer select-none">
                    Acepto los <a href="#" className="text-amber-500 hover:underline" onClick={e => e.preventDefault()}>términos de uso</a> y la <a href="#" className="text-amber-500 hover:underline" onClick={e => e.preventDefault()}>política de privacidad</a> de SysTeam
                  </label>
                </div>

                <button 
                  type="submit"
                  disabled={!isFormValid || creating}
                  className="w-full py-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-[0.2em] rounded-sm transition-all shadow-[0_0_30px_rgba(245,158,11,0.2)] disabled:opacity-20 flex items-center justify-center gap-2"
                >
                  {creating ? 'Creando tu cuenta...' : 'Crear mi cuenta y comenzar'}
                </button>

                <div className="text-center pt-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setStep(1); 
                      setPassword(''); 
                      setConfirmPassword(''); 
                      setAcceptedTerms(false);
                    }} 
                    className="flex items-center justify-center gap-2 mx-auto text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                  >
                    <ArrowLeft size={12} /> ¿Este no eres tú? Usar otro email
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#111111] p-16 rounded-sm border border-slate-900 shadow-2xl text-center"
            >
              <motion.div 
                initial={{ scale: 0 }} 
                animate={{ scale: 1 }} 
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="w-24 h-24 bg-emerald-500/20 text-emerald-500 border-4 border-emerald-500 rounded-full flex items-center justify-center mb-8 mx-auto shadow-[0_0_40px_rgba(16,185,129,0.2)]"
              >
                <CheckCircle2 size={48} />
              </motion.div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-4">¡Bienvenido/a a SysTeam!</h2>
              <p className="text-slate-400 font-medium font-sans">Iniciando tu diagnóstico...</p>
            </motion.div>
          )}
          {step === 5 && invitation && (
            <motion.div 
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-[#111111] p-10 rounded-sm border border-slate-900 shadow-2xl"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center text-blue-500 mx-auto mb-6">
                  <User size={32} />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Ya tenés una cuenta con este email</h2>
                <p className="text-slate-400 text-sm font-medium">Iniciá sesión con tu contraseña para continuar.</p>
              </div>

              {globalError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs mb-8 flex items-center gap-3 rounded-sm font-bold">
                  <AlertTriangle size={18} className="shrink-0" />
                  {globalError}
                </div>
              )}

              <form onSubmit={handleRecoverAndActivate} className="space-y-6">
                 <div>
                  <label className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 mb-3 block">Email ({invitation.email})</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={20} />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-sm py-4 pl-12 pr-12 text-white placeholder-slate-700 outline-none focus:border-amber-500 transition-colors"
                      placeholder="Tu contraseña existente"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                   <button 
                    type="button" 
                    onClick={handleResetPassword}
                    className="text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
                   >
                    {resetSent ? 'Correo de recuperación enviado ✓' : '¿Olvidaste tu contraseña?'}
                   </button>
                </div>

                <button 
                  type="submit"
                  disabled={!password || loggingIn}
                  className="w-full py-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-[0.2em] rounded-sm transition-all shadow-[0_0_30px_rgba(245,158,11,0.2)] disabled:opacity-20 flex items-center justify-center gap-2"
                >
                  {loggingIn ? 'Iniciando sesión...' : 'Iniciar sesión y activar'}
                </button>
                
                <div className="text-center pt-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setStep(1); 
                      setPassword(''); 
                      setGlobalError('');
                    }} 
                    className="flex items-center justify-center gap-2 mx-auto text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                  >
                    <ArrowLeft size={12} /> Usar otra cuenta
                  </button>
                </div>
              </form>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

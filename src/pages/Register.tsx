import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { motion } from 'motion/react';
import { Mail, Lock, AlertTriangle, ShieldCheck, User, Eye, EyeOff, LogOut } from 'lucide-react';
import { Invitation } from '../types';
import { useAuth } from '../components/AuthProvider';
import { parseDate } from '../lib/dateUtils';

export default function Register() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorType, setErrorType] = useState<'none' | 'missing' | 'invalid' | 'activated' | 'expired'>('none');
  const [globalError, setGlobalError] = useState('');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const verifyCode = async () => {
      if (!code) {
        setErrorType('missing');
        setLoading(false);
        return;
      }

      try {
        const q = query(collection(db, 'invitations'), where('code', '==', code));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          setErrorType('invalid');
          setLoading(false);
          return;
        }

        const invDoc = querySnapshot.docs[0];
        const invData = { id: invDoc.id, ...invDoc.data() } as Invitation;

        if (invData.status === 'activated') {
          setErrorType('activated');
        } else if (invData.status === 'expired' || (parseDate(invData.expiresAt)?.getTime() || Date.now()) < Date.now()) {
          setErrorType('expired');
        } else {
          setInvitation(invData);
          setErrorType('none');
        }
      } catch (err) {
        console.error(err);
        setGlobalError('Error al verificar el código.');
        setErrorType('invalid');
      } finally {
        setLoading(false);
      }
    };

    verifyCode();
  }, [code]);

  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  let strength = 0;
  if (hasMinLength) strength++;
  if (hasLetter) strength++;
  if (hasNumber) strength++;

  const isFormValid = hasMinLength && hasLetter && hasNumber && passwordsMatch && acceptedTerms && !submitting;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation || !isFormValid) return;

    setSubmitting(true);
    setGlobalError('');

    try {
      // 1. Create Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, invitation.email, password);
      const newUser = userCredential.user;

      // 2. Create user document
      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        email: invitation.email,
        fullName: invitation.fullName,
        country: invitation.country || 'No especificado',
        invitationCode: invitation.code,
        role: 'student',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        diagnosticStatus: 'not_started'
      });

      // 3. Update invitation status
      if (invitation.id) {
        await updateDoc(doc(db, 'invitations', invitation.id), {
          status: 'activated',
          activatedAt: serverTimestamp()
        });
      }

      setGlobalError('✓ Cuenta creada exitosamente. Bienvenido/a a SysTeam');
      
      setTimeout(() => {
        navigate('/diagnostico');
      }, 2000);
      
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setGlobalError('Este email ya tiene una cuenta. Intenta iniciar sesión.');
      } else if (err.code === 'auth/weak-password') {
        setGlobalError('La contraseña es muy débil. Usa al menos 8 caracteres.');
      } else if (err.code === 'auth/network-request-failed') {
        setGlobalError('Sin conexión. Verifica tu internet e intenta de nuevo.');
      } else {
        setGlobalError('Ocurrió un error. Intenta de nuevo o contacta a SysTeam.');
      }
      setSubmitting(false);
    }
  };

  const handleLogoutAndContinue = async () => {
    await logout();
    // Refresh page ensures code is preserved
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sys-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sys-accent"></div>
      </div>
    );
  }

  // Handle Logged In user trying to use code
  if (user && code && errorType === 'none' && invitation && user.email !== invitation.email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sys-bg px-4">
        <div className="card-geometric max-w-md w-full text-center">
          <div className="w-12 h-12 bg-sys-input border border-sys-border rounded-full flex items-center justify-center text-sys-text-sec mx-auto mb-4">
            <User size={24} />
          </div>
          <h2 className="text-xl font-bold mb-4">Cierre de sesión necesario</h2>
          <p className="text-sys-text-sec mb-6 text-sm">
            Estás logueado como <span className="text-sys-text-main font-bold">{user.email}</span>. <br/>
            Para activar la invitación de <span className="text-sys-text-main font-bold">{invitation.email}</span>, primero debes cerrar sesión.
          </p>
          <div className="flex flex-col gap-3">
            <button 
              onClick={handleLogoutAndContinue}
              className="btn-geometric-primary flex items-center justify-center gap-2"
            >
              <LogOut size={16} /> Cerrar sesión y continuar
            </button>
            <button 
              onClick={() => navigate('/dashboard')}
              className="px-4 py-3 bg-sys-input border border-sys-border rounded font-bold text-sm text-sys-text-sec hover:text-sys-text-main transition-colors"
            >
              Cancelar y volver a mi cuenta
            </button>
          </div>
        </div>
      </div>
    );
  }

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

            <div className="card-geometric p-8">
              {errorType === 'missing' && (
                <div className="text-center">
                  <div className="w-12 h-12 bg-sys-input border border-sys-border rounded-full flex items-center justify-center text-sys-text-sec mx-auto mb-4">
                    <LogOut size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-sys-text-main mb-2">Código necesario</h3>
                  <p className="text-sm text-sys-text-sec mb-6">Para registrarte necesitas un código de invitación. Solicítalo a SysTeam.</p>
                  <button onClick={() => navigate('/')} className="btn-geometric-primary w-full">Ir al inicio</button>
                </div>
              )}

              {errorType === 'invalid' && (
                <div className="text-center">
                  <div className="w-12 h-12 bg-sys-error/10 border border-sys-error/30 rounded-full flex items-center justify-center text-sys-error mx-auto mb-4">
                    <AlertTriangle size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-sys-text-main mb-2">Código no válido</h3>
                  <p className="text-sm text-sys-text-sec mb-6">Este código de invitación no existe. Verifica con SysTeam que tienes el link correcto.</p>
                  <button onClick={() => navigate('/')} className="btn-geometric-primary w-full">Ir al inicio</button>
                </div>
              )}

              {errorType === 'activated' && (
                <div className="text-center">
                  <div className="w-12 h-12 bg-sys-accent/10 border border-sys-accent/30 rounded-full flex items-center justify-center text-sys-accent mx-auto mb-4">
                    <ShieldCheck size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-sys-text-main mb-2">Esta invitación ya fue activada</h3>
                  <p className="text-sm text-sys-text-sec mb-6">Tu cuenta ya está creada. Inicia sesión con tu email y contraseña.</p>
                  <button onClick={() => navigate('/login')} className="btn-geometric-primary w-full mb-4">Iniciar sesión</button>
                  <Link to="/login" className="text-xs text-sys-text-sec hover:text-sys-text-main transition-colors block text-center mt-2">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              )}

              {errorType === 'expired' && (
                <div className="text-center">
                  <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center text-amber-500 mx-auto mb-4">
                    <AlertTriangle size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-sys-text-main mb-2">Invitación expirada</h3>
                  <p className="text-sm text-sys-text-sec mb-6">Esta invitación ya no es válida. Contacta a SysTeam para que te envíen una nueva.</p>
                  <button onClick={() => navigate('/')} className="btn-geometric-primary w-full">Ir al inicio</button>
                </div>
              )}

              {errorType === 'none' && invitation && (
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-white mb-2 text-center">Activa tu cuenta</h2>
                  <p className="text-sm text-sys-text-sec mb-8 text-center">
                    Bienvenido/a a SysTeam, <span className="font-bold text-white">{invitation.fullName}</span>. Crea tu contraseña para comenzar tu diagnóstico.
                  </p>

                  <form onSubmit={handleRegister} className="space-y-4">
                    {globalError && (
                      <div className={`p-3 border rounded-[8px] text-xs flex items-center gap-2 ${globalError.startsWith('✓') ? 'bg-green-500/10 border-green-500/30 text-green-400 font-bold' : 'bg-sys-error/10 border-sys-error/30 text-sys-error'}`}>
                        {!globalError.startsWith('✓') && <AlertTriangle size={14} className="shrink-0" />}
                        {globalError.startsWith('✓') ? globalError.substring(2) : globalError}
                      </div>
                    )}

                    <div className="relative group">
                      <label className="label-geometric">Nombre completo</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-sys-text-mut" size={18} />
                        <input 
                          type="text" 
                          className="input-geometric pl-10 cursor-not-allowed bg-black/40 text-sys-text-mut border-sys-border/50 focus:border-sys-border/50"
                          value={invitation.fullName}
                          readOnly
                          title="Este dato viene de tu invitación"
                        />
                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-sys-text-mut" size={14} />
                      </div>
                    </div>

                    <div className="relative group">
                      <label className="label-geometric">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-sys-text-mut" size={18} />
                        <input 
                          type="email" 
                          className="input-geometric pl-10 cursor-not-allowed bg-black/40 text-sys-text-mut border-sys-border/50 focus:border-sys-border/50"
                          value={invitation.email}
                          readOnly
                          title="Este dato viene de tu invitación"
                        />
                        <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-sys-text-mut" size={14} />
                      </div>
                    </div>

                    <div>
                      <label className="label-geometric">Contraseña</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-sys-text-sec" size={18} />
                        <input 
                          type={showPassword ? "text" : "password"} 
                          className="input-geometric pl-10 pr-10"
                          placeholder="Mínimo 8 caracteres"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-sys-text-mut hover:text-sys-text-sec"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      
                      {password && (
                        <div className="mt-2">
                          <div className="flex h-1 gap-1 mb-2">
                            <div className={`flex-1 rounded-full ${strength >= 1 ? 'bg-sys-error' : 'bg-sys-input'}`}></div>
                            <div className={`flex-1 rounded-full ${strength >= 2 ? 'bg-amber-500' : 'bg-sys-input'}`}></div>
                            <div className={`flex-1 rounded-full ${strength >= 3 ? 'bg-green-500' : 'bg-sys-input'}`}></div>
                          </div>
                          <div className="text-[10px] space-y-1">
                            <div className={`flex items-center gap-1 ${hasMinLength ? 'text-green-500' : 'text-sys-text-mut'}`}>
                              {hasMinLength ? '✓' : '✗'} Mínimo 8 caracteres
                            </div>
                            <div className={`flex items-center gap-1 ${hasLetter ? 'text-green-500' : 'text-sys-text-mut'}`}>
                              {hasLetter ? '✓' : '✗'} Al menos 1 letra
                            </div>
                            <div className={`flex items-center gap-1 ${hasNumber ? 'text-green-500' : 'text-sys-text-mut'}`}>
                              {hasNumber ? '✓' : '✗'} Al menos 1 número
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label className="label-geometric">Confirmar contraseña</label>
                      <div className="relative">
                        <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-sys-text-sec" size={18} />
                        <input 
                          type={showConfirmPassword ? "text" : "password"} 
                          className={`input-geometric pl-10 pr-10 ${confirmPassword && !passwordsMatch ? 'border-sys-error focus:border-sys-error' : ''}`}
                          placeholder="Repite tu contraseña"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-sys-text-mut hover:text-sys-text-sec"
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {confirmPassword && !passwordsMatch && (
                        <p className="text-[10px] text-sys-error mt-1">Las contraseñas no coinciden</p>
                      )}
                    </div>

                    <div className="flex items-start gap-3 mt-4 pt-2">
                      <input
                        type="checkbox"
                        id="terms"
                        checked={acceptedTerms}
                        onChange={e => setAcceptedTerms(e.target.checked)}
                        className="mt-1 flex-shrink-0 cursor-pointer accent-sys-accent bg-sys-input border-sys-border"
                      />
                      <label htmlFor="terms" className="text-xs text-sys-text-sec leading-relaxed cursor-pointer hover:text-sys-text-main transition-colors">
                        Acepto los términos de uso y la política de privacidad de SysTeam.
                      </label>
                    </div>
                    
                    <button 
                      type="submit"
                      disabled={!isFormValid}
                      className={`btn-geometric-primary w-full flex items-center justify-center text-base mt-4 !py-4 
                        ${!isFormValid ? 'opacity-50 cursor-not-allowed hover:bg-sys-accent hover:text-black' : ''}
                      `}
                    >
                      {submitting ? 'Creando tu cuenta...' : 'Activar mi cuenta y comenzar'}
                    </button>

                    <div className="text-center pt-4 border-t border-sys-border mt-6">
                      <p className="text-sm text-sys-text-sec">
                        ¿Ya tienes cuenta? <Link to="/login" className="text-sys-text-main font-bold hover:text-sys-accent transition-colors">Inicia sesión aquí</Link>
                      </p>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}


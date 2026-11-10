import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';
import logo from '../assets/ruta-cero-logo.png';

function errorMessage(error: unknown) {
  const code = (error as { code?: string }).code;
  if (code === 'auth/invalid-email') return 'Revisa tu correo electrónico.';
  if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements') return 'La contraseña no cumple los requisitos. Usa al menos 8 caracteres.';
  if (code === 'auth/invalid-credential') return 'Si ya tienes cuenta en Systeam, usa tu contraseña actual. Puedes recuperarla desde Iniciar sesión.';
  if (code === 'auth/too-many-requests') return 'Espera unos minutos antes de volver a intentarlo.';
  if (code === 'auth/network-request-failed') return 'Revisa tu conexión e intenta nuevamente.';
  if (code) return 'No pudimos completar el registro. Intenta nuevamente.';
  return error instanceof Error ? error.message : 'No pudimos completar el registro.';
}

export default function RutaCeroRegister() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/ruta-cero/registration', { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('No pudimos cargar el registro.');
        const config = await response.json();
        if (!controller.signal.aborted) setEnabled(config.enabled === true);
      }).catch(() => { if (!controller.signal.aborted) setEnabled(false); });
    return () => controller.abort();
  }, []);

  async function verifyEmail() {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
    setNotice('Te enviamos un correo de verificación. Abre el enlace y luego vuelve aquí para activar tu acceso.');
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (password !== confirmation) { setError('Las contraseñas deben coincidir.'); return; }
    setBusy(true);
    try {
      const address = email.trim().toLowerCase();
      try {
        const credential = await createUserWithEmailAndPassword(auth, address, password);
        await updateProfile(credential.user, { displayName: fullName.trim() });
      }
      catch (err) {
        if ((err as { code?: string }).code !== 'auth/email-already-in-use') throw err;
        await signInWithEmailAndPassword(auth, address, password);
      }
      setPassword('');
      setConfirmation('');
      if (auth.currentUser?.emailVerified) await activate();
      else await verifyEmail();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  async function activate() {
    const account = auth.currentUser;
    if (!account) throw new Error('Inicia sesión para continuar.');
    await account.reload();
    if (!account.emailVerified) throw new Error('Tu correo aún no está verificado. Abre el enlace del mensaje que recibiste.');
    const token = await account.getIdToken(true);
    const response = await fetch('/api/ruta-cero/registration/activate', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(fullName.trim() ? { fullName: fullName.trim() } : {})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No pudimos activar tu acceso.');
    navigate('/', { replace: true });
  }

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-lg px-4 py-12">
    <img src={logo} alt="Ruta Cero" className="mx-auto mb-7 w-48" />
    <div className="rounded-2xl border border-sys-border bg-sys-card p-6 sm:p-8">
      <h1 className="text-3xl font-bold">Crea tu acceso a Ruta Cero</h1>
      <p className="mb-6 mt-3 text-sm text-sys-text-sec">Usa el correo de tu compra. Verificaremos tu correo y tu inscripción antes de habilitar el portal.</p>
      {enabled === null ? <p role="status">Preparando el registro…</p> : !enabled ?
        <p role="status">El registro aún no está disponible. Intenta más tarde o contacta al equipo de Ruta Cero.</p> :
        user ? <div className="grid gap-3">
          <p className="break-words text-sm">Sesión iniciada con <strong>{user.email}</strong>.</p>
          <button className="btn-geometric-primary" disabled={busy} onClick={() => void perform(activate)}>Verificar y activar mi acceso</button>
          <button className="btn-geometric-secondary" disabled={busy} onClick={() => void perform(verifyEmail)}>Enviar correo de verificación</button>
          <button className="text-sm underline" disabled={busy} onClick={() => void perform(logout)}>Usar otro correo</button>
          <Link className="text-center text-sm underline" to="/">Volver al portal</Link>
        </div> :
        <form onSubmit={register} className="grid gap-4">
          <label className="grid gap-1 text-sm">Nombre
            <input className="input-geometric" autoComplete="name" required maxLength={120} value={fullName} onChange={event => setFullName(event.target.value)} disabled={busy} />
          </label>
          <label className="grid gap-1 text-sm">Correo de tu compra
            <input className="input-geometric" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
          </label>
          <label className="grid gap-1 text-sm">Contraseña
            <input className="input-geometric" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
          </label>
          <label className="grid gap-1 text-sm">Repite tu contraseña
            <input className="input-geometric" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
          </label>
          <button className="btn-geometric-primary" disabled={busy}>{busy ? 'Preparando tu acceso…' : 'Crear cuenta y verificar correo'}</button>
          <p className="text-xs text-sys-text-sec">Si ya tienes cuenta en Systeam, <Link className="underline" to="/login">inicia sesión</Link> y luego activa tu inscripción.</p>
        </form>}
      {notice && <p className="mt-4 text-sm" role="status">{notice}</p>}
      {error && <p className="mt-4 text-sm text-sys-error" role="alert">{error}</p>}
      <p className="mt-6 text-center text-sm"><Link className="text-sys-accent underline" to="/login">Iniciar sesión</Link></p>
    </div>
  </section>;
}

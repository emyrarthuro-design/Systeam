import { auth } from './firebase';

export async function learningRequest(path: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Inicia sesión para continuar.');
  const headers = new Headers(init?.headers);
  headers.set('Authorization', 'Bearer ' + token);
  const response = await fetch('/api/ruta-cero/learning' + path, { ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || 'No se pudo completar la operación.');
  }
  return response;
}

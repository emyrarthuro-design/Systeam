import React, { useState } from 'react';

export default function AdminSettings() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleCreateTestData = async () => {
    setLoading(true);
    setMessage('');
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await setDoc(doc(db, 'invitations', 'STM-PEND01'), {
        code: 'STM-PEND01',
        email: 'laura.test@systeam.com',
        fullName: 'Laura Vega',
        country: 'Colombia',
        status: 'pending',
        createdAt: now.toISOString(),
        createdBy: 'info@emyrarthuro.com',
        activatedAt: null,
        internalNotes: 'Dato de prueba',
        expiresAt
      });

      await setDoc(doc(db, 'invitations', 'STM-PEND02'), {
        code: 'STM-PEND02',
        email: 'diego.test@systeam.com',
        fullName: 'Diego Torres',
        country: 'México',
        status: 'pending',
        createdAt: now.toISOString(),
        createdBy: 'info@emyrarthuro.com',
        activatedAt: null,
        internalNotes: 'Dato de prueba',
        expiresAt
      });

      setMessage('Datos de prueba creados exitosamente. Los alumnos requieren Firebase Auth real para funcionar logueados, pero las invitaciones ya están listadas.');
    } catch (err: any) {
      console.error(err);
      setMessage('Error al crear datos de prueba: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-sans">Configuración</h1>
      </div>

      <div className="card-geometric">
        <h2 className="text-lg font-bold mb-4">Datos de Prueba</h2>
        <p className="text-sm text-sys-text-sec mb-6">
          Genera invitaciones y perfiles de alumnos de prueba para ver el panel en acción con datos reales.
        </p>
        <button 
          onClick={handleCreateTestData}
          disabled={loading}
          className="btn-geometric-secondary border-sys-accent text-sys-accent hover:bg-sys-accent-alpha disabled:opacity-50"
        >
          {loading ? 'Creando...' : 'Regenerar datos de prueba'}
        </button>
        {message && (
          <p className="mt-4 text-sm text-sys-accent">{message}</p>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { collection, getDocs, doc, deleteDoc, setDoc, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { downloadCSV } from '../../lib/csv';

export default function AdminSettings() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [loadingCsv, setLoadingCsv] = useState(false);
  const [messageCsv, setMessageCsv] = useState('');

  const [loadingClean, setLoadingClean] = useState(false);
  const [messageClean, setMessageClean] = useState('');

  const handleExportDiagnosticsCSV = async () => {
    setLoadingCsv(true);
    setMessageCsv('');
    try {
      const q = collection(db, 'diagnostics');
      const snap = await getDocs(q);

      const headers = [
        'Nombre',
        'Email',
        'Perfil Predominante',
        'Perfil Secundario',
        'Bloqueo Principal',
        'Oportunidad Principal',
        'Creencia Limitante',
        'Prioridad Incubadora',
        'AE',
        'SE',
        'CI',
        'CA',
        'CO',
        'CC',
        'SV',
        'ES',
        'Fecha Completado',
        'Estado'
      ];

      const data = snap.docs.map(docSnap => {
        const diag = docSnap.data();
        const analysis = diag.analysis || {};
        const scores = analysis.variables_scores || {};
        
        return [
          diag.userName || '',
          diag.userEmail || '',
          analysis.perfil_predominante || '',
          analysis.perfil_secundario || '',
          analysis.bloqueo_principal || '',
          analysis.oportunidad_principal || '',
          analysis.creencia_limitante_principal || '',
          analysis.prioridad_incubadora || '',
          scores.AE ?? '',
          scores.SE ?? '',
          scores.CI ?? '',
          scores.CA ?? '',
          scores.CO ?? '',
          scores.CC ?? '',
          scores.SV ?? '',
          scores.ES ?? '',
          diag.completedAt || '',
          diag.status || ''
        ];
      });

      const dateStr = new Date().toISOString().split('T')[0];
      downloadCSV(`systeam-diagnosticos-${dateStr}.csv`, headers, data);
      setMessageCsv(`Exportados ${data.length} diagnósticos exitosamente.`);
    } catch (err: any) {
      console.error(err);
      setMessageCsv('Error al exportar CSV: ' + err.message);
    } finally {
      setLoadingCsv(false);
    }
  };

  const handleCleanTestData = async () => {
    if (!window.confirm("¿Seguro que deseas eliminar todos los datos de prueba? Esto incluye cuentas con @systeam.com")) return;
    
    setLoadingClean(true);
    setMessageClean('');
    try {
      // Eliminar invitaciones específicas
      try { await deleteDoc(doc(db, 'invitations', 'STM-PEND01')); } catch (e) {}
      try { await deleteDoc(doc(db, 'invitations', 'STM-PEND02')); } catch (e) {}
      
      // Eliminar users usando query con where
      const qUsers = query(collection(db, 'users'), where('email', '>=', ''));
      const usersSnap = await getDocs(qUsers);
      let usersDeleted = 0;
      for (const userDoc of usersSnap.docs) {
        const data = userDoc.data();
        if (data.email && data.email.endsWith('@systeam.com')) {
          await deleteDoc(doc(db, 'users', userDoc.id));
          usersDeleted++;
        }
      }

      // Eliminar Diagnostics usando query con where
      const qDiag = query(collection(db, 'diagnostics'), where('userEmail', '>=', ''));
      const diagsSnap = await getDocs(qDiag);
      let diagsDeleted = 0;
      for (const diagDoc of diagsSnap.docs) {
        const data = diagDoc.data();
        if (data.userEmail && data.userEmail.endsWith('@systeam.com')) {
          await deleteDoc(doc(db, 'diagnostics', diagDoc.id));
          diagsDeleted++;
        }
      }

      setMessageClean(`Limpieza exitosa. Se eliminaron ${usersDeleted} usuarios y ${diagsDeleted} diagnósticos de prueba.`);
    } catch (err: any) {
      console.error(err);
      setMessageClean('Error al limpiar datos: ' + err.message);
    } finally {
      setLoadingClean(false);
    }
  };

  const handleCreateTestData = async () => {
    setLoading(true);
    setMessage('');
    try {
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
        <h2 className="text-lg font-bold mb-4">Exportar diagnósticos a CSV</h2>
        <p className="text-sm text-sys-text-sec mb-6">
          Descarga un reporte consolidado de todos los diagnósticos registrados, incluyendo resultados y variables.
        </p>
        <button 
          onClick={handleExportDiagnosticsCSV}
          disabled={loadingCsv}
          className="btn-geometric-primary disabled:opacity-50"
        >
          {loadingCsv ? 'Exportando...' : 'Exportar diagnósticos a CSV'}
        </button>
        {messageCsv && (
          <p className="mt-4 text-sm text-sys-accent">{messageCsv}</p>
        )}
      </div>

      <div className="card-geometric">
        <h2 className="text-lg font-bold mb-4">Limpiar datos de prueba</h2>
        <p className="text-sm text-sys-text-sec mb-6">
          Elimina todos los registros de invitaciones de prueba, usuarios y diagnósticos cuyo correo termine en @systeam.com.
        </p>
        <button 
          onClick={handleCleanTestData}
          disabled={loadingClean}
          className="px-6 py-3 font-bold text-xs uppercase tracking-widest bg-rose-500 hover:bg-rose-600 text-white transition-colors rounded-sm shadow-lg shadow-rose-500/20 disabled:opacity-50"
        >
          {loadingClean ? 'Limpiando...' : 'Limpiar datos de prueba'}
        </button>
        {messageClean && (
          <p className="mt-4 text-sm text-sys-accent">{messageClean}</p>
        )}
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

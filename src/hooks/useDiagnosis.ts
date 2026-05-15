import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Diagnosis } from '../types';

export function useDiagnosis(userId: string | undefined) {
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setDiagnosis(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'diagnostics', userId), (snapshot) => {
      if (snapshot.exists()) {
        const docData = snapshot.data();
        setDiagnosis({
          uid: docData.userId,
          status: docData.status,
          currentBlock: Object.keys(docData.responses || {}).length + 1,
          answers: docData.responses || {},
          progress: calculateProgress(docData.responses || {}),
          createdAt: docData.startedAt,
          updatedAt: new Date().toISOString(),
          analysis: docData.results,
          internalNote: docData.internalNotes
        });
      } else {
        setDiagnosis(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error loading diagnosis", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  return { diagnosis, loading };
}

function calculateProgress(responses: any) {
  const totalBlocks = 8;
  const completedBlocks = Object.keys(responses || {}).filter(k => k.startsWith('block')).length;
  return Math.min(Math.round((completedBlocks / totalBlocks) * 100), 100);
}

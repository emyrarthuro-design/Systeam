import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ActivityLog, Diagnosis, Invitation, UserProfile } from '../types';

export async function createOrUpdateStudentProfile(userAuth: { uid: string, email: string }, invitation: Partial<Invitation>) {
  const profileData = {
    uid: userAuth.uid,
    email: userAuth.email,
    fullName: invitation.fullName,
    country: invitation.country,
    invitationCode: invitation.code,
    role: 'student',
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    diagnosticStatus: 'not_started'
  };

  try {
    await setDoc(doc(db, 'users', userAuth.uid), profileData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userAuth.uid}`);
  }
}

export async function fetchDiagnosis(userId: string) {
  const path = `diagnostics/${userId}`;
  try {
    const docRef = doc(db, 'diagnostics', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as Diagnosis;
    }
    return null;
  } catch (error) {
    if (import.meta.env.DEV) console.error("Error fetching diagnosis:", error);
    return null;
  }
}

export async function saveDiagnosisDebounced(userId: string, data: any) {
  const path = `diagnostics/${userId}`;
  try {
    const docRef = doc(db, 'diagnostics', userId);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    if (import.meta.env.DEV) console.error("Error saving diagnosis:", error);
  }
}

export async function updateUserDiagnosisStatus(userId: string, status: string) {
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, { diagnosticStatus: status });
  } catch (error) {
    if (import.meta.env.DEV) console.error("Error updating status:", error);
  }
}

export async function logActivity(log: Omit<ActivityLog, 'id' | 'timestamp'>) {
  const path = 'activity_logs';
  try {
    await addDoc(collection(db, path), {
      ...log,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (import.meta.env.DEV) console.error("Error logging activity:", error);
    // Optional: handleFirestoreError(error, OperationType.WRITE, path);
  }
}

import { isSuperAdmin, isAnyAdmin } from './admins';

export async function ensureSuperAdmin(userId: string, email: string) {
  if (!isSuperAdmin(email)) return;
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().role !== 'super_admin') {
      await updateDoc(docRef, { role: 'super_admin', isSystemUser: true });
    } else if (!snap.exists()) {
      await setDoc(docRef, {
        uid: userId,
        email: email,
        fullName: 'Emyr Arturo',
        role: 'super_admin',
        country: 'Panamá',
        createdAt: new Date().toISOString(),
        isSystemUser: true
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function ensureAdmin(userId: string, email: string) {
  if (!isAnyAdmin(email) || isSuperAdmin(email)) return;
  const path = `users/${userId}`;
  try {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().role !== 'admin') {
      await updateDoc(docRef, { role: 'admin' });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteInvitation(id: string) {
  const path = `invitations/${id}`;
  try {
    await deleteDoc(doc(db, 'invitations', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteUserCompletely(params: {
  targetUid: string;
  targetEmail: string;
  confirmationName: string;
}): Promise<{
  success: boolean;
  summary?: any;
  error?: string;
}> {
  try {
    const { auth } = await import('./firebase');
    const user = auth.currentUser;
    if (!user) throw new Error('No authenticated user');
    
    const idToken = await user.getIdToken();
    
    const response = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(params)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }
    
    return { success: true, summary: data.summary };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}


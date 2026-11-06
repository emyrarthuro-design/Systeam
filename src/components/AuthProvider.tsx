import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { isSuperAdmin as checkSuperAdmin, isAnyAdmin as checkAnyAdmin } from '../lib/admins';

interface AuthContextType {
  user: { uid: string, email: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isSuperAdmin: false,
  logout: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ uid: string, email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = undefined;
      }

      if (firebaseUser) {
        setUser({ uid: firebaseUser.uid, email: firebaseUser.email || '' });
        setEmailVerified(firebaseUser.emailVerified);
        
        // Listen to profile changes
        unsubProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile(data);
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          if (import.meta.env.DEV) console.error('Error en listener de perfil:', error);
          setProfile(null);
          setLoading(false);
        });
      } else {
        setUser(null);
        setEmailVerified(false);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      if (unsubProfile) unsubProfile();
      unsubscribe();
    };
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  // Los roles del perfil de Firestore no conceden privilegios por sí solos.
  // La política del servidor exige correo verificado y cuenta autorizada.
  const isSuperAdmin = emailVerified && checkSuperAdmin(user?.email);
  const isAdmin = emailVerified && checkAnyAdmin(user?.email);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isSuperAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

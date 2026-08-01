import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { syncUserProfile } from "./syncService";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  syncing: boolean;
  setSyncing: (val: boolean) => void;
  loginEmail: (email: string, pass: string) => Promise<void>;
  registerEmail: (email: string, pass: string, name?: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  loginAnonymous: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  syncing: false,
  setSyncing: () => {},
  loginEmail: async () => {},
  registerEmail: async () => {},
  loginGoogle: async () => {},
  loginAnonymous: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        // Sync profile to cloud database
        await syncUserProfile({
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName || currentUser.email?.split("@")[0] || (currentUser.isAnonymous ? "Guest Scholar" : "Scholar User"),
          photoURL: currentUser.photoURL || "",
          createdAt: currentUser.metadata.creationTime || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const loginEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerEmail = async (email: string, pass: string, name?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (name && cred.user) {
      await updateProfile(cred.user, { displayName: name });
    }
  };

  const loginGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const loginAnonymous = async () => {
    await signInAnonymously(auth);
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        syncing,
        setSyncing,
        loginEmail,
        registerEmail,
        loginGoogle,
        loginAnonymous,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

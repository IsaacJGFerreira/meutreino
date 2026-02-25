import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  doc,
  onSnapshot,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';

export type UserRole = 'admin' | 'aluno' | 'treinador' | null;

export type UserDoc = {
  name: string;
  email: string;
  status: 'pending' | 'approved';
  role: UserRole;
  createdAt?: Timestamp | null;
};

type AuthUserContextValue = {
  loading: boolean;
  firebaseUser: User | null;
  userDoc: UserDoc | null;
};

const AuthUserContext = createContext<AuthUserContextValue | undefined>(undefined);

export function AuthUserProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }

    let unsubscribeUserDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      setFirebaseUser(user);

      if (!user) {
        setUserDoc(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      const userRef = doc(db, 'users', user.uid);
      unsubscribeUserDoc = onSnapshot(userRef, (snapshot) => {
        if (!snapshot.exists()) {
          setUserDoc(null);
          setLoading(false);
          return;
        }

        const data = snapshot.data() as DocumentData;
        setUserDoc({
          name: typeof data.name === 'string' ? data.name : '',
          email: typeof data.email === 'string' ? data.email : '',
          status: data.status === 'approved' ? 'approved' : 'pending',
          role:
            data.role === 'admin' || data.role === 'aluno' || data.role === 'treinador'
              ? data.role
              : null,
          createdAt: data.createdAt ?? null,
        });
        setLoading(false);
      }, () => {
        setUserDoc(null);
        setLoading(false);
      });
    });

    return () => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }
      unsubscribeAuth();
    };
  }, []);

  const value = useMemo(
    () => ({
      loading,
      firebaseUser,
      userDoc,
    }),
    [firebaseUser, loading, userDoc],
  );

  return <AuthUserContext.Provider value={value}>{children}</AuthUserContext.Provider>;
}

export function useAuthUser() {
  const context = useContext(AuthUserContext);

  if (!context) {
    throw new Error('useAuthUser must be used inside AuthUserProvider');
  }

  return context;
}

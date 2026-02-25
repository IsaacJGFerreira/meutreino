import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

type PendingUser = {
  id: string;
  name: string;
  email: string;
  createdAt: Timestamp | null;
};

type ActionType = 'aluno' | 'treinador' | 'blocked';

export function AdminPage() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingByUser, setLoadingByUser] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setError('Firebase não está configurado.');
      setLoading(false);
      return;
    }

    const usersRef = collection(db, 'users');
    const pendingQuery = query(usersRef, where('status', '==', 'pending'));

    const unsubscribe = onSnapshot(
      pendingQuery,
      (snapshot) => {
        const users = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data();

          return {
            id: docSnapshot.id,
            name: typeof data.name === 'string' ? data.name : 'Sem nome',
            email: typeof data.email === 'string' ? data.email : 'Sem e-mail',
            createdAt: (data.createdAt as Timestamp | undefined) ?? null,
          };
        });

        setPendingUsers(users);
        setLoading(false);
      },
      (snapshotError) => {
        console.error(snapshotError);
        setError('Não foi possível carregar as solicitações pendentes.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const hasPendingUsers = useMemo(() => pendingUsers.length > 0, [pendingUsers.length]);

  async function handleAction(userId: string, action: ActionType) {
    if (!db) {
      setError('Firebase não está configurado.');
      return;
    }

    setError(null);
    setFeedback(null);
    setLoadingByUser((prev) => ({ ...prev, [userId]: true }));

    try {
      const userDocRef = doc(db, 'users', userId);

      if (action === 'blocked') {
        await updateDoc(userDocRef, {
          status: 'blocked',
          role: null,
        });
        setFeedback('Usuário bloqueado com sucesso.');
      } else {
        await updateDoc(userDocRef, {
          status: 'approved',
          role: action,
          approvedAt: serverTimestamp(),
        });
        setFeedback(
          action === 'aluno'
            ? 'Usuário aprovado como aluno com sucesso.'
            : 'Usuário aprovado como treinador com sucesso.',
        );
      }
    } catch (actionError) {
      console.error(actionError);
      setError('Não foi possível executar a ação. Tente novamente.');
    } finally {
      setLoadingByUser((prev) => ({ ...prev, [userId]: false }));
    }
  }

  function formatDate(value: Timestamp | null) {
    if (!value) {
      return 'Sem data';
    }

    return value.toDate().toLocaleString('pt-BR');
  }

  if (loading) {
    return <p>Carregando solicitações pendentes...</p>;
  }

  return (
    <section>
      <h2>Painel de Aprovação</h2>
      <p>Gerencie usuários com status pendente.</p>
      {feedback ? <p role="status">{feedback}</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      {!hasPendingUsers ? (
        <p>Nenhum usuário pendente no momento.</p>
      ) : (
        <ul>
          {pendingUsers.map((user) => {
            const userLoading = loadingByUser[user.id] === true;

            return (
              <li key={user.id}>
                <p>
                  <strong>{user.name}</strong>
                </p>
                <p>{user.email}</p>
                <p>Cadastro: {formatDate(user.createdAt)}</p>
                <div>
                  <button
                    type="button"
                    onClick={() => handleAction(user.id, 'aluno')}
                    disabled={userLoading}
                  >
                    {userLoading ? 'Processando...' : 'Aprovar como aluno'}
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() => handleAction(user.id, 'treinador')}
                    disabled={userLoading}
                  >
                    {userLoading ? 'Processando...' : 'Aprovar como treinador'}
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() => handleAction(user.id, 'blocked')}
                    disabled={userLoading}
                  >
                    {userLoading ? 'Processando...' : 'Bloquear'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

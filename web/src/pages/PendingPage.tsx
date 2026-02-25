import { signOut } from 'firebase/auth';
import { auth } from '../firebase/firebase';
import { useAuthUser } from '../hooks/useAuthUser';

export function PendingPage() {
  const { userDoc } = useAuthUser();
  const isBlocked = userDoc?.status === 'blocked';

  async function handleSignOut() {
    if (!auth) {
      return;
    }

    await signOut(auth);
  }

  return (
    <main>
      <h2>{isBlocked ? 'Conta bloqueada' : 'Aguardando aprovação'}</h2>
      <p>
        Usuário: <strong>{userDoc?.name || userDoc?.email || 'Conta cadastrada'}</strong>
      </p>
      <p>
        {isBlocked
          ? 'Sua conta foi bloqueada por um administrador.'
          : 'Sua conta foi criada e está pendente de aprovação por um administrador.'}
      </p>
      <button type="button" onClick={handleSignOut}>
        Sair
      </button>
    </main>
  );
}

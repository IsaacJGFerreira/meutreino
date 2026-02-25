import { signOut } from 'firebase/auth';
import { NavLink, Outlet } from 'react-router-dom';
import { auth } from '../firebase/firebase';
import { useAuthUser } from '../hooks/useAuthUser';

export function AppShell() {
  const { userDoc } = useAuthUser();

  async function handleSignOut() {
    if (!auth) {
      return;
    }

    await signOut(auth);
  }

  return (
    <main>
      <h1>MeuTreino Web</h1>
      <p>
        {userDoc?.name} ({userDoc?.email})
      </p>
      <nav>
        <NavLink to="/app/admin">Admin</NavLink> | <NavLink to="/app/aluno">Aluno</NavLink> |{' '}
        <NavLink to="/app/treinador">Treinador</NavLink>
      </nav>
      <button type="button" onClick={handleSignOut}>
        Sair
      </button>
      <section>
        <Outlet />
      </section>
    </main>
  );
}

import { NavLink, Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <main>
      <h1>MeuTreino Web</h1>
      <nav>
        <NavLink to="/app/admin">Admin</NavLink> |{' '}
        <NavLink to="/app/aluno">Aluno</NavLink> |{' '}
        <NavLink to="/app/treinador">Treinador</NavLink>
      </nav>
      <section>
        <Outlet />
      </section>
    </main>
  );
}

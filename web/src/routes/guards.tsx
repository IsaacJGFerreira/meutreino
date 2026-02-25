import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthUser, type UserRole } from '../hooks/useAuthUser';

export type GuardProps = {
  children: ReactNode;
};

function LoadingState() {
  return <p>Carregando...</p>;
}

function SafeNavigate({ to }: { to: string }) {
  const location = useLocation();

  if (location.pathname === to) {
    return null;
  }

  return <Navigate to={to} replace />;
}

export function routeByRole(role: UserRole) {
  if (role === 'admin') {
    return '/app/admin';
  }

  if (role === 'aluno') {
    return '/app/aluno';
  }

  if (role === 'treinador') {
    return '/app/treinador';
  }

  return '/pending';
}

export function RequireAuth({ children }: GuardProps) {
  const { loading, firebaseUser } = useAuthUser();

  if (loading) {
    return <LoadingState />;
  }

  if (!firebaseUser) {
    return <SafeNavigate to="/login" />;
  }

  return <>{children}</>;
}

export function RequireApproved({ children }: GuardProps) {
  const { loading, firebaseUser, userDoc } = useAuthUser();

  if (loading) {
    return <LoadingState />;
  }

  if (!firebaseUser) {
    return <SafeNavigate to="/login" />;
  }

  if (!userDoc || userDoc.status !== 'approved') {
    return <SafeNavigate to="/pending" />;
  }

  return <>{children}</>;
}

export function RequireRole({ children, role }: GuardProps & { role: Exclude<UserRole, null> }) {
  const { loading, firebaseUser, userDoc } = useAuthUser();

  if (loading) {
    return <LoadingState />;
  }

  if (!firebaseUser) {
    return <SafeNavigate to="/login" />;
  }

  if (!userDoc || userDoc.status !== 'approved') {
    return <SafeNavigate to="/pending" />;
  }

  if (userDoc.role !== role) {
    return (
      <main>
        <h2>Sem permissão</h2>
        <p>Você não tem acesso a esta área.</p>
      </main>
    );
  }

  return <>{children}</>;
}

export function AppEntryRedirect() {
  const { loading, firebaseUser, userDoc } = useAuthUser();

  if (loading) {
    return <LoadingState />;
  }

  if (!firebaseUser) {
    return <SafeNavigate to="/login" />;
  }

  if (!userDoc || userDoc.status !== 'approved') {
    return <SafeNavigate to="/pending" />;
  }

  return <SafeNavigate to={routeByRole(userDoc.role)} />;
}

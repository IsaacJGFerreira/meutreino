import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthUser, type UserRole } from '../hooks/useAuthUser';

export type GuardProps = {
  children: ReactNode;
};

export function AuthGuard({ children }: GuardProps) {
  const { loading, firebaseUser } = useAuthUser();

  if (loading) {
    return <p>Carregando...</p>;
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export function ApprovedGuard({ children }: GuardProps) {
  const { loading, firebaseUser, userDoc } = useAuthUser();

  if (loading) {
    return <p>Carregando...</p>;
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  if (!userDoc || userDoc.status !== 'approved') {
    return <Navigate to="/pending" replace />;
  }

  return <>{children}</>;
}

export function RoleGuard({ children, role }: GuardProps & { role: UserRole }) {
  const { loading, userDoc } = useAuthUser();

  if (loading) {
    return <p>Carregando...</p>;
  }

  if (!userDoc || userDoc.status !== 'approved') {
    return <Navigate to="/pending" replace />;
  }

  if (!role || userDoc.role === role) {
    return <>{children}</>;
  }

  if (userDoc.role === 'admin') {
    return <Navigate to="/app/admin" replace />;
  }

  if (userDoc.role === 'aluno') {
    return <Navigate to="/app/aluno" replace />;
  }

  if (userDoc.role === 'treinador') {
    return <Navigate to="/app/treinador" replace />;
  }

  return <Navigate to="/pending" replace />;
}

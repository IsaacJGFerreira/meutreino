import { ReactNode } from 'react';

export type GuardProps = {
  children: ReactNode;
};

export function AuthGuard({ children }: GuardProps) {
  return <>{children}</>;
}

export function ApprovedGuard({ children }: GuardProps) {
  return <>{children}</>;
}

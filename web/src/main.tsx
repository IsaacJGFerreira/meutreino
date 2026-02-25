import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { firebaseEnvConfigured } from './firebase/firebase';
import { AuthUserProvider } from './hooks/useAuthUser';
import { AdminPage } from './pages/AdminPage';
import { AlunoPage } from './pages/AlunoPage';
import { LoginPage } from './pages/LoginPage';
import { PendingPage } from './pages/PendingPage';
import { SignupPage } from './pages/SignupPage';
import { TreinadorPage } from './pages/TreinadorPage';
import { ApprovedGuard, AuthGuard, RoleGuard } from './routes/guards';
import './styles.css';

function FirebaseConfigBanner() {
  if (firebaseEnvConfigured) {
    return null;
  }

  return (
    <div role="alert">
      Firebase env not configured. Configure your .env file before using auth and data features.
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthUserProvider>
      <BrowserRouter>
        <FirebaseConfigBanner />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/pending"
            element={
              <AuthGuard>
                <PendingPage />
              </AuthGuard>
            }
          />
          <Route
            path="/app"
            element={
              <AuthGuard>
                <ApprovedGuard>
                  <AppShell />
                </ApprovedGuard>
              </AuthGuard>
            }
          >
            <Route index element={<Navigate to="admin" replace />} />
            <Route
              path="admin"
              element={
                <RoleGuard role="admin">
                  <AdminPage />
                </RoleGuard>
              }
            />
            <Route
              path="aluno"
              element={
                <RoleGuard role="aluno">
                  <AlunoPage />
                </RoleGuard>
              }
            />
            <Route
              path="treinador"
              element={
                <RoleGuard role="treinador">
                  <TreinadorPage />
                </RoleGuard>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthUserProvider>
  </React.StrictMode>,
);

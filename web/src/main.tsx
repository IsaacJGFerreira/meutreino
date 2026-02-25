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
import { AppEntryRedirect, RequireApproved, RequireAuth, RequireRole } from './routes/guards';
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
              <RequireAuth>
                <PendingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <RequireApproved>
                  <AppShell />
                </RequireApproved>
              </RequireAuth>
            }
          >
            <Route index element={<AppEntryRedirect />} />
            <Route
              path="admin"
              element={
                <RequireRole role="admin">
                  <AdminPage />
                </RequireRole>
              }
            />
            <Route
              path="aluno"
              element={
                <RequireRole role="aluno">
                  <AlunoPage />
                </RequireRole>
              }
            />
            <Route
              path="treinador"
              element={
                <RequireRole role="treinador">
                  <TreinadorPage />
                </RequireRole>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthUserProvider>
  </React.StrictMode>,
);

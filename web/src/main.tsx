import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { AdminPage } from './pages/AdminPage';
import { AlunoPage } from './pages/AlunoPage';
import { LoginPage } from './pages/LoginPage';
import { PendingPage } from './pages/PendingPage';
import { SignupPage } from './pages/SignupPage';
import { TreinadorPage } from './pages/TreinadorPage';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/pending" element={<PendingPage />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="admin" replace />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="aluno" element={<AlunoPage />} />
          <Route path="treinador" element={<TreinadorPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);

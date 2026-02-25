import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, firebaseEnvConfigured } from '../firebase/firebase';

type UserDoc = {
  status?: string;
  role?: string | null;
};

function routeByRole(role?: string | null) {
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

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!auth || !db || !firebaseEnvConfigured) {
      setError('Firebase não está configurado.');
      return;
    }

    setLoading(true);

    try {
      const credentials = await signInWithEmailAndPassword(auth, email.trim(), password);
      const userRef = doc(db, 'users', credentials.user.uid);
      const userSnapshot = await getDoc(userRef);
      const userData = (userSnapshot.data() ?? {}) as UserDoc;

      if (userData.status !== 'approved') {
        navigate('/pending', { replace: true });
        return;
      }

      navigate(routeByRole(userData.role), { replace: true });
    } catch (submitError) {
      setError('Falha no login. Confira e-mail e senha.');
      console.error(submitError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h2>Entrar</h2>
      <form onSubmit={handleSubmit}>
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <p>
        Ainda não tem conta? <Link to="/signup">Cadastre-se</Link>
      </p>
    </main>
  );
}

import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, firebaseEnvConfigured } from '../firebase/firebase';

export function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
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
      const credentials = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const userRef = doc(db, 'users', credentials.user.uid);

      await setDoc(
        userRef,
        {
          name: name.trim(),
          email: email.trim(),
          status: 'pending',
          role: null,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );

      navigate('/pending', { replace: true });
    } catch (submitError) {
      setError('Não foi possível criar a conta. Verifique os dados e tente novamente.');
      console.error(submitError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h2>Criar conta</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Nome
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
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
            minLength={6}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Criando...' : 'Cadastrar'}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <p>
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </main>
  );
}

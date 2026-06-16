'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import styles from './login.module.css';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const response = await api.post(endpoint, { email, password });
      
      if (isLogin) {
        localStorage.setItem('token', response.token);
        router.push('/dashboard');
      } else {
        setIsLogin(true);
        setError('Account created. Please login.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authWrapper}>
      <div className={`${styles.authCard} fade-in`}>
        <h1 className={styles.title}>{isLogin ? 'Access System' : 'Create Identity'}</h1>
        <p className={styles.subtitle}>
          {isLogin ? 'Enter credentials to authorize session.' : 'Establish new secure analytics profile.'}
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Email Address</label>
            <input
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="operator@system.io"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Processing...' : isLogin ? 'Authorize' : 'Initialize'}
          </button>
        </form>

        <div className={styles.toggle}>
          {isLogin ? "No access?" : "Existing profile?"}
          <span className={styles.toggleAction} onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Initialize Profile' : 'Access Session'}
          </span>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/Auth.css';

function AuthPage({ t }) {
  const { loginWithEmail, registerWithEmail, loginWithGoogle, resetPassword } = useAuth();
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const cardRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const rotX = (-y / rect.height * 6).toFixed(2);
    const rotY = (x / rect.width * 6).toFixed(2);
    card.style.transform = `perspective(1200px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
    }
  }, []);

  const switchTab = (newTab) => {
    setTab(newTab);
    setErrors({});
    setAuthError('');
    setConfirmPassword('');
    setResetSent(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setErrors({ email: t('authEmailRequired') }); return; }
    setLoading(true);
    setAuthError('');
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setAuthError(getFriendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const errs = {};
    if (!email.trim()) errs.email = t('authEmailRequired');
    if (password.length < 6) errs.password = t('authPasswordShort');
    if (tab === 'register' && !name.trim()) errs.name = t('authNameRequired');
    if (tab === 'register' && confirmPassword !== password) errs.confirmPassword = t('authPasswordMismatch');
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    setAuthError('');
    setErrors({});
    try {
      if (tab === 'register') {
        await registerWithEmail(email, password, name.trim());
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err) {
      setAuthError(getFriendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setAuthError('');
    try {
      await loginWithGoogle();
    } catch (err) {
      const dismissed = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];
      if (!dismissed.includes(err.code)) {
        setAuthError(getFriendlyError(err.code));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const EyeOff = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );

  const EyeOn = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );

  const ErrorIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-blob auth-blob--1" />
        <div className="auth-blob auth-blob--2" />
        <div className="auth-blob auth-blob--3" />
        <div className="auth-blob auth-blob--4" />
<div className="auth-hex auth-hex--1" />
        <div className="auth-hex auth-hex--2" />
        <div className="auth-hex auth-hex--3" />
        <div className="auth-ring auth-ring--1" />
        <div className="auth-ring auth-ring--2" />
        <div className="auth-particle auth-particle--1" />
        <div className="auth-particle auth-particle--2" />
        <div className="auth-particle auth-particle--3" />
        <div className="auth-particle auth-particle--4" />
        <div className="auth-particle auth-particle--5" />
        <div className="auth-particle auth-particle--6" />
      </div>

      <div className="auth-card" ref={cardRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
          </div>
          <span className="auth-brand-name">ANTI SCAM</span>
        </div>

        {/* ── Forgot password screen ── */}
        {tab === 'forgot' && (
          <>
            <h1 className="auth-heading">{t('authForgotPassword')}</h1>
            <p className="auth-subheading">{t('authForgotDesc')}</p>

            {authError && (
              <div className="auth-error-banner">
                <ErrorIcon />{authError}
              </div>
            )}

            {resetSent ? (
              <div className="auth-error-banner" style={{ background: '#e8f5e9', borderColor: '#2e7d32', color: '#2e7d32' }}>
                {t('authResetSuccess')}
              </div>
            ) : (
              <form className="auth-form" onSubmit={handleReset} noValidate>
                <div className="auth-field">
                  <label className="auth-label">{t('authEmail')}</label>
                  <input
                    className={`auth-input ${errors.email ? 'has-error' : ''}`}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setErrors({}); }}
                    autoComplete="email"
                  />
                  {errors.email && <span className="auth-field-error">{errors.email}</span>}
                </div>
                <button type="submit" className="auth-submit-btn" disabled={loading}>
                  <span className="auth-btn-inner">
                    {loading && <span className="auth-btn-spinner" />}
                    {t('authResetBtn')}
                  </span>
                </button>
              </form>
            )}

            <p className="auth-switch">
              <button className="auth-switch-btn" onClick={() => switchTab('login')}>
                {t('authBackToLogin')}
              </button>
            </p>
          </>
        )}

        {/* ── Login / Register screen ── */}
        {tab !== 'forgot' && (
          <>
            <h1 className="auth-heading">
              {tab === 'login' ? t('authWelcomeBack') : t('authCreateAccount')}
            </h1>
            <p className="auth-subheading">{t('authTagline')}</p>

            <div className="auth-tabs">
              <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => switchTab('login')}>
                {t('authLogin')}
              </button>
              <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => switchTab('register')}>
                {t('authRegister')}
              </button>
            </div>

            <button className="auth-google-btn" onClick={handleGoogle} disabled={googleLoading || loading}>
              {googleLoading ? (
                <span className="auth-btn-spinner" />
              ) : (
                <svg className="auth-google-icon" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {t('authGoogleBtn')}
            </button>

            <div className="auth-divider">
              <div className="auth-divider-line" />
              <span className="auth-divider-text">or</span>
              <div className="auth-divider-line" />
            </div>

            {authError && (
              <div className="auth-error-banner">
                <ErrorIcon />{authError}
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {tab === 'register' && (
                <div className="auth-field">
                  <label className="auth-label">{t('authName')}</label>
                  <input
                    className={`auth-input ${errors.name ? 'has-error' : ''}`}
                    type="text"
                    placeholder="Ahmad bin Ali"
                    value={name}
                    onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
                    autoComplete="name"
                  />
                  {errors.name && <span className="auth-field-error">{errors.name}</span>}
                </div>
              )}

              <div className="auth-field">
                <label className="auth-label">{t('authEmail')}</label>
                <input
                  className={`auth-input ${errors.email ? 'has-error' : ''}`}
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })); }}
                  autoComplete="email"
                />
                {errors.email && <span className="auth-field-error">{errors.email}</span>}
              </div>

              <div className="auth-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label className="auth-label">{t('authPassword')}</label>
                  {tab === 'login' && (
                    <button type="button" className="auth-switch-btn" onClick={() => switchTab('forgot')}>
                      {t('authForgotPassword')}
                    </button>
                  )}
                </div>
                <div className="auth-input-wrap">
                  <input
                    className={`auth-input ${errors.password ? 'has-error' : ''}`}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
                    autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                    style={{ paddingRight: '44px' }}
                  />
                  <button type="button" className="auth-pw-toggle" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                    {showPassword ? <EyeOff /> : <EyeOn />}
                  </button>
                </div>
                {errors.password && <span className="auth-field-error">{errors.password}</span>}
              </div>

              {tab === 'register' && (
                <div className="auth-field">
                  <label className="auth-label">{t('authConfirmPassword')}</label>
                  <div className="auth-input-wrap">
                    <input
                      className={`auth-input ${errors.confirmPassword ? 'has-error' : ''}`}
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder={t('authConfirmPasswordPlaceholder')}
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: '' })); }}
                      autoComplete="new-password"
                      style={{ paddingRight: '44px' }}
                    />
                    <button type="button" className="auth-pw-toggle" onClick={() => setShowConfirmPassword(v => !v)} tabIndex={-1}>
                      {showConfirmPassword ? <EyeOff /> : <EyeOn />}
                    </button>
                  </div>
                  {errors.confirmPassword && <span className="auth-field-error">{errors.confirmPassword}</span>}
                </div>
              )}

              <button type="submit" className="auth-submit-btn" disabled={loading || googleLoading}>
                <span className="auth-btn-inner">
                  {loading && <span className="auth-btn-spinner" />}
                  {tab === 'login' ? t('authLoginBtn') : t('authRegisterBtn')}
                </span>
              </button>
            </form>

            <p className="auth-switch">
              {tab === 'login' ? t('authSwitchToRegister') : t('authSwitchToLogin')}
              <button className="auth-switch-btn" onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}>
                {tab === 'login' ? t('authRegister') : t('authLogin')}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function getFriendlyError(code) {
  const map = {
    'auth/user-not-found':        'No account found with this email.',
    'auth/wrong-password':        'Incorrect password. Please try again.',
    'auth/email-already-in-use':  'This email is already registered. Try signing in.',
    'auth/invalid-email':         'Please enter a valid email address.',
    'auth/too-many-requests':     'Too many attempts. Please wait a moment.',
    'auth/network-request-failed':'Network error. Check your connection.',
    'auth/invalid-credential':    'Incorrect email or password.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

export default AuthPage;

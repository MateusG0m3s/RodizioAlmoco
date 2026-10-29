import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, LogIn, AlertCircle, ShieldCheck, Sun, Moon } from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';
import BrandLogo from './BrandLogo';

export default function LoginScreen({ onLogin, theme = 'dark', toggleTheme }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!email.trim()) {
      setErrorMessage('Por favor, informe seu e-mail de acesso.');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Por favor, digite sua senha.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const res = await onLogin(email.trim(), password);
      if (!res.success) {
        setErrorMessage(res.message || 'Falha ao autenticar. Verifique suas credenciais.');
      } else {
        // Dispara a API nativa do W3C / Chrome Credential Management para salvar senha
        if (typeof window !== 'undefined' && window.PasswordCredential && navigator.credentials?.store) {
          try {
            const cred = new window.PasswordCredential({
              id: email.trim(),
              password: password,
              name: email.trim()
            });
            await navigator.credentials.store(cred);
          } catch {
            // Silencia erros de permissão ou sandbox de navegador
          }
        }
      }
    } catch {
      setErrorMessage('Ocorreu um erro ao processar a autenticação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-screen-wrapper">
      {toggleTheme && (
        <div className="login-theme-container">
          <button
            type="button"
            className="ui-btn secondary sm"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Alternar para o tema claro' : 'Alternar para o tema escuro'}
            aria-label="Alternar tema de cores"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {theme === 'dark' ? 'Claro' : 'Escuro'}
          </button>
        </div>
      )}

      <div className="login-shell animate-fade-in">
        {/* Herói com o wallpaper da scadahub */}
        <aside className="login-hero">
          <BrandLogo className="login-logo" />
          <div>
            <h2 className="login-hero-title">Rodízio de almoço</h2>
            <p className="login-hero-text">Escala de almoço e atendimento da equipe.</p>
          </div>
          <span className="login-hero-foot">EF - Mateus Silva</span>
        </aside>

        <div className="login-card-container">
          <div className="login-brand-header">
            <h1 className="login-title">Entrar</h1>
            <p className="login-subtitle">Use seu e-mail da scadahub para ver a escala da equipe.</p>
          </div>

          {errorMessage && (
            <div className="ui-alert danger animate-scale-up" role="alert">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form" name="loginForm" method="post" action="#">
            <div className="login-input-group">
              <label htmlFor="username" className="login-label">
                E-mail
              </label>
              <div className="login-input-wrapper">
                <Mail size={18} className="login-field-icon" />
                <input
                  id="username"
                  name="username"
                  type="email"
                  autoComplete="username"
                  required
                  className="login-input"
                  placeholder="seu.nome@scadahub.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="login-input-group">
              <label htmlFor="password" className="login-label">
                Senha
              </label>
              <div className="login-input-wrapper">
                <Lock size={18} className="login-field-icon" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="login-input"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="ui-btn primary login-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="btn-spinner" />
                  Autenticando…
                </>
              ) : (
                <>
                  <LogIn size={17} />
                  Entrar
                </>
              )}
            </button>

            <div className="login-links">
              <span>Primeiro acesso? Use a senha inicial informada pelo administrador e troque em seguida.</span>
              <button type="button" className="login-link-btn" onClick={() => setIsChangePasswordOpen(true)}>
                Alterar senha
              </button>
            </div>
          </form>

          {/* Montado só quando aberto, para já vir com o e-mail digitado */}
          {isChangePasswordOpen && (
            <ChangePasswordModal
              isOpen
              onClose={() => setIsChangePasswordOpen(false)}
              initialEmail={email}
            />
          )}

          <div className="login-card-footer">
            <ShieldCheck size={14} />
            <span>Autenticação protegida pelo Firebase Authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
}

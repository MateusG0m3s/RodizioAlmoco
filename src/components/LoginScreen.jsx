import React, { useState } from 'react';
import { Shield, Lock, Mail, Eye, EyeOff, LogIn, AlertCircle, Sparkles, Sun, Moon } from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';

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
      {/* Botão de Tema no Canto Superior */}
      {toggleTheme && (
        <div className="login-theme-container">
          <button
            type="button"
            className="theme-toggle-btn login-theme-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
            aria-label="Alternar tema de cores"
          >
            {theme === 'dark' ? (
              <Sun size={16} className="theme-icon sun" />
            ) : (
              <Moon size={16} className="theme-icon moon" />
            )}
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
              {theme === 'dark' ? 'Claro' : 'Escuro'}
            </span>
          </button>
        </div>
      )}

      <div className="login-card-container animate-fade-in">
        {/* Topo do Card com Identidade scadahub */}
        <div className="login-brand-header">
          <div className="login-icon-box">
            <Shield size={32} className="login-shield-icon" />
          </div>
          <h1 className="login-title">RODÍZIO DE ALMOÇO</h1>
          <span className="login-scadahub-tag">scadahub • Atendimento Contínuo</span>
          <p className="login-subtitle">Entre para acessar o sistema</p>
        </div>

        {/* Mensagem de Erro Amigável */}
        {errorMessage && (
          <div className="login-error-alert animate-scale-up" role="alert">
            <AlertCircle size={18} className="login-error-icon" />
            <span className="login-error-text">{errorMessage}</span>
          </div>
        )}

        {/* Formulário de Login Oficial */}
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
                placeholder="seu.email@scadahub.com"
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
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary login-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="btn-spinner" />
                <span>Autenticando...</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>ENTRAR</span>
              </>
            )}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Senha inicial: <code style={{ color: 'var(--primary-400)', fontWeight: 600 }}>shubadm</code>
            </span>
            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-400)',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem'
              }}
            >
              Alterar Senha
            </button>
          </div>
        </form>

        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
          initialEmail={email || 'mateusaugusto1441@gmail.com'}
        />

        {/* Rodapé Informativo de Segurança */}
        <div className="login-card-footer">
          <div className="login-security-notice">
            <Sparkles size={14} className="text-scada-cyan" />
            <span>Autenticação protegida via Firebase Authentication</span>
          </div>
          <span className="login-author-tag">EF - Mateus Silva</span>
        </div>
      </div>
    </div>
  );
}

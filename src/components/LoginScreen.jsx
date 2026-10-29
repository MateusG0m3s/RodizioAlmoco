import React, { useState } from 'react';
import { LogIn, AlertCircle, ShieldCheck, Sun, Moon } from 'lucide-react';
import BrandLogo from './BrandLogo';

export default function LoginScreen({ onLogin, theme = 'dark', toggleTheme }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    if (isSubmitting) return;
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const res = await onLogin();
      // Com sucesso a tela é desmontada; sem mensagem, a pessoa só fechou a janela do Google
      if (!res.success) {
        setIsSubmitting(false);
        if (res.message) setErrorMessage(res.message);
      }
    } catch {
      setIsSubmitting(false);
      setErrorMessage('Ocorreu um erro ao entrar. Tente novamente.');
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
            <p className="login-subtitle">Use a sua conta Google da scadahub para ver a escala da equipe.</p>
          </div>

          {errorMessage && (
            <div className="ui-alert danger animate-scale-up" role="alert">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <button type="button" className="ui-btn primary login-submit-btn" onClick={handleLogin} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <div className="btn-spinner" />
                Aguardando o Google…
              </>
            ) : (
              <>
                <LogIn size={17} />
                Entrar com Google
              </>
            )}
          </button>

          <div className="login-card-footer">
            <ShieldCheck size={14} />
            <span>Só contas @scadahub.io. Não há senha para criar nem para lembrar.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { ShieldCheck, KeyRound, User, Crown, Mail, LogOut, X, RefreshCw, Lock } from 'lucide-react';
import { getInitials } from '../utils/nameUtils';
import { authService } from '../services/authService';
import ChangePasswordModal from './ChangePasswordModal';
import { resolveAvatarColor } from '../utils/avatarColors';

export default function AuthModal({ isOpen, onClose, currentUser, onUserChanged }) {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  if (!isOpen) return null;

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setIsLoading(true);
    setAuthError('');

    try {
      const res = await authService.loginWithEmail(emailInput, passwordInput);
      if (res.success) {
        if (onUserChanged) onUserChanged(res.user);
        onClose();
      } else {
        setAuthError(res.message || 'Falha ao autenticar.');
      }
    } catch (err) {
      setAuthError('Erro ao realizar login: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    if (onUserChanged) onUserChanged(null);
    onClose();
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        className="modal-card animate-scale-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon" aria-hidden="true">
              {isAdmin ? <ShieldCheck size={18} /> : <User size={18} />}
            </span>
            <div>
              <h3 id="auth-modal-title" className="modal-title">Conta e acesso</h3>
              <span className="modal-subtitle">Sessão atual e troca de conta</span>
            </div>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body-pad">
          {/* Sessão atual */}
          <div className="modal-person">
            <span
              className="ui-avatar lg"
              style={{ background: resolveAvatarColor(currentUser?.color, currentUser?.email) }}
              aria-hidden="true"
            >
              {getInitials(currentUser?.name)}
            </span>
            <div className="modal-person-text">
              <b>
                {currentUser?.name || 'Não autenticado'}
                <span className={`ui-chip plain ${isAdmin ? 'now' : 'next'}`}>
                  {isAdmin ? <Crown size={13} aria-hidden="true" /> : <User size={13} aria-hidden="true" />}
                  {isAdmin ? 'Administrador' : 'Usuário'}
                </span>
              </b>
              <span className="ui-caption">
                {currentUser?.email}
                {currentUser?.uid && <> · UID <code>{currentUser.uid}</code></>}
              </span>
            </div>
            <div className="modal-person-actions">
              <button type="button" className="ui-btn secondary sm" onClick={() => setIsChangePasswordOpen(true)}>
                <KeyRound size={14} />
                Alterar senha
              </button>
              <button type="button" className="ui-btn danger-text sm" onClick={handleLogout}>
                <LogOut size={14} />
                Sair
              </button>
            </div>
          </div>

          <ChangePasswordModal
            isOpen={isChangePasswordOpen}
            onClose={() => setIsChangePasswordOpen(false)}
            initialEmail={currentUser?.email || ''}
          />

          {/* Troca de conta sempre com senha: sem atalho que permita assumir outra conta */}
          <form onSubmit={handleEmailLogin} className="auth-email-form" aria-labelledby="auth-switch-title">
            <span id="auth-switch-title" className="card-section-title">Entrar com outra conta</span>
            {authError && (
              <div className="ui-alert danger" role="alert">
                <span>{authError}</span>
              </div>
            )}

            <label className="form-group">
              <span className="form-label">E-mail</span>
              <span className="input-with-icon">
                <Mail size={16} />
                <input
                  type="email"
                  className="form-input"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="seu.nome@scadahub.io"
                  autoComplete="username"
                  required
                />
              </span>
            </label>

            <label className="form-group">
              <span className="form-label">Senha</span>
              <span className="input-with-icon">
                <Lock size={16} />
                <input
                  type="password"
                  className="form-input"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Sua senha"
                  autoComplete="current-password"
                />
              </span>
            </label>

            <button type="submit" disabled={isLoading} className="ui-btn primary">
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Autenticando…
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  Entrar
                </>
              )}
            </button>
          </form>

          <div className="ui-alert">
            <Lock size={15} />
            <span>
              <b>Permissões no servidor:</b> as regras do Firebase bloqueiam alterações de papéis ou de escalas de outras pessoas, mesmo que alguém tente pela interface.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

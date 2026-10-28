import React, { useState } from 'react';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, X, Mail } from 'lucide-react';
import { authService } from '../services/authService';

export default function ChangePasswordModal({ isOpen, onClose, initialEmail = '', onSuccess }) {
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!email.trim()) {
      setStatusMsg({ type: 'error', text: 'Informe o endereço de e-mail.' });
      return;
    }

    if (!currentPassword || !currentPassword.trim()) {
      setStatusMsg({ type: 'error', text: 'Informe a sua senha atual para confirmar a alteração.' });
      return;
    }

    if (newPassword.length < 6) {
      setStatusMsg({ type: 'error', text: 'A nova senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: 'A confirmação de senha não confere com a nova senha.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await authService.changePassword(email.trim(), currentPassword, newPassword);
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Senha alterada com sucesso! Você já pode utilizá-la.' });
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1800);
      } else {
        setStatusMsg({ type: 'error', text: res.message });
      }
    } catch {
      setStatusMsg({ type: 'error', text: 'Erro ao processar alteração de senha.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose} style={{ zIndex: 10001 }}>
      <div
        className="modal-card modal-sm animate-scale-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon" aria-hidden="true"><KeyRound size={18} /></span>
            <div>
              <h3 id="change-password-title" className="modal-title">Alterar senha</h3>
              <span className="modal-subtitle">Defina uma nova senha para a sua conta</span>
            </div>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {statusMsg && (
            <div className={`ui-alert ${statusMsg.type === 'success' ? 'success' : 'danger'}`} role={statusMsg.type === 'success' ? 'status' : 'alert'}>
              {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{statusMsg.text}</span>
            </div>
          )}

          <label className="form-group">
            <span className="form-label">E-mail da conta</span>
            <span className="input-with-icon">
              <Mail size={16} />
              <input
                type="email"
                required
                autoComplete="username"
                className="form-input"
                placeholder="seu.nome@scadahub.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </span>
          </label>

          <label className="form-group">
            <span className="form-label">Senha atual</span>
            <span className="input-with-icon">
              <Lock size={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="form-input"
                placeholder="Sua senha atual"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </span>
          </label>

          <label className="form-group">
            <span className="form-label">Nova senha (mínimo 6 caracteres)</span>
            <span className="input-with-icon">
              <Lock size={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                className="form-input"
                placeholder="Nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar senhas' : 'Mostrar senhas'}
                title={showPassword ? 'Ocultar senhas' : 'Mostrar senhas'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </span>
          </label>

          <label className="form-group">
            <span className="form-label">Confirme a nova senha</span>
            <span className="input-with-icon">
              <Lock size={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                className="form-input"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </span>
          </label>

          <div className="modal-footer">
            <div className="modal-footer-actions">
              <button type="button" className="ui-btn secondary" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </button>
              <button type="submit" className="ui-btn accent" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando…' : 'Salvar nova senha'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

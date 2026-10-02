import React, { useState } from 'react';
import { ShieldCheck, KeyRound, User, Mail, LogOut, Check, X, Sparkles, RefreshCw, Lock } from 'lucide-react';
import { authService, TEST_ACCOUNTS } from '../services/authService';
import ChangePasswordModal from './ChangePasswordModal';

export default function AuthModal({ isOpen, onClose, currentUser, onUserChanged }) {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('quick'); // 'quick' | 'email'
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  if (!isOpen) return null;

  const handleSelectAccount = (key) => {
    const res = authService.switchAccount(key);
    if (res.success) {
      if (onUserChanged) onUserChanged(res.user);
      onClose();
    }
  };

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
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px', width: '92%' }}
      >
        {/* Cabeçalho */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
          <div className="modal-title-wrap">
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: isAdmin ? 'rgba(56, 18, 103, 0.4)' : 'rgba(2, 132, 199, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isAdmin ? '#c084fc' : '#38bdf8',
                border: `1px solid ${isAdmin ? '#7c3aed' : '#0284c7'}`
              }}
            >
              {isAdmin ? <ShieldCheck size={20} /> : <User size={20} />}
            </div>
            <div>
              <h3 className="modal-title">Autenticação & Identidade</h3>
              <span className="modal-subtitle">Controle de Acesso Baseado em Papéis (RBAC) & Regras Firebase</span>
            </div>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Status Atual do Usuário Conectado */}
        <div
          style={{
            margin: '16px 0',
            padding: '14px 18px',
            background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: currentUser?.color || '#381267',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
            >
              {currentUser?.avatar || 'US'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                  {currentUser?.name || 'Não Autenticado'}
                </span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background: isAdmin ? 'rgba(124, 58, 237, 0.2)' : 'rgba(2, 132, 199, 0.2)',
                    color: isAdmin ? '#c084fc' : '#38bdf8',
                    border: `1px solid ${isAdmin ? 'rgba(124, 58, 237, 0.4)' : 'rgba(2, 132, 199, 0.4)'}`
                  }}
                >
                  {isAdmin ? '👑 Admin' : '👤 Usuário Normal'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {currentUser?.email} • UID: <code style={{ fontSize: '0.75rem', background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: '4px' }}>{currentUser?.uid}</code>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              title="Alterar sua senha de acesso"
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(124, 58, 237, 0.1)',
                border: '1px solid rgba(124, 58, 237, 0.3)',
                color: 'var(--primary-400)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                fontWeight: 600
              }}
            >
              <KeyRound size={15} />
              <span>Alterar Senha</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title="Encerrar sessão ativa"
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: '#ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                fontWeight: 600
              }}
            >
              <LogOut size={15} />
              <span>Sair</span>
            </button>
          </div>

          <ChangePasswordModal
            isOpen={isChangePasswordOpen}
            onClose={() => setIsChangePasswordOpen(false)}
            initialEmail={currentUser?.email || ''}
          />
        </div>

        {/* Abas do Modal: Contas de Teste vs Login por E-mail */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setActiveSubTab('quick')}
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: '8px',
              background: activeSubTab === 'quick' ? 'var(--bg-elevated)' : 'transparent',
              border: `1px solid ${activeSubTab === 'quick' ? 'var(--primary-500)' : 'transparent'}`,
              color: activeSubTab === 'quick' ? 'var(--text-main)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Sparkles size={15} color="#c084fc" />
            <span>Contas de Teste & Auditoria</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('email')}
            style={{
              flex: 1,
              padding: '9px 14px',
              borderRadius: '8px',
              background: activeSubTab === 'email' ? 'var(--bg-elevated)' : 'transparent',
              border: `1px solid ${activeSubTab === 'email' ? 'var(--primary-500)' : 'transparent'}`,
              color: activeSubTab === 'email' ? 'var(--text-main)' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.86rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Mail size={15} color="#38bdf8" />
            <span>Login com E-mail</span>
          </button>
        </div>

        {/* Conteúdo: Seleção de Contas de Teste (Secção 31 do Checklist) */}
        {activeSubTab === 'quick' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 6px 0' }}>
              Selecione uma conta para validar instantaneamente as permissões de <b>ADMIN</b>, <b>USER_A</b> e <b>USER_B</b>:
            </p>

            {Object.keys(TEST_ACCOUNTS).map((key) => {
              const acc = TEST_ACCOUNTS[key];
              const isSelected = currentUser?.uid === acc.uid;
              const isAccAdmin = acc.role === 'admin';

              return (
                <div
                  key={key}
                  onClick={() => handleSelectAccount(key)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: isSelected ? 'rgba(124, 58, 237, 0.12)' : 'var(--bg-subtle)',
                    border: `1.5px solid ${isSelected ? '#7c3aed' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: acc.color,
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.86rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {acc.avatar}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                          {acc.name}
                        </span>
                        <span
                          style={{
                            padding: '1px 6px',
                            borderRadius: '9999px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background: isAccAdmin ? 'rgba(124, 58, 237, 0.25)' : 'rgba(2, 132, 199, 0.2)',
                            color: isAccAdmin ? '#c084fc' : '#38bdf8'
                          }}
                        >
                          {key} ({isAccAdmin ? 'Admin' : 'Usuário'})
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {acc.email} • ID: {acc.employeeId}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} color="#ffffff" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Conteúdo: Formulário de Login por E-mail */}
        {activeSubTab === 'email' && (
          <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {authError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#f87171',
                  fontSize: '0.84rem'
                }}
              >
                {authError}
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                E-mail
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="seu.email@scadahub.com"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Senha
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>Entrar com Firebase Auth</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Rodapé Informativo sobre Segurança */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '14px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.78rem',
            color: 'var(--text-muted)'
          }}
        >
          <Lock size={15} style={{ flexShrink: 0 }} />
          <span>
            <b>Segurança Ativa:</b> A autorização é controlada diretamente pelas Firebase Security Rules. Tentativas de manipulação de papéis ou escalas de outros colaboradores são bloqueadas pelo servidor.
          </span>
        </div>
      </div>
    </div>
  );
}

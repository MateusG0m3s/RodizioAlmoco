import React, { useEffect, useRef } from 'react';
import { Repeat, LogOut, Moon, Volume2, Settings } from 'lucide-react';

// Menu da conta: aberto pelo cartão do usuário (sidebar) ou pelo avatar (celular).
// No celular também carrega as preferências, que no desktop ficam na sidebar.
export default function UserMenu({
  currentUser,
  isAdmin,
  onClose,
  onSwitchAccount,
  onLogout,
  withPreferences = false,
  theme,
  toggleTheme,
  soundEnabled,
  toggleSound,
  onOpenSettings,
  className = ''
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handlePointer = (e) => {
      // O botão que abriu o menu cuida do próprio clique (alterna aberto/fechado)
      if (menuRef.current && !menuRef.current.contains(e.target) && !e.target.closest('[data-user-menu-trigger]')) {
        onClose();
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const run = (fn) => () => {
    onClose();
    if (fn) fn();
  };

  return (
    <div ref={menuRef} className={`ui-menu user-menu ${className}`} role="menu" aria-label="Conta">
      <div className="ui-menu-head">
        <b>{currentUser?.name || 'Usuário'}</b>
        <span className="ui-caption">{currentUser?.email || (isAdmin ? 'Administrador' : 'Usuário')}</span>
      </div>

      {withPreferences && (
        <>
          <button type="button" role="menuitemcheckbox" aria-checked={theme === 'dark'} className="ui-menu-item" onClick={toggleTheme}>
            <Moon />
            Tema escuro
            <span className={`ui-switch ${theme === 'dark' ? 'is-on' : ''}`} aria-hidden="true" />
          </button>
          {toggleSound && (
            <button type="button" role="menuitemcheckbox" aria-checked={soundEnabled} className="ui-menu-item" onClick={toggleSound}>
              <Volume2 />
              Sons
              <span className={`ui-switch ${soundEnabled ? 'is-on' : ''}`} aria-hidden="true" />
            </button>
          )}
          {isAdmin && onOpenSettings && (
            <button type="button" role="menuitem" className="ui-menu-item" onClick={run(onOpenSettings)}>
              <Settings />
              Configurações
            </button>
          )}
          <div className="ui-menu-sep" />
        </>
      )}

      {onSwitchAccount && (
        <button type="button" role="menuitem" className="ui-menu-item" onClick={run(onSwitchAccount)}>
          <Repeat />
          Trocar conta
        </button>
      )}
      {onLogout && (
        <>
          <div className="ui-menu-sep" />
          <button type="button" role="menuitem" className="ui-menu-item danger" onClick={run(onLogout)}>
            <LogOut />
            Sair
          </button>
        </>
      )}
    </div>
  );
}

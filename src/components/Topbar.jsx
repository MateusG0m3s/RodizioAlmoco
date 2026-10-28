import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import BrandLogo from './BrandLogo';
import UserMenu from './UserMenu';
import { minutesToTime } from '../utils/timeUtils';
import { getInitials } from '../utils/nameUtils';
import { resolveAvatarColor } from '../utils/avatarColors';

// Relógio do topo: "ao vivo" em verde; "simulado" em âmbar, com atalho para voltar ao horário real
function ClockChip({ currentTimeMinutes, isSimulating, onExitSimulation }) {
  return (
    <span
      className={`ui-clock ${isSimulating ? 'is-simulated' : ''}`}
      title={isSimulating ? 'Horário simulado (ferramenta de teste)' : 'Horário real do sistema'}
    >
      <span className="live-dot" aria-hidden="true" />
      {minutesToTime(currentTimeMinutes)}
      <small>{isSimulating ? 'simulado' : 'ao vivo'}</small>
      {isSimulating && onExitSimulation && (
        <button
          type="button"
          className="ui-icon-btn"
          onClick={onExitSimulation}
          title="Voltar ao horário real"
          aria-label="Voltar ao horário real"
        >
          <RotateCcw size={14} />
        </button>
      )}
    </span>
  );
}

export default function Topbar({
  title,
  subtitle,
  children,
  currentTimeMinutes,
  isSimulating,
  onExitSimulation,
  // Só no celular: avatar com o menu da conta e das preferências
  currentUser,
  isAdmin,
  theme,
  toggleTheme,
  soundEnabled,
  toggleSound,
  onOpenSettings,
  onOpenAuthModal,
  onOpenChangePassword,
  onLogout,
  onGoHome
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const userName = currentUser?.name || 'Usuário';

  return (
    <header className="app-topbar">
      <div className="topbar-mobile-row">
        <button type="button" className="topbar-mobile-brand" onClick={onGoHome} aria-label="Ir para o painel">
          <BrandLogo />
        </button>
        <div className="topbar-mobile-actions">
          <ClockChip currentTimeMinutes={currentTimeMinutes} isSimulating={isSimulating} onExitSimulation={onExitSimulation} />
          <div className="topbar-user-wrap">
            <button
              type="button"
              className="topbar-avatar-btn"
              data-user-menu-trigger
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-label={`Conta de ${userName}`}
            >
              <span
                className="ui-avatar"
                style={{ background: resolveAvatarColor(currentUser?.color, currentUser?.email || userName) }}
                aria-hidden="true"
              >
                {getInitials(userName)}
              </span>
            </button>
            {isMenuOpen && (
              <UserMenu
                className="topbar-user-menu"
                currentUser={currentUser}
                isAdmin={isAdmin}
                onClose={() => setIsMenuOpen(false)}
                withPreferences
                theme={theme}
                toggleTheme={toggleTheme}
                soundEnabled={soundEnabled}
                toggleSound={toggleSound}
                onOpenSettings={onOpenSettings}
                onOpenAuthModal={onOpenAuthModal}
                onOpenChangePassword={onOpenChangePassword}
                onLogout={onLogout}
              />
            )}
          </div>
        </div>
      </div>

      <div className="topbar-main">
        <div className="topbar-title">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="topbar-actions">
          {children}
          <span className="topbar-clock-desktop">
            <ClockChip currentTimeMinutes={currentTimeMinutes} isSimulating={isSimulating} onExitSimulation={onExitSimulation} />
          </span>
        </div>
      </div>
    </header>
  );
}

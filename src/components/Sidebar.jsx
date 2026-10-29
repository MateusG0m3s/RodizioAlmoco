import React, { useState } from 'react';
import { Settings, Moon, Volume2, ShieldCheck, Crown, User, ChevronsUpDown } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { MAIN_TABS } from '../data/navigation';
import UserMenu from './UserMenu';
import { getInitials } from '../utils/nameUtils';
import { resolveAvatarColor } from '../utils/avatarColors';

export default function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  isAdmin,
  theme,
  toggleTheme,
  soundEnabled = true,
  toggleSound,
  settings,
  onSwitchAccount,
  onLogout
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const userName = currentUser?.name || 'Usuário';
  const RoleIcon = isAdmin ? Crown : User;
  const minWorking = Number(settings?.minWorkingDuringCritical) || 1;

  return (
    <aside className="app-sidebar" aria-label="Navegação">
      <button type="button" className="sidebar-brand" onClick={() => setActiveTab('dashboard')} title="Ir para o painel">
        <BrandLogo />
        <span className="sidebar-dept">Escala de Almoço</span>
      </button>

      <div className="sidebar-user-wrap">
        <button
          type="button"
          className="sidebar-user"
          data-user-menu-trigger
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          title={`${userName} (${isAdmin ? 'Administrador' : 'Usuário'})`}
        >
          <span
            className="ui-avatar lg"
            style={{ background: resolveAvatarColor(currentUser?.color, currentUser?.email || userName) }}
            aria-hidden="true"
          >
            {getInitials(userName)}
          </span>
          <span className="sidebar-user-text">
            <b>{userName}</b>
            <span>
              <RoleIcon size={12} aria-hidden="true" />
              {isAdmin ? 'Administrador' : 'Usuário'}
            </span>
          </span>
          <ChevronsUpDown size={16} className="sidebar-user-chevron" aria-hidden="true" />
        </button>
        {isMenuOpen && (
          <UserMenu
            className="sidebar-user-menu"
            currentUser={currentUser}
            isAdmin={isAdmin}
            onClose={() => setIsMenuOpen(false)}
            onSwitchAccount={onSwitchAccount}
            onLogout={onLogout}
          />
        )}
      </div>

      <nav className="sidebar-nav" aria-label="Menu">
        <span className="ui-overline">Menu</span>
        {MAIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`sidebar-link ${isActive ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              title={tab.title}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="sidebar-link-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <nav className="sidebar-nav" aria-label="Preferências">
        <span className="ui-overline">Preferências</span>
        {isAdmin && (
          <button
            type="button"
            className={`sidebar-link ${activeTab === 'settings' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('settings')}
            aria-current={activeTab === 'settings' ? 'page' : undefined}
            title="Configurações"
          >
            <Settings size={18} aria-hidden="true" />
            <span className="sidebar-link-label">Configurações</span>
          </button>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={theme === 'dark'}
          className="sidebar-link"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Tema escuro ligado' : 'Tema escuro desligado'}
        >
          <Moon size={18} aria-hidden="true" />
          <span className="sidebar-link-label">Tema escuro</span>
          <span className={`ui-switch ${theme === 'dark' ? 'is-on' : ''}`} aria-hidden="true" />
        </button>
        {toggleSound && (
          <button
            type="button"
            role="switch"
            aria-checked={soundEnabled}
            className="sidebar-link"
            onClick={toggleSound}
            title={soundEnabled ? 'Aviso sonoro do almoço ligado' : 'Aviso sonoro do almoço desligado'}
          >
            <Volume2 size={18} aria-hidden="true" />
            <span className="sidebar-link-label">Sons</span>
            <span className={`ui-switch ${soundEnabled ? 'is-on' : ''}`} aria-hidden="true" />
          </button>
        )}
      </nav>

      <div className="sidebar-rule">
        <span className="ui-icon-circle sidebar-rule-icon" aria-hidden="true">
          <ShieldCheck size={16} />
        </span>
        <b>Janela crítica</b>
        <p>
          {settings?.criticalStart || '11:30'} às {settings?.criticalEnd || '13:30'}, com pelo menos {minWorking}{' '}
          {minWorking === 1 ? 'atendente' : 'atendentes'} no posto.
        </p>
        {isAdmin && (
          <button type="button" className="ui-btn secondary sm" onClick={() => setActiveTab('settings')}>
            Ajustar regras
          </button>
        )}
      </div>
    </aside>
  );
}

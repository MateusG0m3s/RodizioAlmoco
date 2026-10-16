import React from 'react';
import { Calendar, Users, BarChart3, Settings, Play, RefreshCw, Clock, ShieldCheck, Sun, Moon, LogOut, Volume2, VolumeX } from 'lucide-react';
import { minutesToTime } from '../utils/timeUtils';
import BrandLogo from './BrandLogo';

export default function Navbar({
  activeTab,
  setActiveTab,
  currentTimeMinutes,
  isSimulatingTime,
  setIsSimulatingTime,
  setSimulatedMinutes,
  systemTimeMinutes,
  _isCloudConnected,
  theme,
  toggleTheme,
  soundEnabled = true,
  toggleSound,
  currentUser,
  isAdmin,
  onOpenAuthModal,
  onLogout
}) {
  // Rótulos curtos para caber em uma linha; o nome completo fica no title
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', title: 'Dashboard do dia', icon: BarChart3 },
    { id: 'week', label: 'Semana', title: 'Rodízio semanal', icon: Calendar },
    { id: 'team', label: 'Equipe', title: 'Gestão da equipe', icon: Users },
    { id: 'history', label: 'Histórico', title: 'Histórico e equilíbrio', icon: ShieldCheck },
    ...(isAdmin ? [{ id: 'settings', label: 'Configurações', mobileLabel: 'Config.', title: 'Configurações', icon: Settings }] : [])
  ];

  const userInitial = currentUser?.avatar || (currentUser?.name ? currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'US');
  const userShortName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Usuário';

  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Logo Oficial scadahub */}
        <div className="brand" onClick={() => setActiveTab('dashboard')} role="button">
          <BrandLogo />
          <div className="brand-divider-vertical" />
          <div className="brand-sub-badge">
            <span className="brand-dept-tag">Escala de Almoço</span>
            <span className="brand-sub-company">Atendimento ao Cliente</span>
          </div>
        </div>

        {/* Abas Principais */}
        <nav className="nav-tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                title={tab.title}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={16} />
                <span className="nav-tab-label">{tab.label}</span>
                {tab.mobileLabel && <span className="nav-tab-label-mobile" aria-hidden="true">{tab.mobileLabel}</span>}
              </button>
            );
          })}
        </nav>

        {/* Relógio, Tema & Perfil de Autenticação */}
        <div className="navbar-actions">
          {/* Badge de Usuário Autenticado / RBAC */}
          <button
            type="button"
            className="user-auth-btn"
            onClick={onOpenAuthModal}
            title={`Conectado como ${currentUser?.name || 'Usuário'} (${isAdmin ? 'Administrador' : 'Usuário Normal'}). Clique para alternar conta ou autenticar.`}
            aria-label={`Conta: ${currentUser?.name || 'Usuário'}`}
            style={{
              borderColor: isAdmin ? 'rgba(110, 43, 144, 0.45)' : 'rgba(26, 135, 204, 0.35)'
            }}
          >
            <div
              className="user-auth-avatar"
              style={{ background: currentUser?.color || (isAdmin ? '#4f1f66' : '#1a87cc') }}
            >
              {userInitial}
            </div>
            <div className="user-auth-text">
              <span className="user-auth-name">{userShortName}</span>
              <span className="user-auth-role" style={{ color: isAdmin ? '#b47ad6' : '#4fb3ee' }}>
                {isAdmin ? '👑 Admin' : '👤 Normal'}
              </span>
            </div>
          </button>

          {/* Botão Oficial Sair / Logout */}
          {onLogout && (
            <button
              type="button"
              className="theme-toggle-btn navbar-icon-btn"
              style={{
                color: '#f87171',
                borderColor: 'rgba(239, 68, 68, 0.35)',
                background: 'rgba(239, 68, 68, 0.08)'
              }}
              title="Encerrar sessão com segurança"
              onClick={onLogout}
              aria-label="Encerrar sessão"
            >
              <LogOut size={14} />
              <span className="theme-btn-text" style={{ color: '#f87171', fontWeight: 700 }}>
                Sair
              </span>
            </button>
          )}

          {/* Botão de Tema (Modo Escuro / Modo Claro) */}
          <button
            type="button"
            className="theme-toggle-btn navbar-icon-btn"
            title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
            onClick={toggleTheme}
            aria-label="Alternar tema de cores"
          >
            {theme === 'dark' ? (
              <Sun size={15} className="theme-icon sun" />
            ) : (
              <Moon size={15} className="theme-icon moon" />
            )}
            <span className="theme-btn-text">
              {theme === 'dark' ? 'Claro' : 'Escuro'}
            </span>
          </button>

          {/* Botão de Notificações Sonoras (Tocar / Mudo) */}
          {toggleSound && (
            <button
              type="button"
              className="theme-toggle-btn navbar-icon-btn"
              title={soundEnabled ? 'Notificações sonoras: Tocar (Clique para silenciar)' : 'Notificações sonoras: Mudo (Clique para ativar)'}
              onClick={toggleSound}
              aria-label="Alternar notificações sonoras"
              aria-pressed={soundEnabled}
            >
              {soundEnabled ? (
                <Volume2 size={15} className="theme-icon" style={{ color: 'var(--scada-cyan, #4fb3ee)' }} />
              ) : (
                <VolumeX size={15} className="theme-icon" style={{ opacity: 0.65 }} />
              )}
              <span className="theme-btn-text">
                {soundEnabled ? 'Tocar' : 'Mudo'}
              </span>
            </button>
          )}

          {/* Controle do Relógio / Simulador */}
          <div className={`time-pill ${isSimulatingTime ? 'simulating' : ''}`}>
            <Clock size={15} className={isSimulatingTime ? 'pulse-amber' : 'pulse-cyan'} />
            <div className="time-pill-content">
              <span className="time-display">{minutesToTime(currentTimeMinutes)}</span>
              <span className="time-label">
                {isSimulatingTime ? 'Simulado' : 'Horário Real'}
              </span>
            </div>
            {isSimulatingTime ? (
              <button
                className="btn-pill-reset"
                title="Voltar ao horário real do sistema"
                onClick={() => {
                  setIsSimulatingTime(false);
                  setSimulatedMinutes(systemTimeMinutes);
                }}
              >
                <RefreshCw size={12} />
                <span>Real</span>
              </button>
            ) : (
              <button
                className="btn-pill-simulate"
                title="Ativar simulador de horário para testes"
                onClick={() => setIsSimulatingTime(true)}
              >
                <Play size={11} />
                <span>Simular</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

import React from 'react';
import { Calendar, Users, BarChart3, Settings, Play, RefreshCw, Clock, ShieldCheck, Sun, Moon, LogOut, Volume2, VolumeX } from 'lucide-react';
import { minutesToTime } from '../utils/timeUtils';

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
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'week', label: 'Rodízio Semanal', icon: Calendar },
    { id: 'team', label: 'Equipe', icon: Users },
    { id: 'history', label: 'Histórico & Equilíbrio', icon: ShieldCheck },
    ...(isAdmin ? [{ id: 'settings', label: 'Configurações', icon: Settings }] : [])
  ];

  const userInitial = currentUser?.avatar || (currentUser?.name ? currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'US');
  const userShortName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Usuário';

  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Logo Oficial scadahub */}
        <div className="brand" onClick={() => setActiveTab('dashboard')} role="button">
          <div className="scadahub-logo-wrap">
            <span className="scada-part">scada</span>
            <span className="hub-part">hub</span>
          </div>
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
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 12px 5px 6px',
              borderRadius: '9999px',
              background: 'var(--bg-subtle)',
              border: `1.5px solid ${isAdmin ? 'rgba(124, 58, 237, 0.45)' : 'rgba(2, 132, 199, 0.35)'}`,
              cursor: 'pointer',
              color: 'var(--text-main)',
              transition: 'all 0.2s ease'
            }}
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: currentUser?.color || (isAdmin ? '#381267' : '#0284c7'),
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.72rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {userInitial}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                {userShortName}
              </span>
              <span style={{ fontSize: '0.66rem', color: isAdmin ? '#c084fc' : '#38bdf8', fontWeight: 600 }}>
                {isAdmin ? '👑 Admin' : '👤 Normal'}
              </span>
            </div>
          </button>

          {/* Botão Oficial Sair / Logout */}
          {onLogout && (
            <button
              type="button"
              className="theme-toggle-btn"
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
            className="theme-toggle-btn"
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
              className="theme-toggle-btn"
              title={soundEnabled ? 'Notificações sonoras: Tocar (Clique para silenciar)' : 'Notificações sonoras: Mudo (Clique para ativar)'}
              onClick={toggleSound}
              aria-label="Alternar notificações sonoras"
            >
              {soundEnabled ? (
                <Volume2 size={15} className="theme-icon" style={{ color: 'var(--scada-cyan, #06b6d4)' }} />
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

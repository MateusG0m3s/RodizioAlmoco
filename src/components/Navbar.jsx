import React from 'react';
import { Calendar, Users, BarChart3, Settings, Play, RefreshCw, Clock, ShieldCheck, Cloud, Sun, Moon } from 'lucide-react';
import { minutesToTime } from '../utils/timeUtils';

export default function Navbar({
  activeTab,
  setActiveTab,
  currentTimeMinutes,
  isSimulatingTime,
  setIsSimulatingTime,
  setSimulatedMinutes,
  systemTimeMinutes,
  isCloudConnected,
  theme,
  toggleTheme
}) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'week', label: 'Rodízio Semanal', icon: Calendar },
    { id: 'team', label: 'Equipe', icon: Users },
    { id: 'history', label: 'Histórico & Equilíbrio', icon: ShieldCheck },
    { id: 'settings', label: 'Configurações', icon: Settings }
  ];

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

        {/* Relógio & Controle do Modo de Tempo */}
        <div className="navbar-actions">
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

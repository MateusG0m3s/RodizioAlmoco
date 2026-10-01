import React from 'react';
import { Calendar, Users, BarChart3, Settings, Play, RefreshCw, Clock, ShieldCheck, Cloud } from 'lucide-react';
import { minutesToTime } from '../utils/timeUtils';

export default function Navbar({
  activeTab,
  setActiveTab,
  currentTimeMinutes,
  isSimulatingTime,
  setIsSimulatingTime,
  setSimulatedMinutes,
  systemTimeMinutes,
  isCloudConnected
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
          {/* Badge de Conexão com a Nuvem (Firebase) */}
          <button
            type="button"
            className="cloud-status-badge"
            title={isCloudConnected ? "Conectado ao Firebase Realtime Database (Sincronização em tempo real ativa)" : "Modo Local (Clique para configurar a sincronização em nuvem)"}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '0.78rem',
              fontWeight: 600,
              background: isCloudConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.1)',
              color: isCloudConnected ? '#059669' : '#d97706',
              border: `1.2px solid ${isCloudConnected ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.3)'}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setActiveTab('settings')}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isCloudConnected ? '#10b981' : '#f59e0b',
                boxShadow: isCloudConnected ? '0 0 8px #10b981' : 'none'
              }}
            />
            <Cloud size={13} color={isCloudConnected ? '#10b981' : '#f59e0b'} />
            <span>{isCloudConnected ? 'Nuvem Ao Vivo' : 'Modo Local'}</span>
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

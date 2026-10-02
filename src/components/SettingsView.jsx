import React, { useState } from 'react';
import { Settings, Save, RotateCcw, Download, Upload, FileText, Check, AlertCircle, Headset, ShieldAlert, Cloud, Wifi, Sun, Moon, ChevronDown, ChevronUp, RefreshCw, Lock, UploadCloud } from 'lucide-react';
import { storageService } from '../services/storageService';
import { firebaseService } from '../services/firebaseService';

export default function SettingsView({
  settings,
  onSaveSettings,
  onResetAllData,
  onReloadData,
  isCloudConnected,
  onSyncAllToCloud,
  theme,
  onToggleTheme,
  isAdmin = true
}) {
  const [formData, setFormData] = useState({ ...settings });
  const [importText, setImportText] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState(null);

  // Estados do Firebase
  const [firebaseConfigForm, setFirebaseConfigForm] = useState(() => firebaseService.getActiveConfig());
  const [firebaseStatusMsg, setFirebaseStatusMsg] = useState(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const isFirebaseConnected = isCloudConnected !== undefined ? isCloudConnected : firebaseService.isConnected;
  const [showAdvancedFirebase, setShowAdvancedFirebase] = useState(false);

  // Estados de confirmação para restaurar dados padrão
  const [showResetPasswordPrompt, setShowResetPasswordPrompt] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [resetConfirmError, setResetConfirmError] = useState('');

  // Bloqueio de acesso no frontend para não-administradores
  if (!isAdmin) {
    return (
      <div className="settings-view-container animate-fade-in" style={{ padding: '48px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: '440px', margin: '0 auto', background: 'var(--bg-card)', padding: '36px 24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <ShieldAlert size={48} color="#ef4444" style={{ margin: '0 auto 16px', display: 'block' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
            Acesso Restrito ao Administrador
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '20px' }}>
            A aba Configurações, alteração de regras de atendimento e ferramentas de restauração são exclusivas para administradores autenticados.
          </p>
        </div>
      </div>
    );
  }

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExportJSON = () => {
    storageService.exportAsJSON();
  };

  const handleImportJSON = () => {
    if (!importText.trim()) return;
    const res = storageService.importFromJSON(importText);
    setImportStatus(res);
    if (res.success) {
      setTimeout(() => {
        onReloadData();
        setImportText('');
        setImportStatus(null);
      }, 1500);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setImportText(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleSaveFirebaseConfig = (e) => {
    e.preventDefault();
    const res = firebaseService.saveCustomConfig(firebaseConfigForm);
    setFirebaseStatusMsg(res);
    setTimeout(() => setFirebaseStatusMsg(null), 4000);
    onReloadData();
  };

  const handleClearFirebaseConfig = () => {
    if (window.confirm('Deseja desconectar o Firebase e voltar ao modo local?')) {
      firebaseService.clearCustomConfig();
      setFirebaseConfigForm(firebaseService.getActiveConfig());
      setFirebaseStatusMsg({ success: true, message: 'Firebase desconectado. Operando no modo local.' });
      setTimeout(() => setFirebaseStatusMsg(null), 3000);
      onReloadData();
    }
  };

  const handleReconnectFirebase = () => {
    const cfg = firebaseService.getActiveConfig();
    const success = firebaseService.init(cfg);
    if (success) {
      setFirebaseStatusMsg({ success: true, message: 'Reconectado à nuvem com sucesso!' });
      onReloadData();
    } else {
      setFirebaseStatusMsg({ success: false, message: 'Não foi possível reconectar à nuvem. Verifique a conexão ou as configurações avançadas.' });
    }
    setTimeout(() => setFirebaseStatusMsg(null), 4000);
  };

  const handleToggleAdvanced = () => {
    setShowAdvancedFirebase((prev) => !prev);
  };

  const handleOpenResetPrompt = () => {
    setShowResetPasswordPrompt(true);
    setResetConfirmInput('');
    setResetConfirmError('');
  };

  const handleCancelResetPrompt = () => {
    setShowResetPasswordPrompt(false);
    setResetConfirmInput('');
    setResetConfirmError('');
  };

  const handleConfirmReset = (e) => {
    if (e) e.preventDefault();
    if (resetConfirmInput.trim().toUpperCase() === 'RESTAURAR') {
      setShowResetPasswordPrompt(false);
      setResetConfirmInput('');
      setResetConfirmError('');
      onResetAllData();
    } else {
      setResetConfirmError('Confirmação inválida! Digite exatamente RESTAURAR para confirmar.');
    }
  };

  return (
    <div className="settings-view-container animate-fade-in">
      <div className="settings-header-bar">
        <div className="settings-title-group">
          <Settings size={22} className="text-scada-cyan" />
          <div>
            <h2 className="settings-main-title">Configurações & Regras scadahub</h2>
            <p className="settings-sub-title">
              Defina a janela de atendimento ao cliente, duração dos almoços e parâmetros operacionais
            </p>
          </div>
        </div>
      </div>

      <div className="settings-grid">
        {/* Card 0: Preferência Visual do Usuário (Tema Claro / Escuro) */}
        <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
          <div className="settings-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 className="card-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {theme === 'dark' ? <Moon size={18} className="text-purple-400" /> : <Sun size={18} className="text-amber-500" />}
                <span>Aparência & Modo de Exibição</span>
              </h3>
              <span className="card-section-caption">
                Escolha o tema visual que preferir (salvo individualmente no seu navegador)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className={`theme-pill-choice ${theme !== 'dark' ? 'active' : ''}`}
                onClick={() => theme === 'dark' && onToggleTheme && onToggleTheme()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 18px',
                  borderRadius: '9999px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: theme !== 'dark' ? '2px solid var(--scada-purple-mid)' : '1px solid var(--border-color)',
                  background: theme !== 'dark' ? 'var(--scada-purple-tint)' : 'var(--bg-card)',
                  color: theme !== 'dark' ? 'var(--scada-purple-dark)' : 'var(--text-muted)',
                  transition: 'all 0.2s ease'
                }}
              >
                <Sun size={16} color={theme !== 'dark' ? '#d97706' : '#94a3b8'} />
                <span>Modo Claro</span>
              </button>

              <button
                type="button"
                className={`theme-pill-choice ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => theme !== 'dark' && onToggleTheme && onToggleTheme()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 18px',
                  borderRadius: '9999px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: theme === 'dark' ? '2px solid #7c3aed' : '1px solid var(--border-color)',
                  background: theme === 'dark' ? 'rgba(124, 58, 237, 0.25)' : 'var(--bg-card)',
                  color: theme === 'dark' ? '#e9d5ff' : 'var(--text-muted)',
                  transition: 'all 0.2s ease'
                }}
              >
                <Moon size={16} color={theme === 'dark' ? '#c084fc' : '#94a3b8'} />
                <span>Modo Escuro</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 1: Janela Crítica de Atendimento & Horários */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="card-section-title">Regras de Atendimento ao Cliente</h3>
            <span className="card-section-caption">
              Garante que nenhum cliente fique sem suporte entre {formData.criticalStart || '11:30'} e {formData.criticalEnd || '13:30'}
            </span>
          </div>

          <form onSubmit={handleSave} className="settings-form">
            {/* Janela Crítica de Atendimento */}
            <div className="critical-settings-highlight-box">
              <div className="critical-box-header">
                <Headset size={16} className="text-scada-cyan" />
                <strong>Período Crítico de Atendimento aos Clientes</strong>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Durante este intervalo, a aplicação bloqueia horários vazios e exige sempre funcionários trabalhando.
              </p>

              <div className="form-group-row">
                <div className="form-group flex-1">
                  <label className="form-label">Início do Atendimento Crítico:</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formData.criticalStart || '11:30'}
                    onChange={(e) => handleChange('criticalStart', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Fim do Atendimento Crítico:</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formData.criticalEnd || '13:30'}
                    onChange={(e) => handleChange('criticalEnd', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group mt-2">
                <label className="form-label">Mínimo de atendentes trabalhando no posto:</label>
                <select
                  className="form-input"
                  value={formData.minWorkingDuringCritical || 1}
                  onChange={(e) => handleChange('minWorkingDuringCritical', Number(e.target.value))}
                >
                  <option value={1}>No mínimo 1 atendente ativo (Garante atendimento)</option>
                  <option value={2}>No mínimo 2 atendentes ativos (Recomendado para dias de pico)</option>
                </select>
              </div>
            </div>

            {/* Janela Geral do Rodízio */}
            <div className="form-group-row">
              <div className="form-group flex-1">
                <label className="form-label">Abertura da Janela do Almoço:</label>
                <input
                  type="time"
                  step={(Number(formData.slotInterval) || 5) * 60}
                  className="form-input"
                  value={formData.startHour}
                  onChange={(e) => handleChange('startHour', e.target.value)}
                  required
                />
              </div>

              <div className="form-group flex-1">
                <label className="form-label">Fechamento da Janela:</label>
                <input
                  type="time"
                  step={(Number(formData.slotInterval) || 5) * 60}
                  className="form-input"
                  value={formData.endHour}
                  onChange={(e) => handleChange('endHour', e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Duração Padrão do Almoço */}
            <div className="form-group">
              <label className="form-label">Duração Padrão do Almoço:</label>
              <div className="duration-buttons-row">
                {[20, 30, 40, 45, 60].map((mins) => (
                  <button
                    type="button"
                    key={mins}
                    className={`btn-duration-choice ${formData.defaultDuration === mins ? 'active' : ''}`}
                    onClick={() => handleChange('defaultDuration', mins)}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group-row">
              <div className="form-group flex-1">
                <label className="form-label">Intervalo Mínimo (Precisão):</label>
                <select
                  className="form-input"
                  value={formData.slotInterval || 5}
                  onChange={(e) => handleChange('slotInterval', Number(e.target.value))}
                >
                  <option value={1}>1 minuto</option>
                  <option value={5}>5 minutos (Padrão)</option>
                  <option value={10}>10 minutos</option>
                </select>
              </div>

              <div className="form-group flex-1">
                <label className="form-label">Aviso Prévio:</label>
                <select
                  className="form-input"
                  value={formData.warningMinutesBefore}
                  onChange={(e) => handleChange('warningMinutesBefore', Number(e.target.value))}
                >
                  <option value={5}>5 minutos antes</option>
                  <option value={10}>10 minutos antes (Recomendado)</option>
                  <option value={15}>15 minutos antes</option>
                </select>
              </div>
            </div>

            <div className="settings-submit-row">
              <button type="submit" className="btn-primary">
                <Save size={16} />
                <span>Salvar Configurações</span>
              </button>
              {savedSuccess && (
                <span className="save-success-tag animate-fade-in">
                  <Check size={14} /> Salvo com sucesso!
                </span>
              )}
            </div>
          </form>
        </div>

        {/* Card 2: Backup e Restauração */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="card-section-title">Dados & Backup scadahub</h3>
            <span className="card-section-caption">Exporte backups ou restaure dados da equipe</span>
          </div>

          <div className="backup-actions-box">
            <div className="backup-action-item">
              <div>
                <strong>Exportar Backup Completo</strong>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Salva funcionários, regras e escalas em formato .JSON</p>
              </div>
              <button className="btn-secondary" onClick={handleExportJSON}>
                <Download size={14} />
                <span>Baixar Backup</span>
              </button>
            </div>

            <div className="backup-separator" />

            <div className="import-box-area">
              <label className="form-label">Importar Backup (JSON/Arquivo):</label>
              <div className="file-upload-row">
                <input
                  type="file"
                  accept=".json,.txt"
                  id="import-file"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="import-file"
                  className="btn-secondary"
                  style={{
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderRadius: '9999px',
                    marginBottom: '8px'
                  }}
                >
                  <Upload size={14} />
                  <span>Carregar arquivo JSON</span>
                </label>
              </div>

              <textarea
                className="import-textarea"
                rows={4}
                placeholder="Cole o código JSON do backup aqui..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />

              <button
                type="button"
                className="btn-secondary mt-2"
                onClick={handleImportJSON}
                disabled={!importText.trim()}
                style={{ borderRadius: '9999px' }}
              >
                <FileText size={14} />
                <span>Restaurar a partir do texto</span>
              </button>

              {importStatus && (
                <div className={`import-alert ${importStatus.success ? 'success' : 'error'}`}>
                  {importStatus.success ? <Check size={14} /> : <AlertCircle size={14} />}
                  <span>{importStatus.message}</span>
                </div>
              )}
            </div>

            <div className="backup-separator" />

            <div className="reset-data-area" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div className="reset-text">
                  <strong className="text-rose-600">Restaurar Dados Iniciais</strong>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Restaura os 4 funcionários da planilha com a escala de atendimento contínuo (11:30 às 13:30).
                  </p>
                </div>
                {!showResetPasswordPrompt && (
                  <button
                    type="button"
                    className="btn-danger-outline"
                    style={{ borderRadius: '9999px' }}
                    onClick={handleOpenResetPrompt}
                  >
                    <RotateCcw size={14} />
                    <span>Restaurar Padrão</span>
                  </button>
                )}
              </div>

              {showResetPasswordPrompt && (
                <form
                  onSubmit={handleConfirmReset}
                  className="animate-fade-in"
                  style={{
                    padding: '14px 16px',
                    background: 'var(--bg-card)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: 'var(--radius-md)',
                    marginTop: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Lock size={15} className="text-rose-500" />
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Confirmação de Segurança Administrativa
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.4 }}>
                    Esta ação apagará as alterações atuais e restaurará a escala para os dados iniciais de fábrica. Digite <strong style={{ color: '#ef4444' }}>RESTAURAR</strong> para confirmar:
                  </p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: '1 1 200px', padding: '6px 12px', fontSize: '0.84rem', minWidth: '180px' }}
                      placeholder="Digite RESTAURAR..."
                      value={resetConfirmInput}
                      onChange={(e) => {
                        setResetConfirmInput(e.target.value);
                        setResetConfirmError('');
                      }}
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="btn-danger"
                      style={{ borderRadius: '9999px', fontSize: '0.8rem', padding: '6px 16px', flexShrink: 0 }}
                    >
                      Confirmar Restauração
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ borderRadius: '9999px', fontSize: '0.8rem', padding: '6px 14px', flexShrink: 0 }}
                      onClick={handleCancelResetPrompt}
                    >
                      Cancelar
                    </button>
                  </div>
                  {resetConfirmError && (
                    <div style={{ marginTop: '8px', fontSize: '0.78rem', color: '#ef4444', fontWeight: 600 }}>
                      ⚠️ {resetConfirmError}
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Sincronização em Nuvem (Firebase Realtime Database) */}
        <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
          <div className="settings-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 className="card-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cloud size={18} className="text-scada-cyan" />
                <span>Sincronização em Nuvem (Tempo Real)</span>
              </h3>
              <span className="card-section-caption">
                Atualizações simultâneas e automáticas para todos os membros da equipe
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 14px',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  background: isFirebaseConnected ? (theme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5') : (theme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : '#fefce8'),
                  color: isFirebaseConnected ? (theme === 'dark' ? '#34d399' : '#059669') : (theme === 'dark' ? '#fbbf24' : '#b45309'),
                  border: `1.5px solid ${isFirebaseConnected ? (theme === 'dark' ? 'rgba(16, 185, 129, 0.3)' : '#a7f3d0') : (theme === 'dark' ? 'rgba(245, 158, 11, 0.3)' : '#fef08a')}`
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isFirebaseConnected ? '#10b981' : '#f59e0b' }} />
                <span>{isFirebaseConnected ? 'Conectado (Online)' : 'Desconectado (Offline)'}</span>
              </div>

              {!isFirebaseConnected && (
                <button
                  type="button"
                  onClick={handleReconnectFirebase}
                  className="btn-secondary"
                  style={{ borderRadius: '9999px', padding: '4px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Tentar reconectar à nuvem"
                >
                  <RefreshCw size={13} />
                  <span>Reconectar</span>
                </button>
              )}
            </div>
          </div>

          <div style={{ background: 'var(--bg-subtle)', padding: '18px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: isFirebaseConnected ? (theme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5') : (theme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : '#fefce8'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Wifi size={20} color={isFirebaseConnected ? '#10b981' : '#f59e0b'} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)', marginBottom: '2px' }}>
                    {isFirebaseConnected ? 'Sistema operando 100% online em nuvem' : 'Sistema desconectado da nuvem'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {isFirebaseConnected
                      ? 'Todas as alterações de horários, regras e equipe são sincronizadas automaticamente em tempo real para todos os colegas.'
                      : 'O sistema está em modo local. Clique no botão Reconectar para voltar a sincronizar com a equipe.'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {!isFirebaseConnected && (
                  <button
                    type="button"
                    onClick={handleReconnectFirebase}
                    className="btn-primary"
                    style={{ borderRadius: '9999px', fontSize: '0.82rem', padding: '6px 18px' }}
                  >
                    <RefreshCw size={14} />
                    <span>Reconectar Agora</span>
                  </button>
                )}

                {isFirebaseConnected && onSyncAllToCloud && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{
                      borderRadius: '9999px',
                      borderColor: '#7c3aed',
                      color: theme === 'dark' ? '#c4b5fd' : '#6b21a8',
                      background: theme === 'dark' ? 'rgba(124, 58, 237, 0.2)' : '#f5f3ff',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      padding: '6px 16px'
                    }}
                    onClick={async () => {
                      setIsSyncingCloud(true);
                      await onSyncAllToCloud();
                      setIsSyncingCloud(false);
                    }}
                    disabled={isSyncingCloud}
                    title="Envia a lista de funcionários, regras e escalas locais atuais para o Firebase"
                  >
                    <UploadCloud size={15} color="#7c3aed" />
                    <span>{isSyncingCloud ? 'Sincronizando...' : 'Subir Dados Locais para Nuvem'}</span>
                  </button>
                )}
              </div>
            </div>

            {firebaseStatusMsg && (
              <div
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: firebaseStatusMsg.success ? '#10b981' : '#ef4444',
                  padding: '8px 12px',
                  background: firebaseStatusMsg.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${firebaseStatusMsg.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                }}
              >
                {firebaseStatusMsg.message}
              </div>
            )}

            {/* Manutenção Técnica Avançada (Protegida por senha "useradminshub") */}
            <div style={{ marginTop: '6px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleToggleAdvanced}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 0'
                  }}
                  title="Configurações avançadas apenas para manutenção técnica"
                >
                  <Lock size={13} className="text-amber-400" />
                  {showAdvancedFirebase ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>Configurações Técnicas de Manutenção ({showAdvancedFirebase ? 'Ocultar' : 'Apenas para Administrador'})</span>
                </button>
              </div>

              {/* Formulário Técnico para Administrador */}
              {showAdvancedFirebase && (
                <form onSubmit={handleSaveFirebaseConfig} className="settings-form animate-fade-in" style={{ marginTop: '12px' }}>
                  <div className="form-group-row">
                    <div className="form-group flex-1">
                      <label className="form-label">Database URL (URL do Realtime Database):</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="https://seu-projeto-default-rtdb.firebaseio.com"
                        value={firebaseConfigForm.databaseURL || ''}
                        onChange={(e) => setFirebaseConfigForm({ ...firebaseConfigForm, databaseURL: e.target.value })}
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label className="form-label">Project ID:</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="meu-rodizio-123"
                        value={firebaseConfigForm.projectId || ''}
                        onChange={(e) => setFirebaseConfigForm({ ...firebaseConfigForm, projectId: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Web API Key:</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="AIzaSy..."
                      value={firebaseConfigForm.apiKey || ''}
                      onChange={(e) => setFirebaseConfigForm({ ...firebaseConfigForm, apiKey: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
                    <button
                      type="submit"
                      className="btn-primary"
                      style={{ borderRadius: '9999px' }}
                    >
                      <Cloud size={16} />
                      <span>Salvar & Conectar Firebase</span>
                    </button>

                    {firebaseConfigForm.apiKey && (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ borderRadius: '9999px' }}
                        onClick={handleClearFirebaseConfig}
                      >
                        <span>Desconectar / Voltar ao Modo Local</span>
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

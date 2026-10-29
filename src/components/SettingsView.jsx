import React, { useState } from 'react';
import { FlaskConical, Play, Save, RotateCcw, Download, Upload, FileText, Check, AlertCircle, Headset, ShieldAlert, Cloud, Wifi, ChevronDown, ChevronUp, RefreshCw, Lock, UploadCloud } from 'lucide-react';
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
  isAdmin = true,
  isSimulatingTime = false,
  onStartSimulation,
  onStopSimulation
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
      <div className="settings-view-container settings-locked animate-fade-in">
        <div className="ui-card settings-locked-card">
          <span className="settings-locked-icon" aria-hidden="true"><ShieldAlert size={26} /></span>
          <h2>Acesso restrito ao administrador</h2>
          <p>
            As regras de atendimento, a restauração de dados e as ferramentas de teste são exclusivas de administradores.
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
      <div className="settings-grid">
        {/* Aparência: o mesmo controle da sidebar, salvo por navegador */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="card-section-title">Aparência</h3>
            <span className="card-section-caption">
              Tema salvo individualmente no seu navegador
            </span>
          </div>
          <div className="ui-segmented" role="radiogroup" aria-label="Tema">
            <button
              type="button"
              role="radio"
              aria-checked={theme !== 'dark'}
              className={theme !== 'dark' ? 'is-on' : ''}
              onClick={() => theme === 'dark' && onToggleTheme && onToggleTheme()}
            >
              Claro
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'dark'}
              className={theme === 'dark' ? 'is-on' : ''}
              onClick={() => theme !== 'dark' && onToggleTheme && onToggleTheme()}
            >
              Escuro
            </button>
          </div>
        </div>

        {/* Ferramentas de teste: o simulador de horário saiu da barra principal */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h3 className="card-section-title with-icon">
              <FlaskConical size={18} aria-hidden="true" />
              <span>Ferramentas de teste</span>
            </h3>
            <span className="card-section-caption">
              Simule outro horário para conferir avisos, contagem do almoço e cobertura sem esperar o relógio.
            </span>
          </div>
          {isSimulatingTime ? (
            <div className="settings-inline-actions">
              <span className="ui-chip warn">Simulador ativo</span>
              <button type="button" className="ui-btn secondary sm" onClick={onStopSimulation}>
                <RotateCcw size={15} />
                Voltar ao horário real
              </button>
            </div>
          ) : (
            <button type="button" className="ui-btn secondary sm" onClick={onStartSimulation} disabled={!onStartSimulation}>
              <Play size={15} />
              Abrir simulador de horário
            </button>
          )}
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
              <p className="settings-help">
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
                  <option value={1}>1 atendente (padrão)</option>
                  <option value={2}>2 atendentes (dias de pico)</option>
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
                <p className="settings-help">Salva funcionários, regras e escalas em formato .JSON</p>
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
                  className="hidden-file-input"
                />
                <label htmlFor="import-file" className="btn-secondary settings-upload-btn">
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

            <div className="reset-data-area is-stacked">
              <div className="reset-data-row">
                <div className="reset-text">
                  <strong className="text-danger">Restaurar dados iniciais</strong>
                  <p className="settings-help">
                    Restaura os 4 funcionários da planilha com a escala de atendimento contínuo (11:30 às 13:30).
                  </p>
                </div>
                {!showResetPasswordPrompt && (
                  <button
                    type="button"
                    className="btn-danger-outline"
                    onClick={handleOpenResetPrompt}
                  >
                    <RotateCcw size={14} />
                    <span>Restaurar Padrão</span>
                  </button>
                )}
              </div>

              {showResetPasswordPrompt && (
                <form onSubmit={handleConfirmReset} className="reset-confirm-box animate-fade-in">
                  <div className="reset-confirm-head">
                    <Lock size={15} aria-hidden="true" />
                    <b>Confirmação de segurança</b>
                  </div>
                  <p className="settings-help">
                    Esta ação apaga as alterações atuais e volta a escala para os dados iniciais. Digite <strong className="text-danger">RESTAURAR</strong> para confirmar:
                  </p>
                  <div className="reset-confirm-row">
                    <input
                      type="text"
                      className="form-input reset-confirm-input"
                      placeholder="Digite RESTAURAR"
                      value={resetConfirmInput}
                      onChange={(e) => {
                        setResetConfirmInput(e.target.value);
                        setResetConfirmError('');
                      }}
                      autoFocus
                    />
                    <button type="submit" className="ui-btn danger sm">
                      Confirmar restauração
                    </button>
                    <button type="button" className="ui-btn secondary sm" onClick={handleCancelResetPrompt}>
                      Cancelar
                    </button>
                  </div>
                  {resetConfirmError && (
                    <div className="ui-alert danger" role="alert">
                      <AlertCircle size={15} />
                      <span>{resetConfirmError}</span>
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Sincronização em Nuvem (Firebase Realtime Database) */}
        <div className="settings-card is-wide">
          <div className="settings-card-header is-row">
            <div>
              <h3 className="card-section-title with-icon">
                <Cloud size={18} aria-hidden="true" />
                <span>Sincronização em Nuvem (Tempo Real)</span>
              </h3>
              <span className="card-section-caption">
                Atualizações simultâneas e automáticas para todos os membros da equipe
              </span>
            </div>

            <div className="settings-inline-actions">
              <span className={`ui-chip ${isFirebaseConnected ? 'ok' : 'warn'}`}>
                {isFirebaseConnected ? 'Conectado (online)' : 'Desconectado (offline)'}
              </span>

              {!isFirebaseConnected && (
                <button
                  type="button"
                  onClick={handleReconnectFirebase}
                  className="ui-btn secondary sm"
                  title="Tentar reconectar à nuvem"
                >
                  <RefreshCw size={13} />
                  <span>Reconectar</span>
                </button>
              )}
            </div>
          </div>

          <div className="cloud-status-box">
            <div className="cloud-status-row">
              <div className="cloud-status-main">
                <span className={`cloud-status-icon ${isFirebaseConnected ? 'is-ok' : 'is-warn'}`} aria-hidden="true">
                  <Wifi size={20} />
                </span>
                <div>
                  <b className="cloud-status-title">
                    {isFirebaseConnected ? 'Sistema operando online, em tempo real' : 'Sistema desconectado da nuvem'}
                  </b>
                  <p className="settings-help">
                    {isFirebaseConnected
                      ? 'Todas as alterações de horários, regras e equipe são sincronizadas automaticamente em tempo real para todos os colegas.'
                      : 'O sistema está em modo local. Clique em Reconectar para voltar a sincronizar com a equipe.'}
                  </p>
                </div>
              </div>

              <div className="settings-inline-actions">
                {!isFirebaseConnected && (
                  <button type="button" onClick={handleReconnectFirebase} className="ui-btn primary sm">
                    <RefreshCw size={14} />
                    <span>Reconectar Agora</span>
                  </button>
                )}

                {isFirebaseConnected && onSyncAllToCloud && (
                  <button
                    type="button"
                    className="ui-btn secondary sm"
                    onClick={async () => {
                      setIsSyncingCloud(true);
                      await onSyncAllToCloud();
                      setIsSyncingCloud(false);
                    }}
                    disabled={isSyncingCloud}
                    title="Envia a lista de funcionários, regras e escalas locais atuais para o Firebase"
                  >
                    <UploadCloud size={15} />
                    <span>{isSyncingCloud ? 'Sincronizando…' : 'Enviar dados locais para a nuvem'}</span>
                  </button>
                )}
              </div>
            </div>

            {firebaseStatusMsg && (
              <div className={`ui-alert ${firebaseStatusMsg.success ? 'success' : 'danger'}`} role="status">
                <span>{firebaseStatusMsg.message}</span>
              </div>
            )}

            {/* Manutenção técnica avançada (só aparece para o administrador) */}
            <div className="cloud-advanced">
              <button
                type="button"
                className="cloud-advanced-toggle"
                onClick={handleToggleAdvanced}
                aria-expanded={showAdvancedFirebase}
                title="Configurações avançadas apenas para manutenção técnica"
              >
                <Lock size={13} aria-hidden="true" />
                {showAdvancedFirebase ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>Configurações técnicas de manutenção</span>
              </button>

              {/* Formulário Técnico para Administrador */}
              {showAdvancedFirebase && (
                <form onSubmit={handleSaveFirebaseConfig} className="settings-form cloud-advanced-form animate-fade-in">
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

                  <div className="settings-submit-row">
                    <button type="submit" className="btn-primary">
                      <Cloud size={16} />
                      <span>Salvar & Conectar Firebase</span>
                    </button>

                    {firebaseConfigForm.apiKey && (
                      <button type="button" className="btn-secondary" onClick={handleClearFirebaseConfig}>
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

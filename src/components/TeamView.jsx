import React, { useState } from 'react';
import { Users, UserPlus, Edit2, Trash2, Clock, ShieldAlert, X, Lock, Mail } from 'lucide-react';

const COLOR_PALETTE = [
  '#3b82f6', // Azul
  '#8b5cf6', // Violeta
  '#ec4899', // Rosa
  '#f59e0b', // Âmbar
  '#10b981', // Esmeralda
  '#06b6d4', // Ciano
  '#f97316', // Laranja
  '#6366f1'  // Índigo
];

export default function TeamView({
  employees,
  onSaveEmployee,
  onDeleteEmployee,
  isAdmin = true,
  currentUserEmployeeId = null
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);

  const [formName, setFormName] = useState('');
  const [formShortName, setFormShortName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('Equipe Operacional');
  const [formColor, setFormColor] = useState(COLOR_PALETTE[0]);
  const [formActive, setFormActive] = useState(true);
  const [formPreferredTime, setFormPreferredTime] = useState('');
  const [formRestrictions, setFormRestrictions] = useState('');

  const handleOpenAdd = () => {
    if (!isAdmin) {
      alert('Acesso negado: Somente administradores podem cadastrar novos funcionários.');
      return;
    }
    setEditingEmp(null);
    setFormName('');
    setFormShortName('');
    setFormEmail('');
    setFormRole('Equipe Operacional');
    setFormColor(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]);
    setFormActive(true);
    setFormPreferredTime('');
    setFormRestrictions('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp) => {
    const isOwn = emp.id === currentUserEmployeeId;
    if (!isAdmin && !isOwn) {
      alert('Acesso negado: Usuários normais só podem editar seu próprio perfil.');
      return;
    }

    setEditingEmp(emp);
    setFormName(emp.name);
    setFormShortName(emp.shortName || '');
    setFormEmail(emp.email || '');
    setFormRole(emp.role || 'Equipe');
    setFormColor(emp.color || COLOR_PALETTE[0]);
    setFormActive(emp.active !== false);
    setFormPreferredTime(emp.preferredTime || '');
    setFormRestrictions(emp.restrictions || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const isOwn = editingEmp && editingEmp.id === currentUserEmployeeId;
    if (!isAdmin && !isOwn && !editingEmp) {
      alert('Acesso negado: Somente administradores podem criar funcionários.');
      return;
    }
    if (!isAdmin && editingEmp && !isOwn) {
      alert('Acesso negado: Você só pode editar seu próprio perfil.');
      return;
    }

    const initials = formName
      .trim()
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    const employeeData = {
      id: editingEmp ? editingEmp.id : `emp-${Date.now()}`,
      name: formName.trim(),
      shortName: formShortName.trim() || formName.trim().split(' ')[0],
      email: formEmail.trim().toLowerCase(),
      avatar: initials,
      color: formColor,
      // Se não for admin, preserva o cargo original para evitar escalada de privilégio
      role: isAdmin ? formRole.trim() : (editingEmp?.role || formRole.trim()),
      active: isAdmin ? formActive : (editingEmp?.active !== false),
      preferredTime: formPreferredTime || null,
      restrictions: formRestrictions.trim() || null
    };

    onSaveEmployee(employeeData);
    setIsModalOpen(false);
  };

  return (
    <div className="team-view-container animate-fade-in">
      {/* Topo da Seção de Equipe */}
      <div className="team-header-bar">
        <div className="team-title-group">
          <Users size={22} className="text-primary-500" />
          <div>
            <h2 className="team-main-title">Gestão da Equipe</h2>
            <p className="team-sub-title">
              {employees.length} membros cadastrados • {employees.filter((e) => e.active).length} ativos no rodízio
            </p>
          </div>
        </div>

        {/* Botão Novo Funcionário (Exclusivo Administrador) */}
        {isAdmin ? (
          <button className="btn-primary" onClick={handleOpenAdd}>
            <UserPlus size={16} />
            <span>Novo Funcionário</span>
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <Lock size={14} />
            <span>Cadastro restrito a administradores</span>
          </div>
        )}
      </div>

      {/* Grid de Membros */}
      <div className="team-cards-grid">
        {employees.map((emp) => {
          const isOwn = emp.id === currentUserEmployeeId;
          const canEditThis = isAdmin || isOwn;

          return (
            <div
              key={emp.id}
              className={`team-member-card ${!emp.active ? 'is-inactive-card' : ''}`}
              style={{
                border: isOwn ? '1.5px solid var(--primary-500)' : '1px solid var(--border-color)',
                position: 'relative'
              }}
            >
              {isOwn && (
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'var(--primary-500)',
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    letterSpacing: '0.04em'
                  }}
                >
                  SEU PERFIL
                </div>
              )}

              <div className="member-card-top">
                <div
                  className="member-avatar"
                  style={{
                    backgroundColor: emp.color || '#381267',
                    width: '48px',
                    height: '48px',
                    minWidth: '48px',
                    minHeight: '48px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    flexShrink: 0
                  }}
                >
                  {emp.avatar || emp.name.slice(0, 2).toUpperCase()}
                </div>

                <div className="member-status-pill">
                  {emp.active ? (
                    <span className="status-badge-active">
                      <span className="dot-active" /> Ativo
                    </span>
                  ) : (
                    <span className="status-badge-inactive">
                      <span className="dot-inactive" /> Inativo
                    </span>
                  )}
                </div>
              </div>

              <div className="member-info">
                <h3 className="member-name">{emp.name}</h3>
                <p className="member-role">{emp.role || 'Colaborador'}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <Mail size={13} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={emp.email || 'E-mail não cadastrado'}>
                    {emp.email || 'E-mail não cadastrado'}
                  </span>
                </div>
              </div>

              {/* Preferências e Restrições */}
              <div className="member-details-list">
                <div className="member-detail-row">
                  <Clock size={14} className="text-slate-400" />
                  <span>Horário preferencial:</span>
                  <strong>{emp.preferredTime || 'Sem preferência'}</strong>
                </div>
                {emp.restrictions && (
                  <div className="member-detail-row text-amber-600">
                    <ShieldAlert size={14} />
                    <span>Restrição: {emp.restrictions}</span>
                  </div>
                )}
              </div>

              {/* Ações Autorizadas */}
              <div className="member-card-footer">
                {canEditThis ? (
                  <button
                    type="button"
                    className="btn-member-action edit"
                    style={{ borderRadius: '9999px' }}
                    onClick={() => handleOpenEdit(emp)}
                    title={isOwn ? 'Editar seus dados' : 'Editar funcionário (Admin)'}
                  >
                    <Edit2 size={14} />
                    <span>Editar {isOwn ? 'Meus Dados' : ''}</span>
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', padding: '6px 0' }}>
                    <Lock size={13} />
                    <span>Protegido contra alteração</span>
                  </div>
                )}

                {/* Excluir funcionário: estritamente restrito a Administradores */}
                {isAdmin && (
                  <button
                    type="button"
                    className="btn-member-action delete"
                    style={{ borderRadius: '9999px' }}
                    onClick={() => {
                      if (window.confirm(`Deseja remover ${emp.name} da equipe?`)) {
                        onDeleteEmployee(emp.id);
                      }
                    }}
                    title="Excluir funcionário (Exclusivo Administrador)"
                  >
                    <Trash2 size={14} />
                    <span>Excluir</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Criação / Edição */}
      {isModalOpen && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setIsModalOpen(false)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <Users size={19} className="text-primary-500" />
                <div>
                  <h3 className="modal-title">
                    {editingEmp ? (editingEmp.id === currentUserEmployeeId ? 'Editar Meus Dados' : 'Editar Funcionário') : 'Novo Funcionário'}
                  </h3>
                  <span className="modal-subtitle">Preencha os dados do colaborador</span>
                </div>
              </div>
              <button className="btn-modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label">Nome Completo:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Mateus de Oliveira Silva"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>E-mail de Acesso (Login):</span>
                  {isAdmin ? (
                    <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>Editável por Administrador</span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>(Restrito a Administrador)</span>
                  )}
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="email"
                    className="form-input"
                    placeholder="Ex: colaborador@scadahub.com"
                    value={formEmail}
                    disabled={!isAdmin}
                    onChange={(e) => setFormEmail(e.target.value)}
                    style={{ paddingLeft: '38px', opacity: isAdmin ? 1 : 0.65 }}
                    required={isAdmin}
                  />
                </div>
              </div>

              <div className="form-group-row">
                <div className="form-group flex-1">
                  <label className="form-label">Nome Curto / Apelido:</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: Mateus O."
                    value={formShortName}
                    onChange={(e) => setFormShortName(e.target.value)}
                  />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">
                    Cargo / Setor:
                    {!isAdmin && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>(Restrito a Admin)</span>}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: Equipe Operacional"
                    value={formRole}
                    disabled={!isAdmin}
                    onChange={(e) => setFormRole(e.target.value)}
                    style={{ opacity: isAdmin ? 1 : 0.65 }}
                  />
                </div>
              </div>

              {/* Seletor de Cor do Avatar */}
              <div className="form-group">
                <label className="form-label">Cor de Identificação:</label>
                <div className="color-palette-picker">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      type="button"
                      key={color}
                      className={`color-choice-btn ${formColor === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormColor(color)}
                    />
                  ))}
                </div>
              </div>

              {/* Status Ativo / Inativo (Somente Admin pode alterar) */}
              <div className="form-group">
                <label className="form-label">
                  Status no Rodízio:
                  {!isAdmin && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>(Definido pela Gestão)</span>}
                </label>
                <div className="switch-status-group" style={{ opacity: isAdmin ? 1 : 0.65 }}>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="status"
                      disabled={!isAdmin}
                      checked={formActive}
                      onChange={() => setFormActive(true)}
                    />
                    <span>🟢 Ativo (Participa do Rodízio)</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="status"
                      disabled={!isAdmin}
                      checked={!formActive}
                      onChange={() => setFormActive(false)}
                    />
                    <span>⚪ Inativo (Não entra na escala)</span>
                  </label>
                </div>
              </div>

              {/* Preferências Opcionais */}
              <div className="form-group-row">
                <div className="form-group flex-1">
                  <label className="form-label">Horário Preferencial (Opcional):</label>
                  <input
                    type="time"
                    className="form-input"
                    value={formPreferredTime}
                    onChange={(e) => setFormPreferredTime(e.target.value)}
                  />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Restrições (Opcional):</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: Não antes das 12:00"
                    value={formRestrictions}
                    onChange={(e) => setFormRestrictions(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingEmp ? 'Salvar Alterações' : 'Cadastrar Funcionário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

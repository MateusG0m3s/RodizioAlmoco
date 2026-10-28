import React, { useState } from 'react';
import { Users, UserPlus, Edit2, Trash2, Clock, ShieldAlert, X, Lock, Mail } from 'lucide-react';
import { getInitials } from '../utils/nameUtils';
import { AVATAR_PALETTE, resolveAvatarColor } from '../utils/avatarColors';

const COLOR_PALETTE = AVATAR_PALETTE;

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

  const isEditingOwnProfile = Boolean(editingEmp && editingEmp.id === currentUserEmployeeId);
  const canEditStatus = Boolean(isAdmin || isEditingOwnProfile);

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
    setFormColor(resolveAvatarColor(emp.color, emp.id));
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
      email: isAdmin ? formEmail.trim().toLowerCase() : (editingEmp?.email || formEmail).trim().toLowerCase(),
      avatar: initials,
      color: formColor,
      // Se não for admin, preserva o cargo original para evitar escalada de privilégio
      role: isAdmin ? formRole.trim() : (editingEmp?.role || formRole.trim()),
      active: canEditStatus ? formActive : (editingEmp?.active !== false),
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
        <p className="ui-label team-count">
          {employees.length} membros cadastrados • {employees.filter((e) => e.active).length} ativos no rodízio
        </p>

        {/* Botão Novo Funcionário (Exclusivo Administrador) */}
        {isAdmin ? (
          <button className="btn-primary" onClick={handleOpenAdd}>
            <UserPlus size={16} />
            <span>Novo Funcionário</span>
          </button>
        ) : (
          <div className="ui-caption with-icon">
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
              className={`team-member-card ${!emp.active ? 'is-inactive-card' : ''} ${isOwn ? 'is-own' : ''}`}
            >
              <div className="member-card-top">
                <div
                  className="ui-avatar member-avatar"
                  style={{ background: resolveAvatarColor(emp.color, emp.id) }}
                  aria-hidden="true"
                >
                  {getInitials(emp.name)}
                </div>

                <div className="member-status-pill">
                  {isOwn && <span className="ui-chip you">Seu perfil</span>}
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
                <div className="member-email">
                  <Mail size={13} aria-hidden="true" />
                  <span title={emp.email || 'E-mail não cadastrado'}>
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
                    onClick={() => handleOpenEdit(emp)}
                    title={isOwn ? 'Editar seus dados' : 'Editar funcionário (Admin)'}
                  >
                    <Edit2 size={14} />
                    <span>{isOwn ? 'Editar meus dados' : 'Editar'}</span>
                  </button>
                ) : (
                  <div className="ui-caption with-icon member-locked">
                    <Lock size={13} />
                    <span>Protegido contra alteração</span>
                  </div>
                )}

                {/* Excluir funcionário: estritamente restrito a Administradores */}
                {isAdmin && (
                  <button
                    type="button"
                    className="btn-member-action delete is-icon-only"
                    onClick={() => {
                      if (window.confirm(`Deseja remover ${emp.name} da equipe?`)) {
                        onDeleteEmployee(emp.id);
                      }
                    }}
                    title={`Excluir ${emp.name} da equipe`}
                    aria-label={`Excluir ${emp.name} da equipe`}
                  >
                    <Trash2 size={15} />
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
                    {editingEmp ? (isEditingOwnProfile ? 'Editar Meus Dados' : 'Editar Funcionário') : 'Novo Funcionário'}
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
                <label className="form-label is-split">
                  <span>E-mail de acesso (login)</span>
                  {isAdmin ? (
                    <span className="form-hint is-ok">Editável por administrador</span>
                  ) : (
                    <span className="form-hint">Restrito a administrador</span>
                  )}
                </label>
                <div className="input-with-icon">
                  <Mail size={16} />
                  <input
                    type="email"
                    className="form-input"
                    placeholder="Ex: colaborador@scadahub.com"
                    value={formEmail}
                    disabled={!isAdmin}
                    onChange={(e) => setFormEmail(e.target.value)}
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
                    {!isAdmin && <span className="form-hint">Restrito a admin</span>}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: Equipe Operacional"
                    value={formRole}
                    disabled={!isAdmin}
                    onChange={(e) => setFormRole(e.target.value)}
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

              {/* Status Ativo / Inativo (Admin ou o próprio colaborador ao editar seus dados) */}
              <div className="form-group">
                <label className="form-label">
                  Status no Rodízio:
                  {!canEditStatus && <span className="form-hint">Definido pela gestão</span>}
                </label>
                <div className={`switch-status-group ${canEditStatus ? '' : 'is-disabled'}`}>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="status"
                      disabled={!canEditStatus}
                      checked={formActive}
                      onChange={() => setFormActive(true)}
                    />
                    <span>🟢 Ativo (Participa do Rodízio)</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="status"
                      disabled={!canEditStatus}
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

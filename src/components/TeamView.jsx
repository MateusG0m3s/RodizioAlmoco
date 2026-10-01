import React, { useState } from 'react';
import { Users, UserPlus, Edit2, Trash2, CheckCircle2, XCircle, Clock, ShieldAlert, Palette, X } from 'lucide-react';

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

export default function TeamView({ employees, onSaveEmployee, onDeleteEmployee }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);

  const [formName, setFormName] = useState('');
  const [formShortName, setFormShortName] = useState('');
  const [formRole, setFormRole] = useState('Equipe Operacional');
  const [formColor, setFormColor] = useState(COLOR_PALETTE[0]);
  const [formActive, setFormActive] = useState(true);
  const [formPreferredTime, setFormPreferredTime] = useState('');
  const [formRestrictions, setFormRestrictions] = useState('');

  const handleOpenAdd = () => {
    setEditingEmp(null);
    setFormName('');
    setFormShortName('');
    setFormRole('Equipe Operacional');
    setFormColor(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]);
    setFormActive(true);
    setFormPreferredTime('');
    setFormRestrictions('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp) => {
    setEditingEmp(emp);
    setFormName(emp.name);
    setFormShortName(emp.shortName || '');
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
      avatar: initials,
      color: formColor,
      role: formRole.trim(),
      active: formActive,
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

        <button className="btn-primary" onClick={handleOpenAdd}>
          <UserPlus size={16} />
          <span>Novo Funcionário</span>
        </button>
      </div>

      {/* Grid de Membros */}
      <div className="team-cards-grid">
        {employees.map((emp) => (
          <div key={emp.id} className={`team-member-card ${!emp.active ? 'is-inactive-card' : ''}`}>
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

            {/* Ações */}
            <div className="member-card-footer">
              <button
                type="button"
                className="btn-member-action edit"
                style={{ borderRadius: '9999px' }}
                onClick={() => handleOpenEdit(emp)}
                title="Editar funcionário"
              >
                <Edit2 size={14} />
                <span>Editar</span>
              </button>
              <button
                type="button"
                className="btn-member-action delete"
                style={{ borderRadius: '9999px' }}
                onClick={() => {
                  if (window.confirm(`Deseja remover ${emp.name} da equipe?`)) {
                    onDeleteEmployee(emp.id);
                  }
                }}
                title="Excluir funcionário"
              >
                <Trash2 size={14} />
                <span>Excluir</span>
              </button>
            </div>
          </div>
        ))}
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
                    {editingEmp ? 'Editar Funcionário' : 'Novo Funcionário'}
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
                  <label className="form-label">Cargo / Setor:</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: Equipe Operacional"
                    value={formRole}
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

              {/* Status Ativo / Inativo */}
              <div className="form-group">
                <label className="form-label">Status no Rodízio:</label>
                <div className="switch-status-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="status"
                      checked={formActive}
                      onChange={() => setFormActive(true)}
                    />
                    <span>🟢 Ativo (Participa do Rodízio)</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="status"
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

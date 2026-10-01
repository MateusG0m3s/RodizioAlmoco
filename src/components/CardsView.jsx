import React from 'react';
import { Utensils, Clock, CheckCircle2, Briefcase, Edit2, AlertTriangle, Plus, ChevronRight } from 'lucide-react';
import { getEmployeeLunchStatus } from '../utils/timeUtils';

export default function CardsView({
  employees,
  daySlots,
  currentTimeMinutes,
  conflictSlotIds,
  onEditSlot,
  onAddSlotForEmployee
}) {
  return (
    <div className="employee-cards-grid">
      {employees.map((emp) => {
        const slot = daySlots.find((s) => s.employeeId === emp.id);
        const status = getEmployeeLunchStatus(emp.id, daySlots, currentTimeMinutes, 10);
        const isConflict = slot && conflictSlotIds.includes(slot.id);

        return (
          <div
            key={emp.id}
            className={`employee-status-card ${status.type} ${isConflict ? 'has-conflict-border' : ''} ${!emp.active ? 'is-inactive' : ''}`}
          >
            {/* Topo do Card */}
            <div className="card-person-header">
              <div
                className="person-avatar"
                style={{ backgroundColor: emp.color || '#3b82f6' }}
              >
                {emp.avatar || emp.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="person-titles">
                <h4 className="person-name">{emp.name}</h4>
                <span className="person-role">{emp.role || 'Equipe'}</span>
              </div>
              {!emp.active && <span className="inactive-badge">Inativo</span>}
            </div>

            {/* Status Atual do Colaborador */}
            <div className="status-indicator-box">
              <div className={`status-pill ${status.badgeClass}`}>
                {status.type === 'LUNCHING_NOW' && <Utensils size={14} className="pulse-icon" />}
                {status.type === 'UPCOMING_SOON' && <Clock size={14} className="pulse-icon" />}
                {status.type === 'WORKING_BEFORE' && <Briefcase size={14} />}
                {status.type === 'FINISHED' && <CheckCircle2 size={14} />}
                <span>{status.label}</span>
              </div>

              {isConflict && (
                <div className="conflict-badge-mini" title="Conflito de horário detectado">
                  <AlertTriangle size={13} /> Conflito
                </div>
              )}
            </div>

            {/* Informações de Horário */}
            <div className="lunch-time-box">
              {slot ? (
                <>
                  <div className="lunch-label">Horário de Almoço:</div>
                  <div className="lunch-hours">
                    <span className="time-highlight">{slot.startTime}</span>
                    <span className="time-sep">—</span>
                    <span className="time-highlight">{slot.endTime}</span>
                    <span className="time-duration">({slot.duration || 30} min)</span>
                  </div>

                  {status.type === 'LUNCHING_NOW' && (
                    <div className="live-countdown-card">
                      <div className="countdown-progress-bar">
                        <div
                          className="countdown-progress-fill"
                          style={{ width: `${status.progressPercent}%` }}
                        />
                      </div>
                      <span className="countdown-text">
                        Restam <strong>{status.remainingMinutes} minutos</strong>
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-slot-box">
                  <span>Nenhum horário definido para hoje</span>
                </div>
              )}
            </div>

            {/* Botão de Ação */}
            <div className="card-actions-footer">
              {slot ? (
                <button
                  className="btn-card-edit"
                  onClick={() => onEditSlot(slot, emp)}
                >
                  <Edit2 size={14} />
                  <span>Editar Horário</span>
                </button>
              ) : (
                <button
                  className="btn-card-add"
                  onClick={() => onAddSlotForEmployee(emp)}
                >
                  <Plus size={14} />
                  <span>Definir Horário</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

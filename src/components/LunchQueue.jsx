import React from 'react';
import { Plus } from 'lucide-react';
import { getInitials, getShortName } from '../utils/nameUtils';
import { resolveAvatarColor } from '../utils/avatarColors';
import { getSlotPhase } from '../utils/lunchState';

const PHASE_CHIP = {
  done: { className: '', label: 'Concluído' },
  now: { className: 'now', label: 'Almoçando' },
  next: { className: 'next', label: 'A seguir' }
};

// Fila do dia no celular: a mesma informação da timeline, em lista ordenada por horário
export default function LunchQueue({
  employees = [],
  summary,
  currentTimeMinutes,
  conflictSlotIds = [],
  coverage,
  isAdmin = false,
  currentUserEmployeeId = null,
  onEditSlot,
  onAddSlotForEmployee,
  headerActions = null
}) {
  const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));
  const withSlot = new Set(summary.sortedSlots.map((s) => s.employeeId));
  const withoutSlot = employees.filter((e) => e.active && !withSlot.has(e.id));
  const canEdit = (employeeId) => isAdmin || employeeId === currentUserEmployeeId;

  return (
    <section className="ui-card lunch-queue" aria-label="Fila do dia">
      <div className="ui-card-head">
        <div className="ui-card-title">Fila do dia</div>
        <div className="queue-head-side">
          {coverage?.hasGaps ? <span className="ui-chip bad">Brecha</span> : <span className="ui-chip ok">Coberto</span>}
          {headerActions}
        </div>
      </div>

      <ul className="queue-list">
        {summary.sortedSlots.map((slot) => {
          const emp = empMap[slot.employeeId];
          if (!emp) return null;
          const isYou = emp.id === currentUserEmployeeId;
          const isConflict = conflictSlotIds.includes(slot.id);
          const phase = PHASE_CHIP[getSlotPhase(slot, currentTimeMinutes)];
          const editable = canEdit(emp.id);
          return (
            <li key={slot.id}>
              <button
                type="button"
                className={`queue-row ${isYou ? 'is-you' : ''}`}
                onClick={() => editable && onEditSlot(slot, emp)}
                disabled={!editable}
                title={editable ? 'Editar horário' : `Escala de ${emp.name} (somente leitura)`}
              >
                <span className={`ui-avatar ${isYou ? 'is-you' : ''}`} style={{ background: resolveAvatarColor(emp.color, emp.id) }} aria-hidden="true">
                  {getInitials(emp.name)}
                </span>
                <span className="queue-row-text">
                  <b>{getShortName(emp.name)}</b>
                  <span>{slot.startTime} – {slot.endTime}</span>
                </span>
                {isConflict ? (
                  <span className="ui-chip bad">Conflito</span>
                ) : isYou ? (
                  <span className="ui-chip you">Você</span>
                ) : (
                  <span className={`ui-chip ${phase.className}`}>{phase.label}</span>
                )}
              </button>
            </li>
          );
        })}

        {withoutSlot.map((emp) => (
          <li key={emp.id}>
            <div className="queue-row is-empty">
              <span className="ui-avatar" style={{ background: resolveAvatarColor(emp.color, emp.id) }} aria-hidden="true">
                {getInitials(emp.name)}
              </span>
              <span className="queue-row-text">
                <b>{getShortName(emp.name)}</b>
                <span>Sem horário</span>
              </span>
              {canEdit(emp.id) && (
                <button type="button" className="ui-btn secondary sm" onClick={() => onAddSlotForEmployee(emp)}>
                  <Plus size={14} />
                  Definir
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

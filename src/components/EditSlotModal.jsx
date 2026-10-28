import React, { useState, useEffect } from 'react';
import { X, Clock, AlertTriangle, Check, Trash2, Lock, Users } from 'lucide-react';
import { getInitials } from '../utils/nameUtils';
import { timeToMinutes, minutesToTime, addMinutesToTime, formatDateBR } from '../utils/timeUtils';
import { resolveAvatarColor } from '../utils/avatarColors';

export default function EditSlotModal({
  isOpen,
  onClose,
  slot,
  employee,
  employees,
  daySlots,
  settings,
  date,
  onSave,
  onDelete,
  isAdmin = true,
  currentUserEmployeeId = null
}) {
  // Limites Oficiais de Intervalo de Almoço (Mínimo: 30 minutos | Máximo: 2 horas / 120 minutos)
  const MIN_LUNCH_MINUTES = 30;
  const MAX_LUNCH_MINUTES = 120;
  const DURATION_PRESETS = [30, 40, 45, 60, 120];

  const getSafeDuration = (val) => {
    const num = Number(val);
    if (isNaN(num) || num < MIN_LUNCH_MINUTES) return MIN_LUNCH_MINUTES;
    if (num > MAX_LUNCH_MINUTES) return MAX_LUNCH_MINUTES;
    return num;
  };

  const initialDuration = slot && slot.startTime && slot.endTime
    ? getSafeDuration(timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime))
    : getSafeDuration(slot?.duration || settings?.defaultDuration || 30);

  const [startTime, setStartTime] = useState(slot ? slot.startTime : '12:00');
  const [duration, setDuration] = useState(initialDuration);
  const [endTime, setEndTime] = useState(
    slot ? slot.endTime : addMinutesToTime('12:00', initialDuration)
  );
  const [conflictWarning, setConflictWarning] = useState(null);
  const [sharedShiftNames, setSharedShiftNames] = useState([]);

  // Sincroniza estado quando modal abre ou o slot muda
  useEffect(() => {
    if (isOpen) {
      const rawDur = slot && slot.startTime && slot.endTime
        ? timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime)
        : Number(slot?.duration || settings?.defaultDuration || 30);
      const dur = getSafeDuration(rawDur);
      setDuration(dur);
      const start = slot ? slot.startTime : '12:00';
      setStartTime(start);
      setEndTime(
        slot && rawDur >= MIN_LUNCH_MINUTES && rawDur <= MAX_LUNCH_MINUTES
          ? slot.endTime
          : addMinutesToTime(start, dur)
      );
    }
  }, [isOpen, slot, settings]);

  // Checa se a alteração deste horário compromete o atendimento aos clientes (11:30 - 13:30)
  useEffect(() => {
    if (!isOpen) return;

    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    const otherSlots = (daySlots || []).filter((s) => s.id !== slot?.id);

    // Identifica colegas almoçando no mesmo intervalo
    const sameShift = [];
    otherSlots.forEach((other) => {
      const oStart = timeToMinutes(other.startTime);
      const oEnd = timeToMinutes(other.endTime);
      if (Math.max(startMin, oStart) < Math.min(endMin, oEnd)) {
        const otherEmp = employees.find((e) => e.id === other.employeeId);
        sameShift.push(otherEmp?.name || 'Colega');
      }
    });
    setSharedShiftNames(sameShift);

    // Valida se na janela crítica há pelo menos minWorking pessoas trabalhando
    const critStartMin = timeToMinutes(settings?.criticalStart || '11:30');
    const critEndMin = timeToMinutes(settings?.criticalEnd || '13:30');
    const minWorking = settings?.minWorkingDuringCritical || 1;
    const activeEmps = (employees || []).filter((e) => e.active);

    const simulatedSlots = [
      ...otherSlots,
      { id: slot?.id || 'temp', employeeId: employee?.id, startTime, endTime, duration }
    ];

    let uncoveredMinutes = 0;
    for (let m = critStartMin; m < critEndMin; m += 1) {
      let workingCount = 0;
      activeEmps.forEach((emp) => {
        const empSlot = simulatedSlots.find((s) => s.employeeId === emp.id);
        if (empSlot) {
          const sMin = timeToMinutes(empSlot.startTime);
          const eMin = timeToMinutes(empSlot.endTime);
          if (m < sMin || m >= eMin) workingCount++;
        } else {
          workingCount++;
        }
      });
      if (workingCount < minWorking) {
        uncoveredMinutes += 1;
      }
    }

    if (uncoveredMinutes > 0) {
      setConflictWarning(
        `Atenção: Este horário deixará o atendimento ao cliente desassistido por ${uncoveredMinutes} min entre ${settings?.criticalStart || '11:30'}h e ${settings?.criticalEnd || '13:30'}h!`
      );
    } else {
      setConflictWarning(null);
    }
  }, [isOpen, startTime, endTime, duration, daySlots, slot, employee, employees, settings]);

  const handleSelectDuration = (mins) => {
    const safeMins = Math.max(MIN_LUNCH_MINUTES, Math.min(MAX_LUNCH_MINUTES, mins));
    setDuration(safeMins);
    if (startTime) {
      setEndTime(addMinutesToTime(startTime, safeMins));
    }
  };

  const handleStartTimeChange = (newStart) => {
    setStartTime(newStart);
    if (newStart && duration) {
      const validDuration = Math.max(MIN_LUNCH_MINUTES, Math.min(MAX_LUNCH_MINUTES, duration));
      setEndTime(addMinutesToTime(newStart, validDuration));
    }
  };

  const handleEndTimeChange = (newEnd) => {
    setEndTime(newEnd);
    if (newEnd && startTime) {
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(newEnd);
      if (endMinutes > startMinutes) {
        setDuration(endMinutes - startMinutes);
      } else {
        setDuration(0);
      }
    }
  };

  const handleFineAdjust = (deltaMinutes) => {
    const currentMin = timeToMinutes(startTime);
    const startLimit = timeToMinutes(settings?.startHour || '11:00');
    const endLimit = timeToMinutes(settings?.endHour || '14:00');
    const validDuration = Math.max(MIN_LUNCH_MINUTES, Math.min(MAX_LUNCH_MINUTES, duration));

    const newMin = Math.max(startLimit, Math.min(endLimit - validDuration, currentMin + deltaMinutes));
    const newStartStr = minutesToTime(newMin);
    setStartTime(newStartStr);
    setEndTime(addMinutesToTime(newStartStr, validDuration));
  };

  // Verificação de Propriedade da Escala (Regra Fundamental da Auditoria)
  const isOwner = employee?.id === currentUserEmployeeId;
  const isAllowedToEdit = isAdmin || isOwner;

  // Validação Dinâmica do Intervalo de Almoço (Mínimo: 30 min | Máximo: 2 horas / 120 min)
  const sMin = timeToMinutes(startTime);
  const eMin = timeToMinutes(endTime);
  const computedDuration = eMin > sMin ? eMin - sMin : 0;
  const isTimeOrderInvalid = eMin <= sMin;
  const isDurationTooShort = !isTimeOrderInvalid && computedDuration < MIN_LUNCH_MINUTES;
  const isDurationTooLong = !isTimeOrderInvalid && computedDuration > MAX_LUNCH_MINUTES;
  const isDurationInvalid = isTimeOrderInvalid || isDurationTooShort || isDurationTooLong;

  let durationErrorMessage = null;
  if (isTimeOrderInvalid) {
    durationErrorMessage = 'O horário de término deve ser posterior ao horário de início!';
  } else if (isDurationTooShort) {
    durationErrorMessage = 'O intervalo de almoço deve ser de no mínimo 30 minutos.';
  } else if (isDurationTooLong) {
    durationErrorMessage = 'O intervalo de almoço deve ser de no máximo 2 horas (120 minutos).';
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isAllowedToEdit) {
      alert('Acesso negado: Você só pode modificar sua própria escala de almoço.');
      return;
    }

    if (eMin <= sMin) {
      alert('O horário de término deve ser posterior ao horário de início!');
      return;
    }
    const finalDuration = eMin - sMin;
    if (finalDuration < MIN_LUNCH_MINUTES) {
      alert('O intervalo de almoço deve ser de no mínimo 30 minutos.');
      return;
    }
    if (finalDuration > MAX_LUNCH_MINUTES) {
      alert('O intervalo de almoço deve ser de no máximo 2 horas (120 minutos).');
      return;
    }

    onSave({
      id: slot ? slot.id : `slot-${date}-${employee.id}`,
      employeeId: employee.id,
      date,
      startTime,
      endTime,
      duration: finalDuration,
      isAutoGenerated: false
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        className="modal-card animate-scale-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-slot-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-icon" aria-hidden="true"><Clock size={18} /></span>
            <div>
              <h3 id="edit-slot-title" className="modal-title">
                {isAllowedToEdit ? (slot ? 'Editar almoço' : 'Definir almoço') : 'Almoço (somente leitura)'}
              </h3>
              <span className="modal-subtitle">
                {isAllowedToEdit
                  ? 'Escolha a duração ou ajuste início e fim livremente.'
                  : 'Este horário pertence a outro colaborador.'}
              </span>
            </div>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {!isAllowedToEdit && (
            <div className="ui-alert warning">
              <Lock size={16} />
              <span>Cada pessoa só altera a própria escala. Peça a um administrador se precisar mudar este horário.</span>
            </div>
          )}

          <div className="modal-person">
            <span
              className={`ui-avatar lg ${isOwner ? 'is-you' : ''}`}
              style={{ background: resolveAvatarColor(employee?.color, employee?.id) }}
              aria-hidden="true"
            >
              {getInitials(employee?.name)}
            </span>
            <div className="modal-person-text">
              <b>
                {employee?.name}
                {isOwner && <span className="ui-chip you">Você</span>}
              </b>
              {date && <span className="ui-caption">{formatDateBR(date).fullDisplay}</span>}
            </div>
          </div>

          <div className="form-group">
            <span className="form-label" id="edit-slot-duration">Duração</span>
            <div className="ui-choices" role="group" aria-labelledby="edit-slot-duration">
              {DURATION_PRESETS.map((mins) => {
                const isSelected = computedDuration === mins || (duration === mins && !isDurationInvalid);
                return (
                  <button
                    type="button"
                    key={mins}
                    className={isSelected ? 'is-on' : ''}
                    aria-pressed={isSelected}
                    disabled={!isAllowedToEdit}
                    onClick={() => handleSelectDuration(mins)}
                  >
                    {mins} min
                  </button>
                );
              })}
            </div>
          </div>

          <div className="time-pair">
            <label className="form-group">
              <span className="form-label">Início</span>
              <span className="time-field">
                <input
                  type="time"
                  value={startTime}
                  disabled={!isAllowedToEdit}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  required
                />
              </span>
            </label>
            <label className="form-group">
              <span className="form-label">Fim</span>
              <span className="time-field">
                <input
                  type="time"
                  value={endTime}
                  disabled={!isAllowedToEdit}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                  required
                />
              </span>
            </label>
          </div>

          {isAllowedToEdit && (
            <div className="form-group">
              <span className="form-label" id="edit-slot-fine">Ajuste fino do início</span>
              <div className="ui-choices sm" role="group" aria-labelledby="edit-slot-fine">
                {[-2, -1, 1, 2].map((delta) => (
                  <button type="button" key={delta} onClick={() => handleFineAdjust(delta)}>
                    {delta > 0 ? `+${delta} min` : `${delta} min`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className={`slot-duration-line ${isDurationInvalid ? 'is-invalid' : ''}`}>
            Duração: <strong>{computedDuration} min</strong>
          </p>

          {durationErrorMessage ? (
            <div className="ui-alert danger" role="alert">
              <AlertTriangle size={16} />
              <span>{durationErrorMessage}</span>
            </div>
          ) : conflictWarning ? (
            <div className="ui-alert danger" role="alert">
              <AlertTriangle size={16} />
              <span>{conflictWarning}</span>
            </div>
          ) : (
            <div className="ui-alert info">
              <Users size={16} />
              <span>
                {sharedShiftNames.length > 0 && (
                  <>Almoçando no mesmo horário: <b>{sharedShiftNames.join(', ')}</b>. </>
                )}
                O atendimento segue coberto pelos colegas de plantão.
              </span>
            </div>
          )}

          <div className="modal-footer">
            {slot && isAllowedToEdit ? (
              <button
                type="button"
                className="ui-btn danger-text sm"
                onClick={() => {
                  onDelete(slot.id);
                  onClose();
                }}
              >
                <Trash2 size={15} />
                Remover horário
              </button>
            ) : null}

            <div className="modal-footer-actions">
              <button type="button" className="ui-btn secondary" onClick={onClose}>
                {isAllowedToEdit ? 'Cancelar' : 'Fechar'}
              </button>
              {isAllowedToEdit && (
                <button type="submit" className="ui-btn accent" disabled={isDurationInvalid}>
                  <Check size={16} />
                  Salvar horário
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { X, Clock, AlertTriangle, Check, Trash2, Wand2, Lock } from 'lucide-react';
import { timeToMinutes, minutesToTime, addMinutesToTime, snapToInterval } from '../utils/timeUtils';
import { findNextAvailableSlot } from '../utils/scheduler';

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
  const initialDuration = slot && slot.startTime && slot.endTime
    ? Math.max(1, timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime))
    : Number(slot?.duration || settings?.defaultDuration || 30);

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
      const dur = slot && slot.startTime && slot.endTime
        ? Math.max(1, timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime))
        : Number(slot?.duration || settings?.defaultDuration || 30);
      setDuration(dur);
      const start = slot ? slot.startTime : '12:00';
      setStartTime(start);
      setEndTime(slot ? slot.endTime : addMinutesToTime(start, dur));
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
    setDuration(mins);
    if (startTime) {
      setEndTime(addMinutesToTime(startTime, mins));
    }
  };

  const handleStartTimeChange = (newStart) => {
    setStartTime(newStart);
    if (newStart && duration) {
      setEndTime(addMinutesToTime(newStart, duration));
    }
  };

  const handleEndTimeChange = (newEnd) => {
    setEndTime(newEnd);
    if (newEnd && startTime) {
      const sMin = timeToMinutes(startTime);
      const eMin = timeToMinutes(newEnd);
      if (eMin > sMin) {
        setDuration(eMin - sMin);
      }
    }
  };

  const handleAdjustStart = (deltaMinutes) => {
    const currentMin = timeToMinutes(startTime);
    const startLimit = timeToMinutes(settings?.startHour || '11:00');
    const endLimit = timeToMinutes(settings?.endHour || '14:00');
    const interval = Number(settings?.slotInterval) || 5;

    const newMin = Math.max(startLimit, Math.min(endLimit - duration, currentMin + deltaMinutes));
    const newStartStr = minutesToTime(snapToInterval(newMin, interval));
    setStartTime(newStartStr);
    setEndTime(addMinutesToTime(newStartStr, duration));
  };

  const handleSuggestSlot = () => {
    const suggestion = findNextAvailableSlot(daySlots, duration, settings, slot?.id);
    if (suggestion) {
      setStartTime(suggestion.startTime);
      setEndTime(suggestion.endTime);
    }
  };

  // Verificação de Propriedade da Escala (Regra Fundamental da Auditoria)
  const isOwner = employee?.id === currentUserEmployeeId;
  const isAllowedToEdit = isAdmin || isOwner;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isAllowedToEdit) {
      alert('Acesso negado: Você só pode modificar sua própria escala de almoço.');
      return;
    }

    const sMin = timeToMinutes(startTime);
    const eMin = timeToMinutes(endTime);
    if (eMin <= sMin) {
      alert('O horário de término deve ser posterior ao horário de início!');
      return;
    }
    const finalDuration = eMin - sMin;

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

  const currentInterval = Number(settings?.slotInterval) || 5;

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho do Modal */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Clock size={19} className="text-scada-cyan" />
            <div>
              <h3 className="modal-title">
                {isAllowedToEdit ? (slot ? 'Editar Almoço' : 'Definir Almoço') : 'Visualizar Almoço (Somente Leitura)'}
              </h3>
              <span className="modal-subtitle">
                {isAllowedToEdit 
                  ? 'Horário automático por duração ou personalizado livremente' 
                  : 'Escala pertencente a outro colaborador (bloqueada para edição)'}
              </span>
            </div>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Aviso de Somente Leitura caso não seja o proprietário nem Admin */}
        {!isAllowedToEdit && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '0.84rem',
              margin: '12px 0'
            }}
          >
            <Lock size={16} style={{ flexShrink: 0 }} />
            <span>
              <b>Modo Protegido:</b> Usuários normais só possuem permissão para alterar a própria escala.
            </span>
          </div>
        )}

        {/* Corpo do Modal */}
        <form onSubmit={handleSubmit} className="modal-form">
          {/* Card do Funcionário */}
          <div className="modal-emp-badge" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', marginBottom: '16px' }}>
            <div
              className="emp-avatar-modal"
              style={{
                backgroundColor: employee?.color || '#381267',
                width: '44px',
                height: '44px',
                minWidth: '44px',
                minHeight: '44px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: 700,
                flexShrink: 0
              }}
            >
              {employee?.avatar || employee?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <span className="modal-emp-label" style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Funcionário</span>
              <h4 className="modal-emp-name" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--scada-purple-deep)', margin: 0 }}>
                {employee?.name} {isOwner ? ' (Você)' : ''}
              </h4>
            </div>
          </div>

          {/* Duração do Almoço */}
          <div className="form-group">
            <label className="form-label">Duração do Almoço:</label>
            <div className="duration-buttons-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[20, 30, 40, 45, 60].map((mins) => (
                <button
                  type="button"
                  key={mins}
                  disabled={!isAllowedToEdit}
                  className={`btn-duration-pill ${duration === mins ? 'active' : ''}`}
                  onClick={() => handleSelectDuration(mins)}
                  style={{ opacity: isAllowedToEdit ? 1 : 0.6 }}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          {/* Horários Início e Término */}
          <div className="time-inputs-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label">Início do Almoço:</label>
              <input
                type="time"
                className="input-time"
                value={startTime}
                disabled={!isAllowedToEdit}
                step={currentInterval * 60}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Término do Almoço:</label>
              <input
                type="time"
                className="input-time"
                value={endTime}
                disabled={!isAllowedToEdit}
                step={currentInterval * 60}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Ajustes Rápidos */}
          {isAllowedToEdit && (
            <div className="quick-adjust-bar" style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-quick-adjust"
                onClick={() => handleAdjustStart(-currentInterval)}
              >
                -{currentInterval} min
              </button>
              <button
                type="button"
                className="btn-quick-adjust"
                onClick={() => handleAdjustStart(currentInterval)}
              >
                +{currentInterval} min
              </button>
              <button
                type="button"
                className="btn-quick-adjust text-cyan"
                onClick={handleSuggestSlot}
                title="Buscar próximo horário livre que cubra o atendimento"
              >
                <Wand2 size={13} />
                <span>Sugerir Horário Livre</span>
              </button>
            </div>
          )}

          {/* Mensagens de Alerta ou Sucesso */}
          {conflictWarning ? (
            <div className="conflict-warning-box" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: '#f87171' }}>
              <AlertTriangle size={16} />
              <span>{conflictWarning}</span>
            </div>
          ) : sharedShiftNames.length > 0 ? (
            <div className="shared-shift-box" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--scada-purple-subtle)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--text-main)' }}>
              <span>👥 Almoçando no mesmo turno com: <strong>{sharedShiftNames.join(', ')}</strong></span>
            </div>
          ) : (
            <div className="success-slot-box" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--working-bg)', border: '1px solid var(--working-border)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--working-text)' }}>
              <Check size={16} className="text-emerald-500" />
              <span>Horário compatível e com atendimento ao cliente 100% garantido!</span>
            </div>
          )}

          {/* Rodapé do Modal */}
          <div className="modal-footer" style={{ marginTop: '20px' }}>
            {slot && isAllowedToEdit && (
              <button
                type="button"
                className="btn-danger-outline"
                style={{ borderRadius: '9999px' }}
                onClick={() => {
                  onDelete(slot.id);
                  onClose();
                }}
              >
                <Trash2 size={14} />
                <span>Remover Horário</span>
              </button>
            )}
            <div className="modal-footer-right" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
              <button type="button" className="btn-secondary" style={{ borderRadius: '9999px' }} onClick={onClose}>
                {isAllowedToEdit ? 'Cancelar' : 'Fechar'}
              </button>
              {isAllowedToEdit && (
                <button type="submit" className="btn-primary" style={{ borderRadius: '9999px' }}>
                  Salvar Horário
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

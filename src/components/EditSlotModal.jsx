import React, { useState, useEffect } from 'react';
import { X, Clock, AlertTriangle, Check, Trash2, Wand2, Lock, Users } from 'lucide-react';
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

  const handleFineAdjust = (deltaMinutes) => {
    const currentMin = timeToMinutes(startTime);
    const startLimit = timeToMinutes(settings?.startHour || '11:00');
    const endLimit = timeToMinutes(settings?.endHour || '14:00');

    const newMin = Math.max(startLimit, Math.min(endLimit - duration, currentMin + deltaMinutes));
    const newStartStr = minutesToTime(newMin);
    setStartTime(newStartStr);
    setEndTime(addMinutesToTime(newStartStr, duration));
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

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        className="animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0d071e',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '24px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
          maxWidth: '500px',
          width: '92%',
          overflow: 'hidden',
          color: '#ffffff'
        }}
      >
        {/* Cabeçalho do Modal */}
        <div style={{ padding: '22px 24px 18px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ marginBottom: '8px' }}>
              <Clock size={20} style={{ color: '#ffffff' }} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
              {isAllowedToEdit ? (slot ? 'Editar Almoço' : 'Definir Almoço') : 'Visualizar Almoço (Somente Leitura)'}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.4 }}>
              {isAllowedToEdit 
                ? 'Horário automático por duração ou personalizado livremente (ex: 11:33 às 12:07)' 
                : 'Escala pertencente a outro colaborador (bloqueada para edição)'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              color: '#94a3b8',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
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
              borderRadius: '12px',
              color: '#f87171',
              fontSize: '0.84rem',
              margin: '0 24px 16px 24px'
            }}
          >
            <Lock size={16} style={{ flexShrink: 0 }} />
            <span>
              <b>Modo Protegido:</b> Usuários normais só possuem permissão para alterar a própria escala.
            </span>
          </div>
        )}

        {/* Corpo do Modal */}
        <form onSubmit={handleSubmit} style={{ padding: '0 24px 22px 24px' }}>
          {/* Card do Funcionário */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '12px 18px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            marginBottom: '18px'
          }}>
            <div
              style={{
                backgroundColor: employee?.color || '#381267',
                width: '46px',
                height: '46px',
                minWidth: '46px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '1.05rem',
                fontWeight: 700,
                flexShrink: 0
              }}
            >
              {employee?.avatar || employee?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em' }}>
                FUNCIONÁRIO
              </span>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#c084fc', margin: '2px 0 0 0' }}>
                {employee?.name} {isOwner ? ' (Você)' : ''}
              </h4>
            </div>
          </div>

          {/* Duração do Almoço */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
              Duração do Almoço:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[20, 30, 40, 45, 60].map((mins) => {
                const isSelected = duration === mins;
                return (
                  <button
                    type="button"
                    key={mins}
                    disabled={!isAllowedToEdit}
                    onClick={() => handleSelectDuration(mins)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: '9999px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: isAllowedToEdit ? 'pointer' : 'default',
                      border: isSelected ? '1.5px solid #8b5cf6' : '1px solid #381f5e',
                      background: isSelected ? '#7c3aed' : '#180f2d',
                      color: isSelected ? '#ffffff' : '#cbd5e1',
                      boxShadow: isSelected ? '0 0 14px rgba(124, 58, 237, 0.45)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {mins} min
                  </button>
                );
              })}
            </div>
          </div>

          {/* Início e Pílulas de Ajuste Fino */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Início:
            </label>
            <div style={{
              position: 'relative',
              background: '#0c071a',
              border: '1.5px solid #2e1065',
              borderRadius: '14px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <input
                type="time"
                value={startTime}
                disabled={!isAllowedToEdit}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                required
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  width: '100%',
                  fontFamily: 'inherit',
                  cursor: isAllowedToEdit ? 'pointer' : 'default'
                }}
              />
              <Clock size={16} style={{ color: 'rgba(255, 255, 255, 0.25)', pointerEvents: 'none', flexShrink: 0 }} />
            </div>

            {/* Pílulas de ajuste fino [-2m] [-1m] [+1m] [+2m] */}
            {isAllowedToEdit && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {[-2, -1, 1, 2].map((delta) => (
                  <button
                    type="button"
                    key={delta}
                    onClick={() => handleFineAdjust(delta)}
                    style={{
                      background: '#180f2d',
                      border: '1px solid #381f5e',
                      color: '#cbd5e1',
                      borderRadius: '9999px',
                      padding: '4px 14px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {delta > 0 ? `+${delta}m` : `${delta}m`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fim */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Fim:
            </label>
            <div style={{
              position: 'relative',
              background: '#0c071a',
              border: '1.5px solid #2e1065',
              borderRadius: '14px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <input
                type="time"
                value={endTime}
                disabled={!isAllowedToEdit}
                onChange={(e) => handleEndTimeChange(e.target.value)}
                required
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  width: '100%',
                  fontFamily: 'inherit',
                  cursor: isAllowedToEdit ? 'pointer' : 'default'
                }}
              />
              <Clock size={16} style={{ color: 'rgba(255, 255, 255, 0.25)', pointerEvents: 'none', flexShrink: 0 }} />
            </div>
          </div>

          {/* Linha da Duração */}
          <div style={{ fontSize: '0.84rem', color: '#94a3b8', marginBottom: '16px' }}>
            Duração: <strong style={{ color: '#ffffff' }}>{duration} min</strong> (Automático ou editável livremente)
          </div>

          {/* Mensagens de Alerta ou Sucesso */}
          {conflictWarning ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              padding: '12px 16px',
              borderRadius: '14px',
              fontSize: '0.82rem',
              color: '#f87171',
              marginBottom: '20px'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{conflictWarning}</span>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              padding: '12px 16px',
              borderRadius: '14px',
              fontSize: '0.82rem',
              color: '#cbd5e1',
              marginBottom: '20px'
            }}>
              <Users size={18} style={{ color: '#a855f7', marginTop: '2px', flexShrink: 0 }} />
              <div style={{ lineHeight: 1.45 }}>
                {sharedShiftNames.length > 0 ? (
                  <>
                    Almoçando no mesmo turno com: <strong style={{ color: '#ffffff' }}>{sharedShiftNames.join(', ')}</strong>.
                    <br />
                    Atendimento aos clientes garantido pelos colegas de plantão!
                  </>
                ) : (
                  <>
                    Atendimento aos clientes garantido pelos colegas de plantão!
                  </>
                )}
              </div>
            </div>
          )}

          {/* Rodapé do Modal */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            {slot && isAllowedToEdit ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(slot.id);
                  onClose();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#ffffff',
                  color: '#e11d48',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '9px 18px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Trash2 size={15} color="#e11d48" />
                <span>Remover Horário</span>
              </button>
            ) : <div />}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#1c1136',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '9999px',
                  padding: '9px 22px',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Cancelar
              </button>
              {isAllowedToEdit && (
                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #0284c7 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '9px 24px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
                    transition: 'all 0.15s ease'
                  }}
                >
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

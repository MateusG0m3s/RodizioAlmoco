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
  currentUserEmployeeId = null,
  theme
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

  const currentTheme = theme || (typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null) || 'light';
  const isDark = currentTheme === 'dark';
  const modalBg = isDark ? '#0d071e' : '#ffffff';
  const modalBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : 'var(--border-color)';
  const textTitle = isDark ? '#ffffff' : 'var(--scada-purple-deep)';
  const textSub = isDark ? '#94a3b8' : 'var(--text-muted)';
  const cardBg = isDark ? 'rgba(255, 255, 255, 0.03)' : 'var(--bg-subtle)';
  const cardBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--border-color)';
  const inputBg = isDark ? '#0c071a' : '#f8fafc';
  const inputBorder = isDark ? '#2e1065' : 'var(--border-color)';
  const inputColor = isDark ? '#ffffff' : 'var(--text-main)';
  const pillInactiveBg = isDark ? '#180f2d' : '#f1f5f9';
  const pillInactiveBorder = isDark ? '#381f5e' : 'var(--border-color)';
  const pillInactiveColor = isDark ? '#cbd5e1' : 'var(--text-main)';
  const cancelBg = isDark ? '#1c1136' : '#f1f5f9';
  const cancelBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : 'var(--border-color)';
  const cancelColor = isDark ? '#ffffff' : 'var(--text-main)';
  const footerBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'var(--border-color)';
  const deleteBtnBg = isDark ? '#ffffff' : '#fee2e2';

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        className="animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: modalBg,
          border: `1px solid ${modalBorder}`,
          borderRadius: '24px',
          boxShadow: isDark ? '0 24px 60px rgba(0, 0, 0, 0.75)' : 'var(--shadow-xl)',
          maxWidth: '500px',
          width: '92%',
          overflow: 'hidden',
          color: isDark ? '#ffffff' : 'var(--text-main)',
          transition: 'background 0.2s ease, border-color 0.2s ease'
        }}
      >
        {/* Cabeçalho do Modal */}
        <div style={{ padding: '22px 24px 18px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ marginBottom: '8px' }}>
              <Clock size={20} style={{ color: isDark ? '#ffffff' : 'var(--primary-600)' }} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: textTitle, fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>
              {isAllowedToEdit ? (slot ? 'Editar Almoço' : 'Definir Almoço') : 'Visualizar Almoço (Somente Leitura)'}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: textSub, lineHeight: 1.4 }}>
              {isAllowedToEdit 
                ? 'Horário automático por duração ou personalizado livremente (ex: 11:33 às 12:07)' 
                : 'Escala pertencente a outro colaborador (bloqueada para edição)'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              color: textSub,
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
            background: cardBg,
            border: `1px solid ${cardBorder}`,
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
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: textSub, fontWeight: 700, letterSpacing: '0.04em' }}>
                FUNCIONÁRIO
              </span>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: isDark ? '#c084fc' : 'var(--scada-purple-dark)', margin: '2px 0 0 0' }}>
                {employee?.name} {isOwner ? ' (Você)' : ''}
              </h4>
            </div>
          </div>

          {/* Duração do Almoço */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: isDark ? '#cbd5e1' : 'var(--text-main)', marginBottom: '8px' }}>
              Duração do Almoço:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {DURATION_PRESETS.map((mins) => {
                const isSelected = computedDuration === mins || (duration === mins && !isDurationInvalid);
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
                      border: isSelected ? '1.5px solid #8b5cf6' : `1px solid ${pillInactiveBorder}`,
                      background: isSelected ? '#7c3aed' : pillInactiveBg,
                      color: isSelected ? '#ffffff' : pillInactiveColor,
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
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: isDark ? '#cbd5e1' : 'var(--text-main)', marginBottom: '6px' }}>
              Início:
            </label>
            <div style={{
              position: 'relative',
              background: inputBg,
              border: `1.5px solid ${inputBorder}`,
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
                  color: inputColor,
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  width: '100%',
                  fontFamily: 'inherit',
                  cursor: isAllowedToEdit ? 'pointer' : 'default'
                }}
              />
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
                      background: pillInactiveBg,
                      border: `1px solid ${pillInactiveBorder}`,
                      color: pillInactiveColor,
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
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: isDark ? '#cbd5e1' : 'var(--text-main)', marginBottom: '6px' }}>
              Fim:
            </label>
            <div style={{
              position: 'relative',
              background: inputBg,
              border: `1.5px solid ${inputBorder}`,
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
                  color: inputColor,
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  width: '100%',
                  fontFamily: 'inherit',
                  cursor: isAllowedToEdit ? 'pointer' : 'default'
                }}
              />
            </div>
          </div>

          {/* Linha da Duração com Validação (Mínimo: 30 min | Máximo: 2 horas) */}
          <div style={{ fontSize: '0.84rem', color: isDurationInvalid ? '#f87171' : textSub, marginBottom: '16px' }}>
            Duração: <strong style={{ color: isDurationInvalid ? '#f87171' : (isDark ? '#ffffff' : 'var(--text-main)') }}>{computedDuration} min</strong>{' '}
            {isDurationInvalid ? (
              <span style={{ color: '#f87171', fontWeight: 600 }}>
                ({durationErrorMessage})
              </span>
            ) : (
              '(Automático ou editável livremente)'
            )}
          </div>

          {/* Mensagens de Alerta ou Sucesso */}
          {durationErrorMessage ? (
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
              <span>{durationErrorMessage}</span>
            </div>
          ) : conflictWarning ? (
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
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              padding: '12px 16px',
              borderRadius: '14px',
              fontSize: '0.82rem',
              color: isDark ? '#cbd5e1' : 'var(--text-main)',
              marginBottom: '20px'
            }}>
              <Users size={18} style={{ color: '#a855f7', marginTop: '2px', flexShrink: 0 }} />
              <div style={{ lineHeight: 1.45 }}>
                {sharedShiftNames.length > 0 ? (
                  <>
                    Almoçando no mesmo turno com: <strong style={{ color: isDark ? '#ffffff' : 'var(--text-main)' }}>{sharedShiftNames.join(', ')}</strong>.
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
            borderTop: `1px solid ${footerBorder}`
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
                  background: deleteBtnBg,
                  color: '#e11d48',
                  border: isDark ? 'none' : '1px solid #fecdd3',
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
                  background: cancelBg,
                  color: cancelColor,
                  border: `1px solid ${cancelBorder}`,
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
                  disabled={isDurationInvalid}
                  style={{
                    background: isDurationInvalid
                      ? (isDark ? 'rgba(124, 58, 237, 0.25)' : '#cbd5e1')
                      : 'linear-gradient(135deg, #7c3aed 0%, #0284c7 100%)',
                    color: isDurationInvalid ? (isDark ? '#64748b' : '#94a3b8') : '#ffffff',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '9px 24px',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: isDurationInvalid ? 'not-allowed' : 'pointer',
                    boxShadow: isDurationInvalid ? 'none' : '0 4px 14px rgba(124, 58, 237, 0.35)',
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

import React, { useState, useRef } from 'react';
import { Clock, Plus, Edit2, AlertCircle, Check, GripHorizontal, Headset, X, ArrowRight, Lock } from 'lucide-react';
import { timeToMinutes, minutesToTime, snapToInterval } from '../utils/timeUtils';

export default function TimelineView({
  employees,
  daySlots,
  settings,
  currentTimeMinutes,
  conflictSlotIds,
  coverage,
  onEditSlot,
  onAddSlotForEmployee,
  onUpdateSlotTimes,
  isAdmin = true,
  currentUserEmployeeId = null
}) {
  const timelineRef = useRef(null);
  const [draggingSlot, setDraggingSlot] = useState(null);
  const [dragPreviewStartMin, setDragPreviewStartMin] = useState(null);
  const [pendingMove, setPendingMove] = useState(null);
  const isDraggingRef = useRef(false);
  const dragDistanceRef = useRef(0);

  const canEditSlot = (slot) => isAdmin || (slot && slot.employeeId === currentUserEmployeeId);
  const canAddForEmp = (emp) => isAdmin || (emp && emp.id === currentUserEmployeeId);

  const startHourMin = timeToMinutes(settings?.startHour || '11:00'); // 660
  const endHourMin = timeToMinutes(settings?.endHour || '14:00');     // 840
  const totalTimelineMinutes = endHourMin - startHourMin;            // 180 min

  // Janela crítica de atendimento aos clientes (11:30 às 13:30)
  const critStartMin = timeToMinutes(settings?.criticalStart || '11:30');
  const critEndMin = timeToMinutes(settings?.criticalEnd || '13:30');
  const critLeftPercent = Math.max(0, ((critStartMin - startHourMin) / totalTimelineMinutes) * 100);
  const critWidthPercent = Math.min(100, ((critEndMin - critStartMin) / totalTimelineMinutes) * 100);

  // Marcadores de hora para a régua
  const hourMarkers = [];
  for (let m = startHourMin; m <= endHourMin; m += 30) {
    hourMarkers.push({
      minute: m,
      label: minutesToTime(m),
      percent: ((m - startHourMin) / totalTimelineMinutes) * 100
    });
  }

  // Linhas de grade de 15 em 15 minutos
  const gridLines = [];
  for (let m = startHourMin; m <= endHourMin; m += 15) {
    gridLines.push({
      minute: m,
      percent: ((m - startHourMin) / totalTimelineMinutes) * 100,
      isHour: m % 60 === 0
    });
  }

  // Posição percentual da agulha de horário atual
  const currentTimePercent = Math.max(0, Math.min(100, ((currentTimeMinutes - startHourMin) / totalTimelineMinutes) * 100));
  const isCurrentTimeInRange = currentTimeMinutes >= startHourMin && currentTimeMinutes <= endHourMin;

  // Iniciar Drag and Drop (Autorização por propriedade da escala)
  const handleDragStart = (e, slot) => {
    if (!canEditSlot(slot)) {
      return;
    }
    e.stopPropagation();
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    setDraggingSlot(slot);
    setDragPreviewStartMin(timeToMinutes(slot.startTime));
    dragDistanceRef.current = 0;
    isDraggingRef.current = false;

    const handleMove = (moveEvent) => {
      if (!timelineRef.current) return;
      const currentX = moveEvent.type.includes('touch') ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = currentX - clientX;
      dragDistanceRef.current += Math.abs(deltaX);
      if (dragDistanceRef.current > 4) {
        isDraggingRef.current = true;
      }

      const rect = timelineRef.current.getBoundingClientRect();
      const deltaMinutes = (deltaX / rect.width) * totalTimelineMinutes;

      const rawNewStart = timeToMinutes(slot.startTime) + deltaMinutes;
      const duration = slot.duration || (timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime));
      const interval = Number(settings?.slotInterval) || 5;
      const snappedStart = Math.max(startHourMin, Math.min(endHourMin - duration, snapToInterval(rawNewStart, interval)));

      setDragPreviewStartMin(snappedStart);
    };

    const handleEnd = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);

      if (isDraggingRef.current) {
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 200);
      }

      setDragPreviewStartMin((finalStartMin) => {
        if (finalStartMin !== null && finalStartMin !== timeToMinutes(slot.startTime)) {
          const duration = slot.duration || (timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime));
          const newStartTime = minutesToTime(finalStartMin);
          const newEndTime = minutesToTime(finalStartMin + duration);
          const emp = employees.find((e) => e.id === slot.employeeId);

          setPendingMove({
            slotId: slot.id,
            slot,
            employee: emp || { name: 'Colaborador', color: '#7c3aed' },
            originalStartTime: slot.startTime,
            originalEndTime: slot.endTime,
            newStartTime,
            newEndTime,
            duration,
            newStartMin: finalStartMin
          });
        }
        return null;
      });

      setDraggingSlot(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
  };

  return (
    <div className="timeline-card animate-fade-in">
      {/* Barra Superior da Timeline com Legenda e Janela Crítica */}
      <div className="timeline-header-bar">
        <div className="timeline-title-wrap">
          <Headset size={18} color="var(--scada-purple-light)" />
          <h3 className="timeline-title">Timeline de Atendimento &amp; Rodízio</h3>
          <span className="timeline-caption">
            Janela Crítica: {settings?.criticalStart || '11:30'}h às {settings?.criticalEnd || '13:30'}h • Mínimo de 1 atendente sempre trabalhando
          </span>
        </div>
        <div className="timeline-legend">
          <div className="legend-item">
            <span className="legend-dot dot-critical-zone"></span>
            <span>Janela Crítica de Atendimento</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot dot-work"></span>
            <span>Trabalhando</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot dot-lunch"></span>
            <span>Almoço</span>
          </div>
        </div>
      </div>

      {/* Contêiner com Scroll da Linha do Tempo */}
      <div className="timeline-scroll-container">
        <div className="timeline-inner" ref={timelineRef}>
          {/* Régua de Horários Superior */}
          <div className="timeline-time-ruler">
            <div className="employee-column-header">
              <span>EQUIPE SCADA</span>
            </div>
            <div className="ruler-track">
              {/* Faixa destacada da Janela Crítica */}
              <div
                className="critical-zone-indicator"
                style={{
                  left: `${critLeftPercent}%`,
                  width: `${critWidthPercent}%`
                }}
              />

              {/* Marcadores de Horas */}
              {hourMarkers.map((marker) => (
                <div
                  key={marker.minute}
                  className="ruler-mark"
                  style={{ left: `${marker.percent}%` }}
                >
                  <span className="ruler-label">{marker.label}</span>
                  <div className="ruler-tick" />
                </div>
              ))}
            </div>
          </div>

          {/* Área Principal de Linhas */}
          <div className="timeline-rows-container">
            {/* Grade de Fundo Vertical */}
            <div className="timeline-grid-overlay">
              {gridLines.map((line) => (
                <div
                  key={line.minute}
                  className={`grid-line ${line.isHour ? 'grid-hour' : ''}`}
                  style={{ left: `${line.percent}%` }}
                />
              ))}

              {/* Destaque Vertical da Janela Crítica */}
              <div
                className="critical-zone-background"
                style={{
                  left: `${critLeftPercent}%`,
                  width: `${critWidthPercent}%`
                }}
              />

              {/* Agulha de Horário Atual */}
              {isCurrentTimeInRange && (
                <div
                  className="current-time-marker"
                  style={{ left: `${currentTimePercent}%` }}
                >
                  <div className="time-marker-badge">
                    Agora ({minutesToTime(currentTimeMinutes)})
                  </div>
                  <div className="time-marker-line" />
                </div>
              )}
            </div>

            {/* Linhas dos Colaboradores */}
            {employees.map((emp) => {
              const slot = daySlots.find((s) => s.employeeId === emp.id);
              const isSlotInConflict = slot && conflictSlotIds.includes(slot.id);
              const isBeingDragged = draggingSlot && draggingSlot.id === slot?.id;
              const isPendingThisSlot = pendingMove && pendingMove.slotId === slot?.id;
              const isEditable = canEditSlot(slot);
              const canAdd = canAddForEmp(emp);

              let blockStartMin = slot ? timeToMinutes(slot.startTime) : 0;
              let blockEndMin = slot ? timeToMinutes(slot.endTime) : 0;
              let duration = slot ? blockEndMin - blockStartMin : 30;

              if (isBeingDragged && dragPreviewStartMin !== null) {
                blockStartMin = dragPreviewStartMin;
                blockEndMin = blockStartMin + duration;
              } else if (isPendingThisSlot) {
                blockStartMin = pendingMove.newStartMin;
                duration = pendingMove.duration;
                blockEndMin = blockStartMin + duration;
              }

              const leftPercent = slot
                ? Math.max(0, ((blockStartMin - startHourMin) / totalTimelineMinutes) * 100)
                : 0;
              const widthPercent = slot
                ? Math.max(3, (duration / totalTimelineMinutes) * 100)
                : 0;

              const isCurrentlyLunching = slot && currentTimeMinutes >= blockStartMin && currentTimeMinutes < blockEndMin;
              const hasFinishedLunch = slot && currentTimeMinutes >= blockEndMin;

              return (
                <div
                  key={emp.id}
                  className={`timeline-employee-row ${!emp.active ? 'is-inactive-row' : ''}`}
                >
                  {/* Informações do Colaborador (Coluna Fixa) */}
                  <div className="employee-info-cell">
                    <div
                      className="emp-avatar"
                      style={{ backgroundColor: emp.color || '#381267' }}
                    >
                      {emp.avatar || emp.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="emp-text-details">
                      <div className="emp-name-row">
                        <span className="emp-name" title={emp.name}>
                          {emp.name} {emp.id === currentUserEmployeeId ? ' (Você)' : ''}
                        </span>
                        {!emp.active && <span className="inactive-pill">Inativo</span>}
                      </div>
                      <span className="emp-role">
                        {isCurrentlyLunching ? (
                          <span className="text-purple-scada font-semibold">Almoçando agora</span>
                        ) : hasFinishedLunch ? (
                          <span className="text-emerald-600">Almoço concluído</span>
                        ) : isPendingThisSlot ? (
                          <span className="text-amber-600 font-semibold">Alteração pendente ({pendingMove.newStartTime})</span>
                        ) : slot ? (
                          <span>Almoço às {slot.startTime}</span>
                        ) : (
                          <span className="text-slate-400">Sem horário hoje</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Faixa da Linha do Tempo */}
                  <div className="employee-timeline-track">
                    <div className="working-background-bar" />

                    {/* Bloco de Almoço */}
                    {slot ? (
                      <div
                        className={`lunch-slot-block ${isSlotInConflict ? 'is-conflict' : ''} ${isCurrentlyLunching ? 'is-active-pulse' : ''} ${isBeingDragged ? 'is-dragging' : ''} ${isPendingThisSlot ? 'is-pending-confirm' : ''}`}
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          '--emp-accent': emp.color || '#381267',
                          cursor: isEditable ? 'pointer' : 'default'
                        }}
                        onClick={(e) => {
                          if (isDraggingRef.current) {
                            e.stopPropagation();
                            return;
                          }
                          onEditSlot(slot, emp);
                        }}
                        title={
                          !isEditable
                            ? `Escala de ${emp.name} (Somente leitura)`
                            : isPendingThisSlot
                            ? "Aguardando confirmação na barra inferior"
                            : "Clique para editar ou arraste para reposicionar (passos de 5 min)"
                        }
                      >
                        {isEditable ? (
                          <div
                            className="drag-handle"
                            onMouseDown={(e) => handleDragStart(e, slot)}
                            onTouchStart={(e) => handleDragStart(e, slot)}
                            title="Segure e arraste para alterar seu horário"
                          >
                            <GripHorizontal size={14} />
                          </div>
                        ) : (
                          <div style={{ padding: '0 6px', opacity: 0.6 }} title="Escala pertencente a outro colaborador">
                            <Lock size={12} />
                          </div>
                        )}

                        <div className="slot-block-content">
                          <span className="slot-badge-label">
                            {isPendingThisSlot ? 'NOVO HORÁRIO' : 'ALMOÇO'}
                          </span>
                          <span className="slot-time-range">
                            {isBeingDragged
                              ? `${minutesToTime(blockStartMin)} - ${minutesToTime(blockEndMin)}`
                              : isPendingThisSlot
                              ? `${pendingMove.newStartTime} - ${pendingMove.newEndTime}`
                              : `${slot.startTime} - ${slot.endTime}`}
                          </span>
                        </div>

                        {isSlotInConflict && (
                          <div className="conflict-badge-icon" title="Atenção: Horário de atendimento ficou desguarnecido!">
                            <AlertCircle size={15} />
                          </div>
                        )}

                        {isEditable && (
                          <button
                            type="button"
                            className="btn-quick-edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSlot(slot, emp);
                            }}
                            title="Editar horário"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="empty-slot-area" style={{ position: 'relative', zIndex: 10, paddingLeft: '16px' }}>
                        {canAdd && (
                          <button
                            type="button"
                            className="btn-add-slot-row"
                            style={{
                              borderRadius: '9999px',
                              background: 'var(--bg-card)',
                              border: '1.5px dashed var(--scada-cyan)',
                              color: 'var(--scada-cyan)',
                              padding: '6px 16px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              boxShadow: 'var(--shadow-xs)'
                            }}
                            onClick={() => onAddSlotForEmployee(emp)}
                            title="Definir horário de almoço para este colaborador"
                          >
                            <Plus size={13} />
                            <span>Definir almoço</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Caixa de Confirmação Flutuante para Reposicionamento de Horário */}
      {pendingMove && (
        <div className="timeline-confirm-banner animate-slide-up">
          <div className="confirm-banner-body">
            <div className="confirm-badge-bell">
              <Clock size={20} className="pulse-cyan" />
            </div>
            <div className="confirm-text-group">
              <div className="confirm-title">
                Confirmar alteração de horário de almoço?
              </div>
              <div className="confirm-subtitle">
                <strong>{pendingMove.employee.name}</strong>:{' '}
                <span className="time-badge old-time">{pendingMove.originalStartTime} — {pendingMove.originalEndTime}</span>
                <ArrowRight size={14} style={{ display: 'inline', margin: '0 6px', verticalAlign: 'middle' }} />
                <span className="time-badge new-time">{pendingMove.newStartTime} — {pendingMove.newEndTime}</span>
              </div>
            </div>
          </div>

          <div className="confirm-actions-group">
            <button
              type="button"
              className="btn-timeline-cancel"
              onClick={() => setPendingMove(null)}
              title="Cancelar e restaurar o horário anterior"
            >
              <X size={15} />
              <span>Cancelar</span>
            </button>
            <button
              type="button"
              className="btn-timeline-confirm"
              onClick={() => {
                onUpdateSlotTimes(pendingMove.slotId, pendingMove.newStartTime, pendingMove.newEndTime);
                setPendingMove(null);
              }}
              title="Confirmar e salvar o novo horário na escala"
            >
              <Check size={16} />
              <span>Salvar Alterações</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

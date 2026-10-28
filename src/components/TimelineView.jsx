import React, { useState, useRef } from 'react';
import { Plus, CircleAlert, Check, GripVertical, ChartGantt, X, ArrowRight, Utensils, Clock } from 'lucide-react';
import { getInitials, getShortName } from '../utils/nameUtils';
import { timeToMinutes, minutesToTime, snapToInterval } from '../utils/timeUtils';
import { resolveAvatarColor } from '../utils/avatarColors';

// Largura da coluna de pessoas; a faixa de horários ocupa o resto
const PEOPLE_COLUMN = '208px';

export default function TimelineView({
  employees,
  daySlots,
  settings,
  currentTimeMinutes,
  conflictSlotIds,
  onEditSlot,
  onAddSlotForEmployee,
  onUpdateSlotTimes,
  isAdmin = true,
  currentUserEmployeeId = null,
  isToday = true,
  headerActions = null
}) {
  const rulerTrackRef = useRef(null);
  const [draggingSlot, setDraggingSlot] = useState(null);
  const [dragPreviewStartMin, setDragPreviewStartMin] = useState(null);
  const [pendingMove, setPendingMove] = useState(null);
  const isDraggingRef = useRef(false);
  const dragDistanceRef = useRef(0);

  const canEditSlot = (slot) => isAdmin || (slot && slot.employeeId === currentUserEmployeeId);
  const canAddForEmp = (emp) => isAdmin || (emp && emp.id === currentUserEmployeeId);

  const startHourMin = timeToMinutes(settings?.startHour || '11:00');
  const endHourMin = timeToMinutes(settings?.endHour || '14:00');
  const totalTimelineMinutes = endHourMin - startHourMin;
  const toPercent = (minute) => ((minute - startHourMin) / totalTimelineMinutes) * 100;

  // Janela crítica de atendimento aos clientes
  const critStartMin = timeToMinutes(settings?.criticalStart || '11:30');
  const critEndMin = timeToMinutes(settings?.criticalEnd || '13:30');
  const critLeftPercent = Math.max(0, toPercent(critStartMin));
  const critWidthPercent = Math.min(100 - critLeftPercent, ((critEndMin - critStartMin) / totalTimelineMinutes) * 100);
  const minWorking = Number(settings?.minWorkingDuringCritical) || 1;

  const hourMarkers = [];
  for (let m = startHourMin; m <= endHourMin; m += 30) {
    hourMarkers.push({ minute: m, label: minutesToTime(m), percent: toPercent(m) });
  }

  const currentTimePercent = Math.max(0, Math.min(100, toPercent(currentTimeMinutes)));
  const isCurrentTimeInRange = currentTimeMinutes >= startHourMin && currentTimeMinutes <= endHourMin;
  // O rótulo da janela fica no fim da faixa; se o "Agora" estiver perto do fim, vai para o início
  const bandLabelAtStart = isCurrentTimeInRange && currentTimePercent > critLeftPercent + critWidthPercent * 0.55;

  // Arrastar para reposicionar (só quem pode editar a própria escala, ou admin)
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
      if (!rulerTrackRef.current) return;
      const currentX = moveEvent.type.includes('touch') ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = currentX - clientX;
      dragDistanceRef.current += Math.abs(deltaX);
      if (dragDistanceRef.current > 4) {
        isDraggingRef.current = true;
      }

      // Largura só da faixa de horários (sem a coluna de nomes) para o arraste seguir o cursor
      const rect = rulerTrackRef.current.getBoundingClientRect();
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
            employee: emp || { name: 'Colaborador' },
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
    <section className="ui-card tl-card animate-fade-in" aria-label="Timeline do dia">
      <div className="ui-card-head tl-head">
        <div className="ui-card-title">
          <span className="ui-icon-circle" aria-hidden="true"><ChartGantt size={16} /></span>
          <div>
            {isToday ? 'Timeline de hoje' : 'Timeline do dia'}
            <small>
              Janela crítica {settings?.criticalStart || '11:30'}–{settings?.criticalEnd || '13:30'} · mínimo {minWorking} no posto
            </small>
          </div>
        </div>
        <div className="tl-head-side">
          <div className="tl-legend" aria-hidden="true">
            <span className="ui-chip">Concluído</span>
            <span className="ui-chip now">Almoçando</span>
            <span className="ui-chip next">A seguir</span>
          </div>
          {headerActions}
        </div>
      </div>

      <div className="tl-scroll">
        <div className="tl-grid" style={{ '--tl-people': PEOPLE_COLUMN }}>
          {/* Sobreposição da faixa de horários: grade, janela crítica e agulha do "Agora" */}
          <div className="tl-overlay" aria-hidden="true">
            {hourMarkers.filter((m) => m.minute % 60 === 0).map((m) => (
              <span key={m.minute} className="tl-gridline" style={{ left: `${m.percent}%` }} />
            ))}
            <div className="tl-band" style={{ left: `${critLeftPercent}%`, width: `${critWidthPercent}%` }}>
              <span className={`tl-band-label ${bandLabelAtStart ? 'at-start' : ''}`}>Janela crítica</span>
            </div>
            {isCurrentTimeInRange && (
              <div className="tl-now" style={{ left: `${currentTimePercent}%` }}>
                <span>Agora {minutesToTime(currentTimeMinutes)}</span>
              </div>
            )}
          </div>

          {/* Régua de horários */}
          <div className="tl-axis">
            <div className="tl-axis-people">Equipe</div>
            <div className="tl-axis-track" ref={rulerTrackRef}>
              {hourMarkers.map((marker, idx) => (
                <span
                  key={marker.minute}
                  className={`tl-axis-label ${idx === 0 ? 'is-first' : ''} ${idx === hourMarkers.length - 1 ? 'is-last' : ''}`}
                  style={{ left: `${marker.percent}%` }}
                >
                  {marker.label}
                </span>
              ))}
            </div>
          </div>

          {/* Uma linha por colaborador */}
          {employees.map((emp) => {
            const slot = daySlots.find((s) => s.employeeId === emp.id);
            const isYou = emp.id === currentUserEmployeeId;
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

            const leftPercent = slot ? Math.max(0, toPercent(blockStartMin)) : 0;
            const widthPercent = slot ? Math.max(3, (duration / totalTimelineMinutes) * 100) : 0;

            const isCurrentlyLunching = slot && currentTimeMinutes >= blockStartMin && currentTimeMinutes < blockEndMin;
            const hasFinishedLunch = slot && currentTimeMinutes >= blockEndMin;
            const phase = isCurrentlyLunching ? 'is-now' : hasFinishedLunch ? 'is-done' : 'is-next';
            // Blocos curtos (<= 20 min) mostram só o início para o horário não ser cortado
            const isNarrow = duration <= 20;

            const rangeLabel = isBeingDragged || isPendingThisSlot
              ? `${minutesToTime(blockStartMin)}–${minutesToTime(blockEndMin)}`
              : slot
              ? `${slot.startTime}–${slot.endTime}`
              : '';

            return (
              <div
                key={emp.id}
                className={`tl-row ${isYou ? 'is-you' : ''} ${!emp.active ? 'is-inactive' : ''}`}
              >
                <div className="tl-who">
                  <span
                    className={`ui-avatar ${isYou ? 'is-you' : ''}`}
                    style={{ background: resolveAvatarColor(emp.color, emp.id) }}
                    title={isYou ? `${emp.name} (você)` : emp.name}
                    aria-hidden="true"
                  >
                    {getInitials(emp.name)}
                  </span>
                  <div className="tl-who-text">
                    <b title={emp.name}>
                      {getShortName(emp.name)}
                      {isYou && <span className="tl-you-tag">você</span>}
                      {!emp.active && <span className="tl-inactive-tag">inativo</span>}
                    </b>
                    <span className={isCurrentlyLunching ? 'is-now' : isPendingThisSlot ? 'is-pending' : ''}>
                      {isPendingThisSlot
                        ? `Alteração pendente (${pendingMove.newStartTime})`
                        : isCurrentlyLunching
                        ? `Almoçando · volta ${minutesToTime(blockEndMin)}`
                        : hasFinishedLunch
                        ? `Concluído às ${slot.endTime}`
                        : slot
                        ? `Às ${slot.startTime}`
                        : 'Sem horário'}
                    </span>
                  </div>
                </div>

                <div className="tl-track">
                  {slot ? (
                    <div
                      className={`tl-block ${phase} ${isYou ? 'is-you' : ''} ${isSlotInConflict ? 'is-conflict' : ''} ${isBeingDragged ? 'is-dragging' : ''} ${isPendingThisSlot ? 'is-pending' : ''} ${isEditable ? 'is-editable' : ''} ${isNarrow ? 'is-narrow' : ''}`}
                      style={{ left: `${leftPercent}%`, width: `calc(${widthPercent}% - 4px)` }}
                      role={isEditable ? 'button' : undefined}
                      tabIndex={isEditable ? 0 : undefined}
                      onClick={(e) => {
                        if (isDraggingRef.current) {
                          e.stopPropagation();
                          return;
                        }
                        onEditSlot(slot, emp);
                      }}
                      onKeyDown={(e) => {
                        if (isEditable && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          onEditSlot(slot, emp);
                        }
                      }}
                      title={
                        !isEditable
                          ? `Escala de ${emp.name} (somente leitura)`
                          : isPendingThisSlot
                          ? 'Aguardando confirmação na barra inferior'
                          : 'Clique para editar ou arraste pela alça para mudar o horário (passos de 5 min)'
                      }
                      aria-label={`${emp.name}: almoço ${rangeLabel}`}
                    >
                      {isEditable && (
                        <span
                          className="tl-grip"
                          onMouseDown={(e) => handleDragStart(e, slot)}
                          onTouchStart={(e) => handleDragStart(e, slot)}
                          title="Segure e arraste para alterar o horário"
                        >
                          <GripVertical size={14} />
                        </span>
                      )}
                      {isSlotInConflict ? (
                        <CircleAlert size={14} className="tl-block-icon" />
                      ) : hasFinishedLunch && !isPendingThisSlot ? (
                        <Check size={14} className="tl-block-icon" />
                      ) : isCurrentlyLunching ? (
                        <Utensils size={14} className="tl-block-icon" />
                      ) : null}
                      <span className="tl-block-label">
                        {isNarrow ? minutesToTime(blockStartMin) : rangeLabel}
                        {isPendingThisSlot && <em> · novo</em>}
                      </span>
                    </div>
                  ) : (
                    canAdd && (
                      <button
                        type="button"
                        className="tl-add"
                        onClick={() => onAddSlotForEmployee(emp)}
                        title="Definir horário de almoço para este colaborador"
                        aria-label={`Definir almoço de ${emp.name}`}
                      >
                        <Plus size={14} />
                        Definir almoço
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmação do reposicionamento por arraste */}
      {pendingMove && (
        <div className="tl-confirm animate-slide-up" role="dialog" aria-label="Confirmar novo horário">
          <span className="ui-icon-circle tl-confirm-icon" aria-hidden="true"><Clock size={18} /></span>
          <div className="tl-confirm-text">
            <b>Confirmar novo horário de {getShortName(pendingMove.employee.name)}?</b>
            <span>
              <span className="ui-chip plain">{pendingMove.originalStartTime}–{pendingMove.originalEndTime}</span>
              <ArrowRight size={14} aria-hidden="true" />
              <span className="ui-chip plain now">{pendingMove.newStartTime}–{pendingMove.newEndTime}</span>
            </span>
          </div>
          <div className="tl-confirm-actions">
            <button type="button" className="ui-btn secondary sm" onClick={() => setPendingMove(null)} title="Cancelar e restaurar o horário anterior">
              <X size={15} />
              Cancelar
            </button>
            <button
              type="button"
              className="ui-btn accent sm"
              onClick={() => {
                onUpdateSlotTimes(pendingMove.slotId, pendingMove.newStartTime, pendingMove.newEndTime);
                setPendingMove(null);
              }}
              title="Salvar o novo horário na escala"
            >
              <Check size={15} />
              Salvar horário
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

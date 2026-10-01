import React, { useState, useRef } from 'react';
import { Clock, Plus, Edit2, AlertCircle, Check, Briefcase, GripHorizontal, ShieldAlert, Headset } from 'lucide-react';
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
  onUpdateSlotTimes
}) {
  const timelineRef = useRef(null);
  const [draggingSlot, setDraggingSlot] = useState(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragOriginalStartMin, setDragOriginalStartMin] = useState(0);
  const [dragPreviewStartMin, setDragPreviewStartMin] = useState(null);

  const startHourMin = timeToMinutes(settings.startHour || '11:00'); // 660
  const endHourMin = timeToMinutes(settings.endHour || '14:00');     // 840
  const totalTimelineMinutes = endHourMin - startHourMin;            // 180 min

  // Janela crítica de atendimento aos clientes (11:30 às 13:30)
  const critStartMin = timeToMinutes(settings.criticalStart || '11:30');
  const critEndMin = timeToMinutes(settings.criticalEnd || '13:30');
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

  // Iniciar Drag and Drop
  const handleDragStart = (e, slot) => {
    e.stopPropagation();
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    setDraggingSlot(slot);
    setDragStartX(clientX);
    setDragOriginalStartMin(timeToMinutes(slot.startTime));
    setDragPreviewStartMin(timeToMinutes(slot.startTime));

    const handleMove = (moveEvent) => {
      if (!timelineRef.current) return;
      const currentX = moveEvent.type.includes('touch') ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const rect = timelineRef.current.getBoundingClientRect();
      const deltaX = currentX - clientX;
      const deltaMinutes = (deltaX / rect.width) * totalTimelineMinutes;

      const rawNewStart = timeToMinutes(slot.startTime) + deltaMinutes;
      const duration = slot.duration || (timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime));
      const snappedStart = Math.max(startHourMin, Math.min(endHourMin - duration, snapToInterval(rawNewStart, 5)));

      setDragPreviewStartMin(snappedStart);
    };

    const handleEnd = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);

      setDragPreviewStartMin((finalStartMin) => {
        if (finalStartMin !== null && finalStartMin !== timeToMinutes(slot.startTime)) {
          const duration = slot.duration || (timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime));
          const newStartTime = minutesToTime(finalStartMin);
          const newEndTime = minutesToTime(finalStartMin + duration);
          onUpdateSlotTimes(slot.id, newStartTime, newEndTime);
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
    <div className="timeline-card">
      <div className="timeline-header-bar">
        <div className="timeline-title-wrap">
          <Headset size={18} className="text-scada-cyan" />
          <h3 className="timeline-title">Timeline de Atendimento & Rodízio</h3>
          <span className="timeline-caption">
            Janela Crítica: 11:30h às 13:30h • Mínimo de 1 atendente sempre trabalhando
          </span>
        </div>
        <div className="timeline-legend">
          <span className="legend-item"><span className="legend-dot dot-critical-zone" /> Janela Crítica de Atendimento</span>
          <span className="legend-item"><span className="legend-dot dot-work" /> Trabalhando</span>
          <span className="legend-item"><span className="legend-dot dot-lunch" /> Almoço</span>
        </div>
      </div>

      <div className="timeline-scroll-container">
        <div className="timeline-inner" ref={timelineRef}>
          {/* Régua de Horários no Topo */}
          <div className="timeline-time-ruler">
            <div className="employee-column-header">
              <span>Equipe SCADA</span>
            </div>
            <div className="ruler-track">
              {/* Destaque sombreado da Zona Crítica de Atendimento aos Clientes (11:30 — 13:30) */}
              <div
                className="critical-zone-indicator"
                style={{ left: `${critLeftPercent}%`, width: `${critWidthPercent}%` }}
                title="Janela Crítica de Atendimento aos Clientes (11:30 às 13:30)"
              />

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

          {/* Linhas de cada Funcionário */}
          <div className="timeline-rows-container">
            {/* Grade de fundo e zona crítica */}
            <div className="timeline-grid-overlay">
              {/* Sombreamento suave na zona crítica de atendimento */}
              <div
                className="critical-zone-background"
                style={{ left: `${critLeftPercent}%`, width: `${critWidthPercent}%` }}
              />

              {gridLines.map((grid) => (
                <div
                  key={grid.minute}
                  className={`grid-line ${grid.isHour ? 'grid-hour' : ''}`}
                  style={{ left: `${grid.percent}%` }}
                />
              ))}

              {/* Indicador do Horário Atual (Linha Vermelha Viva) */}
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

              let blockStartMin = slot ? timeToMinutes(slot.startTime) : 0;
              let blockEndMin = slot ? timeToMinutes(slot.endTime) : 0;
              const duration = slot ? blockEndMin - blockStartMin : 30;

              if (isBeingDragged && dragPreviewStartMin !== null) {
                blockStartMin = dragPreviewStartMin;
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
                        <span className="emp-name" title={emp.name}>{emp.name}</span>
                        {!emp.active && <span className="inactive-pill">Inativo</span>}
                      </div>
                      <span className="emp-role">
                        {isCurrentlyLunching ? (
                          <span className="text-purple-scada font-semibold">Almoçando agora</span>
                        ) : hasFinishedLunch ? (
                          <span className="text-emerald-600">Almoço concluído</span>
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
                    {/* Barra de Fundo: Trabalhando / Atendendo Clientes (Pura sem texto sobreposto) */}
                    <div className="working-background-bar" />

                    {/* Bloco de Almoço */}
                    {slot ? (
                      <div
                        className={`lunch-slot-block ${isSlotInConflict ? 'is-conflict' : ''} ${isCurrentlyLunching ? 'is-active-pulse' : ''} ${isBeingDragged ? 'is-dragging' : ''}`}
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                          '--emp-accent': emp.color || '#381267'
                        }}
                        onClick={() => onEditSlot(slot, emp)}
                        title="Clique para editar ou arraste para reposicionar (passos de 5 min)"
                      >
                        <div
                          className="drag-handle"
                          onMouseDown={(e) => handleDragStart(e, slot)}
                          onTouchStart={(e) => handleDragStart(e, slot)}
                          title="Segure e arraste para alterar o horário"
                        >
                          <GripHorizontal size={14} />
                        </div>

                        <div className="slot-block-content">
                          <span className="slot-badge-label">ALMOÇO</span>
                          <span className="slot-time-range">
                            {isBeingDragged
                              ? `${minutesToTime(blockStartMin)} - ${minutesToTime(blockEndMin)}`
                              : `${slot.startTime} - ${slot.endTime}`}
                          </span>
                        </div>

                        {isSlotInConflict && (
                          <div className="conflict-badge-icon" title="Atenção: Horário de atendimento ficou desguarnecido!">
                            <AlertCircle size={15} />
                          </div>
                        )}

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
                      </div>
                    ) : (
                      <div className="empty-slot-area" style={{ position: 'relative', zIndex: 10, paddingLeft: '16px' }}>
                        <button
                          type="button"
                          className="btn-add-slot-row"
                          style={{
                            borderRadius: '9999px',
                            background: '#ffffff',
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
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

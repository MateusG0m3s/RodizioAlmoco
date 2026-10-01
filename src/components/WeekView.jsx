import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, Sparkles, Clock, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { getWorkDaysOfWeek, formatDateBR, toISODateString, parseISODate } from '../utils/timeUtils';

export default function WeekView({
  currentDate,
  setCurrentDate,
  employees,
  allSchedules,
  onOpenGenerateModal,
  onQuickGenerateWeek,
  onOpenEditModal,
  setActiveTab
}) {
  const baseDate = parseISODate(currentDate);
  const workdays = getWorkDaysOfWeek(baseDate);

  const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));

  // Navegar semana
  const handlePrevWeek = () => {
    const prev = new Date(baseDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentDate(toISODateString(prev));
  };

  const handleNextWeek = () => {
    const next = new Date(baseDate);
    next.setDate(next.getDate() + 7);
    setCurrentDate(toISODateString(next));
  };

  const handleToday = () => {
    setCurrentDate(toISODateString(new Date()));
  };

  // Helper para verificar status do dia
  const getDayStatus = (dateStr) => {
    const slots = allSchedules[dateStr] || [];
    const activeCount = employees.filter((e) => e.active).length;
    if (slots.length === 0) return { icon: '⚪', label: 'Vazio', class: 'day-empty' };
    if (slots.length >= activeCount) return { icon: '🟢', label: 'Completo', class: 'day-complete' };
    return { icon: '🟡', label: 'Parcial', class: 'day-partial' };
  };

  return (
    <div className="week-view-container animate-fade-in">
      {/* Barra de Navegação Semanal */}
      <div className="week-header-bar">
        <div className="week-title-group">
          <Calendar size={22} className="text-scada-cyan header-calendar-icon" />
          <div>
            <h2 className="week-main-title">Visão Semanal do Rodízio</h2>
            <p className="week-sub-title">Planejamento e acompanhamento dos 5 dias úteis</p>
          </div>
        </div>

        <div className="week-nav-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-week-nav"
            style={{ borderRadius: '9999px' }}
            onClick={handlePrevWeek}
            title="Semana anterior"
          >
            <ChevronLeft size={16} />
            <span>Semana Anterior</span>
          </button>
          <button
            type="button"
            className="btn-week-today"
            style={{ borderRadius: '9999px' }}
            onClick={handleToday}
          >
            Hoje
          </button>
          <button
            type="button"
            className="btn-week-nav"
            style={{ borderRadius: '9999px' }}
            onClick={handleNextWeek}
            title="Próxima semana"
          >
            <span>Próxima Semana</span>
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ borderRadius: '9999px' }}
            onClick={onQuickGenerateWeek || onOpenGenerateModal}
            title="Gera automaticamente a escala da semana inteira alternando turnos"
          >
            <Sparkles size={16} />
            <span>Gerar Escala da Semana</span>
          </button>
          {onOpenGenerateModal && (
            <button
              type="button"
              className="btn-secondary"
              style={{ borderRadius: '9999px' }}
              onClick={onOpenGenerateModal}
              title="Opções do gerador"
            >
              <span className="text-xs">Opções</span>
            </button>
          )}
        </div>
      </div>

      {/* Cartões dos Dias da Semana (SEG - SEX) */}
      <div className="weekdays-nav-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        {workdays.map((day) => {
          const isSelected = day.date === currentDate;
          const status = getDayStatus(day.date);
          const slotsCount = (allSchedules[day.date] || []).length;

          return (
            <div
              key={day.date}
              className={`weekday-card ${isSelected ? 'selected' : ''} ${day.isToday ? 'is-today' : ''}`}
              onClick={() => {
                setCurrentDate(day.date);
                setActiveTab('dashboard');
              }}
              role="button"
            >
              <div className="weekday-card-header">
                <span className="weekday-short-name">{day.shortName}</span>
                <span className="weekday-status-dot" title={status.label}>
                  {status.icon}
                </span>
              </div>
              <div className="weekday-number">{day.dayNumber}</div>
              <div className="weekday-footer">
                <span className="weekday-slots-count">{slotsCount} pessoas</span>
                {day.isToday && <span className="today-badge">Hoje</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grade da Semana: Funcionário x Dia */}
      <div className="week-matrix-card">
        <div className="matrix-card-header">
          <h3 className="matrix-title">Grade Completa da Semana</h3>
          <span className="text-xs text-slate-500">
            Clique em qualquer horário para editar ou no cabeçalho do dia para abrir o dashboard
          </span>
        </div>

        <div className="week-matrix-table-wrap">
          <table className="week-matrix-table">
            <thead>
              <tr>
                <th className="th-employee">Funcionário</th>
                {workdays.map((day) => (
                  <th
                    key={day.date}
                    className={`th-day ${day.date === currentDate ? 'current-selected-col' : ''}`}
                    onClick={() => {
                      setCurrentDate(day.date);
                      setActiveTab('dashboard');
                    }}
                  >
                    <div className="th-day-content">
                      <span className="th-day-name">{day.name}</span>
                      <span className="th-day-date">{day.dayNumber}/{String(day.dateObj.getMonth() + 1).padStart(2, '0')}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className={!emp.active ? 'tr-inactive' : ''}>
                  <td className="td-employee">
                    <div className="matrix-emp-info">
                      <div
                        className="matrix-avatar"
                        style={{
                          backgroundColor: emp.color || '#381267',
                          width: '32px',
                          height: '32px',
                          minWidth: '32px',
                          minHeight: '32px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          flexShrink: 0
                        }}
                      >
                        {emp.avatar || emp.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="matrix-emp-text">
                        <span className="matrix-emp-name">{emp.name}</span>
                        {!emp.active && <span className="matrix-inactive-tag">Inativo</span>}
                      </div>
                    </div>
                  </td>

                  {workdays.map((day) => {
                    const daySlots = allSchedules[day.date] || [];
                    const slot = daySlots.find((s) => s.employeeId === emp.id);

                    return (
                      <td
                        key={day.date}
                        className={`td-slot-cell ${day.date === currentDate ? 'current-selected-col' : ''}`}
                      >
                        {slot ? (
                          <div
                            className="week-slot-pill"
                            style={{ borderLeftColor: emp.color || '#3b82f6' }}
                            onClick={() => onOpenEditModal(slot, emp, day.date)}
                            title="Clique para editar"
                          >
                            <Clock size={12} className="text-slate-400" />
                            <span className="slot-hours">
                              {slot.startTime} — {slot.endTime}
                            </span>
                          </div>
                        ) : emp.active ? (
                          <button
                            className="btn-matrix-add"
                            onClick={() => onOpenEditModal(null, emp, day.date)}
                            title="Definir horário para este dia"
                          >
                            <Plus size={13} />
                          </button>
                        ) : (
                          <span className="matrix-dash">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

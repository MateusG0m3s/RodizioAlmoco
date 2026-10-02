import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Sparkles, Info } from 'lucide-react';
import LiveSummaryCards from './LiveSummaryCards';
import TimelineView from './TimelineView';
import { formatDateBR, toISODateString, parseISODate } from '../utils/timeUtils';

export default function DashboardView({
  currentDate,
  setCurrentDate,
  employees,
  daySlots,
  settings,
  currentTimeMinutes,
  conflictSlotIds,
  _hasConflicts,
  coverage,
  balanceStatus,
  balanceScore,
  onOpenGenerateModal,
  onQuickGenerateToday,
  onOpenEditModal,
  onAddSlotForEmployee,
  onUpdateSlotTimes,
  isAdmin = true,
  currentUserEmployeeId = null
}) {
  const dateObj = parseISODate(currentDate);
  const formattedDate = formatDateBR(dateObj);

  const handlePrevDay = () => {
    const prev = new Date(dateObj);
    prev.setDate(prev.getDate() - 1);
    if (prev.getDay() === 0) prev.setDate(prev.getDate() - 2);
    if (prev.getDay() === 6) prev.setDate(prev.getDate() - 1);
    setCurrentDate(toISODateString(prev));
  };

  const handleNextDay = () => {
    const next = new Date(dateObj);
    next.setDate(next.getDate() + 1);
    if (next.getDay() === 6) next.setDate(next.getDate() + 2);
    if (next.getDay() === 0) next.setDate(next.getDate() + 1);
    setCurrentDate(toISODateString(next));
  };

  const handleToday = () => {
    setCurrentDate(toISODateString(new Date()));
  };

  const [todayStr] = useState(() => toISODateString(new Date()));
  const isToday = currentDate === todayStr;

  return (
    <div className="dashboard-container animate-fade-in">
      {/* Topo do Dashboard */}
      <div className="dashboard-top-bar">
        {/* Navegação de Data */}
        <div className="date-navigation-group">
          <div className="date-badge-box">
            <Calendar size={18} className="text-scada-cyan" />
            <div className="date-text-details">
              <span className="date-weekday">{formattedDate.weekday}</span>
              <span className="date-full-str">
                {formattedDate.day} de {formattedDate.month} de {formattedDate.year}
              </span>
            </div>
            {isToday && <span className="today-chip">Hoje</span>}
          </div>

          <div className="date-buttons-cluster">
            <button className="btn-date-step" onClick={handlePrevDay} title="Dia anterior">
              <ChevronLeft size={16} />
            </button>
            <button
              className={`btn-today-step ${isToday ? 'is-current' : ''}`}
              onClick={handleToday}
            >
              Hoje
            </button>
            <button className="btn-date-step" onClick={handleNextDay} title="Próximo dia">
              <ChevronRight size={16} />
            </button>
            <input
              type="date"
              className="date-picker-inline"
              value={currentDate}
              onChange={(e) => e.target.value && setCurrentDate(e.target.value)}
            />
          </div>
        </div>

        {/* Ações Primárias (Geração em massa exclusiva para Administradores) */}
        <div className="dashboard-action-buttons">
          {isAdmin ? (
            <>
              <button
                type="button"
                className="btn-primary btn-generate-hero"
                style={{ borderRadius: '9999px' }}
                onClick={onQuickGenerateToday || onOpenGenerateModal}
                title="Gera e alterna imediatamente os turnos de hoje, garantindo atendimento contínuo (Admin)"
              >
                <Sparkles size={16} />
                <span>Gerar Rodízio</span>
              </button>

              {onOpenGenerateModal && (
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ borderRadius: '9999px' }}
                  onClick={onOpenGenerateModal}
                  title="Opções avançadas de sorteio e geração para a semana toda (Admin)"
                >
                  <Calendar size={15} />
                  <span className="hidden-mobile">Opções / Semana</span>
                </button>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '6px 14px', borderRadius: '9999px', border: '1px solid var(--border-subtle)' }}>
              <Info size={14} className="text-cyan-bright" />
              <span>Você pode editar e ajustar sua própria escala livremente</span>
            </div>
          )}
        </div>
      </div>

      {/* Cards de Resumo & Status com Foco em Atendimento ao Cliente */}
      <LiveSummaryCards
        employees={employees}
        daySlots={daySlots}
        currentTimeMinutes={currentTimeMinutes}
        coverage={coverage}
        settings={settings}
        balanceStatus={balanceStatus}
        balanceScore={balanceScore}
      />

      {/* Área da Escala (Timeline Fixa com RBAC) */}
      <div className="schedule-main-area">
        <TimelineView
          employees={employees}
          daySlots={daySlots}
          settings={settings}
          currentTimeMinutes={currentTimeMinutes}
          conflictSlotIds={conflictSlotIds}
          coverage={coverage}
          onEditSlot={onOpenEditModal}
          onAddSlotForEmployee={onAddSlotForEmployee}
          onUpdateSlotTimes={onUpdateSlotTimes}
          isAdmin={isAdmin}
          currentUserEmployeeId={currentUserEmployeeId}
        />
      </div>
    </div>
  );
}

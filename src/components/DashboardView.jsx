import React, { useState } from 'react';
import { Sparkles, SlidersHorizontal, Info } from 'lucide-react';
import MyLunchHero from './MyLunchHero';
import NowCard from './NowCard';
import TimelineView from './TimelineView';
import LunchQueue from './LunchQueue';
import { toISODateString } from '../utils/timeUtils';
import { getMyLunchState, getDaySummary } from '../utils/lunchState';

export default function DashboardView({
  currentDate,
  employees,
  daySlots,
  settings,
  currentTimeMinutes,
  conflictSlotIds,
  coverage,
  onOpenGenerateModal,
  onQuickGenerateToday,
  onOpenEditModal,
  onAddSlotForEmployee,
  onUpdateSlotTimes,
  isAdmin = true,
  currentUserEmployeeId = null
}) {
  const [todayStr] = useState(() => toISODateString(new Date()));
  const isToday = currentDate === todayStr;

  const summary = getDaySummary(employees, daySlots, currentTimeMinutes);

  // "Seu almoço" é o destaque do painel; só aparece para quem está na equipe
  const ownEmployee = employees.find((e) => e.id === currentUserEmployeeId) || null;
  const ownSlot = ownEmployee ? summary.sortedSlots.find((s) => s.employeeId === currentUserEmployeeId) || null : null;
  const myLunch = ownEmployee ? getMyLunchState(ownSlot, currentTimeMinutes, isToday) : null;

  const quickGenerate = onQuickGenerateToday || onOpenGenerateModal;

  // Geração em massa é exclusiva de administradores; os demais ajustam só o próprio horário
  const headerActions = isAdmin ? (
    <>
      <button
        type="button"
        className="ui-btn primary sm"
        onClick={quickGenerate}
        title="Gera e alterna os turnos de hoje garantindo atendimento contínuo"
      >
        <Sparkles size={15} />
        Gerar rodízio
      </button>
      {onOpenGenerateModal && (
        <button
          type="button"
          className="ui-icon-btn sm"
          onClick={onOpenGenerateModal}
          title="Opções de geração (sorteio, semana inteira)"
          aria-label="Opções de geração"
        >
          <SlidersHorizontal size={15} />
        </button>
      )}
    </>
  ) : (
    <span className="ui-caption tl-hint">
      <Info size={14} aria-hidden="true" />
      Você pode ajustar o seu próprio horário
    </span>
  );

  return (
    <div className="dashboard-view animate-fade-in">
      <div className={`dash-top ${myLunch ? '' : 'no-hero'}`}>
        <MyLunchHero
          myLunch={myLunch}
          ownSlot={ownSlot}
          isToday={isToday}
          onEditOwnSlot={(slot) => onOpenEditModal(slot, ownEmployee)}
          onAddOwnSlot={ownEmployee ? () => onAddSlotForEmployee(ownEmployee) : null}
        />
        <NowCard
          summary={summary}
          employees={employees}
          currentTimeMinutes={currentTimeMinutes}
          coverage={coverage}
          settings={settings}
          currentUserEmployeeId={currentUserEmployeeId}
          isAdmin={isAdmin}
          onQuickGenerate={quickGenerate}
        />
      </div>

      <TimelineView
        employees={employees}
        daySlots={daySlots}
        settings={settings}
        currentTimeMinutes={currentTimeMinutes}
        conflictSlotIds={conflictSlotIds}
        onEditSlot={onOpenEditModal}
        onAddSlotForEmployee={onAddSlotForEmployee}
        onUpdateSlotTimes={onUpdateSlotTimes}
        isAdmin={isAdmin}
        currentUserEmployeeId={currentUserEmployeeId}
        isToday={isToday}
        headerActions={headerActions}
      />

      <LunchQueue
        employees={employees}
        summary={summary}
        currentTimeMinutes={currentTimeMinutes}
        conflictSlotIds={conflictSlotIds}
        coverage={coverage}
        isAdmin={isAdmin}
        currentUserEmployeeId={currentUserEmployeeId}
        onEditSlot={onOpenEditModal}
        onAddSlotForEmployee={onAddSlotForEmployee}
        headerActions={isAdmin ? headerActions : null}
      />
    </div>
  );
}

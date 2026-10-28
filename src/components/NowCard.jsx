import React from 'react';
import { Headset, Users, Utensils, Clock, TriangleAlert, Sparkles } from 'lucide-react';
import { timeToMinutes } from '../utils/timeUtils';
import { getShortName } from '../utils/nameUtils';
import { formatDuration, getSlotPhase } from '../utils/lunchState';

// "Agora no atendimento": três números do momento + a régua da equipe.
// A cobertura fica num chip discreto e só vira alerta quando há brecha na janela crítica.
export default function NowCard({
  summary,
  employees = [],
  currentTimeMinutes,
  coverage,
  settings = {},
  currentUserEmployeeId = null,
  isAdmin = false,
  onQuickGenerate
}) {
  const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));
  const nameOf = (slot) => {
    const emp = empMap[slot.employeeId];
    return emp ? emp.shortName || getShortName(emp.name) : 'Colaborador';
  };
  const minWorking = Number(settings?.minWorkingDuringCritical) || 1;
  const gaps = coverage?.hasGaps ? coverage.gaps || [] : [];

  // "Próximo" mostra a equipe; o horário do próprio usuário já está no herói
  const nextTeamSlot = currentUserEmployeeId
    ? summary.upcoming.find((s) => s.employeeId !== currentUserEmployeeId) || null
    : summary.upcoming[0] || null;
  const minutesToNext = nextTeamSlot ? timeToMinutes(nextTeamSlot.startTime) - currentTimeMinutes : null;

  const firstLunching = summary.lunching[0];
  const lunchingCaption = firstLunching
    ? `${nameOf(firstLunching)}, até ${firstLunching.endTime}${summary.lunching.length > 1 ? ` e mais ${summary.lunching.length - 1}` : ''}`
    : 'Ninguém agora';

  return (
    <section className="ui-card now-card" aria-label="Agora no atendimento">
      <div className="ui-card-head">
        <div className="ui-card-title">
          <span className="ui-icon-circle" aria-hidden="true"><Headset size={16} /></span>
          Agora no atendimento
        </div>
        {gaps.length > 0 ? (
          <span className="ui-chip bad">
            Brecha {gaps[0].startTime}–{gaps[0].endTime}{gaps.length > 1 ? ` +${gaps.length - 1}` : ''}
          </span>
        ) : (
          <span className="ui-chip ok">Janela crítica coberta</span>
        )}
      </div>

      {gaps.length > 0 && (
        <div className="now-gap-alert" role="alert">
          <span className="now-gap-icon" aria-hidden="true"><TriangleAlert size={16} /></span>
          <div className="now-gap-text">
            <b>
              {gaps.length === 1
                ? `Só ${gaps[0].workingCount} no posto entre ${gaps[0].startTime} e ${gaps[0].endTime} (mínimo: ${minWorking})`
                : `${gaps.length} intervalos com menos de ${minWorking} no posto`}
            </b>
            <span>
              {gaps.length > 1 && `${gaps.map((g) => `${g.startTime}–${g.endTime}`).join(', ')}. `}
              {isAdmin ? 'Ajuste os horários ou gere o rodízio de novo.' : 'Avise um administrador ou ajuste o seu horário.'}
            </span>
          </div>
          {isAdmin && onQuickGenerate && (
            <button type="button" className="ui-btn primary sm" onClick={onQuickGenerate}>
              <Sparkles size={15} />
              Gerar rodízio
            </button>
          )}
        </div>
      )}

      <div className="now-minis">
        <div className="now-mini">
          <div className="now-mini-head">
            <span className="ui-icon-circle" aria-hidden="true"><Users size={14} /></span>
            <span className="ui-label">No posto</span>
          </div>
          <div className="now-mini-value">
            {summary.workingNow} <small>de {summary.activeCount}</small>
          </div>
          <span className="ui-caption">mínimo exigido: {minWorking}</span>
        </div>

        <div className="now-mini">
          <div className="now-mini-head">
            <span className="ui-icon-circle" aria-hidden="true"><Utensils size={14} /></span>
            <span className="ui-label">Almoçando</span>
          </div>
          <div className="now-mini-value">{summary.lunching.length}</div>
          <span className="ui-caption">{lunchingCaption}</span>
        </div>

        <div className="now-mini">
          <div className="now-mini-head">
            <span className="ui-icon-circle" aria-hidden="true"><Clock size={14} /></span>
            <span className="ui-label">Próximo</span>
          </div>
          <div className="now-mini-value">{nextTeamSlot ? nextTeamSlot.startTime : '—'}</div>
          <span className="ui-caption">
            {nextTeamSlot ? `${nameOf(nextTeamSlot)}, em ${formatDuration(minutesToNext)}` : 'Sem almoços pendentes'}
          </span>
        </div>
      </div>

      {summary.sortedSlots.length > 0 && (
        <div className="now-team">
          <div className="now-team-dots-wrap">
            <span className="ui-label">Equipe hoje</span>
            <div
              className="now-team-dots"
              role="img"
              aria-label={`${summary.finished.length} concluíram, ${summary.lunching.length} almoçando, ${summary.upcoming.length} a seguir`}
            >
              {summary.sortedSlots.map((slot) => (
                <i
                  key={slot.id}
                  className={`is-${getSlotPhase(slot, currentTimeMinutes)} ${slot.employeeId === currentUserEmployeeId ? 'is-you' : ''}`}
                  title={`${nameOf(slot)}: ${slot.startTime}–${slot.endTime}`}
                />
              ))}
            </div>
          </div>
          <div className="now-team-legend">
            <span><b>{summary.finished.length}</b> {summary.finished.length === 1 ? 'concluiu' : 'concluíram'}</span>
            <span><b>{summary.lunching.length}</b> almoçando</span>
            <span><b>{summary.upcoming.length}</b> a seguir</span>
          </div>
        </div>
      )}
    </section>
  );
}

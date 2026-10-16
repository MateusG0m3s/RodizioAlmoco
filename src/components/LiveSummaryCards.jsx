import React from 'react';
import { Utensils, Users, Clock, ShieldCheck, AlertTriangle, Hourglass, Headset, CheckCircle2 } from 'lucide-react';
import { getInitials } from '../utils/nameUtils';
import { timeToMinutes } from '../utils/timeUtils';

const SOON_THRESHOLD_MIN = 10;   // a partir daqui o aviso vira "Prepare-se"
const COUNTDOWN_WINDOW_MIN = 60; // o anel enche durante a última hora antes do almoço

const formatDuration = (minutes) => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
};

// Estado do almoço do usuário logado: o que o anel mostra e o que o texto diz
function getMyLunchState(slot, nowMin, isToday) {
  if (!slot) return { key: 'none', status: isToday ? 'Você ainda não tem horário hoje.' : 'Você não tem horário neste dia.' };
  const start = timeToMinutes(slot.startTime);
  const end = timeToMinutes(slot.endTime);
  const range = `${slot.startTime} – ${slot.endTime}`;
  if (!isToday) return { key: 'scheduled', range, status: 'Horário marcado para este dia.' };

  if (nowMin < start) {
    const minutes = start - nowMin;
    const soon = minutes <= SOON_THRESHOLD_MIN;
    return {
      key: soon ? 'soon' : 'upcoming',
      range,
      ring: Math.round((1 - Math.min(minutes, COUNTDOWN_WINDOW_MIN) / COUNTDOWN_WINDOW_MIN) * 100),
      ringLabel: formatDuration(minutes),
      status: soon ? `Começa em ${formatDuration(minutes)}. Prepare-se!` : `Começa em ${formatDuration(minutes)}.`
    };
  }
  if (nowMin < end) {
    const remaining = end - nowMin;
    return {
      key: 'lunching',
      range,
      ring: Math.round(((nowMin - start) / (end - start)) * 100),
      ringLabel: formatDuration(remaining),
      status: `Você está almoçando. Volta às ${slot.endTime}.`
    };
  }
  return { key: 'done', range, ring: 100, status: `Almoço concluído às ${slot.endTime}.` };
}

export default function LiveSummaryCards({
  employees = [],
  daySlots = [],
  currentTimeMinutes,
  coverage,
  settings = {},
  currentUserEmployeeId = null,
  isToday = true,
  onAddOwnSlot = null
}) {
  const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));
  const activeEmployees = employees.filter((e) => e.active);

  // Ordena os slots do dia por horário de início
  const sortedSlots = [...daySlots].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );

  // 1. Quem já terminou de almoçar
  const finishedSlots = sortedSlots.filter((slot) => {
    const end = timeToMinutes(slot.endTime);
    return currentTimeMinutes >= end;
  });

  // 2. Quem está almoçando agora
  const activeLunchSlots = sortedSlots.filter((slot) => {
    const start = timeToMinutes(slot.startTime);
    const end = timeToMinutes(slot.endTime);
    return currentTimeMinutes >= start && currentTimeMinutes < end;
  });

  // 3. Quem ainda vai almoçar mais tarde hoje
  const upcomingSlots = sortedSlots.filter((slot) => {
    const start = timeToMinutes(slot.startTime);
    return currentTimeMinutes < start;
  });

  const totalSlotsCount = daySlots.length;
  const finishedCount = finishedSlots.length;
  const lunchingCount = activeLunchSlots.length;
  const upcomingCount = upcomingSlots.length;

  // Quantidade de atendentes trabalhando no posto agora
  const workingNowCount = Math.max(0, activeEmployees.length - activeLunchSlots.length);

  // Próximo almoço
  const nextSlot = upcomingSlots[0] || null;

  // Tempo restante do primeiro almoço ativo
  let remainingMinutes = 0;
  let progressPercent = 0;
  if (activeLunchSlots.length > 0) {
    const firstSlot = activeLunchSlots[0];
    const start = timeToMinutes(firstSlot.startTime);
    const end = timeToMinutes(firstSlot.endTime);
    const totalDuration = end - start;
    const elapsed = currentTimeMinutes - start;
    remainingMinutes = Math.max(0, end - currentTimeMinutes);
    progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
  }

  // "Seu almoço": o horário do colaborador logado é o destaque principal do dashboard.
  // O card "Próximo almoço" passa a mostrar só a equipe, para não repetir a mesma informação.
  const ownEmployee = currentUserEmployeeId ? empMap[currentUserEmployeeId] : null;
  const ownSlot = ownEmployee ? sortedSlots.find((s) => s.employeeId === currentUserEmployeeId) : null;
  const myLunch = ownEmployee ? getMyLunchState(ownSlot, currentTimeMinutes, isToday) : null;
  const nextTeamSlot = ownEmployee
    ? upcomingSlots.find((s) => s.employeeId !== currentUserEmployeeId) || null
    : nextSlot;
  const minutesToNextTeam = nextTeamSlot ? timeToMinutes(nextTeamSlot.startTime) - currentTimeMinutes : null;

  return (
    <div className="summary-section">
      {/* Alerta de Brecha Crítica no Atendimento aos Clientes */}
      {coverage && coverage.hasGaps && (
        <div className="critical-gap-banner animate-fade-in">
          <div className="critical-gap-icon">
            <AlertTriangle size={22} />
          </div>
          <div className="critical-gap-text">
            <strong>Atenção: risco de clientes sem atendimento</strong>
            <p>
              Existem horários com menos de {settings?.minWorkingDuringCritical || 1} atendente(s) trabalhando entre {settings?.criticalStart || '11:30'} e {settings?.criticalEnd || '13:30'}:{' '}
              <strong>
                {coverage.gaps.map((g) => `${g.startTime} — ${g.endTime} (${g.workingCount} ativo(s))`).join(', ')}
              </strong>
              . Ajuste os horários ou use "Gerar Rodízio" para cobrir a janela.
            </p>
          </div>
        </div>
      )}

      {/* Seu almoço: destaque pessoal do colaborador logado */}
      {myLunch && (
        <div className={`my-lunch-strip is-${myLunch.key}`} aria-live="polite">
          {myLunch.ring !== undefined ? (
            <div
              className="my-lunch-ring"
              style={{ '--ring': myLunch.ring }}
              role="img"
              aria-label={myLunch.ringLabel ? `Faltam ${myLunch.ringLabel}` : 'Almoço concluído'}
            >
              {myLunch.key === 'done' ? <CheckCircle2 size={22} /> : <span>{myLunch.ringLabel}</span>}
            </div>
          ) : (
            <div className="my-lunch-ring is-empty" aria-hidden="true">
              <Utensils size={20} />
            </div>
          )}

          <div className="my-lunch-text">
            <span className="my-lunch-label">{isToday ? 'Seu almoço hoje' : 'Seu almoço neste dia'}</span>
            {myLunch.range && <strong className="my-lunch-time">{myLunch.range}</strong>}
            <span className="my-lunch-status">{myLunch.status}</span>
          </div>

          {myLunch.key === 'none' && onAddOwnSlot && (
            <button type="button" className="btn-primary my-lunch-action" onClick={onAddOwnSlot}>
              Definir meu almoço
            </button>
          )}
        </div>
      )}

      {/* Grid Principal dos 4 Cards */}
      <div className="summary-cards-grid">
        {/* CARD 1: ALMOÇANDO AGORA */}
        <div className={`summary-card hero-card ${activeLunchSlots.length > 0 ? 'is-active-lunch' : 'is-idle'}`}>
          <div className="card-top-header">
            <div className="card-tag">
              <Utensils size={14} />
              <span>Almoçando agora</span>
            </div>
            {activeLunchSlots.length > 0 && (
              <span className="live-pulsing-badge">
                <span className="pulse-dot" /> {activeLunchSlots.length}{' '}
                {activeLunchSlots.length === 1 ? 'pessoa' : 'pessoas'}
              </span>
            )}
          </div>

          {activeLunchSlots.length > 0 ? (
            <div className="hero-lunch-body">
              <div className="active-lunch-people-row">
                {activeLunchSlots.map((slot) => {
                  const emp = empMap[slot.employeeId];
                  if (!emp) return null;
                  return (
                    <div key={slot.id} className="hero-emp-info-compact">
                      <div
                        className="hero-avatar"
                        style={{ backgroundColor: emp.color || '#4f1f66' }}
                      >
                        {getInitials(emp.name)}
                      </div>
                      <div className="hero-emp-names">
                        <span className="hero-emp-name">{emp.name}</span>
                        <span className="hero-time-range">
                          {slot.startTime} — {slot.endTime}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hero-progress-container">
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="progress-labels">
                  <span className="progress-remaining">
                    <Hourglass size={13} /> Restam aprox. {remainingMinutes} min
                  </span>
                  <span className="progress-percent">{progressPercent}% decorrido</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="hero-idle-body">
              <div className="idle-icon-wrap">
                <Utensils size={26} />
              </div>
              <div className="idle-text-wrap">
                <p className="idle-title">Ninguém almoçando no momento</p>
                <p className="idle-subtitle">
                  {nextSlot && empMap[nextSlot.employeeId] ? (
                    <>
                      Próximo: <strong>{empMap[nextSlot.employeeId].shortName || empMap[nextSlot.employeeId].name}</strong> às <strong>{nextSlot.startTime}</strong>
                    </>
                  ) : (
                    'Todos os almoços de hoje foram concluídos ou sem escala pendente.'
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* CARD 2: ATENDIMENTO AO CLIENTE (11:30 — 13:30) */}
        <div className={`summary-card stat-card ${coverage && !coverage.isFullyCovered ? 'card-coverage-alert' : 'card-coverage-ok'}`}>
          <div className="card-top-header">
            <div className="card-tag">
              <Headset size={14} />
              <span>Atendimento ao cliente</span>
            </div>
          </div>
          <div className="stat-body">
            {coverage && coverage.isFullyCovered ? (
              <>
                <div className="stat-coverage-badge badge-coverage-ok">
                  <ShieldCheck size={18} /> 100% Coberto
                </div>
                <div className="stat-subtext text-emerald-700 font-semibold">
                  Nenhum horário desfalca o atendimento entre {settings?.criticalStart || '11:30'} e {settings?.criticalEnd || '13:30'}!
                </div>
                <div className="stat-live-workers">
                  <span>Trabalhando no posto agora:</span>
                  <strong className="workers-counter-pill">{workingNowCount} atendentes</strong>
                </div>
              </>
            ) : (
              <>
                <div className="stat-coverage-badge badge-coverage-gap">
                  <AlertTriangle size={18} /> Janela Descoberta
                </div>
                <div className="stat-subtext text-rose-600 font-semibold">
                  Horário com menos de {settings?.minWorkingDuringCritical || 1} atendente(s) ativo(s)!
                </div>
                <div className="stat-live-workers">
                  <span>Trabalhando agora:</span>
                  <strong className="workers-counter-pill warning">{workingNowCount} atendentes</strong>
                </div>
              </>
            )}
          </div>
        </div>

        {/* CARD 3: PRÓXIMO ALMOÇO */}
        <div className="summary-card stat-card">
          <div className="card-top-header">
            <div className="card-tag">
              <Clock size={14} />
              <span>Próximo almoço</span>
            </div>
          </div>
          <div className="stat-body">
            {nextTeamSlot && empMap[nextTeamSlot.employeeId] ? (
              <>
                <div className="stat-main-number">{nextTeamSlot.startTime}</div>
                <div className="stat-subtext-emp">
                  <div
                    className="stat-avatar-mini"
                    style={{ backgroundColor: empMap[nextTeamSlot.employeeId].color }}
                  >
                    {getInitials(empMap[nextTeamSlot.employeeId].name)}
                  </div>
                  <span className="stat-next-emp-name">{empMap[nextTeamSlot.employeeId].name}</span>
                </div>
                <div className={`stat-badge-in ${minutesToNextTeam <= SOON_THRESHOLD_MIN ? 'is-soon' : ''}`}>
                  Em {formatDuration(minutesToNextTeam)}
                </div>
              </>
            ) : (
              <>
                <div className="stat-main-number">—</div>
                <div className="stat-subtext">Sem almoços pendentes hoje</div>
              </>
            )}
          </div>
        </div>

        {/* CARD 4: EQUIPE HOJE (Cálculo 100% Claro e Segmentado) */}
        <div className="summary-card stat-card">
          <div className="card-top-header">
            <div className="card-tag">
              <Users size={14} />
              <span>Equipe hoje</span>
            </div>
            <span className="stat-total-badge">{totalSlotsCount} no total</span>
          </div>

          <div className="stat-body">
            <div className="team-breakdown-list">
              <div className="team-stat-item finished">
                <span className="stat-dot dot-finished" />
                <span className="stat-item-label">Já almoçaram:</span>
                <strong className="stat-item-val">{finishedCount}</strong>
              </div>
              <div className="team-stat-item lunching">
                <span className="stat-dot dot-lunching" />
                <span className="stat-item-label">Almoçando agora:</span>
                <strong className="stat-item-val">{lunchingCount}</strong>
              </div>
              <div className="team-stat-item upcoming">
                <span className="stat-dot dot-upcoming" />
                <span className="stat-item-label">Ainda vão almoçar:</span>
                <strong className="stat-item-val">{upcomingCount}</strong>
              </div>
            </div>

            {/* Barra de Progresso Segmentada (Concluídos | Almoçando | A Almoçar) */}
            <div className="team-segmented-progress" title={`Concluídos: ${finishedCount} | Almoçando: ${lunchingCount} | A almoçar: ${upcomingCount}`}>
              <div
                className="seg-bar seg-finished"
                style={{ width: `${totalSlotsCount > 0 ? (finishedCount / totalSlotsCount) * 100 : 0}%` }}
              />
              <div
                className="seg-bar seg-lunching"
                style={{ width: `${totalSlotsCount > 0 ? (lunchingCount / totalSlotsCount) * 100 : 0}%` }}
              />
              <div
                className="seg-bar seg-upcoming"
                style={{ width: `${totalSlotsCount > 0 ? (upcomingCount / totalSlotsCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

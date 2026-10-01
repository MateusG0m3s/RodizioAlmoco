import React from 'react';
import { Utensils, Users, Clock, ShieldCheck, AlertTriangle, Hourglass, Headset, CheckCircle2 } from 'lucide-react';
import { timeToMinutes } from '../utils/timeUtils';

export default function LiveSummaryCards({
  employees,
  daySlots,
  currentTimeMinutes,
  coverage,
  balanceStatus,
  balanceScore
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

  // Notificação de almoço próximo (< 10 min)
  let alertUpcoming = null;
  if (nextSlot) {
    const minutesToNext = timeToMinutes(nextSlot.startTime) - currentTimeMinutes;
    if (minutesToNext > 0 && minutesToNext <= 10) {
      alertUpcoming = {
        employee: empMap[nextSlot.employeeId],
        minutes: minutesToNext,
        time: nextSlot.startTime
      };
    }
  }

  return (
    <div className="summary-section">
      {/* Alerta de Brecha Crítica no Atendimento aos Clientes */}
      {coverage && coverage.hasGaps && (
        <div className="critical-gap-banner animate-fade-in">
          <div className="critical-gap-icon">
            <AlertTriangle size={22} />
          </div>
          <div className="critical-gap-text">
            <strong>⚠️ ATENÇÃO: Risco de Clientes sem Atendimento!</strong>
            <p>
              Existem horários vazios sem nenhum atendente trabalhando entre 11:30 e 13:30:{' '}
              <strong>
                {coverage.gaps.map((g) => `${g.startTime} — ${g.endTime}`).join(', ')}
              </strong>
              . Ajuste os horários ou use "Gerar Rodízio" para cobrir a janela.
            </p>
          </div>
        </div>
      )}

      {/* Aviso de Almoço Próximo */}
      {alertUpcoming && (
        <div className="live-alert-banner animate-fade-in">
          <div className="alert-pulse-icon">🔔</div>
          <div className="alert-content">
            <span className="alert-emp-name">{alertUpcoming.employee?.name || 'Funcionário'}:</span>
            <span className="alert-text">
              Seu almoço começa em <strong>{alertUpcoming.minutes} minutos</strong> ({alertUpcoming.time}).
            </span>
          </div>
          <span className="alert-badge">Prepare-se</span>
        </div>
      )}

      {/* Grid Principal dos 4 Cards */}
      <div className="summary-cards-grid">
        {/* CARD 1: ALMOÇANDO AGORA */}
        <div className={`summary-card hero-card ${activeLunchSlots.length > 0 ? 'is-active-lunch' : 'is-idle'}`}>
          <div className="card-top-header">
            <div className="card-tag">
              <Utensils size={14} />
              <span>ALMOÇANDO AGORA</span>
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
                        style={{ backgroundColor: emp.color || '#381267' }}
                      >
                        {emp.avatar || emp.name.slice(0, 2).toUpperCase()}
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
              <span>ATENDIMENTO AO CLIENTE</span>
            </div>
          </div>
          <div className="stat-body">
            {coverage && coverage.isFullyCovered ? (
              <>
                <div className="stat-coverage-badge badge-coverage-ok">
                  <ShieldCheck size={18} /> 100% Coberto
                </div>
                <div className="stat-subtext text-emerald-700 font-semibold">
                  Nenhum horário vazio entre 11:30 e 13:30!
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
                  Há horário sem atendente ativo!
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
              <span>PRÓXIMO ALMOÇO</span>
            </div>
          </div>
          <div className="stat-body">
            {nextSlot && empMap[nextSlot.employeeId] ? (
              <>
                <div className="stat-main-number">{nextSlot.startTime}</div>
                <div className="stat-subtext-emp">
                  <div
                    className="stat-avatar-mini"
                    style={{ backgroundColor: empMap[nextSlot.employeeId].color }}
                  >
                    {empMap[nextSlot.employeeId].avatar}
                  </div>
                  <span className="stat-next-emp-name">{empMap[nextSlot.employeeId].name}</span>
                </div>
                <div className="stat-badge-in">
                  Em {timeToMinutes(nextSlot.startTime) - currentTimeMinutes} min
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
              <span>EQUIPE HOJE</span>
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

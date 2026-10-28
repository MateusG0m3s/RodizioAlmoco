import { timeToMinutes } from './timeUtils.js';

export const SOON_THRESHOLD_MIN = 10;   // a partir daqui o aviso vira "Prepare-se"
export const COUNTDOWN_WINDOW_MIN = 60; // o anel enche durante a última hora antes do almoço

export const formatDuration = (minutes) => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
};

// Estado do almoço do usuário logado: o que o anel mostra e o que o texto diz
export function getMyLunchState(slot, nowMin, isToday) {
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
      status: soon
        ? `Começa em ${formatDuration(minutes)}. Prepare-se!`
        : `Começa em ${formatDuration(minutes)}. Você volta às ${slot.endTime}.`
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

// Estado de um horário em relação ao relógio: concluído, almoçando agora ou a seguir
export function getSlotPhase(slot, nowMin) {
  const start = timeToMinutes(slot.startTime);
  const end = timeToMinutes(slot.endTime);
  if (nowMin >= end) return 'done';
  if (nowMin >= start) return 'now';
  return 'next';
}

// Resumo do dia usado pelo cartão "Agora" e pela fila do celular
export function getDaySummary(employees = [], daySlots = [], nowMin) {
  const sortedSlots = [...daySlots].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );
  const finished = sortedSlots.filter((s) => getSlotPhase(s, nowMin) === 'done');
  const lunching = sortedSlots.filter((s) => getSlotPhase(s, nowMin) === 'now');
  const upcoming = sortedSlots.filter((s) => getSlotPhase(s, nowMin) === 'next');
  const activeCount = employees.filter((e) => e.active).length;

  return {
    sortedSlots,
    finished,
    lunching,
    upcoming,
    activeCount,
    // Quantidade de atendentes no posto agora
    workingNow: Math.max(0, activeCount - lunching.length)
  };
}

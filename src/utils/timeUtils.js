/**
 * Utilitários de tempo e horários para o Rodízio de Almoço
 */

/** Converte horário no formato "HH:mm" para minutos totais desde 00:00 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Converte minutos totais desde 00:00 para formato "HH:mm" */
export function minutesToTime(totalMinutes) {
  const normalized = Math.max(0, Math.min(1439, Math.round(totalMinutes)));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Arredonda minutos para o múltiplo mais próximo do intervalo (ex: 5 min) */
export function snapToInterval(minutes, interval = 5) {
  return Math.round(minutes / interval) * interval;
}

/** Adiciona minutos a uma string de horário "HH:mm" */
export function addMinutesToTime(timeStr, minutesToAdd) {
  const current = timeToMinutes(timeStr);
  return minutesToTime(current + minutesToAdd);
}

/** Calcula a duração em minutos entre dois horários "HH:mm" */
export function getDurationMinutes(startTime, endTime) {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

/** Formata data para exibição elegante em português (ex: "Quinta-feira, 01 de Outubro") */
export function formatDateBR(dateObjOrString) {
  const date = typeof dateObjOrString === 'string' ? parseISODate(dateObjOrString) : dateObjOrString;
  const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const weekday = weekdays[date.getDay()];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return {
    weekday,
    day,
    month,
    year,
    fullDisplay: `${weekday}, ${day} de ${month}`,
    shortDisplay: `${weekday.slice(0, 3)}, ${day}/${String(date.getMonth() + 1).padStart(2, '0')}`
  };
}

/** Retorna a string ISO 'YYYY-MM-DD' de uma data */
export function toISODateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Converte string ISO 'YYYY-MM-DD' para objeto Date local (evitando desvios de timezone) */
export function parseISODate(isoStr) {
  if (!isoStr) return new Date();
  const [year, month, day] = isoStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

/** Retorna os 5 dias úteis (Segunda a Sexta) da semana de uma data */
export function getWorkDaysOfWeek(targetDate) {
  const date = new Date(targetDate);
  const dayOfWeek = date.getDay(); // 0: Dom, 1: Seg, 5: Sex, 6: Sab
  
  // Distância até a segunda-feira
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);

  const workdays = [];
  const dayNames = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  const shortNames = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];

  for (let i = 0; i < 5; i++) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + i);
    workdays.push({
      date: toISODateString(current),
      dateObj: current,
      dayNumber: String(current.getDate()).padStart(2, '0'),
      name: dayNames[i],
      shortName: shortNames[i],
      isToday: toISODateString(current) === toISODateString(new Date())
    });
  }

  return workdays;
}

/** Determina o status atual do funcionário com base no horário */
export function getEmployeeLunchStatus(employeeId, slotsForDay, currentTimeMinutes, warningMinutesBefore = 10) {
  const slot = slotsForDay.find(s => s.employeeId === employeeId);
  if (!slot) {
    return {
      type: 'NO_SCHEDULE',
      label: 'Sem rodízio hoje',
      badgeClass: 'badge-neutral',
      color: '#64748b',
      icon: 'HelpCircle',
      slot: null
    };
  }

  const startMin = timeToMinutes(slot.startTime);
  const endMin = timeToMinutes(slot.endTime);
  const totalDuration = endMin - startMin;

  if (currentTimeMinutes >= startMin && currentTimeMinutes < endMin) {
    const elapsedMinutes = currentTimeMinutes - startMin;
    const remainingMinutes = endMin - currentTimeMinutes;
    const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedMinutes / totalDuration) * 100)));

    return {
      type: 'LUNCHING_NOW',
      label: 'Almoçando agora',
      badgeClass: 'badge-lunching',
      color: '#f97316', // Laranja quente
      icon: 'Utensils',
      slot,
      remainingMinutes,
      progressPercent
    };
  }

  if (currentTimeMinutes < startMin) {
    const minutesUntil = startMin - currentTimeMinutes;
    if (minutesUntil <= warningMinutesBefore) {
      return {
        type: 'UPCOMING_SOON',
        label: `Almoço em ${minutesUntil} min`,
        badgeClass: 'badge-warning',
        color: '#eab308', // Amarelo de atenção
        icon: 'Clock',
        slot,
        startsInMinutes: minutesUntil
      };
    }

    return {
      type: 'WORKING_BEFORE',
      label: 'Trabalhando',
      badgeClass: 'badge-working',
      color: '#10b981', // Verde de trabalho
      icon: 'Briefcase',
      slot,
      startsInMinutes: minutesUntil
    };
  }

  // Já passou do horário
  return {
    type: 'FINISHED',
    label: 'Já almoçou',
    badgeClass: 'badge-finished',
    color: '#059669', // Verde concluído
    icon: 'CheckCircle2',
    slot
  };
}

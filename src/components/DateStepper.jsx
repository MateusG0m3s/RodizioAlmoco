import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { toISODateString, parseISODate } from '../utils/timeUtils';

// Navegação entre dias úteis: anterior, "Hoje" (destacado quando é o dia atual), próximo e calendário nativo
export default function DateStepper({ currentDate, setCurrentDate }) {
  const dateObj = parseISODate(currentDate);
  const [todayStr] = useState(() => toISODateString(new Date()));
  const isToday = currentDate === todayStr;
  const datePickerRef = useRef(null);

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

  const openDatePicker = () => {
    const input = datePickerRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };

  return (
    <div className="ui-segmented date-stepper" role="group" aria-label="Data da escala">
      <button type="button" onClick={handlePrevDay} title="Dia útil anterior" aria-label="Dia útil anterior">
        <ChevronLeft size={16} />
      </button>
      <button
        type="button"
        className={isToday ? 'is-on' : ''}
        onClick={() => setCurrentDate(toISODateString(new Date()))}
        aria-pressed={isToday}
      >
        Hoje
      </button>
      <button type="button" onClick={handleNextDay} title="Próximo dia útil" aria-label="Próximo dia útil">
        <ChevronRight size={16} />
      </button>
      <span className="date-picker-trigger">
        <button type="button" onClick={openDatePicker} title="Escolher outra data" aria-label="Escolher outra data">
          <CalendarDays size={16} />
        </button>
        <input
          ref={datePickerRef}
          type="date"
          className="date-picker-native"
          tabIndex={-1}
          aria-hidden="true"
          value={currentDate}
          onChange={(e) => e.target.value && setCurrentDate(e.target.value)}
        />
      </span>
    </div>
  );
}

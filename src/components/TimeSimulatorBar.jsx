import React from 'react';
import { Sliders, X, RotateCcw, FastForward } from 'lucide-react';
import { minutesToTime, timeToMinutes } from '../utils/timeUtils';

export default function TimeSimulatorBar({
  isSimulating,
  onClose,
  currentTimeMinutes,
  onChangeTime,
  onReset
}) {
  if (!isSimulating) return null;

  const quickTimes = [
    { label: '11:15 (Trabalhando)', time: '11:15' },
    { label: '11:40 (1º Almoço)', time: '11:40' },
    { label: '12:15 (2º Almoço)', time: '12:15' },
    { label: '12:45 (3º Almoço)', time: '12:45' },
    { label: '13:20 (4º Almoço)', time: '13:20' },
    { label: '14:00 (Fim)', time: '14:00' }
  ];

  return (
    <div className="simulator-banner animate-slide-down">
      <div className="simulator-content">
        <div className="simulator-tag">
          <Sliders size={16} />
          <span>Simulador de Horário</span>
        </div>

        <div className="simulator-slider-group">
          <input
            type="range"
            min={11 * 60} // 11:00 = 660
            max={14 * 60 + 30} // 14:30 = 870
            step={5}
            value={currentTimeMinutes}
            onChange={(e) => onChangeTime(Number(e.target.value))}
            className="simulator-slider"
          />
          <span className="simulator-clock">{minutesToTime(currentTimeMinutes)}</span>
        </div>

        <div className="simulator-quick-buttons">
          {quickTimes.map((item) => (
            <button
              key={item.time}
              className={`quick-time-btn ${currentTimeMinutes === timeToMinutes(item.time) ? 'active' : ''}`}
              onClick={() => onChangeTime(timeToMinutes(item.time))}
            >
              {item.time}
            </button>
          ))}
        </div>

        <div className="simulator-actions">
          <button className="btn-simulator-reset" onClick={onReset} title="Resetar para hora real">
            <RotateCcw size={14} />
            <span>Hora Real</span>
          </button>
          <button className="btn-simulator-close" onClick={onClose} title="Fechar simulador">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

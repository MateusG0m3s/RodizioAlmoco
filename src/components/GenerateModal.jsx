import React, { useState } from 'react';
import { Sparkles, X, Calendar, RefreshCw, ShieldCheck, ArrowRight, Shuffle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { generateAutoSchedule } from '../utils/scheduler';
import { getWorkDaysOfWeek } from '../utils/timeUtils';

export default function GenerateModal({
  isOpen,
  onClose,
  employees,
  settings,
  currentDate,
  onApplySchedule,
  onApplyWeekSchedule
}) {
  if (!isOpen) return null;

  const [mode, setMode] = useState('today');
  const [rotationSeed, setRotationSeed] = useState(() => Math.floor(Math.random() * 5) + 1);
  const activeEmployees = employees.filter((e) => e.active);

  // Calcula a prévia para hoje usando a semente de rotação
  const previewToday = generateAutoSchedule({
    employees,
    date: currentDate,
    settings,
    rotationIndex: rotationSeed
  });

  const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));

  const handleShuffle = () => {
    setRotationSeed((prev) => prev + 1);
  };

  const handleConfirm = () => {
    if (mode === 'today') {
      onApplySchedule(currentDate, previewToday);
    } else {
      const workdays = getWorkDaysOfWeek(currentDate);
      const weekSchedules = {};
      workdays.forEach((day, index) => {
        weekSchedules[day.date] = generateAutoSchedule({
          employees,
          date: day.date,
          settings,
          dayOffset: index,
          rotationIndex: rotationSeed + index
        });
      });
      onApplyWeekSchedule(weekSchedules);
    }

    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#2D0C5E', '#7c3aed', '#0284c7', '#38bdf8']
      });
    } catch (e) {
      // Ignora erro de confetti
    }

    onClose();
  };

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose}>
      <div className="modal-card animate-scale-up modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="sparkle-icon-box">
              <Sparkles size={20} className="text-scada-cyan" />
            </div>
            <div>
              <h3 className="modal-title">Gerador Inteligente scadahub</h3>
              <span className="modal-subtitle">
                Garante atendimento contínuo aos clientes (11:30h — 13:30h)
              </span>
            </div>
          </div>
          <button className="btn-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body-pad">
          {/* Seletor de Escopo com Botões Redondos scadahub */}
          <div className="generate-mode-selector">
            <button
              type="button"
              className={`mode-btn ${mode === 'today' ? 'active' : ''}`}
              onClick={() => setMode('today')}
            >
              <Calendar size={16} />
              <span>Gerar para Hoje</span>
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === 'week' ? 'active' : ''}`}
              onClick={() => setMode('week')}
            >
              <RefreshCw size={16} />
              <span>Gerar Semana Inteira (Seg a Sex)</span>
            </button>
          </div>

          {/* Destaque da Regra Crítica scadahub */}
          <div className="generator-rules-pill scadahub-pill">
            <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
            <span>
              <strong>Atendimento Garantido:</strong> Almoços organizados em turnos de revezamento. Sempre há colaboradores atendendo clientes entre <strong>11:30h e 13:30h</strong>.
            </span>
          </div>

          {/* Pré-visualização da Distribuição */}
          <div className="preview-schedule-box">
            <div className="preview-header">
              <span className="preview-title">
                {mode === 'today' ? 'Prévia da Escala de Hoje' : 'Prévia dos Turnos da Semana'}
              </span>
              <button
                type="button"
                className="btn-shuffle-pills"
                onClick={handleShuffle}
                title="Sortear outra combinação de duplas"
              >
                <Shuffle size={13} />
                <span>Girar / Alternar Duplas</span>
              </button>
            </div>

            <div className="preview-slots-list">
              {previewToday.map((slot) => {
                const emp = empMap[slot.employeeId];
                return (
                  <div key={slot.employeeId} className="preview-slot-item">
                    <div
                      className="preview-emp-avatar"
                      style={{ backgroundColor: emp?.color || '#381267' }}
                    >
                      {emp?.avatar || emp?.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="preview-emp-name">{emp?.name}</span>
                    <ArrowRight size={14} className="text-slate-400" />
                    <span className="preview-slot-time">
                      <strong>{slot.startTime}</strong> — <strong>{slot.endTime}</strong>
                    </span>
                    <span className="preview-duration-tag">{slot.duration} min</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={handleConfirm}>
            <Sparkles size={16} />
            <span>{mode === 'today' ? 'Aplicar ao Dia de Hoje' : 'Aplicar à Semana Inteira'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

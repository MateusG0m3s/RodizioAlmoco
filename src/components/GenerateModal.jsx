import React, { useState } from 'react';
import { Sparkles, X, Calendar, RefreshCw, ShieldCheck, ArrowRight, Shuffle, AlertTriangle } from 'lucide-react';
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
    if (previewToday.success === false) {
      return;
    }

    if (mode === 'today') {
      onApplySchedule(currentDate, previewToday);
    } else {
      const workdays = getWorkDaysOfWeek(currentDate);
      const weekSchedules = {};
      let hasError = false;

      workdays.forEach((day, index) => {
        const dayGen = generateAutoSchedule({
          employees,
          date: day.date,
          settings,
          dayOffset: index,
          rotationIndex: rotationSeed + index
        });
        if (dayGen.success === false) {
          hasError = true;
        }
        weekSchedules[day.date] = dayGen;
      });

      if (hasError) {
        return;
      }
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
                Garante atendimento contínuo aos clientes ({settings.criticalStart || '11:30'}h — {settings.criticalEnd || '13:30'}h)
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
              <strong>Atendimento Garantido:</strong> Almoços organizados em turnos de revezamento. Sempre há no mínimo <strong>{settings.minWorkingDuringCritical || 1} atendente(s)</strong> atendendo clientes entre <strong>{settings.criticalStart || '11:30'}h e {settings.criticalEnd || '13:30'}h</strong>.
            </span>
          </div>

          {/* Aviso se a geração for impossível com as regras atuais */}
          {previewToday.success === false && (
            <div className="conflict-alert-box animate-shake" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--conflict-bg)', border: '1px solid var(--conflict-border)', padding: '12px 16px', borderRadius: 'var(--radius-md)', color: 'var(--conflict-text)', marginTop: '10px' }}>
              <AlertTriangle size={18} className="text-rose-500 shrink-0" />
              <div style={{ fontSize: '0.84rem' }}>
                <strong>Impossível Gerar:</strong> {previewToday.error}
              </div>
            </div>
          )}

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
          <button
            type="button"
            className="btn-primary"
            onClick={handleConfirm}
            disabled={previewToday.success === false}
            style={{ opacity: previewToday.success === false ? 0.5 : 1, cursor: previewToday.success === false ? 'not-allowed' : 'pointer' }}
          >
            <Sparkles size={16} />
            <span>{mode === 'today' ? 'Aplicar ao Dia de Hoje' : 'Aplicar à Semana Inteira'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

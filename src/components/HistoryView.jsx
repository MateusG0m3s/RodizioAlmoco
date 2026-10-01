import React from 'react';
import { BarChart3, TrendingUp, Sparkles, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { calculateBalanceMetrics } from '../utils/scheduler';

export default function HistoryView({ employees, allSchedules, historyData, onOpenGenerateModal }) {
  const { employeeStats, balanceScore, balanceStatus, balanceBadgeClass, bands } =
    calculateBalanceMetrics(employees, allSchedules, historyData);

  return (
    <div className="history-view-container animate-fade-in">
      {/* Topo da Seção */}
      <div className="history-header-bar">
        <div className="history-title-group">
          <BarChart3 size={22} className="text-primary-500" />
          <div>
            <h2 className="history-main-title">Histórico & Análise de Equilíbrio</h2>
            <p className="history-sub-title">
              Distribuição justa dos horários para evitar que a mesma pessoa fique sempre cedo ou tarde
            </p>
          </div>
        </div>

        <div className="history-actions-group" style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {onOpenGenerateModal && (
            <button
              type="button"
              className="btn-primary"
              onClick={onOpenGenerateModal}
              title="Abre o gerador para recalcular e equilibrar a distribuição de turnos"
            >
              <Sparkles size={16} />
              <span>Ajustar Rotação</span>
            </button>
          )}

          {/* Card do Índice Geral de Equilíbrio */}
          <div className="balance-score-card">
            <div className="balance-score-header">
              <Sparkles size={16} className="text-amber-500" />
              <span className="balance-score-tag">Índice de Justiça</span>
            </div>
            <div className="balance-score-number">{balanceScore}%</div>
            <span className={`balance-status-pill ${balanceBadgeClass}`}>
              {balanceStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Explicação da Faixas */}
      <div className="bands-info-banner">
        <div className="band-chip">
          <span className="dot-band dot-early" />
          <span><strong>11h — 12h:</strong> Almoço Cedo</span>
        </div>
        <div className="band-chip">
          <span className="dot-band dot-mid" />
          <span><strong>12h — 13h:</strong> Almoço Intermediário (Pico)</span>
        </div>
        <div className="band-chip">
          <span className="dot-band dot-late" />
          <span><strong>13h — 14h:</strong> Almoço Tardio</span>
        </div>
      </div>

      {/* Tabela do Histórico */}
      <div className="history-table-card">
        <div className="history-card-header">
          <h3 className="history-table-title">Distribuição por Faixa de Horário</h3>
          <span className="text-xs text-slate-500">
            Base acumulada de escalas anteriores e atuais
          </span>
        </div>

        <div className="table-responsive">
          <table className="history-data-table">
            <thead>
              <tr>
                <th className="th-emp">Funcionário</th>
                <th className="th-band">11h – 12h (Cedo)</th>
                <th className="th-band">12h – 13h (Meio)</th>
                <th className="th-band">13h – 14h (Tarde)</th>
                <th className="th-total">Total</th>
                <th className="th-distribution">Visualização da Proporção</th>
              </tr>
            </thead>
            <tbody>
              {employeeStats.map(({ employee, counts, total }) => {
                const pEarly = total > 0 ? (counts['11h-12h'] / total) * 100 : 33;
                const pMid = total > 0 ? (counts['12h-13h'] / total) * 100 : 34;
                const pLate = total > 0 ? (counts['13h-14h'] / total) * 100 : 33;

                return (
                  <tr key={employee.id} className={!employee.active ? 'tr-inactive' : ''}>
                    <td className="td-emp-profile">
                      <div className="history-emp-cell">
                        <div
                          className="history-avatar"
                          style={{
                            backgroundColor: employee.color || '#381267',
                            width: '36px',
                            height: '36px',
                            minWidth: '36px',
                            minHeight: '36px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            flexShrink: 0
                          }}
                        >
                          {employee.avatar || employee.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="history-emp-name">{employee.name}</span>
                          {!employee.active && (
                            <span className="badge-inactive-sub">Inativo</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="td-count count-early">
                      <span className="count-badge early">{counts['11h-12h']}</span>
                    </td>
                    <td className="td-count count-mid">
                      <span className="count-badge mid">{counts['12h-13h']}</span>
                    </td>
                    <td className="td-count count-late">
                      <span className="count-badge late">{counts['13h-14h']}</span>
                    </td>

                    <td className="td-total">
                      <strong>{total}</strong>
                    </td>

                    {/* Barra de Proporção Visual */}
                    <td className="td-proportion">
                      <div className="proportion-bar" title={`Cedo: ${Math.round(pEarly)}% | Meio: ${Math.round(pMid)}% | Tarde: ${Math.round(pLate)}%`}>
                        <div
                          className="prop-segment seg-early"
                          style={{ width: `${pEarly}%` }}
                        />
                        <div
                          className="prop-segment seg-mid"
                          style={{ width: `${pMid}%` }}
                        />
                        <div
                          className="prop-segment seg-late"
                          style={{ width: `${pLate}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dicas e Conclusão do Algoritmo */}
      <div className="balance-insight-card">
        <div className="insight-icon">
          <Info size={18} className="text-primary-500" />
        </div>
        <div className="insight-text">
          <h4>Como o equilíbrio é mantido?</h4>
          <p>
            O gerador automático prioriza funcionários com menor contagem nas faixas desejadas ao montar as próximas semanas. Isso garante que ninguém passe mais de duas semanas seguidas no primeiro ou no último turno de almoço.
          </p>
        </div>
      </div>
    </div>
  );
}

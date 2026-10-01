import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Sparkles } from 'lucide-react';
import Navbar from './components/Navbar';
import TimeSimulatorBar from './components/TimeSimulatorBar';
import DashboardView from './components/DashboardView';
import WeekView from './components/WeekView';
import TeamView from './components/TeamView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import EditSlotModal from './components/EditSlotModal';
import GenerateModal from './components/GenerateModal';
import { storageService } from './services/storageService';
import { firebaseService } from './services/firebaseService';
import { toISODateString, timeToMinutes, getWorkDaysOfWeek } from './utils/timeUtils';
import { detectConflicts, calculateBalanceMetrics, checkAttendanceCoverage, generateAutoSchedule } from './utils/scheduler';

export default function App() {
  const [currentDate, setCurrentDate] = useState(() => {
    return toISODateString(new Date());
  });

  const [activeTab, setActiveTab] = useState('dashboard');

  const [employees, setEmployees] = useState(() => storageService.getEmployees());
  const [allSchedules, setAllSchedules] = useState(() => storageService.getAllSchedules());
  const [settings, setSettings] = useState(() => storageService.getSettings());
  const [historyData, setHistoryData] = useState(() => storageService.getHistory());
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  const getNowMinutes = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };

  const [systemTimeMinutes, setSystemTimeMinutes] = useState(getNowMinutes);
  const [isSimulatingTime, setIsSimulatingTime] = useState(false);
  const [simulatedMinutes, setSimulatedMinutes] = useState(12 * 60 + 0); // Ex: 12:00

  // Atualização periódica do relógio
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemTimeMinutes(getNowMinutes());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Assinatura em tempo real do Firebase (recebe atualizações de outros usuários)
  useEffect(() => {
    const unsubscribe = firebaseService.subscribe({
      onSchedules: (cloudSchedules) => {
        if (cloudSchedules && typeof cloudSchedules === 'object') {
          setAllSchedules(cloudSchedules);
          storageService.saveAllSchedules(cloudSchedules);
        }
      },
      onEmployees: (cloudEmployees) => {
        if (Array.isArray(cloudEmployees) && cloudEmployees.length > 0) {
          setEmployees(cloudEmployees);
          storageService.saveEmployees(cloudEmployees);
        }
      },
      onSettings: (cloudSettings) => {
        if (cloudSettings && typeof cloudSettings === 'object') {
          setSettings(cloudSettings);
          storageService.saveSettings(cloudSettings);
        }
      },
      onConnectionStatus: (connected) => {
        setIsCloudConnected(connected);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const currentTimeMinutes = isSimulatingTime ? simulatedMinutes : systemTimeMinutes;

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingTargetDate, setEditingTargetDate] = useState(currentDate);

  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [rotationSeed, setRotationSeed] = useState(() => Math.floor(Math.random() * 10) + 1);
  const [toastNotification, setToastNotification] = useState(null);

  const showToast = (message, title = 'Sucesso!') => {
    setToastNotification({ title, message });
    setTimeout(() => {
      setToastNotification(null);
    }, 4500);
  };

  const handleQuickGenerateToday = () => {
    const nextSeed = rotationSeed + 1;
    setRotationSeed(nextSeed);

    const newSlots = generateAutoSchedule({
      employees,
      date: currentDate,
      settings,
      rotationIndex: nextSeed
    });

    handleApplyGeneratedSchedule(currentDate, newSlots);

    try {
      confetti({
        particleCount: 85,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#2D0C5E', '#7c3aed', '#0284c7', '#38bdf8']
      });
    } catch (e) {}

    showToast(
      'Turnos de hoje alternados com sucesso! 100% de cobertura no atendimento ao cliente (11:30h — 13:30h).',
      'Rodízio Gerado!'
    );
  };

  const handleQuickGenerateWeek = () => {
    const nextSeed = rotationSeed + 1;
    setRotationSeed(nextSeed);

    const workdays = getWorkDaysOfWeek(currentDate);
    const weekMap = {};
    workdays.forEach((day, index) => {
      weekMap[day.date] = generateAutoSchedule({
        employees,
        date: day.date,
        settings,
        dayOffset: index,
        rotationIndex: nextSeed + index
      });
    });

    handleApplyWeekSchedule(weekMap);

    try {
      confetti({
        particleCount: 110,
        spread: 85,
        origin: { y: 0.6 },
        colors: ['#2D0C5E', '#7c3aed', '#0284c7', '#38bdf8']
      });
    } catch (e) {}

    showToast(
      'Escala da semana inteira gerada com sucesso com turnos distribuídos e atendimento ininterrupto!',
      'Escala Semanal Gerada!'
    );
  };

  const currentDaySlots = allSchedules[currentDate] || [];

  // Validação de Cobertura de Atendimento (11:30 - 13:30)
  const coverageReport = checkAttendanceCoverage(employees, currentDaySlots, settings);
  const conflictReport = detectConflicts(currentDaySlots, settings, employees);

  // Métricas de Equilíbrio
  const balanceInfo = calculateBalanceMetrics(employees, allSchedules, historyData);

  const handleSaveSlot = (slotData) => {
    const targetDate = slotData.date || currentDate;
    const dayList = allSchedules[targetDate] || [];
    const index = dayList.findIndex(
      (s) => s.id === slotData.id || s.employeeId === slotData.employeeId
    );

    let updatedDayList;
    if (index >= 0) {
      updatedDayList = [...dayList];
      updatedDayList[index] = slotData;
    } else {
      updatedDayList = [...dayList, slotData];
    }

    const updatedAll = { ...allSchedules, [targetDate]: updatedDayList };
    setAllSchedules(updatedAll);
    storageService.saveAllSchedules(updatedAll);
    firebaseService.pushDaySchedule(targetDate, updatedDayList);
  };

  const handleDeleteSlot = (slotId) => {
    const targetDate = editingTargetDate || currentDate;
    const dayList = allSchedules[targetDate] || [];
    const updatedDayList = dayList.filter((s) => s.id !== slotId);

    const updatedAll = { ...allSchedules, [targetDate]: updatedDayList };
    setAllSchedules(updatedAll);
    storageService.saveAllSchedules(updatedAll);
    firebaseService.pushDaySchedule(targetDate, updatedDayList);
  };

  const handleUpdateSlotTimes = (slotId, newStartTime, newEndTime) => {
    const dayList = allSchedules[currentDate] || [];
    const updatedDayList = dayList.map((slot) => {
      if (slot.id === slotId) {
        return {
          ...slot,
          startTime: newStartTime,
          endTime: newEndTime,
          duration: timeToMinutes(newEndTime) - timeToMinutes(newStartTime)
        };
      }
      return slot;
    });

    const updatedAll = { ...allSchedules, [currentDate]: updatedDayList };
    setAllSchedules(updatedAll);
    storageService.saveAllSchedules(updatedAll);
    firebaseService.pushDaySchedule(currentDate, updatedDayList);
  };

  const handleApplyGeneratedSchedule = (dateStr, slots) => {
    const updatedAll = { ...allSchedules, [dateStr]: slots };
    setAllSchedules(updatedAll);
    storageService.saveAllSchedules(updatedAll);
    firebaseService.pushDaySchedule(dateStr, slots);
  };

  const handleApplyWeekSchedule = (weekSchedulesMap) => {
    const updatedAll = { ...allSchedules, ...weekSchedulesMap };
    setAllSchedules(updatedAll);
    storageService.saveAllSchedules(updatedAll);
    firebaseService.pushAllSchedules(updatedAll);
  };

  const handleSaveEmployee = (empData) => {
    const index = employees.findIndex((e) => e.id === empData.id);
    let updated;
    if (index >= 0) {
      updated = [...employees];
      updated[index] = empData;
    } else {
      updated = [...employees, empData];
    }
    setEmployees(updated);
    storageService.saveEmployees(updated);
    firebaseService.pushEmployees(updated);
  };

  const handleDeleteEmployee = (empId) => {
    const updated = employees.filter((e) => e.id !== empId);
    setEmployees(updated);
    storageService.saveEmployees(updated);
    firebaseService.pushEmployees(updated);
  };

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    storageService.saveSettings(newSettings);
    firebaseService.pushSettings(newSettings);
  };

  const handleReloadAll = () => {
    setEmployees(storageService.getEmployees());
    setAllSchedules(storageService.getAllSchedules());
    setSettings(storageService.getSettings());
    setHistoryData(storageService.getHistory());
  };

  const handleOpenEditModal = (slot, employee, targetDate = currentDate) => {
    setEditingSlot(slot);
    setEditingEmployee(employee);
    setEditingTargetDate(targetDate);
    setIsEditModalOpen(true);
  };

  const handleAddSlotForEmployee = (employee, targetDate = currentDate) => {
    setEditingSlot(null);
    setEditingEmployee(employee);
    setEditingTargetDate(targetDate);
    setIsEditModalOpen(true);
  };

  return (
    <div className="app-container">
      {/* Navbar com Logo Oficial scadahub */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentTimeMinutes={currentTimeMinutes}
        isSimulatingTime={isSimulatingTime}
        setIsSimulatingTime={setIsSimulatingTime}
        setSimulatedMinutes={setSimulatedMinutes}
        systemTimeMinutes={systemTimeMinutes}
        isCloudConnected={isCloudConnected}
      />

      {/* Simulador de Horário Interativo */}
      <TimeSimulatorBar
        isSimulating={isSimulatingTime}
        onClose={() => setIsSimulatingTime(false)}
        currentTimeMinutes={simulatedMinutes}
        onChangeTime={setSimulatedMinutes}
        onReset={() => {
          setIsSimulatingTime(false);
          setSimulatedMinutes(systemTimeMinutes);
        }}
      />

      {/* Conteúdo Principal */}
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <DashboardView
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            employees={employees}
            daySlots={currentDaySlots}
            settings={settings}
            currentTimeMinutes={currentTimeMinutes}
            conflictSlotIds={conflictReport.conflictSlotIds}
            hasConflicts={conflictReport.hasConflicts}
            coverage={coverageReport}
            balanceStatus={balanceInfo.balanceStatus}
            balanceScore={balanceInfo.balanceScore}
            onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
            onQuickGenerateToday={handleQuickGenerateToday}
            onOpenEditModal={(slot, emp) => handleOpenEditModal(slot, emp, currentDate)}
            onAddSlotForEmployee={(emp) => handleAddSlotForEmployee(emp, currentDate)}
            onUpdateSlotTimes={handleUpdateSlotTimes}
          />
        )}

        {activeTab === 'week' && (
          <WeekView
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            employees={employees}
            allSchedules={allSchedules}
            onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
            onQuickGenerateWeek={handleQuickGenerateWeek}
            onOpenEditModal={(slot, emp, dateStr) => handleOpenEditModal(slot, emp, dateStr)}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'team' && (
          <TeamView
            employees={employees}
            onSaveEmployee={handleSaveEmployee}
            onDeleteEmployee={handleDeleteEmployee}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            employees={employees}
            allSchedules={allSchedules}
            historyData={historyData}
            onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onResetAllData={storageService.resetAllData}
            onReloadData={handleReloadAll}
            isCloudConnected={isCloudConnected}
            onSyncAllToCloud={async () => {
              await firebaseService.pushEmployees(employees);
              await firebaseService.pushAllSchedules(allSchedules);
              await firebaseService.pushSettings(settings);
              showToast(
                'Lista da equipe, regras e escalas foram enviadas com sucesso para a Nuvem!',
                'Nuvem Sincronizada'
              );
            }}
          />
        )}
      </main>

      {/* Modal de Edição Manual */}
      <EditSlotModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        slot={editingSlot}
        employee={editingEmployee}
        employees={employees}
        daySlots={allSchedules[editingTargetDate] || []}
        settings={settings}
        date={editingTargetDate}
        onSave={handleSaveSlot}
        onDelete={handleDeleteSlot}
      />

      {/* Modal do Gerador scadahub */}
      <GenerateModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        employees={employees}
        settings={settings}
        currentDate={currentDate}
        onApplySchedule={handleApplyGeneratedSchedule}
        onApplyWeekSchedule={handleApplyWeekSchedule}
      />

      {/* Rodapé EF - Mateus Silva */}
      <footer className="scadahub-footer">
        <div className="footer-container" style={{ justifyContent: 'center' }}>
          <span className="footer-author-brand" style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
            EF - Mateus Silva
          </span>
        </div>
      </footer>

      {/* Toast Flutuante de Confirmação Instantânea */}
      {toastNotification && (
        <div
          className="scadahub-floating-toast animate-scale-up"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#240a42',
            color: '#ffffff',
            padding: '14px 22px',
            borderRadius: '9999px',
            boxShadow: '0 10px 25px rgba(36, 10, 66, 0.45)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 9999,
            border: '1.5px solid #7c3aed',
            maxWidth: '90vw'
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(2, 132, 199, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Sparkles size={18} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#ffffff' }}>
              {toastNotification.title}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#e0f2fe' }}>
              {toastNotification.message}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

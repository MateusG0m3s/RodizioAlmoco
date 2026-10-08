import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles } from 'lucide-react';
import Navbar from './components/Navbar';
import TimeSimulatorBar from './components/TimeSimulatorBar';
import DashboardView from './components/DashboardView';
import WeekView from './components/WeekView';
import TeamView from './components/TeamView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import EditSlotModal from './components/EditSlotModal';
import GenerateModal from './components/GenerateModal';
import AuthModal from './components/AuthModal';
import LoginScreen from './components/LoginScreen';
import { storageService } from './services/storageService';
import { firebaseService } from './services/firebaseService';
import { authService } from './services/authService';
import { toISODateString, timeToMinutes, getWorkDaysOfWeek } from './utils/timeUtils';
import { detectConflicts, calculateBalanceMetrics, checkAttendanceCoverage, generateAutoSchedule, ensureArray } from './utils/scheduler';
import { getUserSoundPreference, setUserSoundPreference, playLunchNotificationSound, shouldTriggerLunchAlert } from './services/soundService';

export default function App() {
  const [currentDate, setCurrentDate] = useState(() => {
    return toISODateString(new Date());
  });

  const [activeTab, setActiveTab] = useState('dashboard');

  const [employees, setEmployees] = useState(() => ensureArray(storageService.getEmployees()));
  const [allSchedules, setAllSchedules] = useState(() => {
    const raw = storageService.getAllSchedules() || {};
    const normalized = {};
    Object.keys(raw).forEach((k) => {
      normalized[k] = ensureArray(raw[k]);
    });
    return normalized;
  });
  const [settings, setSettings] = useState(() => storageService.getSettings());
  const [historyData, setHistoryData] = useState(() => storageService.getHistory());
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  // Estados de Autenticação e RBAC
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  const [isAuthLoading, setIsAuthLoading] = useState(() => authService.isLoading());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const isAdmin = Boolean(currentUser && currentUser.role === 'admin');
  const currentUserEmployeeId = useMemo(() => {
    if (currentUser?.employeeId) return currentUser.employeeId;
    if (currentUser?.email && employees?.length > 0) {
      const match = employees.find(
        (e) => e.email && e.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase()
      );
      if (match) return match.id;
    }
    return null;
  }, [currentUser, employees]);

  const [toastNotification, setToastNotification] = useState(null);

  const showToast = (message, title = 'Sucesso!') => {
    setToastNotification({ title, message });
    setTimeout(() => {
      setToastNotification(null);
    }, 4500);
  };

  useEffect(() => {
    const unsubscribeAuth = authService.subscribe((u, loading) => {
      setCurrentUser(u);
      setIsAuthLoading(loading);
    });
    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  const handleSelectTab = (tab) => {
    if (tab === 'settings' && !isAdmin) {
      showToast('Acesso restrito: A aba Configurações é exclusiva para Administradores.', 'Acesso Negado');
      return;
    }
    setActiveTab(tab);
  };

  const effectiveTab = (!isAdmin && activeTab === 'settings') ? 'dashboard' : activeTab;

  // Modo Escuro / Claro personalizado por usuário (salvo no navegador)
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('scadahub_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('scadahub_theme', theme);
    } catch {
      // Ignora erro de storage
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Notificações sonoras individuais por usuário (salvas no localStorage do navegador)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return getUserSoundPreference(authService.getCurrentUser());
  });

  // Sincroniza a preferência sonora quando o usuário logado mudar (login/logout/troca de perfil)
  useEffect(() => {
    setSoundEnabled(getUserSoundPreference(currentUser));
  }, [currentUser?.email, currentUser?.uid, currentUser?.employeeId]);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      setUserSoundPreference(currentUser, next);
      return next;
    });
  };

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

  // Assinatura em tempo real do Firebase (sempre ativa para sincronizar equipe, configurações e escalas mesmo na tela de login)
  useEffect(() => {
    const unsubscribe = firebaseService.subscribe({
      onSchedules: (cloudSchedules) => {
        if (cloudSchedules && typeof cloudSchedules === 'object') {
          const normalized = {};
          Object.keys(cloudSchedules).forEach((key) => {
            normalized[key] = ensureArray(cloudSchedules[key]);
          });
          setAllSchedules(normalized);
          storageService.saveAllSchedules(normalized);
        }
      },
      onEmployees: (cloudEmployees) => {
        const arr = ensureArray(cloudEmployees);
        if (arr.length > 0) {
          setEmployees(arr);
          storageService.saveEmployees(arr);
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
      setIsCloudConnected(false);
    };
  }, []);

  const currentTimeMinutes = isSimulatingTime ? simulatedMinutes : systemTimeMinutes;

  // Disparo de notificação sonora pontual nos marcos de 10, 5 e 1 minuto antes do almoço
  const lastActiveAlertKeyRef = useRef(null);

  useEffect(() => {
    // Alarme sonoro restrito exclusivamente ao próprio colaborador autenticado
    if (!currentUserEmployeeId) {
      lastActiveAlertKeyRef.current = null;
      return;
    }

    const todayStr = toISODateString(new Date());
    const activeDate = currentDate || todayStr;
    const slots = ensureArray(allSchedules[activeDate]);
    if (slots.length === 0) {
      lastActiveAlertKeyRef.current = null;
      return;
    }

    // Apenas os slots de almoço vinculados ao próprio colaborador logado
    const ownSlots = slots.filter((s) => s.employeeId === currentUserEmployeeId);

    if (ownSlots.length === 0) {
      lastActiveAlertKeyRef.current = null;
      return;
    }

    // Verifica se algum dos slots do próprio usuário atingiu os marcos de 10, 5 ou 1 minuto
    let matchingSlot = null;
    let matchingRemaining = null;

    for (const slot of ownSlots) {
      const startMin = timeToMinutes(slot.startTime);
      const remaining = startMin - currentTimeMinutes;
      if (shouldTriggerLunchAlert(remaining)) {
        matchingSlot = slot;
        matchingRemaining = remaining;
        break;
      }
    }

    if (matchingSlot && matchingRemaining !== null) {
      const alertOccurrenceKey = `${activeDate}_${matchingSlot.id || matchingSlot.employeeId}_${matchingSlot.startTime}_${matchingRemaining}min`;
      if (lastActiveAlertKeyRef.current !== alertOccurrenceKey) {
        lastActiveAlertKeyRef.current = alertOccurrenceKey;
        if (soundEnabled) {
          playLunchNotificationSound();
          console.info(`[Notificação Almoço] Alerta sonoro disparado para o seu horário: ${matchingRemaining} min antes (${matchingSlot.startTime})`);
        }
      }
    } else {
      // Quando o horário sair do marco (ex: usuário recuou o ponteiro no simulador ou tempo avançou),
      // desarma o alerta para tocar novamente caso o marco seja atingido de novo
      lastActiveAlertKeyRef.current = null;
    }
  }, [currentTimeMinutes, currentDate, allSchedules, currentUserEmployeeId, soundEnabled]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editingTargetDate, setEditingTargetDate] = useState(currentDate);

  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [rotationSeed, setRotationSeed] = useState(() => Math.floor(Math.random() * 10) + 1);

  // Geração rápida para hoje (Exclusivo Administrador)
  const handleQuickGenerateToday = () => {
    if (!isAdmin) {
      showToast('Apenas administradores podem executar geração automática de escalas.', 'Acesso Negado');
      return;
    }

    const nextSeed = rotationSeed + 1;
    setRotationSeed(nextSeed);

    const newSlots = generateAutoSchedule({
      employees,
      date: currentDate,
      settings,
      rotationIndex: nextSeed
    });

    if (newSlots.success === false) {
      showToast(newSlots.error || 'Não foi possível gerar a escala para hoje sem ferir a regra de atendimento.', 'Conflito de Regras');
      return;
    }

    handleApplyGeneratedSchedule(currentDate, newSlots);

    try {
      confetti({
        particleCount: 85,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#2D0C5E', '#7c3aed', '#0284c7', '#38bdf8']
      });
    } catch {
      // Ignora erro de confetti
    }

    showToast(
      `Turnos de hoje alternados com sucesso! 100% de cobertura no atendimento ao cliente (${settings.criticalStart || '11:30'}h — ${settings.criticalEnd || '13:30'}h).`,
      'Rodízio Gerado!'
    );
  };

  // Geração rápida para a semana (Exclusivo Administrador)
  const handleQuickGenerateWeek = () => {
    if (!isAdmin) {
      showToast('Apenas administradores podem executar geração de escalas da semana.', 'Acesso Negado');
      return;
    }

    const nextSeed = rotationSeed + 1;
    setRotationSeed(nextSeed);

    const workdays = getWorkDaysOfWeek(currentDate);
    const weekMap = {};
    let hasFailure = false;
    let failureMsg = '';

    workdays.forEach((day, index) => {
      const daySlots = generateAutoSchedule({
        employees,
        date: day.date,
        settings,
        dayOffset: index,
        rotationIndex: nextSeed + index
      });
      if (daySlots.success === false) {
        hasFailure = true;
        failureMsg = daySlots.error;
      }
      weekMap[day.date] = daySlots;
    });

    if (hasFailure) {
      showToast(failureMsg || 'Não foi possível gerar a semana com 100% de cobertura.', 'Conflito de Regras');
      return;
    }

    handleApplyWeekSchedule(weekMap);

    try {
      confetti({
        particleCount: 110,
        spread: 85,
        origin: { y: 0.6 },
        colors: ['#2D0C5E', '#7c3aed', '#0284c7', '#38bdf8']
      });
    } catch {
      // Ignora erro de confetti
    }

    showToast(
      `Escala semanal gerada com sucesso com turnos distribuídos e atendimento ininterrupto (${settings.criticalStart || '11:30'}h — ${settings.criticalEnd || '13:30'}h)!`,
      'Escala Semanal Gerada!'
    );
  };

  const currentDaySlots = ensureArray(allSchedules[currentDate]);

  // Validação de Cobertura de Atendimento (11:30 - 13:30)
  const coverageReport = checkAttendanceCoverage(employees, currentDaySlots, settings);
  const conflictReport = detectConflicts(currentDaySlots, settings, employees);

  // Métricas de Equilíbrio
  const balanceInfo = calculateBalanceMetrics(employees, allSchedules, historyData);

  // Salvar Slot com Validação de Autorização por Propriedade da Escala
  const handleSaveSlot = (slotData) => {
    const targetDate = slotData.date || currentDate;
    const canEditThis = isAdmin || (slotData && slotData.employeeId === currentUserEmployeeId);

    if (!canEditThis) {
      showToast('Acesso negado: Você só pode modificar a sua própria escala.', 'Permissão Negada');
      return;
    }

    const dur = slotData.duration || (timeToMinutes(slotData.endTime) - timeToMinutes(slotData.startTime));
    if (dur < 30 || dur > 120) {
      showToast('O intervalo de almoço deve ser de no mínimo 30 minutos e no máximo 2 horas.', 'Horário Inválido');
      return;
    }

    const dayList = ensureArray(allSchedules[targetDate]);
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

    // Gravação granular (apenas o slot alterado) para nunca sobrescrever horários de outros colaboradores
    firebaseService.pushSlot(targetDate, slotData);
  };

  // Excluir Slot com Validação de Autorização por Propriedade da Escala
  const handleDeleteSlot = (slotId) => {
    const targetDate = editingTargetDate || currentDate;
    const dayList = ensureArray(allSchedules[targetDate]);
    const slotToDelete = dayList.find((s) => s.id === slotId);

    const canDeleteThis = isAdmin || (slotToDelete && slotToDelete.employeeId === currentUserEmployeeId);
    if (!canDeleteThis) {
      showToast('Acesso negado: Você não pode remover o horário de outro colaborador.', 'Permissão Negada');
      return;
    }

    const updatedDayList = dayList.filter((s) => s.id !== slotId);
    const updatedAll = { ...allSchedules, [targetDate]: updatedDayList };
    setAllSchedules(updatedAll);
    storageService.saveAllSchedules(updatedAll);

    // Remoção granular (apenas o slot excluído)
    firebaseService.deleteSlot(targetDate, slotId);
  };

  // Atualizar Horários via Arraste (Timeline)
  const handleUpdateSlotTimes = (slotId, newStartTime, newEndTime) => {
    const dayList = ensureArray(allSchedules[currentDate]);
    const targetSlot = dayList.find((s) => s.id === slotId);

    const canUpdateThis = isAdmin || (targetSlot && targetSlot.employeeId === currentUserEmployeeId);
    if (!canUpdateThis) {
      showToast('Acesso negado: Você só pode reposicionar a sua própria escala.', 'Permissão Negada');
      return;
    }

    const dur = timeToMinutes(newEndTime) - timeToMinutes(newStartTime);
    if (dur < 30 || dur > 120) {
      showToast('O intervalo de almoço deve ser de no mínimo 30 minutos e no máximo 2 horas.', 'Horário Inválido');
      return;
    }

    let modifiedSlot = null;
    const updatedDayList = dayList.map((slot) => {
      if (slot.id === slotId) {
        modifiedSlot = {
          ...slot,
          startTime: newStartTime,
          endTime: newEndTime,
          duration: timeToMinutes(newEndTime) - timeToMinutes(newStartTime)
        };
        return modifiedSlot;
      }
      return slot;
    });

    const updatedAll = { ...allSchedules, [currentDate]: updatedDayList };
    setAllSchedules(updatedAll);
    storageService.saveAllSchedules(updatedAll);

    if (modifiedSlot) {
      firebaseService.pushSlot(currentDate, modifiedSlot);
    }
  };

  // Aplicação de escala gerada (Exclusivo Administrador)
  const handleApplyGeneratedSchedule = (dateStr, slots) => {
    if (!isAdmin) {
      showToast('Apenas administradores podem aplicar escalas automáticas.', 'Acesso Negado');
      return;
    }

    const safeList = ensureArray(slots);
    const updatedAll = { ...allSchedules, [dateStr]: safeList };
    setAllSchedules(updatedAll);
    storageService.saveAllSchedules(updatedAll);
    firebaseService.pushDaySchedule(dateStr, safeList);
  };

  // Aplicação de escala semanal (Exclusivo Administrador)
  const handleApplyWeekSchedule = (weekSchedulesMap) => {
    if (!isAdmin) {
      showToast('Apenas administradores podem aplicar escalas semanais completas.', 'Acesso Negado');
      return;
    }

    const normalizedWeek = {};
    Object.keys(weekSchedulesMap || {}).forEach((k) => {
      normalizedWeek[k] = ensureArray(weekSchedulesMap[k]);
    });
    const updatedAll = { ...allSchedules, ...normalizedWeek };
    setAllSchedules(updatedAll);
    storageService.saveAllSchedules(updatedAll);
    // Envia somente os dias gerados (não sobrescreve dias que outros colaboradores já ajustaram)
    Object.keys(normalizedWeek).forEach((dateKey) => {
      firebaseService.pushDaySchedule(dateKey, normalizedWeek[dateKey]);
    });
  };

  // Gerenciamento de Funcionários (Salvar com RBAC)
  const handleSaveEmployee = (empData) => {
    const isOwnEmployee = empData.id === currentUserEmployeeId;
    const isExisting = employees.some((e) => e.id === empData.id);

    if (!isAdmin && !isOwnEmployee) {
      showToast('Usuários normais só podem editar o seu próprio perfil.', 'Acesso Negado');
      return;
    }
    if (!isAdmin && !isExisting) {
      showToast('Apenas administradores podem cadastrar novos funcionários.', 'Acesso Negado');
      return;
    }

    const existingEmp = employees.find((e) => e.id === empData.id);
    const cleanEmail = (empData.email || '').trim().toLowerCase();
    const finalEmpData = {
      ...empData,
      email: isAdmin ? cleanEmail : (existingEmp?.email || cleanEmail || ''),
      role: isAdmin ? empData.role : (existingEmp?.role || empData.role),
      active: (isAdmin || isOwnEmployee) ? (empData.active !== false) : (existingEmp?.active !== false),
      initialPassword: 'shubadm'
    };

    if (cleanEmail) {
      try {
        // 1. Diretório persistente de contas autenticáveis
        const directory = JSON.parse(localStorage.getItem('scadahub_account_directory') || '{}');
        const isAdminEmp = finalEmpData.role?.toLowerCase().includes('admin') || finalEmpData.id === 'emp-2';
        directory[cleanEmail] = {
          uid: `user-${finalEmpData.id}`,
          email: cleanEmail,
          name: finalEmpData.name,
          employeeId: finalEmpData.id,
          role: isAdminEmp ? 'admin' : 'user',
          avatar: finalEmpData.avatar || finalEmpData.name.substring(0, 2).toUpperCase(),
          color: finalEmpData.color || '#7c3aed'
        };
        localStorage.setItem('scadahub_account_directory', JSON.stringify(directory));

        // 2. Senha inicial se ainda não alterada
        const customPasswords = JSON.parse(localStorage.getItem('scadahub_custom_passwords') || '{}');
        if (!customPasswords[cleanEmail]) {
          customPasswords[cleanEmail] = 'shubadm';
          localStorage.setItem('scadahub_custom_passwords', JSON.stringify(customPasswords));
        }
      } catch {
        // Ignora erro de storage local
      }
    }

    const index = employees.findIndex((e) => e.id === empData.id);
    let updated;
    if (index >= 0) {
      updated = [...employees];
      updated[index] = finalEmpData;
    } else {
      updated = [...employees, finalEmpData];
    }
    setEmployees(updated);
    storageService.saveEmployees(updated);

    // Gravação pontual do colaborador alterado (não substitui a lista inteira da equipe)
    firebaseService.pushEmployee(finalEmpData.id, finalEmpData);
  };

  // Excluir Funcionário (Exclusivo Administrador)
  const handleDeleteEmployee = (empId) => {
    if (!isAdmin) {
      showToast('Apenas administradores podem excluir funcionários.', 'Acesso Negado');
      return;
    }

    const updated = employees.filter((e) => e.id !== empId);
    setEmployees(updated);
    storageService.saveEmployees(updated);
    firebaseService.deleteEmployee(empId);

    // Remove slots do funcionário excluído de todos os dias
    const cleanedSchedules = {};
    Object.keys(allSchedules).forEach((dateKey) => {
      const dayList = ensureArray(allSchedules[dateKey]);
      cleanedSchedules[dateKey] = dayList.filter((s) => s.employeeId !== empId);
      dayList
        .filter((s) => s.employeeId === empId)
        .forEach((s) => firebaseService.deleteSlot(dateKey, s.id || s.employeeId));
    });
    setAllSchedules(cleanedSchedules);
    storageService.saveAllSchedules(cleanedSchedules);
  };

  // Salvar Configurações (Exclusivo Administrador)
  const handleSaveSettings = (newSettings) => {
    if (!isAdmin) {
      showToast('Apenas administradores podem modificar configurações e regras de atendimento.', 'Acesso Negado');
      return;
    }
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
    const canAdd = isAdmin || employee.id === currentUserEmployeeId;
    if (!canAdd) {
      showToast('Você só pode definir horários para a sua própria escala.', 'Permissão Negada');
      return;
    }
    setEditingSlot(null);
    setEditingEmployee(employee);
    setEditingTargetDate(targetDate);
    setIsEditModalOpen(true);
  };

  // 1. Estado de Verificação de Sessão do Firebase
  if (isAuthLoading) {
    return (
      <div className="auth-loading-screen animate-fade-in">
        <div className="auth-loading-card">
          <div className="scadahub-spinner" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Verificando sessão...
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: 0 }}>
            Validando identidade e permissões com o Firebase Authentication
          </p>
        </div>
      </div>
    );
  }

  // 2. Bloqueio Estrito: Usuário Não Autenticado vê APENAS a Tela de Login
  if (!currentUser) {
    return (
      <LoginScreen
        onLogin={async (email, password) => {
          const res = await authService.loginWithEmailAndPassword(email, password);
          if (res.success && res.user) {
            showToast(`Bem-vindo, ${res.user.name}!`, 'Login realizado');
          }
          return res;
        }}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Navbar com Logo Oficial, Perfil, RBAC e Logout */}
      <Navbar
        activeTab={effectiveTab}
        setActiveTab={handleSelectTab}
        currentTimeMinutes={currentTimeMinutes}
        isSimulatingTime={isSimulatingTime}
        setIsSimulatingTime={setIsSimulatingTime}
        setSimulatedMinutes={setSimulatedMinutes}
        systemTimeMinutes={systemTimeMinutes}
        isCloudConnected={isCloudConnected}
        theme={theme}
        toggleTheme={toggleTheme}
        soundEnabled={soundEnabled}
        toggleSound={toggleSound}
        currentUser={currentUser}
        isAdmin={isAdmin}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={async () => {
          await authService.logout();
          showToast('Sessão encerrada com sucesso.', 'Até logo!');
        }}
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

      {/* Conteúdo Principal com Autorização RBAC */}
      <main className="main-content">
        {effectiveTab === 'dashboard' && (
          <DashboardView
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            employees={employees}
            daySlots={currentDaySlots}
            settings={settings}
            currentTimeMinutes={currentTimeMinutes}
            conflictSlotIds={conflictReport.conflictSlotIds}
            _hasConflicts={conflictReport.hasConflicts}
            coverage={coverageReport}
            balanceStatus={balanceInfo.balanceStatus}
            balanceScore={balanceInfo.balanceScore}
            onOpenGenerateModal={() => isAdmin ? setIsGenerateModalOpen(true) : showToast('Apenas administradores podem acessar o gerador.', 'Acesso Negado')}
            onQuickGenerateToday={handleQuickGenerateToday}
            onOpenEditModal={(slot, emp) => handleOpenEditModal(slot, emp, currentDate)}
            onAddSlotForEmployee={(emp) => handleAddSlotForEmployee(emp, currentDate)}
            onUpdateSlotTimes={handleUpdateSlotTimes}
            isAdmin={isAdmin}
            currentUserEmployeeId={currentUserEmployeeId}
          />
        )}

        {effectiveTab === 'week' && (
          <WeekView
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            employees={employees}
            allSchedules={allSchedules}
            onOpenGenerateModal={() => isAdmin ? setIsGenerateModalOpen(true) : showToast('Apenas administradores podem acessar o gerador.', 'Acesso Negado')}
            onQuickGenerateWeek={handleQuickGenerateWeek}
            onOpenEditModal={(slot, emp, dateStr) => handleOpenEditModal(slot, emp, dateStr)}
            setActiveTab={handleSelectTab}
            isAdmin={isAdmin}
            currentUserEmployeeId={currentUserEmployeeId}
          />
        )}

        {effectiveTab === 'team' && (
          <TeamView
            employees={employees}
            onSaveEmployee={handleSaveEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            isAdmin={isAdmin}
            currentUserEmployeeId={currentUserEmployeeId}
          />
        )}

        {effectiveTab === 'history' && (
          <HistoryView
            employees={employees}
            allSchedules={allSchedules}
            historyData={historyData}
            onOpenGenerateModal={() => isAdmin ? setIsGenerateModalOpen(true) : showToast('Apenas administradores podem acessar o gerador.', 'Acesso Negado')}
            onResetHistory={() => {
              if (!isAdmin) {
                showToast('Apenas administradores podem zerar o histórico.', 'Acesso Negado');
                return;
              }
              storageService.saveHistory({});
              setHistoryData({});
              showToast(
                'Histórico acumulado zerado com sucesso! Agora exibindo apenas dados das escalas salvas.',
                'Histórico Zerado'
              );
            }}
          />
        )}

        {effectiveTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onResetAllData={storageService.resetAllData}
            onReloadData={handleReloadAll}
            isCloudConnected={isCloudConnected}
            theme={theme}
            onToggleTheme={toggleTheme}
            isAdmin={isAdmin}
            onSyncAllToCloud={async () => {
              if (!isAdmin) {
                showToast('Apenas administradores podem sincronizar dados em massa.', 'Acesso Negado');
                return;
              }
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

      {/* Modal de Edição Manual com Proteção de Propriedade da Escala */}
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
        isAdmin={isAdmin}
        currentUserEmployeeId={currentUserEmployeeId}
        theme={theme}
      />

      {/* Modal do Gerador scadahub (Exclusivo Administrador) */}
      {isAdmin && (
        <GenerateModal
          isOpen={isGenerateModalOpen}
          onClose={() => setIsGenerateModalOpen(false)}
          employees={employees}
          settings={settings}
          currentDate={currentDate}
          onApplySchedule={handleApplyGeneratedSchedule}
          onApplyWeekSchedule={handleApplyWeekSchedule}
        />
      )}

      {/* Modal de Autenticação e Chaveamento de Contas para Testes */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUserChanged={(user) => {
          setCurrentUser(user);
          showToast(`Sessão ativa alterada para: ${user?.name || 'Visitante'} (${user?.role === 'admin' ? 'Administrador' : 'Usuário Normal'})`, 'Identidade Atualizada');
        }}
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

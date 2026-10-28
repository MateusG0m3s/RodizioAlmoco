import { LayoutDashboard, CalendarRange, Users, History } from 'lucide-react';

// Destinos principais: os mesmos na sidebar e na barra inferior do celular
export const MAIN_TABS = [
  { id: 'dashboard', label: 'Painel', title: 'Painel do dia', icon: LayoutDashboard },
  { id: 'week', label: 'Semana', title: 'Rodízio semanal', icon: CalendarRange },
  { id: 'team', label: 'Equipe', title: 'Gestão da equipe', icon: Users },
  { id: 'history', label: 'Histórico', title: 'Histórico e equilíbrio', icon: History }
];

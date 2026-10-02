// Dados iniciais dos funcionários e regras do rodízio com foco em cobertura de atendimento
export const INITIAL_EMPLOYEES = [
  {
    id: 'emp-1',
    name: 'Mateus de Oliveira Silva',
    shortName: 'Mateus O.',
    email: 'mateus.oliveira@scadahub.io',
    avatar: 'MD',
    color: '#381267', // Roxo profundo scadahub
    role: 'Líder - Desenvolvimento',
    active: true,
    preferredTime: '11:45',
    restrictions: null
  },
  {
    id: 'emp-2',
    name: 'Mateus Augusto Santos Gomes',
    shortName: 'Mateus A.',
    email: 'mateusaugusto1441@gmail.com',
    avatar: 'MA',
    color: '#7c3aed', // Lilás scadahub
    role: 'Administrador & Eng. de Software',
    active: true,
    preferredTime: '12:30',
    restrictions: null
  },
  {
    id: 'emp-3',
    name: 'Monique Aparecida Hileshein',
    shortName: 'Monique',
    email: 'monique@scadahub.com',
    avatar: 'MH',
    color: '#0284c7', // Azul Ciano Hub
    role: 'Engenharia de Software SCADA',
    active: true,
    preferredTime: '11:45',
    restrictions: null
  },
  {
    id: 'emp-4',
    name: 'Samara Ravoredo',
    shortName: 'Samara',
    email: 'samara@scadahub.com',
    avatar: 'SR',
    color: '#6366f1', // Índigo moderno
    role: 'Engenharia de Software SCADA',
    active: true,
    preferredTime: '12:30',
    restrictions: null
  }
];

export const INITIAL_SETTINGS = {
  startHour: '11:00',
  endHour: '14:00',
  criticalStart: '11:30', // Início da janela crítica onde NUNCA pode faltar atendimento
  criticalEnd: '13:30',   // Fim da janela crítica de atendimento aos clientes
  minWorkingDuringCritical: 1, // No mínimo 1 pessoa trabalhando a qualquer momento
  slotInterval: 5,        // Intervalo de 5 minutos da planilha
  defaultDuration: 30,    // Duração padrão do almoço (30 min)
  warningMinutesBefore: 10,
  soundAlerts: false
};

// Histórico de distribuição anterior para cálculo de equilíbrio (inicia limpo para ler apenas dados reais)
export const INITIAL_HISTORY = {};

import { Student, Teacher, Invoice, Announcement, ChatMessage, AutomationFlow, SchoolTask } from './types';

export const initialStudents: Student[] = [
  {
    id: 'ALU-101',
    name: 'Alice Siqueira',
    class: '9º Ano A',
    attendanceRate: 98,
    averageGrade: 9.2,
    status: 'active',
    outstandingFees: 0,
    guardiansName: 'Marcos Siqueira',
    guardiansContact: '+351 912 345 678',
    behaviorDegree: 'Excelente',
    documents: [
      { name: 'Contrato de Matrícula', submitted: true, date: '2026-01-10' },
      { name: 'CC do Aluno', submitted: true, date: '2026-01-10' },
      { name: 'Boletim de Vacinas', submitted: true, date: '2026-01-12' },
      { name: 'CC do Responsável', submitted: true, date: '2026-01-12' }
    ],
    behaviorHistory: [
      { date: '2026-03-14', note: 'Demonstrou liderança exemplar no projeto de Robótica.', categoryDefault: 'Elogio' }
    ],
    grades: [
      { subject: 'Matemática', score: 9.5 },
      { subject: 'Português', score: 8.8 },
      { subject: 'História', score: 9.0 },
      { subject: 'Ciências', score: 9.5 }
    ]
  },
  {
    id: 'ALU-102',
    name: 'Bruno Medeiros',
    class: '8º Ano B',
    attendanceRate: 78,
    averageGrade: 6.1,
    status: 'active',
    outstandingFees: 450,
    guardiansName: 'Sandra Medeiros',
    guardiansContact: '+351 913 222 111',
    behaviorDegree: 'Atenção',
    documents: [
      { name: 'Contrato de Matrícula', submitted: true, date: '2026-01-15' },
      { name: 'CC do Aluno', submitted: true, date: '2026-01-15' },
      { name: 'Boletim de Vacinas', submitted: false, date: 'Pendente' },
      { name: 'CC do Responsável', submitted: true, date: '2026-01-15' }
    ],
    behaviorHistory: [
      { date: '2026-04-10', note: 'Conversas paralelas excessivas durante a aula de História.', categoryDefault: 'Advertência' },
      { date: '2026-05-02', note: 'Não entregou o trabalho prático de Geografia na data prevista.', categoryDefault: 'Falta de Trabalho' }
    ],
    grades: [
      { subject: 'Matemática', score: 5.0 },
      { subject: 'Português', score: 6.5 },
      { subject: 'História', score: 6.0 },
      { subject: 'Ciências', score: 7.0 }
    ]
  },
  {
    id: 'ALU-103',
    name: 'Clara Vasconcelos',
    class: '10º Ano A',
    attendanceRate: 95,
    averageGrade: 8.5,
    status: 'active',
    outstandingFees: 0,
    guardiansName: 'Ricardo Vasconcelos',
    guardiansContact: '+351 915 456 789',
    behaviorDegree: 'Bom',
    documents: [
      { name: 'Contrato de Matrícula', submitted: true, date: '2026-01-08' },
      { name: 'CC do Aluno', submitted: true, date: '2026-01-08' },
      { name: 'Boletim de Vacinas', submitted: true, date: '2026-01-08' },
      { name: 'CC do Responsável', submitted: true, date: '2026-01-08' }
    ],
    behaviorHistory: [
      { date: '2026-02-20', note: 'Participação ativa e excelente colaboração no seminário escolar.', categoryDefault: 'Elogio' }
    ],
    grades: [
      { subject: 'Matemática', score: 8.0 },
      { subject: 'Português', score: 8.5 },
      { subject: 'História', score: 9.0 },
      { subject: 'Química', score: 8.5 }
    ]
  },
  {
    id: 'ALU-104',
    name: 'Diogo Fontes',
    class: '9º Ano A',
    attendanceRate: 91,
    averageGrade: 7.2,
    status: 'active',
    outstandingFees: 450,
    guardiansName: 'Leonor Fontes',
    guardiansContact: '+351 926 789 012',
    behaviorDegree: 'Regular',
    documents: [
      { name: 'Contrato de Matrícula', submitted: true, date: '2026-01-20' },
      { name: 'CC do Aluno', submitted: true, date: '2026-01-20' },
      { name: 'Boletim de Vacinas', submitted: true, date: '2026-01-20' },
      { name: 'CC do Responsável', submitted: false, date: 'Pendente' }
    ],
    behaviorHistory: [
      { date: '2026-03-01', note: 'Esqueceu o material escolar básico na aula de Ciências.', categoryDefault: 'Falta de Material' }
    ],
    grades: [
      { subject: 'Matemática', score: 6.8 },
      { subject: 'Português', score: 7.5 },
      { subject: 'História', score: 7.0 },
      { subject: 'Ciências', score: 7.5 }
    ]
  },
  {
    id: 'ALU-105',
    name: 'Eduarda Couto',
    class: '10º Ano A',
    attendanceRate: 99,
    averageGrade: 9.8,
    status: 'active',
    outstandingFees: 0,
    guardiansName: 'Margarida Couto',
    guardiansContact: '+351 931 112 233',
    behaviorDegree: 'Excelente',
    documents: [
      { name: 'Contrato de Matrícula', submitted: true, date: '2026-01-05' },
      { name: 'CC do Aluno', submitted: true, date: '2026-01-05' },
      { name: 'Boletim de Vacinas', submitted: true, date: '2026-01-05' },
      { name: 'CC do Responsável', submitted: true, date: '2026-01-05' }
    ],
    behaviorHistory: [
      { date: '2026-04-20', note: 'Melhor nota da turma no teste nacional simulado de Ciências.', categoryDefault: 'Destaque Académico' }
    ],
    grades: [
      { subject: 'Matemática', score: 10.0 },
      { subject: 'Português', score: 9.6 },
      { subject: 'História', score: 9.8 },
      { subject: 'Química', score: 9.8 }
    ]
  }
];

export const initialTeachers: Teacher[] = [
  {
    id: 'PROF-001',
    name: 'Prof. Ricardo Neves',
    email: 'ricardo.neves@nexus-edu.com',
    phone: '+351 912 888 777',
    subjects: ['Matemática', 'Física'],
    classes: ['9º Ano A', '10º Ano A'],
    productivityScore: 96,
    schedule: ['2ª Feira: 09:00 - 13:00', '3ª Feira: 08:30 - 12:30', '5ª Feira: 14:00 - 18:00'],
    status: 'active',
    documents: [
      { name: 'Contrato de Trabalho', submitted: true, date: '2026-01-05' },
      { name: 'Registro Criminal de Portugal', submitted: true, date: '2026-01-05' },
      { name: 'Diploma de Habilitações Literárias', submitted: true, date: '2026-01-06' },
      { name: 'CC / Cédula Profissional', submitted: true, date: '2026-01-06' }
    ]
  },
  {
    id: 'PROF-002',
    name: 'Profa. Helena Souto',
    email: 'helena.souto@nexus-edu.com',
    phone: '+351 915 222 333',
    subjects: ['Português', 'Literatura'],
    classes: ['8º Ano B', '9º Ano A', '10º Ano A'],
    productivityScore: 94,
    schedule: ['2ª Feira: 14:00 - 18:00', '4ª Feira: 09:00 - 13:00', '6ª Feira: 08:30 - 12:30'],
    status: 'active',
    documents: [
      { name: 'Contrato de Trabalho', submitted: true, date: '2026-01-10' },
      { name: 'Registro Criminal de Portugal', submitted: true, date: '2026-01-10' },
      { name: 'Diploma de Habilitações Literárias', submitted: true, date: '2026-01-11' },
      { name: 'CC / Cédula Profissional', submitted: false, date: 'Pendente' }
    ]
  },
  {
    id: 'PROF-003',
    name: 'Prof. Alexandre Cruz',
    email: 'alexandre.cruz@nexus-edu.com',
    phone: '+351 933 444 555',
    subjects: ['História', 'Geografia'],
    classes: ['8º Ano B', '9º Ano A'],
    productivityScore: 89,
    schedule: ['3ª Feira: 14:00 - 18:00', '5ª Feira: 09:00 - 13:00', '6ª Feira: 14:00 - 18:00'],
    status: 'active',
    documents: [
      { name: 'Contrato de Trabalho', submitted: true, date: '2026-02-01' },
      { name: 'Registro Criminal de Portugal', submitted: false, date: 'Pendente' },
      { name: 'Diploma de Habilitações Literárias', submitted: true, date: '2026-02-02' },
      { name: 'CC / Cédula Profissional', submitted: true, date: '2026-02-02' }
    ]
  },
  {
    id: 'PROF-004',
    name: 'Profa. Sofia Lima',
    email: 'sofia.lima@nexus-edu.com',
    phone: '+351 964 555 666',
    subjects: ['Ciências', 'Química'],
    classes: ['9º Ano A', '10º Ano A'],
    productivityScore: 98,
    schedule: ['4ª Feira: 14:00 - 18:00', '5ª Feira: 08:30 - 12:30', '6ª Feira: 10:30 - 14:30'],
    status: 'active',
    documents: [
      { name: 'Contrato de Trabalho', submitted: true, date: '2026-01-15' },
      { name: 'Registro Criminal de Portugal', submitted: true, date: '2026-01-15' },
      { name: 'Diploma de Habilitações Literárias', submitted: true, date: '2026-01-16' },
      { name: 'CC / Cédula Profissional', submitted: true, date: '2026-01-16' }
    ]
  }
];

export const initialInvoices: Invoice[] = [
  { id: 'FAT-9901', studentId: 'ALU-101', studentName: 'Alice Siqueira', amount: 450, dueDate: '2026-06-10', status: 'paid', category: 'tuition' },
  { id: 'FAT-9902', studentId: 'ALU-102', studentName: 'Bruno Medeiros', amount: 450, dueDate: '2026-06-05', status: 'overdue', category: 'tuition' },
  { id: 'FAT-9903', studentId: 'ALU-103', studentName: 'Clara Vasconcelos', amount: 450, dueDate: '2026-06-10', status: 'paid', category: 'tuition' },
  { id: 'FAT-9904', studentId: 'ALU-104', studentName: 'Diogo Fontes', amount: 450, dueDate: '2026-06-05', status: 'overdue', category: 'tuition' },
  { id: 'FAT-9905', studentId: 'ALU-105', studentName: 'Eduarda Couto', amount: 450, dueDate: '2026-06-10', status: 'paid', category: 'tuition' },
  { id: 'FAT-9801', studentId: 'ALU-101', studentName: 'Alice Siqueira', amount: 120, dueDate: '2026-06-12', status: 'paid', category: 'material' },
  { id: 'FAT-9802', studentId: 'ALU-103', studentName: 'Clara Vasconcelos', amount: 80, dueDate: '2026-06-15', status: 'pending', category: 'extracurricular' },
  { id: 'FAT-9803', studentId: 'ALU-105', studentName: 'Eduarda Couto', amount: 150, dueDate: '2026-06-25', status: 'pending', category: 'material' }
];

export const initialAnnouncements: Announcement[] = [
  {
    id: 'AVISO-01',
    title: 'Abertura das Matrículas para o Ano Letivo 2026/2027',
    content: 'Informamos a toda a comunidade escolar que a primeira fase de matrículas e renovações já se encontra aberta. O processo poderá ser feito inteiramente de forma digital via Portal de Secretaria.',
    author: 'Dra. Leonor Antunes',
    role: 'Diretora Executiva',
    date: '2026-06-01',
    target: 'all'
  },
  {
    id: 'AVISO-02',
    title: 'Reunião Geral Pedagógica de Professores',
    content: 'Na próxima sexta-feira às 15:30 daremos início à reunião de planificação pedagógica trimestral. A participação de todo o corpo pedagógico é obrigatória.',
    author: 'Prof. Ricardo Neves',
    role: 'Coordenador Científico',
    date: '2026-06-09',
    target: 'teachers'
  },
  {
    id: 'AVISO-03',
    title: 'Campanha de Arrecadação de Livros',
    content: 'A nossa biblioteca está a organizar uma campanha de recolha de livros de ficção literária novos ou em excelente estado para incentivar a leitura recreativa voluntária.',
    author: 'Clara Vasconcelos',
    role: 'Representante de Alunos',
    date: '2026-06-11',
    target: 'all'
  }
];

export const initialMessages: ChatMessage[] = [
  { id: 'M-01', sender: 'Leonor Antunes', role: 'Diretora Executiva', content: 'Prezados, o relatório de auditoria pedagógica anual foi concluído com sucesso e está na rede interna.', timestamp: '09:12', channel: 'gral' },
  { id: 'M-02', sender: 'Ricardo Neves', role: 'Coordenador', content: 'Excelente! Vou analisar os parâmetros de aproveitamento do 10º Ano.', timestamp: '09:15', channel: 'gral' },
  { id: 'M-03', sender: 'Clara Rodrigues', role: 'Secretária Executiva', content: 'Direção, os avisos de tuidades pendentes para os responsáveis já começaram a ser disparados.', timestamp: '10:30', channel: 'administration-secretariat' },
  { id: 'M-04', sender: 'Leonor Antunes', role: 'Diretora Executiva', content: 'Obrigada, Clara. Vamos manter o seguimento ativo para mitigar a inadimplência.', timestamp: '10:45', channel: 'administration-secretariat' },
  { id: 'M-05', sender: 'Helena Souto', role: 'Professora', content: 'Temos problemas de ar condicionado na Sala 12. O calor está a prejudicar o rendimento escolar.', timestamp: '11:00', channel: 'direction-teachers' }
];

export const initialAutomations: AutomationFlow[] = [
  {
    id: 'FLUX-01',
    title: 'Alerta Automático de Ausência Diária',
    description: 'Quando o aluno falta injustificadamente, envia um alerta por SMS para o responsável oficial nas primeiras 2 horas.',
    trigger: 'Frequência do aluno < 100% no dia',
    action: 'Enviar WhatsApp/SMS contendo link de justificação',
    active: true,
    type: 'whatsapp',
    executions: 42
  },
  {
    id: 'FLUX-02',
    title: 'Cobrança Preventiva de Tuition',
    description: 'Envia e-mail elegante de lembrete 3 dias antes do vencimento da matrícula.',
    trigger: 'Vencimento da Fatura = Hoje - 3 dias',
    action: 'Enviar E-mail Customizado Premium',
    active: true,
    type: 'email',
    executions: 124
  },
  {
    id: 'FLUX-03',
    title: 'Sincronização de Nova de Matrícula',
    description: 'Assim que a secretaria valida o pagamento, cria automaticamente o perfil no Google Workspace e Moodle.',
    trigger: 'Matrícula Validada',
    action: 'Provisionar Workspace, Classroom e Moodle',
    active: true,
    type: 'system',
    executions: 18
  },
  {
    id: 'FLUX-04',
    title: 'Notificação de Alerta Pedagógico',
    description: 'Quando a nota trimestral acumulada cai abaixo de 7.5, notifica coordenação e encarregados.',
    trigger: 'Média de Notas < 7.5',
    action: 'Criar Tarefa no Nexus e disparar E-mail Pedagógico',
    active: false,
    type: 'system',
    executions: 5
  }
];

export const initialTasks: SchoolTask[] = [
  {
    id: 'TSK-101',
    title: 'Validar documentos de ingresso - Diogo Martins',
    description: 'Verificar se o certificado de habilitações e a fotocópia do documento de identificação estão em conformidade legal.',
    assignedTo: 'Secretaria Executiva',
    department: 'Secretaria',
    priority: 'Normal',
    status: 'Em Curso',
    createdAt: '2026-06-20',
    dueDate: '2026-06-25',
    limitDate: '2026-06-28',
  },
  {
    id: 'TSK-102',
    title: 'Aprovar matrícula - Maria Leonor',
    description: 'Revisão final da ficha de matrícula e alocação provisória na Turma 10A.',
    assignedTo: 'Secretaria Executiva',
    department: 'Secretaria',
    priority: 'Alta',
    status: 'Pendente',
    createdAt: '2026-06-22',
    dueDate: '2026-06-24',
    limitDate: '2026-06-26',
  },
  {
    id: 'TSK-103',
    title: 'Lançar notas do 2º Período - Turma 10A',
    description: 'Lançamento obrigatório das notas de avaliação sumativa de Português nas pautas gerais.',
    assignedTo: 'Prof. João Silva',
    department: 'Professor',
    priority: 'Alta',
    status: 'Pendente',
    createdAt: '2026-06-18',
    dueDate: '2026-06-24',
    limitDate: '2026-06-26',
  },
  {
    id: 'TSK-104',
    title: 'Validar faltas de presença acumuladas - Diogo Martins',
    description: 'O aluno atingiu limite crítico de faltas. É necessário validar se as justificações apresentadas são válidas antes de fechar a pauta.',
    assignedTo: 'Prof. João Silva',
    department: 'Professor',
    priority: 'Urgente',
    status: 'Pendente',
    createdAt: '2026-06-21',
    dueDate: '2026-06-23',
    limitDate: '2026-06-24',
  },
  {
    id: 'TSK-105',
    title: 'Aprovar relatório pedagógico anual',
    description: 'Análise detalhada do relatório de auto-avaliação do corpo letivo enviado para homologação do conselho executivo.',
    assignedTo: 'Direção Executiva',
    department: 'Direção',
    priority: 'Normal',
    status: 'Em Curso',
    createdAt: '2026-06-15',
    dueDate: '2026-06-28',
    limitDate: '2026-06-30',
  },
  {
    id: 'TSK-106',
    title: 'Cobrar propinas em atraso - Maria Santos',
    description: 'Entrar em contacto telefónico com o encarregado de educação para regularizar a prestação em atraso de Maio antes de aplicar juros.',
    assignedTo: 'Financeiro Executivo',
    department: 'Financeiro',
    priority: 'Crítica',
    status: 'Atrasada',
    createdAt: '2026-06-05',
    dueDate: '2026-06-15',
    limitDate: '2026-06-20',
  },
  {
    id: 'TSK-107',
    title: 'Emitir recibo de doação institucional',
    description: 'Gerar e assinar digitalmente o recibo fiscal de donativo para o parceiro corporativo.',
    assignedTo: 'Financeiro Executivo',
    department: 'Financeiro',
    priority: 'Baixa',
    status: 'Pendente',
    createdAt: '2026-06-23',
    dueDate: '2026-06-30',
    limitDate: '2026-07-05',
  },
  {
    id: 'TSK-108',
    title: 'Validar pagamento de propina por transferência',
    description: 'Cruzar o comprovativo enviado por email com o extrato bancário escolar.',
    assignedTo: 'Financeiro Executivo',
    department: 'Financeiro',
    priority: 'Normal',
    status: 'Em Curso',
    createdAt: '2026-06-22',
    dueDate: '2026-06-25',
    limitDate: '2026-06-27',
  },
  {
    id: 'TSK-109',
    title: 'Aprovar plano orçamental do 3º Período',
    description: 'Plano de despesas extraordinárias estruturado pelo departamento financeiro.',
    assignedTo: 'Direção Executiva',
    department: 'Direção',
    priority: 'Crítica',
    status: 'Aguardando Aprovação',
    createdAt: '2026-06-19',
    dueDate: '2026-06-25',
    limitDate: '2026-06-28',
  },
  {
    id: 'TSK-110',
    title: 'Emitir certificado de habilitações - Teresa Silva',
    description: 'Preparação de documento oficial de conclusão de ciclo letivo.',
    assignedTo: 'Secretaria Executiva',
    department: 'Secretaria',
    priority: 'Normal',
    status: 'Concluída',
    createdAt: '2026-06-10',
    dueDate: '2026-06-15',
    limitDate: '2026-06-18',
  }
];

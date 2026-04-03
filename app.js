'use strict';

// ─── ADMINS ───────────────────────────────────────────────────────────────────
const ADMINS = [
  { id: 'a1', username: 'enzo',  password: 'Pablo1808@', name: 'Enzo' },
  { id: 'a2', username: 'antho', password: 'Alexia2008@', name: 'Antho' },
  { id: 'a3', username: 'waxx',  password: 'atelier2024', name: 'Waxx' },
];
const GOOGLE_EVENT_COLORS = {
  a1: '9',
  a2: '6',
  a3: '11',
};

// ─── STATE ────────────────────────────────────────────────────────────────────
let state = {
  currentUser: null,
  students: [],
  journal: [],
  filter: 'all',
  search: '',
  editingId: null,
  viewingId: null,
  viewingProspectId: null,
  prospectStatusFilter: 'all',
  currentPhotoData: null,
  analyticsRangeRevenue: 30,
  analyticsRangeStudents: 30,
  todoDraftContext: null,
  todoScope: 'mine',
  aiDrafts: {},
  aiWorkspaceResult: { loading: false, text: '', error: '' },
  google: {
    connected: false,
    connectedEmail: '',
    calendarId: 'primary',
    connectedAt: '',
  },
  editingTodoId: null,
};

const charts = {};
let draggedProspectId = null;
const TRADE_OPTIONS = [
  { value: 'macon', label: 'Maçon', icon: '🧱', hint: 'Gros oeuvre' },
  { value: 'plombier', label: 'Plombier', icon: '🔧', hint: 'Installation eau' },
  { value: 'serrurier', label: 'Serrurier', icon: '🔐', hint: 'Ouverture et sécurité' },
  { value: 'plaquiste', label: 'Plaquiste', icon: '🪚', hint: 'Cloisons et finitions' },
  { value: 'charpentier', label: 'Charpentier', icon: '🪵', hint: 'Bois et structure' },
  { value: 'autre', label: 'Autre', icon: '🧰', hint: 'Autre métier manuel' },
];
const AI_DEFAULTS = {
  provider: 'openai',
  style: 'Sois tres clair, concis, orienté action et conversion pour une equipe de terrain peu digitale.',
  providers: {
    openai: { model: 'gpt-5-mini', apiKey: '' },
    anthropic: { model: 'claude-sonnet-4-5', apiKey: '' },
    gemini: { model: 'gemini-2.0-flash', apiKey: '' },
    groq: { model: 'llama-3.3-70b-versatile', apiKey: '' },
  },
};
const DB_DEFAULTS = {
  url: 'https://colamwrmztblrsoioers.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvbGFtd3JtenRibHJzb2lvZXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjE3NTgsImV4cCI6MjA5MDM5Nzc1OH0.2ozswhNiEbjzTMEDVu9zNwfy8pXJ5gzzWjclq0LDbGg',
  workspace: 'atelier-crm',
};
let aiConfig = JSON.parse(JSON.stringify(AI_DEFAULTS));
let dbConfig = { ...DB_DEFAULTS };
let aiModalProvider = AI_DEFAULTS.provider;
let aiSpeechRecognition = null;
let aiSpeechListening = false;
let aiSpeechShouldContinue = false;
let aiSpeechCommittedText = '';
let remoteSaveTimer = null;
let todoLeadModalTodoId = null;
let todoLinkEntityType = 'prospect';
let todoLinkSelection = null;
let todoCompletionModalTodoId = null;

function getDefaultGoogleState() {
  return {
    connected: false,
    connectedEmail: '',
    calendarId: 'primary',
    connectedAt: '',
  };
}

function getCurrentAdminCalendarMeta() {
  const admin = state.currentUser || ADMINS[0];
  return {
    adminId: admin.id,
    adminName: admin.name,
    colorId: GOOGLE_EVENT_COLORS[admin.id] || '9',
  };
}

function mergeAiConfig(saved) {
  return {
    ...JSON.parse(JSON.stringify(AI_DEFAULTS)),
    ...(saved || {}),
    providers: {
      ...JSON.parse(JSON.stringify(AI_DEFAULTS.providers)),
      ...((saved && saved.providers) || {}),
    },
  };
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────
function loadData() {
  try { state.students = JSON.parse(localStorage.getItem('crm_students') || '[]'); } catch { state.students = []; }
  try { state.journal  = JSON.parse(localStorage.getItem('crm_journal')  || '[]'); } catch { state.journal  = []; }
  loadProspects();
  loadTodos();
  loadIdeas();
  loadAiConfig();
  loadDbConfig();
}

function saveStudents() { localStorage.setItem('crm_students', JSON.stringify(state.students)); queueRemoteSave(); }
function saveJournal()  { localStorage.setItem('crm_journal',  JSON.stringify(state.journal)); queueRemoteSave(); }

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// ─── PROSPECTS ────────────────────────────────────────────────────────────────
let prospects = [];
let ideas = [];

function loadProspects() {
  try { prospects = JSON.parse(localStorage.getItem('crm_prospects') || '[]'); } catch { prospects = []; }
}

function saveProspects() { localStorage.setItem('crm_prospects', JSON.stringify(prospects)); queueRemoteSave(); }
function loadIdeas() {
  try { ideas = JSON.parse(localStorage.getItem('crm_ideas') || '[]'); } catch { ideas = []; }
}
function saveIdeas() { localStorage.setItem('crm_ideas', JSON.stringify(ideas)); queueRemoteSave(); }
function loadAiConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('crm_ai_config') || 'null');
    if (!saved) return;
    aiConfig = mergeAiConfig(saved);
  } catch {
    aiConfig = JSON.parse(JSON.stringify(AI_DEFAULTS));
  }
}
function saveAiConfig() { localStorage.setItem('crm_ai_config', JSON.stringify(aiConfig)); }
function loadDbConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('crm_db_config') || 'null');
    if (!saved) return;
    dbConfig = { ...DB_DEFAULTS, ...saved };
  } catch {
    dbConfig = { ...DB_DEFAULTS };
  }
}
function saveDbConfig() { localStorage.setItem('crm_db_config', JSON.stringify(dbConfig)); }

// ─── TODO LIST ────────────────────────────────────────────────────────────────
let todos = [];

function loadTodos() {
  try { todos = JSON.parse(localStorage.getItem('crm_todos') || '[]'); } catch { todos = []; }
}

function saveTodos() { localStorage.setItem('crm_todos', JSON.stringify(todos)); queueRemoteSave(); }

function clearAllData() {
  localStorage.removeItem('crm_students');
  localStorage.removeItem('crm_journal');
  localStorage.removeItem('crm_prospects');
  localStorage.removeItem('crm_todos');
  localStorage.removeItem('crm_ideas');
  localStorage.removeItem('crm_ai_config');
}

function seedDemoData() {
  const now = Date.now();
  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().split('T')[0];

  const demoProspects = [
    {
      id: 'p-demo-1',
      name: 'Sofia Martinez',
      trade: 'serrurier',
      phone: '+33 6 12 44 89 20',
      email: 'sofia@ateliernova.fr',
      source: 'Instagram ads',
      ownerId: 'a1',
      ownerName: 'Enzo',
      status: 'chaud',
      reminderDate: todayIso,
      reminderTime: '14:30',
      reminderNote: 'Valider son budget et proposer le pack signature.',
      notes: 'A déjà vu deux études de cas. Très réactive.',
      createdAt: now - 1000 * 60 * 60 * 36,
      updatedAt: now - 1000 * 60 * 40,
    },
    {
      id: 'p-demo-2',
      name: 'Nassim Benali',
      trade: 'macon',
      phone: '+33 6 22 90 18 74',
      email: 'nassim@atelierlocal.com',
      source: 'TikTok commentaire',
      ownerId: 'a2',
      ownerName: 'Antho',
      status: 'froid',
      reminderDate: '',
      reminderTime: '',
      reminderNote: '',
      notes: 'Premier échange, besoin de cadrer son offre.',
      createdAt: now - 1000 * 60 * 60 * 18,
      updatedAt: now - 1000 * 60 * 60 * 3,
    },
    {
      id: 'p-demo-3',
      name: 'Camille Petit',
      trade: 'plombier',
      phone: '+33 6 45 12 77 08',
      email: 'camille@maisonpetit.fr',
      source: 'TikTok live',
      ownerId: 'a1',
      ownerName: 'Enzo',
      status: 'signe',
      reminderDate: todayIso,
      reminderTime: '17:00',
      reminderNote: 'Passer en client et compléter le brief de delivery.',
      notes: 'Accord oral validé, attend le lancement.',
      createdAt: now - 1000 * 60 * 60 * 60,
      updatedAt: now - 1000 * 60 * 20,
    },
  ];

  const demoStudents = [
    {
      id: 's-demo-1',
      name: 'Atelier Horizon',
      trade: 'charpentier',
      email: 'contact@atelierhorizon.fr',
      phone: '+33 6 11 08 44 55',
      skoolDate: todayIso,
      amount: '2400',
      method: 'Skool / Stripe',
      color: 'green',
      website: true,
      gmb: false,
      logo: true,
      active: true,
      notes: 'Client premium. GMB à finaliser cette semaine.',
      photo: null,
      source: 'Instagram',
      originProspectId: 'archived-demo-1',
      convertedAt: now - 1000 * 60 * 60 * 24 * 7,
      createdAt: now - 1000 * 60 * 60 * 24 * 7,
      updatedAt: now - 1000 * 60 * 60 * 6,
    },
    {
      id: 's-demo-2',
      name: 'Studio Lune',
      trade: 'plaquiste',
      email: 'bonjour@studiolune.fr',
      phone: '+33 6 38 19 21 17',
      skoolDate: todayIso,
      amount: '1800',
      method: 'RIB',
      color: 'orange',
      website: false,
      gmb: false,
      logo: true,
      active: true,
      notes: 'Kickoff fait. Site et GMB encore ouverts.',
      photo: null,
      source: 'Référence client',
      originProspectId: 'archived-demo-2',
      convertedAt: now - 1000 * 60 * 60 * 24 * 4,
      createdAt: now - 1000 * 60 * 60 * 24 * 4,
      updatedAt: now - 1000 * 60 * 60 * 12,
    },
    {
      id: 's-demo-3',
      name: 'Maison Orme',
      trade: 'macon',
      email: 'hello@maisonorme.fr',
      phone: '+33 6 71 23 51 98',
      skoolDate: todayIso,
      amount: '3200',
      method: 'PayPal',
      color: 'red',
      website: true,
      gmb: true,
      logo: false,
      active: false,
      notes: 'Client historique. Reste seulement l’identité visuelle.',
      photo: null,
      source: 'YouTube',
      originProspectId: 'archived-demo-3',
      convertedAt: now - 1000 * 60 * 60 * 24 * 20,
      createdAt: now - 1000 * 60 * 60 * 24 * 20,
      updatedAt: now - 1000 * 60 * 60 * 24 * 2,
    },
  ];

  const demoTodos = [
    {
      id: 't-demo-1',
      title: 'Relancer Sofia avec le pack signature',
      rawInput: 'Relancer Sofia avec le pack signature',
      dueDate: todayIso,
      dueTime: '14:30',
      contextType: 'prospect',
      contextId: 'p-demo-1',
      mentions: [],
      status: 'pending',
      snoozedUntil: null,
      priority: 'normal',
      createdAt: now - 1000 * 60 * 30,
      createdBy: 'a1',
      ownerId: 'a1',
      ownerName: 'Enzo',
      completedAt: null,
    },
    {
      id: 't-demo-2',
      title: 'Convertir Camille en client et lancer le brief',
      rawInput: 'Convertir Camille en client et lancer le brief',
      dueDate: todayIso,
      dueTime: '17:00',
      contextType: 'prospect',
      contextId: 'p-demo-3',
      mentions: [],
      status: 'pending',
      snoozedUntil: null,
      priority: 'normal',
      createdAt: now - 1000 * 60 * 50,
      createdBy: 'a1',
      ownerId: 'a2',
      ownerName: 'Antho',
      completedAt: null,
    },
    {
      id: 't-demo-3',
      title: 'Finaliser la fiche GMB de Atelier Horizon',
      rawInput: 'Finaliser la fiche GMB de Atelier Horizon',
      dueDate: tomorrowIso,
      dueTime: '11:00',
      contextType: 'student',
      contextId: 's-demo-1',
      mentions: [],
      status: 'pending',
      snoozedUntil: null,
      priority: 'normal',
      createdAt: now - 1000 * 60 * 80,
      createdBy: 'a2',
      ownerId: 'a3',
      ownerName: 'Waxx',
      completedAt: null,
    },
    {
      id: 't-demo-4',
      title: 'Envoyer le logo final à Maison Orme',
      rawInput: 'Envoyer le logo final à Maison Orme',
      dueDate: todayIso,
      dueTime: '09:00',
      contextType: 'student',
      contextId: 's-demo-3',
      mentions: [],
      status: 'done',
      snoozedUntil: null,
      priority: 'normal',
      createdAt: now - 1000 * 60 * 60 * 10,
      createdBy: 'a3',
      ownerId: 'a3',
      ownerName: 'Waxx',
      completedAt: now - 1000 * 60 * 60 * 2,
    },
  ];

  const demoJournal = [
    {
      id: 'j-demo-1',
      adminId: 'a1',
      adminName: 'Enzo',
      action: 'add',
      entityType: 'prospect',
      label: 'Sofia Martinez',
      detail: 'Lead ajouté depuis Instagram',
      timestamp: now - 1000 * 60 * 60 * 36,
    },
    {
      id: 'j-demo-2',
      adminId: 'a2',
      adminName: 'Antho',
      action: 'edit',
      entityType: 'todo',
      label: 'Finaliser la fiche GMB de Atelier Horizon',
      detail: 'Tâche planifiée pour le delivery',
      timestamp: now - 1000 * 60 * 80,
    },
    {
      id: 'j-demo-3',
      adminId: 'a3',
      adminName: 'Waxx',
      action: 'add',
      entityType: 'student',
      label: 'Studio Lune',
      detail: 'Client converti depuis les leads',
      timestamp: now - 1000 * 60 * 60 * 24 * 4,
    },
  ];

  const demoIdeas = [
    {
      id: 'i-demo-1',
      title: 'Script commun pour TikTok live',
      body: 'Créer une structure très simple pour que Enzo et Antho aient toujours la même accroche, la même preuve sociale et le même CTA.',
      status: 'to-discuss',
      authorId: 'a3',
      authorName: 'Waxx',
      createdAt: now - 1000 * 60 * 60 * 8,
      comments: [
        { id: 'ic-demo-1', authorId: 'a1', authorName: 'Enzo', body: 'Il faut aussi une version plus courte pour les lives rapides.', createdAt: now - 1000 * 60 * 60 * 4 },
      ],
    },
    {
      id: 'i-demo-2',
      title: 'Tracker les leads venant des commentaires TikTok',
      body: 'Ajouter un mini script d’entrée pour savoir si un lead vient d’un commentaire ou d’un live, car c’est notre source la plus chaude du moment.',
      status: 'approved',
      authorId: 'a2',
      authorName: 'Antho',
      createdAt: now - 1000 * 60 * 60 * 18,
      comments: [],
    },
  ];

  state.students = demoStudents;
  state.journal = demoJournal;
  prospects = demoProspects;
  todos = demoTodos;
  ideas = demoIdeas;

  saveStudents();
  saveJournal();
  saveProspects();
  saveTodos();
  saveIdeas();
}

// NLP Parser for natural language input
function parseNaturalInput(input) {
  const result = {
    title: input,
    dueDate: null,
    dueTime: null,
    mentions: [],
  };
  
  // Extract @mentions
  const mentionRegex = /@([A-Za-zÀ-ÿ\s]+?)(?=\s|$|@)/g;
  let match;
  while ((match = mentionRegex.exec(input)) !== null) {
    result.mentions.push(match[1].trim());
  }
  
  // Parse dates (French)
  const now = new Date();
  const text = input.toLowerCase();
  
  // Time patterns
  const timeMatch = text.match(/(?:\b(?:à|a)\s*)?(\d{1,2})h(\d{2})?\b/);
  if (timeMatch) {
    const h = timeMatch[1].padStart(2, '0');
    const m = (timeMatch[2] || '00').padStart(2, '0');
    result.dueTime = `${h}:${m}`;
  }
  
  // Date patterns
  if (text.includes('aujourd\'hui') || text.includes("auj")) {
    result.dueDate = now.toISOString().split('T')[0];
  } else if (text.includes('demain')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    result.dueDate = tomorrow.toISOString().split('T')[0];
  } else if (text.match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+prochain\b/)) {
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const dayMatch = text.match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+prochain\b/);
    if (dayMatch) {
      const targetDay = days.indexOf(dayMatch[1]);
      const currentDay = now.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      const target = new Date(now);
      target.setDate(target.getDate() + daysToAdd);
      result.dueDate = target.toISOString().split('T')[0];
    }
  } else if (text.match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/)) {
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const dayMatch = text.match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/);
    if (dayMatch) {
      const targetDay = days.indexOf(dayMatch[1]);
      const currentDay = now.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd < 0) daysToAdd += 7;
      const target = new Date(now);
      target.setDate(target.getDate() + daysToAdd);
      result.dueDate = target.toISOString().split('T')[0];
    }
  } else if (text.includes('semaine prochaine')) {
    const next = new Date(now);
    next.setDate(next.getDate() + 7);
    result.dueDate = next.toISOString().split('T')[0];
  } else if (text.includes('mois prochain')) {
    const next = new Date(now);
    next.setMonth(next.getMonth() + 1);
    result.dueDate = next.toISOString().split('T')[0];
  }
  
  // Specific date DD/MM or DD/MM/YYYY
  const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    let year = dateMatch[3] ? (dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3]) : now.getFullYear();
    result.dueDate = `${year}-${month}-${day}`;
  }
  
  return result;
}

function formatIsoDate(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

function getEndOfWeekDate() {
  const now = new Date();
  const day = now.getDay();
  const delta = day === 0 ? 1 : Math.max(1, 6 - day);
  const target = new Date(now);
  target.setDate(now.getDate() + delta);
  return target;
}

function getTodoScheduleSelection() {
  const manualDate = document.getElementById('todoDateInput')?.value || '';
  const manualTime = document.getElementById('todoTimeInput')?.value || '';
  if (manualDate || manualTime) {
    return { dueDate: manualDate || null, dueTime: manualTime || null };
  }

  const dateMode = document.querySelector('#todoQuickDate .schedule-chip.active')?.dataset.dateMode || 'today';
  const timeValue = document.querySelector('#todoQuickTime .schedule-chip.active')?.dataset.timeValue ?? '09:00';
  const now = new Date();
  let dueDate = null;

  if (dateMode === 'today') dueDate = formatIsoDate(now);
  if (dateMode === 'tomorrow') {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    dueDate = formatIsoDate(tomorrow);
  }
  if (dateMode === 'week') dueDate = formatIsoDate(getEndOfWeekDate());
  if (dateMode === 'none') dueDate = null;

  return { dueDate, dueTime: dueDate ? (timeValue || null) : null };
}

function updateTodoSchedulePreview() {
  const preview = document.getElementById('todoSchedulePreview');
  if (!preview) return;
  const { dueDate, dueTime } = getTodoScheduleSelection();
  if (!dueDate) {
    preview.textContent = 'Aucun rappel planifie';
    return;
  }

  const dateLabel = new Date(`${dueDate}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  preview.textContent = dueTime
    ? `Rappel prevu ${dateLabel} a ${dueTime.replace(':', 'h')}`
    : `Rappel prevu ${dateLabel}`;
}

function clearTodoScheduleSelection() {
  document.querySelectorAll('#todoQuickDate .schedule-chip').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('#todoQuickTime .schedule-chip').forEach(btn => btn.classList.remove('active'));
  document.querySelector('#todoQuickDate [data-date-mode="today"]')?.classList.add('active');
  document.querySelector('#todoQuickTime [data-time-value="09:00"]')?.classList.add('active');
  if (document.getElementById('todoDateInput')) document.getElementById('todoDateInput').value = '';
  if (document.getElementById('todoTimeInput')) document.getElementById('todoTimeInput').value = '';
  const customRow = document.getElementById('todoCustomSchedule');
  if (customRow) customRow.style.display = 'none';
  updateTodoSchedulePreview();
}

function getTodoQuickDateMode(todo) {
  if (!todo.dueDate) return 'none';
  const today = formatIsoDate(new Date());
  const tomorrow = formatIsoDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const week = formatIsoDate(getEndOfWeekDate());
  if (todo.dueDate === today) return 'today';
  if (todo.dueDate === tomorrow) return 'tomorrow';
  if (todo.dueDate === week) return 'week';
  return 'custom';
}

function updateTodoComposerUi() {
  const badge = document.getElementById('todoEditBadge');
  const saveBtn = document.getElementById('saveTodoBtn');
  const cancelBtn = document.getElementById('cancelTodoEditBtn');
  const input = document.getElementById('todoInput');
  if (!badge || !saveBtn || !cancelBtn || !input) return;

  const isEditing = Boolean(state.editingTodoId);
  badge.style.display = isEditing ? 'inline-flex' : 'none';
  cancelBtn.style.display = isEditing ? 'inline-flex' : 'none';
  saveBtn.textContent = isEditing ? 'Enregistrer' : 'Ajouter la tâche';
  input.placeholder = isEditing
    ? 'Modifie la tâche puis enregistre'
    : 'Tâche... (ex: Relancer @Jean demain à 14h)';
}

function resetTodoComposer() {
  state.editingTodoId = null;
  const input = document.getElementById('todoInput');
  if (input) input.value = '';
  if (document.getElementById('todoOwnerSelect') && state.currentUser) {
    document.getElementById('todoOwnerSelect').value = state.currentUser.id;
  }
  clearTodoScheduleSelection();
  updateTodoComposerUi();
}

function fillTodoComposer(todo) {
  const input = document.getElementById('todoInput');
  if (input) input.value = todo.title || '';
  const ownerSelect = document.getElementById('todoOwnerSelect');
  if (ownerSelect) ownerSelect.value = todo.ownerId || state.currentUser?.id || ADMINS[0].id;

  clearTodoScheduleSelection();
  if (document.getElementById('todoDateInput')) document.getElementById('todoDateInput').value = todo.dueDate || '';
  if (document.getElementById('todoTimeInput')) document.getElementById('todoTimeInput').value = todo.dueTime || '';
  const customRow = document.getElementById('todoCustomSchedule');
  document.querySelectorAll('#todoQuickDate .schedule-chip[data-date-mode]').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('#todoQuickTime .schedule-chip[data-time-value]').forEach(btn => btn.classList.remove('active'));
  const dateMode = getTodoQuickDateMode(todo);
  if (dateMode === 'custom') {
    if (customRow) customRow.style.display = 'flex';
  } else {
    document.querySelector(`#todoQuickDate [data-date-mode="${dateMode}"]`)?.classList.add('active');
  }
  const matchingTime = document.querySelector(`#todoQuickTime .schedule-chip[data-time-value="${todo.dueTime || ''}"]`);
  if (matchingTime) {
    matchingTime.classList.add('active');
  } else if (!todo.dueTime) {
    document.querySelector('#todoQuickTime [data-time-value=""]')?.classList.add('active');
  } else {
    if (customRow) customRow.style.display = 'flex';
  }
  updateTodoSchedulePreview();
  updateTodoComposerUi();
}

function createTodo(input, contextType = null, contextId = null) {
  const parsed = parseNaturalInput(input);
  const ownerId = document.getElementById('todoOwnerSelect')?.value || state.currentUser.id;
  const owner = ADMINS.find(a => a.id === ownerId) || state.currentUser;
  const schedule = getTodoScheduleSelection();
  const todo = {
    id: generateId(),
    title: input,
    rawInput: input,
    dueDate: schedule.dueDate || parsed.dueDate,
    dueTime: schedule.dueTime || parsed.dueTime,
    contextType,
    contextId,
    mentions: parsed.mentions,
    status: 'pending',
    snoozedUntil: null,
    priority: 'normal',
    createdAt: Date.now(),
    createdBy: state.currentUser.id,
    ownerId: owner.id,
    ownerName: owner.name,
    completedAt: null,
  };
  todos.unshift(todo);
  saveTodos();
  logActivity('add', 'todo', todo.title, contextId ? `Tâche liée à ${getContextDisplayName(contextType, contextId)}` : 'Tâche générale');
  clearTodoScheduleSelection();
  return todo;
}

function saveTodoFromComposer() {
  const input = document.getElementById('todoInput');
  const title = input?.value.trim() || '';
  if (!title) {
    input?.focus();
    return;
  }

  const parsed = parseNaturalInput(title);
  const ownerId = document.getElementById('todoOwnerSelect')?.value || state.currentUser.id;
  const owner = ADMINS.find(a => a.id === ownerId) || state.currentUser;
  const schedule = getTodoScheduleSelection();

  if (state.editingTodoId) {
    const todo = todos.find(item => item.id === state.editingTodoId);
    if (!todo) {
      resetTodoComposer();
      return;
    }
    const previousTitle = todo.title;
    const previousDate = todo.dueDate;
    const previousTime = todo.dueTime;
    todo.title = title;
    todo.rawInput = title;
    todo.dueDate = schedule.dueDate || parsed.dueDate;
    todo.dueTime = schedule.dueTime || parsed.dueTime;
    todo.mentions = parsed.mentions;
    todo.ownerId = owner.id;
    todo.ownerName = owner.name;
    if (previousTitle !== todo.title || previousDate !== todo.dueDate || previousTime !== todo.dueTime) {
      todo.googleEvent = null;
    }
    saveTodos();
    logActivity('edit', 'todo', todo.title, 'Tâche modifiée');
    renderTodos();
    renderDashboard();
    updateTodoBadges();
    showToast('Tâche mise à jour', 'success');
    resetTodoComposer();
    return;
  }

  const contextType = state.todoDraftContext?.type || null;
  const contextId = state.todoDraftContext?.id || null;
  createTodo(title, contextType, contextId);
  input.value = '';
  state.todoDraftContext = null;
  renderTodos();
  renderDashboard();
  updateTodoBadges();
  showTodoPreview(title);
  updateTodoComposerUi();
}

function createAiTodo({ title, dueDate = null, dueTime = null, note = '', contextType = null, contextId = null }) {
  const owner = state.currentUser || ADMINS[0];
  const todo = {
    id: generateId(),
    title,
    rawInput: note || title,
    dueDate,
    dueTime,
    contextType,
    contextId,
    mentions: [],
    status: 'pending',
    snoozedUntil: null,
    priority: 'normal',
    createdAt: Date.now(),
    createdBy: owner.id,
    ownerId: owner.id,
    ownerName: owner.name,
    completedAt: null,
  };
  todos.unshift(todo);
  saveTodos();
  logActivity('add', 'todo', todo.title, contextId ? `Tâche liée à ${getContextDisplayName(contextType, contextId)}` : 'Tâche créée depuis l’atelier IA');
  renderTodos();
  renderDashboard();
  updateTodoBadges();
  return todo;
}

function openEditTodo(id) {
  const todo = todos.find(item => item.id === id);
  if (!todo) return;
  state.editingTodoId = id;
  state.todoDraftContext = todo.contextType && todo.contextId ? { type: todo.contextType, id: todo.contextId } : null;
  showView('todos');
  fillTodoComposer(todo);
  document.getElementById('todoInput')?.focus();
}

function openTodoLeadModal(todoId) {
  const todo = todos.find(item => item.id === todoId);
  if (!todo) return;
  todoLeadModalTodoId = todoId;
  const statusSelect = document.getElementById('todoLeadStatusSelect');
  const summary = document.getElementById('todoLeadTaskSummary');
  const searchInput = document.getElementById('todoEntitySearchInput');
  if (!statusSelect || !summary || !searchInput) return;

  summary.textContent = todo.title;
  todoLinkEntityType = todo.contextType === 'student' ? 'student' : 'prospect';
  todoLinkSelection = todo.contextType && todo.contextId ? { type: todo.contextType, id: todo.contextId } : null;
  searchInput.value = getContextDisplayName(todo.contextType, todo.contextId) || '';
  statusSelect.value = todo.contextType === 'prospect'
    ? (prospects.find(item => item.id === todo.contextId)?.status || '')
    : '';
  renderTodoEntityTypeTabs();
  renderTodoEntityResults(searchInput.value);
  openModal('todoLeadModal');
}

function renderTodoEntityTypeTabs() {
  document.querySelectorAll('#todoEntityTypeTabs .segmented-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.entityType === todoLinkEntityType);
  });
  const statusGroup = document.getElementById('todoLeadStatusGroup');
  if (statusGroup) statusGroup.style.display = todoLinkEntityType === 'prospect' ? 'block' : 'none';
}

function getTodoEntityCandidates(entityType, query) {
  const search = (query || '').trim().toLowerCase();
  const source = entityType === 'student' ? state.students : prospects;
  const normalized = source.map(item => ({
    id: item.id,
    type: entityType,
    name: item.name || '',
    phone: item.phone || '',
    email: item.email || '',
    socialHandle: item.socialHandle || '',
    subtitle: entityType === 'student'
      ? [item.phone, item.email, item.socialHandle].filter(Boolean).join(' · ')
      : [item.phone, item.email, item.socialHandle, item.source].filter(Boolean).join(' · '),
    status: entityType === 'prospect' ? item.status || '' : '',
  }));
  if (!search) return normalized.slice(0, 8);
  return normalized
    .filter(item => [item.name, item.phone, item.email, item.socialHandle].some(value => value.toLowerCase().includes(search)))
    .slice(0, 8);
}

function renderTodoEntityResults(query = '') {
  const container = document.getElementById('todoEntityResults');
  if (!container) return;
  const items = getTodoEntityCandidates(todoLinkEntityType, query);
  if (!items.length) {
    container.innerHTML = `<div class="todo-entity-empty">Aucune fiche trouvée. Tu peux créer un lead depuis la note si besoin.</div>`;
    return;
  }
  container.innerHTML = items.map(item => `
    <button class="todo-entity-option ${todoLinkSelection && todoLinkSelection.type === item.type && todoLinkSelection.id === item.id ? 'active' : ''}" type="button" data-todo-entity-pick="${esc(item.id)}" data-todo-entity-type="${esc(item.type)}">
      <strong>${esc(item.name)} ${item.type === 'student' ? '<span class="todo-linked-tag">Client</span>' : ''}</strong>
      <span>${esc(item.subtitle || 'Sans détail')}</span>
    </button>
  `).join('');
}

function saveTodoLeadLink() {
  const todo = todos.find(item => item.id === todoLeadModalTodoId);
  if (!todo) return;
  const nextStatus = document.getElementById('todoLeadStatusSelect')?.value || '';
  if (!todoLinkSelection?.id || !todoLinkSelection?.type) {
    showToast('Choisis une fiche à lier à cette tâche.', 'warning');
    return;
  }

  todo.contextType = todoLinkSelection.type;
  todo.contextId = todoLinkSelection.id;
  if (todoLinkSelection.type === 'prospect') {
    const prospect = prospects.find(item => item.id === todoLinkSelection.id);
    if (!prospect) {
      showToast('Lead introuvable.', 'warning');
      return;
    }
    if (nextStatus && prospect.status !== nextStatus) {
      prospect.status = nextStatus;
      prospect.updatedAt = Date.now();
      logActivity('edit', 'prospect', prospect.name, `Étape mise à jour depuis le suivi vers ${getProspectStatusMeta(nextStatus).label}`);
      saveProspects();
    }
  }
  saveTodos();
  closeModal('todoLeadModal');
  renderTodos();
  renderProspects();
  renderDashboard();
  showToast(todo.contextType === 'student' ? 'Tâche liée au client' : 'Tâche liée et lead mis à jour', 'success');
}

function createLeadFromTodo() {
  const todo = todos.find(item => item.id === todoLeadModalTodoId);
  if (!todo) return;
  const parsed = parseIntakeResult('', todo.rawInput || todo.title);
  if (!parsed.name || !parsed.phone) {
    showToast('Il faut au minimum un nom et un numéro dans la note pour créer un lead.', 'warning');
    return;
  }
  parsed.entityType = 'prospect';
  parsed.prospectStatus = document.getElementById('todoLeadStatusSelect')?.value || 'chaud';
  const result = upsertCrmRecordFromAi(parsed);
  const prospect = prospects.find(item => item.name === result.name) || prospects.find(item => normalizePhone(item.phone) === normalizePhone(parsed.phone));
  const todoRef = todos.find(item => item.id === todoLeadModalTodoId);
  if (todoRef && prospect) {
    todoRef.contextType = 'prospect';
    todoRef.contextId = prospect.id;
    saveTodos();
  }
  closeModal('todoLeadModal');
  renderTodos();
  renderProspects();
  renderDashboard();
  showToast(`Lead créé depuis le suivi : ${result.name}`, 'success');
}

function openTodoCompletionModal(id) {
  const todo = todos.find(item => item.id === id);
  if (!todo) return;
  todoCompletionModalTodoId = id;
  const summary = document.getElementById('todoCompleteSummary');
  const outcome = document.getElementById('todoCompleteOutcome');
  const leadStatus = document.getElementById('todoCompleteLeadStatus');
  const leadStatusGroup = document.getElementById('todoCompleteLeadStatusGroup');
  const note = document.getElementById('todoCompleteNote');
  if (!summary || !outcome || !leadStatus || !leadStatusGroup || !note) return;

  summary.textContent = todo.title;
  outcome.value = 'done';
  note.value = '';
  leadStatus.value = '';
  leadStatusGroup.style.display = todo.contextType === 'prospect' ? 'block' : 'none';
  openModal('todoCompleteModal');
}

function appendFollowUpNote(target, text) {
  if (!text) return;
  target.notes = [target.notes || '', text].filter(Boolean).join('\n');
  target.updatedAt = Date.now();
}

function completeTodoWithOutcome() {
  const todo = todos.find(item => item.id === todoCompletionModalTodoId);
  if (!todo) return;
  const outcome = document.getElementById('todoCompleteOutcome')?.value || 'done';
  const note = document.getElementById('todoCompleteNote')?.value.trim() || '';
  const leadStatus = document.getElementById('todoCompleteLeadStatus')?.value || '';

  if (todo.contextType === 'prospect' && todo.contextId) {
    const prospect = prospects.find(item => item.id === todo.contextId);
    if (prospect) {
      if (leadStatus) prospect.status = leadStatus;
      if (outcome === 'qualified') prospect.status = 'chaud';
      if (outcome === 'signed') prospect.status = 'signe';
      appendFollowUpNote(prospect, [note, `Action terminée : ${todo.title}`].filter(Boolean).join('\n'));
      if (outcome === 'signed') {
        closeModal('todoCompleteModal');
        toggleTodo(todo.id);
        convertProspectToStudent(prospect.id, { silent: true, skipPrompt: true, source: 'todo' });
        showToast('Tâche terminée et lead converti en client', 'success');
        return;
      }
      saveProspects();
      logActivity('edit', 'prospect', prospect.name, `Suivi terminé : ${outcome}`);
    }
  }

  if (todo.contextType === 'student' && todo.contextId) {
    const student = state.students.find(item => item.id === todo.contextId);
    if (student) {
      appendFollowUpNote(student, [note, `Action terminée : ${todo.title}`].filter(Boolean).join('\n'));
      saveStudents();
      logAction('edit', student.name, `Suivi terminé : ${outcome}`);
    }
  }

  closeModal('todoCompleteModal');
  toggleTodo(todo.id);
}

function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  if (todo.status !== 'done' && todo.contextType && todo.contextId && todoCompletionModalTodoId !== id) {
    openTodoCompletionModal(id);
    return;
  }
  todo.status = todo.status === 'done' ? 'pending' : 'done';
  todo.completedAt = todo.status === 'done' ? Date.now() : null;
  todoCompletionModalTodoId = null;
  saveTodos();
  logActivity('edit', 'todo', todo.title, todo.status === 'done' ? 'Tâche terminée' : 'Tâche réactivée');
  renderTodos();
  renderProspects();
  renderStudents();
  renderDashboard();
  updateTodoBadges();
  showToast(todo.status === 'done' ? 'Tâche terminée ✓' : 'Tâche rétablie', todo.status === 'done' ? 'success' : 'info');
}

function snoozeTodo(id, days) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  const target = new Date();
  target.setDate(target.getDate() + days);
  todo.dueDate = target.toISOString().split('T')[0];
  todo.snoozedUntil = target.getTime();
  saveTodos();
  renderTodos();
  updateTodoBadges();
}

function deleteTodo(id) {
  const todo = todos.find(t => t.id === id);
  todos = todos.filter(t => t.id !== id);
  if (state.editingTodoId === id) resetTodoComposer();
  saveTodos();
  if (todo) logActivity('delete', 'todo', todo.title, 'Tâche supprimée');
  renderTodos();
  updateTodoBadges();
  showToast('Tâche supprimée', 'info');
}

function clearCompletedTodos() {
  const completed = todos.filter(t => t.status === 'done');
  if (!completed.length) return;
  confirmAction(`Supprimer ${completed.length} tâche${completed.length !== 1 ? 's' : ''} terminée${completed.length !== 1 ? 's' : ''} ?`, () => {
    todos = todos.filter(t => t.status !== 'done');
    saveTodos();
    logActivity('delete', 'todo', 'Tâches terminées', `${completed.length} tâche${completed.length !== 1 ? 's' : ''} archivées`);
    renderTodos();
    updateTodoBadges();
    showToast('Tâches terminées supprimées', 'success');
  });
}

function getTodayTodos() {
  const today = new Date().toISOString().split('T')[0];
  return getVisibleTodos().filter(t => t.status === 'pending' && t.dueDate === today);
}

function getOverdueTodos() {
  const today = new Date().toISOString().split('T')[0];
  return getVisibleTodos().filter(t => t.status === 'pending' && t.dueDate && t.dueDate < today);
}

function getUpcomingTodos() {
  const today = new Date().toISOString().split('T')[0];
  return getVisibleTodos().filter(t => t.status === 'pending' && t.dueDate && t.dueDate > today);
}

function getUndatedTodos() {
  return getVisibleTodos().filter(t => t.status === 'pending' && !t.dueDate);
}

function getCompletedTodos() {
  return getVisibleTodos().filter(t => t.status === 'done').slice(0, 20);
}

function getVisibleTodos() {
  if (state.todoScope === 'team') return todos;
  return todos.filter(t => (t.ownerId || t.createdBy) === state.currentUser?.id);
}

function renderTodos() {
  if (state.todoScope === 'mine') {
    const ownerSelect = document.getElementById('todoOwnerSelect');
    if (ownerSelect) ownerSelect.value = state.currentUser?.id || ADMINS[0].id;
  }
  updateTodoComposerUi();
  const todayList = getTodayTodos();
  const overdueList = getOverdueTodos();
  const upcomingList = getUpcomingTodos();
  const undatedList = getUndatedTodos();
  const completedList = getCompletedTodos();
  
  const todayContainer = document.getElementById('todayTodos');
  const overdueContainer = document.getElementById('overdueTodos');
  const upcomingContainer = document.getElementById('upcomingTodos');
  const undatedContainer = document.getElementById('undatedTodos');
  const completedContainer = document.getElementById('completedTodos');
  
  document.getElementById('todayCount').textContent = todayList.length;
  document.getElementById('overdueCount').textContent = overdueList.length;
  document.getElementById('completedCount').textContent = completedList.length;
  document.getElementById('undatedCount').textContent = undatedList.length;
  document.getElementById('clearCompletedBtn').style.display = completedList.length ? 'inline-flex' : 'none';
  
  todayContainer.innerHTML = todayList.length ? todayList.map(todoItemHtml).join('') : '<div class="todo-empty">Aucune tâche pour aujourd\'hui 🎉</div>';
  overdueContainer.innerHTML = overdueList.length ? overdueList.map(todoItemHtml).join('') : '<div class="todo-empty">Aucune tâche en retard</div>';
  upcomingContainer.innerHTML = upcomingList.length ? upcomingList.map(todoItemHtml).join('') : '<div class="todo-empty">Aucune tâche à venir</div>';
  undatedContainer.innerHTML = undatedList.length ? undatedList.map(todoItemHtml).join('') : '<div class="todo-empty">Aucune tâche sans date</div>';
  completedContainer.innerHTML = completedList.length ? completedList.map(todoItemHtml).join('') : '<div class="todo-empty">Aucune tâche terminée</div>';
  
  // Update overdue accordion visibility
  const overdueSection = document.getElementById('overdueSection');
  if (overdueList.length === 0) {
    overdueSection.style.display = 'none';
  } else {
    overdueSection.style.display = 'block';
  }
  
  updateTodoBadges();
  renderTodoContextBar();
}

function getGoogleEventMeta(record) {
  return record?.googleEvent && typeof record.googleEvent === 'object' ? record.googleEvent : null;
}

function buildGoogleButtons(recordType, record) {
  const event = getGoogleEventMeta(record);
  const agendaAttr = recordType === 'prospect'
    ? `data-agenda-lead="${esc(record.id)}"`
    : `data-agenda-todo="${esc(record.id)}"`;
  const agendaLabel = event?.htmlLink ? 'Agenda' : 'Google';
  return `
    <button class="agenda-btn" ${agendaAttr}>${agendaLabel}</button>
    ${event?.meetLink ? `<button class="agenda-btn meet-btn" data-open-meet="${esc(event.meetLink)}">Meet</button>` : ''}
  `;
}

function combineDateTime(date, time = '09:00') {
  return new Date(`${date}T${time || '09:00'}:00`);
}

function formatGoogleDateTime(date, time = '09:00') {
  return combineDateTime(date, time).toISOString();
}

async function fetchGoogleStatus() {
  try {
    const response = await fetch('/api/google/status', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Google indisponible');
    state.google = {
      ...getDefaultGoogleState(),
      ...data,
    };
    updateGoogleStatusNote();
    return true;
  } catch (error) {
    state.google = getDefaultGoogleState();
    updateGoogleStatusNote(error.message || 'Google indisponible');
    return false;
  }
}

function updateGoogleStatusNote(message = '') {
  const note = document.getElementById('googleStatusNote');
  const connectBtn = document.getElementById('connectGoogleBtn');
  if (connectBtn) connectBtn.textContent = state.google.connected ? 'Reconnecter Google' : 'Connecter Google';
  if (!note) return;
  if (message && !state.google.connected) {
    note.textContent = message;
    note.style.color = 'var(--text2)';
    return;
  }
  note.textContent = state.google.connected
    ? `Google Agenda connecté${state.google.connectedEmail ? ` : ${state.google.connectedEmail}` : ''}. Les boutons Agenda créent aussi un Google Meet.`
    : 'Google Agenda non connecté. Waxx doit connecter le compte une fois pour toute l’équipe.';
  note.style.color = state.google.connected ? 'var(--green)' : 'var(--text2)';
}

function connectGoogleCalendar() {
  const popup = window.open('/api/google/oauth/start', 'atelier-google-oauth', 'width=520,height=720');
  if (!popup) {
    window.location.href = '/api/google/oauth/start';
    return;
  }
}

async function createGoogleCalendarEvent(payload) {
  const response = await fetch('/api/google/calendar/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Impossible de créer le rendez-vous Google');
  return data;
}

async function syncProspectToGoogle(prospectId) {
  const prospect = prospects.find(item => item.id === prospectId);
  if (!prospect?.reminderDate) {
    showToast('Ajoute une date de rappel avant de créer le rendez-vous', 'info');
    return;
  }
  const existing = getGoogleEventMeta(prospect);
  if (existing?.htmlLink) {
    window.open(existing.htmlLink, '_blank', 'noopener,noreferrer');
    return;
  }
  if (!state.google.connected) {
    showToast('Google Agenda n’est pas encore connecté', 'info');
    return;
  }

  const start = combineDateTime(prospect.reminderDate, prospect.reminderTime || '09:00');
  const end = new Date(start.getTime() + 30 * 60000);
  const calendarMeta = getCurrentAdminCalendarMeta();
  const event = await createGoogleCalendarEvent({
    summary: `${calendarMeta.adminName} · Relance ${prospect.name}`,
    description: [
      `Créé depuis L'Atelier CRM par ${calendarMeta.adminName}`,
      prospect.reminderNote,
      prospect.notes,
      prospect.phone ? `Téléphone : ${prospect.phone}` : '',
      prospect.socialHandle ? `Pseudo : ${prospect.socialHandle}` : '',
    ].filter(Boolean).join('\n'),
    attendeeEmail: prospect.email || '',
    attendeeName: prospect.name,
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    timeZone: 'Europe/Paris',
    colorId: calendarMeta.colorId,
  });
  prospect.googleEvent = {
    ...event,
    createdById: calendarMeta.adminId,
    createdByName: calendarMeta.adminName,
    colorId: calendarMeta.colorId,
    syncedAt: new Date().toISOString(),
  };
  prospect.updatedAt = Date.now();
  saveProspects();
  renderProspects();
  renderDashboard();
  if (state.viewingProspectId === prospect.id) openProspectDetail(prospect.id);
  showToast(event.meetLink ? 'Rendez-vous Google + Meet créés' : 'Rendez-vous Google créé', 'success');
  if (event.htmlLink) window.open(event.htmlLink, '_blank', 'noopener,noreferrer');
}

async function syncTodoToGoogle(todoId) {
  const todo = todos.find(item => item.id === todoId);
  if (!todo?.dueDate) {
    showToast('Ajoute une date à cette tâche avant de créer le rendez-vous', 'info');
    return;
  }
  const existing = getGoogleEventMeta(todo);
  if (existing?.htmlLink) {
    window.open(existing.htmlLink, '_blank', 'noopener,noreferrer');
    return;
  }
  if (!state.google.connected) {
    showToast('Google Agenda n’est pas encore connecté', 'info');
    return;
  }

  const linkedProspect = todo.contextType === 'prospect' ? prospects.find(item => item.id === todo.contextId) : null;
  const linkedStudent = todo.contextType === 'student' ? state.students.find(item => item.id === todo.contextId) : null;
  const attendeeEmail = linkedProspect?.email || linkedStudent?.email || '';
  const attendeeName = linkedProspect?.name || linkedStudent?.name || '';
  const description = [
    `Créé depuis L'Atelier CRM par ${getCurrentAdminCalendarMeta().adminName}`,
    todo.rawInput || todo.title,
    linkedProspect?.phone ? `Téléphone : ${linkedProspect.phone}` : '',
    linkedProspect?.socialHandle ? `Pseudo : ${linkedProspect.socialHandle}` : '',
    linkedStudent?.phone ? `Téléphone : ${linkedStudent.phone}` : '',
  ].filter(Boolean).join('\n');
  const start = combineDateTime(todo.dueDate, todo.dueTime || '09:00');
  const end = new Date(start.getTime() + 30 * 60000);
  const calendarMeta = getCurrentAdminCalendarMeta();
  const event = await createGoogleCalendarEvent({
    summary: `${calendarMeta.adminName} · ${todo.title}`,
    description,
    attendeeEmail,
    attendeeName,
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    timeZone: 'Europe/Paris',
    colorId: calendarMeta.colorId,
  });
  todo.googleEvent = {
    ...event,
    createdById: calendarMeta.adminId,
    createdByName: calendarMeta.adminName,
    colorId: calendarMeta.colorId,
    syncedAt: new Date().toISOString(),
  };
  saveTodos();
  renderTodos();
  renderDashboard();
  showToast(event.meetLink ? 'Tâche synchronisée sur Google + Meet' : 'Tâche synchronisée sur Google', 'success');
  if (event.htmlLink) window.open(event.htmlLink, '_blank', 'noopener,noreferrer');
}

function buildAiPrompts(kind, payload) {
  const base = aiConfig.style || AI_DEFAULTS.style;
  const system = `${base} Réponds en français. Sois court, structuré, sans jargon inutile.`;
  const context = JSON.stringify(payload, null, 2);
  const taskMap = {
    summary: `Résume cette fiche ${payload.kind} en 4 lignes maximum. Mets l'essentiel: profil, origine, état actuel, point d'attention.`,
    'next-step': `Propose la prochaine action la plus logique pour cette fiche ${payload.kind}. Réponse ultra actionnable: 1 action principale, 1 moment conseillé, 1 phrase d'explication.`,
    message: `Rédige un message court prêt à envoyer pour cette fiche ${payload.kind}. Ton direct, simple, humain, orienté conversion. Pas d'introduction théorique.`,
  };
  return {
    system,
    user: `${taskMap[kind]}\n\nContexte:\n${context}`,
  };
}

function extractOpenAiText(data) {
  if (data.output_text) return data.output_text;
  const texts = [];
  (data.output || []).forEach(item => {
    (item.content || []).forEach(content => {
      if (content.text) texts.push(content.text);
    });
  });
  return texts.join('\n').trim();
}

async function requestAiCompletion(system, user) {
  const provider = aiConfig.provider;
  const providerConfig = getActiveAiProviderConfig();
  if (!providerConfig.apiKey) throw new Error('Ajoute une clé API dans Assistant IA.');

  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: providerConfig.model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: system }] },
          { role: 'user', content: [{ type: 'input_text', text: user }] },
        ],
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Erreur OpenAI');
    return extractOpenAiText(data);
  }

  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': providerConfig.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: providerConfig.model,
        max_tokens: 700,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Erreur Claude');
    return (data.content || []).map(item => item.text || '').join('\n').trim();
  }

  if (provider === 'groq') {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: providerConfig.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Erreur Groq');
    return data?.choices?.[0]?.message?.content?.trim() || '';
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(providerConfig.model)}:generateContent?key=${encodeURIComponent(providerConfig.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ parts: [{ text: user }] }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Erreur Gemini');
  return (data.candidates?.[0]?.content?.parts || []).map(item => item.text || '').join('\n').trim();
}

async function runAiAction(kind, entityType, id) {
  const payload = getEntityAiPayload(entityType, id);
  if (!payload) return;
  const key = getAiDraftKey(entityType, id);
  state.aiDrafts[key] = { kind, loading: true, text: '', error: '' };
  const output = document.getElementById(`aiOutput-${entityType}-${id}`);
  if (output) {
    output.className = 'ai-output loading';
    output.textContent = 'Analyse en cours...';
  }

  try {
    const { system, user } = buildAiPrompts(kind, payload);
    const text = await requestAiCompletion(system, user);
    state.aiDrafts[key] = { kind, loading: false, text: text || 'Aucune réponse.', error: '' };
  } catch (error) {
    state.aiDrafts[key] = { kind, loading: false, text: '', error: error.message || 'Erreur IA' };
  }

  if (entityType === 'student' && state.viewingId === id) openDetail(id);
  if (entityType === 'prospect' && state.viewingProspectId === id) openProspectDetail(id);
}

function todoItemHtml(todo) {
  const contextLabel = todo.contextType === 'prospect' ? '👤 Lead' : todo.contextType === 'student' ? '🎓 Client' : '';
  const contextName = getContextDisplayName(todo.contextType, todo.contextId);
  const ownerName = getTodoOwnerName(todo);
  const leadActionLabel = todo.contextType === 'prospect' ? 'Qualifier' : todo.contextType === 'student' ? 'Changer fiche' : 'Lier fiche';
  const hasLinkedRecord = Boolean(todo.contextType && todo.contextId && contextName);
  
  return `
    <div class="todo-item ${todo.status}" data-id="${esc(todo.id)}">
      <label class="todo-checkbox">
        <input type="checkbox" ${todo.status === 'done' ? 'checked' : ''} data-todo-toggle="${esc(todo.id)}">
        <span class="todo-check"></span>
      </label>
      <div class="todo-content">
        <div class="todo-title">${esc(todo.title)}</div>
        <div class="todo-meta">
          ${todo.dueDate ? `<span class="todo-date">📅 ${formatDate(todo.dueDate)}${todo.dueTime ? ' · ' + todo.dueTime : ''}</span>` : ''}
          ${contextName ? `<span class="todo-context">${contextLabel} · ${esc(contextName)}</span>` : ''}
          ${hasLinkedRecord ? `<span class="todo-linked-tag">Liée</span>` : ''}
          ${ownerName ? `<span class="todo-assignee">👤 ${esc(ownerName)}</span>` : ''}
          ${todo.mentions.length ? `<span class="todo-mentions">${todo.mentions.map(m => '@' + esc(m)).join(', ')}</span>` : ''}
        </div>
      </div>
      <div class="todo-actions">
        ${todo.dueDate ? buildGoogleButtons('todo', todo) : ''}
        ${hasLinkedRecord ? `<button class="todo-action-btn todo-edit" type="button" data-todo-open-context="${esc(todo.id)}" title="Ouvrir la fiche liée">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3v2h3.59L7 15.59 8.41 17 19 6.41V10h2V3z"/><path d="M19 19H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7z"/></svg>
        </button>` : ''}
        <button class="todo-action-btn todo-edit" type="button" data-todo-edit="${esc(todo.id)}" title="Modifier">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75l11-11-3.75-3.75-11 11zM20.71 7.04a1.003 1.003 0 000-1.42L18.37 3.29a1.003 1.003 0 00-1.42 0L15.13 5.11l3.75 3.75 1.83-1.82z"/></svg>
        </button>
        <button class="todo-action-btn todo-link-btn" type="button" data-todo-link="${esc(todo.id)}" title="${esc(leadActionLabel)}">
          ${esc(leadActionLabel)}
        </button>
        <button class="todo-action-btn todo-delete" type="button" data-todo-delete="${esc(todo.id)}" title="Supprimer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    </div>
  `;
}

// ─── JOURNAL ──────────────────────────────────────────────────────────────────
function logAction(action, studentName, detail) {
  logActivity(action, 'student', studentName, detail);
}

function logActivity(action, entityType, label, detail) {
  if (!state.currentUser) return;
  const entry = {
    id: generateId(),
    adminId: state.currentUser.id,
    adminName: state.currentUser.name,
    action,
    entityType,
    label,
    detail,
    timestamp: Date.now(),
  };
  state.journal.unshift(entry);
  if (state.journal.length > 500) state.journal = state.journal.slice(0, 500);
  saveJournal();
}

const ACTION_LABELS = {
  add:    { label: 'Ajout',        color: '#34C759', bg: '#EAFAF0', icon: '➕' },
  edit:   { label: 'Modification', color: '#FF9500', bg: '#FFF4E5', icon: '✏️' },
  delete: { label: 'Suppression',  color: '#FF3B30', bg: '#FFF0EF', icon: '🗑️' },
};

const ENTITY_LABELS = {
  student: { label: 'Client', icon: '🎓' },
  prospect: { label: 'Lead', icon: '👤' },
  todo: { label: 'Tache', icon: '✓' },
  idea: { label: 'Idee', icon: '💡' },
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function tryLogin(u, p) {
  const admin = ADMINS.find(a => a.username === u && a.password === p);
  if (!admin) return false;
  state.currentUser = admin;
  localStorage.setItem('crm_session', JSON.stringify(admin));
  return true;
}

function logout() {
  state.currentUser = null;
  localStorage.removeItem('crm_session');
  showLogin();
}

function checkSession() {
  try {
    const s = JSON.parse(localStorage.getItem('crm_session') || 'null');
    if (s) { const v = ADMINS.find(a => a.id === s.id); if (v) { state.currentUser = v; return true; } }
  } catch {}
  return false;
}

function isWaxx() {
  return state.currentUser?.username === 'waxx';
}

// ─── VIEWS ────────────────────────────────────────────────────────────────────
function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appShell').style.display = 'none';
}

function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';
  document.getElementById('sidebarUserName').textContent  = state.currentUser.name;
  document.getElementById('sidebarUserAvatar').textContent = state.currentUser.name[0];
  document.getElementById('mobileUserAvatar').textContent  = state.currentUser.name[0];
  document.getElementById('welcomeName').textContent = state.currentUser.name;
  populateOwnerSelects();
  syncTradeSelectors();
  updateRoleVisibility();
  updateTodoBadges();
  clearTodoScheduleSelection();
  showView('dashboard');
}

function showView(view) {
  if (view === 'journal' && !isWaxx()) view = 'dashboard';
  if (view !== 'todos') state.todoDraftContext = null;
  if (view !== 'students') state.viewingId = null;
  if (view !== 'prospects') state.viewingProspectId = null;
  ['dashView','studentsView','analyticsView','journalView','prospectsView','todosView','ideasView','aiView'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
  const map = { dashboard: 'dashView', students: 'studentsView', analytics: 'analyticsView', journal: 'journalView', prospects: 'prospectsView', todos: 'todosView', ideas: 'ideasView', ai: 'aiView' };
  if (map[view]) document.getElementById(map[view]).style.display = 'block';

  // Update desktop sidebar
  document.querySelectorAll('.nav-link').forEach(el =>
    el.classList.toggle('active', el.dataset.view === view)
  );
  // Update mobile bottom nav
  document.querySelectorAll('.mobile-nav-item[data-view]').forEach(el =>
    el.classList.toggle('active', el.dataset.view === view)
  );

  // Scroll to top on view change
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (view === 'dashboard')  renderDashboard();
  if (view === 'students')   renderStudents();
  if (view === 'analytics')  renderAnalytics();
  if (view === 'journal')    renderJournal();
  if (view === 'prospects')  renderProspects();
  if (view === 'todos')      renderTodos();
  if (view === 'ideas')      renderIdeas();
  if (view === 'ai')         renderAiHub();
  
  updateTodoBadges();
}

function updateTodoBadges() {
  const todayCount = getTodayTodos().length;
  const overdueCount = getOverdueTodos().length;
  const totalPending = todayCount + overdueCount;
  
  document.querySelectorAll('.todo-badge').forEach(badge => {
    if (totalPending > 0) {
      badge.textContent = totalPending;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  });
}

function updateRoleVisibility() {
  const showJournal = isWaxx();
  document.querySelectorAll('.nav-journal-only').forEach(el => {
    el.style.display = showJournal ? 'flex' : 'none';
  });
  document.querySelectorAll('.ai-config-only').forEach(el => {
    el.style.display = showJournal ? '' : 'none';
  });
  const aiConfigNote = document.querySelector('.ai-config-note');
  if (aiConfigNote) aiConfigNote.style.display = showJournal ? 'none' : 'block';
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✗', info: 'ℹ', warning: '⚠' };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${esc(message)}</span>`;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function confirmAction(message, onConfirm) {
  pendingConfirmAction = onConfirm;
  document.getElementById('confirmMessage').textContent = message;
  openModal('confirmModal');
}

let pendingConfirmAction = null;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getContextDisplayName(contextType, contextId) {
  if (!contextType || !contextId) return null;
  if (contextType === 'prospect') return prospects.find(p => p.id === contextId)?.name || null;
  if (contextType === 'student') return state.students.find(s => s.id === contextId)?.name || null;
  return null;
}

function getTodoOwnerName(todo) {
  return todo.ownerName || ADMINS.find(a => a.id === (todo.ownerId || todo.createdBy))?.name || null;
}

function setTodoDraftContext(contextType, contextId) {
  const name = getContextDisplayName(contextType, contextId);
  if (!name) return;
  state.todoDraftContext = { type: contextType, id: contextId, name };
  showView('todos');
  setTimeout(() => document.getElementById('todoInput').focus(), 100);
}

function renderTodoContextBar() {
  const bar = document.getElementById('todoContextBar');
  if (!bar) return;
  if (!state.todoDraftContext) {
    bar.style.display = 'none';
    bar.innerHTML = '';
    return;
  }

  const icon = state.todoDraftContext.type === 'prospect' ? '👤' : '🎓';
  bar.innerHTML = `
    <div class="todo-context-copy">
      ${icon} Tâche liée à <strong>${esc(state.todoDraftContext.name)}</strong>
    </div>
    <button class="btn-text" id="clearTodoContextBtn" type="button">Retirer</button>
  `;
  bar.style.display = 'flex';
}

function populateOwnerSelects() {
  const options = ADMINS.map(admin => `<option value="${admin.id}">${esc(admin.name)}</option>`).join('');
  const todoSelect = document.getElementById('todoOwnerSelect');
  const prospectSelect = document.getElementById('pfOwner');
  if (todoSelect) {
    todoSelect.innerHTML = options;
    todoSelect.value = state.currentUser?.id || ADMINS[0].id;
  }
  if (prospectSelect) {
    prospectSelect.innerHTML = `<option value="">— Non assigné —</option>${options}`;
  }
}

function getIdeaStatusMeta(status) {
  return {
    'to-discuss': 'À discuter',
    approved: 'Validée',
    testing: 'En test',
    rejected: 'Refusée',
  }[status] || 'À discuter';
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function formatCurrency(v) {
  if (!v && v !== 0) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDatetime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })
    + ' à ' + d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
}

function getInitials(name) {
  return (name||'?').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

const AV_COLORS = ['#007AFF','#34C759','#FF9500','#AF52DE','#5AC8FA','#FF2D55','#64D2FF'];
function avatarColor(name) {
  let s = 0; for (const c of (name||'')) s += c.charCodeAt(0);
  return AV_COLORS[s % AV_COLORS.length];
}

function getColorInfo(c) {
  const m = { green: { label:'Bon potentiel', hex:'#34C759' }, orange: { label:'À surveiller', hex:'#FF9500' }, red: { label:'En difficulté', hex:'#FF3B30' } };
  return m[c] || m.green;
}

function getTradeMeta(trade) {
  return TRADE_OPTIONS.find(option => option.value === trade) || { value: '', label: 'Métier non renseigné', icon: '🧰', hint: '' };
}

function renderTradeSelector(targetId, value) {
  const container = document.getElementById(targetId);
  if (!container) return;
  container.innerHTML = TRADE_OPTIONS.map(option => `
    <button
      class="trade-option ${option.value === value ? 'active' : ''}"
      type="button"
      data-trade-target="${esc(targetId.replace('Selector', ''))}"
      data-trade-value="${esc(option.value)}"
    >
      <span class="trade-option-icon">${option.icon}</span>
      <span class="trade-option-copy">
        <strong>${esc(option.label)}</strong>
        <span>${esc(option.hint)}</span>
      </span>
    </button>
  `).join('');
}

function syncTradeSelectors() {
  renderTradeSelector('fTradeSelector', document.getElementById('fTrade')?.value || '');
  renderTradeSelector('pfTradeSelector', document.getElementById('pfTrade')?.value || '');
}

function isDbConfigured() {
  return Boolean(dbConfig.url && dbConfig.anonKey && dbConfig.workspace);
}

function getRemoteStatePayload() {
  return {
    id: dbConfig.workspace,
    students: state.students,
    prospects,
    todos,
    ideas,
    journal: state.journal,
    ai_settings: aiConfig,
    google_settings: state.google,
    updated_at: new Date().toISOString(),
  };
}

function applyRemoteState(payload) {
  state.students = Array.isArray(payload.students) ? payload.students : [];
  prospects = Array.isArray(payload.prospects) ? payload.prospects : [];
  todos = Array.isArray(payload.todos) ? payload.todos : [];
  ideas = Array.isArray(payload.ideas) ? payload.ideas : [];
  state.journal = Array.isArray(payload.journal) ? payload.journal : [];
  if (payload.ai_settings && typeof payload.ai_settings === 'object') {
    aiConfig = mergeAiConfig(payload.ai_settings);
    localStorage.setItem('crm_ai_config', JSON.stringify(aiConfig));
  }
  state.google = payload.google_settings && typeof payload.google_settings === 'object'
    ? { ...getDefaultGoogleState(), ...payload.google_settings }
    : getDefaultGoogleState();
  localStorage.setItem('crm_students', JSON.stringify(state.students));
  localStorage.setItem('crm_journal', JSON.stringify(state.journal));
  localStorage.setItem('crm_prospects', JSON.stringify(prospects));
  localStorage.setItem('crm_todos', JSON.stringify(todos));
  localStorage.setItem('crm_ideas', JSON.stringify(ideas));
}

function getDbHeaders(extra = {}) {
  return {
    apikey: dbConfig.anonKey,
    Authorization: `Bearer ${dbConfig.anonKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function updateDbStatus(message, tone = 'neutral') {
  const note = document.getElementById('dbStatusNote');
  if (!note) return;
  note.textContent = message;
  note.style.color = tone === 'error' ? 'var(--red)' : tone === 'success' ? 'var(--green)' : 'var(--text2)';
}

async function loadRemoteState() {
  if (!isDbConfigured()) return false;
  try {
    updateDbStatus('Connexion à la base en cours...');
    const response = await fetch(`${dbConfig.url}/rest/v1/app_state?id=eq.${encodeURIComponent(dbConfig.workspace)}&select=*`, {
      headers: getDbHeaders(),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || 'Impossible de charger la base');
    if (Array.isArray(data) && data[0]) {
      applyRemoteState(data[0]);
      updateDbStatus('Base connectée. Données partagées chargées.', 'success');
      return true;
    }
    updateDbStatus('Base connectée. Aucune donnée distante trouvée pour ce workspace.', 'success');
    return false;
  } catch (error) {
    updateDbStatus(error.message || 'Erreur de connexion base', 'error');
    return false;
  }
}

async function saveRemoteState() {
  if (!isDbConfigured()) return;
  try {
    const response = await fetch(`${dbConfig.url}/rest/v1/app_state`, {
      method: 'POST',
      headers: getDbHeaders({
        Prefer: 'resolution=merge-duplicates,return=representation',
      }),
      body: JSON.stringify([getRemoteStatePayload()]),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || 'Impossible de sauvegarder la base');
    updateDbStatus('Base synchronisée avec succès.', 'success');
  } catch (error) {
    updateDbStatus(error.message || 'Erreur de synchronisation base', 'error');
  }
}

function queueRemoteSave() {
  if (!isDbConfigured()) return;
  window.clearTimeout(remoteSaveTimer);
  remoteSaveTimer = window.setTimeout(() => {
    saveRemoteState();
  }, 700);
}

function getActiveAiProviderConfig() {
  return aiConfig.providers[aiConfig.provider] || AI_DEFAULTS.providers.openai;
}

function populateAiModal() {
  const modalProvider = aiModalProvider || aiConfig.provider;
  document.querySelectorAll('#aiProviderTabs .segmented-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.provider === modalProvider);
  });
  const providerConfig = aiConfig.providers[modalProvider] || AI_DEFAULTS.providers[modalProvider];
  document.getElementById('aiModelInput').value = providerConfig.model || '';
  document.getElementById('aiApiKeyInput').value = providerConfig.apiKey || '';
  document.getElementById('aiStyleInput').value = aiConfig.style || '';
  document.getElementById('dbUrlInput').value = dbConfig.url || '';
  document.getElementById('dbAnonKeyInput').value = dbConfig.anonKey || '';
  document.getElementById('dbWorkspaceInput').value = dbConfig.workspace || DB_DEFAULTS.workspace;
  updateDbStatus(isDbConfigured() ? 'BDD configurée. Tu peux synchroniser ou charger les données partagées.' : 'BDD non configurée. Le CRM fonctionne encore en local sur ce navigateur.');
  updateGoogleStatusNote();
}

function openAiModal() {
  if (!isWaxx()) {
    showToast('Seul Waxx gère les clés API', 'info');
    return;
  }
  aiModalProvider = aiConfig.provider;
  populateAiModal();
  openModal('aiModal');
  fetchGoogleStatus();
}

async function saveAiModalConfig() {
  if (!isWaxx()) return;
  const provider = aiModalProvider || aiConfig.provider;
  aiConfig.provider = provider;
  aiConfig.providers[provider] = {
    ...aiConfig.providers[provider],
    model: document.getElementById('aiModelInput').value.trim() || AI_DEFAULTS.providers[provider].model,
    apiKey: document.getElementById('aiApiKeyInput').value.trim(),
  };
  aiConfig.style = document.getElementById('aiStyleInput').value.trim() || AI_DEFAULTS.style;
  saveAiConfig();
  dbConfig = {
    url: document.getElementById('dbUrlInput').value.trim().replace(/\/$/, ''),
    anonKey: document.getElementById('dbAnonKeyInput').value.trim(),
    workspace: document.getElementById('dbWorkspaceInput').value.trim() || DB_DEFAULTS.workspace,
  };
  saveDbConfig();
  if (isDbConfigured()) await saveRemoteState();
  closeModal('aiModal');
  showToast('Configuration IA et BDD enregistrée', 'success');
}

function getAiDraftKey(entityType, id) {
  return `${entityType}:${id}`;
}

function getEntityAiPayload(entityType, id) {
  if (entityType === 'student') {
    const student = state.students.find(item => item.id === id);
    if (!student) return null;
    return {
      kind: 'client',
      name: student.name,
      trade: getTradeMeta(student.trade).label,
      email: student.email || '',
      phone: student.phone || '',
      source: student.source || '',
      payment: student.method || '',
      amount: student.amount || '',
      notes: student.notes || '',
      active: student.active ? 'oui' : 'non',
      delivery: `site: ${student.website ? 'ok' : 'non'}, gmb: ${student.gmb ? 'ok' : 'non'}, logo: ${student.logo ? 'ok' : 'non'}`,
    };
  }

  const prospect = prospects.find(item => item.id === id);
  if (!prospect) return null;
  return {
    kind: 'lead',
    name: prospect.name,
    trade: getTradeMeta(prospect.trade).label,
    email: prospect.email || '',
    phone: prospect.phone || '',
    source: prospect.source || '',
    owner: prospect.ownerName || '',
    status: getProspectStatusMeta(prospect.status).label,
    reminder: prospect.reminderDate ? `${prospect.reminderDate} ${prospect.reminderTime || ''}`.trim() : 'aucune',
    reminderNote: prospect.reminderNote || '',
    notes: prospect.notes || '',
  };
}

function getAiPanelHtml(entityType, id) {
  const draft = state.aiDrafts[getAiDraftKey(entityType, id)];
  const statusClass = draft?.error ? 'error' : draft?.loading ? 'loading' : '';
  const title = draft?.kind === 'next-step' ? 'Prochaine action IA' : draft?.kind === 'message' ? 'Message IA' : 'Résumé IA';
  return `
    <div class="ai-card">
      <div class="ai-card-head">
        <div>
          <div class="detail-field-label">Assistant IA</div>
          <div class="ai-card-title">${title}</div>
        </div>
        <span class="stream-pill">${aiConfig.provider.toUpperCase()}</span>
      </div>
      <div class="ai-action-row">
        <button class="btn-ghost" type="button" data-ai-action="summary" data-entity-type="${esc(entityType)}" data-entity-id="${esc(id)}">Résumé</button>
        <button class="btn-ghost" type="button" data-ai-action="next-step" data-entity-type="${esc(entityType)}" data-entity-id="${esc(id)}">Prochaine action</button>
        <button class="btn-ghost" type="button" data-ai-action="message" data-entity-type="${esc(entityType)}" data-entity-id="${esc(id)}">Message</button>
      </div>
      <div class="ai-output ${statusClass}" id="aiOutput-${esc(entityType)}-${esc(id)}">${draft?.loading ? 'Analyse en cours...' : draft?.error ? esc(draft.error) : draft?.text ? esc(draft.text).replace(/\n/g, '<br>') : 'Lance une action IA pour obtenir un résumé, une action recommandée ou un message prêt à envoyer.'}</div>
    </div>
  `;
}

function buildAiWorkspacePayload() {
  const note = document.getElementById('aiWorkspaceInput')?.value.trim() || '';
  return {
    note,
    leadsCount: prospects.length,
    clientsCount: state.students.length,
    sources: [...new Set(prospects.map(item => item.source).filter(Boolean))].slice(0, 8),
    trades: [...new Set([...prospects, ...state.students].map(item => getTradeMeta(item.trade).label).filter(label => label && label !== 'Métier non renseigné'))].slice(0, 8),
    openLeads: prospects.filter(item => item.status !== 'signe').map(item => ({
      name: item.name,
      source: item.source || '',
      trade: getTradeMeta(item.trade).label,
      status: getProspectStatusMeta(item.status).label,
      reminder: item.reminderDate || '',
    })).slice(0, 12),
    recentClients: state.students.slice(-8).map(item => ({
      name: item.name,
      trade: getTradeMeta(item.trade).label,
      amount: item.amount || '',
      source: item.source || '',
    })),
  };
}

function buildAiWorkspacePrompt(kind, payload) {
  const intro = `${aiConfig.style || AI_DEFAULTS.style} Réponds en français. Sois concret, direct et très utile pour une équipe terrain.`;
  const tasks = {
    intake: `Transforme cette note brute en fiche CRM exploitable. Si la personne est deja signee, deja inscrite, deja eleve ou deja cliente, traite-la comme client. Sinon traite-la comme lead. Réponds avec ce format exact: Type de fiche, Nom probable, Métier probable, Source probable, Statut conseillé, Prochaine action, Date/heure suggérée, Notes propres.`,
    qualify: `Qualifie ce lead. Réponds avec ce format exact: Niveau du lead, Objections probables, Angle de relance, Risque principal, Signal d'achat.`,
    'next-step': `Dis quoi faire maintenant. La note brute prime toujours sur la base CRM. Si la note mentionne Thomas, ne réponds jamais Karim ou un autre nom pris dans les données. Réponds avec ce format exact: Action prioritaire, Quand le faire, Pourquoi, Texte court à dire au téléphone.`,
    message: `Rédige un message court prêt à envoyer. Commence directement par le message, ton simple, humain, terrain, sans explication annexe.`,
    business: `Lis les données CRM fournies et donne seulement 3 insights utiles. Pour chaque insight: constat, impact, action recommandée.`,
  };
  return {
    system: intro,
    user: `${tasks[kind]}\n\nContexte CRM:\n${JSON.stringify(payload, null, 2)}`,
  };
}

function getCurrentDateParts() {
  const now = new Date();
  return {
    now,
    date: now.toISOString().split('T')[0],
  };
}

function normalizePhone(phone) {
  return (phone || '').replace(/[^\d+]/g, '');
}

function extractLabeledValue(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = (text || '').match(new RegExp(`${escaped}\\s*:\\s*(.+)`, 'i'));
  return match?.[1]?.split('\n')[0]?.trim() || '';
}

function detectTradeValue(text) {
  const value = (text || '').toLowerCase();
  if (value.includes('maçon') || value.includes('macon')) return 'macon';
  if (value.includes('plombier')) return 'plombier';
  if (value.includes('serrurier')) return 'serrurier';
  if (value.includes('plaquiste')) return 'plaquiste';
  if (value.includes('charpentier')) return 'charpentier';
  if (value.includes('autre')) return 'autre';
  return '';
}

function detectSourceValue(text) {
  const value = (text || '').toLowerCase();
  const sourceMap = [
    ['tiktok commentaire', 'TikTok commentaire'],
    ['tiktok comment', 'TikTok commentaire'],
    ['tiktok live', 'TikTok live'],
    ['tiktok ads', 'TikTok ads'],
    ['instagram ads', 'Instagram ads'],
    ['instagram', 'Instagram'],
    ['podcast', 'Podcast'],
    ['youtube', 'YouTube'],
    ['bouche à oreille', 'Bouche à oreille'],
    ['bouche a oreille', 'Bouche à oreille'],
    ['référence client', 'Référence client'],
    ['reference client', 'Référence client'],
  ];
  return sourceMap.find(([needle]) => value.includes(needle))?.[1] || '';
}

function detectEntityType(text) {
  const value = (text || '').toLowerCase();
  if (value.includes('type de fiche') && value.includes('client')) return 'student';
  if (/(devenu élève|devenu eleve|eleve de la formation|élève de la formation|déjà client|deja client|inscrit aujourd'hui|inscrit aujourd’hui|a signé|a signe|client signé|client signe)/i.test(text || '')) {
    return 'student';
  }
  return 'prospect';
}

function detectProspectStatus(text) {
  const value = (text || '').toLowerCase();
  if (value.includes('signé') || value.includes('signe') || value.includes('client signé') || value.includes('client signe')) return 'signe';
  if (value.includes('chaud') || value.includes('qualifié') || value.includes('qualifie') || value.includes('1er contact')) return 'chaud';
  return 'froid';
}

function detectPaymentMethod(text) {
  const value = (text || '').toLowerCase();
  if (value.includes('skool') || value.includes('stripe')) return 'Skool / Stripe';
  if (value.includes('rib') || value.includes('virement')) return 'RIB';
  return '';
}

function extractContactDetails(text) {
  const source = text || '';
  const email = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.trim() || '';
  const phone = source.match(/(?:\+33|0)[\s.()-]*\d(?:[\s.()-]*\d){8,}/)?.[0]?.trim() || '';
  let name = extractLabeledValue(source, 'Nom probable');

  if (!name) {
    const actionName = source.match(/\b(?:appeler|rappeler|revoir|contacter|call avec|call)\s+([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'’-]+)/i)?.[1];
    if (actionName) name = actionName.trim();
  }

  if (!name) {
    const cleaned = source
      .replace(email, ' ')
      .replace(phone, ' ')
      .replace(/\bil est devenu.+$/i, ' ')
      .replace(/\best devenu.+$/i, ' ')
      .trim();
    name = cleaned.match(/([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'’-]+(?:\s+[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ'’-]+){1,2})/)?.[1]?.trim() || '';
  }

  return { name, email, phone };
}

function parseIntakeResult(aiText, noteText) {
  const combined = [aiText || '', noteText || ''].filter(Boolean).join('\n');
  const contact = extractContactDetails(noteText || aiText || '');
  const notes = extractLabeledValue(aiText, 'Notes propres');
  const action = extractLabeledValue(aiText, 'Prochaine action');
  const schedule = extractLabeledValue(aiText, 'Date/heure suggérée');
  const scheduleMatch = schedule.match(/(\d{1,2})[:hH](\d{2})?/);
  const reminderTime = scheduleMatch
    ? `${String(Number(scheduleMatch[1])).padStart(2, '0')}:${String(scheduleMatch[2] || '00').padStart(2, '0')}`
    : '';

  return {
    entityType: detectEntityType(`${extractLabeledValue(aiText, 'Type de fiche')}\n${combined}`),
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    trade: detectTradeValue(`${extractLabeledValue(aiText, 'Métier probable')}\n${combined}`),
    source: detectSourceValue(`${extractLabeledValue(aiText, 'Source probable')}\n${combined}`),
    prospectStatus: detectProspectStatus(`${extractLabeledValue(aiText, 'Statut conseillé')}\n${combined}`),
    reminderNote: action || '',
    reminderDate: /demain/i.test(schedule) ? new Date(Date.now() + 86400000).toISOString().split('T')[0] : getCurrentDateParts().date,
    reminderTime,
    notes: [notes, noteText].filter(Boolean).join('\n\n').trim(),
    method: detectPaymentMethod(combined),
  };
}

function upsertCrmRecordFromAi(parsed) {
  if (!parsed.name || !parsed.phone) {
    throw new Error('La note doit contenir au minimum un nom et un numéro de téléphone pour créer une fiche.');
  }

  const owner = state.currentUser || ADMINS[0];
  const phoneKey = normalizePhone(parsed.phone);
  const emailKey = (parsed.email || '').trim().toLowerCase();

  if (parsed.entityType === 'student') {
    const existingIndex = state.students.findIndex(item =>
      (phoneKey && normalizePhone(item.phone) === phoneKey) ||
      (emailKey && (item.email || '').trim().toLowerCase() === emailKey)
    );
    const previous = existingIndex >= 0 ? state.students[existingIndex] : null;
    const student = {
      id: previous?.id || generateId(),
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      trade: parsed.trade || previous?.trade || '',
      skoolDate: previous?.skoolDate || getCurrentDateParts().date,
      amount: previous?.amount || '',
      method: parsed.method || previous?.method || '',
      color: previous?.color || 'green',
      website: previous?.website || false,
      gmb: previous?.gmb || false,
      logo: previous?.logo || false,
      active: true,
      notes: parsed.notes || previous?.notes || '',
      photo: previous?.photo || null,
      source: parsed.source || previous?.source || '',
      originProspectId: previous?.originProspectId || '',
      convertedAt: previous?.convertedAt || Date.now(),
      createdAt: previous?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      state.students[existingIndex] = student;
      logAction('edit', student.name, 'Client mis à jour depuis l’atelier IA');
      logActivity('edit', 'student', student.name, 'Client mis à jour depuis l’atelier IA');
    } else {
      state.students.unshift(student);
      logAction('add', student.name, 'Client créé depuis l’atelier IA');
      logActivity('add', 'student', student.name, 'Client créé depuis l’atelier IA');
    }

    saveStudents();
    renderStudents();
    renderDashboard();
    return { entityType: 'student', name: student.name, action: existingIndex >= 0 ? 'updated' : 'created' };
  }

  const existingIndex = prospects.findIndex(item =>
    (phoneKey && normalizePhone(item.phone) === phoneKey) ||
    (emailKey && (item.email || '').trim().toLowerCase() === emailKey)
  );
  const previous = existingIndex >= 0 ? prospects[existingIndex] : null;
  const prospect = {
    id: previous?.id || generateId(),
    name: parsed.name,
    phone: parsed.phone,
    email: parsed.email,
    trade: parsed.trade || previous?.trade || '',
    source: parsed.source || previous?.source || '',
    ownerId: previous?.ownerId || owner.id,
    ownerName: previous?.ownerName || owner.name,
    status: parsed.prospectStatus || previous?.status || 'froid',
    reminderDate: parsed.reminderDate || previous?.reminderDate || '',
    reminderTime: parsed.reminderTime || previous?.reminderTime || '',
    reminderNote: parsed.reminderNote || previous?.reminderNote || '',
    notes: parsed.notes || previous?.notes || '',
    createdAt: previous?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  if (existingIndex >= 0) {
    prospects[existingIndex] = prospect;
    logActivity('edit', 'prospect', prospect.name, 'Lead mis à jour depuis l’atelier IA');
  } else {
    prospects.unshift(prospect);
    logActivity('add', 'prospect', prospect.name, `Lead créé depuis l’atelier IA · Étape : ${getProspectStatusMeta(prospect.status).label}`);
  }

  saveProspects();
  renderProspects();
  renderDashboard();
  return { entityType: 'prospect', name: prospect.name, action: existingIndex >= 0 ? 'updated' : 'created' };
}

function parseNextStepResult(aiText, noteText) {
  const noteParsed = parseNaturalInput(noteText || '');
  const aiParsed = parseNaturalInput(aiText || '');
  const action = extractLabeledValue(aiText, 'Action prioritaire') || '';
  const when = extractLabeledValue(aiText, 'Quand le faire') || '';
  const why = extractLabeledValue(aiText, 'Pourquoi') || '';
  const phoneScript = extractLabeledValue(aiText, 'Texte court à dire au téléphone') || '';
  const fallbackName = extractContactDetails(noteText || '').name;
  const noteDrivenTitle = fallbackName ? `Appeler ${fallbackName}` : '';
  const title = noteDrivenTitle
    || action
    || (noteText ? noteText.trim() : 'Prochaine action');
  const dueDate = noteParsed.dueDate || aiParsed.dueDate || null;
  const dueTime = noteParsed.dueTime || aiParsed.dueTime || null;
  const details = [why, phoneScript].filter(Boolean).join(' · ');

  return {
    title,
    dueDate,
    dueTime,
    details,
    when,
  };
}

function renderAiHub() {
  const providerLabel = document.getElementById('aiHubProviderLabel');
  if (providerLabel) providerLabel.textContent = aiConfig.provider.toUpperCase();
  const voiceBtn = document.getElementById('aiVoiceBtn');
  const voiceStatus = document.getElementById('aiVoiceStatus');
  if (voiceBtn) {
    voiceBtn.classList.toggle('listening', aiSpeechListening);
    voiceBtn.textContent = aiSpeechListening ? 'Stop micro' : 'Micro';
  }
  if (voiceStatus && !aiSpeechListening && !voiceStatus.dataset.manual) {
    voiceStatus.textContent = 'Parle pour dicter une note directement dans l’atelier IA.';
  }
  const output = document.getElementById('aiWorkspaceOutput');
  if (!output) return;
  output.className = `ai-hub-output ${state.aiWorkspaceResult.loading ? 'loading' : state.aiWorkspaceResult.error ? 'error' : ''}`.trim();
  if (state.aiWorkspaceResult.loading) output.textContent = 'Analyse IA en cours...';
  else if (state.aiWorkspaceResult.error) output.textContent = state.aiWorkspaceResult.error;
  else if (state.aiWorkspaceResult.text) output.textContent = state.aiWorkspaceResult.text;
  else output.innerHTML = `Choisis une fonction IA pour lancer une réponse utile. Le meilleur point d'entrée ici, c'est souvent <strong>Créer une fiche depuis une note</strong>.`;
}

function setAiVoiceStatus(message, isManual = false) {
  const status = document.getElementById('aiVoiceStatus');
  if (!status) return;
  status.textContent = message;
  if (isManual) status.dataset.manual = '1';
  else delete status.dataset.manual;
}

function getAiVoiceSupportState() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hostname = window.location.hostname;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isSecureEnough = window.isSecureContext || isLocalHost;
  const isFirefox = /firefox/i.test(navigator.userAgent || '');
  const hasMediaDevices = Boolean(navigator.mediaDevices?.getUserMedia);

  if (!isSecureEnough) {
    return {
      supported: false,
      reason: 'La dictée vocale demande une page sécurisée en HTTPS.',
    };
  }

  if (isFirefox) {
    return {
      supported: false,
      reason: 'Firefox ne gère pas correctement cette dictée web. Utilise plutôt Chrome ou Safari.',
    };
  }

  if (!SpeechRecognition) {
    return {
      supported: false,
      reason: 'La dictée native du navigateur n’est pas disponible ici. Essaie avec Chrome ou Safari récent.',
    };
  }

  if (!hasMediaDevices) {
    return {
      supported: false,
      reason: 'Le navigateur ne donne pas accès au micro sur cette page.',
    };
  }

  return { supported: true, reason: '' };
}

function setupAiVoiceRecognition() {
  const support = getAiVoiceSupportState();
  if (!support.supported) return false;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!aiSpeechRecognition) {
    aiSpeechRecognition = new SpeechRecognition();
    aiSpeechRecognition.lang = 'fr-FR';
    aiSpeechRecognition.interimResults = true;
    aiSpeechRecognition.continuous = true;

    aiSpeechRecognition.onstart = () => {
      aiSpeechListening = true;
      setAiVoiceStatus('Écoute en cours... le micro reste actif jusqu’à Stop micro.', true);
      renderAiHub();
    };

    aiSpeechRecognition.onresult = event => {
      const input = document.getElementById('aiWorkspaceInput');
      if (!input) return;

      let finalChunk = '';
      let interimChunk = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || '';
        if (!transcript) continue;
        if (event.results[index].isFinal) finalChunk += `${transcript} `;
        else interimChunk += `${transcript} `;
      }

      if (finalChunk.trim()) {
        aiSpeechCommittedText = `${aiSpeechCommittedText} ${finalChunk}`.trim();
      }

      input.value = [aiSpeechCommittedText, interimChunk.trim()].filter(Boolean).join(' ').trim();
      setAiVoiceStatus('Dictée en cours... tu peux continuer à parler ou cliquer sur Stop micro.', true);
    };

    aiSpeechRecognition.onerror = event => {
      const messages = {
        'not-allowed': 'Le navigateur bloque le micro. Autorise le micro puis réessaie.',
        'service-not-allowed': 'La reconnaissance vocale n’est pas autorisée dans ce navigateur.',
        'no-speech': 'Aucune voix détectée. Réessaie en parlant un peu plus près du micro.',
        'audio-capture': 'Aucun micro détecté sur cet appareil.',
        'network': 'Erreur du service de reconnaissance vocale du navigateur.',
        'aborted': 'Dictée interrompue avant la fin.',
      };
      aiSpeechShouldContinue = false;
      aiSpeechListening = false;
      setAiVoiceStatus(messages[event.error] || `Erreur de dictée vocale : ${event.error || 'inconnue'}.`, true);
      renderAiHub();
    };

    aiSpeechRecognition.onend = () => {
      aiSpeechListening = false;
      if (aiSpeechShouldContinue) {
        setAiVoiceStatus('Pause détectée... reprise de l’écoute.', true);
        renderAiHub();
        window.setTimeout(() => {
          if (!aiSpeechShouldContinue) return;
          try {
            aiSpeechRecognition.start();
          } catch {
            setAiVoiceStatus('La dictée s’est arrêtée. Reclique sur Micro pour reprendre.', true);
            renderAiHub();
          }
        }, 180);
        return;
      }
      renderAiHub();
    };
  }
  return true;
}

async function ensureAiMicrophoneAccess() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('media-devices-unavailable');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach(track => track.stop());
  return true;
}

function stopAiVoiceCapture(statusMessage = 'Dictée arrêtée. Tu peux lancer une action IA sur le texte capturé.') {
  aiSpeechShouldContinue = false;
  if (aiSpeechRecognition && aiSpeechListening) {
    try {
      aiSpeechRecognition.stop();
    } catch {}
  }
  setAiVoiceStatus(statusMessage, true);
  renderAiHub();
}

async function toggleAiVoiceCapture() {
  const support = getAiVoiceSupportState();
  if (!support.supported || !setupAiVoiceRecognition()) {
    setAiVoiceStatus(support.reason || 'La dictée vocale n’est pas disponible dans ce navigateur.', true);
    showToast('Dictée vocale non supportée ici', 'warning');
    renderAiHub();
    return;
  }

  if (aiSpeechListening) {
    stopAiVoiceCapture();
    return;
  }

  try {
    await ensureAiMicrophoneAccess();
    const input = document.getElementById('aiWorkspaceInput');
    aiSpeechCommittedText = input?.value?.trim() || '';
    aiSpeechShouldContinue = true;
    aiSpeechRecognition.start();
  } catch (error) {
    aiSpeechShouldContinue = false;
    if (error?.name === 'NotAllowedError') {
      setAiVoiceStatus('Le micro est refusé. Autorise le micro dans le navigateur puis réessaie.', true);
      return;
    }
    if (error?.name === 'NotFoundError') {
      setAiVoiceStatus('Aucun micro détecté sur cet appareil.', true);
      return;
    }
    if (error?.message === 'media-devices-unavailable') {
      setAiVoiceStatus('Le navigateur ne permet pas de demander l’accès micro sur cette page.', true);
      return;
    }
    setAiVoiceStatus(`La dictée vocale ne peut pas démarrer (${error?.name || 'erreur inconnue'}).`, true);
  }
}

async function runAiWorkspaceAction(kind) {
  if (aiSpeechListening || aiSpeechShouldContinue) {
    stopAiVoiceCapture('Dictée arrêtée pour lancer l’action IA.');
    await new Promise(resolve => window.setTimeout(resolve, 220));
  }

  const payload = buildAiWorkspacePayload();
  if (!payload.note && kind !== 'business') {
    state.aiWorkspaceResult = { loading: false, text: '', error: 'Colle d’abord une note ou un contexte dans l’atelier IA.' };
    renderAiHub();
    return;
  }

  state.aiWorkspaceResult = { loading: true, text: '', error: '' };
  renderAiHub();
  try {
    const { system, user } = buildAiWorkspacePrompt(kind, payload);
    const text = await requestAiCompletion(system, user);
    let finalText = text || 'Aucune réponse.';

    if (kind === 'intake') {
      const parsed = parseIntakeResult(finalText, payload.note);
      const result = upsertCrmRecordFromAi(parsed);
      finalText = `${finalText}\n\nFiche ${result.entityType === 'student' ? 'client' : 'lead'} ${result.action === 'created' ? 'créée' : 'mise à jour'} dans ${result.entityType === 'student' ? 'Clients' : 'Leads'} : ${result.name}`;
      showToast(`${result.entityType === 'student' ? 'Client' : 'Lead'} ${result.action === 'created' ? 'créé' : 'mis à jour'} : ${result.name}`, 'success');
    }

    if (kind === 'next-step') {
      const parsed = parseNextStepResult(finalText, payload.note);
      const todo = createAiTodo({
        title: parsed.title,
        dueDate: parsed.dueDate,
        dueTime: parsed.dueTime,
        note: [payload.note, parsed.details].filter(Boolean).join('\n\n'),
      });
      finalText = `${finalText}\n\nTâche créée dans Suivi : ${todo.title}${todo.dueDate ? ` · ${formatDate(todo.dueDate)}` : ''}${todo.dueTime ? ` · ${todo.dueTime}` : ''}`;
      showToast(`Tâche créée : ${todo.title}`, 'success');
    }

    state.aiWorkspaceResult = { loading: false, text: finalText, error: '' };
  } catch (error) {
    state.aiWorkspaceResult = { loading: false, text: '', error: error.message || 'Erreur IA' };
    showToast(error.message || 'Erreur IA', 'warning');
  }
  renderAiHub();
}

function avatarHtml(student, size) {
  size = size || 52;
  if (student.photo) return `<img src="${esc(student.photo)}" class="student-avatar-img" style="width:${size}px;height:${size}px" alt="">`;
  const col = avatarColor(student.name);
  return `<div class="avatar-initials" style="width:${size}px;height:${size}px;background:${col};font-size:${Math.round(size*.35)}px">${esc(getInitials(student.name))}</div>`;
}

function getStudentDate(s) {
  if (s.skoolDate) return new Date(s.skoolDate + 'T00:00:00');
  return new Date(s.createdAt);
}

function startOfDay(d) { const r = new Date(d); r.setHours(0,0,0,0); return r; }

function getProspectStatusMeta(status) {
  return {
    froid: { label: 'Prospect', shortLabel: 'Prospect', icon: '🔵', accent: '#007AFF' },
    chaud: { label: '1er contact', shortLabel: '1er contact', icon: '🔥', accent: '#FF9500' },
    signe: { label: 'Client signé', shortLabel: 'Signé', icon: '✅', accent: '#34C759' },
  }[status] || { label: 'Lead', shortLabel: 'Lead', icon: '👤', accent: '#8E8E93' };
}

function getDeliveryStats(student) {
  const completed = [student.website, student.gmb, student.logo].filter(Boolean).length;
  return { completed, total: 3, percent: Math.round((completed / 3) * 100) };
}

function trendHtml(current, previous, isRevenue) {
  if (!previous && !current) return `<span class="stat-trend trend-flat">— Aucune donnée</span>`;
  if (!previous) return `<span class="stat-trend trend-up">↑ Nouveau</span>`;
  const diff = current - previous;
  const pct  = previous > 0 ? Math.round(Math.abs(diff)/previous*100) : 0;
  if (diff > 0) return `<span class="stat-trend trend-up">↑ +${isRevenue ? formatCurrency(diff) : diff} (${pct}%)</span>`;
  if (diff < 0) return `<span class="stat-trend trend-down">↓ ${isRevenue ? formatCurrency(diff) : diff} (${pct}%)</span>`;
  return `<span class="stat-trend trend-flat">→ Stable</span>`;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function renderDashboard() {
  const s = state.students;
  const activePipeline = prospects.filter(p => p.status !== 'signe').length;
  const activeClients = s.filter(x => x.active).length;
  const upcomingAgenda = getDashboardAgendaItems();
  const nextAgenda = upcomingAgenda[0] || null;
  const todayActions = getTodayTodos().length + prospects.filter(p => p.reminderDate === new Date().toISOString().split('T')[0]).length;
  document.getElementById('todayDate').textContent =
    new Date().toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  const total  = s.length;
  const revenue= s.reduce((sum,x) => sum+(parseFloat(x.amount)||0), 0);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const revenueThisMonth = s.filter(x => getStudentDate(x) >= thisMonthStart).reduce((sum,x) => sum+(parseFloat(x.amount)||0), 0);
  const revenueLastMonth = s.filter(x => { const d=getStudentDate(x); return d>=lastMonthStart && d<thisMonthStart; }).reduce((sum,x)=>sum+(parseFloat(x.amount)||0),0);
  const newThisMonth = s.filter(x => getStudentDate(x) >= thisMonthStart).length;
  const newLastMonth = s.filter(x => { const d=getStudentDate(x); return d>=lastMonthStart&&d<thisMonthStart; }).length;

  document.getElementById('statsRow').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon blue">📥</div>
      <div><div class="stat-value">${prospects.length}</div><div class="stat-label">Leads en base</div><span class="stat-trend trend-flat">${activePipeline} encore à travailler</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green">✅</div>
      <div><div class="stat-value">${newThisMonth}</div><div class="stat-label">Clients signés</div>${trendHtml(newThisMonth, newLastMonth, false)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon purple">📅</div>
      <div><div class="stat-value">${upcomingAgenda.length}</div><div class="stat-label">Rendez-vous à venir</div><span class="stat-trend trend-flat">${nextAgenda ? `${nextAgenda.timeLabel} · ${nextAgenda.title}` : `${activeClients} clients actifs`}</span></div>
    </div>
  `;
  renderDashboardBoards();

  const recentEl = document.getElementById('recentCards');
  const dashEmpty = document.getElementById('dashEmpty');
  const recentHeader = document.getElementById('recentHeader');
  const recent = [...s].sort((a,b)=>b.createdAt-a.createdAt).slice(0,6);

  if (recent.length === 0) {
    recentEl.innerHTML = ''; recentEl.style.display = 'none';
    recentHeader.style.display = 'none'; dashEmpty.style.display = 'block';
  } else {
    recentEl.style.display = 'grid'; recentHeader.style.display = 'flex';
    dashEmpty.style.display = 'none';
    recentEl.innerHTML = recent.map(studentCardHtml).join('');
  }

  renderDashboardReminders();
}

function getDashboardAgendaItems() {
  const now = new Date();
  const leadItems = prospects
    .filter(item => item.reminderDate)
    .map(item => {
      const startsAt = new Date(`${item.reminderDate}T${item.reminderTime || '09:00'}:00`);
      return {
        type: 'prospect',
        id: item.id,
        startsAt,
        googleEvent: item.googleEvent || null,
        dateLabel: formatDate(item.reminderDate),
        timeLabel: item.reminderTime || '09:00',
        title: item.name,
        subtitle: item.reminderNote || 'Relance lead',
        badge: 'Lead',
      };
    })
    .filter(item => item.startsAt.getTime() >= now.getTime() - 3600000);

  const todoItems = todos
    .filter(item => item.status === 'pending' && item.dueDate)
    .map(item => {
      const startsAt = new Date(`${item.dueDate}T${item.dueTime || '09:00'}:00`);
      return {
        type: 'todo',
        id: item.id,
        startsAt,
        googleEvent: item.googleEvent || null,
        dateLabel: formatDate(item.dueDate),
        timeLabel: item.dueTime || '09:00',
        title: item.title,
        subtitle: getContextDisplayName(item.contextType, item.contextId) || 'Tâche équipe',
        badge: 'Tâche',
      };
    })
    .filter(item => item.startsAt.getTime() >= now.getTime() - 3600000);

  return [...leadItems, ...todoItems]
    .sort((a, b) => a.startsAt - b.startsAt)
    .slice(0, 5);
}

function renderDashboardBoards() {
  const signed = prospects.filter(p => p.status === 'signe').slice(0, 2);
  const noReminder = prospects.filter(p => p.status !== 'signe' && !p.reminderDate).slice(0, 2);
  const delivery = state.students
    .filter(s => getDeliveryStats(s).completed < 3)
    .sort((a, b) => getDeliveryStats(a).completed - getDeliveryStats(b).completed)
    .slice(0, 2);
  const todayBoard = document.getElementById('todayBoard');
  const quickBoard = document.getElementById('quickBoard');
  const items = [];

  signed.forEach(p => {
    items.push(`<div class="simple-item"><div class="simple-item-copy"><strong>${esc(p.name)}</strong><span>Client signé, prêt à passer dans les clients.</span></div><button class="btn-ghost" type="button" onclick="openProspectDetail('${esc(p.id)}')">Ouvrir</button></div>`);
  });
  noReminder.forEach(p => {
    items.push(`<div class="simple-item"><div class="simple-item-copy"><strong>${esc(p.name)}</strong><span>Aucune relance programmée. Il faut poser une prochaine action.</span></div><button class="btn-ghost" type="button" onclick="openProspectDetail('${esc(p.id)}')">Relancer</button></div>`);
  });
  if (!items.length) items.push(`<div class="simple-item"><div class="simple-item-copy"><strong>Tout est à jour</strong><span>Aucune action bloquante détectée pour le moment.</span></div><span class="simple-item-pill">OK</span></div>`);
  todayBoard.innerHTML = items.join('');

  const deliveryLate = delivery.length;
  quickBoard.innerHTML = `
    <div class="quick-metric"><strong>${formatCurrency(state.students.reduce((sum, client) => sum + (parseFloat(client.amount) || 0), 0))}</strong><span>Chiffre d'affaires cumulé</span></div>
    <div class="quick-metric"><strong>${deliveryLate}</strong><span>Clients avec delivery ouvert</span></div>
    <div class="quick-metric"><strong>${prospects.filter(p => p.source === 'TikTok live' || p.source === 'TikTok commentaire').length}</strong><span>Leads venant de TikTok organique</span></div>
  `;
}

// ─── STUDENTS ─────────────────────────────────────────────────────────────────
function getFiltered() {
  let list = [...state.students];
  if (state.filter === 'active')  list = list.filter(s=>s.active);
  if (state.filter === 'green')   list = list.filter(s=>s.color==='green');
  if (state.filter === 'orange')  list = list.filter(s=>s.color==='orange');
  if (state.filter === 'red')     list = list.filter(s=>s.color==='red');
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter(s =>
      (s.name||'').toLowerCase().includes(q)||
      (s.email||'').toLowerCase().includes(q)||
      (s.phone||'').toLowerCase().includes(q)
    );
  }
  return list.sort((a,b)=>b.createdAt-a.createdAt);
}

function renderStudents() {
  const list = getFiltered();
  const grid = document.getElementById('studentsGrid');
  const empty = document.getElementById('emptyState');
  const total = state.students.length;
  document.getElementById('studentCount').textContent = `${total} client${total!==1?'s':''}`;
  if (list.length===0) { grid.innerHTML=''; empty.style.display='block'; }
  else { empty.style.display='none'; grid.innerHTML=list.map(studentCardHtml).join(''); }
}

function studentCardHtml(s) {
  const ci = getColorInfo(s.color);
  const delivery = getDeliveryStats(s);
  const trade = getTradeMeta(s.trade);
  return `
    <div class="student-card ${s.color||'green'}" data-id="${esc(s.id)}">
      <div class="card-top">
        ${avatarHtml(s,46)}
        <div class="card-info">
      <div class="card-name">${esc(s.name)}</div>
      <div class="card-email">${esc(s.email||'—')}</div>
      <div class="card-phone">${esc(s.phone||'')}</div>
      ${s.socialHandle ? `<div class="card-phone">${esc(s.socialHandle)}</div>` : ''}
        </div>
        <div class="color-dot" style="background:${ci.hex}" title="${ci.label}"></div>
      </div>
      <div class="card-badges">
        ${s.trade ? `<span class="trade-pill">${trade.icon} ${esc(trade.label)}</span>` : ''}
        ${s.amount?`<span class="badge badge-blue">${esc(formatCurrency(s.amount))}</span>`:''}
        ${s.method?`<span class="badge badge-gray">${esc(s.method)}</span>`:''}
        ${s.active?`<span class="badge badge-green">⚡ Actif</span>`:''}
        ${s.source?`<span class="badge badge-gray">Leads</span>`:''}
      </div>
      <div class="delivery-inline"><span>Delivery</span><strong>${delivery.completed}/${delivery.total}</strong></div>
      <div class="card-services">
        <div class="service-tag ${s.website?'done':''}">🌐 ${s.website?'✓':'✗'}</div>
        <div class="service-tag ${s.gmb?'done':''}">📍 ${s.gmb?'✓':'✗'}</div>
        <div class="service-tag ${s.logo?'done':''}">🎨 ${s.logo?'✓':'✗'}</div>
      </div>
    </div>
  `;
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
function renderAnalytics() {
  const s = state.students;
  const now = new Date();

  // KPIs
  const today     = startOfDay(now);
  const weekAgo   = new Date(today); weekAgo.setDate(weekAgo.getDate()-7);
  const monthAgo  = new Date(today); monthAgo.setDate(monthAgo.getDate()-30);
  const prevWeekStart  = new Date(weekAgo);  prevWeekStart.setDate(prevWeekStart.getDate()-7);
  const prevMonthStart = new Date(monthAgo); prevMonthStart.setDate(prevMonthStart.getDate()-30);

  const revToday     = s.filter(x=>getStudentDate(x)>=today).reduce((sum,x)=>sum+(parseFloat(x.amount)||0),0);
  const revWeek      = s.filter(x=>getStudentDate(x)>=weekAgo).reduce((sum,x)=>sum+(parseFloat(x.amount)||0),0);
  const revMonth     = s.filter(x=>getStudentDate(x)>=monthAgo).reduce((sum,x)=>sum+(parseFloat(x.amount)||0),0);
  const revPrevWeek  = s.filter(x=>{const d=getStudentDate(x);return d>=prevWeekStart&&d<weekAgo;}).reduce((sum,x)=>sum+(parseFloat(x.amount)||0),0);
  const revPrevMonth = s.filter(x=>{const d=getStudentDate(x);return d>=prevMonthStart&&d<monthAgo;}).reduce((sum,x)=>sum+(parseFloat(x.amount)||0),0);
  const newWeek      = s.filter(x=>getStudentDate(x)>=weekAgo).length;
  const newPrevWeek  = s.filter(x=>{const d=getStudentDate(x);return d>=prevWeekStart&&d<weekAgo;}).length;

  document.getElementById('analyticsKpis').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon blue">📆</div>
      <div><div class="stat-value">${formatCurrency(revToday)}</div><div class="stat-label">Aujourd'hui</div><span class="stat-trend trend-flat">${s.filter(x=>getStudentDate(x)>=today).length} inscription(s)</span></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green">📊</div>
      <div><div class="stat-value">${formatCurrency(revWeek)}</div><div class="stat-label">7 derniers jours</div>${trendHtml(revWeek,revPrevWeek,true)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon orange">💰</div>
      <div><div class="stat-value">${formatCurrency(revMonth)}</div><div class="stat-label">30 derniers jours</div>${trendHtml(revMonth,revPrevMonth,true)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon purple">🎓</div>
      <div><div class="stat-value">${newWeek}</div><div class="stat-label">Nouveaux clients (7j)</div>${trendHtml(newWeek,newPrevWeek,false)}</div>
    </div>
  `;

  buildRevenueChart();
  buildStudentsChart();
}

function buildRevenueChart() {
  const s = state.students;
  const range = state.analyticsRangeRevenue;
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - (range - 1));
  start.setHours(0, 0, 0, 0);

  const entries = buildSalesMilestones(
    s.filter(student => getStudentDate(student) >= start),
    student => parseFloat(student.amount) || 0,
    value => formatCurrency(value),
  );
  const totalRange = entries.reduce((sum, item) => sum + item.value, 0);
  const bestDay = entries.reduce((max, item) => Math.max(max, item.value), 0);

  document.getElementById('revenueTotalLabel').textContent = entries.length
    ? `Depuis la première vente utile sur ${range}j`
    : `Aucune vente sur ${range}j`;
  document.getElementById('revenueStream').innerHTML = buildMilestoneChartHtml({
    primaryValue: formatCurrency(totalRange),
    secondaryText: entries.length ? `Meilleure journee : ${formatCurrency(bestDay)}` : 'Aucun encaissement sur la periode',
    pills: [
      `${entries.length} jour${entries.length > 1 ? 's' : ''} encaissé${entries.length > 1 ? 's' : ''}`,
      entries.length ? `Moyenne active : ${formatCurrency(totalRange / entries.length)}` : 'En attente de la premiere vente',
    ],
    entries,
    colorClass: '',
    formatter: value => formatCurrency(value),
    emptyTitle: 'Le flux de revenus apparaitra a la premiere vente',
    emptyText: 'On ne montre que les jours utiles, jamais des colonnes vides.',
  });
}

function buildStudentsChart() {
  const s = state.students;
  const range = state.analyticsRangeStudents;
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - (range - 1));
  start.setHours(0, 0, 0, 0);

  const entries = buildSalesMilestones(
    s.filter(student => getStudentDate(student) >= start),
    () => 1,
    value => `${value} client${value > 1 ? 's' : ''}`,
  );
  const totalNew = entries.reduce((sum, item) => sum + item.value, 0);

  document.getElementById('studentsTotalLabel').textContent = entries.length
    ? `Depuis la première signature utile sur ${range}j`
    : `Aucune signature sur ${range}j`;
  document.getElementById('studentsStream').innerHTML = buildMilestoneChartHtml({
    primaryValue: `${totalNew}`,
    secondaryText: entries.length ? `${entries.length} jour${entries.length > 1 ? 's' : ''} avec signature` : 'Le compteur demarre a la premiere signature',
    pills: [
      entries.length ? `Moyenne active : ${(totalNew / entries.length).toFixed(1).replace('.', ',')} client / jour` : 'Aucune journee vide affichee',
      `Portefeuille : ${s.length} clients`,
    ],
    entries,
    colorClass: 'green',
    formatter: value => `${value} client${value > 1 ? 's' : ''}`,
    emptyTitle: 'La croissance demarrera a la premiere signature',
    emptyText: 'Ici aussi, uniquement les jours ou quelque chose se passe.',
  });
}

function buildSalesMilestones(items, valueGetter, formatter) {
  const byDay = new Map();
  items.forEach(item => {
    const day = formatIsoDate(getStudentDate(item));
    byDay.set(day, (byDay.get(day) || 0) + valueGetter(item));
  });

  let cumulative = 0;
  return [...byDay.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .map(([day, value]) => {
      cumulative += value;
      return {
        day,
        label: new Date(`${day}T00:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        fullLabel: new Date(`${day}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
        value,
        cumulative,
        note: formatter(value),
      };
    });
}

function buildMilestoneChartHtml({ primaryValue, secondaryText, pills, entries, colorClass, formatter, emptyTitle, emptyText }) {
  if (!entries.length) {
    return `<div class="stream-empty"><strong>${emptyTitle}</strong><p>${emptyText}</p></div>`;
  }

  const maxCumulative = Math.max(...entries.map(item => item.cumulative), 1);
  return `
    <div class="stream-summary">
      <div>
        <strong>${primaryValue}</strong>
        <span>${secondaryText}</span>
      </div>
      <div class="stream-meta">
        ${pills.map(pill => `<span class="stream-pill">${pill}</span>`).join('')}
      </div>
    </div>
    <div class="milestone-rail">
      ${entries.map(entry => `
        <div class="milestone-card" title="${entry.fullLabel} · ${formatter(entry.value)}">
          <div class="milestone-top">
            <div>
              <div class="milestone-date">${entry.label}</div>
              <div class="milestone-value">${formatter(entry.value)}</div>
            </div>
            <span class="stream-pill">${entry.fullLabel.split(' ')[0]}</span>
          </div>
          <div class="milestone-note">${entry.note}</div>
          <div class="milestone-track">
            <div class="milestone-fill ${colorClass}" style="width:${Math.max((entry.cumulative / maxCumulative) * 100, 12)}%"></div>
          </div>
          <div class="milestone-foot">
            <span>Cumul</span>
            <strong>${formatter(entry.cumulative)}</strong>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── IDEAS ────────────────────────────────────────────────────────────────────
function renderIdeas() {
  const container = document.getElementById('ideasList');
  const empty = document.getElementById('ideasEmpty');
  if (!ideas.length) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  container.innerHTML = ideas.map(idea => `
    <div class="idea-card">
      <div class="idea-head">
        <div>
          <div class="idea-title">${esc(idea.title)}</div>
          <div class="idea-meta">Par ${esc(idea.authorName)} · ${new Date(idea.createdAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' })}</div>
        </div>
        <span class="idea-status ${esc(idea.status)}">${esc(getIdeaStatusMeta(idea.status))}</span>
      </div>
      <div class="idea-body">${esc(idea.body)}</div>
      <div class="idea-comments">
        ${(idea.comments || []).map(comment => `
          <div class="idea-comment">
            <strong>${esc(comment.authorName)}</strong>
            <span>${esc(comment.body)}</span>
          </div>
        `).join('')}
      </div>
      <div class="idea-comment-row">
        <input type="text" id="ideaComment-${esc(idea.id)}" placeholder="Réagir à cette idée...">
        <button class="btn-ghost" type="button" onclick="addIdeaComment('${esc(idea.id)}')">Commenter</button>
      </div>
    </div>
  `).join('');
}

function saveIdea() {
  const title = document.getElementById('ideaTitle').value.trim();
  const body = document.getElementById('ideaBody').value.trim();
  const status = document.getElementById('ideaStatus').value;
  if (!title || !body) return;
  ideas.unshift({
    id: generateId(),
    title,
    body,
    status,
    authorId: state.currentUser.id,
    authorName: state.currentUser.name,
    createdAt: Date.now(),
    comments: [],
  });
  saveIdeas();
  logActivity('add', 'idea', title, 'Nouvelle idée ajoutée');
  document.getElementById('ideaTitle').value = '';
  document.getElementById('ideaBody').value = '';
  document.getElementById('ideaStatus').value = 'to-discuss';
  renderIdeas();
  showToast('Idée ajoutée', 'success');
}

function addIdeaComment(id) {
  const input = document.getElementById(`ideaComment-${id}`);
  const body = input?.value.trim();
  if (!body) return;
  const idea = ideas.find(item => item.id === id);
  if (!idea) return;
  idea.comments = idea.comments || [];
  idea.comments.push({
    id: generateId(),
    authorId: state.currentUser.id,
    authorName: state.currentUser.name,
    body,
    createdAt: Date.now(),
  });
  saveIdeas();
  logActivity('edit', 'idea', idea.title, 'Commentaire ajouté');
  input.value = '';
  renderIdeas();
}

function updateProspectStage(id, status) {
  const prospect = prospects.find(item => item.id === id);
  if (!prospect || prospect.status === status) return;
  if (status === 'signe') {
    prospect.status = status;
    prospect.updatedAt = Date.now();
    logActivity('edit', 'prospect', prospect.name, 'Lead glissé vers client signé');
    convertProspectToStudent(id, { skipPrompt: true, source: 'pipeline' });
    return;
  }
  prospect.status = status;
  prospect.updatedAt = Date.now();
  saveProspects();
  logActivity('edit', 'prospect', prospect.name, `Étape déplacée vers ${getProspectStatusMeta(status).label}`);
  renderProspects();
  showToast(`Lead déplacé vers ${getProspectStatusMeta(status).label}`, 'success');
}

// ─── JOURNAL ──────────────────────────────────────────────────────────────────
function renderJournal() {
  const list = state.journal;
  const container = document.getElementById('journalList');
  const empty = document.getElementById('journalEmpty');

  if (list.length === 0) {
    container.innerHTML = ''; empty.style.display = 'block'; return;
  }
  empty.style.display = 'none';

  // Group by date
  const groups = {};
  list.forEach(entry => {
    const dateKey = new Date(entry.timestamp).toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(entry);
  });

  container.innerHTML = Object.entries(groups).map(([date, entries]) => `
    <div class="journal-group">
      <div class="journal-date-header">${date}</div>
      <div class="journal-entries">
        ${entries.map(e => {
          const ai = ACTION_LABELS[e.action] || ACTION_LABELS.edit;
          const adminCol = avatarColor(e.adminName);
          const time = new Date(e.timestamp).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
          return `
            <div class="journal-entry">
              <div class="journal-admin-avatar" style="background:${adminCol}">${esc(e.adminName[0])}</div>
              <div class="journal-entry-body">
                <div class="journal-entry-main">
                  <strong>${esc(e.adminName)}</strong>
                  <span class="journal-action-badge" style="background:${ai.bg};color:${ai.color}">${ai.icon} ${ai.label}</span>
                  <span class="journal-student-name">${(ENTITY_LABELS[e.entityType || 'student'] || ENTITY_LABELS.student).icon} ${esc(e.label || e.studentName || 'Element')}</span>
                </div>
                ${e.detail ? `<div class="journal-entry-detail">${esc(e.detail)}</div>` : ''}
              </div>
              <div class="journal-time">${time}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}

// ─── DETAIL MODAL ─────────────────────────────────────────────────────────────
function openDetail(id) {
  const s = state.students.find(x=>x.id===id);
  if (!s) return;
  state.viewingId = id;
  const ci = getColorInfo(s.color);
  const trade = getTradeMeta(s.trade);

  document.getElementById('detailContent').innerHTML = `
    <div class="detail-hero">
      ${avatarHtml(s,72)}
      <div style="flex:1;min-width:0">
        <div class="detail-name">${esc(s.name)}</div>
        <div class="detail-sub">${esc(s.email||'—')}</div>
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--text2)">
            <span style="width:8px;height:8px;border-radius:50%;background:${ci.hex};display:inline-block"></span>${ci.label}
          </span>
          ${s.active?'<span class="badge badge-green">⚡ Membre actif</span>':'<span class="badge badge-gray">Inactif</span>'}
          ${s.skoolDate?`<span class="skool-date-badge">📅 Client depuis : ${esc(formatDate(s.skoolDate))}</span>`:''}
          ${s.trade ? `<span class="trade-pill">${trade.icon} ${esc(trade.label)}</span>` : ''}
        </div>
        <button class="btn-text" type="button" data-create-task="student" data-id="${esc(s.id)}" style="margin-top:8px">+ Créer une tâche liée</button>
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-field"><div class="detail-field-label">Téléphone</div><div class="detail-field-value">${esc(s.phone||'—')}</div></div>
      <div class="detail-field"><div class="detail-field-label">Email</div><div class="detail-field-value" style="font-size:12px;word-break:break-all">${esc(s.email||'—')}</div></div>
      ${s.socialHandle ? `<div class="detail-field"><div class="detail-field-label">Pseudo TikTok / Insta</div><div class="detail-field-value">${esc(s.socialHandle)}</div></div>` : ''}
      ${s.trade ? `<div class="detail-field"><div class="detail-field-label">Métier</div><div class="detail-field-value">${trade.icon} ${esc(trade.label)}</div></div>` : ''}
      <div class="detail-field"><div class="detail-field-label">Montant payé</div><div class="detail-field-value">${esc(formatCurrency(s.amount))}</div></div>
      <div class="detail-field"><div class="detail-field-label">Moyen de paiement</div><div class="detail-field-value">${esc(s.method||'—')}</div></div>
    </div>
    <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px">Services réalisés</div>
    <div class="detail-services">
      <div class="service-chip ${s.website?'done':''}"><div class="service-chip-emoji">🌐</div><span>Site web</span><span style="font-size:17px">${s.website?'✓':'✗'}</span></div>
      <div class="service-chip ${s.gmb?'done':''}"><div class="service-chip-emoji">📍</div><span>GMB</span><span style="font-size:17px">${s.gmb?'✓':'✗'}</span></div>
      <div class="service-chip ${s.logo?'done':''}"><div class="service-chip-emoji">🎨</div><span>Logo</span><span style="font-size:17px">${s.logo?'✓':'✗'}</span></div>
    </div>
    ${s.notes?`
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px">Notes</div>
      <div class="detail-notes">${esc(s.notes)}</div>
    `:''}
    <div style="font-size:11px;color:var(--text3);margin-top:14px">
      Ajouté le ${new Date(s.createdAt).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}
    </div>
  `;
  openModal('detailModal');
}

// ─── FORM MODAL ───────────────────────────────────────────────────────────────
function openAddForm() {
  state.editingId = null; state.currentPhotoData = null;
  document.getElementById('formModalTitle').textContent = 'Ajouter un client';
  resetForm(); openModal('formModal');
}

function openEditForm(id) {
  const s = state.students.find(x=>x.id===id);
  if (!s) return;
  state.editingId = id; state.currentPhotoData = s.photo||null;
  document.getElementById('formModalTitle').textContent = 'Modifier le client';
  document.getElementById('fName').value    = s.name      ||'';
  document.getElementById('fEmail').value   = s.email     ||'';
  document.getElementById('fPhone').value   = s.phone     ||'';
  document.getElementById('fSocial').value  = s.socialHandle || '';
  document.getElementById('fTrade').value   = s.trade     ||'';
  document.getElementById('fDate').value    = s.skoolDate ||'';
  document.getElementById('fAmount').value  = s.amount    ||'';
  document.getElementById('fMethod').value  = s.method    ||'';
  document.getElementById('fWebsite').checked = !!s.website;
  document.getElementById('fGmb').checked     = !!s.gmb;
  document.getElementById('fLogo').checked    = !!s.logo;
  document.getElementById('fActive').checked  = !!s.active;
  document.getElementById('fNotes').value     = s.notes   ||'';
  const si = document.querySelector(`input[name="sentiment"][value="${s.color||'green'}"]`);
  if (si) si.checked = true;
  syncTradeSelectors();
  updatePhotoPreview(s.photo||null);
  closeModal('detailModal'); openModal('formModal');
}

function resetForm() {
  ['fName','fEmail','fPhone','fSocial','fNotes'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('fTrade').value='';
  document.getElementById('fDate').value=''; document.getElementById('fAmount').value=''; document.getElementById('fMethod').value='';
  document.getElementById('fWebsite').checked=false; document.getElementById('fGmb').checked=false;
  document.getElementById('fLogo').checked=false; document.getElementById('fActive').checked=true;
  document.querySelector('input[name="sentiment"][value="green"]').checked=true;
  syncTradeSelectors();
  updatePhotoPreview(null);
}

function saveStudent() {
  const name = document.getElementById('fName').value.trim();
  if (!name) {
    const el = document.getElementById('fName');
    el.style.borderColor='var(--red)'; el.focus();
    setTimeout(()=>el.style.borderColor='',2000); return;
  }

  const isNew = !state.editingId;
  const student = {
    id: state.editingId || generateId(),
    name,
    email:     document.getElementById('fEmail').value.trim(),
    phone:     document.getElementById('fPhone').value.trim(),
    socialHandle: document.getElementById('fSocial').value.trim(),
    trade:     document.getElementById('fTrade').value,
    skoolDate: document.getElementById('fDate').value,
    amount:    document.getElementById('fAmount').value,
    method:    document.getElementById('fMethod').value,
    color:     document.querySelector('input[name="sentiment"]:checked')?.value||'green',
    website:   document.getElementById('fWebsite').checked,
    gmb:       document.getElementById('fGmb').checked,
    logo:      document.getElementById('fLogo').checked,
    active:    document.getElementById('fActive').checked,
    notes:     document.getElementById('fNotes').value.trim(),
    photo:     state.currentPhotoData,
    createdAt: isNew ? Date.now() : (state.students.find(s=>s.id===state.editingId)?.createdAt||Date.now()),
    updatedAt: Date.now(),
  };

  if (isNew) {
    state.students.push(student);
    logAction('add', name, `Montant : ${student.amount?formatCurrency(student.amount):'non renseigné'} · Paiement : ${student.method||'non renseigné'}`);
  } else {
    const idx = state.students.findIndex(s=>s.id===state.editingId);
    if (idx>=0) state.students[idx] = student;
    logAction('edit', name, 'Fiche client mise à jour');
  }

  saveStudents(); closeModal('formModal');
  renderStudents(); renderDashboard();
  showToast(isNew ? 'Client ajouté avec succès' : 'Client mis à jour', 'success');
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
let pendingDeleteId = null;

function confirmDelete(id) {
  const s = state.students.find(x=>x.id===id);
  if (!s) return;
  pendingDeleteId = id;
  document.getElementById('confirmMessage').textContent = `Voulez-vous vraiment supprimer "${s.name}" ? Cette action est irréversible.`;
  openModal('confirmModal');
}

function deleteStudent(id) {
  const s = state.students.find(x=>x.id===id);
  if (s) logAction('delete', s.name, 'Client supprimé définitivement');
  state.students = state.students.filter(s=>s.id!==id);
  saveStudents(); closeModal('confirmModal'); closeModal('detailModal');
  renderStudents(); renderDashboard();
  showToast('Client supprimé', 'warning');
}

// ─── PHOTO ────────────────────────────────────────────────────────────────────
function updatePhotoPreview(dataUrl) {
  const ring = document.getElementById('photoRing');
  const inner = document.getElementById('photoInner');
  if (dataUrl) {
    inner.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    ring.style.cssText = 'border-style:solid;border-color:var(--blue)';
  } else {
    inner.innerHTML = `<svg width="30" height="30" viewBox="0 0 24 24" fill="#C7C7CC"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
    ring.style.cssText = 'border-style:dashed;border-color:var(--border)';
  }
}

function resizeImage(file, cb) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX=280; let w=img.width,h=img.height;
      if (w>h){if(w>MAX){h=h*MAX/w;w=MAX;}}else{if(h>MAX){w=w*MAX/h;h=MAX;}}
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      cb(c.toDataURL('image/jpeg',0.78));
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
}

// ─── MODALS ───────────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).style.display='flex'; }
function closeModal(id) {
  document.getElementById(id).style.display='none';
  if (id === 'detailModal') state.viewingId = null;
  if (id === 'prospectDetailModal') state.viewingProspectId = null;
  if (id === 'todoLeadModal') {
    todoLeadModalTodoId = null;
    todoLinkEntityType = 'prospect';
    todoLinkSelection = null;
  }
  if (id === 'todoCompleteModal') todoCompletionModalTodoId = null;
}

// ─── EVENTS ───────────────────────────────────────────────────────────────────
function setupEvents() {

  // Login
  function doLogin() {
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPass').value;
    if (tryLogin(u,p)) { document.getElementById('loginError').style.display='none'; showApp(); }
    else { document.getElementById('loginError').style.display='block'; }
  }
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('demoBtn').addEventListener('click', () => {
    const hasExistingData = state.students.length || prospects.length || todos.length || state.journal.length;
    const message = hasExistingData
      ? 'Charger la démo va remplacer les données visibles dans ce navigateur. Continuer ?'
      : 'Charger un exemple complet pour visualiser les leads, la conversion et le delivery ?';
    confirmAction(message, () => {
      clearAllData();
      seedDemoData();
      state.currentUser = ADMINS[0];
      localStorage.setItem('crm_session', JSON.stringify(state.currentUser));
      showApp();
      showToast('Démo chargée', 'success');
    });
  });
  ['loginUser','loginPass'].forEach(id =>
    document.getElementById(id).addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); })
  );

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', ()=>{
    confirmAction('Voulez-vous vous déconnecter ?', logout);
  });

  // Nav links
  document.querySelectorAll('.nav-link').forEach(el =>
    el.addEventListener('click', e=>{ e.preventDefault(); showView(el.dataset.view); })
  );

  // data-view buttons (back, "voir tous", etc.)
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-view]');
    if (el && !el.classList.contains('nav-link')) showView(el.dataset.view);
  });

  // Add buttons (desktop + mobile FAB)
  ['addBtn','addBtnDashEmpty'].forEach(id => {
    const el = document.getElementById(id); if (el) el.addEventListener('click', openAddForm);
  });
  document.getElementById('addBtnDash').addEventListener('click', () => openAddProspect());
  document.getElementById('mobileAddBtn').addEventListener('click', () => openAddProspect());

  // Mobile logout
  document.getElementById('mobileLogoutBtn').addEventListener('click', () => {
    confirmAction('Voulez-vous vous déconnecter ?', logout);
  });
  document.getElementById('aiSettingsBtn').addEventListener('click', openAiModal);
  document.getElementById('mobileAiSettingsBtn').addEventListener('click', openAiModal);
  document.getElementById('openAiConfigHubBtn').addEventListener('click', openAiModal);
  document.getElementById('aiVoiceBtn').addEventListener('click', toggleAiVoiceCapture);
  document.getElementById('connectGoogleBtn').addEventListener('click', connectGoogleCalendar);
  document.getElementById('saveAiConfigBtn').addEventListener('click', saveAiModalConfig);
  document.getElementById('saveTodoBtn').addEventListener('click', saveTodoFromComposer);
  document.getElementById('cancelTodoEditBtn').addEventListener('click', resetTodoComposer);
  document.getElementById('todoLeadSaveBtn').addEventListener('click', saveTodoLeadLink);
  document.getElementById('todoLeadCreateBtn').addEventListener('click', createLeadFromTodo);
  document.getElementById('todoCompleteSaveBtn').addEventListener('click', completeTodoWithOutcome);
  document.getElementById('todoEntitySearchInput').addEventListener('input', e => {
    renderTodoEntityResults(e.target.value);
  });
  document.querySelectorAll('#todoEntityTypeTabs .segmented-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      todoLinkEntityType = btn.dataset.entityType || 'prospect';
      todoLinkSelection = null;
      renderTodoEntityTypeTabs();
      renderTodoEntityResults(document.getElementById('todoEntitySearchInput')?.value || '');
    });
  });
  document.getElementById('syncDbBtn').addEventListener('click', async () => {
    if (!isWaxx()) return;
    dbConfig = {
      url: document.getElementById('dbUrlInput').value.trim().replace(/\/$/, ''),
      anonKey: document.getElementById('dbAnonKeyInput').value.trim(),
      workspace: document.getElementById('dbWorkspaceInput').value.trim() || DB_DEFAULTS.workspace,
    };
    saveDbConfig();
    updateDbStatus('Synchronisation en cours...');
    await saveRemoteState();
    await loadRemoteState();
    if (state.currentUser) showView(document.querySelector('.nav-link.active')?.dataset.view || 'dashboard');
  });
  document.querySelectorAll('#aiProviderTabs .segmented-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      aiModalProvider = btn.dataset.provider;
      populateAiModal();
    });
  });

  // Save
  document.getElementById('saveStudentBtn').addEventListener('click', saveStudent);

  // Close modals (data-close)
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-close]');
    if (btn) closeModal(btn.dataset.close);
  });

  // Backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(el =>
    el.addEventListener('click', e=>{ if(e.target===el) closeModal(el.id); })
  );

  // Student card delegation
  document.addEventListener('click', e => {
    const card = e.target.closest('.student-card[data-id]');
    if (card) openDetail(card.dataset.id);
  });

  // Detail modal actions
  document.getElementById('deleteBtn').addEventListener('click', ()=>confirmDelete(state.viewingId));
  document.getElementById('editFromDetailBtn').addEventListener('click', ()=>openEditForm(state.viewingId));

  // Confirm delete
  document.getElementById('confirmCancel').addEventListener('click', () => {
    closeModal('confirmModal');
    pendingConfirmAction = null;
  });
  
  document.getElementById('confirmOk').addEventListener('click', () => {
    if (pendingDeleteId) {
      deleteStudent(pendingDeleteId);
      pendingDeleteId = null;
    } else if (pendingDeleteProspectId) {
      confirmDeleteProspect();
    } else if (pendingConfirmAction) {
      pendingConfirmAction();
      pendingConfirmAction = null;
    }
    closeModal('confirmModal');
  });

  // Search
  const debouncedSearch = debounce((value) => {
    state.search = value;
    renderStudents();
  }, 300);
  
  document.getElementById('searchInput').addEventListener('input', e => {
    debouncedSearch(e.target.value);
  });

  // Filter pills
  document.querySelectorAll('.filter-pills .pill').forEach(pill =>
    pill.addEventListener('click', ()=>{
      state.filter=pill.dataset.filter;
      document.querySelectorAll('.filter-pills .pill').forEach(p=>p.classList.remove('active'));
      pill.classList.add('active');
      renderStudents();
    })
  );

  // Analytics range selectors (revenue vs students = separate)
  document.addEventListener('click', e => {
    const btn = e.target.closest('.range-btn');
    if (!btn) return;
    const parent = btn.closest('#rangeRevenue, #rangeStudents');
    if (!parent) return;
    const range = parseInt(btn.dataset.range);
    parent.querySelectorAll('.range-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    if (parent.id === 'rangeRevenue') { state.analyticsRangeRevenue = range; buildRevenueChart(); }
    else                              { state.analyticsRangeStudents = range; buildStudentsChart(); }
  });

  // Clear journal
  document.getElementById('clearJournalBtn').addEventListener('click', ()=>{
    confirmAction('Vider tout le journal d\'activité ? Cette action est irréversible.', () => {
      state.journal = []; saveJournal(); renderJournal();
      showToast('Journal vidé', 'success');
    });
  });

  // Photo upload
  document.getElementById('photoBtn').addEventListener('click', ()=>document.getElementById('photoFile').click());
  document.getElementById('photoRing').addEventListener('click', ()=>document.getElementById('photoFile').click());
  document.getElementById('photoFile').addEventListener('change', e=>{
    const file=e.target.files[0]; if(!file) return;
    if(file.size>5*1024*1024){alert('Photo trop volumineuse (max 5MB).');return;}
    resizeImage(file, dataUrl=>{ state.currentPhotoData=dataUrl; updatePhotoPreview(dataUrl); });
    e.target.value='';
  });

  // Prospects
  document.getElementById('addProspectBtn').addEventListener('click', () => openAddProspect());
  document.querySelectorAll('.kanban-add-btn').forEach(btn =>
    btn.addEventListener('click', () => openAddProspect(btn.dataset.status))
  );
  document.getElementById('saveProspectBtn').addEventListener('click', saveProspect);
  document.getElementById('saveIdeaBtn').addEventListener('click', saveIdea);
  
  document.addEventListener('click', e => {
    const card = e.target.closest('.prospect-card[data-id]');
    if (card) openProspectDetail(card.dataset.id);
  });

  document.addEventListener('dragstart', e => {
    const card = e.target.closest('.prospect-card[data-id]');
    if (!card) return;
    draggedProspectId = card.dataset.id;
    card.classList.add('dragging');
  });

  document.addEventListener('dragend', e => {
    const card = e.target.closest('.prospect-card[data-id]');
    if (card) card.classList.remove('dragging');
    draggedProspectId = null;
    document.querySelectorAll('.kanban-cards.drag-over').forEach(col => col.classList.remove('drag-over'));
  });

  document.querySelectorAll('.kanban-cards[data-drop-status]').forEach(column => {
    column.addEventListener('dragover', e => {
      e.preventDefault();
      column.classList.add('drag-over');
    });
    column.addEventListener('dragleave', () => column.classList.remove('drag-over'));
    column.addEventListener('drop', e => {
      e.preventDefault();
      column.classList.remove('drag-over');
      if (draggedProspectId) updateProspectStage(draggedProspectId, column.dataset.dropStatus);
    });
  });
  
  document.getElementById('deleteProspectBtn').addEventListener('click', () => {
    if (state.viewingProspectId) deleteProspect(state.viewingProspectId);
  });
  
  document.getElementById('editProspectBtn').addEventListener('click', () => {
    if (state.viewingProspectId) openEditProspect(state.viewingProspectId);
  });
  
  document.getElementById('convertProspectBtn').addEventListener('click', () => {
    if (state.viewingProspectId) convertProspectToStudent(state.viewingProspectId);
  });

  document.getElementById('clearCompletedBtn').addEventListener('click', clearCompletedTodos);
  
  // Prospect status tabs (mobile)
  document.querySelectorAll('.ptab').forEach(tab =>
    tab.addEventListener('click', () => {
      state.prospectStatusFilter = tab.dataset.status;
      document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderProspects();
    })
  );
  
  // Reminder call button
  document.addEventListener('click', e => {
    const btn = e.target.closest('.reminder-call-btn');
    if (btn) {
      e.stopPropagation();
      const id = btn.dataset.id;
      const p = prospects.find(x => x.id === id);
      if (p && p.phone) window.location.href = `tel:${p.phone}`;
    }
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-agenda-lead]');
    if (!btn) return;
    e.stopPropagation();
    syncProspectToGoogle(btn.dataset.agendaLead).catch(error => {
      showToast(error.message || 'Erreur Google Agenda', 'error');
    });
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-agenda-todo]');
    if (!btn) return;
    e.stopPropagation();
    syncTodoToGoogle(btn.dataset.agendaTodo).catch(error => {
      showToast(error.message || 'Erreur Google Agenda', 'error');
    });
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-open-meet]');
    if (!btn) return;
    e.stopPropagation();
    if (btn.dataset.openMeet) window.open(btn.dataset.openMeet, '_blank', 'noopener,noreferrer');
  });

  document.addEventListener('click', e => {
    const pick = e.target.closest('[data-todo-entity-pick][data-todo-entity-type]');
    if (pick) {
      e.stopPropagation();
      todoLinkSelection = {
        id: pick.dataset.todoEntityPick,
        type: pick.dataset.todoEntityType,
      };
      renderTodoEntityResults(document.getElementById('todoEntitySearchInput')?.value || '');
      return;
    }
  });

  document.addEventListener('click', e => {
    const openContextBtn = e.target.closest('[data-todo-open-context]');
    if (!openContextBtn) return;
    e.stopPropagation();
    const todo = todos.find(item => item.id === openContextBtn.dataset.todoOpenContext);
    if (!todo) return;
    if (todo.contextType === 'prospect' && todo.contextId) {
      openProspectDetail(todo.contextId);
      return;
    }
    if (todo.contextType === 'student' && todo.contextId) {
      openDetail(todo.contextId);
    }
  });

  document.addEventListener('click', e => {
    const editBtn = e.target.closest('[data-todo-edit]');
    if (!editBtn) return;
    e.stopPropagation();
    openEditTodo(editBtn.dataset.todoEdit);
  });

  document.addEventListener('click', e => {
    const linkBtn = e.target.closest('[data-todo-link]');
    if (!linkBtn) return;
    e.stopPropagation();
    openTodoLeadModal(linkBtn.dataset.todoLink);
  });

  document.addEventListener('change', e => {
    const checkbox = e.target.closest('[data-todo-toggle]');
    if (!checkbox) return;
    toggleTodo(checkbox.dataset.todoToggle);
  });

  document.addEventListener('click', e => {
    const snoozeBtn = e.target.closest('[data-todo-snooze][data-snooze-days]');
    if (!snoozeBtn) return;
    e.stopPropagation();
    snoozeTodo(snoozeBtn.dataset.todoSnooze, Number(snoozeBtn.dataset.snoozeDays || 0));
  });

  document.addEventListener('click', e => {
    const deleteBtn = e.target.closest('[data-todo-delete]');
    if (!deleteBtn) return;
    e.stopPropagation();
    deleteTodo(deleteBtn.dataset.todoDelete);
  });

  document.addEventListener('click', e => {
    const todoCard = e.target.closest('.todo-item[data-id]');
    if (!todoCard) return;
    if (e.target.closest('button, a, input, label')) return;
    toggleTodo(todoCard.dataset.id);
  });
  
  // Reminder item click
  document.addEventListener('click', e => {
    const item = e.target.closest('.reminder-item');
    if (item && !e.target.closest('.reminder-call-btn') && !e.target.closest('[data-agenda-lead]') && !e.target.closest('[data-agenda-todo]') && !e.target.closest('[data-open-meet]')) {
      if (item.dataset.dashboardTodo) {
        toggleTodo(item.dataset.dashboardTodo);
        return;
      }
      openProspectDetail(item.dataset.id);
    }
  });

  document.addEventListener('click', e => {
    const option = e.target.closest('.trade-option[data-trade-target][data-trade-value]');
    if (!option) return;
    const input = document.getElementById(option.dataset.tradeTarget);
    if (!input) return;
    input.value = option.dataset.tradeValue;
    syncTradeSelectors();
  });

  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-ai-action][data-entity-type][data-entity-id]');
    if (!trigger) return;
    runAiAction(trigger.dataset.aiAction, trigger.dataset.entityType, trigger.dataset.entityId);
  });

  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-ai-workspace-action]');
    if (!trigger) return;
    runAiWorkspaceAction(trigger.dataset.aiWorkspaceAction);
  });

  window.addEventListener('message', e => {
    if (e.origin !== window.location.origin) return;
    if (!e.data || e.data.source !== 'atelier-google-oauth') return;
    fetchGoogleStatus();
    if (e.data.ok) {
      showToast(e.data.email ? `Google connecté : ${e.data.email}` : 'Google connecté', 'success');
    } else {
      showToast(e.data.message || 'Connexion Google échouée', 'error');
    }
  });

  // Command Palette (Cmd+K / Ctrl+K)
  document.addEventListener('keydown', e => {
    // Cmd+K - Command palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleCommandPalette();
    }
    // Cmd+N - New todo
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      state.todoDraftContext = null;
      showView('todos');
      setTimeout(() => document.getElementById('todoInput').focus(), 100);
    }
    // Escape - Close modals
    if (e.key === 'Escape') {
      if (document.getElementById('commandPalette').style.display === 'flex') {
        closeCommandPalette();
      }
    }
  });

  // Todo input
  document.querySelectorAll('#todoScope .segmented-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.todoScope = btn.dataset.scope;
      document.querySelectorAll('#todoScope .segmented-btn').forEach(item => item.classList.remove('active'));
      btn.classList.add('active');
      renderTodos();
    });
  });

  document.getElementById('todoOwnerSelect').addEventListener('change', e => {
    if (state.todoScope === 'mine' && e.target.value !== state.currentUser.id) {
      state.todoScope = 'team';
      document.querySelectorAll('#todoScope .segmented-btn').forEach(item => item.classList.toggle('active', item.dataset.scope === 'team'));
      renderTodos();
    }
  });

  document.querySelectorAll('#todoQuickDate .schedule-chip[data-date-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#todoQuickDate .schedule-chip[data-date-mode]').forEach(item => item.classList.remove('active'));
      btn.classList.add('active');
      if (document.getElementById('todoDateInput')) document.getElementById('todoDateInput').value = '';
      updateTodoSchedulePreview();
    });
  });

  document.querySelectorAll('#todoQuickTime .schedule-chip[data-time-value]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#todoQuickTime .schedule-chip[data-time-value]').forEach(item => item.classList.remove('active'));
      btn.classList.add('active');
      if (document.getElementById('todoTimeInput')) document.getElementById('todoTimeInput').value = '';
      updateTodoSchedulePreview();
    });
  });

  document.getElementById('todoCustomToggle').addEventListener('click', () => {
    const customRow = document.getElementById('todoCustomSchedule');
    customRow.style.display = customRow.style.display === 'none' ? 'flex' : 'none';
  });

  ['todoDateInput', 'todoTimeInput'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateTodoSchedulePreview);
  });

  document.getElementById('todoInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveTodoFromComposer();
    }
  });

  updateTodoSchedulePreview();

  // Command palette search
  document.getElementById('cmdSearch').addEventListener('input', e => {
    filterCommandPalette(e.target.value);
  });

  // Command palette item click
  document.addEventListener('click', e => {
    const item = e.target.closest('.cmd-item');
    if (item && window._cmdActions) {
      const actionId = item.dataset.action;
      const action = window._cmdActions[actionId];
      if (action) action();
    }
  });

  // Command palette keyboard navigation
  document.getElementById('cmdSearch').addEventListener('keydown', e => {
    const items = document.querySelectorAll('.cmd-item');
    const active = document.querySelector('.cmd-item.active');
    let index = Array.from(items).indexOf(active);
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      index = Math.min(index + 1, items.length - 1);
      items.forEach((item, i) => item.classList.toggle('active', i === index));
      items[index]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      index = Math.max(index - 1, 0);
      items.forEach((item, i) => item.classList.toggle('active', i === index));
      items[index]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && active) {
      e.preventDefault();
      active.click();
    }
  });

  // Close command palette on backdrop click
  document.getElementById('commandPalette').addEventListener('click', e => {
    if (e.target.id === 'commandPalette') closeCommandPalette();
  });

  // Overdue accordion toggle
  document.getElementById('overdueToggle').addEventListener('click', () => {
    const content = document.getElementById('overdueContent');
    const icon = document.getElementById('overdueIcon');
    const isOpen = content.style.display === 'block';
    content.style.display = isOpen ? 'none' : 'block';
    icon.textContent = isOpen ? '▶' : '▼';
  });

  // Completed accordion toggle
  document.getElementById('completedToggle').addEventListener('click', () => {
    const content = document.getElementById('completedContent');
    const icon = document.getElementById('completedIcon');
    const isOpen = content.style.display === 'block';
    content.style.display = isOpen ? 'none' : 'block';
    icon.textContent = isOpen ? '▶' : '▼';
  });

  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-create-task]');
    if (!trigger) return;
    const { createTask, id } = trigger.dataset;
    closeModal(createTask === 'student' ? 'detailModal' : 'prospectDetailModal');
    setTodoDraftContext(createTask, id);
  });

  document.addEventListener('click', e => {
    if (e.target.id === 'clearTodoContextBtn') {
      state.todoDraftContext = null;
      renderTodoContextBar();
    }
  });
}

function renderProspects() {
  const statusFilter = state.prospectStatusFilter || 'all';
  let list = statusFilter === 'all' ? [...prospects] : prospects.filter(p => p.status === statusFilter);
  
  document.getElementById('prospectCount').textContent = `${prospects.length} lead${prospects.length !== 1 ? 's' : ''}`;
  
  // Desktop Kanban
  ['froid','chaud','signe'].forEach(status => {
    const container = document.getElementById(`kanban${status.charAt(0).toUpperCase() + status.slice(1)}`);
    const count = document.getElementById(`count${status.charAt(0).toUpperCase() + status.slice(1)}`);
    const filtered = prospects.filter(p => p.status === status);
    count.textContent = filtered.length;
    container.innerHTML = filtered.length ? filtered.map(prospectCardHtml).join('') : '<div class="kanban-empty">Aucun lead</div>';
  });
  
  // Mobile list
  const mobileList = document.getElementById('prospectMobileList');
  const empty = document.getElementById('prospectEmpty');
  if (list.length === 0) {
    mobileList.innerHTML = ''; mobileList.style.display = 'none'; empty.style.display = 'block';
  } else {
    empty.style.display = 'none'; mobileList.style.display = 'grid';
    mobileList.innerHTML = list.map(prospectCardHtml).join('');
  }
  
  renderDashboardReminders();
}

function prospectCardHtml(p) {
  const meta = getProspectStatusMeta(p.status);
  const trade = getTradeMeta(p.trade);
  const hasReminder = p.reminderDate && new Date(p.reminderDate + 'T' + (p.reminderTime || '00:00')) >= new Date();
  
  return `
    <div class="prospect-card ${p.status}" data-id="${esc(p.id)}" draggable="true">
      <div class="prospect-card-header">
        <span class="prospect-status-icon">${meta.icon}</span>
        <div class="prospect-info">
          <div class="prospect-name">${esc(p.name)}</div>
          <div class="prospect-phone">${esc(p.phone || '—')}</div>
          ${p.socialHandle ? `<div class="prospect-phone">${esc(p.socialHandle)}</div>` : ''}
        </div>
      </div>
      ${p.email ? `<div class="prospect-email">${esc(p.email)}</div>` : ''}
      <div class="card-badges" style="margin-top:8px">
        ${p.trade ? `<span class="trade-pill">${trade.icon} ${esc(trade.label)}</span>` : ''}
        <span class="badge badge-gray">${meta.shortLabel}</span>
        ${p.source ? `<span class="badge badge-gray">${esc(p.source)}</span>` : ''}
        ${p.ownerName ? `<span class="badge badge-blue">${esc(p.ownerName)}</span>` : ''}
      </div>
      ${hasReminder ? `<div class="prospect-reminder">📞 Prochaine relance · ${formatDate(p.reminderDate)} ${p.reminderTime || ''}</div>` : '<div class="prospect-reminder prospect-reminder-missing">Aucune relance planifiée</div>'}
    </div>
  `;
}

function renderDashboardReminders() {
  const agendaItems = getDashboardAgendaItems();
  const section = document.getElementById('remindersSection');
  const list = document.getElementById('remindersList');
  
  if (agendaItems.length === 0) {
    section.style.display = 'none';
  } else {
    section.style.display = 'block';
    const visibleItems = agendaItems.slice(0, 3);
    list.innerHTML = `
      ${visibleItems.map(item => `
      <div class="reminder-item" ${item.type === 'prospect' ? `data-id="${esc(item.id)}"` : `data-dashboard-todo="${esc(item.id)}"`}>
        <div class="reminder-time-block">
          <div class="reminder-time">${esc(item.timeLabel)}</div>
          <div class="reminder-date">${esc(item.dateLabel)}</div>
        </div>
        <div class="reminder-content">
          <div class="reminder-name">${esc(item.title)} <span class="reminder-badge">${esc(item.badge)}</span></div>
          <div class="reminder-note">${esc(item.subtitle)}</div>
        </div>
        ${item.type === 'prospect'
          ? `${buildGoogleButtons('prospect', item)}<button class="reminder-call-btn" data-id="${esc(item.id)}">📞</button>`
          : buildGoogleButtons('todo', item)
        }
      </div>
    `).join('')}
      ${agendaItems.length > 3 ? `<div class="reminder-more-row"><button class="btn-ghost" type="button" data-view="todos">Voir plus (${agendaItems.length - 3})</button></div>` : ''}
    `;
  }
}

let editingProspectId = null;

function openAddProspect(status = 'froid') {
  editingProspectId = null;
  document.getElementById('prospectFormTitle').textContent = 'Nouveau lead';
  document.getElementById('pfName').value = '';
  document.getElementById('pfPhone').value = '';
  document.getElementById('pfEmail').value = '';
  document.getElementById('pfSocial').value = '';
  document.getElementById('pfTrade').value = '';
  document.getElementById('pfSource').value = '';
  document.getElementById('pfOwner').value = state.currentUser?.id || '';
  document.getElementById('pfReminderDate').value = '';
  document.getElementById('pfReminderTime').value = '';
  document.getElementById('pfReminderNote').value = '';
  document.getElementById('pfNotes').value = '';
  const statusInput = document.querySelector(`input[name="pfStatus"][value="${status}"]`);
  if (statusInput) statusInput.checked = true;
  syncTradeSelectors();
  openModal('prospectFormModal');
}

function openEditProspect(id) {
  const p = prospects.find(x => x.id === id);
  if (!p) return;
  editingProspectId = id;
  document.getElementById('prospectFormTitle').textContent = 'Modifier le lead';
  document.getElementById('pfName').value = p.name || '';
  document.getElementById('pfPhone').value = p.phone || '';
  document.getElementById('pfEmail').value = p.email || '';
  document.getElementById('pfSocial').value = p.socialHandle || '';
  document.getElementById('pfTrade').value = p.trade || '';
  document.getElementById('pfSource').value = p.source || '';
  document.getElementById('pfOwner').value = p.ownerId || '';
  document.getElementById('pfReminderDate').value = p.reminderDate || '';
  document.getElementById('pfReminderTime').value = p.reminderTime || '';
  document.getElementById('pfReminderNote').value = p.reminderNote || '';
  document.getElementById('pfNotes').value = p.notes || '';
  const statusInput = document.querySelector(`input[name="pfStatus"][value="${p.status}"]`);
  if (statusInput) statusInput.checked = true;
  syncTradeSelectors();
  closeModal('prospectDetailModal');
  openModal('prospectFormModal');
}

function saveProspect() {
  const existingProspect = prospects.find(p => p.id === editingProspectId);
  const name = document.getElementById('pfName').value.trim();
  const phone = document.getElementById('pfPhone').value.trim();
  if (!name || !phone) {
    const el = !name ? document.getElementById('pfName') : document.getElementById('pfPhone');
    el.style.borderColor = 'var(--red)'; el.focus();
    setTimeout(() => el.style.borderColor = '', 2000);
    return;
  }
  
  const isNew = !editingProspectId;
  const prospect = {
    id: editingProspectId || generateId(),
    name,
    phone,
    email: document.getElementById('pfEmail').value.trim(),
    socialHandle: document.getElementById('pfSocial').value.trim(),
    trade: document.getElementById('pfTrade').value,
    source: document.getElementById('pfSource').value,
    ownerId: document.getElementById('pfOwner').value,
    ownerName: ADMINS.find(a => a.id === document.getElementById('pfOwner').value)?.name || '',
    status: document.querySelector('input[name="pfStatus"]:checked')?.value || 'froid',
    reminderDate: document.getElementById('pfReminderDate').value,
    reminderTime: document.getElementById('pfReminderTime').value,
    reminderNote: document.getElementById('pfReminderNote').value.trim(),
    notes: document.getElementById('pfNotes').value.trim(),
    googleEvent: existingProspect?.googleEvent || null,
    createdAt: isNew ? Date.now() : (existingProspect?.createdAt || Date.now()),
    updatedAt: Date.now(),
  };
  
  if (isNew) {
    prospects.push(prospect);
    logActivity('add', 'prospect', prospect.name, `Étape : ${getProspectStatusMeta(prospect.status).label}`);
  } else {
    const idx = prospects.findIndex(p => p.id === editingProspectId);
    if (idx >= 0) prospects[idx] = prospect;
    logActivity('edit', 'prospect', prospect.name, 'Fiche lead mise à jour');
  }
  
  saveProspects();
  closeModal('prospectFormModal');
  renderProspects();
  showToast(isNew ? 'Lead ajouté' : 'Lead mis à jour', 'success');
}

function openProspectDetail(id) {
  const p = prospects.find(x => x.id === id);
  if (!p) return;
  state.viewingProspectId = id;
  
  const meta = getProspectStatusMeta(p.status);
  const trade = getTradeMeta(p.trade);
  
  const hasReminder = p.reminderDate;
  const canConvert = p.status === 'signe';
  
  document.getElementById('prospectDetailContent').innerHTML = `
    <div class="detail-hero">
      <div class="avatar-initials" style="width:64px;height:64px;background:${avatarColor(p.name)};font-size:22px">${esc(getInitials(p.name))}</div>
      <div style="flex:1;min-width:0">
        <div class="detail-name">${esc(p.name)}</div>
        <div class="detail-sub">${esc(p.phone)}</div>
        <div style="margin-top:6px">
          <span class="badge" style="background:${meta.accent}22;color:${meta.accent}">${meta.icon} ${meta.label}</span>
          ${p.trade ? `<span class="trade-pill" style="margin-left:6px">${trade.icon} ${esc(trade.label)}</span>` : ''}
        </div>
        <button class="btn-text" type="button" data-create-task="prospect" data-id="${esc(p.id)}" style="margin-top:8px">+ Créer une tâche liée</button>
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-field"><div class="detail-field-label">Téléphone</div><div class="detail-field-value">${esc(p.phone)}</div></div>
      <div class="detail-field"><div class="detail-field-label">Email</div><div class="detail-field-value" style="font-size:12px;word-break:break-all">${esc(p.email || '—')}</div></div>
      ${p.socialHandle ? `<div class="detail-field"><div class="detail-field-label">Pseudo TikTok / Insta</div><div class="detail-field-value">${esc(p.socialHandle)}</div></div>` : ''}
      ${p.trade ? `<div class="detail-field"><div class="detail-field-label">Métier</div><div class="detail-field-value">${trade.icon} ${esc(trade.label)}</div></div>` : ''}
      ${p.source ? `<div class="detail-field"><div class="detail-field-label">Source</div><div class="detail-field-value">${esc(p.source)}</div></div>` : ''}
      ${p.ownerName ? `<div class="detail-field"><div class="detail-field-label">Responsable</div><div class="detail-field-value">${esc(p.ownerName)}</div></div>` : ''}
    </div>
    ${hasReminder ? `
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;margin-top:12px">Prochaine relance</div>
      <div class="detail-reminder-box">
        <div class="detail-reminder-icon">📞</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:600;margin-bottom:2px">${formatDate(p.reminderDate)} ${p.reminderTime ? 'à ' + p.reminderTime : ''}</div>
          ${p.reminderNote ? `<div style="font-size:12px;color:var(--text2)">${esc(p.reminderNote)}</div>` : ''}
        </div>
        ${buildGoogleButtons('prospect', p)}
      </div>
    ` : ''}
    ${p.notes ? `
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;margin-top:12px">Notes</div>
      <div class="detail-notes">${esc(p.notes)}</div>
    ` : ''}
    <div style="font-size:11px;color:var(--text3);margin-top:14px">
      Ajouté le ${new Date(p.createdAt).toLocaleDateString('fr-FR', {day:'2-digit',month:'long',year:'numeric'})}
    </div>
  `;
  
  document.getElementById('convertProspectBtn').style.display = canConvert ? 'inline-flex' : 'none';
  openModal('prospectDetailModal');
}

function deleteProspect(id) {
  const p = prospects.find(x => x.id === id);
  if (!p) return;
  pendingDeleteProspectId = id;
  document.getElementById('confirmMessage').textContent = `Voulez-vous vraiment supprimer le lead "${p.name}" ? Cette action est irréversible.`;
  openModal('confirmModal');
}

function confirmDeleteProspect() {
  if (!pendingDeleteProspectId) return;
  const prospect = prospects.find(p => p.id === pendingDeleteProspectId);
  prospects = prospects.filter(p => p.id !== pendingDeleteProspectId);
  saveProspects();
  if (prospect) logActivity('delete', 'prospect', prospect.name, 'Lead supprimé');
  closeModal('confirmModal');
  closeModal('prospectDetailModal');
  renderProspects();
  pendingDeleteProspectId = null;
}

function convertProspectToStudent(id, options = {}) {
  const p = prospects.find(x => x.id === id);
  if (!p) return;
  const { silent = false, skipPrompt = false, source = 'detail' } = options;
  
  const student = {
    id: generateId(),
    name: p.name,
    email: p.email || '',
    phone: p.phone || '',
    socialHandle: p.socialHandle || '',
    trade: p.trade || '',
    skoolDate: new Date().toISOString().split('T')[0],
    amount: '',
    method: '',
    color: 'green',
    website: false,
    gmb: false,
    logo: false,
    active: true,
    notes: [p.notes, p.source ? `Source lead : ${p.source}` : '', `Converti le ${formatDate(new Date().toISOString().split('T')[0])}`].filter(Boolean).join('\n'),
    photo: null,
    source: p.source || '',
    googleEvent: p.googleEvent || null,
    originProspectId: p.id,
    convertedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  state.students.push(student);
  saveStudents();
  logAction('add', student.name, `Converti depuis les leads · Source : ${p.source || 'non renseignée'}`);
  logActivity('edit', 'prospect', p.name, 'Lead converti en client');
  
  prospects = prospects.filter(x => x.id !== id);
  saveProspects();
  
  closeModal('prospectDetailModal');
  renderProspects();
  renderStudents();
  renderDashboard();

  if (!silent) showToast('Lead converti en client', 'success');
  if (skipPrompt) return;

  setTimeout(() => {
    if (confirm(`${p.name} a été converti en client. Voulez-vous compléter sa fiche ?`)) {
      showView('students');
      setTimeout(() => openEditForm(student.id), 100);
    }
  }, source === 'pipeline' ? 0 : 100);
}

let pendingDeleteProspectId = null;

// ─── COMMAND PALETTE ──────────────────────────────────────────────────────────
function toggleCommandPalette() {
  const palette = document.getElementById('commandPalette');
  if (palette.style.display === 'flex') {
    closeCommandPalette();
  } else {
    openCommandPalette();
  }
}

function openCommandPalette() {
  const palette = document.getElementById('commandPalette');
  palette.style.display = 'flex';
  document.getElementById('cmdSearch').value = '';
  document.getElementById('cmdSearch').focus();
  renderCommandPaletteItems();
}

function closeCommandPalette() {
  document.getElementById('commandPalette').style.display = 'none';
}

function renderCommandPaletteItems(filter = '') {
  const pendingTodos = todos.filter(t => t.status === 'pending');
  const commands = [
    { id: 'new-todo', label: 'Nouvelle tâche', icon: '➕', action: () => { state.todoDraftContext = null; closeCommandPalette(); showView('todos'); document.getElementById('todoInput').focus(); } },
    { id: 'new-student', label: 'Nouveau client', icon: '🎓', action: () => { closeCommandPalette(); openAddForm(); } },
    { id: 'new-prospect', label: 'Nouveau lead', icon: '👤', action: () => { closeCommandPalette(); openAddProspect(); } },
    { id: 'new-idea', label: 'Nouvelle idée', icon: '💡', action: () => { closeCommandPalette(); showView('ideas'); document.getElementById('ideaTitle').focus(); } },
    { id: 'ai-settings', label: 'Configurer l’IA', icon: '✨', action: () => { closeCommandPalette(); openAiModal(); } },
    { id: 'ai-hub', label: 'Ouvrir l’onglet IA', icon: '🪄', action: () => { closeCommandPalette(); showView('ai'); } },
    { id: 'view-todos', label: 'Voir les tâches', icon: '✓', action: () => { closeCommandPalette(); showView('todos'); } },
    { id: 'view-students', label: 'Voir les clients', icon: '👥', action: () => { closeCommandPalette(); showView('students'); } },
    { id: 'view-prospects', label: 'Voir les leads', icon: '💬', action: () => { closeCommandPalette(); showView('prospects'); } },
    { id: 'view-ideas', label: 'Voir les idées', icon: '💡', action: () => { closeCommandPalette(); showView('ideas'); } },
    { id: 'view-ai', label: 'Voir l’IA', icon: '✨', action: () => { closeCommandPalette(); showView('ai'); } },
  ];
  
  // Add pending todos as quick actions
  pendingTodos.slice(0, 5).forEach(todo => {
    commands.push({
      id: `todo-${todo.id}`,
      label: `Marquer terminé : ${todo.title}`,
      icon: '✓',
      action: () => { toggleTodo(todo.id); closeCommandPalette(); }
    });
  });
  
  const filtered = filter ? commands.filter(c => c.label.toLowerCase().includes(filter.toLowerCase())) : commands;
  
  document.getElementById('cmdItems').innerHTML = filtered.length 
    ? filtered.map((c, i) => `
        <div class="cmd-item ${i === 0 ? 'active' : ''}" data-action="${c.id}">
          <span class="cmd-icon">${c.icon}</span>
          <span class="cmd-label">${esc(c.label)}</span>
        </div>
      `).join('')
    : '<div class="cmd-empty">Aucune commande trouvée</div>';
  
  // Store actions for execution
  window._cmdActions = {};
  filtered.forEach(c => window._cmdActions[c.id] = c.action);
}

function filterCommandPalette(query) {
  renderCommandPaletteItems(query);
}

function showTodoPreview(input) {
  const parsed = parseNaturalInput(input);
  if (parsed.dueDate || parsed.mentions.length) {
    const preview = document.getElementById('todoPreview');
    preview.innerHTML = `
      <div class="todo-preview-content">
        ✓ Tâche créée
        ${parsed.dueDate ? ` · 📅 ${formatDate(parsed.dueDate)}` : ''}
        ${parsed.dueTime ? ` ${parsed.dueTime}` : ''}
        ${parsed.mentions.length ? ` · @${parsed.mentions.join(', @')}` : ''}
      </div>
    `;
    preview.style.display = 'flex';
    setTimeout(() => preview.style.display = 'none', 3000);
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  loadData();
  setupEvents();
  checkSession() ? showApp() : showLogin();
  if (isDbConfigured()) {
    const loaded = await loadRemoteState();
    if (loaded && state.currentUser) showView(document.querySelector('.nav-link.active')?.dataset.view || 'dashboard');
  }
  fetchGoogleStatus();
}

document.addEventListener('DOMContentLoaded', init);

import { firebaseConfig } from './firebase-config.js';
import { EXERCISE_GROUPS, GROUP_ICONS, ALL_GROUPS } from './exercises.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs,
  query, orderBy, limit, Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// ─── State ────────────────────────────────────────────────────
let currentUser = null;
let selectedDate = todayStr();
let activeWorkout = null;
let lastWeights = {};
let userExercises = null;
let chart = null;
let editingExercise = null;

// ─── Utils ────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(str) { const [y, m, d] = str.split('-'); return `${d}/${m}/${y}`; }
function workoutsCol() { return collection(db, 'users', currentUser.uid, 'workouts'); }
function configDocRef() { return doc(db, 'users', currentUser.uid, 'config', 'exercises'); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ─── User Exercise Config ─────────────────────────────────────
async function loadUserExercises() {
  const snap = await getDoc(configDocRef());
  if (snap.exists()) {
    userExercises = snap.data().groups;
  } else {
    userExercises = JSON.parse(JSON.stringify(EXERCISE_GROUPS));
    await setDoc(configDocRef(), { groups: userExercises });
  }
}

async function saveUserExercises() {
  await setDoc(configDocRef(), { groups: userExercises });
}

function getGroupExercises(group) {
  return (userExercises || EXERCISE_GROUPS)[group] || [];
}

function getAllUserGroups() {
  return Object.keys(userExercises || EXERCISE_GROUPS);
}

function getAllUserExercises() {
  return Object.values(userExercises || EXERCISE_GROUPS).flat();
}

// ─── Auth ─────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    await loadUserExercises();
    showApp();
    renderDatePicker();
    navigateTo('today');
    loadWorkoutForDate(selectedDate);
  } else {
    showLogin();
  }
});

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('user-email').textContent = currentUser.email;
}

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Entrando...';
  try { await signInWithEmailAndPassword(auth, email, pass); }
  catch (err) { showLoginError(friendlyError(err.code)); btn.disabled = false; btn.textContent = 'Entrar'; }
});

document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Criando...';
  try { await createUserWithEmailAndPassword(auth, email, pass); }
  catch (err) { showLoginError(friendlyError(err.code)); btn.disabled = false; btn.textContent = 'Criar conta'; }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
document.getElementById('show-register').addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
  clearLoginError();
});
document.getElementById('show-login').addEventListener('click', e => {
  e.preventDefault();
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
  clearLoginError();
});

function showLoginError(msg) { const el = document.getElementById('login-error'); el.textContent = msg; el.classList.remove('hidden'); }
function clearLoginError() { const el = document.getElementById('login-error'); el.textContent = ''; el.classList.add('hidden'); }
function friendlyError(code) {
  const m = { 'auth/user-not-found': 'E-mail não encontrado.', 'auth/wrong-password': 'Senha incorreta.', 'auth/invalid-email': 'E-mail inválido.', 'auth/email-already-in-use': 'E-mail já cadastrado.', 'auth/weak-password': 'Senha fraca (mín. 6 caracteres).', 'auth/invalid-credential': 'E-mail ou senha incorretos.', 'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.' };
  return m[code] || 'Erro inesperado. Tente novamente.';
}

// ─── Navigation ───────────────────────────────────────────────
function navigateTo(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-btn[data-view="${view}"]`).classList.add('active');
  if (view === 'history') loadHistory();
  if (view === 'progress') loadProgressExercises();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.view));
});

// ─── Date Picker ──────────────────────────────────────────────
function renderDatePicker() {
  const isToday = selectedDate === todayStr();
  document.getElementById('date-display').textContent = isToday ? 'Hoje' : fmtDate(selectedDate);
  document.getElementById('date-input').value = selectedDate;
  const nextBtn = document.getElementById('date-next');
  nextBtn.disabled = selectedDate >= todayStr();
  nextBtn.classList.toggle('disabled', nextBtn.disabled);
}

document.getElementById('date-prev').addEventListener('click', () => {
  const d = new Date(selectedDate + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  selectedDate = d.toISOString().slice(0, 10);
  renderDatePicker();
  loadWorkoutForDate(selectedDate);
});

document.getElementById('date-next').addEventListener('click', () => {
  if (selectedDate >= todayStr()) return;
  const d = new Date(selectedDate + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  selectedDate = d.toISOString().slice(0, 10);
  renderDatePicker();
  loadWorkoutForDate(selectedDate);
});

document.getElementById('date-display').addEventListener('click', () => {
  const input = document.getElementById('date-input');
  input.showPicker ? input.showPicker() : input.click();
});

document.getElementById('date-input').addEventListener('change', e => {
  if (!e.target.value || e.target.value > todayStr()) { e.target.value = selectedDate; return; }
  selectedDate = e.target.value;
  renderDatePicker();
  loadWorkoutForDate(selectedDate);
});

// ─── Load Workout ─────────────────────────────────────────────
async function loadWorkoutForDate(date) {
  document.getElementById('today-content').innerHTML = '<div class="loading">Carregando...</div>';

  const [snap, weights] = await Promise.all([
    getDoc(doc(workoutsCol(), date)),
    loadLastWeights(date),
  ]);

  lastWeights = weights;

  if (snap.exists()) {
    const data = snap.data();
    activeWorkout = {
      id: date, date,
      groups: data.groups || (data.group ? [data.group] : []),
      exercises: (data.exercises || []).map(ex => ({ groupName: ex.groupName || data.group || '', ...ex })),
      cardio: data.cardio || [],
    };
    renderWorkout();
  } else {
    activeWorkout = null;
    renderGroupSelector();
  }

  loadFrequency();
}

async function loadLastWeights(excludeDate) {
  const q = query(workoutsCol(), orderBy('date', 'desc'), limit(60));
  const snap = await getDocs(q);
  const result = {};
  snap.docs.forEach(d => {
    if (d.id === excludeDate) return;
    (d.data().exercises || []).forEach(ex => {
      if (!result[ex.id] && ex.sets?.length > 0) {
        const ws = ex.sets.map(s => s.weight).filter(w => w > 0);
        if (ws.length) result[ex.id] = Math.max(...ws);
      }
    });
  });
  return result;
}

// ─── Group Selector ───────────────────────────────────────────
function renderGroupSelector() {
  const container = document.getElementById('today-content');
  container.innerHTML = `
    <div class="section-title">Escolha o grupo muscular</div>
    <div class="group-grid">
      ${getAllUserGroups().map(g => `
        <button class="group-card" data-group="${g}">
          <span class="group-icon">${GROUP_ICONS[g] || '💪'}</span>
          <span class="group-name">${g}</span>
        </button>
      `).join('')}
    </div>
  `;
  container.querySelectorAll('.group-card').forEach(btn => {
    btn.addEventListener('click', () => startWorkout(btn.dataset.group));
  });
}

async function startWorkout(group) {
  const exercises = getGroupExercises(group).map(ex => ({ ...ex, groupName: group, sets: [] }));
  activeWorkout = { id: selectedDate, date: selectedDate, groups: [group], exercises, cardio: [] };
  await saveWorkout();
  renderWorkout();
}

// ─── Render Workout ───────────────────────────────────────────
function renderWorkout() {
  const container = document.getElementById('today-content');
  const { groups, exercises, cardio } = activeWorkout;
  const completedSets = exercises.reduce((n, ex) => n + ex.sets.filter(s => s.completed).length, 0);
  const totalSets = exercises.reduce((n, ex) => n + ex.sets.length, 0);

  const availableToAdd = getAllUserGroups().filter(g => !groups.includes(g));

  container.innerHTML = `
    <div class="workout-header">
      <div class="workout-groups-badges">
        ${groups.map(g => `<span class="workout-group-badge">${GROUP_ICONS[g] || '💪'} ${g}</span>`).join('')}
      </div>
      <span class="workout-stats-mini">${completedSets}/${totalSets} séries</span>
    </div>

    <div id="exercises-list"></div>

    ${availableToAdd.length > 0 ? `
      <div class="add-group-section">
        <div class="section-title">Adicionar grupo</div>
        <div class="add-group-row">
          ${availableToAdd.map(g => `
            <button class="btn-add-group" data-group="${g}">${GROUP_ICONS[g] || '💪'} ${g}</button>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div class="cardio-section">
      <div class="cardio-section-header">
        <div class="section-title">Cardio</div>
        <button id="add-cardio-btn" class="btn-add-set">+ Cardio</button>
      </div>
      <div id="cardio-list">
        ${cardio.length === 0
          ? '<div class="no-sets">Nenhum cardio registrado</div>'
          : cardio.map((c, i) => renderCardioCard(c, i)).join('')}
      </div>
    </div>
  `;

  renderExercisesList();

  container.querySelectorAll('.btn-add-group').forEach(btn => {
    btn.addEventListener('click', () => addGroupToWorkout(btn.dataset.group));
  });

  document.getElementById('add-cardio-btn').addEventListener('click', () => showCardioModal());

  container.querySelectorAll('.btn-delete-cardio').forEach(btn => {
    btn.addEventListener('click', async () => {
      activeWorkout.cardio.splice(+btn.dataset.i, 1);
      await saveWorkout();
      renderWorkout();
    });
  });
}

async function addGroupToWorkout(group) {
  const newExs = getGroupExercises(group).map(ex => ({ ...ex, groupName: group, sets: [] }));
  activeWorkout.groups.push(group);
  activeWorkout.exercises.push(...newExs);
  await saveWorkout();
  renderWorkout();
}

// ─── Exercises List ───────────────────────────────────────────
function renderExercisesList() {
  const list = document.getElementById('exercises-list');
  const { exercises, groups } = activeWorkout;
  const multiGroup = groups.length > 1;
  let html = '';
  let lastGroup = null;

  exercises.forEach((ex, exIdx) => {
    if (multiGroup && ex.groupName !== lastGroup) {
      html += `<div class="group-section-header">${GROUP_ICONS[ex.groupName] || ''} ${ex.groupName}</div>`;
      lastGroup = ex.groupName;
    }
    const lw = lastWeights[ex.id];
    html += `
      <div class="exercise-card" id="ex-card-${exIdx}">
        <div class="exercise-header">
          <div class="exercise-name-wrap">
            <span class="exercise-name">${ex.name}</span>
            ${lw !== undefined ? `<span class="last-weight">Último: ${lw} kg</span>` : ''}
          </div>
          <button class="btn-add-set" data-ex="${exIdx}">+ Série</button>
        </div>
        <div class="sets-list" id="sets-${exIdx}">
          ${ex.sets.map((s, sIdx) => renderSetRow(exIdx, sIdx, s)).join('')}
        </div>
        ${ex.sets.length === 0 ? '<div class="no-sets">Toque em "+ Série" para registrar</div>' : ''}
      </div>
    `;
  });

  list.innerHTML = html;

  list.querySelectorAll('.btn-add-set').forEach(btn => {
    btn.addEventListener('click', () => showAddSetModal(+btn.dataset.ex));
  });

  list.querySelectorAll('.set-check').forEach(cb => {
    cb.addEventListener('change', async e => {
      const { ex, set } = e.target.dataset;
      activeWorkout.exercises[+ex].sets[+set].completed = e.target.checked;
      e.target.closest('.set-row').classList.toggle('completed', e.target.checked);
      await saveWorkout();
      updateWorkoutStats();
    });
  });

  list.querySelectorAll('.btn-delete-set').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { ex, set } = btn.dataset;
      activeWorkout.exercises[+ex].sets.splice(+set, 1);
      await saveWorkout();
      renderExercisesList();
      updateWorkoutStats();
    });
  });
}

function renderSetRow(exIdx, sIdx, s) {
  return `
    <div class="set-row ${s.completed ? 'completed' : ''}">
      <input type="checkbox" class="set-check" data-ex="${exIdx}" data-set="${sIdx}" ${s.completed ? 'checked' : ''}>
      <span class="set-info">${s.weight > 0 ? s.weight + ' kg' : 'Livre'} × ${s.reps} rep${s.reps !== 1 ? 's' : ''}</span>
      <button class="btn-delete-set btn-ghost btn-sm" data-ex="${exIdx}" data-set="${sIdx}">✕</button>
    </div>
  `;
}

function updateWorkoutStats() {
  const { exercises } = activeWorkout;
  const done = exercises.reduce((n, ex) => n + ex.sets.filter(s => s.completed).length, 0);
  const total = exercises.reduce((n, ex) => n + ex.sets.length, 0);
  const el = document.querySelector('.workout-stats-mini');
  if (el) el.textContent = `${done}/${total} séries`;
}

// ─── Add Set Modal ────────────────────────────────────────────
function showAddSetModal(exIdx) {
  const ex = activeWorkout.exercises[exIdx];
  const lastSet = ex.sets[ex.sets.length - 1];
  const lw = lastWeights[ex.id];
  const defaultWeight = lastSet ? lastSet.weight : (lw !== undefined ? lw : ex.defaultWeight ?? 0);
  const defaultReps = lastSet ? lastSet.reps : 12;

  document.getElementById('modal-title').textContent = ex.name;
  document.getElementById('set-weight').value = defaultWeight;
  document.getElementById('set-reps').value = defaultReps;
  document.getElementById('modal-overlay').classList.remove('hidden');

  document.getElementById('modal-save-btn').onclick = async () => {
    const weight = parseFloat(document.getElementById('set-weight').value) || 0;
    const reps = parseInt(document.getElementById('set-reps').value) || 0;
    if (reps <= 0) { alert('Informe o número de repetições.'); return; }
    activeWorkout.exercises[exIdx].sets.push({ weight, reps, completed: false });
    await saveWorkout();
    closeModal();
    renderExercisesList();
    updateWorkoutStats();
  };
}

document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }

document.querySelectorAll('.btn-weight-dec').forEach(btn => btn.addEventListener('click', () => {
  const i = document.getElementById('set-weight');
  i.value = Math.max(0, (parseFloat(i.value) || 0) - 2.5).toFixed(1).replace(/\.0$/, '');
}));
document.querySelectorAll('.btn-weight-inc').forEach(btn => btn.addEventListener('click', () => {
  const i = document.getElementById('set-weight');
  i.value = ((parseFloat(i.value) || 0) + 2.5).toFixed(1).replace(/\.0$/, '');
}));
document.querySelectorAll('.btn-reps-dec').forEach(btn => btn.addEventListener('click', () => {
  const i = document.getElementById('set-reps');
  i.value = Math.max(1, (parseInt(i.value) || 0) - 1);
}));
document.querySelectorAll('.btn-reps-inc').forEach(btn => btn.addEventListener('click', () => {
  const i = document.getElementById('set-reps');
  i.value = (parseInt(i.value) || 0) + 1;
}));

// ─── Cardio ───────────────────────────────────────────────────
const CARDIO_TYPES = ['Esteira', 'Bicicleta', 'Elíptico', 'Remo', 'Escada', 'Pular corda', 'HIIT', 'Natação', 'Caminhada', 'Outro'];

function renderCardioCard(c, i) {
  const parts = [];
  if (c.duration) parts.push(`${c.duration} min`);
  if (c.distance) parts.push(`${c.distance} km`);
  if (c.calories) parts.push(`${c.calories} kcal`);
  return `
    <div class="cardio-card">
      <div class="cardio-info">
        <span class="cardio-type">🏃 ${c.type}</span>
        <span class="cardio-meta">${parts.join(' · ')}${c.notes ? ' — ' + c.notes : ''}</span>
      </div>
      <button class="btn-delete-cardio btn-ghost btn-sm" data-i="${i}">✕</button>
    </div>
  `;
}

function showCardioModal() {
  const sel = document.getElementById('cardio-type');
  sel.innerHTML = CARDIO_TYPES.map(t => `<option>${t}</option>`).join('');
  document.getElementById('cardio-duration').value = '';
  document.getElementById('cardio-distance').value = '';
  document.getElementById('cardio-calories').value = '';
  document.getElementById('cardio-notes').value = '';
  document.getElementById('cardio-modal-overlay').classList.remove('hidden');

  document.getElementById('cardio-save-btn').onclick = async () => {
    const duration = parseFloat(document.getElementById('cardio-duration').value) || 0;
    if (!duration) { alert('Informe a duração.'); return; }
    const entry = {
      type: sel.value,
      duration,
      distance: parseFloat(document.getElementById('cardio-distance').value) || 0,
      calories: parseInt(document.getElementById('cardio-calories').value) || 0,
      notes: document.getElementById('cardio-notes').value.trim(),
    };
    activeWorkout.cardio.push(entry);
    await saveWorkout();
    closeCardioModal();
    renderWorkout();
  };
}

document.getElementById('cardio-cancel-btn').addEventListener('click', closeCardioModal);
document.getElementById('cardio-modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeCardioModal(); });
function closeCardioModal() { document.getElementById('cardio-modal-overlay').classList.add('hidden'); }

// ─── Save ─────────────────────────────────────────────────────
async function saveWorkout() {
  await setDoc(doc(workoutsCol(), activeWorkout.id), {
    date: activeWorkout.date,
    groups: activeWorkout.groups,
    exercises: activeWorkout.exercises,
    cardio: activeWorkout.cardio,
    updatedAt: Timestamp.now(),
  });
}

// ─── Frequency ────────────────────────────────────────────────
async function loadFrequency() {
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const snap = await getDocs(query(workoutsCol(), orderBy('date', 'desc'), limit(60)));
  const dates = snap.docs.map(d => d.data().date);
  document.getElementById('freq-weekly').textContent = dates.filter(d => d >= weekAgo).length;
  document.getElementById('freq-monthly').textContent = dates.filter(d => d >= monthStart).length;
}

// ─── History ──────────────────────────────────────────────────
async function loadHistory() {
  const container = document.getElementById('history-list');
  container.innerHTML = '<div class="loading">Carregando...</div>';
  const snap = await getDocs(query(workoutsCol(), orderBy('date', 'desc'), limit(60)));
  if (snap.empty) { container.innerHTML = '<div class="empty-state">Nenhum treino registrado ainda.</div>'; return; }
  container.innerHTML = snap.docs.map(d => {
    const w = d.data();
    const groups = w.groups || (w.group ? [w.group] : []);
    const exercises = w.exercises || [];
    const cardio = w.cardio || [];
    const totalSets = exercises.reduce((n, ex) => n + ex.sets.length, 0);
    const doneSets = exercises.reduce((n, ex) => n + ex.sets.filter(s => s.completed).length, 0);
    const exWithSets = exercises.filter(ex => ex.sets.length > 0);
    return `
      <div class="history-card">
        <div class="history-date">${fmtDate(w.date)}${w.date === todayStr() ? ' <span class="badge-today">Hoje</span>' : ''}</div>
        <div class="history-group">${groups.map(g => `${GROUP_ICONS[g] || ''} ${g}`).join(' + ')}</div>
        <div class="history-meta">${exWithSets.length} exercícios · ${doneSets}/${totalSets} séries${cardio.length ? ` · ${cardio.length} cardio` : ''}</div>
        <div class="history-exercises">
          ${exWithSets.map(ex => `
            <div class="history-ex-row">
              <span>${ex.name}</span>
              <span class="history-ex-sets">${ex.sets.map(s => `${s.weight > 0 ? s.weight + 'kg' : 'livre'}×${s.reps}`).join(', ')}</span>
            </div>
          `).join('')}
          ${cardio.map(c => `
            <div class="history-ex-row">
              <span>🏃 ${c.type}</span>
              <span class="history-ex-sets">${c.duration ? c.duration + ' min' : ''}${c.distance ? ' · ' + c.distance + ' km' : ''}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// ─── Progress ─────────────────────────────────────────────────
function loadProgressExercises() {
  const sel = document.getElementById('progress-exercise-select');
  const current = sel.value;
  sel.innerHTML = '<option value="">Selecione um exercício...</option>';
  getAllUserExercises().forEach(ex => {
    const opt = document.createElement('option');
    opt.value = ex.id;
    opt.textContent = ex.name;
    if (ex.id === current) opt.selected = true;
    sel.appendChild(opt);
  });
  if (current) loadProgressChart(current);
}

document.getElementById('progress-exercise-select').addEventListener('change', e => {
  if (e.target.value) loadProgressChart(e.target.value); else clearChart();
});

async function loadProgressChart(exerciseId) {
  document.getElementById('progress-empty').classList.add('hidden');
  const container = document.getElementById('chart-container');
  container.innerHTML = '<div class="loading">Carregando dados...</div>';
  const snap = await getDocs(query(workoutsCol(), orderBy('date', 'asc'), limit(120)));
  const points = [];
  snap.docs.forEach(d => {
    const w = d.data();
    const ex = (w.exercises || []).find(e => e.id === exerciseId);
    if (!ex?.sets?.length) return;
    const maxWeight = Math.max(...ex.sets.map(s => s.weight));
    const totalVol = ex.sets.reduce((n, s) => n + s.weight * s.reps, 0);
    points.push({ date: w.date, maxWeight, totalVol });
  });
  if (!points.length) { container.innerHTML = ''; document.getElementById('progress-empty').classList.remove('hidden'); return; }
  container.innerHTML = '<canvas id="progress-chart"></canvas>';
  const ctx = document.getElementById('progress-chart').getContext('2d');
  if (chart) chart.destroy();
  const name = getAllUserExercises().find(e => e.id === exerciseId)?.name || exerciseId;
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: points.map(p => fmtDate(p.date)),
      datasets: [
        { label: 'Peso máximo (kg)', data: points.map(p => p.maxWeight), borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.15)', fill: true, tension: 0.3, pointBackgroundColor: '#7c3aed', pointRadius: 5, yAxisID: 'y' },
        { label: 'Volume (kg×reps)', data: points.map(p => p.totalVol), borderColor: '#f97316', fill: false, tension: 0.3, pointBackgroundColor: '#f97316', pointRadius: 4, yAxisID: 'y1', borderDash: [5, 3] },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#e5e5e5', font: { size: 12 } } },
        title: { display: true, text: name, color: '#e5e5e5', font: { size: 14, weight: 'bold' } },
        tooltip: { backgroundColor: '#1e1e2e', titleColor: '#e5e5e5', bodyColor: '#a3a3a3', borderColor: '#333', borderWidth: 1 },
      },
      scales: {
        x: { ticks: { color: '#a3a3a3' }, grid: { color: '#2a2a2a' } },
        y: { type: 'linear', position: 'left', ticks: { color: '#7c3aed' }, grid: { color: '#2a2a2a' }, title: { display: true, text: 'Peso (kg)', color: '#7c3aed' } },
        y1: { type: 'linear', position: 'right', ticks: { color: '#f97316' }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Volume', color: '#f97316' } },
      },
    },
  });
}

function clearChart() {
  if (chart) { chart.destroy(); chart = null; }
  document.getElementById('chart-container').innerHTML = '';
  document.getElementById('progress-empty').classList.remove('hidden');
}

// ─── Exercise Manager ─────────────────────────────────────────
document.getElementById('manage-exercises-btn').addEventListener('click', () => {
  document.getElementById('exercises-overlay').classList.remove('hidden');
  renderExerciseManager();
});

document.getElementById('exercises-overlay-close').addEventListener('click', () => {
  document.getElementById('exercises-overlay').classList.add('hidden');
});

document.getElementById('add-new-exercise-btn').addEventListener('click', () => {
  showExerciseEditModal(getAllUserGroups()[0], -1);
});

function renderExerciseManager() {
  const content = document.getElementById('exercises-overlay-content');
  content.innerHTML = Object.entries(userExercises || EXERCISE_GROUPS).map(([group, exercises]) => `
    <div class="ex-manager-group">
      <div class="ex-manager-group-header">
        <span>${GROUP_ICONS[group] || '💪'} ${group}</span>
        <button class="btn-ghost btn-sm btn-add-to-group" data-group="${group}">+ Exercício</button>
      </div>
      ${exercises.map((ex, idx) => `
        <div class="ex-manager-row">
          <div class="ex-manager-info">
            <span class="ex-manager-name">${ex.name}</span>
            <span class="ex-manager-weight">${ex.defaultWeight > 0 ? ex.defaultWeight + ' kg padrão' : 'Peso livre'}</span>
          </div>
          <div class="ex-manager-actions">
            <button class="btn-ghost btn-sm btn-edit-ex" data-group="${group}" data-idx="${idx}">✏️</button>
            <button class="btn-ghost btn-sm btn-delete-ex" data-group="${group}" data-idx="${idx}">🗑️</button>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');

  content.querySelectorAll('.btn-add-to-group').forEach(btn =>
    btn.addEventListener('click', () => showExerciseEditModal(btn.dataset.group, -1)));
  content.querySelectorAll('.btn-edit-ex').forEach(btn =>
    btn.addEventListener('click', () => showExerciseEditModal(btn.dataset.group, +btn.dataset.idx)));
  content.querySelectorAll('.btn-delete-ex').forEach(btn =>
    btn.addEventListener('click', () => deleteExercise(btn.dataset.group, +btn.dataset.idx)));
}

function showExerciseEditModal(group, idx) {
  editingExercise = { group, idx };
  const ex = idx >= 0 ? (userExercises || EXERCISE_GROUPS)[group][idx] : null;
  document.getElementById('ex-edit-title').textContent = ex ? 'Editar Exercício' : 'Novo Exercício';
  document.getElementById('ex-edit-name').value = ex?.name || '';
  document.getElementById('ex-edit-weight').value = ex?.defaultWeight ?? '';
  const groupSel = document.getElementById('ex-edit-group');
  groupSel.innerHTML = getAllUserGroups().map(g => `<option value="${g}" ${g === group ? 'selected' : ''}>${g}</option>`).join('');
  document.getElementById('ex-edit-modal-overlay').classList.remove('hidden');
}

document.getElementById('ex-edit-save-btn').addEventListener('click', async () => {
  const name = document.getElementById('ex-edit-name').value.trim();
  const weight = parseFloat(document.getElementById('ex-edit-weight').value) || 0;
  const newGroup = document.getElementById('ex-edit-group').value;
  if (!name) { alert('Informe o nome do exercício.'); return; }

  const { group: origGroup, idx } = editingExercise;

  if (idx >= 0) {
    const ex = { ...userExercises[origGroup][idx], name, defaultWeight: weight };
    if (newGroup !== origGroup) {
      userExercises[origGroup].splice(idx, 1);
      (userExercises[newGroup] = userExercises[newGroup] || []).push(ex);
    } else {
      userExercises[origGroup][idx] = ex;
    }
  } else {
    const newEx = { id: genId(), name, defaultWeight: weight };
    (userExercises[newGroup] = userExercises[newGroup] || []).push(newEx);
  }

  await saveUserExercises();
  closeExerciseEditModal();
  renderExerciseManager();
});

document.getElementById('ex-edit-cancel-btn').addEventListener('click', closeExerciseEditModal);
document.getElementById('ex-edit-modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeExerciseEditModal(); });
function closeExerciseEditModal() { document.getElementById('ex-edit-modal-overlay').classList.add('hidden'); }

async function deleteExercise(group, idx) {
  const ex = (userExercises || EXERCISE_GROUPS)[group][idx];
  if (!confirm(`Excluir "${ex.name}"?`)) return;
  userExercises[group].splice(idx, 1);
  await saveUserExercises();
  renderExerciseManager();
}

// ─── Service Worker ───────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

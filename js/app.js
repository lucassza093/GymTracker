import { firebaseConfig } from './firebase-config.js';
import { EXERCISE_GROUPS, GROUP_ICONS, ALL_GROUPS, getExercisesByGroup, getAllExercises } from './exercises.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── Firebase init ────────────────────────────────────────────
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// ─── State ────────────────────────────────────────────────────
let currentUser = null;
let activeWorkout = null; // { id, date, group, exercises: [{name, id, sets:[{weight,reps,completed}]}] }
let chart = null;

// ─── Utils ────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(str) {
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function workoutsCol() {
  return collection(db, 'users', currentUser.uid, 'workouts');
}

// ─── Auth ─────────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    showApp();
    navigateTo('today');
    loadTodayWorkout();
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
  btn.disabled = true;
  btn.textContent = 'Entrando...';
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    showLoginError(friendlyError(err.code));
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});

document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Criando...';
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    showLoginError(friendlyError(err.code));
    btn.disabled = false;
    btn.textContent = 'Criar conta';
  }
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

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearLoginError() {
  const el = document.getElementById('login-error');
  el.textContent = '';
  el.classList.add('hidden');
}

function friendlyError(code) {
  const map = {
    'auth/user-not-found': 'E-mail não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/email-already-in-use': 'E-mail já cadastrado.',
    'auth/weak-password': 'Senha muito fraca (mín. 6 caracteres).',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Tente mais tarde.',
  };
  return map[code] || 'Erro inesperado. Tente novamente.';
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

// ─── Today ────────────────────────────────────────────────────
async function loadTodayWorkout() {
  const date = todayStr();
  const docRef = doc(workoutsCol(), date);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    activeWorkout = snap.data();
    activeWorkout.id = date;
    renderTodayWorkout();
  } else {
    activeWorkout = null;
    renderGroupSelector();
  }
  await loadFrequency();
}

function renderGroupSelector() {
  const container = document.getElementById('today-content');
  container.innerHTML = `
    <div class="section-title">Escolha o grupo de hoje</div>
    <div class="group-grid">
      ${ALL_GROUPS.map(g => `
        <button class="group-card" data-group="${g}">
          <span class="group-icon">${GROUP_ICONS[g]}</span>
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
  const date = todayStr();
  const exercises = getExercisesByGroup(group).map(ex => ({
    id: ex.id,
    name: ex.name,
    defaultWeight: ex.defaultWeight,
    sets: [],
  }));

  activeWorkout = { id: date, date, group, exercises };
  await saveWorkout();
  renderTodayWorkout();
}

function renderTodayWorkout() {
  const container = document.getElementById('today-content');
  const { group, exercises } = activeWorkout;
  const completedSets = exercises.reduce((n, ex) => n + ex.sets.filter(s => s.completed).length, 0);
  const totalSets = exercises.reduce((n, ex) => n + ex.sets.length, 0);

  container.innerHTML = `
    <div class="workout-header">
      <div class="workout-group-badge">${GROUP_ICONS[group]} ${group}</div>
      <div class="workout-stats-mini">${completedSets}/${totalSets} séries</div>
      <button id="change-group-btn" class="btn-ghost btn-sm">Trocar grupo</button>
    </div>
    <div id="exercises-list"></div>
  `;

  document.getElementById('change-group-btn').addEventListener('click', () => {
    if (confirm('Trocar o grupo apagará o treino de hoje. Continuar?')) {
      activeWorkout = null;
      renderGroupSelector();
    }
  });

  renderExercises();
}

function renderExercises() {
  const list = document.getElementById('exercises-list');
  list.innerHTML = activeWorkout.exercises.map((ex, exIdx) => `
    <div class="exercise-card" id="ex-${exIdx}">
      <div class="exercise-header">
        <span class="exercise-name">${ex.name}</span>
        <button class="btn-add-set" data-ex="${exIdx}">+ Série</button>
      </div>
      <div class="sets-list" id="sets-${exIdx}">
        ${ex.sets.map((s, sIdx) => renderSetRow(exIdx, sIdx, s)).join('')}
      </div>
      ${ex.sets.length === 0 ? `<div class="no-sets">Toque em "+ Série" para registrar</div>` : ''}
    </div>
  `).join('');

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
    btn.addEventListener('click', async e => {
      const { ex, set } = btn.dataset;
      activeWorkout.exercises[+ex].sets.splice(+set, 1);
      await saveWorkout();
      renderExercises();
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
  const completedSets = exercises.reduce((n, ex) => n + ex.sets.filter(s => s.completed).length, 0);
  const totalSets = exercises.reduce((n, ex) => n + ex.sets.length, 0);
  const el = document.querySelector('.workout-stats-mini');
  if (el) el.textContent = `${completedSets}/${totalSets} séries`;
}

// ─── Add Set Modal ────────────────────────────────────────────
function showAddSetModal(exIdx) {
  const ex = activeWorkout.exercises[exIdx];
  const lastSet = ex.sets[ex.sets.length - 1];
  const defaultWeight = lastSet ? lastSet.weight : ex.defaultWeight;
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
    renderExercises();
    updateWorkoutStats();
  };
}

document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// Weight increment/decrement
document.querySelectorAll('.btn-weight-dec').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById('set-weight');
    input.value = Math.max(0, (parseFloat(input.value) || 0) - 2.5).toFixed(1).replace(/\.0$/, '');
  });
});
document.querySelectorAll('.btn-weight-inc').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById('set-weight');
    input.value = ((parseFloat(input.value) || 0) + 2.5).toFixed(1).replace(/\.0$/, '');
  });
});
document.querySelectorAll('.btn-reps-dec').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById('set-reps');
    input.value = Math.max(1, (parseInt(input.value) || 0) - 1);
  });
});
document.querySelectorAll('.btn-reps-inc').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById('set-reps');
    input.value = (parseInt(input.value) || 0) + 1;
  });
});

// ─── Save ─────────────────────────────────────────────────────
async function saveWorkout() {
  const docRef = doc(workoutsCol(), activeWorkout.id);
  await setDoc(docRef, {
    date: activeWorkout.date,
    group: activeWorkout.group,
    exercises: activeWorkout.exercises,
    updatedAt: Timestamp.now(),
  });
}

// ─── Frequency ────────────────────────────────────────────────
async function loadFrequency() {
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const q = query(workoutsCol(), orderBy('date', 'desc'), limit(60));
  const snap = await getDocs(q);
  const dates = snap.docs.map(d => d.data().date);

  const weekly = dates.filter(d => d >= weekAgo).length;
  const monthly = dates.filter(d => d >= monthStart).length;

  document.getElementById('freq-weekly').textContent = weekly;
  document.getElementById('freq-monthly').textContent = monthly;
}

// ─── History ──────────────────────────────────────────────────
async function loadHistory() {
  const container = document.getElementById('history-list');
  container.innerHTML = '<div class="loading">Carregando...</div>';

  const q = query(workoutsCol(), orderBy('date', 'desc'), limit(60));
  const snap = await getDocs(q);

  if (snap.empty) {
    container.innerHTML = '<div class="empty-state">Nenhum treino registrado ainda.</div>';
    return;
  }

  container.innerHTML = snap.docs.map(d => {
    const w = d.data();
    const totalSets = w.exercises.reduce((n, ex) => n + ex.sets.length, 0);
    const doneSets = w.exercises.reduce((n, ex) => n + ex.sets.filter(s => s.completed).length, 0);
    const exercisesWithSets = w.exercises.filter(ex => ex.sets.length > 0).length;
    return `
      <div class="history-card" data-id="${d.id}">
        <div class="history-date">${fmtDate(w.date)}${w.date === todayStr() ? ' <span class="badge-today">Hoje</span>' : ''}</div>
        <div class="history-group">${GROUP_ICONS[w.group] || ''} ${w.group}</div>
        <div class="history-meta">${exercisesWithSets} exercícios · ${doneSets}/${totalSets} séries concluídas</div>
        <div class="history-exercises">
          ${w.exercises.filter(ex => ex.sets.length > 0).map(ex => `
            <div class="history-ex-row">
              <span>${ex.name}</span>
              <span class="history-ex-sets">${ex.sets.map(s => `${s.weight > 0 ? s.weight + 'kg' : 'livre'}×${s.reps}`).join(', ')}</span>
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
  getAllExercises().forEach(ex => {
    const opt = document.createElement('option');
    opt.value = ex.id;
    opt.textContent = ex.name;
    if (ex.id === current) opt.selected = true;
    sel.appendChild(opt);
  });
  if (current) loadProgressChart(current);
}

document.getElementById('progress-exercise-select').addEventListener('change', e => {
  if (e.target.value) loadProgressChart(e.target.value);
  else clearChart();
});

async function loadProgressChart(exerciseId) {
  document.getElementById('progress-empty').classList.add('hidden');
  const container = document.getElementById('chart-container');
  container.innerHTML = '<div class="loading">Carregando dados...</div>';

  const q = query(workoutsCol(), orderBy('date', 'asc'), limit(120));
  const snap = await getDocs(q);

  const points = [];
  snap.docs.forEach(d => {
    const w = d.data();
    const ex = w.exercises.find(e => e.id === exerciseId);
    if (!ex || ex.sets.length === 0) return;
    const maxWeight = Math.max(...ex.sets.map(s => s.weight));
    const totalVol = ex.sets.reduce((n, s) => n + s.weight * s.reps, 0);
    points.push({ date: w.date, maxWeight, totalVol, sets: ex.sets });
  });

  if (points.length === 0) {
    container.innerHTML = '';
    document.getElementById('progress-empty').classList.remove('hidden');
    return;
  }

  container.innerHTML = '<canvas id="progress-chart"></canvas>';
  const ctx = document.getElementById('progress-chart').getContext('2d');

  if (chart) chart.destroy();

  const exerciseName = getAllExercises().find(e => e.id === exerciseId)?.name || exerciseId;

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: points.map(p => fmtDate(p.date)),
      datasets: [
        {
          label: 'Peso máximo (kg)',
          data: points.map(p => p.maxWeight),
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124,58,237,0.15)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#7c3aed',
          pointRadius: 5,
          yAxisID: 'y',
        },
        {
          label: 'Volume total (kg×reps)',
          data: points.map(p => p.totalVol),
          borderColor: '#f97316',
          backgroundColor: 'rgba(249,115,22,0.10)',
          fill: false,
          tension: 0.3,
          pointBackgroundColor: '#f97316',
          pointRadius: 4,
          yAxisID: 'y1',
          borderDash: [5, 3],
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#e5e5e5', font: { size: 12 } },
        },
        title: {
          display: true,
          text: exerciseName,
          color: '#e5e5e5',
          font: { size: 14, weight: 'bold' },
        },
        tooltip: {
          backgroundColor: '#1e1e2e',
          titleColor: '#e5e5e5',
          bodyColor: '#a3a3a3',
          borderColor: '#333',
          borderWidth: 1,
        },
      },
      scales: {
        x: { ticks: { color: '#a3a3a3' }, grid: { color: '#2a2a2a' } },
        y: {
          type: 'linear',
          position: 'left',
          ticks: { color: '#7c3aed' },
          grid: { color: '#2a2a2a' },
          title: { display: true, text: 'Peso (kg)', color: '#7c3aed' },
        },
        y1: {
          type: 'linear',
          position: 'right',
          ticks: { color: '#f97316' },
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'Volume', color: '#f97316' },
        },
      },
    },
  });
}

function clearChart() {
  if (chart) { chart.destroy(); chart = null; }
  document.getElementById('chart-container').innerHTML = '';
  document.getElementById('progress-empty').classList.remove('hidden');
}

// ─── Register service worker ──────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

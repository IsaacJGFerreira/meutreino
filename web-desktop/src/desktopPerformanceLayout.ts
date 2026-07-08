import { collection, doc, onSnapshot, orderBy, query, type DocumentData } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { initFirebase, readInitialConfig, type FirebaseServices } from "./firebase";
import type { ExerciseRecord, SeriesRecord, TrainerStudent, WorkoutRecord } from "./types";

const STYLE_ID = "meutreino-desktop-performance-style";
const ROOT_ID = "meutreino-desktop-performance-root";
const SCREEN_CLASS = "performance-app-native";
const SELECTED_STUDENT_KEY = "meutreino.selectedStudent";
const CACHE_PREFIX = "meutreino.performance.records";

type Role = "ALUNO" | "TREINADOR" | "ADMIN";

type ProfileState = {
  uid: string;
  name: string;
  role: Role;
};

type TargetState = {
  uid: string;
  name: string;
};

type GraphPoint = {
  value: number;
  label: string;
};

let services: FirebaseServices | null = null;
let authUser: User | null = null;
let profile: ProfileState | null = null;
let target: TargetState | null = null;
let records: WorkoutRecord[] = [];
let searchTerm = "";
let detailRecordId: string | null = null;
let chooserOpen = false;
let chooserValue = "";
let graphExercise: string | null = null;
let loadingRecords = false;
let recordsError = "";
let authListenerAttached = false;
let profileUnsubscribe: (() => void) | null = null;
let recordsUnsubscribe: (() => void) | null = null;
let recordsTargetUid: string | null = null;
let documentListenersAttached = false;
let observerStarted = false;
let renderQueued = false;
let lastRenderedHtml = "";

function getServices() {
  if (services) return services;
  const config = readInitialConfig();
  if (!config) return null;

  try {
    services = initFirebase(config);
    return services;
  } catch {
    return null;
  }
}

function attachAuthListener() {
  const currentServices = getServices();
  if (!currentServices || authListenerAttached) return;

  authListenerAttached = true;
  onAuthStateChanged(currentServices.auth, (user) => {
    authUser = user;
    profile = null;
    stopProfileListener();
    stopRecordsListener();
    records = [];
    recordsTargetUid = null;

    if (user) {
      startProfileListener(user);
    }

    scheduleRender();
  });
}

function startProfileListener(user: User) {
  const currentServices = getServices();
  if (!currentServices) return;

  profileUnsubscribe = onSnapshot(
    doc(currentServices.db, "users", user.uid),
    (snap) => {
      const data = snap.data();
      profile = {
        uid: user.uid,
        name: String(data?.name ?? user.email ?? "Aluno"),
        role: normalizeRole(data?.role)
      };
      syncTargetAndRecords();
      scheduleRender();
    },
    () => {
      profile = {
        uid: user.uid,
        name: user.email ?? "Aluno",
        role: "ALUNO"
      };
      syncTargetAndRecords();
      scheduleRender();
    }
  );
}

function stopProfileListener() {
  profileUnsubscribe?.();
  profileUnsubscribe = null;
}

function syncTargetAndRecords() {
  const nextTarget = resolveTarget();
  const nextUid = nextTarget?.uid ?? null;
  target = nextTarget;

  if (!nextUid) {
    stopRecordsListener();
    recordsTargetUid = null;
    records = [];
    loadingRecords = false;
    recordsError = "";
    return;
  }

  if (recordsTargetUid === nextUid && recordsUnsubscribe) return;

  stopRecordsListener();
  recordsTargetUid = nextUid;
  records = loadCachedRecords(nextUid);
  loadingRecords = true;
  recordsError = "";

  const currentServices = getServices();
  if (!currentServices) return;

  recordsUnsubscribe = onSnapshot(
    query(collection(currentServices.db, "users", nextUid, "treino_registros"), orderBy("createdAt", "desc")),
    (snap) => {
      loadingRecords = false;
      recordsError = "";
      records = snap.docs.map((item) => workoutRecordFromDoc(item.id, item.data()));
      saveCachedRecords(nextUid, records);
      scheduleRender();
    },
    (error) => {
      loadingRecords = false;
      recordsError = (error as Error).message || "Não foi possível carregar o desempenho.";
      scheduleRender();
    }
  );
}

function stopRecordsListener() {
  recordsUnsubscribe?.();
  recordsUnsubscribe = null;
}

function resolveTarget(): TargetState | null {
  if (!profile) return null;
  if (profile.role === "ALUNO") {
    return { uid: profile.uid, name: profile.name };
  }

  const selected = readSelectedStudent();
  if (!selected) return null;
  return { uid: selected.uid, name: selected.name };
}

function readSelectedStudent(): TrainerStudent | null {
  const raw = localStorage.getItem(SELECTED_STUDENT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as TrainerStudent;
    return parsed?.uid ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeRole(value: unknown): Role {
  const role = String(value ?? "ALUNO").trim().toUpperCase();
  if (role === "TREINADOR" || role === "ADMIN") return role;
  return "ALUNO";
}

function workoutRecordFromDoc(id: string, data: DocumentData): WorkoutRecord {
  const rawExercises = Array.isArray(data.exercicios) ? data.exercicios : [];

  return {
    id,
    idLocal: String(data.idLocal ?? id),
    dataHora: String(data.dataHora ?? "-"),
    nomeTreino: String(data.nomeTreino ?? "Treino"),
    completo: Boolean(data.completo ?? false),
    createdAt: Number(data.createdAt ?? 0),
    exercicios: rawExercises.map((item: unknown): ExerciseRecord => {
      const exercise = item as Record<string, unknown>;
      const rawSeries = Array.isArray(exercise.series) ? exercise.series : [];

      return {
        nomeExercicio: String(exercise.nomeExercicio ?? "Exercício"),
        series: rawSeries.map((serie: unknown): SeriesRecord => {
          const current = serie as Record<string, unknown>;
          return {
            serieNumero: Number(current.serieNumero ?? 0),
            kg: Number(current.kg ?? 0),
            reps: Number(current.reps ?? 0)
          };
        })
      };
    })
  };
}

function loadCachedRecords(uid: string) {
  const raw = localStorage.getItem(`${CACHE_PREFIX}.${uid}`);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as WorkoutRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCachedRecords(uid: string, list: WorkoutRecord[]) {
  localStorage.setItem(`${CACHE_PREFIX}.${uid}`, JSON.stringify(list));
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .screen.${SCREEN_CLASS} {
      display: block;
      background: #deefe4;
      padding: 12px;
      border-radius: 0;
    }

    .screen.${SCREEN_CLASS} > .summary-row,
    .screen.${SCREEN_CLASS} > .panel {
      display: none !important;
    }

    .performance-mobile-app {
      width: min(100%, 430px);
      margin: 0 auto;
      color: #2f3e3f;
    }

    .performance-title {
      margin: 12px 0 14px;
      text-align: center;
      color: #5aab8a;
      font-size: 32px;
      line-height: 1.08;
      font-weight: 900;
    }

    .performance-search {
      width: 100%;
      min-height: 54px;
      margin: 6px 0 12px;
      border: 1px solid #c9d7d0;
      border-radius: 12px;
      background: #ffffff;
      color: #000000;
      padding: 0 16px;
      outline: none;
      font-size: 15px;
    }

    .performance-search::placeholder {
      color: rgba(0, 0, 0, 0.6);
    }

    .performance-graph-btn {
      width: 100%;
      min-height: 54px;
      margin: 0 0 14px;
      border: 0;
      border-radius: 18px;
      background: #5aab8a;
      color: #ffffff;
      font-weight: 800;
      font-size: 15px;
    }

    .performance-list {
      display: grid;
      gap: 12px;
    }

    .performance-card {
      width: 100%;
      display: block;
      border: 1px solid #c9d7d0;
      border-radius: 12px;
      background: #ffffff;
      box-shadow: 0 8px 18px rgba(31, 71, 60, 0.18);
      padding: 14px;
      text-align: left;
      color: #2f3e3f;
    }

    .performance-card-status {
      display: block;
      color: #5aab8a;
      font-size: 14px;
      font-weight: 800;
    }

    .performance-card-status.incomplete {
      color: #7a5b00;
    }

    .performance-card-title {
      display: block;
      margin-top: 6px;
      color: #64898a;
      font-size: 18px;
      font-weight: 800;
    }

    .performance-card-date {
      display: block;
      margin-top: 6px;
      color: #777777;
      font-size: 13px;
    }

    .performance-empty {
      border: 1px solid #cfe6d9;
      border-radius: 18px;
      background: #ffffff;
      padding: 16px;
      color: #2b2b2b;
      text-align: center;
      font-size: 15px;
    }

    .performance-error {
      border-color: #e58a8a;
      background: #fdecec;
    }

    .performance-dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9998;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.34);
      padding: 16px;
    }

    .performance-dialog {
      width: min(100%, 430px);
      max-height: min(720px, calc(100vh - 32px));
      overflow: auto;
      border-radius: 18px;
      background: #ffffff;
      padding: 14px;
      box-shadow: 0 18px 45px rgba(0, 0, 0, 0.2);
      color: #000000;
    }

    .performance-dialog h2,
    .performance-dialog h3 {
      margin: 0 0 8px;
      color: #000000;
      font-weight: 900;
    }

    .performance-dialog h2 {
      font-size: 20px;
    }

    .performance-dialog h3 {
      font-size: 18px;
    }

    .performance-dialog p,
    .performance-dialog pre {
      color: #000000;
      font-size: 14px;
      line-height: 1.45;
    }

    .performance-detail-list {
      display: grid;
      gap: 12px;
      margin: 12px 0;
    }

    .performance-detail-exercise {
      border: 1px solid #e3ece7;
      border-radius: 12px;
      background: #fbfdfc;
      padding: 10px;
    }

    .performance-detail-exercise strong {
      display: block;
      margin-bottom: 6px;
      color: #2f3e3f;
    }

    .performance-detail-exercise span {
      display: block;
      color: #2f3e3f;
      font-size: 13px;
      margin-top: 3px;
    }

    .performance-dialog-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      margin-top: 14px;
    }

    .performance-dialog-actions button {
      min-height: 42px;
      border-radius: 12px;
      padding: 0 16px;
      font-weight: 800;
    }

    .performance-dialog-actions .primary {
      background: #5aab8a;
      color: #ffffff;
    }

    .performance-choice-input {
      width: 100%;
      min-height: 50px;
      border: 1px solid #c9d7d0;
      border-radius: 12px;
      padding: 0 12px;
      font-size: 15px;
      color: #000000;
      background: #ffffff;
    }

    .performance-graph-summary {
      margin: 0 0 10px;
      color: rgba(0, 0, 0, 0.85);
      font-size: 13px;
      white-space: pre-line;
    }

    .performance-line-chart {
      width: 100%;
      height: auto;
      display: block;
      background: #ffffff;
    }

    .performance-toast {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 9999;
      max-width: min(360px, calc(100vw - 44px));
      border-radius: 8px;
      padding: 12px 14px;
      background: #2f3e3f;
      color: white;
      box-shadow: 0 16px 34px rgba(41, 71, 61, 0.12);
      font-weight: 800;
    }

    @media (min-width: 980px) {
      .performance-mobile-app {
        width: min(100%, 780px);
      }
    }
  `;
  document.head.appendChild(style);
}

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  window.requestAnimationFrame(() => {
    renderQueued = false;
    renderPerformanceScreen();
  });
}

function findPerformanceScreen() {
  const screens = Array.from(document.querySelectorAll<HTMLElement>("section.screen"));
  return (
    screens.find((screen) => {
      if (screen.querySelector(`#${ROOT_ID}`)) return true;
      const title = normalize(screen.querySelector(".chart-panel .section-title h3")?.textContent);
      return title === "desempenho";
    }) ?? null
  );
}

function ensureRoot(screen: HTMLElement) {
  screen.classList.add(SCREEN_CLASS);
  let root = screen.querySelector<HTMLElement>(`#${ROOT_ID}`);

  if (!root) {
    root = document.createElement("div");
    root.id = ROOT_ID;
    screen.appendChild(root);
    lastRenderedHtml = "";
  }

  return root;
}

function renderPerformanceScreen() {
  syncTargetAndRecords();
  const screen = findPerformanceScreen();
  if (!screen) return;

  const root = ensureRoot(screen);
  const html = renderPerformanceHtml();
  if (html !== lastRenderedHtml) {
    root.innerHTML = html;
    lastRenderedHtml = html;
  }
}

function renderPerformanceHtml() {
  const filtered = getFilteredRecords();

  return `
    <div class="performance-mobile-app">
      <h1 class="performance-title">Desempenho</h1>
      <input class="performance-search" data-action="performance-search" value="${escapeAttribute(searchTerm)}" placeholder="Buscar exercício (ex: remada, supino...)" />
      <button class="performance-graph-btn" type="button" data-action="open-graph-chooser">Ver gráfico do exercício</button>
      ${renderList(filtered)}
      ${renderDetailDialog()}
      ${renderChooserDialog()}
      ${renderGraphDialog()}
    </div>
  `;
}

function renderList(filtered: WorkoutRecord[]) {
  if (!authUser || !profile) {
    return `<div class="performance-empty">Carregando usuário...</div>`;
  }

  if (!target) {
    return `<div class="performance-empty">Selecione um aluno no Perfil.</div>`;
  }

  if (recordsError && records.length === 0) {
    return `<div class="performance-empty performance-error">Sem acesso/erro nuvem: ${escapeHtml(recordsError)}</div>`;
  }

  if (loadingRecords && records.length === 0) {
    return `<div class="performance-empty">Carregando registros...</div>`;
  }

  if (records.length === 0) {
    return `<div class="performance-empty">Nenhum treino registrado ainda.</div>`;
  }

  if (filtered.length === 0) {
    return `<div class="performance-empty">Nenhum treino encontrado para a busca.</div>`;
  }

  return `
    <div class="performance-list">
      ${filtered.map((record) => renderRecordCard(record)).join("")}
    </div>
  `;
}

function renderRecordCard(record: WorkoutRecord) {
  const complete = record.completo;
  return `
    <button class="performance-card" type="button" data-action="open-details" data-record-id="${escapeAttribute(record.id)}">
      <span class="performance-card-status ${complete ? "" : "incomplete"}">${complete ? "✅ Completo" : "⚠️ Incompleto"}</span>
      <span class="performance-card-title">${escapeHtml(record.nomeTreino)}</span>
      <span class="performance-card-date">${escapeHtml(record.dataHora)}</span>
    </button>
  `;
}

function renderDetailDialog() {
  if (!detailRecordId) return "";
  const record = records.find((item) => item.id === detailRecordId);
  if (!record) return "";

  const term = searchTerm.trim();
  const exercises = term
    ? record.exercicios.filter((exercise) => includesText(exercise.nomeExercicio, term))
    : record.exercicios;

  return `
    <div class="performance-dialog-backdrop" data-action="close-details">
      <article class="performance-dialog" role="dialog" aria-modal="true" aria-label="Detalhes do treino" data-dialog-box="true">
        <h2>Detalhes do treino</h2>
        <p>
          <strong>Treino:</strong> ${escapeHtml(record.nomeTreino)}<br />
          <strong>Data:</strong> ${escapeHtml(record.dataHora)}<br />
          <strong>Status:</strong> ${record.completo ? "✅ Completo" : "⚠️ Incompleto"}
        </p>
        <div class="performance-detail-list">
          ${exercises.length ? exercises.map(renderExerciseDetail).join("") : `<p>Nenhum exercício corresponde à busca atual.</p>`}
        </div>
        <div class="performance-dialog-actions">
          <button class="primary" type="button" data-action="close-details">OK</button>
        </div>
      </article>
    </div>
  `;
}

function renderExerciseDetail(exercise: ExerciseRecord) {
  return `
    <div class="performance-detail-exercise">
      <strong>• ${escapeHtml(exercise.nomeExercicio)}</strong>
      ${exercise.series.map((serie) => `<span>Série ${serie.serieNumero}: ${formatKg(serie.kg)} kg x ${serie.reps} reps</span>`).join("")}
    </div>
  `;
}

function renderChooserDialog() {
  if (!chooserOpen) return "";
  const names = getExerciseNames();
  const options = names.map((name) => `<option value="${escapeAttribute(name)}"></option>`).join("");

  return `
    <div class="performance-dialog-backdrop" data-action="close-graph-chooser">
      <article class="performance-dialog" role="dialog" aria-modal="true" aria-label="Escolha o exercício" data-dialog-box="true">
        <h2>Escolha o exercício</h2>
        <input class="performance-choice-input" data-action="graph-choice-input" list="performance-exercise-options" value="${escapeAttribute(chooserValue)}" placeholder="Digite ou escolha o exercício" />
        <datalist id="performance-exercise-options">${options}</datalist>
        <div class="performance-dialog-actions">
          <button type="button" data-action="close-graph-chooser">Cancelar</button>
          <button class="primary" type="button" data-action="show-graph">Ver gráfico</button>
        </div>
      </article>
    </div>
  `;
}

function renderGraphDialog() {
  if (!graphExercise) return "";
  const points = buildGraphPoints(graphExercise);

  if (!points.length) {
    return `
      <div class="performance-dialog-backdrop" data-action="close-graph">
        <article class="performance-dialog" role="dialog" aria-modal="true" aria-label="Evolução" data-dialog-box="true">
          <h2>Evolução: ${escapeHtml(graphExercise)}</h2>
          <p>Sem dados para "${escapeHtml(graphExercise)}".</p>
          <div class="performance-dialog-actions">
            <button class="primary" type="button" data-action="close-graph">OK</button>
          </div>
        </article>
      </div>
    `;
  }

  const weights = points.map((point) => point.value);
  const lastWeight = weights[weights.length - 1] ?? 0;
  const bestWeight = Math.max(...weights);

  return `
    <div class="performance-dialog-backdrop" data-action="close-graph">
      <article class="performance-dialog" role="dialog" aria-modal="true" aria-label="Evolução" data-dialog-box="true">
        <h3>Evolução: ${escapeHtml(graphExercise)}</h3>
        <p class="performance-graph-summary">Exercício: ${escapeHtml(graphExercise)}\nÚltimo: ${formatKg(lastWeight)} kg\nMelhor: ${formatKg(bestWeight)} kg</p>
        ${renderLineChart(points)}
        <div class="performance-dialog-actions">
          <button class="primary" type="button" data-action="close-graph">OK</button>
        </div>
      </article>
    </div>
  `;
}

function renderLineChart(points: GraphPoint[]) {
  const width = 360;
  const height = 260;
  const left = 46;
  const right = 14;
  const top = 18;
  const bottom = 76;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(1, Math.ceil(Math.max(...points.map((point) => point.value)) * 1.15));
  const divisor = Math.max(points.length - 1, 1);

  const coords = points.map((point, index) => {
    const x = left + (plotWidth * index) / divisor;
    const y = top + plotHeight - (plotHeight * point.value) / maxValue;
    return { ...point, x, y };
  });

  const line = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const fill = `${left},${top + plotHeight} ${line} ${left + plotWidth},${top + plotHeight}`;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = top + plotHeight * ratio;
    const value = maxValue - maxValue * ratio;
    return `
      <line x1="${left}" y1="${y.toFixed(1)}" x2="${left + plotWidth}" y2="${y.toFixed(1)}" stroke="#e3ece7" stroke-width="1" />
      <text x="${left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#444">${Math.round(value)} kg</text>
    `;
  }).join("");

  const xLabels = coords.map((point) => `
    <text x="${point.x.toFixed(1)}" y="${height - 42}" transform="rotate(-35 ${point.x.toFixed(1)} ${height - 42})" font-size="9" fill="#444">${escapeHtml(point.label)}</text>
  `).join("");

  const dots = coords.map((point) => `
    <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="5" fill="#5aab8a" />
  `).join("");

  return `
    <svg class="performance-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de evolução de carga">
      ${grid}
      <polyline points="${line}" fill="none" stroke="#5aab8a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      <polygon points="${fill}" fill="#5aab8a" opacity="0.18" />
      ${dots}
      ${xLabels}
    </svg>
  `;
}

function getFilteredRecords() {
  const term = searchTerm.trim();
  if (!term) return records;

  return records.filter((record) => {
    return includesText(record.nomeTreino, term) || record.exercicios.some((exercise) => includesText(exercise.nomeExercicio, term));
  });
}

function getExerciseNames() {
  return Array.from(new Set(records.flatMap((record) => record.exercicios.map((exercise) => exercise.nomeExercicio))))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function buildGraphPoints(exerciseName: string): GraphPoint[] {
  const recordsWithExercise = records
    .filter((record) => record.exercicios.some((exercise) => sameName(exercise.nomeExercicio, exerciseName)))
    .slice()
    .sort((a, b) => recordSortValue(a) - recordSortValue(b));

  const dayCounter = new Map<string, number>();

  return recordsWithExercise.map((record) => {
    const exercise = record.exercicios.find((item) => sameName(item.nomeExercicio, exerciseName));
    const maxKg = exercise?.series.reduce((max, serie) => Math.max(max, serie.kg), 0) ?? 0;
    const day = shortDayLabel(record);
    const count = (dayCounter.get(day) ?? 0) + 1;
    dayCounter.set(day, count);
    return {
      value: maxKg,
      label: `${day} - ${count}º treino`
    };
  }).filter((point) => point.value > 0);
}

function shortDayLabel(record: WorkoutRecord) {
  const parsed = parsePtBrDate(record.dataHora);
  if (parsed) {
    const day = String(parsed.getDate()).padStart(2, "0");
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const year = String(parsed.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }

  return record.dataHora.slice(0, 8) || "--/--/--";
}

function recordSortValue(record: WorkoutRecord) {
  if (record.createdAt) return record.createdAt;
  return parsePtBrDate(record.dataHora)?.getTime() ?? 0;
}

function parsePtBrDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;

  const [, day, month, year, hour = "0", minute = "0"] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

function handleDocumentClick(event: MouseEvent) {
  const targetElement = event.target as Element | null;
  const actionElement = targetElement?.closest(`#${ROOT_ID} [data-action]`) as HTMLElement | null;
  if (!actionElement) return;

  if (actionElement.closest("[data-dialog-box]") && targetElement?.classList.contains("performance-dialog-backdrop")) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const action = actionElement.getAttribute("data-action");

  if (action === "open-details") {
    detailRecordId = actionElement.getAttribute("data-record-id");
    scheduleRender();
    return;
  }

  if (action === "close-details") {
    detailRecordId = null;
    scheduleRender();
    return;
  }

  if (action === "open-graph-chooser") {
    const names = getExerciseNames();
    if (!names.length) {
      showToast("Nenhum treino ainda.");
      return;
    }
    chooserValue = chooserValue || names[0] || "";
    chooserOpen = true;
    scheduleRender();
    return;
  }

  if (action === "close-graph-chooser") {
    chooserOpen = false;
    scheduleRender();
    return;
  }

  if (action === "show-graph") {
    const exercise = chooserValue.trim();
    if (!exercise) {
      showToast("Escolha um exercício.");
      return;
    }
    chooserOpen = false;
    graphExercise = exercise;
    scheduleRender();
    return;
  }

  if (action === "close-graph") {
    graphExercise = null;
    scheduleRender();
  }
}

function handleDocumentInput(event: Event) {
  const input = event.target as HTMLInputElement | null;
  if (!input?.matches(`#${ROOT_ID} input[data-action]`)) return;

  const action = input.getAttribute("data-action");

  if (action === "performance-search") {
    searchTerm = input.value;
    scheduleRender();
  }

  if (action === "graph-choice-input") {
    chooserValue = input.value;
  }
}

function handleDocumentFocus(event: FocusEvent) {
  const input = event.target as HTMLInputElement | null;
  if (!input?.matches(`#${ROOT_ID} input[data-action="graph-choice-input"]`)) return;
  input.click();
}

function includesText(value: string, term: string) {
  return normalize(value).includes(normalize(term));
}

function sameName(a: string, b: string) {
  return normalize(a) === normalize(b);
}

function normalize(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function formatKg(value: number) {
  return Number.isInteger(value) ? value.toFixed(1) : value.toString();
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function showToast(message: string) {
  document.querySelector(".performance-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "performance-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

function isMutationInsidePerformanceRoot(mutation: MutationRecord) {
  const targetNode = mutation.target;
  if (!(targetNode instanceof Element)) return false;
  return Boolean(targetNode.closest(`#${ROOT_ID}`));
}

function bootDesktopPerformanceLayout() {
  injectStyles();
  attachAuthListener();

  if (!documentListenersAttached) {
    documentListenersAttached = true;
    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("input", handleDocumentInput, true);
    document.addEventListener("focusin", handleDocumentFocus, true);
    window.addEventListener("storage", () => {
      syncTargetAndRecords();
      scheduleRender();
    });
  }

  if (!observerStarted && document.body) {
    observerStarted = true;
    new MutationObserver((mutations) => {
      if (mutations.length > 0 && mutations.every(isMutationInsidePerformanceRoot)) return;
      syncTargetAndRecords();
      scheduleRender();
    }).observe(document.body, { childList: true, subtree: true });
  }

  scheduleRender();
}

bootDesktopPerformanceLayout();

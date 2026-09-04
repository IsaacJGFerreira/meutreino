import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  type DocumentData
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { formatDateTime, mapWorkoutDoc, newId, parseNumber } from "./firebaseApi";
import { initFirebase, readInitialConfig, type FirebaseServices } from "./firebase";
import type { ExercisePlan, ExerciseRecord, SeriesRecord, WorkoutPlan, WorkoutRecord } from "./types";

const STYLE_ID = "meutreino-mobile-training-style";
const ROOT_ID = "meutreino-mobile-training-root";
const PANEL_CLASS = "training-mobile-native";
const STORAGE_PREFIX = "meutreino.webTraining.mobileState";

type DraftValue = {
  kg: string;
  reps: string;
};

type SavedTrainingState = {
  activeWorkoutId?: string | null;
  workoutStartedAt?: number | null;
  expandedWorkoutId?: string | null;
  expandedWorkoutIds?: string[];
  expandedExercises?: string[];
  draft?: Record<string, DraftValue>;
};

let services: FirebaseServices | null = null;
let currentUid: string | null = null;
let workouts: WorkoutPlan[] = [];
let records: WorkoutRecord[] = [];
let draftValues: Record<string, DraftValue> = {};
let activeWorkoutId: string | null = null;
let workoutStartedAt: number | null = null;
let expandedWorkoutIds = new Set<string>();
let expandedExercises = new Set<string>();
let pendingExercises = new Set<string>();
let savingWorkoutId: string | null = null;
let authListenerAttached = false;
let documentListenersAttached = false;
let observerStarted = false;
let renderQueued = false;
let workoutsUnsubscribe: (() => void) | null = null;
let recordsUnsubscribe: (() => void) | null = null;
let lastRenderedHtml = "";
let timerIntervalId: number | null = null;
let savingDurationSeconds: number | null = null;

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
    currentUid = user?.uid ?? null;
    workouts = [];
    records = [];
    stopFirebaseListeners();

    if (currentUid) {
      loadTrainingState(currentUid);
      startFirebaseListeners(currentUid);
    } else {
      activeWorkoutId = null;
      workoutStartedAt = null;
      expandedWorkoutIds = new Set();
      expandedExercises = new Set();
      draftValues = {};
    }

    syncTimerTicker();
    scheduleRender();
  });
}

function startFirebaseListeners(uid: string) {
  const currentServices = getServices();
  if (!currentServices) return;

  workoutsUnsubscribe = onSnapshot(
    collection(currentServices.db, "users", uid, "treinos"),
    (snap) => {
      workouts = snap.docs
        .map((item) => mapWorkoutDoc(item.id, item.data()))
        .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));

      if (activeWorkoutId && !workouts.some((workout) => workout.id === activeWorkoutId)) {
        activeWorkoutId = null;
        workoutStartedAt = null;
      }

      const validIds = new Set(workouts.map((workout) => workout.id));
      expandedWorkoutIds = new Set(Array.from(expandedWorkoutIds).filter((id) => validIds.has(id)));

      if (!expandedWorkoutIds.size && workouts.length > 0) {
        expandedWorkoutIds.add(workouts[0].id);
      }

      saveTrainingState();
      syncTimerTicker();
      scheduleRender();
    },
    () => {
      showToast("Não foi possível carregar os treinos.");
    }
  );

  recordsUnsubscribe = onSnapshot(
    collection(currentServices.db, "users", uid, "treino_registros"),
    (snap) => {
      records = snap.docs
        .map((item) => workoutRecordFromDoc(item.id, item.data()))
        .sort((a, b) => workoutRecordTime(b) - workoutRecordTime(a));
      scheduleRender();
    },
    () => {
      showToast("Não foi possível carregar o histórico anterior.");
    }
  );
}

function stopFirebaseListeners() {
  workoutsUnsubscribe?.();
  recordsUnsubscribe?.();
  workoutsUnsubscribe = null;
  recordsUnsubscribe = null;
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
    duracaoSegundos: Number(data.duracaoSegundos ?? 0),
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

function workoutRecordTime(record: WorkoutRecord) {
  if (Number.isFinite(record.createdAt) && record.createdAt > 0) return record.createdAt;
  const match = record.dataHora.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s+(\d{2}):(\d{2}))?/);
  if (!match) return 0;
  const [, day, month, year, hour = "0", minute = "0"] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${PANEL_CLASS} {
      border: 0 !important;
      box-shadow: none !important;
      background: transparent !important;
      padding: 0 !important;
    }

    .${PANEL_CLASS} > .panel-heading,
    .${PANEL_CLASS} > .exercise-stack,
    .${PANEL_CLASS} > .action-row,
    .${PANEL_CLASS} > .web-training-status {
      display: none !important;
    }

    .mobile-training-app {
      width: min(100%, 430px);
      margin: 0 auto;
      padding: 4px 0 24px;
      color: #246e73;
    }

    .mobile-training-title {
      margin: 0 0 18px;
      text-align: center;
      color: var(--green, #5aab8a);
      font-size: 30px;
      line-height: 1.1;
      font-weight: 900;
    }

    .mobile-training-list {
      display: grid;
      gap: 12px;
    }

    .mobile-workout-card {
      border: 1px solid rgba(48, 111, 115, 0.12);
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 4px 10px rgba(31, 71, 60, 0.18);
      overflow: hidden;
      transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease, opacity 160ms ease;
    }

    .mobile-workout-card.is-active {
      border-color: #5a72e8;
      box-shadow: 0 0 0 1px #5a72e8, 0 8px 18px rgba(48, 71, 160, 0.18);
      background: #eef3ff;
    }

    .mobile-workout-card.is-locked {
      opacity: 0.82;
    }

    .mobile-workout-header,
    .mobile-exercise-header {
      width: 100%;
      min-height: 58px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: #5d878b;
      background: transparent;
      padding: 16px 18px;
      text-align: left;
      font-weight: 900;
    }

    .mobile-workout-header span:first-child {
      font-size: 16px;
    }

    .mobile-chevron {
      color: #246e73;
      font-size: 14px;
      line-height: 1;
    }

    .mobile-workout-body {
      display: grid;
      gap: 12px;
      padding: 0 12px 14px;
    }

    .mobile-exercise-card {
      border: 1px solid rgba(90, 171, 138, 0.72);
      border-radius: 14px;
      background: #eff9f4;
      overflow: hidden;
      transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }

    .mobile-exercise-card.status-started {
      border-color: #8ec7aa;
      background: #eff9f4;
    }

    .mobile-exercise-card.status-progress {
      border-color: #d9b35b;
      background: #fff9e8;
    }

    .mobile-exercise-card.status-done {
      border-color: #5aab8a;
      background: #edf8f2;
      box-shadow: inset 0 0 0 1px rgba(90, 171, 138, 0.18);
    }

    .mobile-exercise-card.status-pending {
      border-color: #d95f5f;
      background: #fff1f1;
    }

    .mobile-exercise-header {
      min-height: auto;
      align-items: flex-start;
      color: #246e73;
      padding: 12px 12px 6px;
    }

    .mobile-exercise-name {
      display: block;
      font-size: 16px;
      font-weight: 900;
    }

    .mobile-exercise-count {
      display: block;
      margin-top: 4px;
      color: #526c70;
      font-size: 12px;
      font-weight: 500;
    }

    .mobile-exercise-meta {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
      padding: 0 12px 12px;
      border-bottom: 1px solid rgba(36, 110, 115, 0.08);
    }

    .mobile-exercise-meta dt {
      margin: 0 0 4px;
      color: #2d3b3c;
      font-size: 11px;
      font-weight: 900;
    }

    .mobile-exercise-meta dd {
      margin: 0;
      color: #54676a;
      font-size: 12px;
      font-weight: 500;
    }

    .mobile-series-table {
      display: grid;
      gap: 8px;
      padding: 12px;
    }

    .mobile-series-head,
    .mobile-series-row {
      display: grid;
      grid-template-columns: 34px minmax(96px, 1fr) 62px 62px;
      align-items: center;
      gap: 8px;
    }

    .mobile-series-head {
      color: #2d3b3c;
      font-size: 12px;
      font-weight: 900;
    }

    .mobile-series-head span:last-child {
      grid-column: span 2;
      text-align: right;
    }

    .mobile-series-row {
      min-height: 44px;
      color: #244246;
      font-size: 14px;
    }

    .mobile-previous {
      color: #6b7c7f;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mobile-series-input {
      width: 100%;
      min-height: 42px;
      border: 1px solid #ccd8d3;
      border-radius: 10px;
      background: #ffffff;
      color: #2f3e3f;
      padding: 8px 6px;
      text-align: center;
      outline: none;
      font-size: 14px;
      font-weight: 800;
    }

    .mobile-series-input:disabled {
      background: #d8dedc;
      color: #5f6c6f;
    }

    .mobile-series-input.rep-low {
      border-color: #d94e5e;
      background: #fff0f2;
      color: #7a1725;
    }

    .mobile-series-input.rep-ok {
      border-color: #5b8fd9;
      background: #eff6ff;
      color: #214b7a;
    }

    .mobile-series-input.rep-high {
      border-color: #d59422;
      background: #fff7e6;
      color: #774b08;
    }

    .mobile-action-stack {
      display: grid;
      gap: 10px;
    }

    .mobile-action-stack button {
      width: 100%;
      min-height: 36px;
      border-radius: 8px;
      padding: 10px 14px;
      font-weight: 900;
    }

    .mobile-btn-start,
    .mobile-btn-save {
      color: #ffffff;
      background: var(--green, #5aab8a);
    }

    .mobile-btn-cancel {
      color: #ffffff;
      background: #9d9d9d;
    }

    .mobile-lock-note {
      margin: 0;
      color: #7a5b00;
      background: #fff8e1;
      border: 1px solid rgba(122, 91, 0, 0.16);
      border-radius: 8px;
      padding: 9px 10px;
      font-size: 12px;
      font-weight: 800;
    }

    .mobile-history-card {
      margin-top: 14px;
      border: 1px solid rgba(48, 111, 115, 0.12);
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 4px 10px rgba(31, 71, 60, 0.12);
      padding: 14px;
    }

    .mobile-history-card h3 {
      margin: 0 0 10px;
      color: #246e73;
      font-size: 16px;
    }

    .mobile-history-list {
      display: grid;
      gap: 8px;
      max-height: 260px;
      overflow: auto;
    }

    .mobile-history-item {
      display: grid;
      gap: 2px;
      border: 1px solid rgba(48, 111, 115, 0.1);
      border-radius: 8px;
      background: #fbfdfc;
      padding: 10px;
      color: #244246;
    }

    .mobile-history-item strong,
    .mobile-history-item small,
    .mobile-history-item span {
      display: block;
    }

    .mobile-history-item small,
    .mobile-empty {
      color: #6b7c7f;
      font-size: 12px;
    }

    .mobile-training-toast {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 9999;
      max-width: min(360px, calc(100vw - 44px));
      border-radius: 8px;
      padding: 12px 14px;
      background: #2f3e3f;
      color: white;
      box-shadow: var(--shadow, 0 16px 34px rgba(41, 71, 61, 0.12));
      font-weight: 800;
    }

    @media (min-width: 980px) {
      .mobile-training-app {
        width: min(100%, 780px);
      }
    }

    @media (max-width: 420px) {
      .mobile-training-app {
        width: 100%;
      }

      .mobile-series-head,
      .mobile-series-row {
        grid-template-columns: 32px minmax(84px, 1fr) 62px 62px;
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
    renderMobileTraining();
  });
}

function findTrainingPanel() {
  const panels = Array.from(document.querySelectorAll<HTMLElement>("section.screen > article.panel"));
  return (
    panels.find((panel) => {
      if (panel.querySelector(`#${ROOT_ID}`)) return true;
      const title = normalize(panel.querySelector(".section-title h3")?.textContent);
      return title === "treino" && Boolean(panel.querySelector(".exercise-stack"));
    }) ?? null
  );
}

function ensureRoot(panel: HTMLElement) {
  panel.classList.add(PANEL_CLASS);
  let root = panel.querySelector<HTMLElement>(`#${ROOT_ID}`);

  if (!root) {
    root = document.createElement("div");
    root.id = ROOT_ID;
    panel.appendChild(root);
    lastRenderedHtml = "";
  }

  return root;
}

function renderMobileTraining() {
  const panel = findTrainingPanel();
  if (!panel) return;

  const root = ensureRoot(panel);
  const html = renderTrainingHtml();

  if (html !== lastRenderedHtml) {
    root.innerHTML = html;
    lastRenderedHtml = html;
  }

  updateTimerDom();
}

function renderTrainingHtml() {
  const focusWorkout = workouts.find((workout) => workout.id === activeWorkoutId) ?? workouts[0] ?? null;
  const progress = focusWorkout ? getWorkoutProgress(focusWorkout) : { filled: 0, total: 0, percent: 0 };
  const workoutCards = workouts.length
    ? workouts.map((workout) => renderWorkoutCard(workout)).join("")
    : `<p class="mobile-empty">Nenhum treino recebido ainda.</p>`;

  return `
    <div class="mobile-training-app">
      <div class="neon-training-heading">
        <div>
          <span class="neon-kicker">CENTRAL DE TREINOS</span>
          <h1 class="mobile-training-title">${activeWorkoutId ? "Treino em andamento" : "Seus treinos"}</h1>
        </div>
        <span class="neon-heading-icon" aria-hidden="true">◆</span>
      </div>
      <section class="neon-training-hero neon-training-timer">
        <div class="neon-training-hero-icon" aria-hidden="true">◷</div>
        <div class="neon-training-hero-copy">
          <span>${activeWorkoutId ? "TEMPO DE TREINO" : "CRONÔMETRO DE TREINO"}</span>
          <strong class="neon-training-timer-value" data-workout-timer>00:00:00</strong>
          <small>${activeWorkoutId && focusWorkout
            ? escapeHtml(focusWorkout.nome)
            : "Inicie um treino abaixo para começar"}</small>
        </div>
        <span class="neon-training-state">${activeWorkoutId ? "EM ANDAMENTO" : "PRONTO"}</span>
        ${focusWorkout ? `
          <div class="neon-training-progress-copy">
            <span>${progress.filled} de ${progress.total} séries preenchidas</span>
            <strong>${progress.percent}%</strong>
          </div>
          <div class="neon-training-progress"><span style="width:${progress.percent}%"></span></div>
        ` : ""}
      </section>
      <div class="mobile-training-list">${workoutCards}</div>
      ${renderRecentHistory()}
    </div>
  `;
}

function getWorkoutProgress(workout: WorkoutPlan) {
  let total = 0;
  let filled = 0;

  workout.exercicios.forEach((exercise, exerciseIndex) => {
    for (let serieNumero = 1; serieNumero <= exercise.series; serieNumero += 1) {
      total += 1;
      const value = getDraftValue(workout.id, exerciseIndex, serieNumero);
      if (value.kg.trim() && value.reps.trim()) filled += 1;
    }
  });

  return { filled, total, percent: total ? Math.round((filled / total) * 100) : 0 };
}

function renderWorkoutCard(workout: WorkoutPlan) {
  const isOpen = expandedWorkoutIds.has(workout.id);
  const isActive = activeWorkoutId === workout.id;
  const isLocked = Boolean(activeWorkoutId && activeWorkoutId !== workout.id);
  const classes = ["mobile-workout-card", isOpen ? "is-open" : "", isActive ? "is-active" : "", isLocked ? "is-locked" : ""]
    .filter(Boolean)
    .join(" ");

  return `
    <article class="${classes}" data-workout-id="${escapeAttribute(workout.id)}">
      <button class="mobile-workout-header" type="button" data-action="toggle-workout" data-workout-id="${escapeAttribute(workout.id)}">
        <span>${escapeHtml(workout.nome)}</span>
        <span class="mobile-chevron">${isOpen ? "˄" : "˅"}</span>
      </button>
      ${isOpen ? renderWorkoutBody(workout, isActive, isLocked) : ""}
    </article>
  `;
}

function renderWorkoutBody(workout: WorkoutPlan, isActive: boolean, isLocked: boolean) {
  return `
    <div class="mobile-workout-body">
      ${workout.exercicios.map((exercise, index) => renderExerciseCard(workout, exercise, index, isActive)).join("")}
      ${renderWorkoutActions(workout, isActive, isLocked)}
    </div>
  `;
}

function renderWorkoutActions(workout: WorkoutPlan, isActive: boolean, isLocked: boolean) {
  if (isActive) {
    return `
      <div class="mobile-action-stack">
        <button class="mobile-btn-save" type="button" data-action="save-workout" data-workout-id="${escapeAttribute(workout.id)}" ${savingWorkoutId === workout.id ? "disabled" : ""}>
          ${savingWorkoutId === workout.id ? "Salvando..." : "Salvar treino"}
        </button>
        <button class="mobile-btn-cancel" type="button" data-action="cancel-workout" data-workout-id="${escapeAttribute(workout.id)}" ${savingWorkoutId === workout.id ? "disabled" : ""}>
          Cancelar treino
        </button>
      </div>
    `;
  }

  if (isLocked) {
    const activeName = workouts.find((item) => item.id === activeWorkoutId)?.nome ?? "o treino ativo";
    return `<p class="mobile-lock-note">Finalize ou cancele ${escapeHtml(activeName)} antes de iniciar outro treino.</p>`;
  }

  return `
    <div class="mobile-action-stack">
      <button class="mobile-btn-start" type="button" data-action="start-workout" data-workout-id="${escapeAttribute(workout.id)}">
        Iniciar treino
      </button>
    </div>
  `;
}

function renderExerciseCard(workout: WorkoutPlan, exercise: ExercisePlan, exerciseIndex: number, isWorkoutActive: boolean) {
  const exerciseKey = getExerciseKey(workout.id, exerciseIndex);
  const isOpen = expandedExercises.has(exerciseKey);
  const status = getExerciseStatus(workout, exercise, exerciseIndex, isWorkoutActive);

  return `
    <article class="mobile-exercise-card ${status}" data-exercise-card="${escapeAttribute(exerciseKey)}">
      <button class="mobile-exercise-header" type="button" data-action="toggle-exercise" data-workout-id="${escapeAttribute(workout.id)}" data-ex-index="${exerciseIndex}">
        <span>
          <span class="mobile-exercise-name">${escapeHtml(exercise.nome)}</span>
          <span class="mobile-exercise-count">Treinos realizados: ${countExerciseDone(exercise.nome)}</span>
        </span>
        <span class="mobile-chevron">${isOpen ? "˄" : "˅"}</span>
      </button>
      <dl class="mobile-exercise-meta">
        <div><dt>Método</dt><dd>${escapeHtml(emptyDash(exercise.tecnica))}</dd></div>
        <div><dt>Séries</dt><dd>${exercise.series}</dd></div>
        <div><dt>Rep</dt><dd>${exercise.repsMin}-${exercise.repsMax}</dd></div>
        <div><dt>RIR</dt><dd>${escapeHtml(emptyDash(exercise.rir))}</dd></div>
        <div><dt>Desc</dt><dd>${escapeHtml(emptyDash(exercise.descanso))}</dd></div>
      </dl>
      ${isOpen ? renderSeriesRows(workout, exercise, exerciseIndex, isWorkoutActive) : ""}
    </article>
  `;
}

function renderSeriesRows(workout: WorkoutPlan, exercise: ExercisePlan, exerciseIndex: number, isWorkoutActive: boolean) {
  const rows = Array.from({ length: exercise.series }, (_, serieIndex) => {
    const serieNumero = serieIndex + 1;
    const value = getDraftValue(workout.id, exerciseIndex, serieNumero);
    const previous = getPreviousSeries(workout.nome, exercise.nome, serieNumero);
    const repClass = getRepFeedbackClass(value.reps, exercise.repsMin, exercise.repsMax);

    return `
      <div class="mobile-series-row">
        <span>S${serieNumero}</span>
        <span class="mobile-previous">${escapeHtml(previous)}</span>
        <input
          class="mobile-series-input"
          inputmode="decimal"
          placeholder="KG"
          value="${escapeAttribute(value.kg)}"
          data-action="input-kg"
          data-workout-id="${escapeAttribute(workout.id)}"
          data-ex-index="${exerciseIndex}"
          data-serie="${serieNumero}"
          ${isWorkoutActive ? "" : "disabled"}
        />
        <input
          class="mobile-series-input ${repClass}"
          inputmode="numeric"
          placeholder="REP"
          value="${escapeAttribute(value.reps)}"
          data-action="input-reps"
          data-workout-id="${escapeAttribute(workout.id)}"
          data-ex-index="${exerciseIndex}"
          data-serie="${serieNumero}"
          ${isWorkoutActive ? "" : "disabled"}
        />
      </div>
    `;
  }).join("");

  return `
    <div class="mobile-series-table">
      <div class="mobile-series-head"><span>Série</span><span>Anterior</span><span>KG/REP</span></div>
      ${rows}
    </div>
  `;
}

function renderRecentHistory() {
  const latest = records.slice(0, 5);
  const items = latest.length
    ? latest.map((record) => `
        <div class="mobile-history-item">
          <strong>${escapeHtml(record.nomeTreino)}</strong>
          <small>${escapeHtml(record.dataHora)}${record.duracaoSegundos > 0 ? ` · ${formatDurationLabel(record.duracaoSegundos)}` : ""}</small>
          <span>${record.completo ? "Completo" : "Incompleto"}</span>
        </div>
      `).join("")
    : `<p class="mobile-empty">Nenhum treino salvo ainda.</p>`;

  return `
    <aside class="mobile-history-card">
      <h3>Histórico recente</h3>
      <div class="mobile-history-list">${items}</div>
    </aside>
  `;
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as Element | null;
  const actionElement = target?.closest(`#${ROOT_ID} [data-action]`) as HTMLElement | null;
  if (!actionElement) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const action = actionElement.getAttribute("data-action");
  const workoutId = actionElement.getAttribute("data-workout-id") ?? "";
  const workout = workouts.find((item) => item.id === workoutId);

  if (action === "toggle-workout") {
    if (expandedWorkoutIds.has(workoutId)) {
      expandedWorkoutIds.delete(workoutId);
    } else {
      expandedWorkoutIds.add(workoutId);
    }
    saveTrainingState();
    scheduleRender();
    return;
  }

  if (action === "toggle-exercise") {
    const exerciseIndex = Number(actionElement.getAttribute("data-ex-index") ?? -1);
    const key = getExerciseKey(workoutId, exerciseIndex);
    if (expandedExercises.has(key)) {
      expandedExercises.delete(key);
    } else {
      expandedExercises.add(key);
    }
    saveTrainingState();
    scheduleRender();
    return;
  }

  if (!workout) return;

  if (action === "start-workout") {
    startWorkout(workout);
    return;
  }

  if (action === "cancel-workout") {
    cancelWorkout(workout);
    return;
  }

  if (action === "save-workout") {
    void saveWorkout(workout);
  }
}

function handleDocumentInput(event: Event) {
  const input = event.target as HTMLInputElement | null;
  if (!input?.matches(`#${ROOT_ID} input[data-action]`)) return;

  const action = input.getAttribute("data-action");
  const workoutId = input.getAttribute("data-workout-id") ?? "";
  const exerciseIndex = Number(input.getAttribute("data-ex-index") ?? -1);
  const serieNumero = Number(input.getAttribute("data-serie") ?? 0);

  if (activeWorkoutId !== workoutId || exerciseIndex < 0 || serieNumero <= 0) return;

  const key = getDraftKey(workoutId, exerciseIndex, serieNumero);
  const current = draftValues[key] ?? { kg: "", reps: "" };

  if (action === "input-kg") {
    draftValues[key] = { ...current, kg: input.value };
  }

  if (action === "input-reps") {
    draftValues[key] = { ...current, reps: input.value };
    const exercise = workouts.find((item) => item.id === workoutId)?.exercicios[exerciseIndex];
    if (exercise) {
      input.classList.remove("rep-low", "rep-ok", "rep-high");
      const feedbackClass = getRepFeedbackClass(input.value, exercise.repsMin, exercise.repsMax);
      if (feedbackClass) input.classList.add(feedbackClass);
    }
  }

  pendingExercises.delete(getExerciseKey(workoutId, exerciseIndex));
  updateExerciseStatusClass(workoutId, exerciseIndex);
  saveTrainingState();
}

function startWorkout(workout: WorkoutPlan) {
  if (activeWorkoutId && activeWorkoutId !== workout.id) {
    const activeName = workouts.find((item) => item.id === activeWorkoutId)?.nome ?? "o treino ativo";
    showToast(`Finalize ou cancele ${activeName} antes de iniciar outro treino.`);
    return;
  }

  activeWorkoutId = workout.id;
  if (!workoutStartedAt) workoutStartedAt = Date.now();
  expandedWorkoutIds.add(workout.id);
  pendingExercises.clear();
  workout.exercicios.forEach((_, index) => expandedExercises.add(getExerciseKey(workout.id, index)));
  saveTrainingState();
  syncTimerTicker();
  scheduleRender();
  showToast(`Treino ${workout.nome} iniciado.`);
}

function cancelWorkout(workout: WorkoutPlan) {
  if (activeWorkoutId !== workout.id) {
    showToast("Nenhum treino ativo para cancelar.");
    return;
  }

  const shouldCancel = window.confirm("Cancelar este treino? Nada será salvo e os dados preenchidos serão descartados.");
  if (!shouldCancel) return;

  clearDraftForWorkout(workout.id);
  pendingExercises.clear();
  activeWorkoutId = null;
  workoutStartedAt = null;
  savingDurationSeconds = null;
  saveTrainingState();
  syncTimerTicker();
  scheduleRender();
  showToast("Treino cancelado sem salvar.");
}

async function saveWorkout(workout: WorkoutPlan) {
  const currentServices = getServices();
  if (!currentServices || !currentUid) {
    showToast("Não foi possível identificar o aluno logado.");
    return;
  }

  if (activeWorkoutId !== workout.id) {
    showToast("Inicie o treino antes de salvar.");
    return;
  }

  const complete = isWorkoutComplete(workout);
  if (!complete) {
    markPendingExercises(workout);
    scheduleRender();
    const shouldSave = window.confirm("Ainda faltam séries para preencher. Deseja salvar mesmo assim?");
    if (!shouldSave) return;
  }

  const warnings = buildWorkoutWarnings(workout);
  if (warnings) {
    window.alert(`Avisos do treino\n\n${warnings}`);
  }

  const createdAt = Date.now();
  savingDurationSeconds = Math.max(1, getElapsedSeconds(createdAt));
  savingWorkoutId = workout.id;
  scheduleRender();

  try {
    await setDoc(doc(currentServices.db, "users", currentUid, "treino_registros", createdAt.toString()), {
      idLocal: newId("web-"),
      dataHora: formatDateTime(new Date(createdAt)),
      nomeTreino: workout.nome,
      completo: complete,
      createdAt,
      duracaoSegundos: savingDurationSeconds,
      exercicios: buildExerciseRecords(workout)
    });

    clearDraftForWorkout(workout.id);
    pendingExercises.clear();
    activeWorkoutId = null;
    workoutStartedAt = null;
    savingWorkoutId = null;
    savingDurationSeconds = null;
    saveTrainingState();
    syncTimerTicker();
    scheduleRender();
    showToast(complete ? "Treino salvo completo!" : "Treino salvo incompleto!");
  } catch (error) {
    savingWorkoutId = null;
    savingDurationSeconds = null;
    scheduleRender();
    showToast((error as Error).message || "Erro ao salvar treino.");
  }
}

function buildExerciseRecords(workout: WorkoutPlan): ExerciseRecord[] {
  return workout.exercicios.map((exercise, exerciseIndex) => ({
    nomeExercicio: exercise.nome,
    series: Array.from({ length: exercise.series }, (_, serieIndex) => {
      const serieNumero = serieIndex + 1;
      const value = getDraftValue(workout.id, exerciseIndex, serieNumero);
      if (!value.kg.trim() || !value.reps.trim()) return null;

      return {
        serieNumero,
        kg: parseNumber(value.kg),
        reps: Math.round(parseNumber(value.reps))
      };
    }).filter((serie): serie is SeriesRecord => Boolean(serie))
  }));
}

function buildWorkoutWarnings(workout: WorkoutPlan) {
  const warnings: string[] = [];

  workout.exercicios.forEach((exercise, exerciseIndex) => {
    const filledSeries = Array.from({ length: exercise.series }, (_, serieIndex) => {
      const value = getDraftValue(workout.id, exerciseIndex, serieIndex + 1);
      const kg = value.kg.trim() ? parseNumber(value.kg, Number.NaN) : Number.NaN;
      const reps = value.reps.trim() ? Math.round(parseNumber(value.reps, Number.NaN)) : Number.NaN;
      return Number.isFinite(kg) && Number.isFinite(reps) ? { kg, reps } : null;
    }).filter((item): item is { kg: number; reps: number } => Boolean(item));

    if (!filledSeries.length) return;

    if (filledSeries.every((serie) => serie.reps > exercise.repsMax)) {
      warnings.push(`✅ ${exercise.nome}: todas as séries ficaram acima do máximo (${exercise.repsMax}). Próxima vez: pode aumentar o peso.`);
    }

    if (filledSeries.every((serie) => serie.reps < exercise.repsMin)) {
      warnings.push(`⚠️ ${exercise.nome}: todas as séries ficaram abaixo do mínimo (${exercise.repsMin}). Próxima vez: pode diminuir o peso.`);
    }

    const firstKg = filledSeries[0]?.kg ?? 0;
    if (filledSeries.length >= 2 && filledSeries.some((serie) => Math.abs(serie.kg - firstKg) >= 0.5)) {
      warnings.push(`⚠️ ${exercise.nome}: você mudou o peso entre as séries. Isso dificulta acompanhar a evolução.`);
    }
  });

  return warnings.join("\n\n");
}

function markPendingExercises(workout: WorkoutPlan) {
  pendingExercises.clear();
  workout.exercicios.forEach((exercise, index) => {
    if (!isExerciseComplete(workout.id, exercise, index)) {
      pendingExercises.add(getExerciseKey(workout.id, index));
      expandedExercises.add(getExerciseKey(workout.id, index));
    }
  });
}

function isWorkoutComplete(workout: WorkoutPlan) {
  return workout.exercicios.every((exercise, index) => isExerciseComplete(workout.id, exercise, index));
}

function isExerciseComplete(workoutId: string, exercise: ExercisePlan, exerciseIndex: number) {
  for (let serieNumero = 1; serieNumero <= exercise.series; serieNumero += 1) {
    const value = getDraftValue(workoutId, exerciseIndex, serieNumero);
    if (!value.kg.trim() || !value.reps.trim()) return false;
  }
  return true;
}

function exerciseHasAnyDraft(workoutId: string, exercise: ExercisePlan, exerciseIndex: number) {
  for (let serieNumero = 1; serieNumero <= exercise.series; serieNumero += 1) {
    const value = getDraftValue(workoutId, exerciseIndex, serieNumero);
    if (value.kg.trim() || value.reps.trim()) return true;
  }
  return false;
}

function getExerciseStatus(workout: WorkoutPlan, exercise: ExercisePlan, exerciseIndex: number, isWorkoutActive: boolean) {
  const key = getExerciseKey(workout.id, exerciseIndex);
  if (pendingExercises.has(key)) return "status-pending";
  if (isExerciseComplete(workout.id, exercise, exerciseIndex)) return "status-done";
  if (exerciseHasAnyDraft(workout.id, exercise, exerciseIndex)) return "status-progress";
  if (isWorkoutActive) return "status-started";
  return "status-neutral";
}

function updateExerciseStatusClass(workoutId: string, exerciseIndex: number) {
  const workout = workouts.find((item) => item.id === workoutId);
  const exercise = workout?.exercicios[exerciseIndex];
  if (!workout || !exercise) return;

  const element = document.querySelector<HTMLElement>(`[data-exercise-card="${cssEscape(getExerciseKey(workoutId, exerciseIndex))}"]`);
  if (!element) return;

  element.classList.remove("status-neutral", "status-started", "status-progress", "status-done", "status-pending");
  element.classList.add(getExerciseStatus(workout, exercise, exerciseIndex, activeWorkoutId === workoutId));
}

function getPreviousSeries(workoutName: string, exerciseName: string, serieNumero: number) {
  const record = records
    .filter((item) => sameName(item.nomeTreino, workoutName))
    .sort((a, b) => workoutRecordTime(b) - workoutRecordTime(a))[0];
  const exercise = record?.exercicios.find((item) => sameName(item.nomeExercicio, exerciseName));
  const serie = exercise?.series.find((item) => item.serieNumero === serieNumero);

  if (!serie) return "—";
  return `${formatKg(serie.kg)}kg x ${serie.reps}`;
}

function countExerciseDone(exerciseName: string) {
  return records.filter((record) => record.exercicios.some((exercise) => sameName(exercise.nomeExercicio, exerciseName) && exercise.series.length > 0)).length;
}

function getDraftValue(workoutId: string, exerciseIndex: number, serieNumero: number): DraftValue {
  return draftValues[getDraftKey(workoutId, exerciseIndex, serieNumero)] ?? { kg: "", reps: "" };
}

function getDraftKey(workoutId: string, exerciseIndex: number, serieNumero: number) {
  return `${workoutId}::${exerciseIndex}::${serieNumero}`;
}

function getExerciseKey(workoutId: string, exerciseIndex: number) {
  return `${workoutId}::${exerciseIndex}`;
}

function clearDraftForWorkout(workoutId: string) {
  const prefix = `${workoutId}::`;
  Object.keys(draftValues).forEach((key) => {
    if (key.startsWith(prefix)) delete draftValues[key];
  });
}

function getRepFeedbackClass(value: string, repsMin: number, repsMax: number) {
  const reps = value.trim() ? Math.round(parseNumber(value, Number.NaN)) : Number.NaN;
  if (!Number.isFinite(reps)) return "";
  if (reps < repsMin) return "rep-low";
  if (reps > repsMax) return "rep-high";
  return "rep-ok";
}

function saveTrainingState() {
  if (!currentUid) return;

  const state: SavedTrainingState = {
    activeWorkoutId,
    workoutStartedAt,
    expandedWorkoutIds: Array.from(expandedWorkoutIds),
    expandedExercises: Array.from(expandedExercises),
    draft: draftValues
  };

  localStorage.setItem(`${STORAGE_PREFIX}.${currentUid}`, JSON.stringify(state));
}

function loadTrainingState(uid: string) {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}.${uid}`);
  if (!raw) {
    activeWorkoutId = null;
    workoutStartedAt = null;
    expandedWorkoutIds = new Set();
    expandedExercises = new Set();
    draftValues = {};
    pendingExercises = new Set();
    return;
  }

  try {
    const parsed = JSON.parse(raw) as SavedTrainingState;
    activeWorkoutId = parsed.activeWorkoutId ?? null;
    const parsedStartedAt = Number(parsed.workoutStartedAt ?? 0);
    workoutStartedAt = activeWorkoutId && Number.isFinite(parsedStartedAt) && parsedStartedAt > 0
      ? parsedStartedAt
      : activeWorkoutId
        ? Date.now()
        : null;
    expandedWorkoutIds = new Set(parsed.expandedWorkoutIds ?? (parsed.expandedWorkoutId ? [parsed.expandedWorkoutId] : []));
    expandedExercises = new Set(parsed.expandedExercises ?? []);
    draftValues = parsed.draft ?? {};
    pendingExercises = new Set();
  } catch {
    activeWorkoutId = null;
    workoutStartedAt = null;
    expandedWorkoutIds = new Set();
    expandedExercises = new Set();
    draftValues = {};
    pendingExercises = new Set();
  }
}

function normalize(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function sameName(a: string, b: string) {
  return normalize(a) === normalize(b);
}

function emptyDash(value: string) {
  return value.trim() || "—";
}

function formatKg(value: number) {
  return Number.isInteger(value) ? value.toFixed(1) : value.toString();
}

function getElapsedSeconds(now = Date.now()) {
  if (!workoutStartedAt) return 0;
  return Math.max(0, Math.floor((now - workoutStartedAt) / 1000));
}

function formatTimer(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, "0")).join(":");
}

function formatDurationLabel(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}min ${seconds}s`;
  if (minutes > 0) return `${minutes}min ${seconds}s`;
  return `${seconds}s`;
}

function updateTimerDom() {
  const elapsed = savingDurationSeconds ?? (activeWorkoutId ? getElapsedSeconds() : 0);
  document.querySelectorAll<HTMLElement>("[data-workout-timer]").forEach((element) => {
    element.textContent = formatTimer(elapsed);
  });
}

function syncTimerTicker() {
  const shouldRun = Boolean(activeWorkoutId && workoutStartedAt);
  if (shouldRun && timerIntervalId === null) {
    timerIntervalId = window.setInterval(updateTimerDom, 1000);
  } else if (!shouldRun && timerIntervalId !== null) {
    window.clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
  updateTimerDom();
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

function cssEscape(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function showToast(message: string) {
  document.querySelector(".mobile-training-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "mobile-training-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

function isMutationInsideTrainingRoot(mutation: MutationRecord) {
  const target = mutation.target;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(`#${ROOT_ID}`));
}

function bootMobileTraining() {
  injectStyles();
  attachAuthListener();
  syncTimerTicker();

  if (!documentListenersAttached) {
    documentListenersAttached = true;
    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("input", handleDocumentInput, true);
  }

  if (!observerStarted && document.body) {
    observerStarted = true;
    new MutationObserver((mutations) => {
      if (mutations.length > 0 && mutations.every(isMutationInsideTrainingRoot)) return;
      scheduleRender();
    }).observe(document.body, { childList: true, subtree: true });
  }

  scheduleRender();
}

bootMobileTraining();

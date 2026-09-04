import { collection, doc, onSnapshot, type DocumentData } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { initFirebase, readInitialConfig, type FirebaseServices } from "./firebase";
import type { ExerciseRecord, SeriesRecord, TrainerStudent, WorkoutRecord } from "./types";

const STYLE_ID = "meutreino-desktop-performance-style";
const ROOT_ID = "meutreino-desktop-performance-root";
const SCREEN_CLASS = "performance-app-native";
const SELECTED_STUDENT_KEY = "meutreino.selectedStudent";
const CACHE_PREFIX = "meutreino.performance.records";

type Role = "ALUNO" | "TREINADOR" | "ADMIN";
type Metric = "load" | "reps" | "volume";

type ProfileState = {
  uid: string;
  name: string;
  role: Role;
};

type TargetState = {
  uid: string;
  name: string;
};

type PerformancePoint = {
  id: string;
  label: string;
  workoutName: string;
  load: number;
  reps: number;
  volume: number;
};

let services: FirebaseServices | null = null;
let authUser: User | null = null;
let profile: ProfileState | null = null;
let target: TargetState | null = null;
let records: WorkoutRecord[] = [];
let selectedWorkout = "";
let selectedExercise = "";
let selectedMetric: Metric = "load";
let detailRecordId: string | null = null;
let historyDialogOpen = false;
let historyDayKey: string | null = null;
let annualCalendarOpen = false;
let chartTooltipPointId: string | null = null;
let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
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
    resetDashboardState();

    if (user) startProfileListener(user);
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
      profile = { uid: user.uid, name: user.email ?? "Aluno", role: "ALUNO" };
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
    resetDashboardState();
    return;
  }

  if (recordsTargetUid === nextUid && recordsUnsubscribe) return;

  stopRecordsListener();
  recordsTargetUid = nextUid;
  records = loadCachedRecords(nextUid);
  resetDashboardState();
  reconcileSelections();
  loadingRecords = true;
  recordsError = "";

  const currentServices = getServices();
  if (!currentServices) return;

  recordsUnsubscribe = onSnapshot(
    collection(currentServices.db, "users", nextUid, "treino_registros"),
    (snap) => {
      loadingRecords = false;
      recordsError = "";
      records = snap.docs
        .map((item) => workoutRecordFromDoc(item.id, item.data()))
        .sort((a, b) => recordSortValue(b) - recordSortValue(a));
      saveCachedRecords(nextUid, records);
      reconcileSelections();
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
  if (profile.role === "ALUNO") return { uid: profile.uid, name: profile.name };

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
  const rawCreatedAt = data.createdAt;
  const createdAt = typeof rawCreatedAt === "number"
    ? rawCreatedAt
    : typeof rawCreatedAt?.toMillis === "function"
      ? rawCreatedAt.toMillis()
      : Number(rawCreatedAt ?? 0);

  return {
    id,
    idLocal: String(data.idLocal ?? id),
    dataHora: String(data.dataHora ?? "-"),
    nomeTreino: String(data.nomeTreino ?? "Treino"),
    completo: Boolean(data.completo ?? false),
    createdAt: Number.isFinite(createdAt) ? createdAt : 0,
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

function loadCachedRecords(uid: string) {
  const raw = localStorage.getItem(`${CACHE_PREFIX}.${uid}`);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as WorkoutRecord[];
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => recordSortValue(b) - recordSortValue(a))
      : [];
  } catch {
    return [];
  }
}

function saveCachedRecords(uid: string, list: WorkoutRecord[]) {
  localStorage.setItem(`${CACHE_PREFIX}.${uid}`, JSON.stringify(list));
}

function resetDashboardState() {
  selectedWorkout = "";
  selectedExercise = "";
  selectedMetric = "load";
  detailRecordId = null;
  historyDialogOpen = false;
  historyDayKey = null;
  annualCalendarOpen = false;
  chartTooltipPointId = null;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .screen.${SCREEN_CLASS} {
      display: block;
      padding: 0;
      background: transparent;
    }

    .screen.${SCREEN_CLASS} > .summary-row,
    .screen.${SCREEN_CLASS} > .panel {
      display: none !important;
    }

    .performance-dashboard {
      width: min(100%, 1280px);
      margin: 0 auto;
      color: #f3f8f6;
    }

    .performance-dashboard button,
    .performance-dashboard select {
      font: inherit;
    }

    .performance-dashboard-head {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 24px;
      margin: 0 0 22px;
    }

    .performance-eyebrow {
      display: block;
      margin-bottom: 5px;
      color: #4ef0ae;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.13em;
      text-transform: uppercase;
    }

    .performance-dashboard-title {
      margin: 0;
      color: #f3f8f6;
      font-size: clamp(30px, 4vw, 48px);
      line-height: 1;
      letter-spacing: -0.045em;
    }

    .performance-dashboard-subtitle {
      margin: 7px 0 0;
      color: #9eb2ad;
      font-size: 15px;
    }

    .performance-filter-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(210px, 300px));
      gap: 12px;
    }

    .performance-filter {
      position: relative;
      display: grid;
      gap: 5px;
      min-width: 0;
    }

    .performance-filter span {
      padding-left: 4px;
      color: #8fa59f;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .performance-filter select {
      width: 100%;
      min-height: 52px;
      appearance: none;
      border: 1px solid rgba(78, 240, 174, 0.42);
      border-radius: 999px;
      outline: none;
      padding: 0 42px 0 18px;
      color: #f3f8f6;
      background: linear-gradient(145deg, rgba(20, 43, 44, 0.96), rgba(7, 22, 24, 0.98));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
      cursor: pointer;
    }

    .performance-filter::after {
      content: "⌄";
      position: absolute;
      right: 18px;
      bottom: 14px;
      color: #4ef0ae;
      pointer-events: none;
    }

    .performance-filter select:focus-visible,
    .performance-dashboard button:focus-visible {
      outline: 3px solid rgba(78, 240, 174, 0.34);
      outline-offset: 2px;
    }

    .performance-panel,
    .performance-calendar-card {
      border: 1px solid rgba(78, 240, 174, 0.32);
      border-radius: 24px;
      background:
        radial-gradient(circle at 10% 0%, rgba(27, 119, 88, 0.19), transparent 34%),
        linear-gradient(145deg, rgba(15, 37, 39, 0.97), rgba(5, 19, 21, 0.99));
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.03);
    }

    .performance-analysis {
      margin-top: 22px;
      padding: 22px;
    }

    .performance-analysis-head {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 16px;
    }

    .performance-section-kicker {
      display: block;
      color: #8fa59f;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    .performance-exercise-title {
      margin: 5px 0 0;
      color: #f3f8f6;
      font-size: clamp(21px, 2.4vw, 30px);
      line-height: 1.15;
    }

    .performance-metric-tabs {
      display: flex;
      gap: 6px;
      padding: 4px;
      border: 1px solid rgba(78, 240, 174, 0.2);
      border-radius: 999px;
      background: rgba(2, 15, 17, 0.64);
    }

    .performance-metric-tab {
      min-height: 38px;
      border: 0;
      border-radius: 999px;
      padding: 0 18px;
      color: #9eb2ad;
      background: transparent;
      cursor: pointer;
    }

    .performance-metric-tab.is-active {
      color: #04100d;
      background: linear-gradient(110deg, #38dfa0, #68f5bd);
      box-shadow: 0 8px 24px rgba(78, 240, 174, 0.22);
      font-weight: 900;
    }

    .performance-analysis-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(210px, 270px);
      gap: 18px;
      align-items: stretch;
    }

    .performance-chart-stage {
      position: relative;
      min-width: 0;
      min-height: 300px;
      border-radius: 20px;
      padding: 10px 8px 2px;
      background: rgba(1, 14, 16, 0.46);
      overflow: hidden;
    }

    .performance-line-chart {
      display: block;
      width: 100%;
      height: 300px;
      overflow: visible;
      background: transparent !important;
    }

    .performance-chart-dot-hit {
      cursor: pointer;
      fill: transparent;
      stroke: transparent;
    }

    .performance-chart-dot {
      fill: #4ef0ae;
      stroke: #d7ffef;
      stroke-width: 2;
      filter: drop-shadow(0 0 6px rgba(78, 240, 174, 0.9));
      pointer-events: none;
    }

    .performance-chart-tooltip {
      position: absolute;
      z-index: 4;
      width: max-content;
      max-width: min(220px, 72%);
      transform: translate(-50%, calc(-100% - 14px));
      border: 1px solid rgba(78, 240, 174, 0.52);
      border-radius: 14px;
      padding: 10px 12px;
      color: #f3f8f6;
      background: rgba(5, 23, 25, 0.97);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.42), 0 0 18px rgba(78, 240, 174, 0.12);
      pointer-events: none;
      font-size: 12px;
      line-height: 1.45;
    }

    .performance-chart-tooltip strong,
    .performance-chart-tooltip span {
      display: block;
    }

    .performance-chart-tooltip strong {
      margin-bottom: 3px;
      color: #4ef0ae;
    }

    .performance-chart-tooltip.is-start { transform: translate(0, calc(-100% - 14px)); }
    .performance-chart-tooltip.is-end { transform: translate(-100%, calc(-100% - 14px)); }

    .performance-chart-empty {
      display: grid;
      place-items: center;
      min-height: 300px;
      color: #9eb2ad;
      text-align: center;
    }

    .performance-evolution {
      display: grid;
      place-content: center;
      min-height: 300px;
      border: 1px solid rgba(78, 240, 174, 0.3);
      border-radius: 20px;
      padding: 22px;
      text-align: center;
      background: linear-gradient(160deg, rgba(20, 54, 52, 0.72), rgba(4, 19, 21, 0.86));
    }

    .performance-evolution-label {
      color: #a8b9b5;
      font-size: 13px;
    }

    .performance-evolution-value {
      display: block;
      margin: 10px 0 5px;
      color: #4ef0ae;
      font-size: clamp(38px, 5vw, 64px);
      font-weight: 900;
      letter-spacing: -0.06em;
      text-shadow: 0 0 22px rgba(78, 240, 174, 0.36);
    }

    .performance-evolution-value.is-down { color: #ff9baa; text-shadow: none; }
    .performance-evolution-value.is-neutral { color: #d8e4e1; text-shadow: none; }
    .performance-evolution-note { color: #829792; font-size: 12px; }

    .performance-section {
      margin-top: 24px;
    }

    .performance-section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 10px;
    }

    .performance-section-head h2 {
      margin: 0;
      color: #f3f8f6;
      font-size: 22px;
    }

    .performance-link-button,
    .performance-icon-button {
      min-height: 44px;
      border: 0;
      color: #4ef0ae;
      background: transparent;
      cursor: pointer;
      font-weight: 800;
    }

    .performance-link-button { padding: 0 8px; }
    .performance-icon-button {
      min-width: 44px;
      border: 1px solid rgba(78, 240, 174, 0.28);
      border-radius: 50%;
      font-size: 22px;
    }

    .performance-recent-list {
      display: grid;
      gap: 10px;
    }

    .performance-workout-card {
      width: 100%;
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr) auto 44px;
      gap: 14px;
      align-items: center;
      min-height: 94px;
      border: 1px solid rgba(78, 240, 174, 0.26);
      border-radius: 20px;
      padding: 12px 14px;
      color: #f3f8f6;
      text-align: left;
      background:
        radial-gradient(circle at 8% 50%, rgba(78, 240, 174, 0.12), transparent 24%),
        linear-gradient(145deg, rgba(13, 34, 36, 0.96), rgba(5, 20, 22, 0.98));
      cursor: pointer;
    }

    .performance-workout-icon {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      border: 1px solid rgba(78, 240, 174, 0.42);
      border-radius: 50%;
      color: #4ef0ae;
      background: rgba(78, 240, 174, 0.08);
      font-size: 22px;
    }

    .performance-workout-main { min-width: 0; }
    .performance-workout-title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .performance-workout-title {
      overflow: hidden;
      color: #f3f8f6;
      font-size: 18px;
      font-weight: 900;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .performance-status {
      border: 1px solid rgba(78, 240, 174, 0.26);
      border-radius: 999px;
      padding: 3px 8px;
      color: #4ef0ae;
      background: rgba(78, 240, 174, 0.08);
      font-size: 10px;
      font-weight: 900;
    }

    .performance-status.incomplete {
      border-color: rgba(232, 197, 100, 0.35);
      color: #e8c564;
      background: rgba(232, 197, 100, 0.08);
    }

    .performance-workout-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      margin-top: 7px;
      color: #9eb2ad;
      font-size: 12px;
    }

    .performance-progress-ring {
      display: grid;
      place-items: center;
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: conic-gradient(#4ef0ae var(--progress), rgba(255,255,255,.08) 0);
      box-shadow: 0 0 16px rgba(78, 240, 174, 0.15);
    }

    .performance-progress-ring::before {
      content: "";
      grid-area: 1 / 1;
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: #092023;
    }

    .performance-progress-ring span {
      z-index: 1;
      grid-area: 1 / 1;
      font-size: 11px;
      font-weight: 900;
    }

    .performance-card-arrow {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border: 1px solid rgba(78, 240, 174, 0.26);
      border-radius: 50%;
      color: #f3f8f6;
      font-size: 24px;
    }

    .performance-calendar-card { padding: 18px; }

    .performance-calendar-toolbar {
      display: grid;
      grid-template-columns: 44px 1fr 44px;
      align-items: center;
      margin-bottom: 10px;
      text-align: center;
    }

    .performance-calendar-toolbar strong {
      color: #f3f8f6;
      font-size: 18px;
      text-transform: capitalize;
    }

    .performance-calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, minmax(32px, 1fr));
      gap: 5px;
    }

    .performance-calendar-weekday {
      padding: 6px 0;
      color: #829792;
      text-align: center;
      font-size: 10px;
      font-weight: 900;
    }

    .performance-calendar-day {
      position: relative;
      display: grid;
      place-items: center;
      min-width: 36px;
      min-height: 40px;
      border: 0;
      border-radius: 50%;
      color: #dce7e4;
      background: transparent;
    }

    button.performance-calendar-day { cursor: pointer; }
    .performance-calendar-day.is-outside { color: #526663; }
    .performance-calendar-day.is-today { color: #4ef0ae; font-weight: 900; }
    .performance-calendar-day.is-trained {
      border: 1px solid #4ef0ae;
      color: #f5fffb;
      background: radial-gradient(circle, rgba(78,240,174,.2), rgba(78,240,174,.04));
      box-shadow: 0 0 12px rgba(78, 240, 174, 0.18);
      font-weight: 900;
    }

    .performance-calendar-legend {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 12px 4px 0;
      color: #9eb2ad;
      font-size: 12px;
    }

    .performance-calendar-legend i {
      width: 11px;
      height: 11px;
      border-radius: 50%;
      background: #4ef0ae;
      box-shadow: 0 0 10px rgba(78, 240, 174, 0.65);
    }

    .performance-empty {
      border: 1px solid rgba(78, 240, 174, 0.24);
      border-radius: 20px;
      padding: 24px;
      color: #9eb2ad;
      text-align: center;
      background: rgba(10, 29, 31, 0.72);
    }

    .performance-error { border-color: rgba(255, 125, 143, 0.5); color: #ffb0bb; }

    .performance-dialog-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9998;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(0, 7, 8, 0.8) !important;
      backdrop-filter: blur(10px);
    }

    .performance-dialog {
      width: min(100%, 720px);
      max-height: min(820px, calc(100vh - 32px));
      overflow: auto;
      border: 1px solid rgba(78, 240, 174, 0.34) !important;
      border-radius: 24px !important;
      padding: 20px;
      color: #f3f8f6 !important;
      background: linear-gradient(145deg, #10292b, #071719) !important;
      box-shadow: 0 30px 80px rgba(0,0,0,.55) !important;
    }

    .performance-dialog.is-wide { width: min(100%, 980px); }
    .performance-dialog h2 { margin: 0; color: #f3f8f6 !important; font-size: 22px; }
    .performance-dialog p { color: #9eb2ad !important; }

    .performance-dialog-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
    }

    .performance-dialog-close {
      min-width: 44px;
      min-height: 44px;
      border: 1px solid rgba(78, 240, 174, 0.3);
      border-radius: 50%;
      color: #f3f8f6;
      background: rgba(255,255,255,.04);
      cursor: pointer;
      font-size: 20px;
    }

    .performance-detail-list { display: grid; gap: 10px; margin-top: 16px; }
    .performance-detail-exercise {
      border: 1px solid rgba(78, 240, 174, 0.22) !important;
      border-radius: 16px !important;
      padding: 12px;
      background: rgba(4, 20, 22, 0.62) !important;
    }
    .performance-detail-exercise strong { display: block; margin-bottom: 6px; color: #f3f8f6 !important; }
    .performance-detail-exercise span { display: block; margin-top: 3px; color: #9eb2ad !important; font-size: 13px; }

    .performance-history-dialog-list { display: grid; gap: 10px; }

    .performance-year-toolbar {
      display: grid;
      grid-template-columns: 44px 1fr 44px;
      align-items: center;
      margin-bottom: 16px;
      text-align: center;
    }

    .performance-year-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .performance-mini-month {
      border: 1px solid rgba(78, 240, 174, 0.18);
      border-radius: 16px;
      padding: 10px;
      color: #f3f8f6;
      background: rgba(3, 17, 19, 0.56);
      cursor: pointer;
    }

    .performance-mini-month strong { display: block; margin-bottom: 8px; text-align: center; text-transform: capitalize; }
    .performance-mini-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .performance-mini-day { display: grid; place-items: center; aspect-ratio: 1; color: #647975; font-size: 8px; }
    .performance-mini-day.is-trained { border-radius: 50%; color: #04100d; background: #4ef0ae; font-weight: 900; }
    .performance-mini-day.is-empty { visibility: hidden; }

    .performance-toast {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 9999;
      max-width: min(360px, calc(100vw - 44px));
      border: 1px solid rgba(78, 240, 174, 0.35);
      border-radius: 14px;
      padding: 12px 14px;
      color: #f3f8f6;
      background: #0d2929;
      box-shadow: 0 16px 34px rgba(0,0,0,.38);
      font-weight: 800;
    }

    @media (max-width: 900px) {
      .performance-dashboard-head { align-items: stretch; flex-direction: column; }
      .performance-filter-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .performance-analysis-grid { grid-template-columns: minmax(0, 1fr) 200px; }
      .performance-year-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 700px) {
      .performance-dashboard-head { margin-bottom: 16px; }
      .performance-filter-row { grid-template-columns: 1fr; }
      .performance-analysis { margin-top: 16px; padding: 14px; }
      .performance-analysis-head { align-items: stretch; flex-direction: column; }
      .performance-metric-tabs { display: grid; grid-template-columns: repeat(3, 1fr); }
      .performance-metric-tab { padding: 0 8px; font-size: 12px; }
      .performance-analysis-grid { grid-template-columns: 1fr; }
      .performance-chart-stage, .performance-chart-empty { min-height: 260px; }
      .performance-line-chart { height: 260px; }
      .performance-evolution { min-height: 150px; }
      .performance-workout-card { grid-template-columns: 48px minmax(0,1fr) 38px; gap: 10px; padding: 11px; }
      .performance-workout-icon { width: 48px; height: 48px; }
      .performance-progress-ring { display: none; }
      .performance-card-arrow { width: 36px; height: 36px; }
      .performance-workout-title { font-size: 16px; }
      .performance-calendar-card { padding: 12px 8px; }
      .performance-calendar-grid { gap: 2px; }
      .performance-calendar-day { min-width: 0; min-height: 38px; font-size: 12px; }
      .performance-year-grid { grid-template-columns: 1fr; }
      .performance-dialog { padding: 14px; }
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
  return screens.find((screen) => {
    if (screen.querySelector(`#${ROOT_ID}`)) return true;
    const title = normalize(screen.querySelector(".chart-panel .section-title h3")?.textContent);
    return title === "desempenho";
  }) ?? null;
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

  reconcileSelections();
  const root = ensureRoot(screen);
  const html = renderPerformanceHtml();
  if (html !== lastRenderedHtml) {
    root.innerHTML = html;
    lastRenderedHtml = html;
  }
}

function renderPerformanceHtml() {
  const workoutNames = getWorkoutNames();
  const exerciseNames = getExerciseNamesForWorkout(selectedWorkout);
  const personLabel = target?.name || (profile?.role === "ALUNO" ? profile.name : "Aluno");

  return `
    <main class="performance-dashboard">
      <header class="performance-dashboard-head">
        <div>
          <span class="performance-eyebrow">${escapeHtml(personLabel)}</span>
          <h1 class="performance-dashboard-title">Desempenho</h1>
          <p class="performance-dashboard-subtitle">Acompanhe a evolução dos exercícios e seus treinos realizados.</p>
        </div>
        <div class="performance-filter-row" aria-label="Filtros do desempenho">
          ${renderSelect("Treino", "select-workout", selectedWorkout, workoutNames, "Selecione o treino")}
          ${renderSelect("Exercício", "select-exercise", selectedExercise, exerciseNames, "Selecione o exercício")}
        </div>
      </header>
      ${renderDashboardBody()}
      ${renderHistoryDialog()}
      ${renderAnnualCalendarDialog()}
      ${renderDetailDialog()}
    </main>
  `;
}

function renderSelect(label: string, action: string, value: string, options: string[], placeholder: string) {
  return `
    <label class="performance-filter">
      <span>${escapeHtml(label)}</span>
      <select data-action="${action}" aria-label="${escapeAttribute(label)}" ${options.length ? "" : "disabled"}>
        ${options.length ? "" : `<option value="">${escapeHtml(placeholder)}</option>`}
        ${options.map((option) => `<option value="${escapeAttribute(option)}" ${sameName(option, value) ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderDashboardBody() {
  if (!authUser || !profile) return `<div class="performance-empty">Carregando usuário...</div>`;
  if (!target) return `<div class="performance-empty">Selecione um aluno no Perfil para visualizar o desempenho.</div>`;
  if (recordsError && records.length === 0) return `<div class="performance-empty performance-error">Sem acesso aos registros: ${escapeHtml(recordsError)}</div>`;
  if (loadingRecords && records.length === 0) return `<div class="performance-empty">Carregando registros...</div>`;
  if (records.length === 0) return `<div class="performance-empty">Nenhum treino registrado ainda.</div>`;

  return `
    ${renderAnalysisPanel()}
    ${renderRecentSection()}
    ${renderCalendarSection()}
  `;
}

function renderAnalysisPanel() {
  const points = buildPerformancePoints(selectedWorkout, selectedExercise);
  return `
    <section class="performance-panel performance-analysis" aria-labelledby="performance-analysis-title">
      <header class="performance-analysis-head">
        <div>
          <span class="performance-section-kicker">Evolução do exercício</span>
          <h2 class="performance-exercise-title" id="performance-analysis-title">${escapeHtml(selectedExercise || "Exercício")}</h2>
        </div>
        <div class="performance-metric-tabs" role="tablist" aria-label="Métrica do gráfico">
          ${renderMetricTab("load", "Carga")}
          ${renderMetricTab("reps", "Repetições")}
          ${renderMetricTab("volume", "Volume")}
        </div>
      </header>
      <div class="performance-analysis-grid">
        ${renderLineChart(points)}
        ${renderEvolutionCard(points)}
      </div>
    </section>
  `;
}

function renderMetricTab(metric: Metric, label: string) {
  const active = selectedMetric === metric;
  return `<button class="performance-metric-tab ${active ? "is-active" : ""}" type="button" role="tab" aria-selected="${active}" data-action="select-metric" data-metric="${metric}">${label}</button>`;
}

function renderLineChart(points: PerformancePoint[]) {
  if (!points.length) {
    return `<div class="performance-chart-empty">Ainda não há registros de ${escapeHtml(selectedExercise || "este exercício")} neste treino.</div>`;
  }

  const width = 760;
  const height = 300;
  const left = 64;
  const right = 24;
  const top = 30;
  const bottom = 54;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const values = points.map(metricValue);
  const maximum = Math.max(...values, 1);
  const minimum = Math.min(...values, 0);
  const padding = Math.max((maximum - minimum) * 0.16, selectedMetric === "reps" ? 1 : 0.5);
  const yMin = Math.max(0, minimum - padding);
  const yMax = maximum + padding;
  const range = Math.max(yMax - yMin, 1);
  const divisor = Math.max(points.length - 1, 1);
  const coords = points.map((point, index) => ({
    ...point,
    value: metricValue(point),
    x: left + (plotWidth * index) / divisor,
    y: top + plotHeight - (plotHeight * (metricValue(point) - yMin)) / range
  }));
  const line = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${left},${top + plotHeight} ${line} ${left + plotWidth},${top + plotHeight}`;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = top + plotHeight * ratio;
    const value = yMax - range * ratio;
    return `
      <line x1="${left}" y1="${y.toFixed(1)}" x2="${left + plotWidth}" y2="${y.toFixed(1)}" stroke="#234043" stroke-width="1" stroke-dasharray="3 7" />
      <text x="${left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#8fa59f">${escapeHtml(formatMetricAxis(value))}</text>
    `;
  }).join("");
  const labelEvery = Math.max(1, Math.ceil(coords.length / 6));
  const xLabels = coords.map((point, index) => {
    if (index % labelEvery !== 0 && index !== coords.length - 1) return "";
    return `<text x="${point.x.toFixed(1)}" y="${height - 20}" text-anchor="middle" font-size="10" fill="#8fa59f">${escapeHtml(point.label.slice(0, 8))}</text>`;
  }).join("");
  const dots = coords.map((point) => {
    const title = `${point.label} · Carga: ${formatNumber(point.load)} kg · Repetições: ${formatNumber(point.reps)} · Volume: ${formatNumber(point.volume)} kg·rep`;
    return `
      <circle class="performance-chart-dot-hit" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="16" tabindex="0" role="button" aria-label="${escapeAttribute(title)}" data-action="chart-point" data-point-id="${escapeAttribute(point.id)}"><title>${escapeHtml(title)}</title></circle>
      <circle class="performance-chart-dot" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="5" />
    `;
  }).join("");
  const selectedPointIndex = coords.findIndex((point) => point.id === chartTooltipPointId);
  const selectedPoint = selectedPointIndex >= 0 ? coords[selectedPointIndex] : null;
  const tooltipEdgeClass = selectedPointIndex === 0 ? "is-start" : selectedPointIndex === coords.length - 1 ? "is-end" : "";
  const tooltip = selectedPoint ? `
    <div class="performance-chart-tooltip ${tooltipEdgeClass}" style="left:${((selectedPoint.x / width) * 100).toFixed(2)}%;top:${((selectedPoint.y / height) * 100).toFixed(2)}%">
      <strong>${escapeHtml(selectedPoint.label)} · ${escapeHtml(selectedPoint.workoutName)}</strong>
      <span>Carga: ${formatNumber(selectedPoint.load)} kg</span>
      <span>Repetições: ${formatNumber(selectedPoint.reps)}</span>
      <span>Volume: ${formatNumber(selectedPoint.volume)} kg·rep</span>
    </div>
  ` : "";

  return `
    <div class="performance-chart-stage">
      <svg class="performance-line-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Evolução de ${escapeAttribute(metricLabel(selectedMetric).toLowerCase())}">
        ${grid}
        <polygon points="${area}" fill="#4ef0ae" opacity="0.11" />
        <polyline points="${line}" fill="none" stroke="#4ef0ae" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        ${dots}
        ${xLabels}
      </svg>
      ${tooltip}
    </div>
  `;
}

function renderEvolutionCard(points: PerformancePoint[]) {
  if (!points.length) {
    return `<aside class="performance-evolution"><span class="performance-evolution-label">Última evolução</span><strong class="performance-evolution-value is-neutral">—</strong><span class="performance-evolution-note">Sem registros para comparar</span></aside>`;
  }

  const current = metricValue(points[points.length - 1]);
  const previous = points.length > 1 ? metricValue(points[points.length - 2]) : null;
  const difference = previous === null ? null : current - previous;
  const className = difference === null || difference === 0 ? "is-neutral" : difference < 0 ? "is-down" : "";
  const value = difference === null ? formatMetricValue(current) : formatSignedMetric(difference);
  const note = difference === null ? "Primeiro registro deste exercício" : "em relação ao registro anterior";

  return `
    <aside class="performance-evolution">
      <span class="performance-evolution-label">Última evolução</span>
      <strong class="performance-evolution-value ${className}">${escapeHtml(value)}</strong>
      <span class="performance-evolution-note">${note}</span>
    </aside>
  `;
}

function renderRecentSection() {
  const latest = getSortedRecordsDescending().slice(0, 3);
  return `
    <section class="performance-section" aria-labelledby="performance-recent-title">
      <header class="performance-section-head">
        <h2 id="performance-recent-title">Últimos treinos</h2>
        <button class="performance-link-button" type="button" data-action="open-history">Ver todos →</button>
      </header>
      <div class="performance-recent-list">
        ${latest.map(renderRecordCard).join("")}
      </div>
    </section>
  `;
}

function renderRecordCard(record: WorkoutRecord) {
  const complete = record.completo;
  const progress = complete ? 100 : 0;
  return `
    <button class="performance-workout-card" type="button" data-action="open-details" data-record-id="${escapeAttribute(record.id)}">
      <span class="performance-workout-icon" aria-hidden="true">↗</span>
      <span class="performance-workout-main">
        <span class="performance-workout-title-row">
          <span class="performance-workout-title">${escapeHtml(record.nomeTreino)}</span>
          <span class="performance-status ${complete ? "" : "incomplete"}">${complete ? "✓ Completo" : "Incompleto"}</span>
        </span>
        <span class="performance-workout-meta">
          <span>▣ ${escapeHtml(record.dataHora)}</span>
          <span>${record.exercicios.length} exercício(s)</span>
          ${record.duracaoSegundos > 0 ? `<span>◷ ${formatWorkoutDuration(record.duracaoSegundos)}</span>` : ""}
        </span>
      </span>
      <span class="performance-progress-ring" style="--progress:${progress}%"><span>${complete ? "100%" : "—"}</span></span>
      <span class="performance-card-arrow" aria-hidden="true">›</span>
    </button>
  `;
}

function renderCalendarSection() {
  return `
    <section class="performance-section" aria-labelledby="performance-calendar-title">
      <header class="performance-section-head">
        <h2 id="performance-calendar-title">Calendário de treinos</h2>
        <button class="performance-link-button" type="button" data-action="open-year-calendar">Ver ano →</button>
      </header>
      ${renderMonthCalendar(calendarCursor, true)}
    </section>
  `;
}

function renderMonthCalendar(monthDate: Date, withControls: boolean) {
  const trainedDays = getTrainedDayKeys();
  const todayKey = dateKey(new Date());
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - mondayOffset);
  const weekdays = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
    const key = dateKey(day);
    const trained = trainedDays.has(key);
    const outside = day.getMonth() !== month;
    const classes = ["performance-calendar-day", trained ? "is-trained" : "", outside ? "is-outside" : "", key === todayKey ? "is-today" : ""].filter(Boolean).join(" ");
    if (trained) {
      return `<button class="${classes}" type="button" data-action="open-day-history" data-day-key="${key}" aria-label="${day.toLocaleDateString("pt-BR")} — treino realizado">${day.getDate()}</button>`;
    }
    return `<span class="${classes}">${day.getDate()}</span>`;
  }).join("");

  return `
    <div class="performance-calendar-card">
      <div class="performance-calendar-toolbar">
        ${withControls ? `<button class="performance-icon-button" type="button" data-action="previous-month" aria-label="Mês anterior">‹</button>` : `<span></span>`}
        <strong>${escapeHtml(formatMonthYear(monthDate))}</strong>
        ${withControls ? `<button class="performance-icon-button" type="button" data-action="next-month" aria-label="Próximo mês">›</button>` : `<span></span>`}
      </div>
      <div class="performance-calendar-grid">
        ${weekdays.map((day) => `<span class="performance-calendar-weekday">${day}</span>`).join("")}
        ${days}
      </div>
      <div class="performance-calendar-legend"><i></i><span>Dias com treino registrado</span></div>
    </div>
  `;
}

function renderDetailDialog() {
  if (!detailRecordId) return "";
  const record = records.find((item) => item.id === detailRecordId);
  if (!record) return "";

  return `
    <div class="performance-dialog-backdrop" data-action="close-details">
      <article class="performance-dialog" role="dialog" aria-modal="true" aria-label="Detalhes do treino">
        <header class="performance-dialog-head">
          <h2>${escapeHtml(record.nomeTreino)}</h2>
          <button class="performance-dialog-close" type="button" data-action="close-details" aria-label="Fechar">×</button>
        </header>
        <p>${escapeHtml(record.dataHora)} · ${record.completo ? "Treino completo" : "Treino incompleto"} · Duração: ${record.duracaoSegundos > 0 ? formatWorkoutDuration(record.duracaoSegundos) : "não registrada"}</p>
        <div class="performance-detail-list">${record.exercicios.map(renderExerciseDetail).join("")}</div>
      </article>
    </div>
  `;
}

function renderExerciseDetail(exercise: ExerciseRecord) {
  return `
    <div class="performance-detail-exercise">
      <strong>${escapeHtml(exercise.nomeExercicio)}</strong>
      ${exercise.series.map((serie) => `<span>Série ${serie.serieNumero}: ${formatNumber(serie.kg)} kg × ${serie.reps} repetições</span>`).join("")}
    </div>
  `;
}

function renderHistoryDialog() {
  if (!historyDialogOpen) return "";
  const list = historyDayKey
    ? getSortedRecordsDescending().filter((record) => recordDayKey(record) === historyDayKey)
    : getSortedRecordsDescending();
  const title = historyDayKey ? `Treinos de ${formatDayKey(historyDayKey)}` : "Todos os treinos";

  return `
    <div class="performance-dialog-backdrop" data-action="close-history">
      <article class="performance-dialog" role="dialog" aria-modal="true" aria-label="${escapeAttribute(title)}">
        <header class="performance-dialog-head">
          <h2>${escapeHtml(title)}</h2>
          <button class="performance-dialog-close" type="button" data-action="close-history" aria-label="Fechar">×</button>
        </header>
        <div class="performance-history-dialog-list">${list.length ? list.map(renderRecordCard).join("") : `<div class="performance-empty">Nenhum treino nesta data.</div>`}</div>
      </article>
    </div>
  `;
}

function renderAnnualCalendarDialog() {
  if (!annualCalendarOpen) return "";
  const year = calendarCursor.getFullYear();
  return `
    <div class="performance-dialog-backdrop" data-action="close-year-calendar">
      <article class="performance-dialog is-wide" role="dialog" aria-modal="true" aria-label="Calendário anual">
        <header class="performance-dialog-head">
          <h2>Calendário anual</h2>
          <button class="performance-dialog-close" type="button" data-action="close-year-calendar" aria-label="Fechar">×</button>
        </header>
        <div class="performance-year-toolbar">
          <button class="performance-icon-button" type="button" data-action="previous-year" aria-label="Ano anterior">‹</button>
          <strong>${year}</strong>
          <button class="performance-icon-button" type="button" data-action="next-year" aria-label="Próximo ano">›</button>
        </div>
        <div class="performance-year-grid">
          ${Array.from({ length: 12 }, (_, month) => renderMiniMonth(year, month)).join("")}
        </div>
      </article>
    </div>
  `;
}

function renderMiniMonth(year: number, month: number) {
  const trainedDays = getTrainedDayKeys();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: offset }, () => `<span class="performance-mini-day is-empty">0</span>`),
    ...Array.from({ length: count }, (_, index) => {
      const day = index + 1;
      const trained = trainedDays.has(dateKey(new Date(year, month, day)));
      return `<span class="performance-mini-day ${trained ? "is-trained" : ""}">${day}</span>`;
    })
  ];
  return `
    <button class="performance-mini-month" type="button" data-action="select-month" data-year="${year}" data-month="${month}">
      <strong>${escapeHtml(new Date(year, month, 1).toLocaleDateString("pt-BR", { month: "long" }))}</strong>
      <span class="performance-mini-grid">${cells.join("")}</span>
    </button>
  `;
}

function getWorkoutNames() {
  const seen = new Set<string>();
  return getSortedRecordsDescending().flatMap((record) => {
    const key = normalize(record.nomeTreino);
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [record.nomeTreino];
  });
}

function getExerciseNamesForWorkout(workoutName: string) {
  const names = new Map<string, string>();
  records.filter((record) => sameName(record.nomeTreino, workoutName)).forEach((record) => {
    record.exercicios.forEach((exercise) => {
      const key = normalize(exercise.nomeExercicio);
      if (key && !names.has(key)) names.set(key, exercise.nomeExercicio);
    });
  });
  return Array.from(names.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function reconcileSelections() {
  const workouts = getWorkoutNames();
  if (!workouts.some((name) => sameName(name, selectedWorkout))) selectedWorkout = workouts[0] ?? "";
  const exercises = getExerciseNamesForWorkout(selectedWorkout);
  if (!exercises.some((name) => sameName(name, selectedExercise))) {
    selectedExercise = exercises[0] ?? "";
    chartTooltipPointId = null;
  }
}

function buildPerformancePoints(workoutName: string, exerciseName: string): PerformancePoint[] {
  return records
    .filter((record) => sameName(record.nomeTreino, workoutName))
    .map((record): PerformancePoint | null => {
      const exercise = record.exercicios.find((item) => sameName(item.nomeExercicio, exerciseName));
      if (!exercise || exercise.series.length === 0) return null;
      const referenceSeries = exercise.series.reduce((best, serie) => {
        const bestLoad = finiteNumber(best.kg);
        const currentLoad = finiteNumber(serie.kg);
        if (currentLoad > bestLoad) return serie;
        if (currentLoad === bestLoad && finiteNumber(serie.reps) > finiteNumber(best.reps)) return serie;
        return best;
      });
      const load = finiteNumber(referenceSeries.kg);
      const reps = finiteNumber(referenceSeries.reps);
      const volume = exercise.series.reduce((sum, serie) => sum + finiteNumber(serie.kg) * finiteNumber(serie.reps), 0);
      return {
        id: record.id,
        label: shortDayLabel(record),
        workoutName: record.nomeTreino,
        load,
        reps,
        volume
      };
    })
    .filter((point): point is PerformancePoint => point !== null)
    .sort((a, b) => {
      const recordA = records.find((record) => record.id === a.id);
      const recordB = records.find((record) => record.id === b.id);
      return (recordA ? recordSortValue(recordA) : 0) - (recordB ? recordSortValue(recordB) : 0);
    });
}

function metricValue(point: PerformancePoint) {
  if (selectedMetric === "reps") return point.reps;
  if (selectedMetric === "volume") return point.volume;
  return point.load;
}

function metricLabel(metric: Metric) {
  if (metric === "reps") return "Repetições";
  if (metric === "volume") return "Volume";
  return "Carga";
}

function metricUnit(metric: Metric) {
  if (metric === "reps") return " reps";
  if (metric === "volume") return " kg·rep";
  return " kg";
}

function formatMetricAxis(value: number) {
  const suffix = selectedMetric === "load" ? " kg" : selectedMetric === "reps" ? "" : "";
  return `${formatCompactNumber(value)}${suffix}`;
}

function formatMetricValue(value: number) {
  return `${formatNumber(value)}${metricUnit(selectedMetric)}`;
}

function formatSignedMetric(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${prefix}${formatNumber(Math.abs(value))}${metricUnit(selectedMetric)}`;
}

function getSortedRecordsDescending() {
  return records.slice().sort((a, b) => recordSortValue(b) - recordSortValue(a));
}

function getTrainedDayKeys() {
  return new Set(records.map(recordDayKey).filter((key): key is string => Boolean(key)));
}

function recordDayKey(record: WorkoutRecord) {
  const date = recordDate(record);
  return date ? dateKey(date) : null;
}

function recordDate(record: WorkoutRecord) {
  if (Number.isFinite(record.createdAt) && record.createdAt > 0) return new Date(record.createdAt);
  return parsePtBrDate(record.dataHora);
}

function shortDayLabel(record: WorkoutRecord) {
  const parsed = recordDate(record);
  if (!parsed) return record.dataHora.slice(0, 8) || "--/--/--";
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function recordSortValue(record: WorkoutRecord) {
  if (Number.isFinite(record.createdAt) && record.createdAt > 0) return record.createdAt;
  return parsePtBrDate(record.dataHora)?.getTime() ?? 0;
}

function parsePtBrDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s+(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, day, month, year, hour = "0", minute = "0"] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDayKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR");
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function handleDocumentClick(event: MouseEvent) {
  const targetElement = event.target as Element | null;
  const actionElement = targetElement?.closest(`#${ROOT_ID} [data-action]`) as HTMLElement | null;
  if (!actionElement) return;
  if (actionElement.classList.contains("performance-dialog-backdrop") && targetElement !== actionElement) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const action = actionElement.dataset.action;

  if (action === "select-metric") {
    const metric = actionElement.dataset.metric as Metric;
    if (["load", "reps", "volume"].includes(metric)) {
      selectedMetric = metric;
      chartTooltipPointId = null;
      scheduleRender();
    }
    return;
  }

  if (action === "chart-point") {
    const id = actionElement.dataset.pointId ?? null;
    chartTooltipPointId = chartTooltipPointId === id ? null : id;
    scheduleRender();
    return;
  }

  if (action === "open-details") {
    detailRecordId = actionElement.dataset.recordId ?? null;
    scheduleRender();
    return;
  }

  if (action === "close-details") {
    detailRecordId = null;
    scheduleRender();
    return;
  }

  if (action === "open-history") {
    historyDayKey = null;
    historyDialogOpen = true;
    scheduleRender();
    return;
  }

  if (action === "open-day-history") {
    historyDayKey = actionElement.dataset.dayKey ?? null;
    historyDialogOpen = true;
    scheduleRender();
    return;
  }

  if (action === "close-history") {
    historyDialogOpen = false;
    historyDayKey = null;
    scheduleRender();
    return;
  }

  if (action === "previous-month" || action === "next-month") {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + (action === "next-month" ? 1 : -1), 1);
    scheduleRender();
    return;
  }

  if (action === "open-year-calendar" || action === "close-year-calendar") {
    annualCalendarOpen = action === "open-year-calendar";
    scheduleRender();
    return;
  }

  if (action === "previous-year" || action === "next-year") {
    calendarCursor = new Date(calendarCursor.getFullYear() + (action === "next-year" ? 1 : -1), calendarCursor.getMonth(), 1);
    scheduleRender();
    return;
  }

  if (action === "select-month") {
    calendarCursor = new Date(Number(actionElement.dataset.year), Number(actionElement.dataset.month), 1);
    annualCalendarOpen = false;
    scheduleRender();
  }
}

function handleDocumentChange(event: Event) {
  const select = event.target as HTMLSelectElement | null;
  if (!select?.matches(`#${ROOT_ID} select[data-action]`)) return;
  const action = select.dataset.action;

  if (action === "select-workout") {
    selectedWorkout = select.value;
    selectedExercise = "";
    chartTooltipPointId = null;
    reconcileSelections();
    scheduleRender();
  }

  if (action === "select-exercise") {
    selectedExercise = select.value;
    chartTooltipPointId = null;
    scheduleRender();
  }
}

function sameName(a: string, b: string) {
  return normalize(a) === normalize(b);
}

function normalize(value: string | null | undefined) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function finiteNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

function formatWorkoutDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}min ${seconds}s`;
  if (minutes > 0) return `${minutes}min ${seconds}s`;
  return `${seconds}s`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { notation: value >= 1000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
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
    document.addEventListener("change", handleDocumentChange, true);
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootDesktopPerformanceLayout, { once: true });
} else {
  bootDesktopPerformanceLayout();
}

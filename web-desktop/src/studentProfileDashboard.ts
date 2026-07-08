export {};

import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query, updateDoc, type DocumentData } from "firebase/firestore";
import { initFirebase, readInitialConfig, type FirebaseServices } from "./firebase";

const STYLE_ID = "meutreino-student-profile-dashboard";
const ROOT_ID = "meutreino-student-profile-dashboard-root";
const CARDIO_GOAL_ROOT_ID = "meutreino-cardio-goal-root";
const DASHBOARD_CLASS = "student-profile-dashboard-active";
const WORKSPACE_CLASS = "student-profile-dashboard-mode";
const SELECTED_STUDENT_KEY = "meutreino.selectedStudent";
const DEFAULT_CARDIO_GOAL = 150;

type Role = "ALUNO" | "TREINADOR" | "ADMIN";

type StudentProfileState = {
  uid: string;
  name: string;
  email: string;
  role: Role;
  approved: boolean;
  idade?: number;
  alturaCm?: number;
  cardioMetaSemanalMin: number;
};

type TargetState = {
  uid: string;
  name: string;
  email?: string;
};

type WorkoutRecordState = {
  id: string;
  nomeTreino: string;
  dataHora: string;
  completo: boolean;
  createdAt: number;
};

type CardioRecordState = {
  id: string;
  atividade: string;
  dataHora: string;
  tempoMin: number;
  ritmo: string;
  createdAt: number;
};

type NotificationState = {
  id: string;
  message: string;
  read: boolean;
  createdAt: number;
};

let services: FirebaseServices | null = null;
let authUser: User | null = null;
let currentProfile: StudentProfileState | null = null;
let target: TargetState | null = null;
let targetProfile: StudentProfileState | null = null;
let records: WorkoutRecordState[] = [];
let cardio: CardioRecordState[] = [];
let notifications: NotificationState[] = [];
let profileUnsubscribe: (() => void) | null = null;
let targetProfileUnsubscribe: (() => void) | null = null;
let recordsUnsubscribe: (() => void) | null = null;
let cardioUnsubscribe: (() => void) | null = null;
let notificationsUnsubscribe: (() => void) | null = null;
let subscribedTargetUid: string | null = null;
let authAttached = false;
let listenersAttached = false;
let observerAttached = false;
let renderQueued = false;
let lastProfileHtml = "";
let lastCardioGoalHtml = "";
let cardioGoalDraft = "";

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

function normalizeRole(value: unknown): Role {
  const role = String(value ?? "ALUNO").trim().toUpperCase();
  if (role === "TREINADOR" || role === "ADMIN") return role;
  return "ALUNO";
}

function profileFromDoc(uid: string, data: DocumentData | undefined, fallbackEmail = ""): StudentProfileState {
  const rawGoal = Number(data?.cardioMetaSemanalMin ?? data?.metaSemanalCardioMin ?? data?.cardioGoalMin ?? DEFAULT_CARDIO_GOAL);

  return {
    uid,
    name: String(data?.name ?? fallbackEmail ?? "Aluno"),
    email: String(data?.email ?? fallbackEmail ?? ""),
    role: normalizeRole(data?.role),
    approved: Boolean(data?.approved ?? data?.active ?? false),
    idade: typeof data?.idade === "number" ? data.idade : undefined,
    alturaCm: typeof data?.alturaCm === "number" ? data.alturaCm : undefined,
    cardioMetaSemanalMin: Number.isFinite(rawGoal) && rawGoal > 0 ? rawGoal : DEFAULT_CARDIO_GOAL
  };
}

function workoutFromDoc(id: string, data: DocumentData): WorkoutRecordState {
  return {
    id,
    nomeTreino: String(data.nomeTreino ?? "Treino"),
    dataHora: String(data.dataHora ?? "-"),
    completo: Boolean(data.completo ?? false),
    createdAt: Number(data.createdAt ?? 0)
  };
}

function cardioFromDoc(id: string, data: DocumentData): CardioRecordState {
  return {
    id: String(data.id ?? id),
    atividade: String(data.atividade ?? "Cardio"),
    dataHora: String(data.dataHora ?? "-"),
    tempoMin: Number(data.tempoMin ?? 0),
    ritmo: String(data.ritmo ?? "-"),
    createdAt: Number(data.createdAt ?? 0)
  };
}

function notificationFromDoc(id: string, data: DocumentData): NotificationState {
  return {
    id,
    message: String(data.message ?? "Seu treino foi atualizado."),
    read: Boolean(data.read ?? false),
    createdAt: Number(data.createdAt ?? 0)
  };
}

function readSelectedStudent(): TargetState | null {
  const raw = localStorage.getItem(SELECTED_STUDENT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<TargetState>;
    if (!parsed.uid) return null;
    return {
      uid: String(parsed.uid),
      name: String(parsed.name ?? "Aluno"),
      email: parsed.email ? String(parsed.email) : undefined
    };
  } catch {
    return null;
  }
}

function resolveTarget() {
  if (!currentProfile) return null;
  if (currentProfile.role === "ALUNO") {
    return { uid: currentProfile.uid, name: currentProfile.name, email: currentProfile.email };
  }
  if (currentProfile.role === "TREINADOR") {
    return readSelectedStudent();
  }
  return null;
}

function stopTargetSubscriptions() {
  targetProfileUnsubscribe?.();
  recordsUnsubscribe?.();
  cardioUnsubscribe?.();
  notificationsUnsubscribe?.();
  targetProfileUnsubscribe = null;
  recordsUnsubscribe = null;
  cardioUnsubscribe = null;
  notificationsUnsubscribe = null;
}

function syncTargetSubscriptions() {
  const currentServices = getServices();
  const nextTarget = resolveTarget();
  target = nextTarget;

  if (!currentServices || !nextTarget?.uid) {
    stopTargetSubscriptions();
    subscribedTargetUid = null;
    targetProfile = currentProfile?.role === "ALUNO" ? currentProfile : null;
    records = [];
    cardio = [];
    notifications = [];
    scheduleRender();
    return;
  }

  if (subscribedTargetUid === nextTarget.uid && recordsUnsubscribe && cardioUnsubscribe) {
    return;
  }

  stopTargetSubscriptions();
  subscribedTargetUid = nextTarget.uid;
  records = [];
  cardio = [];
  notifications = [];

  targetProfileUnsubscribe = onSnapshot(
    doc(currentServices.db, "users", nextTarget.uid),
    (snap) => {
      targetProfile = profileFromDoc(nextTarget.uid, snap.data(), nextTarget.email ?? "");
      if (!cardioGoalDraft) cardioGoalDraft = String(targetProfile.cardioMetaSemanalMin);
      scheduleRender();
    },
    () => {
      targetProfile = currentProfile?.role === "ALUNO" ? currentProfile : null;
      scheduleRender();
    }
  );

  recordsUnsubscribe = onSnapshot(
    query(collection(currentServices.db, "users", nextTarget.uid, "treino_registros"), orderBy("createdAt", "desc")),
    (snap) => {
      records = snap.docs.map((item) => workoutFromDoc(item.id, item.data()));
      scheduleRender();
    },
    () => scheduleRender()
  );

  cardioUnsubscribe = onSnapshot(
    query(collection(currentServices.db, "users", nextTarget.uid, "cardio"), orderBy("createdAt", "desc")),
    (snap) => {
      cardio = snap.docs.map((item) => cardioFromDoc(item.id, item.data()));
      scheduleRender();
    },
    () => scheduleRender()
  );

  notificationsUnsubscribe = onSnapshot(
    query(collection(currentServices.db, "users", nextTarget.uid, "notifications"), orderBy("createdAt", "desc")),
    (snap) => {
      notifications = snap.docs.map((item) => notificationFromDoc(item.id, item.data()));
      scheduleRender();
    },
    () => scheduleRender()
  );
}

function attachAuth() {
  const currentServices = getServices();
  if (!currentServices || authAttached) return;

  authAttached = true;
  onAuthStateChanged(currentServices.auth, (user) => {
    authUser = user;
    currentProfile = null;
    targetProfile = null;
    profileUnsubscribe?.();
    profileUnsubscribe = null;
    stopTargetSubscriptions();
    subscribedTargetUid = null;

    if (!user) {
      scheduleRender();
      return;
    }

    profileUnsubscribe = onSnapshot(
      doc(currentServices.db, "users", user.uid),
      (snap) => {
        currentProfile = profileFromDoc(user.uid, snap.data(), user.email ?? "");
        syncTargetSubscriptions();
        scheduleRender();
      },
      () => scheduleRender()
    );
  });
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${DASHBOARD_CLASS} > .grid,
    .${DASHBOARD_CLASS} > .summary-row,
    .${DASHBOARD_CLASS} > .panel {
      display: none !important;
    }

    .student-profile-dashboard {
      display: grid;
      gap: 18px;
      color: #10212a;
    }

    .student-profile-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 2px;
    }

    .student-profile-title {
      display: inline-flex;
      align-items: center;
      gap: 14px;
      margin: 0;
      color: #10212a;
      font-size: clamp(28px, 4vw, 44px);
      line-height: 1;
      letter-spacing: -0.04em;
      font-weight: 900;
    }

    .student-profile-title-icon {
      display: inline-grid;
      place-items: center;
      color: #15945f;
      font-size: 30px;
    }

    .student-menu-button {
      width: 62px;
      height: 62px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.92);
      color: #10212a;
      box-shadow: 0 14px 34px rgba(41, 71, 61, 0.14);
      font-size: 28px;
      font-weight: 900;
    }

    .student-dashboard-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 18px;
    }

    .student-dashboard-card {
      min-width: 0;
      border: 1px solid rgba(214, 228, 221, 0.84);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 14px 34px rgba(41, 71, 61, 0.1);
      padding: 26px;
    }

    .student-card-head {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 24px;
    }

    .student-card-icon {
      width: 56px;
      height: 56px;
      display: grid;
      place-items: center;
      border-radius: 18px;
      background: #e8f6ee;
      color: #11935d;
      font-size: 29px;
      font-weight: 900;
    }

    .student-card-head h3 {
      margin: 0;
      color: #10212a;
      font-size: 23px;
      line-height: 1.1;
      letter-spacing: -0.03em;
    }

    .student-profile-card-body {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      gap: 26px;
      align-items: center;
    }

    .student-avatar-large {
      width: 158px;
      height: 158px;
      display: grid;
      place-items: center;
      position: relative;
      border-radius: 999px;
      background: linear-gradient(145deg, #e8f6ee, #f4fbf7);
      color: #13925c;
      font-size: 95px;
      margin: 0 auto;
    }

    .student-avatar-badge {
      width: 45px;
      height: 45px;
      display: grid;
      place-items: center;
      position: absolute;
      right: 3px;
      bottom: 8px;
      border-radius: 999px;
      background: #16a160;
      color: white;
      border: 4px solid white;
      font-size: 22px;
      box-shadow: 0 10px 22px rgba(22, 161, 96, 0.25);
    }

    .student-profile-lines {
      display: grid;
      gap: 0;
      margin: 0;
    }

    .student-profile-lines div {
      min-height: 48px;
      display: grid;
      grid-template-columns: 34px 1fr 1.1fr;
      gap: 14px;
      align-items: center;
      border-bottom: 1px solid rgba(214, 228, 221, 0.9);
      color: #10212a;
    }

    .student-profile-lines dt,
    .student-profile-lines dd {
      margin: 0;
    }

    .student-profile-lines dt {
      font-weight: 650;
    }

    .student-profile-lines dd {
      font-weight: 900;
      word-break: break-word;
    }

    .student-line-icon {
      color: #34576a;
      font-size: 20px;
    }

    .student-status-pill {
      width: fit-content;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 34px;
      padding: 8px 14px;
      border-radius: 10px;
      color: #0d8d51;
      background: #e8f6ee;
      font-weight: 900;
    }

    .student-data-form {
      display: grid;
      grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) auto;
      gap: 18px;
      align-items: end;
    }

    .student-field {
      display: grid;
      gap: 10px;
      color: #10212a;
      font-weight: 700;
    }

    .student-input-wrap {
      min-height: 72px;
      display: grid;
      grid-template-columns: 34px 1fr;
      align-items: center;
      gap: 12px;
      border: 1px solid #b8c8d7;
      border-radius: 12px;
      background: #ffffff;
      padding: 0 18px;
    }

    .student-input-wrap span {
      color: #34576a;
      font-size: 22px;
    }

    .student-input-wrap input {
      width: 100%;
      border: 0;
      outline: none;
      background: transparent;
      color: #10212a;
      font-size: 17px;
      font-weight: 700;
    }

    .student-save-button,
    .student-mark-read-button,
    .student-goal-save {
      min-height: 64px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      border-radius: 12px;
      padding: 0 28px;
      color: white;
      background: linear-gradient(135deg, #0f8f62, #17aa67);
      box-shadow: 0 14px 24px rgba(22, 161, 96, 0.22);
      font-weight: 900;
      font-size: 18px;
    }

    .student-summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
    }

    .student-summary-card {
      min-height: 148px;
      display: grid;
      grid-template-columns: 96px 1fr auto;
      align-items: center;
      gap: 22px;
      border: 1px solid rgba(214, 228, 221, 0.84);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 14px 34px rgba(41, 71, 61, 0.1);
      padding: 24px 26px;
    }

    .student-summary-icon {
      width: 86px;
      height: 86px;
      display: grid;
      place-items: center;
      border-radius: 22px;
      background: #e8f6ee;
      color: #11935d;
      font-size: 38px;
      font-weight: 900;
    }

    .student-summary-card small {
      display: block;
      color: #10212a;
      font-size: 16px;
      margin-bottom: 8px;
    }

    .student-summary-card strong {
      display: block;
      color: #10212a;
      font-size: 25px;
      line-height: 1.25;
      letter-spacing: -0.03em;
    }

    .student-summary-arrow {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: #f3f8f5;
      color: #10212a;
      font-size: 30px;
    }

    .student-week-card {
      padding: 26px 26px 22px;
    }

    .student-week-head {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      gap: 18px;
      align-items: center;
      padding-bottom: 18px;
      border-bottom: 1px solid rgba(214, 228, 221, 0.9);
    }

    .student-week-title {
      margin: 0;
      color: #10212a;
      font-size: 22px;
      letter-spacing: -0.03em;
    }

    .student-training-summary-pill {
      justify-self: end;
      min-height: 54px;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 0 22px;
      border: 1px solid #bfe4d1;
      border-radius: 12px;
      color: #0c9356;
      background: #f4fbf7;
      font-weight: 900;
    }

    .student-cardio-goal-compact,
    .student-cardio-goal-panel {
      border: 1px solid #bfe4d1;
      border-radius: 12px;
      background: #fbfffd;
      padding: 12px 16px;
      min-width: 330px;
    }

    .student-cardio-goal-compact header,
    .student-cardio-goal-panel header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: #10212a;
      font-weight: 900;
      font-size: 13px;
    }

    .student-cardio-goal-compact header span,
    .student-cardio-goal-panel header span {
      color: #0798a2;
    }

    .student-progress-line {
      height: 9px;
      overflow: hidden;
      border-radius: 999px;
      background: #d8efed;
      margin-top: 12px;
    }

    .student-progress-line span {
      display: block;
      height: 100%;
      width: var(--student-progress, 0%);
      border-radius: inherit;
      background: linear-gradient(90deg, #0ba0a6, #26c6c0);
    }

    .student-cardio-goal-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
      color: #087d80;
      font-size: 12px;
      font-weight: 800;
    }

    .student-week-days {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 0;
      padding-top: 18px;
    }

    .student-week-day {
      min-width: 0;
      display: grid;
      gap: 12px;
      justify-items: center;
      border-right: 1px solid rgba(214, 228, 221, 0.9);
      padding: 0 12px;
    }

    .student-week-day:last-child {
      border-right: 0;
    }

    .student-day-label {
      color: #34576a;
      font-size: 14px;
      font-weight: 900;
    }

    .student-day-dots {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      gap: 16px;
    }

    .student-dot-block {
      display: grid;
      justify-items: center;
      gap: 8px;
      color: #34576a;
      font-size: 12px;
      font-weight: 700;
    }

    .student-dot {
      width: 46px;
      height: 46px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      border: 2px solid var(--dot-color);
      color: var(--dot-color);
      background: white;
      font-size: 24px;
      font-weight: 900;
    }

    .student-dot.is-done {
      color: white;
      background: var(--dot-color);
      box-shadow: 0 12px 20px rgba(20, 120, 85, 0.16);
    }

    .student-dot.training { --dot-color: #15945f; }
    .student-dot.cardio { --dot-color: #0ea8aa; }

    .student-updates-card {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 20px;
    }

    .student-updates-list {
      display: grid;
      gap: 8px;
    }

    .student-updates-list strong {
      color: #10212a;
      font-size: 22px;
    }

    .student-updates-list small,
    .student-updates-list p {
      margin: 0;
      color: #34576a;
      font-size: 15px;
    }

    .student-mark-read-button {
      min-height: 52px;
      color: #0c9356;
      background: #f4fbf7;
      border: 1px solid #bfe4d1;
      box-shadow: none;
      font-size: 16px;
    }

    .student-cardio-goal-shell {
      margin-bottom: 18px;
    }

    .student-cardio-goal-panel {
      min-width: 0;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 14px 34px rgba(41, 71, 61, 0.1);
      padding: 22px;
    }

    .student-goal-form {
      display: flex;
      gap: 12px;
      align-items: end;
      flex-wrap: wrap;
      margin-top: 16px;
    }

    .student-goal-form label {
      display: grid;
      gap: 8px;
      font-weight: 800;
      color: #10212a;
    }

    .student-goal-form input {
      min-height: 46px;
      border: 1px solid #cbd8d2;
      border-radius: 10px;
      padding: 10px 12px;
      outline: none;
    }

    .student-goal-save {
      min-height: 46px;
      font-size: 15px;
      padding: 0 18px;
    }

    @media (max-width: 1100px) {
      .student-dashboard-grid,
      .student-summary-grid {
        grid-template-columns: 1fr;
      }

      .student-week-head {
        grid-template-columns: auto 1fr;
      }

      .student-training-summary-pill,
      .student-cardio-goal-compact {
        grid-column: 1 / -1;
        justify-self: stretch;
      }

      .student-cardio-goal-compact {
        min-width: 0;
      }
    }

    @media (max-width: 760px) {
      .student-profile-dashboard {
        gap: 14px;
      }

      .student-dashboard-card {
        padding: 20px;
        border-radius: 16px;
      }

      .student-profile-card-body,
      .student-data-form,
      .student-summary-card,
      .student-updates-card {
        grid-template-columns: 1fr;
      }

      .student-avatar-large {
        width: 128px;
        height: 128px;
        font-size: 78px;
      }

      .student-profile-lines div {
        grid-template-columns: 30px 0.7fr 1fr;
      }

      .student-summary-arrow {
        display: none;
      }

      .student-week-days {
        grid-template-columns: 1fr;
        gap: 14px;
      }

      .student-week-day {
        grid-template-columns: 48px 1fr;
        align-items: center;
        justify-items: start;
        border-right: 0;
        border-bottom: 1px solid rgba(214, 228, 221, 0.9);
        padding: 0 0 14px;
      }

      .student-week-day:last-child {
        border-bottom: 0;
      }

      .student-day-dots {
        justify-content: flex-start;
      }

      .student-dot {
        width: 42px;
        height: 42px;
      }

      .student-menu-button {
        width: 54px;
        height: 54px;
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
    syncTargetSubscriptions();
    renderProfileDashboard();
    renderCardioGoalPanel();
  });
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function findProfileScreen() {
  const screens = Array.from(document.querySelectorAll<HTMLElement>("section.screen"));
  return screens.find((screen) => normalizeText(screen.querySelector(".section-title h3")?.textContent) === "perfil") ?? null;
}

function findCardioScreen() {
  const screens = Array.from(document.querySelectorAll<HTMLElement>("section.screen"));
  return screens.find((screen) => Array.from(screen.querySelectorAll(".section-title h3")).some((title) => normalizeText(title.textContent) === "cardio")) ?? null;
}

function setWorkspaceMode(active: boolean) {
  const workspace = document.querySelector<HTMLElement>(".workspace");
  workspace?.classList.toggle(WORKSPACE_CLASS, active);
}

function renderProfileDashboard() {
  const screen = findProfileScreen();
  const shouldRender = Boolean(screen && currentProfile?.role === "ALUNO" && targetProfile?.role === "ALUNO");

  document.querySelectorAll<HTMLElement>(`.${DASHBOARD_CLASS}`).forEach((item) => {
    if (item !== screen) item.classList.remove(DASHBOARD_CLASS);
  });

  if (!screen || !shouldRender || !targetProfile) {
    setWorkspaceMode(false);
    lastProfileHtml = "";
    document.getElementById(ROOT_ID)?.remove();
    return;
  }

  setWorkspaceMode(true);
  screen.classList.add(DASHBOARD_CLASS);

  let root = screen.querySelector<HTMLElement>(`#${ROOT_ID}`);
  if (!root) {
    root = document.createElement("div");
    root.id = ROOT_ID;
    screen.prepend(root);
    lastProfileHtml = "";
  }

  const html = renderProfileHtml(targetProfile);
  if (html !== lastProfileHtml) {
    root.innerHTML = html;
    lastProfileHtml = html;
  }
}

function renderProfileHtml(profile: StudentProfileState) {
  const latestRecord = records[0];
  const latestCardio = cardio[0];
  const week = buildWeeklyProgress(profile.cardioMetaSemanalMin);
  const unreadCount = notifications.filter((item) => !item.read).length;
  const unreadMessages = notifications.filter((item) => !item.read).slice(0, 3);

  return `
    <div class="student-profile-dashboard">
      <header class="student-profile-top">
        <h1 class="student-profile-title"><span class="student-profile-title-icon">☘</span>${escapeHtml(profile.name)}</h1>
        <button class="student-menu-button" type="button" data-student-action="open-menu" aria-label="Abrir menu">☰</button>
      </header>

      <div class="student-dashboard-grid">
        <article class="student-dashboard-card">
          <div class="student-card-head"><span class="student-card-icon">♡</span><h3>Perfil</h3></div>
          <div class="student-profile-card-body">
            <div class="student-avatar-large">♙<span class="student-avatar-badge">✓</span></div>
            <dl class="student-profile-lines">
              <div><span class="student-line-icon">♙</span><dt>Nome</dt><dd>${escapeHtml(profile.name)}</dd></div>
              <div><span class="student-line-icon">✉</span><dt>Email</dt><dd>${escapeHtml(profile.email || authUser?.email || "-")}</dd></div>
              <div><span class="student-line-icon">⌂</span><dt>Tipo</dt><dd>${escapeHtml(profile.role)}</dd></div>
              <div><span class="student-line-icon">♢</span><dt>Status</dt><dd><span class="student-status-pill">✓ ${profile.approved ? "Liberado" : "Aguardando"}</span></dd></div>
            </dl>
          </div>
        </article>

        <article class="student-dashboard-card">
          <div class="student-card-head"><span class="student-card-icon">▱</span><h3>Dados do aluno</h3></div>
          <form class="student-data-form" data-student-form="profile">
            <label class="student-field">Idade
              <span class="student-input-wrap"><span>▣</span><input type="number" inputmode="numeric" data-student-input="idade" value="${escapeAttribute(profile.idade?.toString() ?? "")}" /></span>
            </label>
            <label class="student-field">Altura em cm
              <span class="student-input-wrap"><span>♙</span><input type="number" inputmode="numeric" data-student-input="altura" value="${escapeAttribute(profile.alturaCm?.toString() ?? "")}" /></span>
            </label>
            <button class="student-save-button" type="submit">▣ Salvar</button>
          </form>
        </article>
      </div>

      <div class="student-summary-grid">
        <article class="student-summary-card">
          <span class="student-summary-icon">▮</span>
          <div><small>Último treino</small><strong>${latestRecord ? `${escapeHtml(latestRecord.nomeTreino)} ·<br />${escapeHtml(latestRecord.dataHora)}` : "Sem registros"}</strong></div>
          <span class="student-summary-arrow">›</span>
        </article>
        <article class="student-summary-card">
          <span class="student-summary-icon">♡</span>
          <div><small>Último cardio</small><strong>${latestCardio ? `${escapeHtml(latestCardio.atividade)} · ${latestCardio.tempoMin}min` : "Sem registros"}</strong></div>
          <span class="student-summary-arrow">›</span>
        </article>
      </div>

      <article class="student-dashboard-card student-week-card">
        <div class="student-week-head">
          <span class="student-card-icon">▮</span>
          <h3 class="student-week-title">Progresso da Semana</h3>
          <div class="student-training-summary-pill">✓ ${week.trainingDaysCount} de 7 dias com treino concluído</div>
          ${renderCardioGoalCompact(week.cardioMinutes, week.cardioGoal)}
        </div>
        <div class="student-week-days">
          ${week.days.map(renderWeekDay).join("")}
        </div>
      </article>

      <article class="student-dashboard-card student-updates-card">
        <span class="student-card-icon">♧</span>
        <div class="student-updates-list">
          <strong>Atualizações do treinador (${unreadCount})</strong>
          ${unreadMessages.length ? unreadMessages.map((item) => `<p>${escapeHtml(item.message)}</p>`).join("") : "<small>Sem novas atualizações</small>"}
        </div>
        <button class="student-mark-read-button" type="button" data-student-action="mark-notifications">✓ Marcar como lidas</button>
      </article>
    </div>
  `;
}

function renderCardioGoalCompact(done: number, goal: number) {
  const remaining = Math.max(goal - done, 0);
  const percent = goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 0;
  return `
    <div class="student-cardio-goal-compact">
      <header><strong>Meta semanal de cardio</strong><span>${done} de ${goal} min</span></header>
      <div class="student-progress-line" style="--student-progress: ${percent}%"><span></span></div>
      <div class="student-cardio-goal-footer">${remaining > 0 ? `Faltam ${remaining} min` : "Meta concluída"}</div>
    </div>
  `;
}

function renderWeekDay(day: { label: string; treino: boolean; cardio: boolean }) {
  return `
    <div class="student-week-day">
      <div class="student-day-label">${day.label}</div>
      <div class="student-day-dots">
        <div class="student-dot-block"><span class="student-dot training ${day.treino ? "is-done" : ""}">${day.treino ? "✓" : ""}</span><span>Treino</span></div>
        <div class="student-dot-block"><span class="student-dot cardio ${day.cardio ? "is-done" : ""}">${day.cardio ? "✓" : ""}</span><span>Cardio</span></div>
      </div>
    </div>
  `;
}

function renderCardioGoalPanel() {
  const screen = findCardioScreen();
  if (!screen || !target || !targetProfile) {
    lastCardioGoalHtml = "";
    document.getElementById(CARDIO_GOAL_ROOT_ID)?.remove();
    return;
  }

  let root = screen.querySelector<HTMLElement>(`#${CARDIO_GOAL_ROOT_ID}`);
  if (!root) {
    root = document.createElement("div");
    root.id = CARDIO_GOAL_ROOT_ID;
    root.className = "student-cardio-goal-shell";
    screen.prepend(root);
    lastCardioGoalHtml = "";
  }

  const week = buildWeeklyProgress(targetProfile.cardioMetaSemanalMin);
  const html = renderCardioGoalPanelHtml(week.cardioMinutes, week.cardioGoal);
  if (html !== lastCardioGoalHtml) {
    root.innerHTML = html;
    lastCardioGoalHtml = html;
  }
}

function renderCardioGoalPanelHtml(done: number, goal: number) {
  const remaining = Math.max(goal - done, 0);
  const percent = goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 0;
  const canEdit = currentProfile?.role === "TREINADOR" && Boolean(target?.uid);
  if (!cardioGoalDraft) cardioGoalDraft = String(goal);

  return `
    <article class="student-cardio-goal-panel">
      <header><strong>Meta semanal de cardio</strong><span>${done} de ${goal} min</span></header>
      <div class="student-progress-line" style="--student-progress: ${percent}%"><span></span></div>
      <div class="student-cardio-goal-footer">${remaining > 0 ? `Faltam ${remaining} min` : "Meta concluída"}</div>
      ${canEdit ? `
        <form class="student-goal-form" data-student-form="cardio-goal">
          <label>Meta semanal do aluno, em minutos
            <input type="number" min="0" step="5" data-student-input="cardio-goal" value="${escapeAttribute(cardioGoalDraft || String(goal))}" />
          </label>
          <button class="student-goal-save" type="submit">✓ Salvar meta</button>
        </form>
      ` : ""}
    </article>
  `;
}

function buildWeeklyProgress(goal: number) {
  const weekStart = startOfWeek(new Date());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return {
      key: dateKey(date),
      label: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][index],
      treino: false,
      cardio: false
    };
  });

  const dayMap = new Map(days.map((day) => [day.key, day]));

  records.filter((item) => item.completo).forEach((item) => {
    const date = dateFromRecord(item.createdAt, item.dataHora);
    if (!date || !isInCurrentWeek(date, weekStart)) return;
    const day = dayMap.get(dateKey(date));
    if (day) day.treino = true;
  });

  let cardioMinutes = 0;
  cardio.forEach((item) => {
    const date = dateFromRecord(item.createdAt, item.dataHora);
    if (!date || !isInCurrentWeek(date, weekStart)) return;
    const day = dayMap.get(dateKey(date));
    if (day) day.cardio = true;
    cardioMinutes += Number.isFinite(item.tempoMin) ? item.tempoMin : 0;
  });

  return {
    days,
    trainingDaysCount: days.filter((day) => day.treino).length,
    cardioMinutes,
    cardioGoal: goal || DEFAULT_CARDIO_GOAL
  };
}

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function isInCurrentWeek(date: Date, weekStart: Date) {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 7);
  return date >= weekStart && date < end;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromRecord(createdAt: number, dataHora: string) {
  if (createdAt) return new Date(createdAt);
  const parsed = parsePtBrDate(dataHora);
  return parsed;
}

function parsePtBrDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s*(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, day, month, year, hour = "0", minute = "0"] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

async function saveProfileData(form: HTMLFormElement) {
  const currentServices = getServices();
  if (!currentServices || !target?.uid) return;

  const idade = Number((form.querySelector<HTMLInputElement>('[data-student-input="idade"]')?.value ?? "").trim());
  const alturaCm = Number((form.querySelector<HTMLInputElement>('[data-student-input="altura"]')?.value ?? "").trim());

  if (!idade || idade < 10 || idade > 100 || !alturaCm || alturaCm < 100 || alturaCm > 250) {
    window.alert("Preencha idade e altura válidas.");
    return;
  }

  await updateDoc(doc(currentServices.db, "users", target.uid), { idade, alturaCm });
  window.alert("Dados do aluno salvos.");
}

async function saveCardioGoal(form: HTMLFormElement) {
  const currentServices = getServices();
  if (!currentServices || !target?.uid) return;

  const value = Number((form.querySelector<HTMLInputElement>('[data-student-input="cardio-goal"]')?.value ?? "").trim());
  if (!value || value < 0) {
    window.alert("Informe uma meta válida em minutos.");
    return;
  }

  await updateDoc(doc(currentServices.db, "users", target.uid), {
    cardioMetaSemanalMin: value,
    metaSemanalCardioMin: value
  });
  cardioGoalDraft = String(value);
  window.alert("Meta semanal de cardio salva.");
}

async function markNotificationsRead() {
  const currentServices = getServices();
  if (!currentServices || !target?.uid) return;

  const unread = notifications.filter((item) => !item.read);
  if (!unread.length) {
    window.alert("Não há atualizações pendentes.");
    return;
  }

  await Promise.all(unread.map((item) => updateDoc(doc(currentServices.db, "users", target!.uid, "notifications", item.id), { read: true })));
}

function handleSubmit(event: SubmitEvent) {
  const form = event.target as HTMLFormElement | null;
  if (!form) return;

  if (form.matches('[data-student-form="profile"]')) {
    event.preventDefault();
    event.stopPropagation();
    void saveProfileData(form);
  }

  if (form.matches('[data-student-form="cardio-goal"]')) {
    event.preventDefault();
    event.stopPropagation();
    void saveCardioGoal(form);
  }
}

function handleInput(event: Event) {
  const input = event.target as HTMLInputElement | null;
  if (!input?.matches('[data-student-input="cardio-goal"]')) return;
  cardioGoalDraft = input.value;
}

function handleClick(event: MouseEvent) {
  const targetElement = event.target as Element | null;
  const actionElement = targetElement?.closest<HTMLElement>('[data-student-action]');
  if (!actionElement) return;

  const action = actionElement.getAttribute("data-student-action");
  if (action === "open-menu") {
    event.preventDefault();
    event.stopPropagation();
    document.querySelector<HTMLButtonElement>(".mobile-menu")?.click();
  }

  if (action === "mark-notifications") {
    event.preventDefault();
    event.stopPropagation();
    void markNotificationsRead();
  }
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

function bootStudentProfileDashboard() {
  injectStyles();
  attachAuth();

  if (!listenersAttached) {
    listenersAttached = true;
    document.addEventListener("submit", handleSubmit, true);
    document.addEventListener("input", handleInput, true);
    document.addEventListener("click", handleClick, true);
    window.addEventListener("storage", () => {
      syncTargetSubscriptions();
      scheduleRender();
    });
  }

  if (!observerAttached && document.body) {
    observerAttached = true;
    new MutationObserver(() => scheduleRender()).observe(document.body, { childList: true, subtree: true });
  }

  scheduleRender();
}

bootStudentProfileDashboard();

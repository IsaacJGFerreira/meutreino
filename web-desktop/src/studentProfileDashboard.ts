export {};

import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query, updateDoc, type DocumentData } from "firebase/firestore";
import { saveCardioGoal as persistCardioGoal } from "./firebaseApi";
import { initFirebase, readInitialConfig, type FirebaseServices } from "./firebase";

const STYLE_ID = "meutreino-student-profile-dashboard";
const ROOT_ID = "meutreino-student-profile-dashboard-root";
const CARDIO_GOAL_ROOT_ID = "meutreino-cardio-goal-root";
const DASHBOARD_CLASS = "student-profile-dashboard-active";
const WORKSPACE_CLASS = "student-profile-dashboard-mode";
const SELECTED_STUDENT_KEY = "meutreino.selectedStudent";
const DEFAULT_CARDIO_GOAL = 180;

type Role = "ALUNO" | "TREINADOR" | "ADMIN";

type StudentProfileState = {
  uid: string;
  name: string;
  email: string;
  role: Role;
  approved: boolean;
  active: boolean;
  idade?: number;
  alturaCm?: number;
  pesoKg?: number;
  createdAt?: number;
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
let targetRootGoal = 0;
let targetRootGoalUpdatedAt = 0;
let targetConfigGoal = 0;
let targetConfigGoalUpdatedAt = 0;
let records: WorkoutRecordState[] = [];
let cardio: CardioRecordState[] = [];
let notifications: NotificationState[] = [];
let profileUnsubscribe: (() => void) | null = null;
let targetProfileUnsubscribe: (() => void) | null = null;
let targetGoalUnsubscribe: (() => void) | null = null;
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

function readMillis(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object") return undefined;

  const candidate = value as { toMillis?: () => number; seconds?: number };
  if (typeof candidate.toMillis === "function") return candidate.toMillis();
  if (typeof candidate.seconds === "number") return candidate.seconds * 1000;
  return undefined;
}

function profileFromDoc(uid: string, data: DocumentData | undefined, fallbackEmail = ""): StudentProfileState {
  const rawGoal = cardioGoalFromData(data) || DEFAULT_CARDIO_GOAL;

  return {
    uid,
    name: String(data?.name ?? fallbackEmail ?? "Aluno"),
    email: String(data?.email ?? fallbackEmail ?? ""),
    role: normalizeRole(data?.role),
    approved: Boolean(data?.approved ?? data?.active ?? false),
    active: Boolean(data?.active ?? data?.approved ?? true),
    idade: typeof data?.idade === "number" ? data.idade : undefined,
    alturaCm: typeof data?.alturaCm === "number" ? data.alturaCm : undefined,
    pesoKg: typeof data?.pesoKg === "number" ? data.pesoKg : undefined,
    createdAt: readMillis(data?.createdAt),
    cardioMetaSemanalMin: Number.isFinite(rawGoal) && rawGoal > 0 ? rawGoal : DEFAULT_CARDIO_GOAL
  };
}

function cardioGoalFromData(data: DocumentData | undefined) {
  const value = Number(data?.cardioMetaSemanalMin ?? data?.metaSemanalCardioMin ?? data?.cardioGoalMin ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function latestCardioGoal(rootGoal = targetRootGoal) {
  const configIsLatest = targetConfigGoal > 0 && (
    (targetConfigGoalUpdatedAt === 0 && targetRootGoalUpdatedAt === 0) ||
    targetConfigGoalUpdatedAt >= targetRootGoalUpdatedAt ||
    targetRootGoalUpdatedAt === 0
  );
  return configIsLatest ? targetConfigGoal : rootGoal || targetConfigGoal || DEFAULT_CARDIO_GOAL;
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
  targetGoalUnsubscribe?.();
  recordsUnsubscribe?.();
  cardioUnsubscribe?.();
  notificationsUnsubscribe?.();
  targetProfileUnsubscribe = null;
  targetGoalUnsubscribe = null;
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
    targetRootGoal = 0;
    targetRootGoalUpdatedAt = 0;
    targetConfigGoal = 0;
    targetConfigGoalUpdatedAt = 0;
    records = [];
    cardio = [];
    notifications = [];
    scheduleRender();
    return;
  }

  if (subscribedTargetUid === nextTarget.uid && targetGoalUnsubscribe && recordsUnsubscribe && cardioUnsubscribe) {
    return;
  }

  stopTargetSubscriptions();
  subscribedTargetUid = nextTarget.uid;
  targetRootGoal = 0;
  targetRootGoalUpdatedAt = 0;
  targetConfigGoal = 0;
  targetConfigGoalUpdatedAt = 0;
  cardioGoalDraft = "";
  lastCardioGoalHtml = "";
  records = [];
  cardio = [];
  notifications = [];

  targetProfileUnsubscribe = onSnapshot(
    doc(currentServices.db, "users", nextTarget.uid),
    (snap) => {
      const nextProfile = profileFromDoc(nextTarget.uid, snap.data(), nextTarget.email ?? "");
      targetRootGoal = cardioGoalFromData(snap.data());
      targetRootGoalUpdatedAt = readMillis(snap.data()?.updatedAt) ?? 0;
      targetProfile = { ...nextProfile, cardioMetaSemanalMin: latestCardioGoal(targetRootGoal) };
      if (!cardioGoalDraft) cardioGoalDraft = String(targetProfile.cardioMetaSemanalMin);
      scheduleRender();
    },
    () => {
      targetProfile = currentProfile?.role === "ALUNO" ? currentProfile : null;
      scheduleRender();
    }
  );

  targetGoalUnsubscribe = onSnapshot(
    doc(currentServices.db, "users", nextTarget.uid, "cardio_meta", "current"),
    (snap) => {
      const nextGoal = cardioGoalFromData(snap.data());
      targetConfigGoal = nextGoal;
      targetConfigGoalUpdatedAt = readMillis(snap.data()?.updatedAt) ?? 0;
      if (targetProfile) {
        const resolvedGoal = latestCardioGoal(targetRootGoal || targetProfile.cardioMetaSemanalMin);
        targetProfile = { ...targetProfile, cardioMetaSemanalMin: resolvedGoal };
        if (!cardioGoalDraft) cardioGoalDraft = String(resolvedGoal);
      }
      scheduleRender();
    },
    () => scheduleRender()
  );

  recordsUnsubscribe = onSnapshot(
    collection(currentServices.db, "users", nextTarget.uid, "treino_registros"),
    (snap) => {
      records = snap.docs
        .map((item) => workoutFromDoc(item.id, item.data()))
        .sort((a, b) => recordSortValue(b) - recordSortValue(a));
      scheduleRender();
    },
    () => scheduleRender()
  );

  cardioUnsubscribe = onSnapshot(
    collection(currentServices.db, "users", nextTarget.uid, "cardio"),
    (snap) => {
      cardio = snap.docs
        .map((item) => cardioFromDoc(item.id, item.data()))
        .sort((a, b) => recordSortValue(b) - recordSortValue(a));
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
    targetRootGoal = 0;
    targetRootGoalUpdatedAt = 0;
    targetConfigGoal = 0;
    targetConfigGoalUpdatedAt = 0;
    cardioGoalDraft = "";
    lastCardioGoalHtml = "";
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

    }

    /* Perfil neon do aluno: composição fiel ao painel de referência. */
    .student-profile-dashboard {
      width: min(100%, 1320px);
      gap: 14px;
    }

    .student-profile-dashboard svg {
      width: 1em;
      height: 1em;
      display: block;
    }

    .student-profile-dashboard .student-profile-hero {
      min-height: 74px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      overflow: hidden;
      position: relative;
      padding: 0 8px 2px;
    }

    .student-profile-dashboard .student-profile-title {
      margin: 0;
      color: #f3f8f6 !important;
      font-size: clamp(34px, 4vw, 48px);
      line-height: 1;
      letter-spacing: -0.055em;
      font-weight: 900;
    }

    .student-profile-title-line {
      width: 78px;
      height: 4px;
      display: block;
      margin-top: 10px;
      border-radius: 999px;
      background: #4ef0ae;
      box-shadow: 0 0 18px rgba(78, 240, 174, 0.72);
    }

    .student-profile-dashboard .student-profile-pulse {
      width: min(330px, 32vw);
      height: 84px;
      flex: 0 0 auto;
      color: #20d996;
      opacity: 0.88;
      filter: drop-shadow(0 0 10px rgba(78, 240, 174, 0.34));
    }

    .student-profile-main-grid,
    .student-profile-bottom-grid {
      display: grid;
      grid-template-columns: minmax(0, 0.94fr) minmax(0, 1.16fr);
      gap: 14px;
    }

    .student-profile-bottom-grid {
      grid-template-columns: minmax(0, 0.96fr) minmax(0, 1.04fr);
    }

    .student-profile-dashboard .student-dashboard-card {
      min-width: 0;
      padding: 22px 24px;
      color: #f3f8f6 !important;
      border: 1px solid rgba(118, 164, 153, 0.27) !important;
      border-radius: 17px !important;
      background:
        radial-gradient(circle at 10% 0%, rgba(78, 240, 174, 0.04), transparent 34%),
        linear-gradient(145deg, rgba(12, 31, 33, 0.96), rgba(5, 19, 22, 0.98)) !important;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02), 0 18px 44px rgba(0, 0, 0, 0.16) !important;
    }

    .student-profile-dashboard .student-card-head,
    .student-profile-dashboard .student-section-heading {
      display: flex;
      align-items: center;
      gap: 13px;
      margin: 0 0 18px;
    }

    .student-profile-dashboard .student-card-head h3,
    .student-profile-dashboard .student-section-heading h3 {
      margin: 0;
      color: #f3f8f6 !important;
      font-size: 18px;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }

    .student-profile-dashboard .student-card-icon,
    .student-profile-dashboard .student-section-heading > span {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      color: #42eba9 !important;
      border: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      font-size: 25px;
    }

    .student-profile-dashboard .student-card-icon svg,
    .student-profile-dashboard .student-section-heading > span svg {
      width: 25px;
      height: 25px;
    }

    .student-profile-dashboard .student-profile-lines {
      display: grid;
      margin: 0;
    }

    .student-profile-dashboard .student-profile-lines > div {
      min-height: 40px;
      display: grid;
      grid-template-columns: 24px 108px minmax(0, 1fr);
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid rgba(118, 164, 153, 0.18) !important;
    }

    .student-profile-dashboard .student-profile-lines > div:last-child {
      border-bottom: 0 !important;
    }

    .student-profile-dashboard .student-profile-lines dt,
    .student-profile-dashboard .student-profile-lines dd {
      margin: 0;
    }

    .student-profile-dashboard .student-profile-lines dt {
      color: #a4b8b2 !important;
      font-size: 13px;
      font-weight: 600;
    }

    .student-profile-dashboard .student-profile-lines dd {
      min-width: 0;
      color: #f3f8f6 !important;
      font-size: 14px;
      font-weight: 750;
      overflow-wrap: anywhere;
    }

    .student-profile-dashboard .student-line-icon {
      display: grid;
      place-items: center;
      color: #40e8a6 !important;
      font-size: 17px;
    }

    .student-profile-dashboard .student-line-icon svg {
      width: 17px;
      height: 17px;
    }

    .student-profile-dashboard .student-status-pill {
      min-height: 24px;
      display: inline-flex;
      align-items: center;
      padding: 3px 12px;
      color: #4ef0ae !important;
      border: 0 !important;
      border-radius: 999px !important;
      background: rgba(20, 174, 118, 0.16) !important;
      font-size: 13px;
      line-height: 1.2;
      font-weight: 800;
    }

    .student-profile-dashboard .student-data-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 18px 20px;
      align-items: end;
    }

    .student-profile-dashboard .student-field {
      display: grid;
      gap: 7px;
      color: #a4b8b2 !important;
      font-size: 12px;
      font-weight: 650;
    }

    .student-profile-dashboard .student-input-wrap {
      min-height: 58px;
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr);
      align-items: center;
      gap: 10px;
      padding: 0 14px;
      color: #f3f8f6 !important;
      border: 1px solid rgba(118, 164, 153, 0.32) !important;
      border-radius: 11px !important;
      background: rgba(5, 19, 22, 0.8) !important;
    }

    .student-profile-dashboard .student-input-wrap > span {
      display: grid;
      place-items: center;
      color: #42e9a8 !important;
      font-size: 18px;
    }

    .student-profile-dashboard .student-input-wrap > span svg {
      width: 18px;
      height: 18px;
    }

    .student-profile-dashboard .student-input-wrap input {
      width: 100%;
      min-width: 0;
      height: 54px;
      padding: 0;
      color: #f3f8f6 !important;
      border: 0 !important;
      outline: 0;
      background: transparent !important;
      box-shadow: none !important;
      font-size: 15px;
      font-weight: 750;
    }

    .student-profile-dashboard .student-input-wrap:focus-within {
      border-color: #4ef0ae !important;
      box-shadow: 0 0 0 3px rgba(78, 240, 174, 0.09) !important;
    }

    .student-profile-dashboard .student-save-button {
      width: 100%;
      min-height: 46px;
      grid-column: 1;
      padding: 0 22px;
      color: #04110d !important;
      border: 1px solid rgba(179, 255, 220, 0.55) !important;
      border-radius: 10px !important;
      background: linear-gradient(100deg, #2de09e, #58efb4) !important;
      box-shadow: 0 8px 24px rgba(35, 197, 137, 0.2) !important;
      font-size: 15px;
      font-weight: 900;
    }

    .student-profile-dashboard .student-quick-panel {
      padding: 15px 22px 18px;
    }

    .student-profile-dashboard .student-quick-panel .student-section-heading {
      margin-bottom: 11px;
    }

    .student-profile-dashboard .student-quick-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }

    .student-profile-dashboard .student-quick-card {
      min-width: 0;
      min-height: 96px;
      display: grid;
      grid-template-columns: 54px minmax(0, 1fr);
      align-items: center;
      gap: 14px;
      padding: 15px 17px;
      border: 1px solid rgba(118, 164, 153, 0.2);
      border-radius: 13px;
      background: linear-gradient(145deg, rgba(15, 39, 41, 0.74), rgba(5, 20, 22, 0.82));
    }

    .student-profile-dashboard .student-goal-quick {
      grid-template-columns: 54px minmax(0, 1fr) 54px;
    }

    .student-profile-dashboard .student-summary-icon {
      width: 54px;
      height: 54px;
      display: grid;
      place-items: center;
      color: #42e9a8 !important;
      border: 1px solid rgba(78, 240, 174, 0.48) !important;
      border-radius: 13px;
      background: rgba(78, 240, 174, 0.07) !important;
      box-shadow: inset 0 0 18px rgba(78, 240, 174, 0.05) !important;
      font-size: 26px;
    }

    .student-profile-dashboard .student-summary-icon svg {
      width: 26px;
      height: 26px;
    }

    .student-profile-dashboard .student-quick-card small,
    .student-profile-dashboard .student-quick-card strong,
    .student-profile-dashboard .student-quick-card div > span {
      display: block;
    }

    .student-profile-dashboard .student-quick-card small {
      margin-bottom: 4px;
      color: #91a6a0 !important;
      font-size: 11px;
    }

    .student-profile-dashboard .student-quick-card strong {
      color: #f3f8f6 !important;
      font-size: 16px;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }

    .student-profile-dashboard .student-quick-card div > span {
      margin-top: 3px;
      color: #b4c7c2 !important;
      font-size: 12px;
    }

    .student-profile-dashboard .student-goal-ring {
      width: 50px;
      height: 50px;
      display: grid;
      place-items: center;
      position: relative;
      border-radius: 999px;
      background: conic-gradient(#4ef0ae var(--student-goal-percent), rgba(78, 240, 174, 0.12) 0);
      box-shadow: 0 0 14px rgba(78, 240, 174, 0.18);
    }

    .student-profile-dashboard .student-goal-ring::before {
      content: "";
      position: absolute;
      inset: 5px;
      border-radius: inherit;
      background: #092023;
    }

    .student-profile-dashboard .student-goal-ring b {
      position: relative;
      z-index: 1;
      color: #4ef0ae;
      font-size: 11px;
    }

    .student-profile-dashboard .student-week-card,
    .student-profile-dashboard .student-updates-card {
      min-height: 278px;
    }

    .student-profile-dashboard .student-section-heading > div {
      min-width: 0;
    }

    .student-profile-dashboard .student-section-heading p {
      margin: 4px 0 0;
      color: #91a6a0 !important;
      font-size: 12px;
    }

    .student-profile-dashboard .student-week-scroll {
      overflow-x: auto;
      scrollbar-width: thin;
    }

    .student-profile-dashboard .student-week-matrix {
      min-width: 540px;
      display: grid;
      grid-template-columns: 72px repeat(7, minmax(48px, 1fr));
      align-items: center;
      gap: 15px 7px;
      padding: 7px 0 8px;
    }

    .student-profile-dashboard .student-week-matrix > strong,
    .student-profile-dashboard .student-week-matrix > b {
      color: #b8cbc6 !important;
      font-size: 11px;
      font-weight: 700;
      text-align: center;
    }

    .student-profile-dashboard .student-week-matrix > b {
      color: #a4b8b2 !important;
      text-align: left;
    }

    .student-profile-dashboard .student-week-cell {
      width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      justify-self: center;
      color: transparent;
      border: 1px solid rgba(126, 168, 158, 0.42);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.02);
      font-size: 14px;
      font-weight: 900;
    }

    .student-profile-dashboard .student-week-cell.is-done {
      color: #04110d;
      border-color: #4ef0ae;
      background: #4ef0ae;
      box-shadow: 0 0 15px rgba(78, 240, 174, 0.45);
    }

    .student-profile-dashboard .student-week-legend {
      display: flex;
      justify-content: center;
      gap: 22px;
      margin-top: 16px;
      color: #91a6a0;
      font-size: 11px;
    }

    .student-profile-dashboard .student-week-legend span {
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }

    .student-profile-dashboard .student-week-legend i {
      width: 14px;
      height: 14px;
      display: inline-grid;
      place-items: center;
      border: 1px solid rgba(126, 168, 158, 0.52);
      border-radius: 999px;
      font-size: 9px;
      font-style: normal;
    }

    .student-profile-dashboard .student-week-legend i.is-done {
      color: #04110d;
      border-color: #4ef0ae;
      background: #4ef0ae;
    }

    .student-profile-dashboard .student-updates-card {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0;
    }

    .student-profile-dashboard .student-updates-list {
      display: grid;
      gap: 0;
      overflow: hidden;
      border: 1px solid rgba(118, 164, 153, 0.2);
      border-radius: 11px;
    }

    .student-profile-dashboard .student-update-row {
      min-height: 46px;
      display: grid;
      grid-template-columns: 10px minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border-bottom: 1px solid rgba(118, 164, 153, 0.17);
    }

    .student-profile-dashboard .student-update-row:last-child {
      border-bottom: 0;
    }

    .student-profile-dashboard .student-update-row > i {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: #4ef0ae;
      box-shadow: 0 0 9px rgba(78, 240, 174, 0.6);
    }

    .student-profile-dashboard .student-update-row > i.is-read {
      background: #506661;
      box-shadow: none;
    }

    .student-profile-dashboard .student-update-row > span {
      min-width: 0;
      color: #e7f0ed !important;
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .student-profile-dashboard .student-update-row time {
      color: #8ba09a;
      font-size: 10px;
      white-space: nowrap;
    }

    .student-profile-dashboard .student-update-empty {
      padding: 18px;
      color: #91a6a0;
      font-size: 13px;
    }

    .student-profile-dashboard .student-mark-read-button {
      min-height: 42px;
      align-self: flex-end;
      margin-top: auto;
      padding: 0 24px;
      color: #4ef0ae !important;
      border: 1px solid rgba(78, 240, 174, 0.52) !important;
      border-radius: 11px !important;
      background: rgba(78, 240, 174, 0.04) !important;
      box-shadow: none !important;
      font-size: 13px;
      font-weight: 850;
    }

    .student-profile-dashboard .student-mark-read-button:disabled {
      opacity: 0.45;
      cursor: default;
    }

    @media (max-width: 1060px) {
      .student-profile-main-grid,
      .student-profile-bottom-grid {
        grid-template-columns: 1fr;
      }

      .student-profile-dashboard .student-quick-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .student-profile-dashboard .student-profile-hero {
        min-height: 58px;
        padding-inline: 2px;
      }

      .student-profile-dashboard .student-profile-title {
        font-size: 34px;
      }

      .student-profile-dashboard .student-profile-pulse {
        display: none;
      }

      .student-profile-dashboard .student-dashboard-card {
        padding: 18px 16px;
        border-radius: 15px !important;
      }

      .student-profile-dashboard .student-data-form,
      .student-profile-dashboard .student-quick-grid {
        grid-template-columns: 1fr;
      }

      .student-profile-dashboard .student-save-button {
        grid-column: auto;
      }

      .student-profile-dashboard .student-profile-lines > div {
        grid-template-columns: 20px 72px minmax(0, 1fr);
        gap: 8px;
      }

      .student-profile-dashboard .student-profile-lines dt,
      .student-profile-dashboard .student-profile-lines dd {
        font-size: 12px;
      }

      .student-profile-dashboard .student-update-row {
        grid-template-columns: 9px minmax(0, 1fr);
      }

      .student-profile-dashboard .student-update-row time {
        grid-column: 2;
      }

      .student-profile-dashboard .student-mark-read-button {
        width: 100%;
        margin-top: 14px;
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

function renderProfileIcon(name: "user" | "mail" | "tag" | "shield" | "star" | "calendar" | "settings" | "dumbbell" | "heart" | "target" | "bolt" | "bell") {
  const paths = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    tag: '<path d="M20 13 13 20 4 11V4h7Z"/><circle cx="8.5" cy="8.5" r="1.5"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2l-5-4.9 6.9-1Z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8 9-12h-7Z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>'
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}

function profileSinceYear(profile: StudentProfileState) {
  const authCreatedAt = authUser?.metadata.creationTime ? Date.parse(authUser.metadata.creationTime) : 0;
  const value = profile.createdAt || authCreatedAt || Date.now();
  return new Date(value).getFullYear();
}

function formatNotificationDate(value: number) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value)).replace(",", " •");
}

function renderProfileHtml(profile: StudentProfileState) {
  const latestRecord = records.find((item) => item.completo) ?? records[0];
  const latestCardio = cardio[0];
  const week = buildWeeklyProgress(profile.cardioMetaSemanalMin);
  const unreadCount = notifications.filter((item) => !item.read).length;
  const latestMessages = notifications.slice(0, 3);
  const cardioPercent = week.cardioGoal > 0 ? Math.min(100, Math.round((week.cardioMinutes / week.cardioGoal) * 100)) : 0;

  return `
    <div class="student-profile-dashboard">
      <header class="student-profile-hero">
        <div>
          <h1 class="student-profile-title">${escapeHtml(profile.name)}</h1>
          <span class="student-profile-title-line" aria-hidden="true"></span>
        </div>
        <svg class="student-profile-pulse" aria-hidden="true" viewBox="0 0 320 84" fill="none"><path d="M1 50h168l12-2 9-36 15 66 13-42 13 29 17-46 14 31h57" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="319" cy="50" r="5" fill="currentColor"/></svg>
      </header>

      <div class="student-profile-main-grid">
        <article class="student-dashboard-card">
          <div class="student-card-head"><span class="student-card-icon">${renderProfileIcon("user")}</span><h3>Perfil do aluno</h3></div>
          <dl class="student-profile-lines">
            <div><span class="student-line-icon">${renderProfileIcon("user")}</span><dt>Nome</dt><dd>${escapeHtml(profile.name)}</dd></div>
            <div><span class="student-line-icon">${renderProfileIcon("mail")}</span><dt>Email</dt><dd>${escapeHtml(profile.email || authUser?.email || "-")}</dd></div>
            <div><span class="student-line-icon">${renderProfileIcon("tag")}</span><dt>Tipo</dt><dd>${escapeHtml(profile.role)}</dd></div>
            <div><span class="student-line-icon">${renderProfileIcon("shield")}</span><dt>Status</dt><dd><span class="student-status-pill">✓ ${profile.approved ? "Liberado" : "Aguardando"}</span></dd></div>
            <div><span class="student-line-icon">${renderProfileIcon("star")}</span><dt>Plano</dt><dd><span class="student-status-pill">★ ${profile.active ? "Ativo" : "Inativo"}</span></dd></div>
            <div><span class="student-line-icon">${renderProfileIcon("calendar")}</span><dt>Desde</dt><dd>${profileSinceYear(profile)}</dd></div>
          </dl>
        </article>

        <article class="student-dashboard-card">
          <div class="student-card-head"><span class="student-card-icon">${renderProfileIcon("settings")}</span><h3>Dados do aluno</h3></div>
          <form class="student-data-form" data-student-form="profile">
            <label class="student-field">Idade
              <span class="student-input-wrap"><span>${renderProfileIcon("calendar")}</span><input aria-label="Idade" type="number" inputmode="numeric" data-student-input="idade" value="${escapeAttribute(profile.idade?.toString() ?? "")}" /></span>
            </label>
            <label class="student-field">Altura (cm)
              <span class="student-input-wrap"><span>${renderProfileIcon("user")}</span><input aria-label="Altura em centímetros" type="number" inputmode="decimal" data-student-input="altura" value="${escapeAttribute(profile.alturaCm?.toString() ?? "")}" /></span>
            </label>
            <label class="student-field">Peso (kg)
              <span class="student-input-wrap"><span>${renderProfileIcon("tag")}</span><input aria-label="Peso em quilogramas" type="number" inputmode="decimal" step="0.1" data-student-input="peso" value="${escapeAttribute(profile.pesoKg?.toString() ?? "")}" /></span>
            </label>
            <button class="student-save-button" type="submit">✓ Salvar</button>
          </form>
        </article>
      </div>

      <article class="student-dashboard-card student-quick-panel">
        <div class="student-section-heading"><span>${renderProfileIcon("bolt")}</span><h3>Resumo rápido</h3></div>
        <div class="student-quick-grid">
          <div class="student-quick-card"><span class="student-summary-icon">${renderProfileIcon("dumbbell")}</span><div><small>Último treino</small><strong>${latestRecord ? escapeHtml(latestRecord.nomeTreino) : "Sem registros"}</strong><span>${latestRecord ? escapeHtml(latestRecord.dataHora) : ""}</span></div></div>
          <div class="student-quick-card"><span class="student-summary-icon">${renderProfileIcon("heart")}</span><div><small>Último cardio</small><strong>${latestCardio ? escapeHtml(latestCardio.atividade) : "Sem registros"}</strong><span>${latestCardio ? `${latestCardio.tempoMin} min` : ""}</span></div></div>
          <div class="student-quick-card"><span class="student-summary-icon">${renderProfileIcon("calendar")}</span><div><small>Treinos na semana</small><strong>${week.trainingSessionsCompleted} / ${week.trainingSessionsTotal}</strong><span>concluídos</span></div></div>
          <div class="student-quick-card student-goal-quick"><span class="student-summary-icon">${renderProfileIcon("target")}</span><div><small>Meta semanal</small><strong>${week.cardioMinutes} / ${week.cardioGoal} min</strong><span>de cardio</span></div><span class="student-goal-ring" style="--student-goal-percent:${cardioPercent}%"><b>${cardioPercent >= 100 ? "✓" : `${cardioPercent}%`}</b></span></div>
        </div>
      </article>

      <div class="student-profile-bottom-grid">
        <article class="student-dashboard-card student-week-card">
          <div class="student-section-heading"><span>${renderProfileIcon("calendar")}</span><h3>Progresso da semana</h3></div>
          <div class="student-week-scroll" role="region" aria-label="Progresso semanal" tabindex="0">
            <div class="student-week-matrix">
              <span></span>${week.days.map((day) => `<strong>${day.label}</strong>`).join("")}
              <b>Treino</b>${week.days.map((day) => renderWeekCell(day.treino, "Treino")).join("")}
              <b>Cardio</b>${week.days.map((day) => renderWeekCell(day.cardio, "Cardio")).join("")}
            </div>
          </div>
          <div class="student-week-legend"><span><i class="is-done">✓</i> Concluído</span><span><i></i> Não concluído</span></div>
        </article>

        <article class="student-dashboard-card student-updates-card">
          <div class="student-section-heading"><span>${renderProfileIcon("bell")}</span><div><h3>Atualizações do treinador${unreadCount ? ` (${unreadCount})` : ""}</h3><p>Fique por dentro das orientações e feedbacks do seu treinador.</p></div></div>
          <div class="student-updates-list">
            ${latestMessages.length ? latestMessages.map((item) => `<div class="student-update-row"><i class="${item.read ? "is-read" : ""}"></i><span>${escapeHtml(item.message)}</span><time>${formatNotificationDate(item.createdAt)}</time></div>`).join("") : '<div class="student-update-empty">Sem novas atualizações</div>'}
          </div>
          <button class="student-mark-read-button" type="button" data-student-action="mark-notifications" ${unreadCount ? "" : "disabled"}>✓ Marcar como lidas</button>
        </article>
      </div>
    </div>
  `;
}

function renderWeekCell(done: boolean, label: string) {
  return `<span class="student-week-cell ${done ? "is-done" : ""}" aria-label="${label}: ${done ? "concluído" : "não concluído"}">${done ? "✓" : ""}</span>`;
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
            <input type="number" min="1" step="5" data-student-input="cardio-goal" value="${escapeAttribute(cardioGoalDraft || String(goal))}" />
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
  let trainingSessionsTotal = 0;
  let trainingSessionsCompleted = 0;

  records.forEach((item) => {
    const date = dateFromRecord(item.createdAt, item.dataHora);
    if (!date || !isInCurrentWeek(date, weekStart)) return;
    trainingSessionsTotal += 1;
    if (item.completo) {
      trainingSessionsCompleted += 1;
      const day = dayMap.get(dateKey(date));
      if (day) day.treino = true;
    }
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
    trainingSessionsTotal,
    trainingSessionsCompleted,
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

function recordSortValue(record: WorkoutRecordState | CardioRecordState) {
  if (Number.isFinite(record.createdAt) && record.createdAt > 0) return record.createdAt;
  return parsePtBrDate(record.dataHora)?.getTime() ?? 0;
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
  const pesoKg = Number((form.querySelector<HTMLInputElement>('[data-student-input="peso"]')?.value ?? "").trim().replace(",", "."));

  if (!idade || idade < 10 || idade > 100 || !alturaCm || alturaCm < 100 || alturaCm > 250 || !pesoKg || pesoKg <= 0 || pesoKg > 500) {
    window.alert("Preencha idade, altura e peso válidos.");
    return;
  }

  await updateDoc(doc(currentServices.db, "users", target.uid), { idade, alturaCm, pesoKg });
  window.alert("Dados do aluno salvos.");
}

async function saveCardioGoal(form: HTMLFormElement) {
  const currentServices = getServices();
  if (!currentServices || !target?.uid) return;

  const value = Number((form.querySelector<HTMLInputElement>('[data-student-input="cardio-goal"]')?.value ?? "").trim().replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) {
    window.alert("Informe uma meta válida em minutos.");
    return;
  }

  const normalizedValue = Math.round(value);
  await persistCardioGoal(currentServices, target.uid, normalizedValue, authUser?.uid);
  cardioGoalDraft = String(normalizedValue);
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

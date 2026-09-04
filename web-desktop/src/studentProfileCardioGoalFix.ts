export {};

import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { saveCardioGoal as persistCardioGoal } from "./firebaseApi";
import { initFirebase, readInitialConfig, type FirebaseServices } from "./firebase";

const SELECTED_STUDENT_KEY = "meutreino.selectedStudent";
const GOAL_COLLECTION = "cardio_meta";
const GOAL_DOC_ID = "current";

let services: FirebaseServices | null = null;
let authUser: User | null = null;
let booted = false;
let authAttached = false;
let goalUnsubscribe: Unsubscribe | null = null;
let subscribedTargetUid: string | null = null;
let lastKnownGoal: number | null = null;

type SelectedStudent = {
  uid?: string;
  name?: string;
  email?: string;
};

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

function attachAuth() {
  const currentServices = getServices();
  if (!currentServices || authAttached) return;

  authAttached = true;
  onAuthStateChanged(currentServices.auth, (user) => {
    authUser = user;
    syncGoalListener();
  });
}

function readSelectedStudentUid() {
  const raw = localStorage.getItem(SELECTED_STUDENT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SelectedStudent;
    return parsed?.uid ? String(parsed.uid) : null;
  } catch {
    return null;
  }
}

function getTargetUidForCardioGoal() {
  return readSelectedStudentUid() || authUser?.uid || null;
}

function goalDocRef(targetUid: string) {
  const currentServices = getServices();
  if (!currentServices) return null;
  return doc(currentServices.db, "users", targetUid, GOAL_COLLECTION, GOAL_DOC_ID);
}

function setSavingState(form: HTMLFormElement, saving: boolean) {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const input = form.querySelector<HTMLInputElement>('[data-student-input="cardio-goal"]');

  if (button) {
    button.disabled = saving;
    button.textContent = saving ? "Salvando..." : "✓ Salvar meta";
  }

  if (input) input.disabled = saving;
}

function parseDoneFromText(text: string) {
  return Number(text.match(/^(\d+)\s+de\s+/)?.[1] ?? 0);
}

function updateVisibleGoal(value: number) {
  lastKnownGoal = value;

  document.querySelectorAll<HTMLElement>(".student-cardio-goal-panel header span, .student-cardio-goal-compact header span").forEach((item) => {
    const currentText = item.textContent || "";
    const done = parseDoneFromText(currentText);
    const percent = value > 0 ? Math.min(100, Math.round((done / value) * 100)) : 0;
    const container = item.closest<HTMLElement>(".student-cardio-goal-panel, .student-cardio-goal-compact");
    const footer = container?.querySelector<HTMLElement>(".student-cardio-goal-footer");
    const line = container?.querySelector<HTMLElement>(".student-progress-line");

    item.textContent = `${done} de ${value} min`;
    line?.style.setProperty("--student-progress", `${percent}%`);
    if (footer) {
      const remaining = Math.max(value - done, 0);
      footer.textContent = remaining > 0 ? `Faltam ${remaining} min` : "Meta concluída";
    }
  });

  document.querySelectorAll<HTMLInputElement>('[data-student-input="cardio-goal"]').forEach((input) => {
    if (document.activeElement !== input) input.value = String(value);
  });
}

function syncGoalListener() {
  const targetUid = getTargetUidForCardioGoal();
  const ref = targetUid ? goalDocRef(targetUid) : null;

  if (!targetUid || !ref) {
    goalUnsubscribe?.();
    goalUnsubscribe = null;
    subscribedTargetUid = null;
    return;
  }

  if (subscribedTargetUid === targetUid && goalUnsubscribe) return;

  goalUnsubscribe?.();
  subscribedTargetUid = targetUid;

  goalUnsubscribe = onSnapshot(ref, (snap) => {
    const value = Number(snap.data()?.cardioMetaSemanalMin ?? snap.data()?.metaSemanalCardioMin ?? snap.data()?.cardioGoalMin ?? 0);
    if (Number.isFinite(value) && value > 0) {
      updateVisibleGoal(value);
    } else if (lastKnownGoal) {
      updateVisibleGoal(lastKnownGoal);
    }
  });
}

async function saveCardioGoal(form: HTMLFormElement) {
  const targetUid = getTargetUidForCardioGoal();
  const currentServices = getServices();
  const input = form.querySelector<HTMLInputElement>('[data-student-input="cardio-goal"]');
  const rawValue = input?.value.trim() ?? "";
  const value = Number(rawValue.replace(",", "."));

  if (!currentServices || !targetUid) {
    window.alert("Selecione um aluno antes de salvar a meta de cardio.");
    return;
  }

  if (!Number.isFinite(value) || value <= 0) {
    window.alert("Informe uma meta semanal válida em minutos.");
    return;
  }

  setSavingState(form, true);

  try {
    await persistCardioGoal(currentServices, targetUid, value, authUser?.uid);

    if (input) input.value = String(value);
    updateVisibleGoal(value);
    syncGoalListener();
    window.alert("Meta semanal de cardio salva para o aluno.");
  } catch (error) {
    window.alert(`Erro ao salvar meta de cardio: ${(error as Error).message}`);
  } finally {
    setSavingState(form, false);
  }
}

function handleSubmit(event: SubmitEvent) {
  const form = event.target as HTMLFormElement | null;
  if (!form?.matches('[data-student-form="cardio-goal"]')) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  void saveCardioGoal(form);
}

function handleRefresh() {
  syncGoalListener();
  if (lastKnownGoal) updateVisibleGoal(lastKnownGoal);
}

function bootCardioGoalFix() {
  if (booted) return;
  booted = true;
  attachAuth();
  document.addEventListener("submit", handleSubmit, true);
  window.addEventListener("storage", handleRefresh);
  new MutationObserver(handleRefresh).observe(document.body, { childList: true, subtree: true });
}

bootCardioGoalFix();

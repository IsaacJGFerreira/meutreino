export {};

import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { initFirebase, readInitialConfig, type FirebaseServices } from "./firebase";

const SELECTED_STUDENT_KEY = "meutreino.selectedStudent";

let services: FirebaseServices | null = null;
let authUser: User | null = null;
let booted = false;
let authAttached = false;

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

function setSavingState(form: HTMLFormElement, saving: boolean) {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const input = form.querySelector<HTMLInputElement>('[data-student-input="cardio-goal"]');

  if (button) {
    button.disabled = saving;
    button.textContent = saving ? "Salvando..." : "✓ Salvar meta";
  }

  if (input) input.disabled = saving;
}

function updateVisibleGoal(value: number) {
  document.querySelectorAll<HTMLElement>(".student-cardio-goal-panel header span, .student-cardio-goal-compact header span").forEach((item) => {
    const currentText = item.textContent || "";
    const done = currentText.match(/^(\d+)\s+de\s+/)?.[1] ?? "0";
    item.textContent = `${done} de ${value} min`;
  });
}

async function saveCardioGoal(form: HTMLFormElement) {
  const currentServices = getServices();
  const targetUid = getTargetUidForCardioGoal();
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
    await updateDoc(doc(currentServices.db, "users", targetUid), {
      cardioMetaSemanalMin: value,
      metaSemanalCardioMin: value,
      cardioGoalMin: value,
      updatedAt: Date.now()
    });

    if (input) input.value = String(value);
    updateVisibleGoal(value);
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

function bootCardioGoalFix() {
  if (booted) return;
  booted = true;
  attachAuth();
  document.addEventListener("submit", handleSubmit, true);
}

bootCardioGoalFix();

import { collection, doc, limit as limitDocs, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { formatDateTime, newId, parseNumber } from "./firebaseApi";
import { initFirebase, readInitialConfig, type FirebaseServices } from "./firebase";

const STYLE_ID = "meutreino-web-training-flow-style";
const START_CLASS = "web-training-start";
const CANCEL_CLASS = "web-training-cancel";
const FINISH_CLASS = "web-training-finish";
const STATUS_CLASS = "web-training-status";
const HISTORY_CLASS = "training-history-panel";

type ActiveWorkout = {
  id: string;
  name: string;
};

type TrainingRefs = {
  panel: HTMLElement;
  section: HTMLElement;
  select: HTMLSelectElement;
  actionRow: HTMLElement;
  startButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
  finishButton: HTMLButtonElement;
  workoutId: string;
  workoutName: string;
};

let services: FirebaseServices | null = null;
let activeUserId: string | null = null;
let activeWorkout: ActiveWorkout | null = null;
let authListenerAttached = false;
let documentListenersAttached = false;
let observerStarted = false;
let renderQueued = false;
let historyUnsubscribe: (() => void) | null = null;
let historyUid: string | null = null;
let historyList: HTMLElement | null = null;

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
    activeUserId = user?.uid ?? null;
    if (!activeUserId) {
      activeWorkout = null;
      stopHistoryListener();
    }
    scheduleEnhancement();
  });
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .screen.training-flow-screen {
      grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
      align-items: start;
    }

    .screen.training-flow-screen > .panel:first-child {
      grid-column: 1;
    }

    .${HISTORY_CLASS} {
      grid-column: 2;
      grid-row: 1;
      position: sticky;
      top: 24px;
    }

    .${STATUS_CLASS} {
      margin: 0 0 14px;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--green-soft);
      color: var(--green-dark);
      font-weight: 800;
    }

    .${STATUS_CLASS}.blocked {
      background: #fff8e1;
      color: #7a5b00;
    }

    .${START_CLASS}[hidden] {
      display: none !important;
    }

    .exercise-stack.training-locked input:disabled {
      background: #eef1ef;
      color: var(--muted);
    }

    .exercise-stack.training-locked .exercise-box {
      opacity: 0.72;
    }

    .exercise-stack.training-active .exercise-box {
      border-color: rgba(90, 171, 138, 0.55);
      box-shadow: 0 0 0 3px rgba(90, 171, 138, 0.1);
    }

    .training-history-list {
      display: grid;
      gap: 10px;
      max-height: 68vh;
      overflow: auto;
      padding-right: 4px;
    }

    .training-history-item {
      display: grid;
      gap: 4px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fbfdfc;
      padding: 12px;
    }

    .training-history-item strong,
    .training-history-item span,
    .training-history-item small {
      display: block;
    }

    .training-history-item small {
      color: var(--muted);
      font-weight: 700;
    }

    .training-history-badge {
      width: fit-content;
      border-radius: 8px;
      padding: 4px 8px;
      background: var(--green-soft);
      color: var(--green-dark);
      font-size: 12px;
      font-weight: 900;
    }

    .training-flow-toast {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 9999;
      max-width: min(360px, calc(100vw - 44px));
      border-radius: 8px;
      padding: 12px 14px;
      background: var(--text);
      color: white;
      box-shadow: var(--shadow);
      font-weight: 800;
    }

    @media (max-width: 980px) {
      .screen.training-flow-screen {
        grid-template-columns: 1fr;
      }

      .${HISTORY_CLASS} {
        grid-column: 1;
        grid-row: auto;
        position: static;
      }
    }
  `;
  document.head.appendChild(style);
}

function scheduleEnhancement() {
  if (renderQueued) return;
  renderQueued = true;
  window.requestAnimationFrame(() => {
    renderQueued = false;
    attachAuthListener();
    enhanceTrainingScreen();
  });
}

function normalize(text: string | null | undefined) {
  return (text ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function findTrainingPanel() {
  const panels = Array.from(document.querySelectorAll<HTMLElement>("section.screen > article.panel"));
  return (
    panels.find((panel) => {
      const title = normalize(panel.querySelector(".section-title h3")?.textContent);
      return title === "treino" && Boolean(panel.querySelector(".exercise-stack")) && Boolean(panel.querySelector("select"));
    }) ?? null
  );
}

function findActionButton(actionRow: HTMLElement, label: string) {
  return Array.from(actionRow.querySelectorAll<HTMLButtonElement>("button")).find((button) => normalize(button.textContent).includes(label));
}

function getTrainingRefs(): TrainingRefs | null {
  const panel = findTrainingPanel();
  const section = panel?.closest<HTMLElement>("section.screen") ?? null;
  const select = panel?.querySelector<HTMLSelectElement>("select") ?? null;
  const actionRow = panel?.querySelector<HTMLElement>(".action-row") ?? null;
  if (!panel || !section || !select || !actionRow) return null;

  const cancelButton = findActionButton(actionRow, "cancelar treino");
  const finishButton = findActionButton(actionRow, "finalizar treino");
  if (!cancelButton || !finishButton) return null;

  let startButton = actionRow.querySelector<HTMLButtonElement>(`.${START_CLASS}`);
  if (!startButton) {
    startButton = document.createElement("button");
    startButton.className = `primary-btn ${START_CLASS}`;
    startButton.type = "button";
    startButton.textContent = "Começar treino";
    actionRow.prepend(startButton);
  }

  cancelButton.classList.add(CANCEL_CLASS);
  finishButton.classList.add(FINISH_CLASS);

  const workoutId = select.value;
  const workoutName = select.selectedOptions[0]?.textContent?.trim() || "Treino";

  return { panel, section, select, actionRow, startButton, cancelButton, finishButton, workoutId, workoutName };
}

function ensureStatus(refs: TrainingRefs) {
  let status = refs.panel.querySelector<HTMLElement>(`.${STATUS_CLASS}`);
  if (!status) {
    status = document.createElement("p");
    status.className = STATUS_CLASS;
    refs.panel.querySelector(".panel-heading")?.after(status);
  }

  const isCurrentActive = activeWorkout?.id === refs.workoutId;
  const hasAnotherActive = Boolean(activeWorkout && !isCurrentActive);

  if (isCurrentActive) {
    status.textContent = `Treino ${activeWorkout?.name} em andamento. Preencha as séries e finalize para salvar no Firebase.`;
    status.classList.remove("blocked");
  } else if (hasAnotherActive) {
    status.textContent = `Finalize ou cancele ${activeWorkout?.name} antes de iniciar outro treino.`;
    status.classList.add("blocked");
  } else {
    status.textContent = "Clique em Começar treino para liberar os campos. Cancelar descarta os dados sem salvar.";
    status.classList.remove("blocked");
  }
}

function ensureHistoryPanel(section: HTMLElement) {
  section.classList.add("training-flow-screen");

  let panel = section.querySelector<HTMLElement>(`.${HISTORY_CLASS}`);
  if (!panel) {
    panel = document.createElement("aside");
    panel.className = `panel ${HISTORY_CLASS}`;
    panel.innerHTML = `
      <div class="section-title"><span aria-hidden="true">◷</span><h3>Histórico anterior</h3></div>
      <div class="training-history-list"><p class="empty-state">Carregando histórico...</p></div>
    `;
    section.appendChild(panel);
  }

  historyList = panel.querySelector<HTMLElement>(".training-history-list");
  ensureHistoryListener();
}

function ensureHistoryListener() {
  const currentServices = getServices();
  const uid = activeUserId ?? currentServices?.auth.currentUser?.uid ?? null;
  if (!currentServices || !uid || !historyList) return;
  if (historyUid === uid && historyUnsubscribe) return;

  stopHistoryListener();
  historyUid = uid;
  historyUnsubscribe = onSnapshot(
    query(collection(currentServices.db, "users", uid, "treino_registros"), orderBy("createdAt", "desc"), limitDocs(10)),
    (snap) => {
      const records = snap.docs.map((item) => {
        const data = item.data() as Record<string, unknown>;
        const exercicios = Array.isArray(data.exercicios) ? data.exercicios : [];
        return {
          nomeTreino: String(data.nomeTreino ?? "Treino"),
          dataHora: String(data.dataHora ?? "-"),
          completo: Boolean(data.completo ?? false),
          exercicios: exercicios.length
        };
      });
      renderHistory(records);
    },
    () => {
      if (historyList) historyList.innerHTML = `<p class="empty-state">Não foi possível carregar o histórico.</p>`;
    }
  );
}

function stopHistoryListener() {
  historyUnsubscribe?.();
  historyUnsubscribe = null;
  historyUid = null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderHistory(records: Array<{ nomeTreino: string; dataHora: string; completo: boolean; exercicios: number }>) {
  if (!historyList) return;
  if (!records.length) {
    historyList.innerHTML = `<p class="empty-state">Nenhum treino finalizado ainda.</p>`;
    return;
  }

  historyList.innerHTML = records
    .map(
      (record) => `
        <div class="training-history-item">
          <strong>${escapeHtml(record.nomeTreino)}</strong>
          <small>${escapeHtml(record.dataHora)}</small>
          <span>${record.exercicios} exercício(s)</span>
          <span class="training-history-badge">${record.completo ? "Completo" : "Incompleto"}</span>
        </div>
      `
    )
    .join("");
}

function applyTrainingState(refs: TrainingRefs) {
  const isCurrentActive = activeWorkout?.id === refs.workoutId;
  const hasActiveWorkout = Boolean(activeWorkout);
  const exerciseStack = refs.panel.querySelector<HTMLElement>(".exercise-stack");

  refs.select.disabled = hasActiveWorkout;
  refs.select.title = hasActiveWorkout ? `Finalize ou cancele ${activeWorkout?.name} para escolher outro treino.` : "";

  refs.startButton.hidden = isCurrentActive;
  refs.startButton.disabled = hasActiveWorkout;
  refs.startButton.textContent = hasActiveWorkout ? "Outro treino ativo" : "Começar treino";

  refs.cancelButton.disabled = !isCurrentActive;
  refs.finishButton.disabled = !isCurrentActive;

  refs.panel.querySelectorAll<HTMLInputElement>(".series-row input").forEach((input) => {
    input.disabled = !isCurrentActive;
    input.title = isCurrentActive ? "" : "Comece o treino para preencher as séries.";
  });

  exerciseStack?.classList.toggle("training-active", isCurrentActive);
  exerciseStack?.classList.toggle("training-locked", !isCurrentActive);

  ensureStatus(refs);
}

function enhanceTrainingScreen() {
  const refs = getTrainingRefs();
  if (!refs) return;

  ensureHistoryPanel(refs.section);
  applyTrainingState(refs);
}

function preventOriginalAction(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function showToast(message: string) {
  document.querySelector(".training-flow-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "training-flow-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function clearWorkoutInputs(panel: HTMLElement) {
  panel.querySelectorAll<HTMLInputElement>(".series-row input").forEach((input) => setNativeInputValue(input, ""));
}

function readWorkoutFromDom(refs: TrainingRefs) {
  let complete = true;
  const exercicios = Array.from(refs.panel.querySelectorAll<HTMLElement>(".exercise-box")).map((box) => {
    const nomeExercicio = box.querySelector("strong")?.textContent?.trim() || "Exercício";
    const series = Array.from(box.querySelectorAll<HTMLElement>(".series-row"))
      .map((row, index) => {
        const inputs = row.querySelectorAll<HTMLInputElement>("input");
        const kgRaw = inputs[0]?.value.trim() ?? "";
        const repsRaw = inputs[1]?.value.trim() ?? "";

        if (!kgRaw || !repsRaw) {
          complete = false;
          return null;
        }

        return {
          serieNumero: index + 1,
          kg: parseNumber(kgRaw),
          reps: Math.round(parseNumber(repsRaw))
        };
      })
      .filter((serie): serie is { serieNumero: number; kg: number; reps: number } => Boolean(serie));

    return { nomeExercicio, series };
  });

  return { complete, exercicios };
}

async function finishWorkout(refs: TrainingRefs) {
  const currentServices = getServices();
  const uid = activeUserId ?? currentServices?.auth.currentUser?.uid ?? null;
  if (!currentServices || !uid) {
    showToast("Não foi possível identificar o aluno logado.");
    return;
  }

  if (activeWorkout?.id !== refs.workoutId) {
    showToast("Comece este treino antes de finalizar.");
    return;
  }

  const { complete, exercicios } = readWorkoutFromDom(refs);
  if (!complete) {
    const shouldSave = window.confirm("Ainda faltam séries para preencher. Deseja salvar mesmo assim como incompleto?");
    if (!shouldSave) return;
  }

  const createdAt = Date.now();
  const previousText = refs.finishButton.textContent;
  refs.finishButton.disabled = true;
  refs.finishButton.textContent = "Salvando...";

  try {
    await setDoc(doc(currentServices.db, "users", uid, "treino_registros", createdAt.toString()), {
      idLocal: newId("web-"),
      dataHora: formatDateTime(new Date(createdAt)),
      nomeTreino: refs.workoutName,
      completo: complete,
      createdAt,
      exercicios
    });

    clearWorkoutInputs(refs.panel);
    activeWorkout = null;
    scheduleEnhancement();
    showToast(complete ? "Treino finalizado e salvo no Firebase." : "Treino incompleto salvo no Firebase.");
  } catch (error) {
    showToast((error as Error).message || "Erro ao salvar treino.");
  } finally {
    refs.finishButton.textContent = previousText;
    refs.finishButton.disabled = false;
  }
}

function handleDocumentClick(event: MouseEvent) {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button");
  if (!button) return;

  if (button.classList.contains(START_CLASS)) {
    preventOriginalAction(event);
    const refs = getTrainingRefs();
    if (!refs) return;

    if (activeWorkout) {
      showToast(`Finalize ou cancele ${activeWorkout.name} antes de começar outro treino.`);
      return;
    }

    activeWorkout = { id: refs.workoutId, name: refs.workoutName };
    scheduleEnhancement();
    showToast(`Treino ${refs.workoutName} iniciado.`);
    return;
  }

  if (button.classList.contains(CANCEL_CLASS)) {
    preventOriginalAction(event);
    const refs = getTrainingRefs();
    if (!refs) return;

    if (activeWorkout?.id !== refs.workoutId) {
      showToast("Nenhum treino ativo para cancelar.");
      return;
    }

    const shouldCancel = window.confirm("Cancelar este treino? Nada será salvo e os dados preenchidos serão descartados.");
    if (!shouldCancel) return;

    clearWorkoutInputs(refs.panel);
    activeWorkout = null;
    scheduleEnhancement();
    showToast("Treino cancelado sem salvar.");
    return;
  }

  if (button.classList.contains(FINISH_CLASS)) {
    preventOriginalAction(event);
    const refs = getTrainingRefs();
    if (!refs) return;
    void finishWorkout(refs);
  }
}

function handleDocumentChange(event: Event) {
  const target = event.target as Element | null;
  if (target?.matches("section.screen article.panel select")) scheduleEnhancement();
}

function bootTrainingFlowPatch() {
  injectStyles();
  attachAuthListener();

  if (!documentListenersAttached) {
    documentListenersAttached = true;
    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("change", handleDocumentChange, true);
  }

  if (!observerStarted && document.body) {
    observerStarted = true;
    new MutationObserver(scheduleEnhancement).observe(document.body, { childList: true, subtree: true });
  }

  scheduleEnhancement();
}

bootTrainingFlowPatch();

const DESKTOP_TRAINING_STYLE_ID = "meutreino-desktop-training-layout";
const ENHANCED_ATTR = "data-desktop-training-enhanced";

function injectDesktopTrainingStyles() {
  if (document.getElementById(DESKTOP_TRAINING_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = DESKTOP_TRAINING_STYLE_ID;
  style.textContent = `
    @media (min-width: 860px) {
      .workspace {
        padding-top: 18px;
      }

      .topbar {
        min-height: 54px;
        margin-bottom: 8px;
      }

      .topbar h2 {
        font-size: 26px;
      }

      .mobile-training-app.desktop-training-layout {
        width: min(100%, 1220px);
        margin: 0;
        padding: 0 0 36px;
        color: #18282f;
      }

      .desktop-training-layout .mobile-training-title {
        margin: 8px 0 18px;
        text-align: left;
        color: var(--green-dark, #34785f);
        font-size: clamp(30px, 3.2vw, 38px);
        letter-spacing: -0.04em;
      }

      .desktop-training-summary {
        display: flex;
        align-items: stretch;
        gap: 18px;
        flex-wrap: wrap;
        margin: 0 0 24px;
        padding-bottom: 22px;
        border-bottom: 1px solid rgba(52, 120, 95, 0.18);
      }

      .desktop-summary-card {
        min-width: 178px;
        min-height: 82px;
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: 14px;
        padding: 16px 18px;
        border: 1px solid rgba(90, 171, 138, 0.12);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.82);
        box-shadow: 0 14px 26px rgba(41, 71, 61, 0.06);
      }

      .desktop-summary-icon,
      .desktop-workout-icon,
      .desktop-rail-icon {
        width: 48px;
        height: 48px;
        display: grid;
        place-items: center;
        border-radius: 14px;
        color: var(--green-dark, #34785f);
        background: rgba(90, 171, 138, 0.16);
      }

      .desktop-summary-card strong,
      .desktop-rail-card strong {
        display: block;
        color: #10212a;
        font-size: 16px;
        line-height: 1.15;
      }

      .desktop-summary-card span,
      .desktop-rail-card small {
        display: block;
        margin-top: 3px;
        color: #61747a;
        font-size: 14px;
        font-weight: 600;
      }

      .desktop-training-content {
        display: grid;
        grid-template-columns: minmax(640px, 1fr) minmax(280px, 340px);
        gap: 24px;
        align-items: start;
      }

      .desktop-training-layout .mobile-training-list {
        display: grid;
        gap: 16px;
        width: 100%;
        max-width: 900px;
      }

      .desktop-training-layout .mobile-workout-card {
        border: 1px solid rgba(52, 120, 95, 0.12);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 14px 26px rgba(41, 71, 61, 0.11);
        overflow: hidden;
      }

      .desktop-training-layout .mobile-workout-card.is-active {
        border-color: rgba(52, 120, 95, 0.22);
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 18px 34px rgba(41, 71, 61, 0.13);
      }

      .desktop-training-layout .mobile-workout-card.is-locked {
        opacity: 0.76;
      }

      .desktop-training-layout .mobile-workout-header {
        min-height: 94px;
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 18px;
        padding: 22px 26px;
        color: #10212a;
      }

      .desktop-training-layout .mobile-workout-header:hover {
        background: rgba(90, 171, 138, 0.05);
      }

      .desktop-workout-copy strong {
        display: block;
        font-size: 22px;
        line-height: 1.1;
        letter-spacing: -0.03em;
      }

      .desktop-workout-copy small {
        display: block;
        margin-top: 8px;
        color: #64777d;
        font-size: 15px;
        font-weight: 650;
      }

      .desktop-training-layout .mobile-chevron {
        color: var(--green-dark, #34785f);
        font-size: 21px;
        font-weight: 900;
      }

      .desktop-training-layout .mobile-workout-body {
        gap: 16px;
        padding: 0 24px 24px;
      }

      .desktop-training-layout .mobile-exercise-card {
        border: 1px solid rgba(90, 171, 138, 0.26);
        border-radius: 14px;
        background: rgba(252, 255, 253, 0.96);
        box-shadow: none;
      }

      .desktop-training-layout .mobile-exercise-card.status-progress {
        background: #fffaf0;
      }

      .desktop-training-layout .mobile-exercise-card.status-pending {
        background: #fff7f7;
      }

      .desktop-training-layout .mobile-exercise-header {
        padding: 24px 26px 12px;
        color: #10212a;
      }

      .desktop-training-layout .mobile-exercise-name {
        font-size: 21px;
        letter-spacing: -0.035em;
      }

      .desktop-training-layout .mobile-exercise-count {
        margin-top: 8px;
        color: #66777d;
        font-size: 15px;
      }

      .desktop-training-layout .mobile-exercise-meta {
        grid-template-columns: repeat(5, minmax(90px, 1fr));
        gap: 18px;
        padding: 14px 26px 22px;
        border-bottom: 1px solid rgba(52, 120, 95, 0.14);
      }

      .desktop-training-layout .mobile-exercise-meta dt {
        color: #18282f;
        font-size: 14px;
      }

      .desktop-training-layout .mobile-exercise-meta dd {
        color: #63747a;
        font-size: 15px;
      }

      .desktop-training-layout .mobile-series-table {
        gap: 0;
        padding: 24px 26px 0;
      }

      .desktop-training-layout .mobile-series-head,
      .desktop-training-layout .mobile-series-row {
        grid-template-columns: 100px minmax(180px, 1fr) minmax(150px, 230px) minmax(150px, 230px);
        gap: 18px;
      }

      .desktop-training-layout .mobile-series-head {
        padding-bottom: 14px;
        color: #18282f;
        font-size: 14px;
      }

      .desktop-training-layout .mobile-series-head span:last-child {
        grid-column: auto;
        text-align: left;
      }

      .desktop-training-layout .mobile-series-row {
        min-height: 72px;
        border-top: 1px solid rgba(52, 120, 95, 0.12);
        font-size: 16px;
      }

      .desktop-training-layout .mobile-previous {
        color: #63747a;
        font-size: 15px;
      }

      .desktop-training-layout .mobile-series-input {
        min-height: 52px;
        border: 1px solid #c9d8d2;
        border-radius: 10px;
        background: #fbfdfc;
        color: #25363b;
        padding: 12px 14px;
        text-align: left;
        font-size: 16px;
        font-weight: 650;
        box-shadow: none;
      }

      .desktop-training-layout .mobile-series-input:focus {
        border-color: var(--green-dark, #34785f);
        box-shadow: 0 0 0 3px rgba(90, 171, 138, 0.18);
      }

      .desktop-exercise-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 22px 26px 24px;
        border-top: 1px solid rgba(52, 120, 95, 0.12);
      }

      .desktop-btn-history,
      .desktop-btn-save-exercise,
      .desktop-rail-start {
        min-height: 52px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        border-radius: 10px;
        padding: 12px 18px;
        font-weight: 850;
      }

      .desktop-btn-history {
        color: #263a40;
        background: #fbfdfc;
        border: 1px solid #cfded8;
      }

      .desktop-btn-save-exercise,
      .desktop-rail-start {
        color: white;
        background: linear-gradient(135deg, #0f8f62, #1aa36f);
        box-shadow: 0 10px 20px rgba(26, 138, 94, 0.18);
      }

      .desktop-training-layout .mobile-action-stack {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        margin-top: 2px;
      }

      .desktop-training-layout .mobile-action-stack button {
        min-height: 50px;
        border-radius: 12px;
      }

      .desktop-training-rail {
        display: grid;
        gap: 18px;
        position: sticky;
        top: 18px;
      }

      .desktop-rail-card {
        border: 1px solid rgba(52, 120, 95, 0.12);
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.82);
        box-shadow: 0 14px 26px rgba(41, 71, 61, 0.08);
        padding: 20px;
      }

      .desktop-rail-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 18px;
      }

      .desktop-rail-card h3 {
        margin: 0;
        color: #10212a;
        font-size: 18px;
        letter-spacing: -0.02em;
      }

      .desktop-pill {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 8px 12px;
        border-radius: 8px;
        color: var(--green-dark, #34785f);
        background: rgba(90, 171, 138, 0.16);
        font-weight: 900;
      }

      .desktop-rail-start {
        width: 100%;
        margin-top: 16px;
      }

      .desktop-progress-value {
        margin: 4px 0 10px;
        color: var(--green-dark, #34785f);
        font-size: 34px;
        line-height: 1;
        font-weight: 900;
      }

      .desktop-progress-bar {
        height: 8px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(90, 171, 138, 0.18);
      }

      .desktop-progress-bar span {
        display: block;
        width: 75%;
        height: 100%;
        border-radius: inherit;
        background: var(--green-dark, #34785f);
      }

      .desktop-week-days {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 8px;
        margin-top: 16px;
        color: #60727a;
        font-size: 12px;
        text-align: center;
      }

      .desktop-week-days span::after {
        content: "";
        width: 22px;
        height: 22px;
        display: block;
        margin: 8px auto 0;
        border-radius: 999px;
        background: rgba(90, 171, 138, 0.14);
      }

      .desktop-week-days span.done::after {
        background: var(--green-dark, #34785f);
      }

      .desktop-workout-days {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 8px;
        color: #60727a;
        font-size: 14px;
        font-weight: 650;
      }
    }

    @media (max-width: 1179px) {
      .desktop-training-content {
        grid-template-columns: 1fr;
      }

      .desktop-training-rail {
        display: none;
      }
    }

    @media (max-width: 859px) {
      .desktop-training-summary,
      .desktop-training-rail,
      .desktop-exercise-actions {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function enhanceDesktopTrainingLayout() {
  const app = document.querySelector<HTMLElement>(".mobile-training-app");
  if (!app) return;

  app.classList.add("desktop-training-layout");
  ensureSummary(app);
  ensureContentGrid(app);
  enhanceWorkoutHeaders(app);
  enhanceSeriesHeaders(app);
  enhanceExerciseActions(app);
}

function ensureSummary(app: HTMLElement) {
  const title = app.querySelector<HTMLElement>(".mobile-training-title");
  if (!title) return;

  const workoutCount = app.querySelectorAll(".mobile-workout-card").length;
  const visibleExerciseCount = app.querySelectorAll(".mobile-exercise-card").length;
  const lastWorkout = app.querySelector(".mobile-workout-card.is-active .desktop-workout-copy strong, .mobile-workout-card.is-open .desktop-workout-copy strong, .mobile-workout-header span:first-child")?.textContent?.trim() || "—";

  let summary = app.querySelector<HTMLElement>(".desktop-training-summary");
  if (!summary) {
    summary = document.createElement("div");
    summary.className = "desktop-training-summary";
    title.insertAdjacentElement("afterend", summary);
  }

  summary.innerHTML = `
    <article class="desktop-summary-card">
      <span class="desktop-summary-icon" aria-hidden="true">▦</span>
      <div><strong>${workoutCount || 0} dias</strong><span>de treino</span></div>
    </article>
    <article class="desktop-summary-card">
      <span class="desktop-summary-icon" aria-hidden="true">⌁</span>
      <div><strong>${visibleExerciseCount || "—"} exercícios</strong><span>visíveis agora</span></div>
    </article>
    <article class="desktop-summary-card">
      <span class="desktop-summary-icon" aria-hidden="true">◷</span>
      <div><strong>Último treino</strong><span>${lastWorkout}</span></div>
    </article>
  `;
}

function ensureContentGrid(app: HTMLElement) {
  const list = app.querySelector<HTMLElement>(".mobile-training-list");
  if (!list) return;

  let content = app.querySelector<HTMLElement>(".desktop-training-content");
  if (!content) {
    content = document.createElement("div");
    content.className = "desktop-training-content";
    list.insertAdjacentElement("beforebegin", content);
    content.appendChild(list);
  }

  let rail = content.querySelector<HTMLElement>(".desktop-training-rail");
  if (!rail) {
    rail = document.createElement("aside");
    rail.className = "desktop-training-rail";
    content.appendChild(rail);
  }

  rail.innerHTML = renderRail(app);
}

function renderRail(app: HTMLElement) {
  const cards = Array.from(app.querySelectorAll<HTMLElement>(".mobile-workout-card"));
  const active = cards.find((card) => card.classList.contains("is-active")) || cards[0];
  const activeName = active?.querySelector(".desktop-workout-copy strong, .mobile-workout-header span:first-child")?.textContent?.trim() || "Treino";
  const activeId = active?.getAttribute("data-workout-id") || "";
  const activeExercises = active?.querySelectorAll(".mobile-exercise-card").length || 0;
  const workoutNames = cards
    .slice(0, 5)
    .map((card) => card.querySelector(".desktop-workout-copy strong, .mobile-workout-header span:first-child")?.textContent?.trim())
    .filter(Boolean) as string[];

  return `
    <article class="desktop-rail-card">
      <div class="desktop-rail-head">
        <div><h3>Treino de hoje</h3></div>
        <span class="desktop-rail-icon" aria-hidden="true">▦</span>
      </div>
      <span class="desktop-pill">${escapeHtml(activeName)}</span>
      <small>${activeExercises || "—"} exercícios</small>
      <button class="desktop-rail-start" type="button" data-action="start-workout" data-workout-id="${escapeAttribute(activeId)}">Iniciar treino</button>
    </article>
    <article class="desktop-rail-card">
      <div class="desktop-rail-head"><h3>Progresso da semana</h3><span class="desktop-rail-icon" aria-hidden="true">⌁</span></div>
      <div class="desktop-progress-value">3/4</div>
      <small>treinos concluídos</small>
      <div class="desktop-progress-bar"><span></span></div>
      <div class="desktop-week-days"><span class="done">Seg</span><span class="done">Ter</span><span>Qua</span><span class="done">Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span></div>
    </article>
    <article class="desktop-rail-card">
      <div class="desktop-rail-head"><h3>${cards.length || 0} dias de treino</h3><span class="desktop-rail-icon" aria-hidden="true">▦</span></div>
      <ul class="desktop-workout-days">${workoutNames.map((name) => `<li>${escapeHtml(name)}</li>`).join("") || "<li>Nenhum treino cadastrado</li>"}</ul>
    </article>
    <article class="desktop-rail-card">
      <div class="desktop-rail-head"><h3>Último treino</h3><span class="desktop-rail-icon" aria-hidden="true">◷</span></div>
      <strong>${escapeHtml(activeName)}</strong>
      <small>Confira o histórico dentro dos exercícios</small>
    </article>
  `;
}

function enhanceWorkoutHeaders(app: HTMLElement) {
  app.querySelectorAll<HTMLButtonElement>(".mobile-workout-header").forEach((header) => {
    if (header.getAttribute(ENHANCED_ATTR) === "true") return;
    const workoutCard = header.closest<HTMLElement>(".mobile-workout-card");
    const name = header.querySelector("span:first-child")?.textContent?.trim() || "Treino";
    const exerciseNames = Array.from(workoutCard?.querySelectorAll(".mobile-exercise-name") ?? [])
      .slice(0, 3)
      .map((item) => item.textContent?.trim())
      .filter(Boolean);
    const exerciseCount = workoutCard?.querySelectorAll(".mobile-exercise-card").length || 0;
    const preview = exerciseCount
      ? `${exerciseCount} exercício${exerciseCount === 1 ? "" : "s"} • ${exerciseNames.join(", ")}${exerciseNames.length >= 3 ? "..." : ""}`
      : "Clique para ver os exercícios";
    const chevron = header.querySelector(".mobile-chevron")?.textContent || "˅";

    header.innerHTML = `
      <span class="desktop-workout-icon" aria-hidden="true">▦</span>
      <span class="desktop-workout-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(preview)}</small></span>
      <span class="mobile-chevron">${escapeHtml(chevron)}</span>
    `;
    header.setAttribute(ENHANCED_ATTR, "true");
  });
}

function enhanceSeriesHeaders(app: HTMLElement) {
  app.querySelectorAll<HTMLElement>(".mobile-series-head").forEach((head) => {
    if (head.getAttribute(ENHANCED_ATTR) === "true") return;
    head.innerHTML = "<span>Série</span><span>Anterior</span><span>Carga (kg)</span><span>Repetições</span>";
    head.setAttribute(ENHANCED_ATTR, "true");
  });
}

function enhanceExerciseActions(app: HTMLElement) {
  app.querySelectorAll<HTMLElement>(".mobile-exercise-card").forEach((card) => {
    if (card.querySelector(".desktop-exercise-actions")) return;
    const workoutCard = card.closest<HTMLElement>(".mobile-workout-card");
    const workoutId = workoutCard?.getAttribute("data-workout-id") || "";
    const exerciseName = card.querySelector(".mobile-exercise-name")?.textContent?.trim() || "exercício";
    const table = card.querySelector(".mobile-series-table");
    if (!table) return;

    const actions = document.createElement("div");
    actions.className = "desktop-exercise-actions";
    actions.innerHTML = `
      <button class="desktop-btn-history" type="button" data-desktop-history="${escapeAttribute(exerciseName)}">▤ Ver histórico</button>
      <button class="desktop-btn-save-exercise" type="button" data-action="save-workout" data-workout-id="${escapeAttribute(workoutId)}">✓ Salvar exercício</button>
    `;
    table.insertAdjacentElement("afterend", actions);
  });
}

function handleHistoryClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLElement>("[data-desktop-history]");
  if (!button) return;

  const exerciseName = button.getAttribute("data-desktop-history") || "este exercício";
  window.alert(`Histórico de ${exerciseName}\n\nUse a coluna “Anterior” nas séries para comparar carga e repetições anteriores.`);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function bootDesktopTrainingLayout() {
  injectDesktopTrainingStyles();
  enhanceDesktopTrainingLayout();
  document.addEventListener("click", handleHistoryClick);

  const observer = new MutationObserver(() => enhanceDesktopTrainingLayout());
  observer.observe(document.body, { childList: true, subtree: true });
}

bootDesktopTrainingLayout();

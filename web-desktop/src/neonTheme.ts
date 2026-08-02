export {};

const STYLE_ID = "meutreino-neon-performance-theme";

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    :root {
      color-scheme: dark;
      --green: #4ef0ae;
      --green-dark: #2bd493;
      --green-soft: rgba(78, 240, 174, 0.12);
      --background: #071315;
      --background-deep: #040b0d;
      --surface: #0e2022;
      --surface-elevated: #142a2c;
      --surface-glass: rgba(20, 42, 44, 0.78);
      --line: rgba(125, 170, 159, 0.22);
      --line-neon: rgba(78, 240, 174, 0.46);
      --text: #f3f8f6;
      --muted: #9eb2ad;
      --muted-2: #718681;
      --blue: #61d9f0;
      --yellow: #e8c564;
      --red: #ea7886;
      --shadow: 0 24px 60px rgba(0, 0, 0, 0.34);
      --neon-shadow: 0 0 0 1px rgba(78, 240, 174, 0.16), 0 18px 44px rgba(15, 133, 93, 0.18);
    }

    html,
    body,
    #root {
      min-height: 100%;
      background: #071315;
    }

    body {
      color: var(--text);
      background:
        radial-gradient(circle at 76% -10%, rgba(44, 201, 147, 0.18), transparent 34rem),
        radial-gradient(circle at 10% 96%, rgba(25, 104, 89, 0.15), transparent 32rem),
        linear-gradient(145deg, #040b0d 0%, #081719 55%, #061113 100%);
      background-attachment: fixed;
    }

    ::selection {
      color: #04100c;
      background: #4ef0ae;
    }

    * {
      scrollbar-color: rgba(78, 240, 174, 0.42) rgba(8, 24, 25, 0.6);
    }

    .app-layout {
      background: transparent !important;
    }

    .sidebar {
      border-right: 1px solid var(--line) !important;
      background:
        linear-gradient(180deg, rgba(19, 42, 43, 0.94), rgba(5, 16, 18, 0.96)) !important;
      box-shadow: 18px 0 54px rgba(0, 0, 0, 0.24);
      backdrop-filter: blur(22px);
    }

    .brand-mark {
      color: #06110d !important;
      background: linear-gradient(145deg, #69f6be, #30d899) !important;
      border: 1px solid rgba(171, 255, 221, 0.72);
      border-radius: 16px !important;
      box-shadow: 0 0 24px rgba(78, 240, 174, 0.34);
    }

    .brand-block h1,
    .sidebar .brand-block.compact h1 {
      color: var(--text) !important;
      letter-spacing: -0.04em;
    }

    .brand-block p,
    .sidebar .brand-block.compact p {
      color: var(--green) !important;
    }

    .nav-list {
      gap: 9px !important;
    }

    .nav-list button,
    .sidebar .nav-list button {
      min-height: 48px;
      color: var(--muted) !important;
      border: 1px solid transparent;
      border-radius: 16px !important;
      background: transparent !important;
      transition: 160ms ease;
    }

    .nav-list button:hover {
      color: var(--text) !important;
      border-color: var(--line);
      background: rgba(255, 255, 255, 0.035) !important;
    }

    .nav-list button.active,
    .sidebar .nav-list button.active {
      color: var(--green) !important;
      border-color: var(--line-neon) !important;
      background: linear-gradient(100deg, rgba(78, 240, 174, 0.15), rgba(78, 240, 174, 0.04)) !important;
      box-shadow: inset 0 0 22px rgba(78, 240, 174, 0.07), 0 8px 24px rgba(0, 0, 0, 0.18);
    }

    .nav-list button svg,
    .sidebar .nav-list button svg {
      color: currentColor !important;
    }

    .selected-student {
      color: var(--text) !important;
      border-color: var(--line-neon) !important;
      border-radius: 16px !important;
      background: rgba(78, 240, 174, 0.08) !important;
    }

    .sidebar-footer {
      border-color: var(--line) !important;
    }

    .icon-text,
    .ghost-btn {
      color: var(--muted) !important;
    }

    .danger,
    .ghost-btn.danger {
      color: var(--red) !important;
    }

    .workspace {
      min-width: 0;
      background: transparent;
    }

    .topbar {
      position: relative;
      border-bottom: 1px solid rgba(126, 168, 158, 0.1);
    }

    .topbar::after {
      content: "";
      width: 76px;
      height: 2px;
      position: absolute;
      left: 0;
      bottom: -1px;
      border-radius: 999px;
      background: linear-gradient(90deg, transparent, var(--green), transparent);
      box-shadow: 0 0 14px var(--green);
    }

    .topbar h2 {
      color: var(--text);
      letter-spacing: -0.045em;
    }

    .eyebrow,
    .neon-kicker {
      color: var(--green) !important;
      letter-spacing: 0.12em;
    }

    .mobile-menu {
      color: var(--green) !important;
      border: 1px solid var(--line-neon);
      background: rgba(20, 42, 44, 0.78) !important;
      box-shadow: 0 0 24px rgba(78, 240, 174, 0.12) !important;
    }

    .screen {
      position: relative;
      gap: 20px !important;
    }

    .panel,
    .metric,
    .student-dashboard-card,
    .student-summary-card,
    .student-week-card,
    .student-updates-card {
      color: var(--text) !important;
      border-color: var(--line) !important;
      border-radius: 22px !important;
      background:
        linear-gradient(145deg, rgba(22, 47, 48, 0.92), rgba(9, 25, 27, 0.96)) !important;
      box-shadow: var(--shadow) !important;
    }

    .profile-screen > .grid:first-child .panel:first-child,
    .cardio-screen > .panel:first-child,
    .progress-screen > .panel:first-child,
    .builder-screen > .grid > .panel:first-child {
      border-color: var(--line-neon) !important;
      background:
        radial-gradient(circle at 90% 0%, rgba(78, 240, 174, 0.16), transparent 42%),
        linear-gradient(135deg, rgba(24, 65, 57, 0.95), rgba(8, 25, 27, 0.98)) !important;
      box-shadow: var(--neon-shadow) !important;
    }

    .section-title {
      color: var(--green) !important;
    }

    .section-title h3,
    .panel h3,
    .panel strong,
    .metric strong,
    .profile-lines dd {
      color: var(--text) !important;
    }

    .metric {
      min-height: 118px !important;
      position: relative;
      overflow: hidden;
      padding: 20px !important;
    }

    .metric::before {
      content: "";
      width: 52px;
      height: 3px;
      border-radius: 999px;
      background: var(--green);
      box-shadow: 0 0 18px rgba(78, 240, 174, 0.62);
    }

    .metric span,
    .profile-lines dt,
    .empty-state,
    .list-row small,
    .form-helper,
    .exercise-box small {
      color: var(--muted) !important;
    }

    .list-row,
    .exercise-box,
    .progress-card {
      color: var(--text) !important;
      border-color: var(--line) !important;
      border-radius: 18px !important;
      background: rgba(17, 39, 41, 0.78) !important;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
    }

    .list-row:hover,
    .exercise-box:hover,
    .progress-card:hover {
      border-color: rgba(78, 240, 174, 0.42) !important;
      background: rgba(22, 49, 48, 0.92) !important;
    }

    .list-row.selected,
    .exercise-edit-heading {
      color: var(--text) !important;
      border-color: var(--green) !important;
      background: rgba(78, 240, 174, 0.1) !important;
    }

    .row-actions button,
    .list-row > button,
    .selected-student button {
      color: var(--green) !important;
      border: 1px solid var(--line);
      border-radius: 13px !important;
      background: rgba(78, 240, 174, 0.07) !important;
    }

    .primary-btn,
    .student-save-button,
    .student-mark-read-button,
    .student-goal-save {
      color: #05110d !important;
      border: 1px solid rgba(179, 255, 220, 0.55) !important;
      border-radius: 16px !important;
      background: linear-gradient(100deg, #3be2a2, #69f6be) !important;
      box-shadow: 0 12px 28px rgba(35, 197, 137, 0.2) !important;
    }

    .primary-btn:hover {
      filter: brightness(1.06);
      transform: translateY(-1px);
    }

    .secondary-btn {
      color: var(--green) !important;
      border: 1px solid var(--line-neon) !important;
      border-radius: 16px !important;
      background: rgba(78, 240, 174, 0.07) !important;
    }

    .field {
      color: var(--muted) !important;
    }

    .field input,
    .field select,
    select,
    .series-row input,
    .student-input-wrap input,
    .student-goal-form input {
      color: var(--text) !important;
      border-color: var(--line) !important;
      border-radius: 16px !important;
      background: rgba(11, 29, 31, 0.9) !important;
    }

    input::placeholder {
      color: var(--muted-2) !important;
    }

    .field input:focus,
    select:focus,
    .series-row input:focus,
    .student-input-wrap input:focus,
    .student-goal-form input:focus {
      border-color: var(--green) !important;
      box-shadow: 0 0 0 3px rgba(78, 240, 174, 0.12) !important;
    }

    .field input:disabled {
      color: var(--muted-2) !important;
      background: rgba(19, 34, 36, 0.78) !important;
    }

    .badge,
    .code-pill,
    .student-status-pill,
    .student-training-summary-pill {
      color: var(--green) !important;
      border-color: var(--line-neon) !important;
      border-radius: 999px !important;
      background: rgba(78, 240, 174, 0.09) !important;
    }

    .badge.muted {
      color: var(--muted) !important;
      border-color: var(--line) !important;
      background: rgba(255, 255, 255, 0.035) !important;
    }

    .photo-row img,
    .photo-empty {
      color: var(--muted) !important;
      border-color: var(--line-neon) !important;
      border-radius: 16px !important;
      background: rgba(12, 31, 33, 0.88) !important;
    }

    .auth-page {
      background:
        radial-gradient(circle at 50% 8%, rgba(78, 240, 174, 0.17), transparent 26rem),
        linear-gradient(145deg, #040b0d, #0a1e20) !important;
    }

    .auth-panel {
      color: var(--text) !important;
      border-color: var(--line-neon) !important;
      border-radius: 26px !important;
      background: rgba(12, 31, 33, 0.9) !important;
      box-shadow: var(--neon-shadow) !important;
      backdrop-filter: blur(20px);
    }

    .segmented {
      border-color: var(--line) !important;
      border-radius: 16px !important;
      background: rgba(2, 12, 14, 0.58) !important;
    }

    .segmented button {
      color: var(--muted) !important;
      border-radius: 12px !important;
    }

    .segmented button.active {
      color: var(--green) !important;
      background: rgba(78, 240, 174, 0.1) !important;
      box-shadow: inset 0 0 0 1px var(--line-neon) !important;
    }

    .toast,
    .mobile-training-toast,
    .performance-toast {
      color: var(--text) !important;
      border: 1px solid var(--line-neon) !important;
      border-radius: 16px !important;
      background: rgba(13, 34, 35, 0.96) !important;
      box-shadow: var(--shadow) !important;
      backdrop-filter: blur(18px);
    }

    .toast-error {
      border-color: rgba(234, 120, 134, 0.58) !important;
    }

    /* Treino: hero, cards de exercícios e controles de séries. */
    .mobile-training-app.desktop-training-layout,
    .mobile-training-app {
      color: var(--text) !important;
    }

    .neon-training-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin: 2px 0 18px;
    }

    .mobile-training-title,
    .desktop-training-layout .mobile-training-title {
      margin: 4px 0 0 !important;
      color: var(--text) !important;
      text-align: left !important;
      font-size: clamp(30px, 4vw, 42px) !important;
      letter-spacing: -0.05em !important;
    }

    .neon-heading-icon,
    .neon-training-hero-icon {
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      color: var(--green);
      border: 1px solid var(--line-neon);
      background: rgba(78, 240, 174, 0.08);
      box-shadow: inset 0 0 22px rgba(78, 240, 174, 0.09);
    }

    .neon-heading-icon {
      width: 52px;
      height: 52px;
      border-radius: 18px;
    }

    .neon-training-hero {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 16px;
      align-items: center;
      margin: 0 0 22px;
      padding: 22px;
      overflow: hidden;
      position: relative;
      border: 1px solid rgba(78, 240, 174, 0.5);
      border-radius: 26px;
      background:
        radial-gradient(circle at 84% 24%, rgba(78, 240, 174, 0.2), transparent 32%),
        linear-gradient(115deg, rgba(42, 125, 96, 0.86), rgba(10, 43, 40, 0.96) 54%, rgba(6, 22, 24, 0.98));
      box-shadow: var(--neon-shadow);
    }

    .neon-training-hero::after {
      content: "";
      width: 220px;
      height: 220px;
      position: absolute;
      right: -90px;
      top: -110px;
      border: 1px solid rgba(78, 240, 174, 0.18);
      border-radius: 50%;
      box-shadow: 0 0 70px rgba(78, 240, 174, 0.12);
      pointer-events: none;
    }

    .neon-training-hero-icon {
      width: 62px;
      height: 62px;
      border-radius: 22px;
      font-size: 22px;
    }

    .neon-training-hero-copy {
      min-width: 0;
    }

    .neon-training-hero-copy span,
    .neon-training-progress-copy span {
      display: block;
      color: #80f8c7;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.11em;
    }

    .neon-training-hero-copy strong {
      display: block;
      margin-top: 4px;
      color: white;
      font-size: 27px;
      letter-spacing: -0.04em;
    }

    .neon-training-hero-copy small {
      display: block;
      margin-top: 5px;
      color: #b9d5cd;
    }

    .neon-training-state {
      color: #07130f;
      border-radius: 999px;
      padding: 8px 11px;
      background: var(--green);
      font-size: 10px;
      font-weight: 950;
      letter-spacing: 0.06em;
    }

    .neon-training-progress-copy {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 4px;
    }

    .neon-training-progress-copy strong {
      color: white;
    }

    .neon-training-progress {
      grid-column: 1 / -1;
      height: 9px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(2, 15, 16, 0.56);
    }

    .neon-training-progress span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #33dfa0, #79f7c9);
      box-shadow: 0 0 16px rgba(78, 240, 174, 0.75);
      transition: width 220ms ease;
    }

    .mobile-training-list {
      gap: 15px !important;
    }

    .mobile-workout-card,
    .desktop-training-layout .mobile-workout-card {
      color: var(--text) !important;
      border-color: var(--line) !important;
      border-radius: 22px !important;
      background: linear-gradient(145deg, rgba(21, 44, 45, 0.96), rgba(8, 24, 26, 0.98)) !important;
      box-shadow: var(--shadow) !important;
    }

    .mobile-workout-card.is-active,
    .desktop-training-layout .mobile-workout-card.is-active {
      border-color: var(--green) !important;
      background: linear-gradient(135deg, rgba(22, 68, 56, 0.98), rgba(8, 30, 30, 0.98)) !important;
      box-shadow: var(--neon-shadow) !important;
    }

    .mobile-workout-header,
    .desktop-training-layout .mobile-workout-header {
      color: var(--text) !important;
      background: transparent !important;
    }

    .mobile-workout-header:hover,
    .desktop-training-layout .mobile-workout-header:hover {
      background: rgba(78, 240, 174, 0.045) !important;
    }

    .mobile-chevron {
      color: var(--green) !important;
    }

    .mobile-exercise-card,
    .desktop-training-layout .mobile-exercise-card,
    .desktop-training-layout .mobile-exercise-card.status-progress,
    .desktop-training-layout .mobile-exercise-card.status-pending {
      color: var(--text) !important;
      border-color: rgba(78, 240, 174, 0.38) !important;
      border-radius: 20px !important;
      background: rgba(17, 42, 42, 0.94) !important;
    }

    .mobile-exercise-card.status-done {
      border-color: var(--green) !important;
      background: rgba(21, 65, 52, 0.86) !important;
    }

    .mobile-exercise-card.status-progress {
      border-color: rgba(232, 197, 100, 0.64) !important;
      background: rgba(55, 46, 25, 0.8) !important;
    }

    .mobile-exercise-card.status-pending {
      border-color: rgba(234, 120, 134, 0.64) !important;
      background: rgba(58, 29, 34, 0.82) !important;
    }

    .mobile-exercise-header,
    .desktop-training-layout .mobile-exercise-header,
    .mobile-exercise-name,
    .mobile-exercise-meta dt,
    .mobile-series-head,
    .mobile-series-row {
      color: var(--text) !important;
    }

    .mobile-exercise-count,
    .mobile-exercise-meta dd,
    .mobile-previous {
      color: var(--muted) !important;
    }

    .mobile-exercise-meta,
    .desktop-exercise-actions,
    .mobile-series-row {
      border-color: var(--line) !important;
    }

    .mobile-series-input,
    .desktop-training-layout .mobile-series-input {
      color: var(--text) !important;
      border-color: var(--line) !important;
      border-radius: 15px !important;
      background: rgba(6, 22, 24, 0.9) !important;
    }

    .mobile-series-input:focus,
    .desktop-training-layout .mobile-series-input:focus {
      border-color: var(--green) !important;
      box-shadow: 0 0 0 3px rgba(78, 240, 174, 0.12) !important;
    }

    .mobile-series-input:disabled {
      color: var(--muted-2) !important;
      background: rgba(13, 29, 31, 0.76) !important;
    }

    .mobile-series-input.rep-ok {
      color: #e6f1ff !important;
      border-color: rgba(106, 168, 255, 0.82) !important;
      background: rgba(63, 126, 210, 0.16) !important;
      box-shadow: inset 0 0 0 1px rgba(106, 168, 255, 0.08) !important;
    }

    .mobile-series-input.rep-high {
      color: #ffe8b2 !important;
      border-color: rgba(245, 184, 76, 0.88) !important;
      background: rgba(245, 184, 76, 0.16) !important;
      box-shadow: inset 0 0 0 1px rgba(245, 184, 76, 0.1) !important;
    }

    .mobile-series-input.rep-low {
      color: #ffe0e4 !important;
      border-color: rgba(255, 107, 122, 0.9) !important;
      background: rgba(255, 82, 103, 0.17) !important;
      box-shadow: inset 0 0 0 1px rgba(255, 107, 122, 0.1) !important;
    }

    .mobile-btn-start,
    .mobile-btn-save,
    .desktop-btn-save-exercise,
    .desktop-rail-start {
      color: #06120e !important;
      border-radius: 16px !important;
      background: linear-gradient(100deg, #3be2a2, #69f6be) !important;
      box-shadow: 0 12px 28px rgba(35, 197, 137, 0.2) !important;
    }

    .mobile-btn-cancel,
    .desktop-btn-history {
      color: var(--muted) !important;
      border: 1px solid var(--line-neon) !important;
      border-radius: 16px !important;
      background: transparent !important;
    }

    .mobile-lock-note {
      color: var(--yellow) !important;
      border-color: rgba(232, 197, 100, 0.35) !important;
      background: rgba(232, 197, 100, 0.07) !important;
    }

    .mobile-history-card,
    .desktop-summary-card,
    .desktop-rail-card {
      color: var(--text) !important;
      border-color: var(--line) !important;
      border-radius: 20px !important;
      background: rgba(14, 32, 34, 0.84) !important;
      box-shadow: var(--shadow) !important;
    }

    .mobile-history-card h3,
    .desktop-summary-card strong,
    .desktop-rail-card strong,
    .desktop-rail-card h3 {
      color: var(--text) !important;
    }

    .mobile-history-item {
      color: var(--text) !important;
      border-color: var(--line) !important;
      border-radius: 15px !important;
      background: rgba(20, 42, 44, 0.68) !important;
    }

    .desktop-summary-icon,
    .desktop-workout-icon,
    .desktop-rail-icon,
    .desktop-pill {
      color: var(--green) !important;
      background: rgba(78, 240, 174, 0.09) !important;
    }

    .desktop-training-summary,
    .desktop-training-layout .mobile-exercise-meta,
    .desktop-training-layout .mobile-series-row {
      border-color: var(--line) !important;
    }

    .desktop-summary-card span,
    .desktop-rail-card small,
    .desktop-week-days,
    .desktop-workout-days {
      color: var(--muted) !important;
    }

    .desktop-progress-value {
      color: var(--green) !important;
    }

    .desktop-progress-bar,
    .desktop-week-days span::after {
      background: rgba(78, 240, 174, 0.1) !important;
    }

    .desktop-progress-bar span,
    .desktop-week-days span.done::after {
      background: var(--green) !important;
      box-shadow: 0 0 12px rgba(78, 240, 174, 0.5);
    }

    /* Perfil aprimorado injetado pelo painel do aluno. */
    .student-profile-dashboard,
    .student-profile-title,
    .student-card-head h3,
    .student-profile-lines dd,
    .student-summary-card strong,
    .student-week-title,
    .student-updates-list strong,
    .student-goal-form label {
      color: var(--text) !important;
    }

    .student-profile-title-icon,
    .student-card-icon,
    .student-summary-icon,
    .student-menu-button {
      color: var(--green) !important;
      border: 1px solid var(--line-neon) !important;
      background: rgba(78, 240, 174, 0.08) !important;
      box-shadow: none !important;
    }

    .student-avatar-large {
      color: var(--green) !important;
      border: 1px solid var(--line-neon);
      background: radial-gradient(circle, rgba(78, 240, 174, 0.18), rgba(10, 31, 32, 0.9)) !important;
    }

    .student-avatar-badge,
    .student-summary-arrow {
      color: #06120e !important;
      background: var(--green) !important;
      box-shadow: 0 0 16px rgba(78, 240, 174, 0.35) !important;
    }

    .student-profile-lines dt,
    .student-input-wrap span,
    .student-summary-card small,
    .student-updates-list small,
    .student-updates-list p,
    .student-day-label,
    .student-cardio-goal-footer {
      color: var(--muted) !important;
    }

    .student-profile-lines div,
    .student-week-day {
      border-color: var(--line) !important;
    }

    .student-cardio-goal-compact,
    .student-cardio-goal-panel {
      color: var(--text) !important;
      border-color: var(--line-neon) !important;
      border-radius: 18px !important;
      background: rgba(78, 240, 174, 0.07) !important;
    }

    .student-progress-line {
      background: rgba(78, 240, 174, 0.1) !important;
    }

    .student-progress-line span {
      background: linear-gradient(90deg, #35dfa0, #69f6be) !important;
      box-shadow: 0 0 12px rgba(78, 240, 174, 0.46);
    }

    .student-dot {
      border-color: var(--line) !important;
      background: rgba(255, 255, 255, 0.035) !important;
    }

    .student-dot.is-done {
      border-color: var(--green) !important;
      background: var(--green) !important;
      box-shadow: 0 0 12px rgba(78, 240, 174, 0.4);
    }

    /* Desempenho avançado criado pelo patch desktop. */
    .performance-mobile-app {
      color: var(--text) !important;
      background: transparent !important;
    }

    .performance-title {
      color: var(--text) !important;
      letter-spacing: -0.05em;
    }

    .performance-search,
    .performance-choice-input {
      color: var(--text) !important;
      border-color: var(--line) !important;
      border-radius: 16px !important;
      background: rgba(10, 28, 30, 0.9) !important;
    }

    .performance-graph-btn,
    .performance-dialog-actions .primary {
      color: #06120e !important;
      border-radius: 16px !important;
      background: linear-gradient(100deg, #3be2a2, #69f6be) !important;
      box-shadow: 0 12px 28px rgba(35, 197, 137, 0.2) !important;
    }

    .performance-card,
    .performance-dialog,
    .performance-detail-exercise,
    .performance-graph-summary {
      color: var(--text) !important;
      border-color: var(--line) !important;
      border-radius: 20px !important;
      background: linear-gradient(145deg, rgba(21, 44, 45, 0.96), rgba(8, 24, 26, 0.98)) !important;
      box-shadow: var(--shadow) !important;
    }

    .performance-card-title,
    .performance-dialog h2,
    .performance-dialog h3,
    .performance-detail-exercise strong,
    .performance-dialog-actions button,
    .performance-choice-input {
      color: var(--text) !important;
    }

    .performance-card-date,
    .performance-detail-exercise span,
    .performance-dialog p,
    .performance-dialog pre,
    .performance-empty {
      color: var(--muted) !important;
    }

    .performance-card-status {
      color: var(--green) !important;
      border: 1px solid var(--line-neon);
      border-radius: 999px;
      background: rgba(78, 240, 174, 0.08) !important;
    }

    .performance-card-status.incomplete {
      color: var(--yellow) !important;
      border-color: rgba(232, 197, 100, 0.36);
      background: rgba(232, 197, 100, 0.07) !important;
    }

    .performance-dialog-backdrop {
      background: rgba(0, 7, 8, 0.76) !important;
      backdrop-filter: blur(8px);
    }

    .performance-line-chart {
      border-color: var(--line) !important;
      background: rgba(6, 21, 23, 0.72) !important;
    }

    .recharts-default-tooltip {
      color: var(--text) !important;
      border-color: var(--line-neon) !important;
      border-radius: 14px !important;
      background: rgba(10, 29, 31, 0.96) !important;
      box-shadow: var(--shadow) !important;
    }

    @media (min-width: 1025px) {
      .workspace {
        padding: 28px 34px 44px !important;
      }

      .screen,
      .mobile-training-app.desktop-training-layout,
      .performance-mobile-app,
      .student-profile-dashboard {
        width: min(100%, 1280px) !important;
      }
    }

    @media (max-width: 1024px) {
      .app-layout::before {
        background: rgba(0, 8, 9, 0) !important;
      }

      body.sidebar-drawer-open .app-layout::before {
        background: rgba(0, 8, 9, 0.7) !important;
      }

      .sidebar {
        border-right-color: var(--line) !important;
        background: rgba(8, 25, 27, 0.97) !important;
        box-shadow: 22px 0 60px rgba(0, 0, 0, 0.46) !important;
      }

      .topbar {
        border-bottom: 1px solid var(--line) !important;
        background: rgba(7, 19, 21, 0.84) !important;
        backdrop-filter: blur(18px) !important;
      }

      body.sidebar-drawer-open .mobile-menu {
        background: rgba(20, 42, 44, 0.96) !important;
      }

      .neon-training-hero {
        grid-template-columns: auto minmax(0, 1fr);
      }

      .neon-training-state {
        grid-column: 1 / -1;
        justify-self: start;
      }
    }

    @media (max-width: 760px) {
      .workspace {
        padding: 14px 14px 116px !important;
      }

      .topbar {
        min-height: 66px !important;
        margin: -14px -14px 16px !important;
        padding: 14px !important;
      }

      .mobile-menu {
        display: none !important;
      }

      .sidebar {
        width: calc(100% - 24px) !important;
        min-height: 0 !important;
        height: auto !important;
        max-height: none !important;
        display: block !important;
        position: fixed !important;
        inset: auto 12px 12px 12px !important;
        z-index: 950 !important;
        overflow: visible !important;
        padding: 8px !important;
        border: 1px solid rgba(125, 170, 159, 0.28) !important;
        border-radius: 28px !important;
        background: rgba(13, 31, 33, 0.88) !important;
        box-shadow: 0 22px 50px rgba(0, 0, 0, 0.5) !important;
        backdrop-filter: blur(22px) !important;
        transform: none !important;
      }

      .sidebar .brand-block,
      .sidebar .selected-student,
      .sidebar .sidebar-footer {
        display: none !important;
      }

      .sidebar .nav-list {
        display: flex !important;
        grid-template-columns: none !important;
        gap: 4px !important;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        scrollbar-width: none;
      }

      .sidebar .nav-list::-webkit-scrollbar {
        display: none;
      }

      .sidebar .nav-list button {
        min-width: 70px;
        min-height: 62px !important;
        flex: 1 0 70px;
        display: grid !important;
        justify-items: center;
        align-content: center;
        gap: 4px !important;
        padding: 7px 6px !important;
        border-radius: 21px !important;
        font-size: 10px !important;
        text-align: center !important;
      }

      .sidebar .nav-list button svg {
        width: 21px !important;
        height: 21px !important;
      }

      .sidebar .nav-list button.active {
        transform: translateY(-2px);
        box-shadow: 0 0 22px rgba(78, 240, 174, 0.18) !important;
      }

      .panel,
      .metric {
        border-radius: 20px !important;
      }

      .summary-row {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        gap: 8px !important;
      }

      .metric {
        min-height: 106px !important;
        padding: 13px !important;
      }

      .metric strong {
        font-size: 17px !important;
      }

      .metric span {
        font-size: 9px !important;
      }

      .neon-training-heading {
        margin-top: 4px;
      }

      .neon-heading-icon {
        width: 46px;
        height: 46px;
      }

      .neon-training-hero {
        padding: 18px;
        border-radius: 22px;
      }

      .neon-training-hero-icon {
        width: 52px;
        height: 52px;
        border-radius: 18px;
      }

      .neon-training-hero-copy strong {
        font-size: 23px;
      }

      .mobile-workout-card,
      .mobile-exercise-card {
        border-radius: 19px !important;
      }

      .mobile-exercise-meta {
        overflow-x: auto;
      }

      .student-profile-dashboard {
        padding-bottom: 0 !important;
      }
    }

    @media (max-width: 430px) {
      .workspace {
        padding-inline: 10px !important;
      }

      .topbar {
        margin-inline: -10px !important;
      }

      .panel {
        padding: 15px !important;
      }

      .neon-training-hero {
        grid-template-columns: 1fr;
      }

      .neon-training-hero-icon {
        display: none;
      }

      .neon-training-progress-copy,
      .neon-training-progress,
      .neon-training-state {
        grid-column: 1;
      }

      .mobile-series-head,
      .mobile-series-row {
        grid-template-columns: 30px minmax(72px, 1fr) 58px 58px !important;
        gap: 6px !important;
      }
    }
  `;

  document.head.appendChild(style);
}

export {};

const STYLE_ID = "meutreino-remove-recent-training-history";

function injectRemoveRecentHistoryStyle() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .mobile-history-card {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

function removeRecentHistoryCards() {
  document.querySelectorAll(".mobile-history-card").forEach((item) => item.remove());
}

function bootRemoveRecentTrainingHistory() {
  injectRemoveRecentHistoryStyle();
  removeRecentHistoryCards();

  if (!document.body) return;

  new MutationObserver(() => removeRecentHistoryCards()).observe(document.body, {
    childList: true,
    subtree: true
  });
}

bootRemoveRecentTrainingHistory();

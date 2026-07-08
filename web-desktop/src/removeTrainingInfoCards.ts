export {};

const STYLE_ID = "meutreino-remove-training-info-cards";

function injectRemoveTrainingInfoCardsStyle() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .desktop-training-summary,
    .desktop-training-rail {
      display: none !important;
    }

    .desktop-training-content {
      display: block !important;
    }

    .desktop-training-layout .mobile-training-list {
      max-width: none !important;
      width: 100% !important;
    }

    @media (min-width: 860px) {
      .desktop-training-layout .mobile-training-title {
        margin-bottom: 18px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function removeTrainingInfoCards() {
  document.querySelectorAll(".desktop-training-summary, .desktop-training-rail").forEach((item) => item.remove());
}

function bootRemoveTrainingInfoCards() {
  injectRemoveTrainingInfoCardsStyle();
  removeTrainingInfoCards();

  if (!document.body) return;

  new MutationObserver(removeTrainingInfoCards).observe(document.body, {
    childList: true,
    subtree: true
  });
}

bootRemoveTrainingInfoCards();

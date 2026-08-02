export {};

const STYLE_ID = "meutreino-responsive-sidebar-drawer";
const OPEN_CLASS = "sidebar-drawer-open";
const MOBILE_QUERY = "(max-width: 1024px)";
const BOTTOM_NAV_QUERY = "(max-width: 760px)";

let listenersAttached = false;
let observerAttached = false;
let mediaQuery: MediaQueryList | null = null;
let bottomNavQuery: MediaQueryList | null = null;

function injectResponsiveSidebarStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @media (max-width: 1024px) {
      body.${OPEN_CLASS} {
        overflow: hidden;
      }

      .app-layout {
        position: relative;
        min-height: 100vh;
        display: block;
      }

      .app-layout::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: 880;
        pointer-events: none;
        background: rgba(47, 62, 63, 0);
        backdrop-filter: blur(0);
        transition: background 180ms ease, backdrop-filter 180ms ease;
      }

      body.${OPEN_CLASS} .app-layout::before {
        pointer-events: auto;
        background: rgba(47, 62, 63, 0.42);
        backdrop-filter: blur(3px);
      }

      .sidebar {
        width: min(82vw, 360px);
        min-height: 100vh !important;
        height: 100vh;
        position: fixed !important;
        inset: 0 auto 0 0;
        z-index: 900;
        overflow-y: auto;
        border-right: 1px solid rgba(214, 228, 221, 0.88) !important;
        border-bottom: 0 !important;
        border-radius: 0 28px 28px 0;
        padding: 28px 26px;
        background: rgba(255, 255, 255, 0.94) !important;
        box-shadow: 22px 0 55px rgba(31, 71, 60, 0.2);
        transform: translateX(-105%);
        transition: transform 220ms ease;
      }

      body.${OPEN_CLASS} .sidebar {
        transform: translateX(0);
      }

      .sidebar .brand-block.compact {
        display: grid;
        gap: 12px;
        align-items: start;
        margin-bottom: 34px;
      }

      .sidebar .brand-block.compact .brand-mark {
        width: 64px;
        height: 64px;
        border-radius: 16px;
      }

      .sidebar .brand-block.compact h1 {
        font-size: 28px;
        color: #141d24;
      }

      .sidebar .brand-block.compact p {
        color: #198b63;
        font-size: 17px;
        font-weight: 900;
      }

      .sidebar .nav-list {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 14px;
      }

      .sidebar .nav-list button {
        min-height: 56px;
        border-radius: 14px;
        padding: 12px 16px;
        color: #1f2933;
        background: transparent;
        font-size: 18px;
      }

      .sidebar .nav-list button svg {
        width: 24px;
        height: 24px;
        color: #4c6063;
      }

      .sidebar .nav-list button.active {
        color: #16835d;
        background: #e8f6ee;
      }

      .sidebar .nav-list button.active svg {
        color: #16835d;
      }

      .selected-student {
        margin-top: 10px;
        border-radius: 14px;
        background: #ffffff;
      }

      .sidebar-footer {
        margin-top: 26px;
        padding-top: 22px;
        border-top: 1px solid rgba(214, 228, 221, 0.9);
      }

      .sidebar-footer .icon-text {
        min-height: 52px;
        justify-content: flex-start;
        border-radius: 14px;
        font-size: 18px;
      }

      .workspace {
        min-height: 100vh;
        padding: 18px !important;
        transition: filter 180ms ease, transform 180ms ease;
      }

      body.${OPEN_CLASS} .workspace {
        filter: blur(1px);
      }

      .topbar {
        min-height: 72px;
        position: sticky;
        top: 0;
        z-index: 700;
        margin: -18px -18px 18px;
        padding: 18px;
        background: rgba(222, 239, 228, 0.86);
        backdrop-filter: blur(10px);
      }

      .mobile-menu {
        display: grid !important;
        place-items: center;
        width: 54px;
        height: 54px;
        border-radius: 999px;
        color: #1f2933;
        background: rgba(255, 255, 255, 0.72);
        box-shadow: 0 10px 26px rgba(41, 71, 61, 0.12);
      }

      body.${OPEN_CLASS} .mobile-menu {
        background: #ffffff;
      }
    }

    @media (max-width: 560px) {
      .sidebar {
        width: min(88vw, 354px);
        padding: 24px 22px;
        border-radius: 0 26px 26px 0;
      }

      .topbar h2 {
        font-size: 22px;
      }

      .topbar .eyebrow {
        font-size: 11px;
      }
    }

    @media (min-width: 1025px) {
      .mobile-menu {
        display: none !important;
      }

      body.${OPEN_CLASS} {
        overflow: auto;
      }
    }
  `;
  document.head.appendChild(style);
}

function isMobileLayout() {
  if (!mediaQuery) mediaQuery = window.matchMedia(MOBILE_QUERY);
  return mediaQuery.matches;
}

function isBottomNavLayout() {
  if (!bottomNavQuery) bottomNavQuery = window.matchMedia(BOTTOM_NAV_QUERY);
  return bottomNavQuery.matches;
}

function getLayout() {
  return document.querySelector<HTMLElement>(".app-layout");
}

function getSidebar() {
  return document.querySelector<HTMLElement>(".sidebar");
}

function getMenuButton() {
  return document.querySelector<HTMLButtonElement>(".mobile-menu");
}

function setSidebarOpen(open: boolean) {
  const shouldOpen = open && isMobileLayout() && !isBottomNavLayout();
  const layout = getLayout();
  const sidebar = getSidebar();
  const button = getMenuButton();

  document.body.classList.toggle(OPEN_CLASS, shouldOpen);
  layout?.classList.toggle(OPEN_CLASS, shouldOpen);
  sidebar?.setAttribute("aria-hidden", shouldOpen || isBottomNavLayout() ? "false" : isMobileLayout() ? "true" : "false");
  button?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
}

function closeSidebar() {
  setSidebarOpen(false);
}

function toggleSidebar() {
  setSidebarOpen(!document.body.classList.contains(OPEN_CLASS));
}

function stopClick(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as Element | null;
  if (!target) return;

  const menuButton = target.closest(".mobile-menu");
  if (menuButton) {
    stopClick(event);
    toggleSidebar();
    return;
  }

  if (!document.body.classList.contains(OPEN_CLASS)) return;

  const sidebar = target.closest(".sidebar");
  const navButton = target.closest(".sidebar .nav-list button, .sidebar-footer button, .selected-student button");

  if (navButton) {
    window.requestAnimationFrame(closeSidebar);
    return;
  }

  if (!sidebar) {
    stopClick(event);
    closeSidebar();
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") closeSidebar();
}

function handleResize() {
  if (!isMobileLayout()) closeSidebar();
  syncAccessibility();
}

function syncAccessibility() {
  const button = getMenuButton();
  const sidebar = getSidebar();
  const isOpen = document.body.classList.contains(OPEN_CLASS);

  button?.setAttribute("aria-controls", "meutreino-sidebar");
  button?.setAttribute("aria-expanded", isOpen ? "true" : "false");

  if (sidebar) {
    sidebar.id = "meutreino-sidebar";
    sidebar.setAttribute("aria-hidden", isMobileLayout() && !isOpen && !isBottomNavLayout() ? "true" : "false");
  }
}

function bootResponsiveSidebarDrawer() {
  injectResponsiveSidebarStyles();
  syncAccessibility();

  if (!listenersAttached) {
    listenersAttached = true;
    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("keydown", handleKeydown, true);
    window.addEventListener("resize", handleResize);
  }

  if (!observerAttached && document.body) {
    observerAttached = true;
    new MutationObserver(syncAccessibility).observe(document.body, { childList: true, subtree: true });
  }
}

bootResponsiveSidebarDrawer();

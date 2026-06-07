/* ==========================================================
   SMARTBUS MOBILE SIDEBAR FINAL FIX
   Loaded after script.js/performance.js. It wins over older patches by
   listening at window-capture level before document/Leaflet handlers.
========================================================== */
(function smartBusMobileSidebarFinalFix() {
  if (window.__SMARTBUS_MOBILE_SIDEBAR_FINAL_FIX__) return;
  window.__SMARTBUS_MOBILE_SIDEBAR_FINAL_FIX__ = true;

  const MOBILE_QUERY = "(max-width: 900px)";

  function isMobile() {
    return window.matchMedia ? window.matchMedia(MOBILE_QUERY).matches : window.innerWidth <= 900;
  }

  function sidebar() {
    return document.getElementById("sidebar");
  }

  function overlay() {
    return document.getElementById("overlay");
  }

  function menuButton() {
    return document.getElementById("menu-btn");
  }

  function isOpen() {
    const el = sidebar();
    return Boolean(
      document.body.classList.contains("sidebar-open") ||
      el?.classList.contains("open") ||
      el?.classList.contains("active") ||
      el?.classList.contains("is-open")
    );
  }

  function setMenuButton(open) {
    const btn = menuButton();
    if (!btn) return;
    btn.classList.toggle("is-open", Boolean(open));
    btn.setAttribute("aria-expanded", String(Boolean(open)));
    btn.setAttribute("aria-label", open ? "Thu menu" : "Mở menu");
  }

  function ensureScrollRegion() {
    const el = sidebar();
    if (!el) return null;

    let region = el.querySelector(":scope > .sb-mobile-scroll-region");
    let nav = el.querySelector(":scope > .sb-nav") || el.querySelector(".sb-mobile-scroll-region > .sb-nav");
    let footer = el.querySelector(":scope > .sb-footer") || el.querySelector(".sb-mobile-scroll-region > .sb-footer");

    if (!region) {
      region = document.createElement("div");
      region.className = "sb-mobile-scroll-region";
      region.setAttribute("aria-label", "Danh sách chức năng SmartBus");
      const header = el.querySelector(":scope > .sb-header");
      if (header && header.nextSibling) el.insertBefore(region, header.nextSibling);
      else el.appendChild(region);
    }

    if (nav && nav.parentElement !== region) region.appendChild(nav);
    if (footer && footer.parentElement !== region) region.appendChild(footer);

    el.style.overflow = "hidden";
    el.style.touchAction = "auto";
    region.style.overflowY = "auto";
    region.style.overflowX = "hidden";
    region.style.webkitOverflowScrolling = "touch";
    region.style.touchAction = "pan-y";
    region.style.overscrollBehaviorY = "contain";
    region.style.pointerEvents = "auto";
    region.style.minHeight = "0";

    return region;
  }

  function openSidebar() {
    const el = sidebar();
    const ov = overlay();
    ensureScrollRegion();
    el?.classList.add("open", "active", "is-open");
    ov?.classList.add("show", "open", "active", "is-open");
    document.documentElement.classList.add("sidebar-lock");
    document.body.classList.add("sidebar-open");
    document.body.style.overflow = "hidden";
    setMenuButton(true);
  }

  function closeSidebar() {
    const el = sidebar();
    const ov = overlay();
    el?.classList.remove("open", "active", "is-open");
    ov?.classList.remove("show", "open", "active", "is-open");
    document.documentElement.classList.remove("sidebar-lock");
    document.body.classList.remove("sidebar-open", "menu-open");
    document.body.style.overflow = "";
    setMenuButton(false);
  }

  function insideSidebar(target) {
    const el = sidebar();
    return Boolean(el && target && el.contains(target));
  }

  function insideMenuButton(target) {
    const btn = menuButton();
    return Boolean(btn && target && btn.contains(target));
  }

  function scrollable() {
    return ensureScrollRegion();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function scrollBy(deltaY) {
    const scroller = scrollable();
    if (!scroller) return false;
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    if (max <= 1) return false;
    const before = scroller.scrollTop;
    scroller.scrollTop = clamp(before + Number(deltaY || 0), 0, max);
    return scroller.scrollTop !== before || max > 1;
  }

  function stop(event) {
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
  }

  function selectViewFromLink(link) {
    const view = link?.dataset?.view;
    if (!view) return;
    if (window.Nav && typeof window.Nav.go === "function") {
      window.Nav.go(view);
      return;
    }
    // Fallback for top-level lexical const Nav in non-module scripts.
    try {
      // eslint-disable-next-line no-new-func
      Function("view", "if (typeof Nav !== 'undefined' && Nav.go) Nav.go(view);")(view);
    } catch (_err) {}
  }

  function bind() {
    ensureScrollRegion();

    const btn = menuButton();
    if (btn && btn.dataset.finalSidebarToggle !== "1") {
      btn.dataset.finalSidebarToggle = "1";
      btn.addEventListener("click", (event) => {
        if (!isMobile()) return;
        stop(event);
        if (isOpen()) closeSidebar();
        else openSidebar();
      }, true);
    }

    const ov = overlay();
    if (ov && ov.dataset.finalSidebarOverlay !== "1") {
      ov.dataset.finalSidebarOverlay = "1";
      ["click", "pointerdown", "touchstart"].forEach((type) => {
        ov.addEventListener(type, (event) => {
          if (!isMobile() || !isOpen()) return;
          stop(event);
          closeSidebar();
        }, { passive: false, capture: true });
      });
    }
  }

  let touchStartY = 0;
  let touchStartTop = 0;
  let touchStartedInside = false;

  window.addEventListener("wheel", (event) => {
    if (!isMobile() || !isOpen()) return;
    const target = event.target;
    if (insideSidebar(target)) {
      stop(event);
      scrollBy(event.deltaY || 0);
      return;
    }
    if (!insideMenuButton(target)) {
      stop(event);
      closeSidebar();
    }
  }, { passive: false, capture: true });

  window.addEventListener("touchstart", (event) => {
    if (!isMobile() || !isOpen()) return;
    const target = event.target;
    touchStartedInside = insideSidebar(target);
    if (!touchStartedInside) {
      if (!insideMenuButton(target)) closeSidebar();
      return;
    }
    const scroller = scrollable();
    if (!scroller || !event.touches || !event.touches.length) return;
    touchStartY = event.touches[0].clientY;
    touchStartTop = scroller.scrollTop;
  }, { passive: true, capture: true });

  window.addEventListener("touchmove", (event) => {
    if (!isMobile() || !isOpen() || !touchStartedInside) return;
    const scroller = scrollable();
    if (!scroller || !event.touches || !event.touches.length) return;
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    if (max <= 1) return;
    stop(event);
    const delta = touchStartY - event.touches[0].clientY;
    scroller.scrollTop = clamp(touchStartTop + delta, 0, max);
  }, { passive: false, capture: true });

  window.addEventListener("pointerdown", (event) => {
    if (!isMobile() || !isOpen()) return;
    const target = event.target;
    if (insideSidebar(target) || insideMenuButton(target)) return;
    closeSidebar();
  }, { capture: true });

  window.addEventListener("click", (event) => {
    if (!isMobile() || !isOpen()) return;
    const target = event.target;
    const link = target?.closest?.("#sidebar .sb-link[data-view]");
    if (link) {
      stop(event);
      selectViewFromLink(link);
      return;
    }
    if (insideSidebar(target) || insideMenuButton(target)) return;
    closeSidebar();
  }, { passive: false, capture: true });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) closeSidebar();
  });

  window.addEventListener("resize", () => {
    ensureScrollRegion();
    if (!isMobile() && isOpen()) closeSidebar();
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
  window.addEventListener("load", bind);
})();

// ==UserScript==
// @name         Google AI Studio - StudioCore
// @namespace    http://tampermonkey.net/
// @version      2.1.0
// @license      MIT
// @match        https://aistudio.google.com/*
// @run-at       document-start
// @author       Mireko
// @icon         https://www.google.com/s2/favicons?sz=64&domain=aistudio.google.com
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const CONFIG_KEY = "studiocore_engine_config";
  let config = {
    maxVisible: 6,
    baseMaxVisible: 6,
    restoreStep: 5,
    enabled: true,
    drawerOpen: false,
    drawerPosY: null,
  };

  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) config = { ...config, ...JSON.parse(saved) };
  } catch (e) {}

  function saveConfig() {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch (e) {}
  }

  function injectStyles() {
    if (document.getElementById("studiocore-styles")) return;
    const style = document.createElement("style");
    style.id = "studiocore-styles";
    style.textContent = `
      ms-chat-turn.studiocore-hidden {
        display: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function getMessages() {
    return Array.from(document.querySelectorAll("ms-chat-turn"));
  }

  function getHiddenCount() {
    return document.querySelectorAll("ms-chat-turn.studiocore-hidden").length;
  }

  function virtualizeDOM() {
    const messages = getMessages();
    if (messages.length === 0) return;

    if (!config.enabled) {
      for (let i = 0; i < messages.length; i++) {
        messages[i].classList.remove("studiocore-hidden");
      }
      syncUIState();
      return;
    }

    const total = messages.length;
    const cutoff = Math.max(0, total - config.maxVisible);

    for (let i = 0; i < total; i++) {
      const el = messages[i];
      if (i < cutoff) {
        if (!el.classList.contains("studiocore-hidden")) {
          el.classList.add("studiocore-hidden");
        }
      } else {
        if (el.classList.contains("studiocore-hidden")) {
          el.classList.remove("studiocore-hidden");
        }
      }
    }

    syncUIState();
  }

  function restoreMessages() {
    const hiddenCount = getHiddenCount();
    if (hiddenCount === 0) return;

    const count = Math.min(config.restoreStep, hiddenCount);
    config.maxVisible += count;
    saveConfig();
    virtualizeDOM();
  }

  function restoreAllMessages() {
    const messages = getMessages();
    if (messages.length === 0) return;

    config.maxVisible = messages.length;
    saveConfig();
    virtualizeDOM();
  }

  function resetToMax() {
    config.maxVisible = config.baseMaxVisible;
    saveConfig();
    virtualizeDOM();
  }

  let counterLabelRef = null;
  let statusBtnRef = null;
  let handleIconRef = null;
  const inputRegistry = [];

  function syncUIState() {
    const hiddenCount = getHiddenCount();
    if (counterLabelRef) {
      counterLabelRef.innerText = `Restore (${hiddenCount})`;
    }

    for (let i = 0; i < inputRegistry.length; i++) {
      const { el, key } = inputRegistry[i];
      if (Number(el.value) !== config[key]) {
        el.value = config[key];
      }
    }

    if (statusBtnRef) {
      statusBtnRef.innerText = config.enabled
        ? "Status: Active"
        : "Status: Inactive";
      statusBtnRef.style.borderColor = config.enabled ? "#666666" : "#383838";
      statusBtnRef.style.color = config.enabled ? "#ffffff" : "#777777";
    }
  }

  function applyConfigChange() {
    virtualizeDOM();
    syncUIState();
    saveConfig();
  }

  function createDrawerButton(text, onClick, isPrimary = false) {
    const btn = document.createElement("button");
    btn.innerText = text;
    Object.assign(btn.style, {
      padding: "8px 12px",
      background: isPrimary ? "#2c2c2c" : "#1e1e1e",
      color: isPrimary ? "#ffffff" : "#e0e0e0",
      border: "1px solid #383838",
      borderRadius: "5px",
      cursor: "pointer",
      fontFamily: "Consolas, Monaco, monospace",
      fontSize: "12px",
      fontWeight: "500",
      letterSpacing: "0.3px",
      textAlign: "center",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      transition: "background 0.15s, border-color 0.15s, color 0.15s",
      touchAction: "manipulation",
      flex: "1",
    });

    btn.onmouseover = () => {
      btn.style.background = "#383838";
      btn.style.borderColor = "#555555";
      btn.style.color = "#ffffff";
    };
    btn.onmouseout = () => {
      btn.style.background = isPrimary ? "#2c2c2c" : "#1e1e1e";
      btn.style.borderColor = "#383838";
      btn.style.color = isPrimary ? "#ffffff" : "#e0e0e0";
    };

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (onClick) onClick(e);
    });

    return btn;
  }

  function createDrawerRow(label, key, isBase = false) {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    });

    const span = document.createElement("span");
    span.innerText = label;
    span.style.color = "#d0d0d0";
    span.style.whiteSpace = "nowrap";

    const input = document.createElement("input");
    input.type = "number";
    input.value = config[key];
    Object.assign(input.style, {
      width: "55px",
      background: "#181818",
      color: "#ffffff",
      border: "1px solid #383838",
      borderRadius: "4px",
      textAlign: "center",
      fontFamily: "Consolas, Monaco, monospace",
      fontSize: "12px",
      fontWeight: "bold",
      padding: "4px",
    });

    const updateVal = (e) => {
      e.stopPropagation();
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val > 0) {
        config[key] = val;
        if (isBase) config.maxVisible = val;
        applyConfigChange();
      }
    };

    input.addEventListener("input", updateVal);
    input.addEventListener("blur", () => {
      if (isNaN(parseInt(input.value, 10)) || parseInt(input.value, 10) <= 0) {
        input.value = config[key];
      }
    });

    inputRegistry.push({ el: input, key });
    row.appendChild(span);
    row.appendChild(input);
    return row;
  }

  function createSlideDrawerUI() {
    const drawerPanel = document.createElement("div");
    drawerPanel.id = "studiocore-drawer-panel";
    Object.assign(drawerPanel.style, {
      position: "fixed",
      right: "0",
      top: config.drawerPosY !== null ? `${config.drawerPosY}px` : "35%",
      width: "270px",
      background: "#141414",
      padding: "16px",
      border: "1px solid #383838",
      borderRight: "none",
      borderRadius: "12px 0 0 12px",
      color: "#f0f0f0",
      fontFamily: "Consolas, Monaco, monospace",
      fontSize: "12px",
      display: "flex",
      flexDirection: "column",
      gap: "9px",
      boxShadow: "-10px 10px 35px rgba(0,0,0,0.8)",
      boxSizing: "border-box",
      zIndex: "1000000",
      transform: config.drawerOpen ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), top 0.2s ease-out",
    });

    const drawerHandle = document.createElement("button");
    drawerHandle.id = "studiocore-drawer-handle";
    drawerHandle.innerText = config.drawerOpen ? ">" : "<";
    handleIconRef = drawerHandle;
    Object.assign(drawerHandle.style, {
      position: "absolute",
      right: "100%",
      top: "15px",
      padding: "18px 7px",
      background: "#1a1a1a",
      color: "#e0e0e0",
      border: "1px solid #383838",
      borderRight: "none",
      borderRadius: "8px 0 0 8px",
      cursor: "pointer",
      fontFamily: "Consolas, Monaco, monospace",
      fontSize: "14px",
      fontWeight: "bold",
      lineHeight: "1",
      boxShadow: "-4px 2px 12px rgba(0,0,0,0.6)",
      userSelect: "none",
      webkitUserSelect: "none",
      touchAction: "none",
      transition: "background 0.15s, color 0.15s",
    });

    drawerHandle.onmouseover = () => {
      drawerHandle.style.background = "#282828";
      drawerHandle.style.color = "#ffffff";
    };
    drawerHandle.onmouseout = () => {
      drawerHandle.style.background = "#1a1a1a";
      drawerHandle.style.color = "#e0e0e0";
    };

    function setDrawerState(open) {
      config.drawerOpen = open;
      if (open) {
        const currentTop = drawerPanel.getBoundingClientRect().top;
        const panelHeight = drawerPanel.offsetHeight || 300;
        const maxAllowedTop = window.innerHeight - panelHeight - 12;
        if (currentTop > maxAllowedTop) {
          drawerPanel.style.top = `${Math.max(10, maxAllowedTop)}px`;
        }
      } else {
        if (config.drawerPosY !== null) {
          drawerPanel.style.top = `${config.drawerPosY}px`;
        }
      }
      drawerPanel.style.transform = open ? "translateX(0)" : "translateX(100%)";
      drawerHandle.innerText = open ? ">" : "<";
      saveConfig();
      if (open) syncUIState();
    }

    let isDragging = false;
    let hasMoved = false;
    let startY = 0;
    let initialTop = 0;

    const onPointerDown = (e) => {
      isDragging = true;
      hasMoved = false;
      startY = e.clientY;
      initialTop = drawerPanel.getBoundingClientRect().top;
      drawerHandle.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const deltaY = e.clientY - startY;
      if (Math.abs(deltaY) > 4) hasMoved = true;
      let nextY = initialTop + deltaY;
      const maxY = window.innerHeight - 55;
      nextY = Math.max(10, Math.min(nextY, maxY));
      drawerPanel.style.top = `${nextY}px`;
    };

    const onPointerUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      try {
        drawerHandle.releasePointerCapture(e.pointerId);
      } catch (err) {}
      if (hasMoved) {
        config.drawerPosY = Math.round(drawerPanel.getBoundingClientRect().top);
        saveConfig();
      }
    };

    drawerHandle.addEventListener("pointerdown", onPointerDown);
    drawerHandle.addEventListener("pointermove", onPointerMove);
    drawerHandle.addEventListener("pointerup", onPointerUp);
    drawerHandle.addEventListener("pointercancel", onPointerUp);

    drawerHandle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (hasMoved) return;
      setDrawerState(!config.drawerOpen);
    });

    document.addEventListener("click", (e) => {
      if (config.drawerOpen && !drawerPanel.contains(e.target)) {
        setDrawerState(false);
      }
    });

    drawerPanel.addEventListener("click", (e) => e.stopPropagation());

    const panelHeader = document.createElement("div");
    Object.assign(panelHeader.style, {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: "1px solid #282828",
      paddingBottom: "8px",
      marginBottom: "2px",
    });

    const headerTitle = document.createElement("span");
    headerTitle.innerText = "StudioCore Engine";
    headerTitle.style.fontWeight = "bold";
    headerTitle.style.color = "#ffffff";

    const headerClose = document.createElement("button");
    headerClose.innerText = "[X]";
    Object.assign(headerClose.style, {
      background: "transparent",
      border: "none",
      color: "#888888",
      cursor: "pointer",
      fontFamily: "Consolas, Monaco, monospace",
      fontSize: "12px",
    });
    headerClose.onclick = () => setDrawerState(false);

    panelHeader.appendChild(headerTitle);
    panelHeader.appendChild(headerClose);
    drawerPanel.appendChild(panelHeader);

    const statusBtn = createDrawerButton("", () => {
      config.enabled = !config.enabled;
      applyConfigChange();
    });
    statusBtnRef = statusBtn;

    const restoreRow = document.createElement("div");
    Object.assign(restoreRow.style, {
      display: "flex",
      gap: "6px",
      width: "100%",
    });

    const restoreBtn = createDrawerButton("Restore", restoreMessages);
    counterLabelRef = restoreBtn;

    const restoreAllBtn = createDrawerButton("Restore All", restoreAllMessages);
    restoreRow.appendChild(restoreBtn);
    restoreRow.appendChild(restoreAllBtn);

    const resetBtn = createDrawerButton("Reset to Base", resetToMax);

    drawerPanel.appendChild(createDrawerRow("Max Visible:", "baseMaxVisible", true));
    drawerPanel.appendChild(createDrawerRow("Restore Step:", "restoreStep"));

    const divider = document.createElement("div");
    divider.style.borderTop = "1px solid #282828";
    divider.style.margin = "3px 0";
    drawerPanel.appendChild(divider);

    drawerPanel.appendChild(statusBtn);
    drawerPanel.appendChild(restoreRow);
    drawerPanel.appendChild(resetBtn);

    drawerPanel.appendChild(drawerHandle);
    document.body.appendChild(drawerPanel);

    syncUIState();
  }

  function initApp() {
    injectStyles();
    createSlideDrawerUI();

    let debounceTimer = null;
    const observer = new MutationObserver((mutations) => {
      let hasTurnMutation = false;
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        for (let j = 0; j < m.addedNodes.length; j++) {
          const node = m.addedNodes[j];
          if (
            node.nodeType === 1 &&
            (node.tagName === "MS-CHAT-TURN" || (node.querySelector && node.querySelector("ms-chat-turn")))
          ) {
            hasTurnMutation = true;
            break;
          }
        }
        if (hasTurnMutation) break;
        for (let j = 0; j < m.removedNodes.length; j++) {
          const node = m.removedNodes[j];
          if (
            node.nodeType === 1 &&
            (node.tagName === "MS-CHAT-TURN" || (node.querySelector && node.querySelector("ms-chat-turn")))
          ) {
            hasTurnMutation = true;
            break;
          }
        }
        if (hasTurnMutation) break;
      }

      if (hasTurnMutation) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          virtualizeDOM();
        }, 150);
      }
    });

    const targetNode =
      document.querySelector("chat-window, ms-chat-window, main, .chat-container") ||
      document.body;
    observer.observe(targetNode, { childList: true, subtree: true });

    virtualizeDOM();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
})();

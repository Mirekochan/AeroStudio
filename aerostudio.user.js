// ==UserScript==
// @name         Google AI Studio - StudioCore
// @namespace    http://tampermonkey.net/
// @version      2.2.0
// @license      MIT
// @match        https://aistudio.google.com/*
// @run-at       document-start
// @author       Mireko
// @icon         https://www.google.com/s2/favicons?sz=64&domain=aistudio.google.com
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const CONFIG_KEY = "studiocore_v2_config";
  let config = {
    maxVisible: 2,
    baseMaxVisible: 2,
    restoreStep: 3,
    chatDomLimit: 1000,
    cacheLimit: 60,
    enabled: true,
    drawerOpen: false,
    drawerPosY: null,
  };

  let detachedPool = [];
  let chatContainerRef = null;
  let isInternalOp = false;
  let isTyping = false;
  let typingTimer = null;
  let isReadingHistory = false;

  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) config = { ...config, ...JSON.parse(saved) };
  } catch (e) {}

  function saveConfig() {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch (e) {}
  }

  function getMessages() {
    return Array.from(document.querySelectorAll("ms-chat-turn"));
  }

  function getChatDomCount(messages) {
    const list = messages || getMessages();
    let count = list.length;
    for (let i = 0; i < list.length; i++) {
      count += list[i].getElementsByTagName("*").length;
    }
    return count;
  }

  function virtualizeDOM(forceTrim = false) {
    if (!config.enabled) return;
    if (isReadingHistory && !forceTrim) {
      syncUIState();
      return;
    }

    const messages = getMessages();
    if (messages.length === 0) {
      syncUIState();
      return;
    }

    if (!chatContainerRef && messages[0].parentElement) {
      chatContainerRef = messages[0].parentElement;
    }

    isInternalOp = true;

    let idx = 0;
    let remaining = messages.length;

    while (remaining > config.maxVisible && idx < messages.length - 1) {
      const el = messages[idx];
      if (el && el.parentElement) {
        chatContainerRef = el.parentElement;
        el.remove();
        detachedPool.push(el);
      }
      idx++;
      remaining--;
    }

    if (config.chatDomLimit > 0) {
      let visibleList = messages.slice(idx);
      let currentChatDom = getChatDomCount(visibleList);

      while (
        visibleList.length > 1 &&
        currentChatDom > config.chatDomLimit
      ) {
        const el = visibleList.shift();
        if (el && el.parentElement) {
          const elNodes = 1 + el.getElementsByTagName("*").length;
          chatContainerRef = el.parentElement;
          el.remove();
          detachedPool.push(el);
          currentChatDom -= elNodes;
        }
      }
    }

    if (detachedPool.length > config.cacheLimit) {
      const excess = detachedPool.length - config.cacheLimit;
      const deadNodes = detachedPool.splice(0, excess);
      for (let i = 0; i < deadNodes.length; i++) {
        deadNodes[i] = null;
      }
    }

    setTimeout(() => {
      isInternalOp = false;
    }, 50);

    syncUIState();
  }

  function restoreMessages() {
    if (detachedPool.length === 0) return;

    isInternalOp = true;
    isReadingHistory = true;

    const count = Math.min(config.restoreStep, detachedPool.length);
    const toRestore = detachedPool.splice(-count);
    const firstVisible = document.querySelector("ms-chat-turn");
    const container = (firstVisible && firstVisible.parentElement) || chatContainerRef;

    if (container) {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < toRestore.length; i++) {
        frag.appendChild(toRestore[i]);
      }
      if (firstVisible) {
        container.insertBefore(frag, firstVisible);
      } else {
        container.appendChild(frag);
      }
    }

    config.maxVisible = getMessages().length;

    setTimeout(() => {
      isInternalOp = false;
    }, 50);

    saveConfig();
    syncUIState();
  }

  function restoreAllMessages() {
    if (detachedPool.length === 0) return;

    isInternalOp = true;
    isReadingHistory = true;

    const count = detachedPool.length;
    const toRestore = detachedPool.splice(0, count);
    const firstVisible = document.querySelector("ms-chat-turn");
    const container = (firstVisible && firstVisible.parentElement) || chatContainerRef;

    if (container) {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < toRestore.length; i++) {
        frag.appendChild(toRestore[i]);
      }
      if (firstVisible) {
        container.insertBefore(frag, firstVisible);
      } else {
        container.appendChild(frag);
      }
    }

    config.maxVisible = getMessages().length;

    setTimeout(() => {
      isInternalOp = false;
    }, 50);

    saveConfig();
    syncUIState();
  }

  function resetToMax() {
    isReadingHistory = false;
    config.maxVisible = config.baseMaxVisible;
    saveConfig();
    virtualizeDOM(true);
  }

  let counterLabelRef;
  let statusBtnRef;
  let domCounterRef;
  const inputRegistry = [];

  function syncUIState() {
    if (counterLabelRef) {
      counterLabelRef.innerText = `Restore (${detachedPool.length})`;
    }

    if (domCounterRef) {
      const chatDom = getChatDomCount();
      const totalDom = document.getElementsByTagName("*").length;
      domCounterRef.innerText = `Chat DOM: ${chatDom} | Total: ${totalDom}`;
      domCounterRef.style.color =
        config.chatDomLimit > 0 && chatDom > config.chatDomLimit ? "#ff9800" : "#4caf50";
    }

    inputRegistry.forEach(({ el, key }) => {
      if (document.activeElement !== el) {
        el.value = String(config[key]);
      }
    });

    if (statusBtnRef) {
      statusBtnRef.innerText = config.enabled ? "Status: Active" : "Status: Inactive";
      statusBtnRef.style.borderColor = config.enabled ? "#00e5ff" : "#383838";
      statusBtnRef.style.color = config.enabled ? "#00e5ff" : "#777777";
    }
  }

  function createDrawerButton(text, onClick, isPrimary = false) {
    const btn = document.createElement("button");
    btn.innerText = text;
    Object.assign(btn.style, {
      padding: "8px 10px",
      background: isPrimary ? "#16202a" : "#1e1e1e",
      color: isPrimary ? "#00e5ff" : "#e0e0e0",
      border: isPrimary ? "1px solid #00e5ff" : "1px solid #383838",
      borderRadius: "5px",
      cursor: "pointer",
      fontFamily: "Consolas, Monaco, monospace",
      fontSize: "12px",
      fontWeight: "bold",
      textAlign: "center",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      touchAction: "manipulation",
      flex: "1",
    });

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (onClick) onClick(e);
    });

    return btn;
  }

  function createDrawerRow(label, key, isBase = false, allowZero = false) {
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
    input.value = String(config[key]);
    Object.assign(input.style, {
      width: "68px",
      background: "#181818",
      color: "#00e5ff",
      border: "1px solid #383838",
      borderRadius: "4px",
      textAlign: "center",
      fontFamily: "Consolas, Monaco, monospace",
      fontSize: "12px",
      fontWeight: "bold",
      padding: "4px",
    });

    const commitValue = () => {
      const val = parseInt(input.value, 10);
      const minVal = allowZero ? 0 : 1;
      if (!isNaN(val) && val >= minVal) {
        config[key] = val;
        if (isBase) {
          config.maxVisible = val;
          isReadingHistory = false;
        }
        saveConfig();
        if (config.enabled) virtualizeDOM(true);
        syncUIState();
      } else {
        input.value = String(config[key]);
      }
    };

    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        input.blur();
      }
    });

    input.addEventListener("change", (e) => {
      e.stopPropagation();
      commitValue();
    });

    input.addEventListener("blur", () => {
      commitValue();
    });

    inputRegistry.push({ el: input, key });
    row.appendChild(span);
    row.appendChild(input);
    return row;
  }

  function createSlideDrawerUI() {
    if (document.getElementById("studiocore-drawer-panel")) return;

    const drawerPanel = document.createElement("div");
    drawerPanel.id = "studiocore-drawer-panel";
    Object.assign(drawerPanel.style, {
      position: "fixed",
      right: "0",
      top: config.drawerPosY !== null ? `${config.drawerPosY}px` : "35%",
      width: "275px",
      background: "#141414",
      padding: "14px",
      border: "1px solid #383838",
      borderRight: "none",
      borderRadius: "12px 0 0 12px",
      color: "#f0f0f0",
      fontFamily: "Consolas, Monaco, monospace",
      fontSize: "12px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      boxShadow: "-10px 10px 35px rgba(0,0,0,0.85)",
      boxSizing: "border-box",
      zIndex: "2147483647",
      transform: config.drawerOpen ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), top 0.2s ease-out",
    });

    const drawerHandle = document.createElement("button");
    drawerHandle.id = "studiocore-drawer-handle";
    drawerHandle.innerText = config.drawerOpen ? ">" : "<";
    Object.assign(drawerHandle.style, {
      position: "absolute",
      right: "100%",
      top: "15px",
      padding: "18px 8px",
      background: "#1a1a1a",
      color: "#00e5ff",
      border: "1px solid #00e5ff",
      borderRight: "none",
      borderRadius: "8px 0 0 8px",
      cursor: "pointer",
      fontFamily: "Consolas, Monaco, monospace",
      fontSize: "14px",
      fontWeight: "bold",
      lineHeight: "1",
      boxShadow: "-4px 2px 12px rgba(0,0,0,0.7)",
      userSelect: "none",
      webkitUserSelect: "none",
      touchAction: "none",
    });

    function setDrawerState(open) {
      config.drawerOpen = open;
      if (open) {
        const currentTop = drawerPanel.getBoundingClientRect().top;
        const panelHeight = drawerPanel.offsetHeight || 310;
        const maxAllowedTop = window.innerHeight - panelHeight - 12;
        if (currentTop > maxAllowedTop) {
          drawerPanel.style.top = `${Math.max(10, maxAllowedTop)}px`;
        }
      } else if (config.drawerPosY !== null) {
        drawerPanel.style.top = `${config.drawerPosY}px`;
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

    drawerHandle.addEventListener("pointerdown", (e) => {
      isDragging = true;
      hasMoved = false;
      startY = e.clientY;
      initialTop = drawerPanel.getBoundingClientRect().top;
      try {
        drawerHandle.setPointerCapture(e.pointerId);
      } catch (err) {}
    });

    drawerHandle.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      const deltaY = e.clientY - startY;
      if (Math.abs(deltaY) > 4) hasMoved = true;
      let nextY = initialTop + deltaY;
      const maxY = window.innerHeight - 55;
      nextY = Math.max(10, Math.min(nextY, maxY));
      drawerPanel.style.top = `${nextY}px`;
    });

    const onPointerEnd = (e) => {
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

    drawerHandle.addEventListener("pointerup", onPointerEnd);
    drawerHandle.addEventListener("pointercancel", onPointerEnd);

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
      paddingBottom: "6px",
    });

    const headerTitle = document.createElement("span");
    headerTitle.innerText = "StudioCore v6.1";
    headerTitle.style.fontWeight = "bold";
    headerTitle.style.color = "#00e5ff";

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

    const domCounter = document.createElement("div");
    Object.assign(domCounter.style, {
      background: "#1a1a1a",
      padding: "5px",
      borderRadius: "4px",
      textAlign: "center",
      fontWeight: "bold",
      fontSize: "11px",
      border: "1px solid #282828",
    });
    domCounterRef = domCounter;
    drawerPanel.appendChild(domCounter);

    drawerPanel.appendChild(createDrawerRow("Max Turns:", "baseMaxVisible", true));
    drawerPanel.appendChild(createDrawerRow("Chat DOM Cap:", "chatDomLimit", false, true));
    drawerPanel.appendChild(createDrawerRow("Restore Step:", "restoreStep"));
    drawerPanel.appendChild(createDrawerRow("Memory Buffer:", "cacheLimit"));

    const divider = document.createElement("div");
    divider.style.borderTop = "1px solid #282828";
    divider.style.margin = "2px 0";
    drawerPanel.appendChild(divider);

    const statusBtn = createDrawerButton("", () => {
      config.enabled = !config.enabled;
      if (config.enabled) {
        isReadingHistory = false;
        virtualizeDOM(true);
      } else {
        restoreAllMessages();
      }
      syncUIState();
      saveConfig();
    });
    statusBtnRef = statusBtn;

    const restoreRow = document.createElement("div");
    Object.assign(restoreRow.style, { display: "flex", gap: "6px", width: "100%" });

    const restoreBtn = createDrawerButton("Restore", restoreMessages);
    counterLabelRef = restoreBtn;

    const restoreAllBtn = createDrawerButton("Restore All", restoreAllMessages);
    restoreRow.appendChild(restoreBtn);
    restoreRow.appendChild(restoreAllBtn);

    const resetBtn = createDrawerButton("Purge / Reset", resetToMax, true);

    drawerPanel.appendChild(statusBtn);
    drawerPanel.appendChild(restoreRow);
    drawerPanel.appendChild(resetBtn);

    drawerPanel.appendChild(drawerHandle);
    document.body.appendChild(drawerPanel);

    syncUIState();
  }

  function initApp() {
    createSlideDrawerUI();

    document.addEventListener(
      "input",
      (e) => {
        if (
          e.target &&
          (e.target.tagName === "TEXTAREA" || e.target.isContentEditable) &&
          !e.target.closest("#studiocore-drawer-panel")
        ) {
          isTyping = true;
          if (typingTimer) clearTimeout(typingTimer);
          typingTimer = setTimeout(() => {
            isTyping = false;
          }, 800);
        }
      },
      { passive: true, capture: true }
    );

    let debounceTimer;
    const observer = new MutationObserver((mutations) => {
      if (isInternalOp || isTyping) return;

      let hasNewTurn = false;
      for (let i = 0; i < mutations.length; i++) {
        const added = mutations[i].addedNodes;
        for (let j = 0; j < added.length; j++) {
          const n = added[j];
          if (
            n.nodeType === 1 &&
            (n.tagName === "MS-CHAT-TURN" || (n.querySelector && n.querySelector("ms-chat-turn")))
          ) {
            hasNewTurn = true;
            break;
          }
        }
        if (hasNewTurn) break;
      }

      if (hasNewTurn) {
        isReadingHistory = false;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          virtualizeDOM(true);
        }, 300);
      }
    });

    const targetNode =
      document.querySelector("chat-window, ms-chat-window, main, .chat-container") ||
      document.body;
    observer.observe(targetNode, { childList: true, subtree: true });

    virtualizeDOM(true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
})();
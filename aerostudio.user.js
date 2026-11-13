// ==UserScript==
// @name         AeroStudio - Google AI Studio Performance Optimizer
// @description  Stops Google AI Studio from lagging in long chats by unloading old turns from the DOM.
// @namespace    http://tampermonkey.net/
// @version      2.3.0
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
    baseMaxVisible: 2,
    restoreStep: 3,
    chatDomLimit: 1000,
    cacheLimit: 60,
    enabled: true,
    drawerOpen: false,
    drawerPosY: null,
  };

  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      config = { ...config, ...parsed };
    }
  } catch (e) {}

  let detachedPool = [];
  let nodeCountCache = new WeakMap();
  let chatContainerRef = null;
  let chatObserver = null;
  let bootstrapObserver = null;
  let debounceTimer = null;
  let isTyping = false;
  let typingTimer = null;
  let isReadingHistory = false;
  let runtimeMaxVisible = config.baseMaxVisible;
  let lastPathname = location.pathname;

  let uiHostRef = null;
  let uiShadowRef = null;
  let counterLabelRef = null;
  let statusBtnRef = null;
  let domCounterRef = null;
  const inputRegistry = [];

  function saveConfig() {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch (e) {}
  }

  function flushObserver() {
    if (chatObserver) chatObserver.takeRecords();
  }

  function clearPoolMemory() {
    detachedPool = [];
    nodeCountCache = new WeakMap();
    chatContainerRef = null;
    isReadingHistory = false;
    runtimeMaxVisible = config.baseMaxVisible;
  }

  function getMessages() {
    if (chatContainerRef && chatContainerRef.isConnected) {
      return Array.from(chatContainerRef.querySelectorAll(":scope > ms-chat-turn"));
    }
    const turns = Array.from(document.querySelectorAll("ms-chat-turn"));
    if (turns.length > 0 && turns[0].parentElement) {
      chatContainerRef = turns[0].parentElement;
    }
    return turns;
  }

  function getTurnNodeCount(turn, forceRecount = false) {
    if (!forceRecount && nodeCountCache.has(turn)) {
      return nodeCountCache.get(turn);
    }
    const count = 1 + turn.getElementsByTagName("*").length;
    nodeCountCache.set(turn, count);
    return count;
  }

  function getChatDomCount(messages) {
    const list = messages || getMessages();
    let count = 0;
    for (let i = 0; i < list.length; i++) {
      count += getTurnNodeCount(list[i], i === list.length - 1);
    }
    return count;
  }

  function checkRouteChange() {
    if (location.pathname !== lastPathname) {
      lastPathname = location.pathname;
      clearPoolMemory();
      attachObservers();
      syncUIState();
      return true;
    }
    return false;
  }

  function virtualizeDOM(forceTrim = false) {
    if (checkRouteChange()) return;

    if (!config.enabled) {
      if (config.drawerOpen) syncUIState();
      return;
    }

    if (isReadingHistory && !forceTrim) {
      syncUIState();
      return;
    }

    const messages = getMessages();
    if (messages.length === 0) {
      syncUIState();
      return;
    }

    if (!chatContainerRef || !chatContainerRef.isConnected) {
      chatContainerRef = messages[0].parentElement;
      attachObservers();
    }

    let idx = 0;
    let remaining = messages.length;

    while (remaining > runtimeMaxVisible && idx < messages.length - 1) {
      const el = messages[idx];
      if (el && el.parentElement) {
        el.remove();
        detachedPool.push(el);
      }
      idx++;
      remaining--;
    }

    if (config.chatDomLimit > 0) {
      const visibleList = messages.slice(idx);
      let currentChatDom = getChatDomCount(visibleList);

      while (visibleList.length > 1 && currentChatDom > config.chatDomLimit) {
        const el = visibleList.shift();
        if (el && el.parentElement) {
          const elNodes = getTurnNodeCount(el, false);
          el.remove();
          detachedPool.push(el);
          currentChatDom -= elNodes;
        }
      }
    }

    if (detachedPool.length > config.cacheLimit) {
      const excess = detachedPool.length - config.cacheLimit;
      detachedPool.splice(0, excess);
    }

    flushObserver();
    syncUIState();
  }

  function restoreMessages() {
    checkRouteChange();
    if (detachedPool.length === 0) return;

    isReadingHistory = true;

    const count = Math.min(config.restoreStep, detachedPool.length);
    const toRestore = detachedPool.splice(-count);
    const current = getMessages();
    const firstVisible = current[0] || null;
    const container =
      (firstVisible && firstVisible.parentElement) ||
      (chatContainerRef && chatContainerRef.isConnected ? chatContainerRef : null);

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

    runtimeMaxVisible = getMessages().length;
    flushObserver();
    syncUIState();
  }

  function restoreAllMessages() {
    checkRouteChange();
    if (detachedPool.length === 0) {
      syncUIState();
      return;
    }

    isReadingHistory = true;

    const toRestore = detachedPool.splice(0, detachedPool.length);
    const current = getMessages();
    const firstVisible = current[0] || null;
    const container =
      (firstVisible && firstVisible.parentElement) ||
      (chatContainerRef && chatContainerRef.isConnected ? chatContainerRef : null);

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

    runtimeMaxVisible = getMessages().length;
    flushObserver();
    syncUIState();
  }

  function resetToMax() {
    isReadingHistory = false;
    runtimeMaxVisible = config.baseMaxVisible;
    virtualizeDOM(true);
  }

  function syncUIState() {
    if (counterLabelRef) {
      counterLabelRef.textContent = `Restore (${detachedPool.length})`;
    }

    if (domCounterRef && config.drawerOpen) {
      const chatDom = getChatDomCount();
      const totalDom = document.getElementsByTagName("*").length;
      domCounterRef.textContent = `Chat DOM: ${chatDom} | Total: ${totalDom}`;
      domCounterRef.style.color =
        config.chatDomLimit > 0 && chatDom > config.chatDomLimit ? "#ff9800" : "#4caf50";
    }

    const activeEl = uiShadowRef ? uiShadowRef.activeElement : document.activeElement;
    for (let i = 0; i < inputRegistry.length; i++) {
      const { el, key } = inputRegistry[i];
      if (activeEl !== el) {
        el.value = String(config[key]);
      }
    }

    if (statusBtnRef) {
      statusBtnRef.textContent = config.enabled ? "Status: Active" : "Status: Inactive";
      statusBtnRef.style.borderColor = config.enabled ? "#00e5ff" : "#383838";
      statusBtnRef.style.color = config.enabled ? "#00e5ff" : "#777777";
    }
  }

  function createDrawerButton(text, onClick, isPrimary = false) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = text;
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
    span.textContent = label;
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
          runtimeMaxVisible = val;
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
      if (e.key === "Enter") input.blur();
    });

    input.addEventListener("change", (e) => {
      e.stopPropagation();
      commitValue();
    });

    input.addEventListener("blur", commitValue);

    inputRegistry.push({ el: input, key });
    row.appendChild(span);
    row.appendChild(input);
    return row;
  }

  function createSlideDrawerUI() {
    if (!document.body || document.getElementById("studiocore-drawer-host")) return;

    const TRANSITION_HOST_NORMAL = "top 0.2s ease-out";
    const TRANSITION_PANEL = "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)";

    const host = document.createElement("div");
    host.id = "studiocore-drawer-host";
    Object.assign(host.style, {
      position: "fixed",
      right: "0",
      top: config.drawerPosY !== null ? `${config.drawerPosY}px` : "35%",
      zIndex: "2147483647",
      transition: TRANSITION_HOST_NORMAL,
    });

    const shadow = host.attachShadow({ mode: "open" });
    uiHostRef = host;
    uiShadowRef = shadow;

    const drawerPanel = document.createElement("div");
    drawerPanel.id = "studiocore-drawer-panel";
    Object.assign(drawerPanel.style, {
      position: "relative",
      width: "275px",
      background: "#141414",
      padding: "14px",
      border: "1px solid #383838",
      borderRight: "none",
      borderRadius: "12px 0 0 12px",
      color: "#f0f0f0",
      fontFamily: "Consolas, Monaco, monospace",
      fontSize: "12px",
      lineHeight: "1.4",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      boxShadow: "-10px 10px 35px rgba(0,0,0,0.85)",
      boxSizing: "border-box",
      transform: config.drawerOpen ? "translateX(0)" : "translateX(100%)",
      transition: TRANSITION_PANEL,
    });

    const drawerHandle = document.createElement("button");
    drawerHandle.id = "studiocore-drawer-handle";
    drawerHandle.type = "button";
    drawerHandle.textContent = config.drawerOpen ? ">" : "<";
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
      host.style.transition = TRANSITION_HOST_NORMAL;
      if (open) {
        const currentTop = host.getBoundingClientRect().top;
        const panelHeight = drawerPanel.offsetHeight || 310;
        const maxAllowedTop = window.innerHeight - panelHeight - 12;
        if (currentTop > maxAllowedTop) {
          host.style.top = `${Math.max(10, maxAllowedTop)}px`;
        }
      } else {
        host.style.top = config.drawerPosY !== null ? `${config.drawerPosY}px` : "35%";
      }
      drawerPanel.style.transform = open ? "translateX(0)" : "translateX(100%)";
      drawerHandle.textContent = open ? ">" : "<";
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
      initialTop = host.getBoundingClientRect().top;
      host.style.transition = "none";
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
      host.style.top = `${nextY}px`;
    });

    const onPointerEnd = (e) => {
      if (!isDragging) return;
      isDragging = false;
      host.style.transition = TRANSITION_HOST_NORMAL;
      try {
        drawerHandle.releasePointerCapture(e.pointerId);
      } catch (err) {}
      if (hasMoved) {
        config.drawerPosY = Math.round(host.getBoundingClientRect().top);
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
      if (config.drawerOpen && !e.composedPath().includes(host)) {
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
    headerTitle.textContent = "StudioCore v2.3";
    headerTitle.style.fontWeight = "bold";
    headerTitle.style.color = "#00e5ff";

    const headerClose = document.createElement("button");
    headerClose.type = "button";
    headerClose.textContent = "[X]";
    Object.assign(headerClose.style, {
      background: "transparent",
      border: "none",
      color: "#888888",
      cursor: "pointer",
      fontFamily: "Consolas, Monaco, monospace",
      fontSize: "12px",
    });
    headerClose.addEventListener("click", () => setDrawerState(false));

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
      saveConfig();
      if (config.enabled) {
        isReadingHistory = false;
        runtimeMaxVisible = config.baseMaxVisible;
        virtualizeDOM(true);
      } else {
        restoreAllMessages();
      }
      syncUIState();
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
    shadow.appendChild(drawerPanel);
    document.body.appendChild(host);

    if (config.drawerOpen) setDrawerState(true);
    syncUIState();
  }

  function attachObservers() {
    if (chatObserver) {
      chatObserver.disconnect();
      chatObserver = null;
    }

    const firstTurn = document.querySelector("ms-chat-turn");
    if (firstTurn && firstTurn.parentElement) {
      if (bootstrapObserver) {
        bootstrapObserver.disconnect();
        bootstrapObserver = null;
      }
      chatContainerRef = firstTurn.parentElement;
      chatObserver = new MutationObserver((mutations) => {
        if (isTyping || checkRouteChange()) return;

        let shouldUpdate = false;
        for (let i = 0; i < mutations.length; i++) {
          const m = mutations[i];
          if (m.addedNodes.length > 0) {
            for (let j = 0; j < m.addedNodes.length; j++) {
              const n = m.addedNodes[j];
              if (
                n.nodeType === 1 &&
                (n.tagName === "MS-CHAT-TURN" || (n.querySelector && n.querySelector("ms-chat-turn")))
              ) {
                isReadingHistory = false;
                runtimeMaxVisible = config.baseMaxVisible;
                shouldUpdate = true;
                break;
              }
            }
            if (!shouldUpdate && m.target && m.target.nodeType === 1 && m.target.closest("ms-chat-turn")) {
              shouldUpdate = true;
            }
          }
          if (shouldUpdate) break;
        }

        if (shouldUpdate) {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            virtualizeDOM();
          }, 300);
        }
      });
      chatObserver.observe(chatContainerRef, { childList: true, subtree: true });
      return;
    }

    if (!bootstrapObserver && document.body) {
      bootstrapObserver = new MutationObserver(() => {
        if (document.querySelector("ms-chat-turn")) {
          attachObservers();
          virtualizeDOM(true);
        }
      });
      bootstrapObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function initApp() {
    createSlideDrawerUI();

    document.addEventListener(
      "input",
      (e) => {
        if (
          e.target &&
          (e.target.tagName === "TEXTAREA" || e.target.isContentEditable) &&
          !e.composedPath().includes(uiHostRef)
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

    attachObservers();
    virtualizeDOM(true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp, { once: true });
  } else {
    initApp();
  }

  if (window.navigation) {
    window.navigation.addEventListener("navigatesuccess", checkRouteChange);
  } else {
    window.addEventListener("popstate", checkRouteChange);
  }
})();
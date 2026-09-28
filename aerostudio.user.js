// ==UserScript==
// @name         Google AI Studio - StudioCore
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Zero-box native C++ CSS containment, dual desktop inline / mobile modal UI, Zero-Memory-Leak, Debounced Observer
// @match        https://aistudio.google.com/*
// @run-at       document-start
// @author       Mireko
// @icon         https://www.google.com/s2/favicons?sz=64&domain=aistudio.google.com
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // =========================================================================
  // SECTION 1: CONSTANTS & PERSISTENCE
  // =========================================================================
  const CONFIG_KEY = "studiocore_engine_config";
  let config = {
    maxVisible: 6,
    baseMaxVisible: 6,
    restoreStep: 5,
    cacheLimit: 50,
    enabled: true,
    drawerOpen: false,
    drawerPosY: null,
  };

  let detachedPool = [];
  let chatContainerRef = null;

  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) config = { ...config, ...JSON.parse(saved) };
  } catch (e) {}

  function saveConfig() {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  // =========================================================================
  // SECTION 2: BARE-METAL DOM MANAGER (STRICT MEMORY POOL)
  // =========================================================================
  function getMessages() {
    return Array.from(document.querySelectorAll("ms-chat-turn"));
  }

  function virtualizeDOM() {
    if (!config.enabled) return;

    const messages = getMessages();
    if (messages.length === 0) return;

    if (!chatContainerRef && messages[0].parentElement) {
      chatContainerRef = messages[0].parentElement;
    }

    if (messages.length <= config.maxVisible) {
      syncUIState();
      return;
    }

    const toDetachCount = messages.length - config.maxVisible;
    for (let i = 0; i < toDetachCount; i++) {
      const el = messages[i];
      if (el && el.parentElement) {
        el.remove();
        detachedPool.push(el);
      }
    }

    if (detachedPool.length > config.cacheLimit) {
      const excess = detachedPool.length - config.cacheLimit;
      const deadNodes = detachedPool.splice(0, excess);
      for (let i = 0; i < deadNodes.length; i++) {
        deadNodes[i] = null;
      }
    }

    syncUIState();
  }

  function restoreMessages() {
    if (detachedPool.length === 0) return;

    const count = Math.min(config.restoreStep, detachedPool.length);
    config.maxVisible += count;

    const toRestore = detachedPool.splice(-count);
    const referenceNode = document.querySelector("ms-chat-turn");

    if (chatContainerRef) {
      toRestore.forEach((el) => {
        if (referenceNode) {
          chatContainerRef.insertBefore(el, referenceNode);
        } else {
          chatContainerRef.appendChild(el);
        }
      });
    }

    saveConfig();
    syncUIState();
  }

  function restoreAllMessages() {
    if (detachedPool.length === 0) return;

    const count = detachedPool.length;
    config.maxVisible += count;

    const toRestore = detachedPool.splice(0, count);
    const referenceNode = document.querySelector("ms-chat-turn");

    if (chatContainerRef) {
      toRestore.forEach((el) => {
        if (referenceNode) {
          chatContainerRef.insertBefore(el, referenceNode);
        } else {
          chatContainerRef.appendChild(el);
        }
      });
    }

    saveConfig();
    syncUIState();
  }

  function resetToMax() {
    config.maxVisible = config.baseMaxVisible;
    saveConfig();
    virtualizeDOM();
  }

  // =========================================================================
  // SECTION 3: SYNCHRONOUS EXPORTER
  // =========================================================================
  function parseChunkToMarkdown(rootNode) {
    if (!rootNode) return "";
    const clone = rootNode.cloneNode(true);
    const codeBlocks = clone.querySelectorAll("ms-code-block");
    codeBlocks.forEach((block) => {
      const lang = block.getAttribute("data-test-language") || "";
      const codeEl =
        block.querySelector("pre code") || block.querySelector("pre");
      const codeText = codeEl ? codeEl.textContent : block.textContent;
      const markdownCode = document.createTextNode(
        `\n\n\`\`\`${lang}\n${codeText.trim()}\n\`\`\`\n\n`,
      );
      block.replaceWith(markdownCode);
    });
    return clone.textContent.trim();
  }

  function forceFullExport() {
    let markdown = "# Google AI Studio Export\n\n";
    const combinedNodes = [...detachedPool, ...getMessages()];

    combinedNodes.forEach((turnNode) => {
      const textNode = turnNode.querySelector(
        "ms-prompt-chunk, .text-chunk, ms-text-chunk",
      );
      if (!textNode || textNode.textContent.trim() === "") {
        markdown += `\n> *[StudioCore Warning]: Data not loaded by Google Lazy Hydration.*\n\n`;
        return;
      }

      const text = parseChunkToMarkdown(textNode);
      const isUser = turnNode.querySelector('[data-turn-role="User"], .user');

      let thoughts = "";
      const thoughtNode = turnNode.querySelector(
        "ms-thought-chunk .mat-expansion-panel-body, ms-thought-chunk ms-text-chunk",
      );
      if (thoughtNode) thoughts = parseChunkToMarkdown(thoughtNode);

      if (isUser) {
        markdown += `### User\n${text}\n\n`;
      } else {
        markdown += `### Gemini\n`;
        if (thoughts)
          markdown += `<details><summary>Thoughts</summary>\n\n${thoughts}\n</details>\n\n`;
        markdown += `${text}\n\n`;
      }
    });

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.download = `studiocore_export_${timestamp}.md`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // =========================================================================
  // SECTION 4: HARDWARE-ACCELERATED SLIDE-DRAWER INTERFACE (ERGONOMIC & SLEEK)
  // =========================================================================
  let counterLabelRef;
  let statusBtnRef;
  let handleIconRef;
  const inputRegistry = [];

  function syncUIState() {
    const text = `Restore (${detachedPool.length})`;
    if (counterLabelRef) counterLabelRef.innerText = text;

    inputRegistry.forEach(({ el, key }) => {
      if (Number(el.value) !== config[key]) el.value = config[key];
    });

    if (statusBtnRef) {
      statusBtnRef.innerText = config.enabled
        ? "Status: Active"
        : "Status: Inactive";
      statusBtnRef.style.borderColor = config.enabled ? "#666666" : "#383838";
      statusBtnRef.style.color = config.enabled ? "#ffffff" : "#777777";
    }
  }

  function applyConfigChange() {
    if (config.enabled) virtualizeDOM();
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
      const val = parseInt(e.target.value);
      if (!isNaN(val)) {
        config[key] = val;
        if (isBase) config.maxVisible = val;
        applyConfigChange();
      }
    };

    input.addEventListener("input", updateVal);
    input.addEventListener("blur", () => {
      if (isNaN(parseInt(input.value))) input.value = 5;
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
      transition:
        "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), top 0.2s ease-out",
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
        const panelHeight = drawerPanel.offsetHeight || 340;
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

    const onPointerStart = (e) => {
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      isDragging = true;
      hasMoved = false;
      startY = clientY;
      initialTop = drawerPanel.getBoundingClientRect().top;
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - startY;

      if (Math.abs(deltaY) > 4) hasMoved = true;

      let nextY = initialTop + deltaY;

      const maxY = window.innerHeight - 55;
      nextY = Math.max(10, Math.min(nextY, maxY));
      drawerPanel.style.top = `${nextY}px`;
    };

    const onPointerEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      if (hasMoved) {
        config.drawerPosY = Math.round(drawerPanel.getBoundingClientRect().top);
        saveConfig();
      }
    };

    drawerHandle.addEventListener("mousedown", onPointerStart);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerEnd);

    drawerHandle.addEventListener("touchstart", onPointerStart, {
      passive: true,
    });
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("touchend", onPointerEnd);

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
    const exportBtn = createDrawerButton("Export Markdown", forceFullExport);

    drawerPanel.appendChild(
      createDrawerRow("Max Visible:", "baseMaxVisible", true),
    );
    drawerPanel.appendChild(createDrawerRow("Restore Step:", "restoreStep"));
    drawerPanel.appendChild(createDrawerRow("Max History:", "cacheLimit"));

    const divider = document.createElement("div");
    divider.style.borderTop = "1px solid #282828";
    divider.style.margin = "3px 0";
    drawerPanel.appendChild(divider);

    drawerPanel.appendChild(statusBtn);
    drawerPanel.appendChild(restoreRow);
    drawerPanel.appendChild(resetBtn);
    drawerPanel.appendChild(exportBtn);

    drawerPanel.appendChild(drawerHandle);
    document.body.appendChild(drawerPanel);

    syncUIState();
  }

  // =========================================================================
  // SECTION 5: LIFECYCLE INITIALIZATION
  // =========================================================================
  function initApp() {
    createSlideDrawerUI();

    let debounceTimer;
    const observer = new MutationObserver((mutations) => {
      const hasStructuralChange = mutations.some(
        (m) => m.addedNodes.length > 0 || m.removedNodes.length > 0,
      );
      if (hasStructuralChange) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          virtualizeDOM();
        }, 300);
      }
    });

    const targetNode =
      document.querySelector(
        "chat-window, ms-chat-window, main, .chat-container",
      ) || document.body;
    observer.observe(targetNode, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
})();

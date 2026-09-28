// ==UserScript==
// @name         Google AI Studio - StudioCore
// @namespace    http://tampermonkey.net/
// @version      1.1.2
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
  // SECTION 1: CONSTANTS, PERSISTENCE & DATA VAULT
  // =========================================================================
  const UI_CONSTANTS = {
    DESKTOP_Z_INDEX: 999999,
    MOBILE_OVERLAY_Z_INDEX: 1000000,
    MOBILE_HANDLE_Z_INDEX: 999998,
    DEFAULT_MAX_VISIBLE: 10,
  };

  const CONFIG_KEY = "studiocore_engine_config";
  let config = {
    maxVisible: UI_CONSTANTS.DEFAULT_MAX_VISIBLE,
    baseMaxVisible: UI_CONSTANTS.DEFAULT_MAX_VISIBLE,
    restoreStep: 10,
    enabled: true,
    desktopMinimized: false,
    mobilePosY: null,
  };

  let dataVault = [];

  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) config = { ...config, ...JSON.parse(saved) };
  } catch (e) {
    console.error("StudioCore: LocalStorage Read Failed", e);
  }

  function saveConfig() {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }

  // =========================================================================
  // SECTION 2: BARE-METAL C++ CSS HOOK (T=0 ENGINE)
  // =========================================================================
  const dynamicStyle = document.createElement("style");
  dynamicStyle.id = "studiocore-engine-rules";

  function updateDynamicCSS() {
    if (!config.enabled) {
      dynamicStyle.textContent = "";
      return;
    }
    dynamicStyle.textContent = `
            ms-chat-turn:not(:nth-last-child(-n + ${config.maxVisible})) {
                display: none !important;
            }
        `;
  }

  function injectT0() {
    const target = document.head || document.documentElement;
    if (target) {
      target.appendChild(dynamicStyle);
      updateDynamicCSS();
    } else {
      requestAnimationFrame(injectT0);
    }
  }
  injectT0();

  // =========================================================================
  // SECTION 3: STATE CONTROLLER & DEEP DOM NUKE
  // =========================================================================
  function applyConfigChange() {
    updateDynamicCSS();
    syncAllUIState();
    saveConfig();
  }

  function restoreMessages() {
    config.maxVisible += config.restoreStep;
    applyConfigChange();
  }

  function resetToMax() {
    config.maxVisible = config.baseMaxVisible;
    applyConfigChange();
  }

  function showNukeWarning(onConfirm) {
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
      background: "rgba(0, 0, 0, 0.8)", backdropFilter: "blur(4px)", webkitBackdropFilter: "blur(4px)",
      zIndex: "9999999", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px", boxSizing: "border-box", fontFamily: "Consolas, Monaco, monospace"
    });

    const modal = document.createElement("div");
    Object.assign(modal.style, {
      background: "#141414", padding: "20px", borderRadius: "6px", color: "#f0f0f0",
      border: "1px solid #ff4444", boxShadow: "0 12px 40px rgba(255, 0, 0, 0.15)",
      width: "340px", maxWidth: "100%", display: "flex", flexDirection: "column", gap: "12px"
    });

    const title = document.createElement("h3");
    title.innerText = "⚠ SYSTEM WARNING";
    Object.assign(title.style, { margin: "0", color: "#ff4444", fontSize: "16px", fontWeight: "bold" });

    const message = document.createElement("p");
    message.innerHTML = "This action will <b>PURGE</b> all hidden messages from the current DOM tree to free up RAM.<br><br>• UI RESTORATION WILL BE DISABLED.<br>• Data is backed up in memory for Export.<br>• Page refresh (F5) will reload original history.<br><br>Proceed with DOM Nuke?";
    Object.assign(message.style, { margin: "0", color: "#d0d0d0", fontSize: "12px", lineHeight: "1.5" });

    const btnContainer = document.createElement("div");
    Object.assign(btnContainer.style, { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" });

    const cancelBtn = document.createElement("button");
    cancelBtn.innerText = "ABORT";
    Object.assign(cancelBtn.style, {
      padding: "6px 14px", background: "#202020", color: "#888888", border: "1px solid #444",
      borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontFamily: "Consolas, Monaco, monospace", fontSize: "12px"
    });
    cancelBtn.onmouseover = () => { cancelBtn.style.color = "#fff"; cancelBtn.style.background = "#333"; };
    cancelBtn.onmouseout = () => { cancelBtn.style.color = "#888"; cancelBtn.style.background = "#202020"; };

    const confirmBtn = document.createElement("button");
    confirmBtn.innerText = "NUKE IT";
    Object.assign(confirmBtn.style, {
      padding: "6px 14px", background: "#ff4444", color: "#fff", border: "1px solid #ff0000",
      borderRadius: "4px", cursor: "pointer", fontWeight: "bold", textShadow: "0 1px 2px rgba(0,0,0,0.5)", fontFamily: "Consolas, Monaco, monospace", fontSize: "12px"
    });
    confirmBtn.onmouseover = () => { confirmBtn.style.background = "#cc0000"; };
    confirmBtn.onmouseout = () => { confirmBtn.style.background = "#ff4444"; };

    const destroyModal = () => overlay.remove();

    cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); destroyModal(); });
    confirmBtn.addEventListener('click', (e) => { e.stopPropagation(); destroyModal(); onConfirm(); });

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(confirmBtn);
    modal.appendChild(title);
    modal.appendChild(message);
    modal.appendChild(btnContainer);
    overlay.appendChild(modal);

    overlay.addEventListener('click', (e) => {
        if(e.target === overlay) destroyModal();
    });

    document.body.appendChild(overlay);
  }

  function nukeHiddenDOM() {
    if (!config.enabled) return;

    const allTurns = document.querySelectorAll("ms-chat-turn");
    if (allTurns.length <= config.maxVisible) {
        const toast = document.createElement("div");
        toast.innerText = "System: 0 hidden nodes detected. Nuke aborted.";
        Object.assign(toast.style, {
            position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)",
            background: "#333", color: "#fff", padding: "8px 16px", borderRadius: "4px",
            fontFamily: "Consolas, Monaco, monospace", fontSize: "12px", zIndex: "9999999", border: "1px solid #555"
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
        return;
    }

    showNukeWarning(() => {
        const toRemoveCount = allTurns.length - config.maxVisible;
        let nukedCount = 0;

        for (let i = 0; i < toRemoveCount; i++) {
            const turnNode = allTurns[i];
            const textNode = turnNode.querySelector("ms-prompt-chunk, .text-chunk, ms-text-chunk");
            if (textNode) {
                const isUser = turnNode.querySelector('[data-turn-role="User"], .user') !== null;
                const text = parseChunkToMarkdown(textNode);

                let thoughts = "";
                const thoughtNode = turnNode.querySelector("ms-thought-chunk .mat-expansion-panel-body, ms-thought-chunk ms-text-chunk");
                if (thoughtNode) thoughts = parseChunkToMarkdown(thoughtNode);

                dataVault.push({ role: isUser ? "User" : "Gemini", text, thoughts });
            }
            turnNode.remove();
            nukedCount++;
        }

        console.log(`[StudioCore] Nuked ${nukedCount} DOM nodes. Data secured in Vault.`);
        syncAllUIState();
    });
  }

  // =========================================================================
  // SECTION 4: SYNCHRONOUS ZERO-REFLOW EXPORTER (VAULT + DOM)
  // =========================================================================
  function parseChunkToMarkdown(rootNode) {
    if (!rootNode) return "";
    const clone = rootNode.cloneNode(true);

    const codeBlocks = clone.querySelectorAll("ms-code-block");
    codeBlocks.forEach((block) => {
      const lang = block.getAttribute("data-test-language") || "";
      const codeEl = block.querySelector("pre code") || block.querySelector("pre");
      const codeText = codeEl ? codeEl.textContent : block.textContent;

      const markdownCode = document.createTextNode(`\n\n\`\`\`${lang}\n${codeText.trim()}\n\`\`\`\n\n`);
      block.replaceWith(markdownCode);
    });

    return clone.textContent.trim();
  }

  function forceFullExport() {
    let markdown = "# Google AI Studio Export\n\n";

    dataVault.forEach(entry => {
        if (entry.role === "User") {
            markdown += `### User\n${entry.text}\n\n`;
        } else {
            markdown += `### Gemini\n`;
            if (entry.thoughts) markdown += `<details><summary>Thoughts</summary>\n\n${entry.thoughts}\n</details>\n\n`;
            markdown += `${entry.text}\n\n`;
        }
    });

    const nodes = document.querySelectorAll("ms-chat-turn");
    nodes.forEach((turnNode) => {
      const textNode = turnNode.querySelector("ms-prompt-chunk, .text-chunk, ms-text-chunk");
      if (!textNode) return;

      const text = parseChunkToMarkdown(textNode);
      const isUser = turnNode.querySelector('[data-turn-role="User"], .user');

      let thoughts = "";
      const thoughtNode = turnNode.querySelector("ms-thought-chunk .mat-expansion-panel-body, ms-thought-chunk ms-text-chunk");
      if (thoughtNode) thoughts = parseChunkToMarkdown(thoughtNode);

      if (isUser) {
        markdown += `### User\n${text}\n\n`;
      } else {
        markdown += `### Gemini\n`;
        if (thoughts) markdown += `<details><summary>Thoughts</summary>\n\n${thoughts}\n</details>\n\n`;
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
  // SECTION 5: HYBRID RESPONSIVE UI & CROMITE EVENT FIXES
  // =========================================================================
  const uiRegistry = { counters: [], inputs: [], toggles: [] };

  function syncAllUIState() {
    const total = document.querySelectorAll("ms-chat-turn").length;
    const hidden = config.enabled ? Math.max(0, total - config.maxVisible) : 0;
    const text = `Restore (${hidden} hidden)`;

    uiRegistry.counters.forEach(el => el.innerText = text);
    uiRegistry.inputs.forEach(({ el, key }) => {
        if (Number(el.value) !== config[key]) el.value = config[key];
    });
    uiRegistry.toggles.forEach(btn => {
        btn.innerText = config.enabled ? "Status: Active" : "Status: Inactive";
        btn.style.borderColor = config.enabled ? "#666666" : "#444444";
        btn.style.color = config.enabled ? "#ffffff" : "#f0f0f0";
    });
  }

  function createCommonBtn(text, onClick, isPrimary = false) {
    const btn = document.createElement("button");
    btn.innerText = text;
    Object.assign(btn.style, {
      padding: "7px 12px", background: isPrimary ? "#2c2c2c" : "#202020",
      color: isPrimary ? "#ffffff" : "#f0f0f0", border: "1px solid #444444",
      borderRadius: "4px", cursor: "pointer", fontFamily: "Consolas, Monaco, monospace",
      fontSize: "12px", fontWeight: "500", letterSpacing: "0.4px", textAlign: "center",
      transition: "background 0.15s, border-color 0.15s, color 0.15s", touchAction: "manipulation"
    });

    btn.onmouseover = () => { btn.style.background = "#383838"; btn.style.borderColor = "#666666"; btn.style.color = "#ffffff"; };
    btn.onmouseout = () => { btn.style.background = isPrimary ? "#2c2c2c" : "#202020"; btn.style.borderColor = "#444444"; btn.style.color = isPrimary ? "#ffffff" : "#f0f0f0"; };

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onClick) onClick(e);
    });
    return btn;
  }

  function createCommonRow(label, key, isBase = false) {
    const row = document.createElement("div");
    Object.assign(row.style, { display: "flex", justifyContent: "space-between", alignItems: "center" });

    const span = document.createElement("span");
    span.innerText = label;
    span.style.color = "#e0e0e0";

    const input = document.createElement("input");
    input.type = "number";
    input.value = config[key];
    Object.assign(input.style, {
      width: "50px", background: "#1a1a1a", color: "#ffffff", border: "1px solid #444444",
      borderRadius: "3px", textAlign: "center", fontFamily: "Consolas, Monaco, monospace",
      fontSize: "12px", fontWeight: "bold", padding: "3px"
    });

    const updateValue = (e) => {
        e.stopPropagation();
        const val = parseInt(e.target.value);
        if (!isNaN(val)) {
            config[key] = val;
            if (isBase) config.maxVisible = val;
            applyConfigChange();
        }
    };
    input.addEventListener('input', updateValue);
    input.addEventListener('blur', () => { if (isNaN(parseInt(input.value))) input.value = UI_CONSTANTS.DEFAULT_MAX_VISIBLE; });

    uiRegistry.inputs.push({ el: input, key });
    row.appendChild(span);
    row.appendChild(input);
    return row;
  }

  function createUI() {
    const isMobileView = () => window.innerWidth <= 768;

    // --- DESKTOP UI ---
    const desktopWrapper = document.createElement("div");
    desktopWrapper.id = "studiocore-desktop-container";
    Object.assign(desktopWrapper.style, {
      position: "fixed", bottom: "20px", right: "20px", zIndex: UI_CONSTANTS.DESKTOP_Z_INDEX,
      display: "flex", flexDirection: "column-reverse", gap: "8px", alignItems: "flex-end",
    });

    const desktopPanel = document.createElement("div");
    Object.assign(desktopPanel.style, {
      background: "#141414", padding: "14px", borderRadius: "4px", color: "#f0f0f0",
      border: "1px solid #383838", fontFamily: "Consolas, Monaco, monospace", fontSize: "12px",
      display: config.desktopMinimized ? "none" : "flex", flexDirection: "column", gap: "8px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.7)", width: "230px",
    });

    const desktopToggleBtn = createCommonBtn(
      config.desktopMinimized ? "[+] StudioCore" : "[-] Hide",
      () => {
        config.desktopMinimized = !config.desktopMinimized;
        saveConfig();
        desktopPanel.style.display = config.desktopMinimized ? "none" : "flex";
        desktopToggleBtn.innerText = config.desktopMinimized ? "[+] StudioCore" : "[-] Hide";
        if (!config.desktopMinimized) syncAllUIState();
      }, true
    );

    const dtToggleEngineBtn = createCommonBtn("", () => { config.enabled = !config.enabled; applyConfigChange(); });
    uiRegistry.toggles.push(dtToggleEngineBtn);

    const dtRestoreBtn = createCommonBtn("Restore", restoreMessages);
    uiRegistry.counters.push(dtRestoreBtn);

    const dtResetBtn = createCommonBtn("Reset to Base", resetToMax);
    const dtNukeBtn = createCommonBtn("Nuke Hidden DOM", nukeHiddenDOM);
    dtNukeBtn.style.color = "#ff6b6b";
    const dtExportBtn = createCommonBtn("Export Markdown", forceFullExport);

    desktopPanel.appendChild(createCommonRow("Max Visible:", "baseMaxVisible", true));
    desktopPanel.appendChild(createCommonRow("Restore Step:", "restoreStep"));
    const dtDivider = document.createElement("div"); dtDivider.style.borderTop = "1px solid #2b2b2b"; dtDivider.style.margin = "4px 0";
    desktopPanel.appendChild(dtDivider);

    desktopPanel.appendChild(dtToggleEngineBtn);
    desktopPanel.appendChild(dtRestoreBtn);
    desktopPanel.appendChild(dtResetBtn);
    desktopPanel.appendChild(dtNukeBtn);
    desktopPanel.appendChild(dtExportBtn);

    desktopWrapper.appendChild(desktopToggleBtn);
    desktopWrapper.appendChild(desktopPanel);
    document.body.appendChild(desktopWrapper);

    // --- MOBILE UI ---
    const mobileOverlay = document.createElement("div");
    mobileOverlay.id = "studiocore-mobile-overlay";
    Object.assign(mobileOverlay.style, {
      position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
      background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(3px)", webkitBackdropFilter: "blur(3px)",
      zIndex: UI_CONSTANTS.MOBILE_OVERLAY_Z_INDEX, display: "none", alignItems: "center",
      justifyContent: "center", padding: "16px", boxSizing: "border-box",
    });

    const mobileModalBox = document.createElement("div");
    Object.assign(mobileModalBox.style, {
      background: "#141414", padding: "16px", borderRadius: "6px", color: "#f0f0f0",
      border: "1px solid #383838", fontFamily: "Consolas, Monaco, monospace", fontSize: "12px",
      display: "flex", flexDirection: "column", gap: "8px", boxShadow: "0 12px 32px rgba(0,0,0,0.85)",
      width: "260px", maxWidth: "100%", boxSizing: "border-box",
    });

    mobileModalBox.addEventListener('click', (e) => e.stopPropagation());

    function closeMobileModal() { mobileOverlay.style.display = "none"; }
    function openMobileModal() { syncAllUIState(); mobileOverlay.style.display = "flex"; }
    mobileOverlay.addEventListener("click", closeMobileModal);

    const mbHeader = document.createElement("div");
    Object.assign(mbHeader.style, { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2b2b2b", paddingBottom: "6px", marginBottom: "4px" });
    const mbTitle = document.createElement("span"); mbTitle.innerText = "StudioCore Config"; mbTitle.style.fontWeight = "bold"; mbTitle.style.color = "#ffffff";
    const mbCloseBtn = document.createElement("button"); mbCloseBtn.innerText = "[X]";
    Object.assign(mbCloseBtn.style, { background: "transparent", border: "none", color: "#888888", cursor: "pointer", fontFamily: "Consolas, Monaco, monospace", fontSize: "12px", padding: "2px 4px" });
    mbCloseBtn.addEventListener('click', (e) => { e.stopPropagation(); closeMobileModal(); });
    mbHeader.appendChild(mbTitle); mbHeader.appendChild(mbCloseBtn); mobileModalBox.appendChild(mbHeader);

    const mbToggleEngineBtn = createCommonBtn("", () => { config.enabled = !config.enabled; applyConfigChange(); });
    uiRegistry.toggles.push(mbToggleEngineBtn);

    const mbRestoreBtn = createCommonBtn("Restore", restoreMessages);
    uiRegistry.counters.push(mbRestoreBtn);

    const mbResetBtn = createCommonBtn("Reset to Base", resetToMax);
    const mbNukeBtn = createCommonBtn("Nuke Hidden DOM", nukeHiddenDOM);
    mbNukeBtn.style.color = "#ff6b6b";
    const mbExportBtn = createCommonBtn("Export Markdown", forceFullExport);

    mobileModalBox.appendChild(createCommonRow("Max Visible:", "baseMaxVisible", true));
    mobileModalBox.appendChild(createCommonRow("Restore Step:", "restoreStep"));
    const mbDivider = document.createElement("div"); mbDivider.style.borderTop = "1px solid #2b2b2b"; mbDivider.style.margin = "4px 0";
    mobileModalBox.appendChild(mbDivider);

    mobileModalBox.appendChild(mbToggleEngineBtn);
    mobileModalBox.appendChild(mbRestoreBtn);
    mobileModalBox.appendChild(mbResetBtn);
    mobileModalBox.appendChild(mbNukeBtn);
    mobileModalBox.appendChild(mbExportBtn);

    mobileOverlay.appendChild(mobileModalBox);
    document.body.appendChild(mobileOverlay);

    // --- MOBILE HANDLE ---
    const mobileHandle = document.createElement("button");
    mobileHandle.id = "studiocore-mobile-handle";
    mobileHandle.innerText = "<";
    Object.assign(mobileHandle.style, {
      position: "fixed", right: "0", top: config.mobilePosY !== null ? `${config.mobilePosY}px` : "55%",
      zIndex: UI_CONSTANTS.MOBILE_HANDLE_Z_INDEX, padding: "10px 4px", background: "rgba(26, 26, 26, 0.92)",
      backdropFilter: "blur(4px)", webkitBackdropFilter: "blur(4px)", color: "#e0e0e0",
      border: "1px solid #444444", borderRight: "none", borderRadius: "4px 0 0 4px", cursor: "pointer",
      fontFamily: "Consolas, Monaco, monospace", fontSize: "12px", fontWeight: "bold", lineHeight: "1",
      boxShadow: "-2px 2px 8px rgba(0,0,0,0.5)", userSelect: "none", webkitUserSelect: "none", touchAction: "none",
    });

    let isDragging = false, hasMoved = false, startClientY = 0, initialTop = 0;
    const onTouchMove = (e) => {
      if (!isDragging) return;
      const deltaY = e.touches[0].clientY - startClientY;
      if (Math.abs(deltaY) > 4) hasMoved = true;
      let nextY = initialTop + deltaY;
      const maxY = window.innerHeight - mobileHandle.offsetHeight - 10;
      mobileHandle.style.top = `${Math.max(10, Math.min(nextY, maxY))}px`;
    };
    const onTouchEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      if (hasMoved) { config.mobilePosY = Math.round(mobileHandle.getBoundingClientRect().top); saveConfig(); }
    };
    const onTouchStart = (e) => {
      isDragging = true; hasMoved = false; startClientY = e.touches[0].clientY;
      initialTop = mobileHandle.getBoundingClientRect().top;
      document.addEventListener("touchmove", onTouchMove, { passive: true });
      document.addEventListener("touchend", onTouchEnd);
    };

    mobileHandle.addEventListener("touchstart", onTouchStart, { passive: true });
    mobileHandle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (hasMoved) { e.preventDefault(); return; }
      openMobileModal();
    });

    document.body.appendChild(mobileHandle);

    // --- VIEWPORT ROUTER ---
    function syncViewportMode() {
      const mobile = isMobileView();
      desktopWrapper.style.display = mobile ? "none" : "flex";
      mobileHandle.style.display = mobile ? "block" : "none";
      if (!mobile && mobileOverlay.style.display === "flex") closeMobileModal();
      syncAllUIState();
    }

    window.addEventListener("resize", syncViewportMode);
    syncViewportMode();
  }

  // =========================================================================
  // SECTION 6: LIFECYCLE & DEBOUNCED MUTATION OBSERVER
  // =========================================================================
  function initApp() {
    createUI();
    syncAllUIState();

    let debounceTimer;
    const observer = new MutationObserver((mutations) => {
      const hasStructuralChange = mutations.some(m => m.addedNodes.length > 0 || m.removedNodes.length > 0);
      if (hasStructuralChange) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { syncAllUIState(); }, 300);
      }
    });

    const targetNode = document.querySelector("chat-window, ms-chat-window, main, .chat-container") || document.body;
    observer.observe(targetNode, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
})();

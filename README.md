# StudioCore

**A High-Performance Optimization Engine for Google AI Studio**

StudioCore is a production-grade Tampermonkey userscript engineered to resolve critical performance degradation and browser freezing within Google AI Studio (aistudio.google.com) during extended, high-context sessions. 

---

## Table of Contents
- [For End-Users](#for-end-users)
  - [Installation](#installation)
  - [Configuration & Controls Guide](#configuration--controls-guide)
- [For Developers (Technical Deep-Dive)](#for-developers-technical-deep-dive)
  - [The Problem](#the-problem-why-google-ai-studio-lags)
  - [Architecture & Mechanics](#architecture--mechanics)
  - [Privacy & Security Audit](#privacy--security-audit)
- [License](#license)

---

## For End-Users

If you just want to stop Google AI Studio from lagging and freezing your browser, this section is for you.

### Installation

1. Install a user script manager extension (e.g., [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)) for your Chromium-based browser.
2. Add the Aerostudio.user.js script to your manager.
3. Ensure the script is configured to inject at document-start to guarantee early initialization.
4. Navigate to Google AI Studio. The optimizations will apply automatically.

### Configuration & Controls Guide

Once installed, StudioCore operates autonomously in the background. To access the control panel, click or tap the edge handle (<) on the right side of the screen to open the **Slide-Drawer interface**.

#### Input Parameters
Fine-tune these parameters based on your machine's hardware capabilities:
- **Max Visible:** The maximum number of conversational turns to keep rendered on-screen at any given time. Lower values (e.g., 6) ensure maximum performance on low-end devices, while higher values keep more context visible.
- **Restore Step:** The number of historical messages to restore into the view when clicking the "Restore" button.
- **Memory Buffer:** The safety threshold before StudioCore begins aggressively moving old nodes into the detached memory pool to save RAM.

#### Control Buttons
- **Status (Active / Inactive):** Completely toggles the StudioCore engine on or off. When inactive, Google AI Studio behaves exactly as default (warning: may cause browser lag in heavy sessions).
- **Restore:** Recovers a specific chunk of older messages from the memory pool back into the visible chat (quantity determined by the *Restore Step* value).
- **Restore All:** Instantly forces all hidden/detached messages back onto the screen. Use this if you need to read the entire chat history at once.
- **Reset to Base:** Clears the screen of older restored messages, re-hiding them to instantly regain smooth performance, keeping only the most recent *Max Visible* messages.

---

## For Developers (Technical Deep-Dive)

This section explains the under-the-hood mechanics for developers looking to understand or contribute to the source code.

### The Problem (Why Google AI Studio Lags)

Google AI Studio relies heavily on an Angular and Web Components architecture. During extended chat sessions—especially those approaching or exceeding 1,000,000 tokens—the application exhibits severe performance degradation, often leading to total browser unresponsiveness.

This failure state is triggered by the simultaneous mounting of over 145,000 DOM nodes. The sheer volume of rendered components forces continuous layout recalculations and triggers resize observer storms within the browser. The default behavior attempts to render off-screen conversational turns, which saturates the main thread and exhausts layout resources, rendering the interface completely unusable.

### Architecture & Mechanics

StudioCore addresses these architectural bottlenecks through three primary mechanisms:

1. **T=0 Native DOM Virtualization:**
   StudioCore operates at document-start, injecting aggressive CSS containment rules and dynamically managing the DOM tree. It enforces display: none !important and explicitly unmounts off-screen conversational turns to completely bypass layout thrashing that typically plagues high-node-count pages.

2. **Preserves In-Memory State (Zero-Memory-Leak):**
   Naive solutions often attempt to permanently delete DOM nodes to improve performance. This approach catastrophically breaks Angular's internal state management and disrupts the two-way auto-save synchronization with Google Drive. StudioCore strictly preserves all nodes in an internal memory pool (Detached Pool), ensuring zero data loss and absolute application stability.

3. **Hardware-Accelerated Slide-Drawer Interface:**
   The script deploys a sleek, non-intrusive drawer panel docked to the right edge of the viewport. It leverages GPU-accelerated CSS transitions (	ransform: translateX) and smart overflow adjustments to ensure the controls remain accessible without obstructing the chat input or main interface, seamlessly adapting to both Desktop and Mobile environments.

### Privacy & Security Audit

StudioCore is designed with uncompromising security standards for enterprise and confidential workflows.

- **100% Client-Side Execution:** The script operates entirely within the local browser environment.
- **Zero External Network Requests:** No telemetry, analytics, or external asset loading is performed.
- **Zero Credential Access:** The script does not read, access, or interact with session cookies, authentication tokens, or local storage credentials.
- **Data Integrity:** Session data never leaves the Google AI Studio domain.

---

## License

Please refer to the repository's LICENSE file for terms of use and distribution.

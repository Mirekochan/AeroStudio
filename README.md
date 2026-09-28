# StudioCore

**A High-Performance Optimization Engine for Google AI Studio**

StudioCore is a production-grade Tampermonkey userscript engineered to resolve critical performance degradation and browser freezing within Google AI Studio (aistudio.google.com) during extended, high-context sessions. By implementing native Chromium CSS containment at the layout engine level and leveraging synchronous zero-reflow extraction mechanisms, StudioCore stabilizes the environment for million-token contexts without compromising state synchronization or data integrity.

## The Problem (Why Google AI Studio Lags)

Google AI Studio relies heavily on an Angular and Web Components architecture. During extended chat sessions—especially those approaching or exceeding 1,000,000 tokens—the application exhibits severe performance degradation, often leading to total browser unresponsiveness.

This failure state is triggered by the simultaneous mounting of over 145,000 DOM nodes. The sheer volume of rendered components forces continuous layout recalculations and triggers resize observer storms within the browser. The default behavior attempts to render off-screen conversational turns, which saturates the main thread and exhausts layout resources, rendering the interface completely unusable.

## How StudioCore Works (Architecture & Technical Deep-Dive)

StudioCore addresses these architectural bottlenecks through four primary mechanisms:

1. **T=0 Native C++ CSS Containment:**
   StudioCore operates at document-start, injecting aggressive CSS containment rules. It utilizes the `:nth-last-child` pseudo-class to enforce `display: none !important` directly at the Chromium layout engine level for off-screen conversational turns. This eliminates render boxes for historical messages before DOM mounting occurs, completely bypassing the layout thrashing that typically plagues high-node-count pages.

2. **Preserves In-Memory State:**
   Naive solutions often attempt to delete DOM nodes (`el.remove()`) to improve performance. This approach catastrophically breaks Angular's internal state management and disrupts the two-way auto-save synchronization with Google Drive. StudioCore strictly preserves all nodes in memory, merely hiding them from the layout tree. This ensures zero data loss and maintains absolute application stability.

3. **Synchronous Zero-Reflow Markdown Export:**
   Extracting conversation history natively triggers massive reflows. StudioCore implements an in-memory DOM substitution approach on cloned nodes to preserve code blocks and precise formatting. It extracts text synchronously via the `.textContent` API without triggering reflows, arbitrary timeouts, or race conditions.

4. **Hybrid Dual-Engine UI:**
   The script dynamically detects viewport width to present contextually appropriate controls:
   - **Desktop Environment (>768px):** Deploys a non-intrusive, inline control panel anchored to the bottom-right of the viewport.
   - **Mobile Environment (<=768px):** Docks an edge handle ("<") on the right border. Interaction opens a centered modal dialog backed by a blur effect, ensuring the mobile input box and send buttons remain completely unobstructed at all times.

## Privacy & Security Audit

StudioCore is designed with uncompromising security standards for enterprise and confidential workflows.

- **100% Client-Side Execution:** The script operates entirely within the local browser environment.
- **Zero External Network Requests:** No telemetry, analytics, or external asset loading is performed.
- **Zero Credential Access:** The script does not read, access, or interact with session cookies, authentication tokens, or local storage credentials.
- **Data Integrity:** Session data never leaves the Google AI Studio domain.

## User Guide & Interface Controls

Once installed, StudioCore operates autonomously in the background to stabilize the layout engine. A user interface is provided for manual controls and export functionality.

- **Desktop Interface:** Locate the inline control panel at the bottom-right corner of the browser window. This panel provides immediate access to layout toggles and the synchronous markdown export functionality.
- **Mobile Interface:** Look for the docked edge handle ("<") on the right side of the screen. Tapping this handle reveals a centered modal overlay containing the control suite, designed specifically to avoid overlapping critical input areas.

## Installation & Configuration

1. Install a user script manager extension (e.g., Tampermonkey or Violentmonkey) for your Chromium-based browser.
2. Add the `studiocore.user.js` script to your manager.
3. Ensure the script is configured to inject at `document-start` to guarantee the T=0 CSS containment initialization.
4. Navigate to Google AI Studio. The optimizations will apply automatically.

## Verification & Benchmarks

To verify StudioCore is operating correctly:

1. Open Google AI Studio and load a lengthy chat history.
2. Open the browser Developer Tools (F12) and navigate to the Elements panel.
3. Inspect the conversational turn elements. Older messages should be present in the DOM but hidden via the injected CSS containment rules, with no layout boxes rendered.
4. Attempt a markdown export. The extraction should complete instantaneously without browser lag.

## License

Please refer to the repository's LICENSE file for terms of use and distribution.

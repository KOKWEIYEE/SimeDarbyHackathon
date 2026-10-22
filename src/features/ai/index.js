import './styles.css';

export {
  callAiChatApi,
  isAiApiConfigured,
  getAiApiConfig,
} from './aiService.js';

export {
  validateUserInput,
  detectAccessibilityIntent,
} from './securityGuardrails.js';

export function initAiFeature({ app, aiPanel }) {
  let compactPanelMode = 'b';
  let isFullSize = false;

  function syncPanelControls() {
    const compactSizeToggle = document.getElementById('compact-size-toggle');
    const fullSizeToggle = document.getElementById('full-size-toggle');

    if (compactSizeToggle) {
      compactSizeToggle.textContent = compactPanelMode === 'a' ? '→' : '←';
      compactSizeToggle.setAttribute('aria-label', compactPanelMode === 'a' ? 'Switch to left panel' : 'Switch to minimized panel');
    }

    if (fullSizeToggle) {
      fullSizeToggle.textContent = isFullSize ? '⤡' : '⤢';
      fullSizeToggle.setAttribute('aria-label', isFullSize ? 'Return to compact chat panel' : 'Toggle full size chat panel');
    }
  }

  function applyCompactPanelMode() {
    aiPanel.classList.toggle('minimized', compactPanelMode === 'a');
    aiPanel.classList.toggle('left-panel', compactPanelMode === 'b');
  }

  function toggleCompact() {
    compactPanelMode = compactPanelMode === 'b' ? 'a' : 'b';

    if (!isFullSize) {
      applyCompactPanelMode();
    }

    syncPanelControls();
  }

  function toggleFullSize() {
    if (isFullSize) {
      isFullSize = false;
      app.classList.remove('chat-only');
      aiPanel.classList.remove('expanded');
      applyCompactPanelMode();
      aiPanel.style.width = '';
      aiPanel.style.height = '';
      syncPanelControls();
      return;
    }

    isFullSize = true;
    app.classList.add('chat-only');
    aiPanel.classList.add('expanded');
    aiPanel.classList.remove('minimized');
    aiPanel.classList.remove('left-panel');
    aiPanel.style.width = '';
    aiPanel.style.height = '';
    syncPanelControls();
  }

  function initControls() {
    const compactSizeToggle = document.getElementById('compact-size-toggle');
    const fullSizeToggle = document.getElementById('full-size-toggle');
    const sendBtn = document.getElementById('send-btn');

    compactSizeToggle?.addEventListener('click', toggleCompact);
    fullSizeToggle?.addEventListener('click', toggleFullSize);

    sendBtn?.addEventListener('click', () => {
      const input = document.getElementById('ai-input');
      if (!input || !input.value.trim()) return;
      input.value = '';
    });

    applyCompactPanelMode();
    syncPanelControls();
  }

  return {
    initControls,
    toggleCompact,
    toggleFullSize,
  };
}

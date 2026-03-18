document.addEventListener('DOMContentLoaded', () => {
  const componentsInput = document.getElementById('components-input');
  const delayInput = document.getElementById('delay-input');
  const btnFill = document.getElementById('btn-fill');
  const btnClear = document.getElementById('btn-clear');
  const statusContainer = document.getElementById('status-container');
  const progressBar = document.getElementById('progress-bar');
  const statusText = document.getElementById('status-text');
  const errorContainer = document.getElementById('error-container');
  const errorText = document.getElementById('error-text');
  const historyList = document.getElementById('history-list');
  const btnClearHistory = document.getElementById('btn-clear-history');

  let isProcessing = false;

  chrome.storage.local.get(['delay'], (result) => {
    if (result.delay) {
      delayInput.value = result.delay;
    }
  });

  delayInput.addEventListener('change', () => {
    chrome.storage.local.set({ delay: parseInt(delayInput.value, 10) });
  });

  loadHistory();

  function parseComponents(text) {
    return text
      .split(/[\n,]+/)
      .map(c => c.trim())
      .filter(c => c.length > 0);
  }

  function sendToContentScript(message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
          reject(new Error('Aucun onglet actif trouvé'));
          return;
        }
        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            files: ['content/content.js']
          },
          () => {
            if (chrome.runtime.lastError) { /* noop */ }
            chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(response);
              }
            });
          }
        );
      });
    });
  }

  function showStatus() {
    statusContainer.classList.remove('hidden');
  }

  function hideError() {
    errorContainer.classList.add('hidden');
    errorText.textContent = '';
  }

  function showError(msg) {
    errorContainer.classList.remove('hidden');
    errorText.textContent = msg;
  }

  function updateProgress(current, total, componentName, status) {
    showStatus();
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    progressBar.style.width = pct + '%';

    statusText.className = 'status-text';
    if (status === 'done') {
      statusText.textContent = '\u2705 Terminé ! ' + current + '/' + total + ' composants ajoutés.';
      statusText.classList.add('success');
    } else if (status === 'error') {
      statusText.textContent = '\u26a0\ufe0f ' + componentName + ' \u2014 non trouvé, passage au suivant...';
      statusText.classList.add('error');
    } else {
      statusText.textContent = '\u23f3 ' + current + '/' + total + ' \u2014 ajout de "
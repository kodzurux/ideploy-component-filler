(function () {
  'use strict';

  if (window.__iDeployFillerInjected) return;
  window.__iDeployFillerInjected = true;

  const INPUT_SELECTOR = 'input[id="Composants (gel)"]';

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;

  function getInput() {
    return document.querySelector(INPUT_SELECTOR);
  }

  function getContainer(input) {
    let el = input;
    while (el) {
      if (el.className && el.className.toString().includes('container')) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function waitFor(conditionFn, timeout, interval) {
    timeout = timeout || 3000;
    interval = interval || 50;
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const result = conditionFn();
        if (result) {
          resolve(result);
        } else if (Date.now() - start > timeout) {
          reject(new Error('Timeout'));
        } else {
          setTimeout(check, interval);
        }
      };
      check();
    });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function focusInput(input) {
    input.focus();
    input.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    const control = input.closest('[class*="control"]');
    if (control) {
      control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      control.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      control.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  }

  function typeInInput(input, text) {
    nativeInputValueSetter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clearInput(input) {
    nativeInputValueSetter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findMenu() {
    return document.querySelector('[class*="menu"]');
  }

  function findOptions() {
    const menu = findMenu();
    if (!menu) return [];
    return Array.from(menu.querySelectorAll('[class*="option"]'));
  }

  function isAlreadySelected(input, componentName) {
    const container = getContainer(input);
    if (!container) return false;
    const removeButtons = container.querySelectorAll('div[role="button"][aria-label]');
    for (const btn of removeButtons) {
      const ariaLabel = btn.getAttribute('aria-label') || '';
      if (ariaLabel.toLowerCase() === 'remove ' + componentName.toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  function getSelectedCount(input) {
    const container = getContainer(input);
    if (!container) return 0;
    return container.querySelectorAll('[class*="multiValue"]').length;
  }

  async function addComponent(componentName) {
    const input = getInput();
    if (!input) {
      throw new Error('Champ "Composants (gel)" non trouvé sur cette page.');
    }

    if (isAlreadySelected(input, componentName)) {
      return { success: true, alreadyExists: true };
    }

    const countBefore = getSelectedCount(input);

    focusInput(input);
    await sleep(100);

    typeInInput(input, componentName);

    try {
      await waitFor(() => {
        const options = findOptions();
        return options.length > 0 ? options : null;
      }, 2000);
    } catch (e) {
      clearInput(input);
      throw new Error('Aucune suggestion trouvée pour "' + componentName + '".');
    }

    await sleep(100);

    const options = findOptions();
    let matched = false;

    for (const opt of options) {
      const optText = opt.textContent.trim().toLowerCase();
      if (optText === componentName.toLowerCase() || optText.includes(componentName.toLowerCase())) {
        opt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        opt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        opt.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        matched = true;
        break;
      }
    }

    if (!matched && options.length > 0) {
      input.dispatchEvent(
        new KeyboardEvent('keyDown', {
          key: 'Enter',
          keyCode: 13,
          code: 'Enter',
          which: 13,
          bubbles: true
        })
      );
    }

    try {
      await waitFor(() => {
        return getSelectedCount(input) > countBefore;
      }, 2000);
      return { success: true };
    } catch (e) {
      input.dispatchEvent(
        new KeyboardEvent('keyDown', {
          key: 'Enter',
          keyCode: 13,
          code: 'Enter',
          which: 13,
          bubbles: true
        })
      );
      await sleep(500);
      if (getSelectedCount(input) > countBefore) {
        return { success: true };
      } else {
        clearInput(input);
        throw new Error('Impossible d\'ajouter "' + componentName + '".');
      }
    }
  }

  async function clearAllComponents() {
    const input = getInput();
    if (!input) {
      throw new Error('Champ "Composants (gel)" non trouvé sur cette page.');
    }

    const container = getContainer(input);
    if (!container) {
      throw new Error('Container react-select non trouvé.');
    }

    const clearIndicators = container.querySelectorAll('[class*="indicatorContainer"]');
    for (const indicator of clearIndicators) {
      const svg = indicator.querySelector('svg');
      if (svg) {
        const paths = svg.querySelectorAll('path');
        for (const path of paths) {
          const d = path.getAttribute('d') || '';
          if (d.includes('14.348')) {
            indicator.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            indicator.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            indicator.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await sleep(300);
            return { success: true, removed: 'tous les' };
          }
        }
      }
    }

    let removed = 0;
    let removeButtons = container.querySelectorAll('div[role="button"][aria-label^="Remove"]');

    while (removeButtons.length > 0) {
      const btn = removeButtons[0];
      btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      removed++;
      await sleep(200);
      removeButtons = container.querySelectorAll('div[role="button"][aria-label^="Remove"]');
    }

    return { success: true, removed: removed };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'addComponent') {
      addComponent(message.component)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.action === 'clearAll') {
      clearAllComponents()
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.action === 'ping') {
      sendResponse({ success: true });
      return false;
    }
  });
})();
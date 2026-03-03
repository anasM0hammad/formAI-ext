let isPickerActive = false;

// Enhanced label detection with aria attributes, placeholder, and nearby text
function findNearestLabel(inputElement: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string | null {
  // Check aria-label first (common in modern frameworks like Workday)
  const ariaLabel = inputElement.getAttribute('aria-label');
  if(ariaLabel?.trim()) return ariaLabel.trim();

  // Check aria-labelledby
  const ariaLabelledBy = inputElement.getAttribute('aria-labelledby');
  if(ariaLabelledBy) {
    const labelEl = document.getElementById(ariaLabelledBy);
    if(labelEl?.textContent?.trim()) return labelEl.textContent.trim();
  }

  // Check if label wraps the input
  const parentLabel = inputElement.closest('label');
  if(parentLabel?.textContent?.trim()) return parentLabel.textContent.trim();

  // Check for label with matching 'for' attribute
  const inputId = inputElement.id;
  if(inputId) {
    const labelByFor = document.querySelector(`label[for="${inputId}"]`);
    if(labelByFor?.textContent?.trim()) return labelByFor.textContent.trim();
  }

  // Check placeholder attribute
  const placeholder = inputElement.getAttribute('placeholder');
  if(placeholder?.trim()) return placeholder.trim();

  // Check title attribute
  const title = inputElement.getAttribute('title');
  if(title?.trim()) return title.trim();

  // Find previous sibling label
  let prevSibling = inputElement.previousElementSibling;
  while(prevSibling) {
    if(prevSibling.tagName === 'LABEL' && prevSibling.textContent?.trim()) {
      return prevSibling.textContent.trim();
    }
    prevSibling = prevSibling.previousElementSibling;
  }

  // Find label in parent's previous siblings
  let parent = inputElement.parentElement;
  while(parent) {
    let prevParentSibling = parent.previousElementSibling;
    while(prevParentSibling) {
      if(prevParentSibling.tagName === 'LABEL' && prevParentSibling.textContent?.trim()) {
        return prevParentSibling.textContent.trim();
      }
      const labelInside = prevParentSibling.querySelector('label');
      if(labelInside?.textContent?.trim()) return labelInside.textContent.trim();

      // Check nearby span or div text
      const textEl = prevParentSibling.querySelector('span, div');
      if(textEl?.textContent?.trim()) return textEl.textContent.trim();

      prevParentSibling = prevParentSibling.previousElementSibling;
    }
    parent = parent.parentElement;
  }

  // Fallback to name attribute (convert field_name to readable text)
  const name = inputElement.getAttribute('name');
  if(name) return name.replace(/[_\-\[\]]/g, ' ').trim();

  return null;
}

// Detect the framework used on the page for optimal form filling strategy
function detectFramework(): 'react' | 'vue' | 'angular' | 'vanilla' {
  const body = document.querySelector('body');
  if(!body) return 'vanilla';

  // React detection
  if(document.querySelector('[data-reactroot]') ||
     document.querySelector('[data-reactid]') ||
     Object.keys(body).some(k => k.startsWith('__react'))) {
    return 'react';
  }

  // Vue detection
  if(document.querySelector('[data-v-]') || (body as any).__vue_app__) {
    return 'vue';
  }

  // Angular detection
  if(document.querySelector('[ng-version]') || document.querySelector('[_nghost]')) {
    return 'angular';
  }

  return 'vanilla';
}

function fillSelectElement(element: HTMLSelectElement, value: string): void {
  element.value = value;

  // If no exact match, try case-insensitive text/value matching
  if(element.value !== value) {
    const options = Array.from(element.options);
    const matchingOption = options.find(opt =>
      opt.text.toLowerCase().includes(value.toLowerCase()) ||
      opt.value.toLowerCase().includes(value.toLowerCase())
    );
    if(matchingOption) {
      element.value = matchingOption.value;
    }
  }

  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function fillInputElement(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const framework = detectFramework();

  if(framework === 'react') {
    // React overrides the value setter, use the native prototype setter
    const prototype = element instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if(nativeSetter) {
      nativeSetter.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // Vue, Angular, and vanilla - standard approach
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function fillElement(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string): void {
  try {
    element.focus();

    if(element instanceof HTMLSelectElement) {
      fillSelectElement(element, value);
    } else if(element instanceof HTMLInputElement) {
      const inputType = element.type.toLowerCase();
      if(inputType === 'checkbox' || inputType === 'radio') {
        element.checked = value === 'true' || value === '1' || value.toLowerCase() === 'yes';
        element.dispatchEvent(new Event('change', { bubbles: true }));
      } else if(inputType === 'file') {
        return;
      } else {
        fillInputElement(element, value);
      }
    } else if(element instanceof HTMLTextAreaElement) {
      fillInputElement(element, value);
    }

    element.dispatchEvent(new Event('blur', { bubbles: true }));
  } catch(error) {
    console.error('Error in fillElement:', error);
  }
}

// Inject loading/status CSS into the page
function injectStyles(): void {
  if(document.getElementById('formai-styles')) return;

  const style = document.createElement('style');
  style.id = 'formai-styles';
  style.textContent = `
    @keyframes formai-pulse {
      0%, 100% { box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.4); }
      50% { box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.2); }
    }
    .formai-loading {
      animation: formai-pulse 1.5s ease-in-out infinite !important;
      outline: 2px solid #667eea !important;
      outline-offset: 1px;
    }
    .formai-success {
      outline: 2px solid #22c55e !important;
      outline-offset: 1px;
      transition: outline-color 0.3s ease;
    }
    .formai-error {
      outline: 2px solid #ef4444 !important;
      outline-offset: 1px;
      transition: outline-color 0.3s ease;
    }
    .formai-status-bar {
      position: fixed;
      bottom: 16px;
      right: 16px;
      background: #1a1a2e;
      color: #e4e4e7;
      padding: 10px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .formai-status-bar:hover {
      background: #252538;
    }
  `;
  document.head.appendChild(style);
}

function setFieldState(element: HTMLElement, state: 'loading' | 'success' | 'error' | 'none'): void {
  element.classList.remove('formai-loading', 'formai-success', 'formai-error');
  if(state !== 'none') {
    element.classList.add(`formai-${state}`);
  }

  // Auto-clear success/error visual states after 3 seconds
  if(state === 'success' || state === 'error') {
    setTimeout(() => {
      element.classList.remove(`formai-${state}`);
    }, 3000);
  }
}

function showStatusBar(message: string): void {
  let bar = document.getElementById('formai-status-bar');
  if(!bar) {
    bar = document.createElement('div');
    bar.id = 'formai-status-bar';
    bar.className = 'formai-status-bar';
    bar.addEventListener('click', () => bar?.remove());
    document.body.appendChild(bar);
  }
  bar.textContent = message;

  setTimeout(() => bar?.remove(), 5000);
}

async function askLLM(label: string): Promise<string> {
  const answer = await chrome.runtime.sendMessage({
    type: 'askLLM',
    data: { label }
  });

  if(!answer.status) {
    throw new Error(answer.error || 'LLM request failed');
  }

  return answer.response ? answer.response.trim() : '';
}

async function handleClick(e: MouseEvent) {
  if(!isPickerActive) return;

  const clickedElement = e.target as HTMLElement;
  const tagName = clickedElement.tagName.toLowerCase();

  if(tagName !== 'input' && tagName !== 'select' && tagName !== 'textarea') return;

  const formElement = clickedElement as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  const label = findNearestLabel(formElement);

  if(!label) {
    showStatusBar('FormAI: Could not identify this field');
    return;
  }

  // Show loading state on the field
  setFieldState(clickedElement, 'loading');

  try {
    const answer = await askLLM(label);

    if(answer && answer.length && answer !== 'null') {
      fillElement(formElement, answer);
      setFieldState(clickedElement, 'success');
    } else {
      // Skip the field instead of filling "NA"
      setFieldState(clickedElement, 'error');
      showStatusBar(`FormAI: Could not fill "${label}" - no matching data`);
    }
  } catch(_error) {
    // Skip the field instead of filling "Error"
    setFieldState(clickedElement, 'error');
    showStatusBar('FormAI: Failed to get AI response');
  }
}

function startElementPicker() {
  isPickerActive = true;
  injectStyles();
  chrome.storage.local.set({ picker: true });
  document.body.style.cursor = 'crosshair';
  document.addEventListener('click', handleClick, true);
}

function stopElementPicker() {
  isPickerActive = false;
  chrome.storage.local.set({ picker: false });
  document.body.style.cursor = '';
  document.removeEventListener('click', handleClick, true);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  switch(request.type) {
    case 'START_PICKER':
      startElementPicker();
      sendResponse({ status: true });
      break;
    case 'STOP_PICKER':
      stopElementPicker();
      sendResponse({ status: true });
      break;
    default:
      sendResponse({ status: false, error: 'No type matched' });
  }
  return true;
});

// Initialize picker state from storage
const initContentScript = () => {
  chrome.storage.local.get(['picker'], (result) => {
    if(result.picker) {
      isPickerActive = true;
      injectStyles();
      document.body.style.cursor = 'crosshair';
      document.addEventListener('click', handleClick, true);
    }
  });
};

if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript();
}

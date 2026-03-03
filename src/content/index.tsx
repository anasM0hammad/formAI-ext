let isPickerActive = false;

// --- Types ---

interface FieldRequest {
  id: string;
  label: string;
}

interface FieldResult {
  id: string;
  value: string | null;
  confidence: 'direct' | 'llm' | 'failed';
}

// --- Label Detection (F-017) ---

function findNearestLabel(inputElement: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string | null {
  // 1. aria-label (modern frameworks like Workday)
  const ariaLabel = inputElement.getAttribute('aria-label');
  if(ariaLabel?.trim()) return ariaLabel.trim();

  // 2. aria-labelledby (reference to label elements)
  const ariaLabelledBy = inputElement.getAttribute('aria-labelledby');
  if(ariaLabelledBy) {
    const ids = ariaLabelledBy.split(/\s+/);
    const texts = ids.map(id => document.getElementById(id)?.textContent?.trim()).filter(Boolean);
    if(texts.length) return texts.join(' ');
  }

  // 3. Wrapping label element
  const parentLabel = inputElement.closest('label');
  if(parentLabel?.textContent?.trim()) return parentLabel.textContent.trim();

  // 4. label[for] attribute
  const inputId = inputElement.id;
  if(inputId) {
    const labelByFor = document.querySelector(`label[for="${inputId}"]`);
    if(labelByFor?.textContent?.trim()) return labelByFor.textContent.trim();
  }

  // 5. Placeholder
  const placeholder = inputElement.getAttribute('placeholder');
  if(placeholder?.trim()) return placeholder.trim();

  // 6. Title attribute
  const title = inputElement.getAttribute('title');
  if(title?.trim()) return title.trim();

  // 7. Previous sibling labels
  let prevSibling = inputElement.previousElementSibling;
  while(prevSibling) {
    if(prevSibling.tagName === 'LABEL' && prevSibling.textContent?.trim()) {
      return prevSibling.textContent.trim();
    }
    prevSibling = prevSibling.previousElementSibling;
  }

  // 8. Parent's previous siblings (2 levels up)
  let parent = inputElement.parentElement;
  let depth = 0;
  while(parent && depth < 3) {
    let prevParentSibling = parent.previousElementSibling;
    while(prevParentSibling) {
      if(prevParentSibling.tagName === 'LABEL' && prevParentSibling.textContent?.trim()) {
        return prevParentSibling.textContent.trim();
      }
      const labelInside = prevParentSibling.querySelector('label');
      if(labelInside?.textContent?.trim()) return labelInside.textContent.trim();

      const textEl = prevParentSibling.querySelector('span, div');
      if(textEl?.textContent?.trim()) return textEl.textContent.trim();

      prevParentSibling = prevParentSibling.previousElementSibling;
    }
    parent = parent.parentElement;
    depth++;
  }

  // 9. Name attribute fallback
  const name = inputElement.getAttribute('name');
  if(name) return name.replace(/[_\-\[\]]/g, ' ').trim();

  return null;
}

// --- Framework Detection ---

function detectFramework(): 'react' | 'vue' | 'angular' | 'vanilla' {
  const body = document.querySelector('body');
  if(!body) return 'vanilla';

  if(document.querySelector('[data-reactroot]') ||
     document.querySelector('[data-reactid]') ||
     Object.keys(body).some(k => k.startsWith('__react'))) {
    return 'react';
  }

  if(document.querySelector('[data-v-]') || (body as any).__vue_app__) {
    return 'vue';
  }

  if(document.querySelector('[ng-version]') || document.querySelector('[_nghost]')) {
    return 'angular';
  }

  return 'vanilla';
}

// --- Form Filling (F-003 Strategy Pattern) ---

function fillSelectElement(element: HTMLSelectElement, value: string): void {
  element.value = value;

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
  } catch(_error) {
    // Silently skip fill errors
  }
}

// --- Styles Injection ---

function injectStyles(): void {
  if(document.getElementById('formai-styles')) return;

  const style = document.createElement('style');
  style.id = 'formai-styles';
  style.textContent = `
    @keyframes formai-pulse {
      0%, 100% { box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.4); }
      50% { box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.2); }
    }
    @keyframes formai-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .formai-loading {
      animation: formai-pulse 1.5s ease-in-out infinite !important;
      outline: 2px solid #667eea !important;
      outline-offset: 1px;
    }
    .formai-success {
      outline: 2px solid #22c55e !important;
      outline-offset: 1px;
    }
    .formai-error {
      outline: 2px solid #ef4444 !important;
      outline-offset: 1px;
    }

    /* Confidence Indicators (F-015) */
    .formai-indicator {
      position: absolute;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: bold;
      z-index: 999999;
      pointer-events: none;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .formai-indicator-direct {
      background: #22c55e;
      color: white;
    }
    .formai-indicator-llm {
      background: #f59e0b;
      color: white;
    }
    .formai-indicator-failed {
      background: #ef4444;
      color: white;
    }

    /* Floating Panel (F-016) */
    .formai-panel {
      position: fixed;
      bottom: 20px;
      left: 20px;
      width: 300px;
      max-height: 400px;
      background: #1a1a2e;
      color: #e4e4e7;
      border-radius: 12px;
      z-index: 2147483647;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      overflow: hidden;
      transition: all 0.3s ease;
    }
    .formai-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      cursor: pointer;
    }
    .formai-panel-header span {
      font-weight: 600;
      color: white;
      font-size: 13px;
    }
    .formai-panel-close {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      line-height: 1;
    }
    .formai-panel-close:hover {
      background: rgba(255,255,255,0.3);
    }
    .formai-panel-body {
      max-height: 300px;
      overflow-y: auto;
      padding: 8px 0;
    }
    .formai-panel-body::-webkit-scrollbar {
      width: 4px;
    }
    .formai-panel-body::-webkit-scrollbar-thumb {
      background: #3d3d5c;
      border-radius: 4px;
    }
    .formai-field-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      font-size: 12px;
      border-bottom: 1px solid #2d2d44;
    }
    .formai-field-item:last-child {
      border-bottom: none;
    }
    .formai-field-icon {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: bold;
      flex-shrink: 0;
    }
    .formai-field-icon-direct {
      background: #22c55e;
      color: white;
    }
    .formai-field-icon-llm {
      background: #f59e0b;
      color: white;
    }
    .formai-field-icon-failed {
      background: #ef4444;
      color: white;
    }
    .formai-field-icon-loading {
      border: 2px solid #3d3d5c;
      border-top-color: #667eea;
      animation: formai-spin 0.8s linear infinite;
      background: transparent;
    }
    .formai-field-label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #d1d5db;
    }

    /* Status bar (simple message) */
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
    .formai-error-bar {
      background: #2d1f1f !important;
      border: 1px solid #ef4444;
    }
  `;
  document.head.appendChild(style);
}

// --- Visual Feedback ---

function setFieldState(element: HTMLElement, state: 'loading' | 'success' | 'error' | 'none'): void {
  element.classList.remove('formai-loading', 'formai-success', 'formai-error');
  if(state !== 'none') {
    element.classList.add(`formai-${state}`);
  }

  if(state === 'success' || state === 'error') {
    setTimeout(() => {
      element.classList.remove(`formai-${state}`);
    }, 5000);
  }
}

function addConfidenceIndicator(element: HTMLElement, confidence: 'direct' | 'llm' | 'failed'): void {
  // Remove existing indicator
  const existing = element.parentElement?.querySelector('.formai-indicator');
  existing?.remove();

  const indicator = document.createElement('span');
  indicator.className = `formai-indicator formai-indicator-${confidence}`;
  indicator.textContent = confidence === 'direct' ? '\u2713' : confidence === 'llm' ? '\u25CB' : '\u2717';

  // Position the indicator at the top-right of the element
  const rect = element.getBoundingClientRect();
  indicator.style.position = 'absolute';
  indicator.style.top = `${window.scrollY + rect.top - 5}px`;
  indicator.style.left = `${window.scrollX + rect.right - 5}px`;
  document.body.appendChild(indicator);
}

function showStatusBar(message: string, isError = false): void {
  let bar = document.getElementById('formai-status-bar');
  if(!bar) {
    bar = document.createElement('div');
    bar.id = 'formai-status-bar';
    bar.className = 'formai-status-bar';
    bar.addEventListener('click', () => bar?.remove());
    document.body.appendChild(bar);
  }
  bar.textContent = message;
  bar.classList.toggle('formai-error-bar', isError);

  setTimeout(() => bar?.remove(), 5000);
}

// --- Floating Panel (F-016) ---

interface PanelFieldItem {
  label: string;
  confidence: 'direct' | 'llm' | 'failed' | 'loading';
}

let panelElement: HTMLElement | null = null;
let panelExpanded = true;

function createFloatingPanel(fields: PanelFieldItem[]): void {
  removeFloatingPanel();

  const panel = document.createElement('div');
  panel.id = 'formai-panel';
  panel.className = 'formai-panel';

  const filledCount = fields.filter(f => f.confidence === 'direct' || f.confidence === 'llm').length;
  const totalCount = fields.length;

  panel.innerHTML = `
    <div class="formai-panel-header">
      <span>FormAI - Filling ${filledCount}/${totalCount} fields</span>
      <button class="formai-panel-close">&times;</button>
    </div>
    <div class="formai-panel-body" style="display: ${panelExpanded ? 'block' : 'none'}">
      ${fields.map(f => `
        <div class="formai-field-item">
          <span class="formai-field-icon formai-field-icon-${f.confidence}">
            ${f.confidence === 'direct' ? '\u2713' :
              f.confidence === 'llm' ? '\u25CB' :
              f.confidence === 'failed' ? '\u2717' : ''}
          </span>
          <span class="formai-field-label">${escapeHtml(f.label)}</span>
        </div>
      `).join('')}
    </div>
  `;

  const closeBtn = panel.querySelector('.formai-panel-close');
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    removeFloatingPanel();
  });

  const header = panel.querySelector('.formai-panel-header');
  header?.addEventListener('click', () => {
    panelExpanded = !panelExpanded;
    const body = panel.querySelector('.formai-panel-body') as HTMLElement;
    if(body) body.style.display = panelExpanded ? 'block' : 'none';
  });

  document.body.appendChild(panel);
  panelElement = panel;

  // Auto-dismiss after 30 seconds of inactivity
  setTimeout(() => {
    if(panelElement === panel) removeFloatingPanel();
  }, 30000);
}

function updateFloatingPanel(fields: PanelFieldItem[]): void {
  if(!panelElement) {
    createFloatingPanel(fields);
    return;
  }

  const filledCount = fields.filter(f => f.confidence === 'direct' || f.confidence === 'llm').length;
  const totalCount = fields.length;

  const headerSpan = panelElement.querySelector('.formai-panel-header span');
  if(headerSpan) {
    headerSpan.textContent = `FormAI - Filled ${filledCount}/${totalCount} fields`;
  }

  const body = panelElement.querySelector('.formai-panel-body');
  if(body) {
    body.innerHTML = fields.map(f => `
      <div class="formai-field-item">
        <span class="formai-field-icon formai-field-icon-${f.confidence}">
          ${f.confidence === 'direct' ? '\u2713' :
            f.confidence === 'llm' ? '\u25CB' :
            f.confidence === 'failed' ? '\u2717' : ''}
        </span>
        <span class="formai-field-label">${escapeHtml(f.label)}</span>
      </div>
    `).join('');
  }
}

function removeFloatingPanel(): void {
  panelElement?.remove();
  panelElement = null;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- Fill All Mode (F-011) ---

function scanFormFields(): { element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, label: string, id: string }[] {
  const fields: { element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, label: string, id: string }[] = [];
  const selectors = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="file"]):not([type="image"]), select, textarea';
  const elements = document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selectors);

  let index = 0;
  elements.forEach(el => {
    // Skip invisible or disabled elements
    if(el.disabled || ('readOnly' in el && el.readOnly)) return;
    const style = window.getComputedStyle(el);
    if(style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
    if(el.offsetWidth === 0 && el.offsetHeight === 0) return;

    const label = findNearestLabel(el);
    if(!label) return;

    const fieldId = `field_${index++}`;
    el.dataset.formaiId = fieldId;
    fields.push({ element: el, label, id: fieldId });
  });

  return fields;
}

async function handleFillAll(): Promise<void> {
  injectStyles();
  const fields = scanFormFields();

  if(fields.length === 0) {
    showStatusBar('FormAI: No fillable fields found on this page');
    return;
  }

  // Initialize panel with all fields as loading
  const panelItems: PanelFieldItem[] = fields.map(f => ({
    label: f.label,
    confidence: 'loading' as const
  }));
  createFloatingPanel(panelItems);

  // Set all fields to loading state
  fields.forEach(f => setFieldState(f.element, 'loading'));

  try {
    // Build field request
    const fieldRequests: FieldRequest[] = fields.map(f => ({ id: f.id, label: f.label }));

    // Send to background for processing (direct match + batch LLM)
    const response = await chrome.runtime.sendMessage({
      type: 'fillAll',
      data: { fields: fieldRequests }
    });

    if(!response.status) {
      fields.forEach(f => setFieldState(f.element, 'error'));
      panelItems.forEach(p => p.confidence = 'failed');
      updateFloatingPanel(panelItems);
      showStatusBar(response.error || 'Failed to fill fields', true);
      return;
    }

    const results: FieldResult[] = response.results;

    // Fill each field with results
    for(const result of results) {
      const fieldData = fields.find(f => f.id === result.id);
      if(!fieldData) continue;

      const panelItem = panelItems.find(p => p.label === fieldData.label);

      if(result.value && result.confidence !== 'failed') {
        fillElement(fieldData.element, result.value);
        setFieldState(fieldData.element, 'success');
        addConfidenceIndicator(fieldData.element, result.confidence);
        if(panelItem) panelItem.confidence = result.confidence;
      } else {
        setFieldState(fieldData.element, 'error');
        if(panelItem) panelItem.confidence = 'failed';
      }
    }

    updateFloatingPanel(panelItems);

    // Enter picker mode for individual corrections
    startElementPicker();

  } catch(error: any) {
    fields.forEach(f => setFieldState(f.element, 'error'));
    panelItems.forEach(p => p.confidence = 'failed');
    updateFloatingPanel(panelItems);
    showStatusBar(error.message || 'Failed to fill fields', true);
  }
}

// --- Single Field Click Handler ---

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

  setFieldState(clickedElement, 'loading');

  try {
    const answer = await askLLM(label);

    if(answer && answer.length && answer !== 'null') {
      fillElement(formElement, answer);
      setFieldState(clickedElement, 'success');
    } else {
      setFieldState(clickedElement, 'error');
      showStatusBar(`FormAI: Could not fill "${label}" - no matching data`);
    }
  } catch(error: any) {
    setFieldState(clickedElement, 'error');
    const message = error.message || 'Failed to get AI response';
    showStatusBar(`FormAI: ${message}`, true);
  }
}

// --- Picker Mode ---

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
  removeFloatingPanel();
  // Clean up confidence indicators
  document.querySelectorAll('.formai-indicator').forEach(el => el.remove());
}

// --- Message Listener ---

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
    case 'FILL_ALL':
      handleFillAll()
        .then(() => sendResponse({ status: true }))
        .catch((err) => sendResponse({ status: false, error: err.message }));
      break;
    default:
      sendResponse({ status: false, error: 'No type matched' });
  }
  return true;
});

// --- Initialization ---

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

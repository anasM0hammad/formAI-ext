import { query } from "../embeddings";

// Content script
console.log('Content script loaded');
let isPickerActive = false;

function findNearestLabel(inputElement: HTMLInputElement | HTMLSelectElement): HTMLLabelElement | null {
  // Check if label wraps the input
  const parentLabel = inputElement.closest('label');
  if (parentLabel) return parentLabel;
  
  // Check for label with matching 'for' attribute
  const inputId = inputElement.id;
  if (inputId) {
    const labelByFor = document.querySelector(`label[for="${inputId}"]`);
    if (labelByFor) return labelByFor as HTMLLabelElement;
  }
  
  // Find previous sibling label
  let prevSibling = inputElement.previousElementSibling;
  while (prevSibling) {
    if (prevSibling.tagName === 'LABEL') {
      return prevSibling as HTMLLabelElement;
    }
    prevSibling = prevSibling.previousElementSibling;
  }
  
  // Find label in parent's previous siblings
  let parent = inputElement.parentElement;
  while (parent) {
    let prevParentSibling = parent.previousElementSibling;
    while (prevParentSibling) {
      if (prevParentSibling.tagName === 'LABEL') {
        return prevParentSibling as HTMLLabelElement;
      }
      const labelInside = prevParentSibling.querySelector('label');
      if (labelInside) return labelInside as HTMLLabelElement;
      
      prevParentSibling = prevParentSibling.previousElementSibling;
    }
    parent = parent.parentElement;
  }
  
  return null;
}

function fillElement(element: HTMLInputElement | HTMLSelectElement, value: string): void {
  // Set focus
  element.focus();
  
  if (element instanceof HTMLSelectElement) {
    // For select elements
    element.value = value;
    
    // If value doesn't exist, try to find by text
    if (element.value !== value) {
      const options = Array.from(element.options);
      const matchingOption = options.find(opt => 
        opt.text.toLowerCase().includes(value.toLowerCase()) ||
        opt.value.toLowerCase().includes(value.toLowerCase())
      );
      if (matchingOption) {
        element.value = matchingOption.value;
      }
    }
    
  } else if (element instanceof HTMLInputElement) {
    // For input elements
    const inputType = element.type.toLowerCase();
    
    if (inputType === 'checkbox' || inputType === 'radio') {
      element.checked = value === 'true' || value === '1';
    } else if (inputType === 'file') {
      console.warn('File inputs cannot be programmatically filled for security reasons');
    } else {
      // Clear existing value
      element.value = '';
      
      // Set new value
      element.value = value;
    }
  }
  
  // Trigger all events to ensure frameworks detect the change
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
  
  // For React compatibility
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  
  if (nativeInputValueSetter && element instanceof HTMLInputElement) {
    nativeInputValueSetter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Force re-render by triggering additional events
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true }));
}

async function askLLM(label: string, context: string): Promise<string> {
  const answer = await chrome.runtime.sendMessage({
    type: 'askLLM',
    data: { label, context }
  });

  return answer as unknown as string;
}


async function handleClick(e: MouseEvent) {
  if (!isPickerActive) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  const clickedElement = e.target as HTMLElement;
  if(clickedElement instanceof HTMLInputElement || clickedElement instanceof HTMLSelectElement){
    const label = findNearestLabel(clickedElement);
    if(!label) return;
    const embeddings = await query(label.innerText);
    if(embeddings){
      const context = embeddings.join(', ');
      const answer = await askLLM(label.innerText, context);
      if(answer && answer.length && answer != 'null'){
          fillElement(clickedElement, answer);
      }
      else{
          fillElement(clickedElement, 'NA');
      }
    }
  }
  else{
    return;
  }
}

function startElementPicker() {
  isPickerActive = true;
  chrome.storage.local.set({
    picker: true
  });
  document.body.style.cursor = 'pointer';
  
  // Apply cursor to all iframes
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach((iframe) => {
    try {
      if (iframe.contentDocument) {
        iframe.contentDocument.body.style.cursor = 'pointer';
        iframe.contentDocument.addEventListener('click', handleClick, true);
      }
    } catch (e) {
      console.warn('Cannot access iframe:', e);
    }
  });
  
  document.addEventListener('click', handleClick, true);
}

function stopElementPicker() {
  isPickerActive = false;
  chrome.storage.local.set({
    picker: false
  });
  document.body.style.cursor = '';
  
  // Reset cursor in all iframes
  const iframes = document.querySelectorAll('iframe');
  iframes.forEach((iframe) => {
    try {
      if (iframe.contentDocument) {
        iframe.contentDocument.body.style.cursor = '';
        iframe.contentDocument.removeEventListener('click', handleClick, true);
      }
    } catch (e) {
      console.warn('Cannot access iframe:', e);
    }
  });
  
  document.removeEventListener('click', handleClick, true);
}

// Example: Listen for messages from background script
chrome.runtime.onMessage.addListener(async (request, _sender, sendResponse) => {
  console.log('Message received in content script:', request);

  switch(request.type){

    case 'START_PICKER':
      startElementPicker();
      break;

    case 'STOP_PICKER':
      stopElementPicker();
      break;

    default:
      sendResponse({ status: false, error: 'No type matched' });
  }
  return true;
});

// You can manipulate the DOM here
// Example: Add a custom element to the page
const initContentScript = () => {
  chrome.storage.local.get(['picker'], (result) => {
    if(result.picker !== undefined){
      isPickerActive = result.picker;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript)
} else {
  initContentScript()
}


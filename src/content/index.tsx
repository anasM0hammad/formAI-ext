
// Content script
console.log('Content script loaded');
let isPickerActive = false;

function findNearestLabel(inputElement: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): HTMLLabelElement | null {
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

// Helper function to force visual updates
function forceVisualUpdate(element: HTMLElement): void {
  try {
    // Method 1: Force reflow by accessing offsetHeight
    element.offsetHeight;
    
    // Method 2: Temporarily change display
    const originalDisplay = element.style.display;
    element.style.display = 'none';
    element.offsetHeight; // Force reflow
    element.style.display = originalDisplay;
    
    // Method 3: Use transform to force GPU layer
    const originalTransform = element.style.transform;
    element.style.transform = 'translateZ(0)';
    element.offsetHeight; // Force reflow
    element.style.transform = originalTransform;
    
    // Method 4: Trigger a resize event
    element.dispatchEvent(new Event('resize', { bubbles: true }));
    
  } catch (error) {
    console.error('Error forcing visual update:', error);
  }
}

function fillElement(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string): void {
  try {
    // Set focus
    element.focus();
    
    // Force initial visual update
    forceVisualUpdate(element);
    
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
        } else {
          console.warn('No matching option found for value:', value);
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
        element.value = '';
        element.value = value;
      }
    }
    else if( element instanceof HTMLTextAreaElement){
      element.value = '';
      element.value = value;
    }
    
    // Trigger all events to ensure frameworks detect the change
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    
    // Force visual update after setting value
    forceVisualUpdate(element);
    
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
    
    // Additional methods for better compatibility
    if (element instanceof HTMLInputElement) {
      // Try setAttribute as well
      element.setAttribute('value', value);
      
      // Force visual update by temporarily changing and restoring focus
      element.blur();
      element.focus();
      element.blur();
      
      // For React/Vue/Angular compatibility - trigger more events
      const events = ['focus', 'input', 'change', 'blur', 'keyup', 'keydown', 'keypress'];
      events.forEach(eventType => {
        element.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
      });
      
      // Try using Object.defineProperty for more reliable value setting
      try {
        Object.defineProperty(element, 'value', {
          value: value,
          writable: true,
          enumerable: true,
          configurable: true
        });
        element.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (error) {
        console.error('Object.defineProperty failed, using standard method');
      }
      
      // Force visual update by manipulating the element's style temporarily
      const originalDisplay = element.style.display;
      element.style.display = 'none';
      element.offsetHeight; // Force reflow
      element.style.display = originalDisplay;
      
      // Try setting the value multiple times with different methods
      setTimeout(() => {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }, 10);
      
      // For text inputs, try simulating typing
      if (element.type === 'text' || element.type === 'email' || element.type === 'password' || !element.type) {
        // Clear the field first
        element.value = '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Simulate typing character by character
        for (let i = 0; i < value.length; i++) {
          element.value += value[i];
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new KeyboardEvent('keydown', { key: value[i], bubbles: true }));
          element.dispatchEvent(new KeyboardEvent('keyup', { key: value[i], bubbles: true }));
        }
        
        // Final events
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      
      // Try alternative approach for stubborn frameworks
      setTimeout(() => {
        // Method 1: Direct property manipulation
        try {
          Object.getOwnPropertyDescriptor(element, 'value')?.set?.call(element, value);
        } catch (e) {
          console.error('Direct property manipulation failed');
        }
        
        // Method 2: Try setting innerHTML for some custom inputs
        if (element.hasAttribute('contenteditable') || element.getAttribute('role') === 'textbox') {
          element.innerHTML = value;
        }
        
        // Method 3: Try using the element's setter if it exists
        if ('setValue' in element && typeof element.setValue === 'function') {
          (element as any).setValue(value);
        }
        
        // Method 4: Try triggering all possible events
        const allEvents = ['input', 'change', 'blur', 'focus', 'keyup', 'keydown', 'keypress', 'paste', 'cut'];
        allEvents.forEach(eventType => {
          element.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
        });
        
        // Method 5: Force a complete re-render
        forceVisualUpdate(element);
      }, 100);
    }
    
    // For select elements, also try setting selectedIndex
    if (element instanceof HTMLSelectElement) {
      const options = Array.from(element.options);
      const matchingIndex = options.findIndex(opt => 
        opt.value === value || opt.text === value
      );
      if (matchingIndex !== -1) {
        element.selectedIndex = matchingIndex;
        
        // Force visual update for select elements
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Try clicking the option to trigger visual update
        const selectedOption = options[matchingIndex];
        if (selectedOption) {
          selectedOption.selected = true;
          selectedOption.dispatchEvent(new Event('click', { bubbles: true }));
        }
      }
    }
    
    // Final visual update attempt - force a complete re-render
    setTimeout(() => {
      // Trigger a custom event that might be listened to by frameworks
      element.dispatchEvent(new CustomEvent('formai:fill', { 
        detail: { value }, 
        bubbles: true 
      }));
      
      // Force a style recalculation
      element.style.transform = 'translateZ(0)';
      element.offsetHeight; // Force reflow
      element.style.transform = '';
      
      // Try one more time with the value
      if (element instanceof HTMLInputElement) {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    
    }, 50);
    
  } catch (error) {
    console.error('Error in fillElement:', error);
    console.error('Element details:', {
      tagName: element.tagName,
      type: element.type,
      id: element.id,
      name: element.name,
      className: element.className
    });
  }
}

async function askLLM(label: string): Promise<string> {
  const answer = await chrome.runtime.sendMessage({
    type: 'askLLM',
    data: { label }
  });
  return answer.response ? answer.response.trim() : '';
}


async function handleClick(e: MouseEvent) {
  try {
    if (!isPickerActive) {
      return;
    }
    
    const clickedElement = e.target as HTMLElement;
    
    if(clickedElement.tagName.toLowerCase() === 'input' || clickedElement.tagName.toLowerCase() === 'select' || clickedElement.tagName.toLowerCase() === 'textarea'){
      const label = findNearestLabel(clickedElement as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement);
      if(!label) {
        console.warn('No label found for element');
        return;
      }
    
      // Don't prevent default for form elements to allow natural behavior
      // e.preventDefault();
      // e.stopPropagation();
      
      try {
        const answer = await askLLM(label.innerText);
        
        if(answer && answer.length && answer != 'null'){
          fillElement(clickedElement as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, answer);
        }
        else{
          fillElement(clickedElement as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, 'NA');
        }
      } catch (error) {
        console.error('Error asking LLM:', error);
        fillElement(clickedElement as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, 'Error');
      }
    }
    else{
      return;
    }
  } catch (error) {
    console.error('Error in handleClick:', error);
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


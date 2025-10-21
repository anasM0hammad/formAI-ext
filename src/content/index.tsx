// Content script
console.log('Content script loaded');
let isPickerActive = false;

function handleClick(e: MouseEvent) {
  if (!isPickerActive) return;
  
  e.preventDefault();
  e.stopPropagation();
  
  const clickedElement = e.target as HTMLElement;
  // Perform DOM operations on clickedElement
  console.log('Clicked element:', clickedElement);
}

function startElementPicker() {
  isPickerActive = true;
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
  const container = document.createElement('div')
  container.id = 'extension-content-root'
  document.body.appendChild(container)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript)
} else {
  initContentScript()
}


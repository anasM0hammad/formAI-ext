// Content script
console.log('Content script loaded');


// Example: Listen for messages from background script
chrome.runtime.onMessage.addListener(async (request, _sender, sendResponse) => {
  console.log('Message received in content script:', request);

  switch(request.type){
    case 'fill':
      break;

    default:
      sendResponse({ status: false, error: 'No type matched' });
  }
  return true;
})

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


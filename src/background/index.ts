import { decryption, encryption } from "../crypto";

// Background service worker
console.log('Background service worker started')

// Listen for extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed:', details.reason)
  
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({ initialized: true });

    // Generating Unique value
    const value = crypto.getRandomValues(new Uint8Array(32));
    await chrome.storage.local.set({
      installationValue: Array.from(value),
      installedAt: new Date().toISOString()
    });
  }
})

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('Message received in background:', request)
  
  // Handle different message types
  switch (request.type) {
    case 'encrypt':
      const data = request.data;
      encryption(data).then((encrypted) => sendResponse({ status: true, encrypted}))
      .catch((err) => sendResponse({ status: false, error: err.message }));
      break;
    
    case 'decrypt':
      decryption(request.data).then((decrypted) => sendResponse({ status: true, decrypted}))
      .catch((err) => sendResponse({ status: false, error: err.message }));
      break;

    // case 'store':
    //   console.log('in store');
    //   insert(request.data).then(() => sendResponse({ status: true, message: 'Data stored successfully'}))
    //   .catch((err) => sendResponse({ status: false, error: err.message}));
    //   break;

    // case 'reset':
    //   deleteVector().then(() => sendResponse({ status: true, message: 'Database reset'}))
    //   .catch((err) => sendResponse({ status: false, error: err.message}));
    //   break;

    // case 'query':
    //   query(request.data).then((data) => sendResponse({ status: true, data}))
    //   .catch((err) => sendResponse({ status: false, error: err.message}));
    //   break;
      
    default:
      sendResponse({ status: false, error: 'unknown message type' })
  }
  
  return true
})

// Example: Listen for tab updates
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('Tab updated:', tab.url)
  }
})


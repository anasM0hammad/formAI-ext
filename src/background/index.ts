// Background service worker
console.log('Background service worker started')

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason)
  
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({ initialized: true })
  }
})

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('Message received in background:', request)
  
  // Handle different message types
  switch (request.type) {
    case 'example':
      sendResponse({ status: 'success' })
      break
    default:
      sendResponse({ status: 'unknown message type' })
  }
  
  return true
})

// Example: Listen for tab updates
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('Tab updated:', tab.url)
  }
})


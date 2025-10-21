import OpenAI from "openai";
import { decryption, encryption } from "../crypto";

// Background service worker
console.log('Background service worker started');

const askLLM = async (label: string, context: string) => {
  const system = `You are a very helpful assistant and expert in filling application form. You have to answer to the form questions based on context provided. Only provide the answer to the question and nothing else I repeat nothing else. strictly provide 'null' if you do not the know the exact answer to the question or have any doubt about the question.`;
  try{
    const storageResponse = await chrome.storage.local.get(['apiKey', 'model', 'url', 'provider']);
    const provider = storageResponse.provider;
    const apiKey = storageResponse.apiKey;
    const model = storageResponse.model;
    const url = storageResponse.url;
    const config: any = {
      
    }

    if(provider === 'Ollama'){
      config['apiKey'] = 'dummy';
      config['baseURL'] = url;
    }
    else if(provider === 'Gemini'){
      config['apiKey'] = apiKey;
      config['baseURL'] = `https://generativelanguage.googleapis.com/v1beta/openai/`
    }
    else{
      config['apiKey'] = apiKey;
    }

    const agent = new OpenAI(config);
    const response = await agent.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Context: ${context} \n Answer the form field : ${label} for me`}
      ]
    });
    return response.choices[0].message.content;
  }
  catch(error: any){
    throw Error('Failed to fetch answer from LLM' + error.message);
  }
}

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

    case 'askLLM':
      const label = request.label;
      const context = request.context;
      askLLM(label, context).then((response) => sendResponse({ status: true, response }))
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
});

// Example: Listen for tab updates
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('Tab updated:', tab.url)
  }
})


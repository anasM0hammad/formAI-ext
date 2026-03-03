import OpenAI from "openai";
import { decryption, encryption } from "../crypto";
import { initDB, insert, query, deleteVector } from "../embeddings";

// Initialize EntityDB in background context
initDB();

const askLLM = async (label: string) => {
  const system = `You are a very helpful assistant and expert in filling application form. You have to answer to the form questions based on context provided. Only provide the answer to the question and nothing else I repeat nothing else. strictly provide 'null' if you do not the know the exact answer to the question or have any doubt about the question.`;

  try {
    // Query embeddings directly in background (no popup dependency)
    const context = await query(label);

    if(!context || !context.trim().length) {
      return null;
    }

    const storageResponse = await chrome.storage.local.get(['apiKey', 'model', 'url', 'provider']);
    const provider = storageResponse.provider;
    const apiKey = await decryption(storageResponse.apiKey);
    const model = storageResponse.model;
    const url = storageResponse.url;
    const config: Record<string, string> = {};

    if(provider === 'Ollama') {
      config['apiKey'] = 'dummy';
      config['baseURL'] = url;
    } else if(provider === 'Gemini') {
      config['apiKey'] = apiKey;
      config['baseURL'] = `https://generativelanguage.googleapis.com/v1beta/openai/`;
    } else {
      config['apiKey'] = apiKey;
    }

    const agent = new OpenAI(config);
    const response = await agent.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Context: ${context} \n Answer the form field : ${label} for me`}
      ]
    });
    return response.choices[0].message.content;
  } catch(error: any) {
    throw Error('Failed to fetch answer from LLM ' + error.message);
  }
}

const fetchModels = async (provider: string, apiKey?: string, url?: string) => {
  const config: Record<string, string> = {};

  if(provider === 'Ollama') {
    config.baseURL = url || 'http://localhost:11434/v1';
    config.apiKey = 'dummy';
  } else if(provider === 'Gemini') {
    config.apiKey = apiKey || '';
    config.baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
  } else {
    config.apiKey = apiKey || '';
  }

  const openai = new OpenAI(config);
  const models = await openai.models.list();
  if(models.data && models.data.length) {
    return models.data.map((model) =>
      model.id.split('/').length > 1 ? model.id.split('/')[1] : model.id
    );
  }
  return [];
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if(details.reason === 'install') {
    chrome.storage.sync.set({ initialized: true });

    const value = crypto.getRandomValues(new Uint8Array(32));
    await chrome.storage.local.set({
      installationValue: Array.from(value),
      installedAt: new Date().toISOString()
    });
  }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  switch(request.type) {
    case 'encrypt':
      encryption(request.data)
        .then((encrypted) => sendResponse({ status: true, encrypted }))
        .catch((err) => sendResponse({ status: false, error: err.message }));
      break;

    case 'decrypt':
      decryption(request.data)
        .then((decrypted) => sendResponse({ status: true, decrypted }))
        .catch((err) => sendResponse({ status: false, error: err.message }));
      break;

    case 'askLLM':
      askLLM(request.data.label)
        .then((response) => sendResponse({ status: true, response }))
        .catch((err) => sendResponse({ status: false, error: err.message }));
      break;

    case 'store':
      insert(request.data)
        .then(() => sendResponse({ status: true, message: 'Data stored successfully' }))
        .catch((err) => sendResponse({ status: false, error: err.message }));
      break;

    case 'reset':
      deleteVector()
        .then(() => sendResponse({ status: true, message: 'Database reset' }))
        .catch((err) => sendResponse({ status: false, error: err.message }));
      break;

    case 'fetchModels':
      fetchModels(request.data.provider, request.data.apiKey, request.data.url)
        .then((models) => sendResponse({ status: true, models }))
        .catch((err) => sendResponse({ status: false, error: err.message }));
      break;

    default:
      sendResponse({ status: false, error: 'unknown message type' });
  }

  return true;
});

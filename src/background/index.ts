import OpenAI from "openai";
import { decryption, encryption } from "../crypto";
import { initDB, insert, query, deleteVector } from "../embeddings";

// Initialize EntityDB in background context
initDB();

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

interface UserData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  workExperience: string;
  education: string;
  skills: string;
  additionalInfo: string;
}

type ErrorType = 'API_KEY_INVALID' | 'NETWORK' | 'RATE_LIMITED' | 'NO_DATA' | 'PROVIDER_NOT_SET' | 'MODEL_NOT_AVAILABLE';

function createError(errorType: ErrorType, message: string): { status: false, errorType: ErrorType, error: string } {
  return { status: false, errorType, error: message };
}

// --- LLM Client Setup ---

async function getLLMClient(): Promise<{ client: OpenAI, model: string }> {
  const storageResponse = await chrome.storage.local.get(['apiKey', 'model', 'url', 'provider']);
  const provider = storageResponse.provider;
  const model = storageResponse.model;
  const url = storageResponse.url;

  if(!provider) {
    throw { errorType: 'PROVIDER_NOT_SET' as ErrorType, message: 'AI provider not configured. Go to Settings to add your API key.' };
  }

  if(!model) {
    throw { errorType: 'MODEL_NOT_AVAILABLE' as ErrorType, message: 'No model selected. Choose a model in Settings.' };
  }

  const config: Record<string, string> = {};

  if(provider === 'Ollama') {
    config['apiKey'] = 'dummy';
    config['baseURL'] = url;
  } else if(provider === 'Gemini') {
    const apiKey = await decryption(storageResponse.apiKey);
    config['apiKey'] = apiKey;
    config['baseURL'] = `https://generativelanguage.googleapis.com/v1beta/openai/`;
  } else {
    const apiKey = await decryption(storageResponse.apiKey);
    config['apiKey'] = apiKey;
  }

  return { client: new OpenAI(config), model };
}

function classifyAPIError(error: any): { errorType: ErrorType, message: string } {
  const status = error?.status || error?.response?.status;
  if(status === 401 || status === 403) {
    return { errorType: 'API_KEY_INVALID', message: 'Invalid API key. Please check your key in Settings.' };
  }
  if(status === 429) {
    return { errorType: 'RATE_LIMITED', message: 'Rate limit reached. Please wait a moment before trying again.' };
  }
  if(status === 404) {
    return { errorType: 'MODEL_NOT_AVAILABLE', message: 'Model is not available. Choose a different model in Settings.' };
  }
  if(error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND' || error?.message?.includes('fetch')) {
    return { errorType: 'NETWORK', message: 'Network error. Please check your connection and try again.' };
  }
  return { errorType: 'NETWORK', message: error?.message || 'Unknown error occurred' };
}

// --- Direct Field Matching (F-013) ---

function tryDirectMatch(label: string, userData: UserData | null): string | null {
  if(!userData) return null;
  const lower = label.toLowerCase();

  // Email patterns
  if(/\b(email|e-mail|email\s*address|contact\s*email)\b/.test(lower)) {
    return userData.email || null;
  }

  // Phone patterns
  if(/\b(phone|telephone|mobile|cell|phone\s*number)\b/.test(lower)) {
    return userData.phone || null;
  }

  // First name
  if(/\b(first\s*name|given\s*name|forename)\b/.test(lower)) {
    const parts = (userData.fullName || '').trim().split(/\s+/);
    return parts[0] || null;
  }

  // Last name
  if(/\b(last\s*name|surname|family\s*name)\b/.test(lower)) {
    const parts = (userData.fullName || '').trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : null;
  }

  // Full name patterns (check after first/last name to avoid false matches)
  if(/\b(full\s*name|your\s*name|candidate\s*name)\b/.test(lower) ||
     (lower === 'name' || /^name\s*$/.test(lower))) {
    return userData.fullName || null;
  }

  // Location patterns
  if(/\b(location|city|state|address|country|zip|postal)\b/.test(lower)) {
    return userData.location || null;
  }

  // LinkedIn patterns
  if(/\b(linkedin|profile\s*url|linkedin\s*url)\b/.test(lower)) {
    return userData.linkedinUrl || null;
  }

  return null;
}

// --- Single Field LLM (F-001 legacy support) ---

const askLLM = async (label: string) => {
  const system = `You are a very helpful assistant and expert in filling application form. You have to answer to the form questions based on context provided. Only provide the answer to the question and nothing else I repeat nothing else. strictly provide 'null' if you do not the know the exact answer to the question or have any doubt about the question.`;

  try {
    const context = await query(label);
    if(!context || !context.trim().length) {
      return null;
    }

    const { client, model } = await getLLMClient();
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Context: ${context} \n Answer the form field : ${label} for me`}
      ]
    });
    return response.choices[0].message.content;
  } catch(error: any) {
    if(error.errorType) throw error;
    throw classifyAPIError(error);
  }
}

// --- Batch Fill All (F-011) ---

function parseJSON(text: string): Record<string, string | null> | null {
  // Try direct parse
  try {
    return JSON.parse(text);
  } catch { /* continue */ }

  // Try extracting from markdown code block
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if(codeBlock) {
    try {
      return JSON.parse(codeBlock[1].trim());
    } catch { /* continue */ }
  }

  // Try finding JSON object in text
  const objMatch = text.match(/\{[\s\S]*\}/);
  if(objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch { /* continue */ }
  }

  return null;
}

async function batchAskLLM(fields: FieldRequest[]): Promise<FieldResult[]> {
  if(fields.length === 0) return [];

  const context = await query(fields.map(f => f.label).join(', '));
  if(!context || !context.trim().length) {
    return fields.map(f => ({ id: f.id, value: null, confidence: 'failed' as const }));
  }

  const fieldList = fields.map(f => `- id: "${f.id}", label: "${f.label}"`).join('\n');

  const prompt = `Based on the context provided, fill in the following form fields.
Return ONLY a JSON object where keys are the field IDs and values are the answers.
Use null for fields you cannot answer confidently.

Context: ${context}

Fields to fill:
${fieldList}

Return only the JSON object, no other text.`;

  try {
    const { client, model } = await getLLMClient();
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant expert in filling job application forms. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ]
    });

    const content = response.choices[0].message.content || '';
    const parsed = parseJSON(content);

    if(!parsed) {
      return fields.map(f => ({ id: f.id, value: null, confidence: 'failed' as const }));
    }

    return fields.map(f => {
      const val = parsed[f.id];
      if(val && val !== 'null' && val !== 'N/A' && val !== 'NA') {
        return { id: f.id, value: String(val).trim(), confidence: 'llm' as const };
      }
      return { id: f.id, value: null, confidence: 'failed' as const };
    });
  } catch(error: any) {
    if(error.errorType) throw error;
    throw classifyAPIError(error);
  }
}

async function fillAllFields(fields: FieldRequest[]): Promise<FieldResult[]> {
  const storage = await chrome.storage.local.get(['userData']);
  const userData: UserData | null = storage.userData || null;
  const results: FieldResult[] = [];
  const llmFields: FieldRequest[] = [];

  for(const field of fields) {
    const directValue = tryDirectMatch(field.label, userData);
    if(directValue) {
      results.push({ id: field.id, value: directValue, confidence: 'direct' });
    } else {
      llmFields.push(field);
    }
  }

  if(llmFields.length > 0) {
    const llmResults = await batchAskLLM(llmFields);
    results.push(...llmResults);
  }

  return results;
}

// --- Resume Parsing (F-014) ---

async function parseResumeText(text: string): Promise<UserData> {
  // Extract email and LinkedIn via regex first
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  const linkedinMatch = text.match(/linkedin\.com\/in\/[A-Za-z0-9_-]+/i);

  const prompt = `Parse the following resume text and extract structured information.
Return ONLY a JSON object with these exact keys:
- fullName: string (the person's full name)
- email: string (email address)
- phone: string (phone number)
- location: string (city, state/country)
- linkedinUrl: string (LinkedIn URL if found)
- workExperience: string (work history with company names, titles, dates, descriptions)
- education: string (schools, degrees, dates)
- skills: string (comma-separated list of skills)

Resume text:
${text}

Return only the JSON object.`;

  try {
    const { client, model } = await getLLMClient();
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are an expert resume parser. Extract structured information and return valid JSON only.' },
        { role: 'user', content: prompt }
      ]
    });

    const content = response.choices[0].message.content || '';
    const parsed = parseJSON(content);

    if(!parsed) {
      throw new Error('Failed to parse resume data from LLM response');
    }

    return {
      fullName: String(parsed.fullName || ''),
      email: String(parsed.email || emailMatch?.[0] || ''),
      phone: String(parsed.phone || ''),
      location: String(parsed.location || ''),
      linkedinUrl: String(parsed.linkedinUrl || (linkedinMatch ? `https://${linkedinMatch[0]}` : '')),
      workExperience: String(parsed.workExperience || ''),
      education: String(parsed.education || ''),
      skills: String(parsed.skills || ''),
      additionalInfo: ''
    };
  } catch(error: any) {
    if(error.errorType) throw error;
    throw classifyAPIError(error);
  }
}

// --- Save User Data (F-012) ---

async function saveUserData(userData: UserData): Promise<void> {
  // Save structured data to local storage for direct matching
  await chrome.storage.local.set({ userData });

  // Build text for embeddings from all fields
  const textParts = [
    userData.fullName && `My name is ${userData.fullName}`,
    userData.email && `My email is ${userData.email}`,
    userData.phone && `My phone number is ${userData.phone}`,
    userData.location && `I am located in ${userData.location}`,
    userData.linkedinUrl && `My LinkedIn profile is ${userData.linkedinUrl}`,
    userData.workExperience,
    userData.education,
    userData.skills && `My skills include: ${userData.skills}`,
    userData.additionalInfo
  ].filter(Boolean);

  if(textParts.length > 0) {
    // Clear old embeddings and re-insert
    await deleteVector();
    for(const part of textParts) {
      if(part && part.trim().length > 0) {
        await insert(part);
      }
    }
  }
}

// --- Model Fetching ---

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

// --- Extension Installation ---

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

// --- Message Handler ---

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  const handleError = (err: any) => {
    if(err.errorType) {
      sendResponse(createError(err.errorType, err.message));
    } else {
      const classified = classifyAPIError(err);
      sendResponse(createError(classified.errorType, classified.message));
    }
  };

  switch(request.type) {
    case 'encrypt':
      encryption(request.data)
        .then((encrypted) => sendResponse({ status: true, encrypted }))
        .catch(handleError);
      break;

    case 'decrypt':
      decryption(request.data)
        .then((decrypted) => sendResponse({ status: true, decrypted }))
        .catch(handleError);
      break;

    case 'askLLM':
      askLLM(request.data.label)
        .then((response) => sendResponse({ status: true, response }))
        .catch(handleError);
      break;

    case 'fillAll':
      fillAllFields(request.data.fields)
        .then((results) => sendResponse({ status: true, results }))
        .catch(handleError);
      break;

    case 'store':
      insert(request.data)
        .then(() => sendResponse({ status: true, message: 'Data stored successfully' }))
        .catch(handleError);
      break;

    case 'saveUserData':
      saveUserData(request.data)
        .then(() => sendResponse({ status: true, message: 'User data saved' }))
        .catch(handleError);
      break;

    case 'reset':
      deleteVector()
        .then(() => {
          chrome.storage.local.remove('userData');
          sendResponse({ status: true, message: 'All data reset' });
        })
        .catch(handleError);
      break;

    case 'fetchModels':
      fetchModels(request.data.provider, request.data.apiKey, request.data.url)
        .then((models) => sendResponse({ status: true, models }))
        .catch(handleError);
      break;

    case 'parseResume':
      parseResumeText(request.data.text)
        .then((userData) => sendResponse({ status: true, userData }))
        .catch(handleError);
      break;

    default:
      sendResponse({ status: false, error: 'unknown message type' });
  }

  return true;
});

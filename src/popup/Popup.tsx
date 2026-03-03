import React, { useState, useEffect, useRef } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');

const MAIN_TAB = 'General';
const DATA_TAB = 'Data';
const COVER_LETTER = 'Letter';
const CONFIG = 'Settings';

const OLLAMA = 'Ollama';
const OPENAI = 'OpenAI';
const GEMINI = 'Gemini';

type Providers = typeof OLLAMA | typeof GEMINI | typeof OPENAI | '';

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

interface FillHistoryEntry {
  domain: string;
  url: string;
  timestamp: string;
  fieldsTotal: number;
  fieldsFilled: number;
}

const emptyUserData: UserData = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  linkedinUrl: '',
  workExperience: '',
  education: '',
  skills: '',
  additionalInfo: ''
};

type NotificationProp = {
  message: string,
  type?: 'success' | 'error' | 'warning',
}

function Notification(props: NotificationProp) {
  const type = props.type || 'success';

  return (
    <div className={`notification notification-${type}`}>
      <div className="notification-icon">
        {type === 'success' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        )}
        {type === 'error' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        )}
        {type === 'warning' && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        )}
      </div>
      <span className="notification-text">{props.message}</span>
    </div>
  )
}

// --- Onboarding Wizard (F-018) ---

function OnboardingWizard({ theme, onComplete }: { theme: 'light' | 'dark', onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState<Providers>('');
  const [apiKey, setAPIKey] = useState('');
  const [url, setUrl] = useState('http://localhost:11434/v1');
  const [model, setModel] = useState('');
  const [modelList, setModelList] = useState<string[]>([]);
  const [userData, setUserData] = useState<UserData>({ ...emptyUserData });
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchModels = async (prov: Providers, key?: string, localUrl?: string) => {
    if(prov === OLLAMA) {
      if(!localUrl) return;
    } else if(prov) {
      if(!key) return;
    } else {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'fetchModels',
        data: { provider: prov, apiKey: key, url: localUrl }
      });
      if(response.status) setModelList(response.models);
    } catch { /* ignore */ }
  };

  const debouncedFetchModels = (prov: Providers, key?: string, localUrl?: string) => {
    clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => fetchModels(prov, key, localUrl), 500);
  };

  const saveStep1 = async () => {
    if(!provider) { toast.error('Please select a provider'); return; }
    if(provider !== OLLAMA && !apiKey) { toast.error('API key is required'); return; }
    if(!model) { toast.error('Please select a model'); return; }

    try {
      const response = await chrome.runtime.sendMessage({ type: 'encrypt', data: apiKey });
      if(!response.status) { toast.error('Failed to save config'); return; }

      await chrome.storage.local.set({ provider, apiKey: response.encrypted, model, url });
      setStep(2);
    } catch(error: any) {
      toast.error(error.message);
    }
  };

  const saveStep2 = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'saveUserData', data: userData });
      if(response.status) {
        setStep(3);
      } else {
        toast.error(response.error);
      }
    } catch(error: any) {
      toast.error(error.message);
    }
  };

  const finish = async () => {
    await chrome.storage.sync.set({ onboardingComplete: true });
    onComplete();
  };

  return (
    <div className={`popup-container ${theme}`}>
      <div className="header">
        <h1>FormAI Setup</h1>
      </div>

      <div className="tab-content">
        <div className="onboarding-step-indicator">
          Step {step} of 3
        </div>

        {step === 1 && (
          <div className="onboarding-content">
            <h2 className="section-title">Choose your AI provider</h2>

            <div className="form-group">
              <label>Provider</label>
              <select className="form-control" value={provider} onChange={e => {
                setProvider(e.target.value as Providers);
                setAPIKey('');
                fetchModels(e.target.value as Providers, '', url);
              }}>
                <option value="">Select</option>
                <option value={OPENAI}>{OPENAI}</option>
                <option value={GEMINI}>{GEMINI}</option>
                <option value={OLLAMA}>{OLLAMA}</option>
              </select>
            </div>

            {provider && provider !== OLLAMA && (
              <div className="form-group">
                <label>API Key</label>
                <input type="password" className="form-control" value={apiKey} placeholder="Paste your API key"
                  onChange={e => { setAPIKey(e.target.value); debouncedFetchModels(provider, e.target.value, url); }} />
              </div>
            )}

            {provider === OLLAMA && (
              <div className="form-group">
                <label>Local URL</label>
                <input className="form-control" value={url}
                  onChange={e => { setUrl(e.target.value); debouncedFetchModels(provider, 'dummy', e.target.value); }} />
              </div>
            )}

            {(modelList.length > 0 || model) && (
              <div className="form-group">
                <label>Model</label>
                <input className="form-control" value={model} list="onboarding-models" placeholder="Select or type a model"
                  onChange={e => setModel(e.target.value)} />
                <datalist id="onboarding-models">
                  {modelList.map(m => <option key={m} value={m}>{m}</option>)}
                </datalist>
              </div>
            )}

            <div className="disclaimer">
              <p>Your key is encrypted and stored locally on your device.</p>
            </div>

            <div className="onboarding-actions">
              <button className="button-primary" onClick={saveStep1}>Next</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-content">
            <h2 className="section-title">Add your information</h2>

            <div className="structured-form">
              <div className="form-group">
                <label>Full Name</label>
                <input className="form-control" value={userData.fullName} placeholder="John Doe"
                  onChange={e => setUserData(d => ({ ...d, fullName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input className="form-control" type="email" value={userData.email} placeholder="john@example.com"
                  onChange={e => setUserData(d => ({ ...d, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="form-control" value={userData.phone} placeholder="+1 (555) 123-4567"
                  onChange={e => setUserData(d => ({ ...d, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input className="form-control" value={userData.location} placeholder="City, State"
                  onChange={e => setUserData(d => ({ ...d, location: e.target.value }))} />
              </div>
            </div>

            <div className="onboarding-actions">
              <button className="button-secondary" onClick={() => setStep(1)}>Back</button>
              <button className="button-secondary" onClick={() => setStep(3)}>Skip</button>
              <button className="button-primary" onClick={saveStep2}>Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-content onboarding-done">
            <h2 className="section-title">You're all set!</h2>
            <p>Go to a job application page and click "Fill This Page" to let FormAI fill in your details automatically.</p>
            <p>You can always add more details in the Data tab later.</p>
            <div className="onboarding-actions">
              <button className="button-primary" onClick={finish}>Got it!</button>
            </div>
          </div>
        )}

        <ToastContainer position='top-right' autoClose={3000} pauseOnFocusLoss={false} pauseOnHover={false} />
      </div>
    </div>
  );
}

// --- Main Popup ---

function Popup() {
  const [activeTab, setActiveTab] = useState(MAIN_TAB);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [notificationId, setNotificationId] = useState<number | undefined>(undefined);
  const [model, setModel] = useState<string>('');
  const [provider, setProvider] = useState<Providers>('');
  const [apiKey, setAPIKey] = useState<string>('');
  const [url, setUrl] = useState<string>('http://localhost:11434/v1');
  const [modelList, setModelList] = useState<string[]>([]);
  const [notification, setNotification] = useState<string>('');
  const [notificationType, setNotificationType] = useState<'success' | 'error' | 'warning'>('success');
  const [picker, setPicker] = useState<boolean>(false);
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // F-018: Onboarding state
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  // F-012: Structured data
  const [userData, setUserData] = useState<UserData>({ ...emptyUserData });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basicInfo: true,
    experience: false,
    additional: false
  });
  const [isImporting, setIsImporting] = useState(false);

  // F-024: Fill history
  const [fillHistory, setFillHistory] = useState<FillHistoryEntry[]>([]);

  // F-023: Cover letter
  const [jobDescription, setJobDescription] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // F-025: Data import
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check onboarding state
    chrome.storage.sync.get(['theme', 'onboardingComplete'], (result) => {
      if(result.theme) setTheme(result.theme);
      setOnboardingComplete(result.onboardingComplete === true);
    });

    chrome.storage.local.get(['provider', 'apiKey', 'model', 'url', 'picker', 'userData', 'fillHistory'], async (result) => {
      if(result.provider) setProvider(result.provider);
      if(result.picker !== undefined) setPicker(result.picker);
      if(result.model) setModel(result.model);
      if(result.url) setUrl(result.url);
      if(result.userData) setUserData(result.userData);
      if(result.fillHistory) setFillHistory(result.fillHistory);

      if(result.apiKey) {
        try {
          const response = await chrome.runtime.sendMessage({ type: 'decrypt', data: result.apiKey });
          if(response.status) setAPIKey(response.decrypted);
        } catch(error: any) {
          toast.error(`API key can't be fetched: ${error.message}`);
        }
      }
    });

    return () => {
      clearTimeout(notificationId);
      clearTimeout(fetchDebounceRef.current);
    }
  }, []);

  // Show loading state while checking onboarding
  if(onboardingComplete === null) {
    return <div className={`popup-container ${theme}`}><div className="tab-content"><p>Loading...</p></div></div>;
  }

  // Show onboarding wizard if not completed
  if(!onboardingComplete) {
    return <OnboardingWizard theme={theme} onComplete={() => {
      setOnboardingComplete(true);
      // Reload config after onboarding (including API key)
      chrome.storage.local.get(['provider', 'apiKey', 'model', 'url', 'userData'], async (result) => {
        if(result.provider) setProvider(result.provider);
        if(result.model) setModel(result.model);
        if(result.url) setUrl(result.url);
        if(result.userData) setUserData(result.userData);
        if(result.apiKey) {
          try {
            const response = await chrome.runtime.sendMessage({ type: 'decrypt', data: result.apiKey });
            if(response?.status) setAPIKey(response.decrypted);
          } catch { /* ignore */ }
        }
      });
    }} />;
  }

  // --- Data Handlers (F-012) ---

  const saveUserData = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'saveUserData', data: userData });
      if(response.status) {
        toast.success('Data saved successfully');
      } else {
        toast.error(`Failed: ${response.error}`);
      }
    } catch(error: any) {
      toast.error(`Failed: ${error.message}`);
    }
  };

  const resetAllData = async () => {
    if(!confirm('This will delete all your data. Are you sure?')) return;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'reset' });
      if(response.status) {
        setUserData({ ...emptyUserData });
        toast.success('All data reset');
      } else {
        toast.error(`Failed: ${response.error}`);
      }
    } catch(error: any) {
      toast.error(`Failed: ${error.message}`);
    }
  };

  // --- Resume Import (F-014) ---

  const handleResumeImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if(!file) return;

    setIsImporting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullText = '';
      for(let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      if(!fullText.trim()) {
        toast.error('Could not extract text from PDF');
        setIsImporting(false);
        return;
      }

      // Send to background for LLM parsing
      const response = await chrome.runtime.sendMessage({
        type: 'parseResume',
        data: { text: fullText }
      });

      if(response.status && response.userData) {
        setUserData(response.userData);
        toast.success('Resume imported! Review and save your data.');
      } else {
        toast.error(response.error || 'Failed to parse resume');
      }
    } catch(error: any) {
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setIsImporting(false);
      // Reset file input
      if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // --- Config Handlers ---

  const resetNotification = () => {
    setNotificationId(undefined);
    setNotification('');
    setNotificationType('success');
  }

  const createNotification = (message: string, id: number, type: 'success' | 'error' | 'warning' = 'success') => {
    setNotificationId(id);
    setNotification(message);
    setNotificationType(type);
  }

  const fetchModels = async (prov: Providers, key?: string, localUrl?: string) => {
    if(prov === OLLAMA) {
      if(!localUrl) return;
    } else if(prov) {
      if(!key) return;
    } else {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'fetchModels',
        data: { provider: prov, apiKey: key, url: localUrl }
      });
      if(response.status) {
        setModelList(response.models);
      } else {
        setModelList([]);
        toast.error(response.error);
      }
    } catch(error: any) {
      setModelList([]);
      toast.error(error.message);
    }
  }

  const debouncedFetchModels = (prov: Providers, key?: string, localUrl?: string) => {
    clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => fetchModels(prov, key, localUrl), 500);
  }

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    chrome.storage.sync.set({ theme: newTheme });
  };

  const onSaveConfig = async (_event: React.MouseEvent<HTMLButtonElement>) => {
    clearTimeout(notificationId);

    if(!provider || ((provider === OLLAMA && !url) || (provider !== OLLAMA && !apiKey))) {
      const id = setTimeout(() => resetNotification(), 2000) as unknown as number;
      createNotification('Parameters are invalid', id, 'error');
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({ type: 'encrypt', data: apiKey });
      if(!response.status) {
        const id = setTimeout(() => resetNotification(), 2000) as unknown as number;
        createNotification('Configuration failed to save ' + response.error, id, 'error');
        return;
      }

      chrome.storage.local.set({ provider, apiKey: response.encrypted, model, url });
      const id = setTimeout(() => resetNotification(), 2000) as unknown as number;
      createNotification('Configuration saved successfully', id);
    } catch(error: any) {
      const id = setTimeout(() => resetNotification(), 2000) as unknown as number;
      createNotification('Saving failed with error ' + error.message, id, 'error');
    }
  }

  const selectProvider = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setProvider(event.target.value as Providers);
    setAPIKey('');
    fetchModels(event.target.value as Providers, '', url);
  }

  const selectModel = (event: React.ChangeEvent<HTMLInputElement>) => {
    setModel(event.target.value);
  }

  const selectKey = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAPIKey(event.target.value);
    debouncedFetchModels(provider, event.target.value, url);
  }

  const selectUrl = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
    debouncedFetchModels(provider, 'dummy', event.target.value);
  }

  // --- Fill This Page (F-011) ---

  const onFillForm = async () => {
    if(!provider) {
      toast.error('AI provider not configured. Go to Settings to add your API key.');
      return;
    }
    if(!model) {
      toast.error('No model selected. Choose a model in Settings.');
      return;
    }
    if(provider !== OLLAMA && !apiKey) {
      toast.error('API key is not set. Add your key in Settings.');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if(!tab || !tab.id) return;

      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/index.js']
      });

      if(picker) {
        // Stop picker mode
        await chrome.tabs.sendMessage(tab.id, { type: 'STOP_PICKER' });
        setPicker(false);
      } else {
        // Fill All mode
        await chrome.tabs.sendMessage(tab.id, { type: 'FILL_ALL' });
        setPicker(true);
      }
    } catch(_error) {
      toast.error('Failed to activate on this page. Make sure the page is fully loaded.');
    }
  }

  // --- Cover Letter Generation (F-023) ---

  const handleGenerateCoverLetter = async () => {
    if(!jobDescription.trim()) {
      toast.error('Please paste a job description first.');
      return;
    }
    setIsGenerating(true);
    setCoverLetter('');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'generateCoverLetter',
        data: { jobDescription: jobDescription.trim() }
      });
      if(response.status) {
        setCoverLetter(response.coverLetter);
        toast.success('Cover letter generated!');
      } else {
        toast.error(response.error || 'Failed to generate cover letter');
      }
    } catch(error: any) {
      toast.error(error.message || 'Failed to generate cover letter');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyCoverLetter = () => {
    navigator.clipboard.writeText(coverLetter).then(() => {
      toast.success('Copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy');
    });
  };

  // --- Data Export/Import (F-025) ---

  const handleExportData = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'exportData' });
      if(response.status) {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `formai-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Data exported successfully');
      } else {
        toast.error(response.error || 'Export failed');
      }
    } catch(error: any) {
      toast.error(error.message || 'Export failed');
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if(!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if(!data.version) {
        toast.error('Invalid backup file format');
        return;
      }

      const response = await chrome.runtime.sendMessage({ type: 'importData', data });
      if(response.status) {
        toast.success('Data imported! Reloading...');
        // Reload state
        chrome.storage.local.get(['userData', 'fillHistory', 'provider', 'model', 'url'], (result) => {
          if(result.userData) setUserData(result.userData);
          if(result.fillHistory) setFillHistory(result.fillHistory);
          if(result.provider) setProvider(result.provider);
          if(result.model) setModel(result.model);
          if(result.url) setUrl(result.url);
        });
      } else {
        toast.error(response.error || 'Import failed');
      }
    } catch {
      toast.error('Invalid JSON file');
    } finally {
      if(importFileRef.current) importFileRef.current.value = '';
    }
  };

  // --- Fill History Helpers (F-024) ---

  const formatTimeAgo = (timestamp: string): string => {
    const time = new Date(timestamp).getTime();
    if(isNaN(time)) return '';
    const diff = Date.now() - time;
    const minutes = Math.floor(diff / 60000);
    if(minutes < 1) return 'just now';
    if(minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if(hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if(days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
  };

  return (
    <div className={`popup-container ${theme}`}>
      {notificationId && notification && <Notification message={notification} type={notificationType} />}

      <div className="header">
        <h1>Welcome to FormAI</h1>
        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {theme === 'light' ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          )}
        </button>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === MAIN_TAB ? 'active' : ''}`} onClick={() => setActiveTab(MAIN_TAB)}>
          {MAIN_TAB}
        </button>
        <button className={`tab ${activeTab === DATA_TAB ? 'active' : ''}`} onClick={() => setActiveTab(DATA_TAB)}>
          {DATA_TAB}
        </button>
        <button className={`tab ${activeTab === COVER_LETTER ? 'active' : ''}`} onClick={() => setActiveTab(COVER_LETTER)}>
          {COVER_LETTER}
        </button>
        <button className={`tab ${activeTab === CONFIG ? 'active' : ''}`} onClick={() => setActiveTab(CONFIG)}>
          {CONFIG}
        </button>
      </div>

      <div className="tab-content">
        {/* General Tab */}
        {activeTab === MAIN_TAB && (
          <>
            <div className="general-section">
              <h2 className="section-title">Current Configuration</h2>

              {provider ? (
                <div className="provider-display">
                  <div className="provider-info">
                    <div className="provider-logo">
                      {provider === OPENAI && (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" fill="currentColor"/>
                        </svg>
                      )}
                      {provider === GEMINI && (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {provider === OLLAMA && (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                          <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2"/>
                          <circle cx="12" cy="12" r="2" fill="currentColor"/>
                        </svg>
                      )}
                    </div>
                    <div className="provider-details">
                      <span className="provider-label">Provider</span>
                      <span className="provider-name">{provider}</span>
                    </div>
                  </div>
                  {model && (
                    <div className="model-display">
                      <span className="model-label">Model</span>
                      <span className="model-name">{model}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-config">
                  <p>No configuration found. Please set up your provider in Settings.</p>
                </div>
              )}
            </div>
            {/* Fill History (F-024) */}
            {fillHistory.length > 0 && (
              <div className="history-section">
                <h2 className="section-title">Recent Fills</h2>
                <div className="history-list">
                  {fillHistory.slice(0, 5).map((entry) => (
                    <div key={`${entry.timestamp}-${entry.domain}`} className="history-item">
                      <div className="history-domain">{entry.domain}</div>
                      <div className="history-meta">
                        <span>{entry.fieldsFilled}/{entry.fieldsTotal} fields</span>
                        <span className="history-time">{formatTimeAgo(entry.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <button className='button' onClick={onFillForm}>
                {picker ? 'Stop' : 'Fill This Page'}
              </button>
            </div>
          </>
        )}

        {/* Data Tab (F-012: Structured Data) */}
        {activeTab === DATA_TAB && (
          <>
            {/* Import from Resume (F-014) */}
            <div className="import-section">
              <input type="file" accept=".pdf" ref={fileInputRef} style={{ display: 'none' }}
                onChange={handleResumeImport} />
              <button className="button-import" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="12" y1="18" x2="12" y2="12"></line>
                  <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
                {isImporting ? 'Importing...' : 'Import from Resume (PDF)'}
              </button>
            </div>

            {/* Basic Info Section */}
            <div className="collapsible-section">
              <button className="section-header" onClick={() => toggleSection('basicInfo')}>
                <span>Basic Info</span>
                <span className="section-chevron">{expandedSections.basicInfo ? '\u25B2' : '\u25BC'}</span>
              </button>
              {expandedSections.basicInfo && (
                <div className="section-body">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input className="form-control" value={userData.fullName} placeholder="John Doe"
                      onChange={e => setUserData(d => ({ ...d, fullName: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input className="form-control" type="email" value={userData.email} placeholder="john@example.com"
                      onChange={e => setUserData(d => ({ ...d, email: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input className="form-control" value={userData.phone} placeholder="+1 (555) 123-4567"
                      onChange={e => setUserData(d => ({ ...d, phone: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <input className="form-control" value={userData.location} placeholder="City, State"
                      onChange={e => setUserData(d => ({ ...d, location: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>LinkedIn URL</label>
                    <input className="form-control" value={userData.linkedinUrl} placeholder="https://linkedin.com/in/johndoe"
                      onChange={e => setUserData(d => ({ ...d, linkedinUrl: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>

            {/* Experience & Skills Section */}
            <div className="collapsible-section">
              <button className="section-header" onClick={() => toggleSection('experience')}>
                <span>Experience & Skills</span>
                <span className="section-chevron">{expandedSections.experience ? '\u25B2' : '\u25BC'}</span>
              </button>
              {expandedSections.experience && (
                <div className="section-body">
                  <div className="form-group">
                    <label>Work Experience</label>
                    <textarea className="form-control" rows={4} value={userData.workExperience}
                      placeholder="Company, Title, Dates, Description..."
                      onChange={e => setUserData(d => ({ ...d, workExperience: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Education</label>
                    <textarea className="form-control" rows={3} value={userData.education}
                      placeholder="School, Degree, Dates..."
                      onChange={e => setUserData(d => ({ ...d, education: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Skills</label>
                    <input className="form-control" value={userData.skills}
                      placeholder="JavaScript, React, Python, ..."
                      onChange={e => setUserData(d => ({ ...d, skills: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>

            {/* Additional Info Section */}
            <div className="collapsible-section">
              <button className="section-header" onClick={() => toggleSection('additional')}>
                <span>Additional Info</span>
                <span className="section-chevron">{expandedSections.additional ? '\u25B2' : '\u25BC'}</span>
              </button>
              {expandedSections.additional && (
                <div className="section-body">
                  <div className="form-group">
                    <label>Anything else the AI should know</label>
                    <textarea className="form-control" rows={3} value={userData.additionalInfo}
                      placeholder="Visa status, salary expectations, availability..."
                      onChange={e => setUserData(d => ({ ...d, additionalInfo: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>

            <div className="data-actions">
              <button className="button-inline" onClick={saveUserData}>Save Data</button>
              <button className="button-reset-inline" onClick={resetAllData}>Reset All</button>
            </div>

            {/* Data Export/Import (F-025) */}
            <div className="export-import-section">
              <h2 className="section-title">Backup & Restore</h2>
              <div className="export-import-actions">
                <button className="button-secondary" onClick={handleExportData}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Export
                </button>
                <input type="file" accept=".json" ref={importFileRef} style={{ display: 'none' }}
                  onChange={handleImportData} />
                <button className="button-secondary" onClick={() => importFileRef.current?.click()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  Import
                </button>
              </div>
            </div>
          </>
        )}

        {/* Cover Letter Tab (F-023) */}
        {activeTab === COVER_LETTER && (
          <>
            <div className="cover-letter-section">
              <div className="form-group">
                <label>Job Description</label>
                <textarea className="form-control" rows={5} value={jobDescription}
                  placeholder="Paste the job description here..."
                  onChange={e => setJobDescription(e.target.value)} />
              </div>
              <button className="button-primary cover-letter-btn" onClick={handleGenerateCoverLetter}
                disabled={isGenerating || !jobDescription.trim()}>
                {isGenerating ? 'Generating...' : 'Generate Cover Letter'}
              </button>

              {coverLetter && (
                <div className="cover-letter-output">
                  <div className="cover-letter-header">
                    <span>Generated Cover Letter</span>
                    <button className="copy-btn" onClick={copyCoverLetter} title="Copy to clipboard">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  </div>
                  <div className="cover-letter-text">{coverLetter}</div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Settings Tab */}
        {activeTab === CONFIG && (
          <>
            <div className="form-group">
              <label>Provider</label>
              <select className='form-control' onChange={selectProvider} value={provider}>
                <option value="">Select</option>
                <option value={OPENAI}>{OPENAI}</option>
                <option value={GEMINI}>{GEMINI}</option>
                <option value={OLLAMA}>{OLLAMA}</option>
              </select>
            </div>
            {provider !== OLLAMA && (
              <div className="form-group">
                <label>API Key</label>
                <input type="password" className='form-control' onChange={selectKey} value={apiKey} />
              </div>
            )}
            {provider === OLLAMA && (
              <div className="form-group">
                <label>Local URL</label>
                <input className='form-control' onChange={selectUrl} value={url} />
              </div>
            )}
            {(modelList.length !== 0 || model) && (
              <div className="form-group">
                <label>LLM Model</label>
                <input className='form-control' onChange={selectModel} value={model} list='modelList' />
                <datalist id="modelList">
                  {modelList.map((m) => <option key={m} value={m}>{m}</option>)}
                </datalist>
              </div>
            )}
            <div className='disclaimer'>
              <p>The API keys will be stored locally and not be seen by FormAI</p>
            </div>
            <div className="form-group">
              <button className='button' onClick={onSaveConfig}>Save Config</button>
            </div>
          </>
        )}

        <ToastContainer position='top-right' autoClose={3000} pauseOnFocusLoss={false} pauseOnHover={false} />
      </div>
    </div>
  )
}

export default Popup

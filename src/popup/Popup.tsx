import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import { fetchModelList } from './utils';

const MAIN_TAB = 'General';
const CONFIG = 'Settings';

const OLLAMA = 'Ollama';
const OPENAI = 'OpenAI';
const GEMENI = 'Gemini';

const AUTO_FILL = 'autoFill';
const SMART_DETECT = 'smartDetect';
const AUTO_SUBMIT = 'autoSubmit';

type Options = {
  autoFill: boolean,
  smartDetect: boolean,
  autoSubmit: boolean,
}

type NotificationProp = {
  message: string,
  type?: 'success' | 'error' | 'warning',
}

type Providers = `${typeof OLLAMA}` | `${typeof GEMENI}` | `${typeof OPENAI}` | ``;

type OptionValues = `${typeof AUTO_FILL}` | `${typeof SMART_DETECT}` | `${typeof AUTO_SUBMIT}`;

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

function Popup() {
  const [activeTab, setActiveTab] = useState(MAIN_TAB);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [notificationId, setNotificationId] = useState<number | undefined>(undefined);
  const [model, setModel] = useState<string>('');
  const [provider, setProvider] = useState<Providers>('');
  const [apiKey, setAPIKey] = useState<string>('');
  const [url, setUrl] = useState<string>('http://localhost:11434/v1');
  const [options, setOptions] = useState<Options>({ [AUTO_FILL]: false, [SMART_DETECT]: false, [AUTO_SUBMIT]: false});
  const [modelList, setModelList] = useState<string[]>([]);
  const [notification, setNotification] = useState<string>('');
  const [notificationType, setNotificationType] = useState<'success' | 'error' | 'warning'>('success');

  useEffect(() => {
    // Load saved theme from storage

    chrome.storage.sync.get(['theme', 'options'], (result) => {
      if (result.theme) {
        setTheme(result.theme)
      }

      if(result.options){
        setOptions(result.options);
      }
    });

    chrome.storage.local.get(['provider', 'apiKey', 'model', 'url', 'options'], async (result) => {
      if(result.provider){
        setProvider(result.provider);
      }

      if(result.apiKey){
        try{
          const response = await chrome.runtime.sendMessage({
            type: 'decrypt',
            data: result.apiKey
          });

          if(response.status){
            setAPIKey(response.decrypted);
          }
        }
        catch(error: any){
          const id = setTimeout(() => {
            resetNotification()
          }, 2000);
          createNotification(`API key can't be fetched` + error.message, id, 'error');
        }
      }

      if(result.model){
        setModel(result.model);
      }

      if(result.url){
        setUrl(result.url);
      }
    });

    return () => {
      clearTimeout(notificationId);
    }
  }, []);

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

  const fetchModels = async (provider: Providers, apiKey?: string, url?: string) => {
    if(provider === OLLAMA){
      if(url){
        try{
          const models = await fetchModelList(provider, undefined, url);
          setModelList(models);
        }
        catch(error: any){
          setModelList([]);
          toast.error(error.message);
        }
      }
    }
    else if(provider){
      if(apiKey){
         try{
          const models = await fetchModelList(provider, apiKey);
          setModelList(models);
        }
        catch(error: any){
          setModelList([]);
          toast.error(error.message);
        }
      }
    }
  }

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    // Save theme to storage
    chrome.storage.sync.set({ theme: newTheme })
  };

  const onSaveConfig = async (event: React.MouseEvent<HTMLButtonElement>) => {
    clearTimeout(notificationId);

    if(!provider || ((provider === OLLAMA && !url) || (provider !== OLLAMA && !apiKey))){
      const id = setTimeout(() => {
        resetNotification();
      }, 2000);

      createNotification('Parameters are invalid', id, 'error');
      return;
    }

    try{
      const response = await chrome.runtime.sendMessage({
        type: 'encrypt',
        data: apiKey,
      });
    
      if(!response.status){
        const id = setTimeout(() => {
          resetNotification();
        }, 2000);
        createNotification('Configuration failed to save ' + response.error, id, 'error');
        return;
      }

      chrome.storage.local.set({
        provider,
        apiKey: response.encrypted,
        model,
        url
      });
    
      const id = setTimeout(() => {
        resetNotification();
      }, 2000);
      createNotification('Configuration saved succesfully', id);
    }
    catch(error: any){
      const id = setTimeout(() => {
         resetNotification()
      }, 2000);
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
    fetchModels(provider, event.target.value, url);
  }

  const selectUrl = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
    fetchModels(provider, apiKey, event.target.value);
  }

  const toggleOptions = (title: OptionValues, event: React.ChangeEvent<HTMLInputElement>) => {
     const newOpt = {...options};
     newOpt[title] = event.target.checked;
     chrome.storage.sync.set({options: newOpt});
     setOptions(newOpt);
  }

  const onFillForm = () => {
    if(!provider){
      toast.error('Please select the provider');
      return;
    }

    if(!model){
      toast.error('Please select the model');
      return;
    }

    if(provider !== OLLAMA && !apiKey){
      toast.error('API key is not set');
      return;
    }
  }

  return (
    <div className={`popup-container ${theme}`}>
      {/* Notification Bar */}
      { notificationId && notification && <Notification message={notification} type={notificationType} /> }
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
        <button
          className={`tab ${activeTab === MAIN_TAB ? 'active' : ''}`}
          onClick={() => setActiveTab(MAIN_TAB)}
        >
         {MAIN_TAB}
        </button>
        <button
          className={`tab ${activeTab === CONFIG ? 'active' : ''}`}
          onClick={() => setActiveTab(CONFIG)}
        >
          {CONFIG}
        </button>

      </div>

        <div className="tab-content">
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
                        {provider === GEMENI && (
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

              <div className="general-section">
                {/* <h2 className="section-title">Options</h2> */}
                
                <div className="toggle-group">
                  <div className="toggle-item">
                    <div className="toggle-info">
                      <span className="toggle-label">Auto-fill on page load</span>
                      <span className="toggle-description">Automatically fill forms when page loads</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={options[AUTO_FILL]} onChange={toggleOptions.bind(undefined, AUTO_FILL)} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="toggle-item">
                    <div className="toggle-info">
                      <span className="toggle-label">Smart detection</span>
                      <span className="toggle-description">Detect and suggest form field values</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={options[SMART_DETECT]} onChange={toggleOptions.bind(undefined, SMART_DETECT)}/>
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="toggle-item">
                    <div className="toggle-info">
                      <span className="toggle-label">Auto Submit</span>
                      <span className="toggle-description">Submit the form when filled</span>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={options[AUTO_SUBMIT]} onChange={toggleOptions.bind(undefined, AUTO_SUBMIT)}/>
                      <span className="toggle-slider" ></span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <button className='button' onClick={onFillForm}>Fill Form</button>
              </div>
            </>
          )}
          {activeTab === CONFIG && (
          <>
            <div className="form-group">
              <label>Provider</label>
              <select className='form-control' onChange={selectProvider} value={provider}>
                <option value="">Select</option>
                <option value={OPENAI}>{OPENAI}</option>
                <option value={GEMENI}>{GEMENI}</option>
                <option value={OLLAMA}>{OLLAMA}</option>
              </select>
            </div>
            { provider !== OLLAMA && (
              <div className="form-group">
                <label>API Key</label>
                <input type="password" className='form-control' onChange={selectKey} value={apiKey}  />
              </div>
            )}
            { provider === OLLAMA && (
            <div className="form-group">
              <label>Local URL</label>
              <input className='form-control' onChange={selectUrl} value={url}/>
            </div>
            )}
            { (modelList.length !== 0 || model) && <div className="form-group">
                <label>Model Name</label>
                <input className='form-control' onChange={selectModel} value={model} list='modelList'/>
                <datalist id="modelList">
                  { modelList.map((model) => <option value={model}>{model}</option>) } 
                </datalist>
              </div>
            }
            <div className='disclaimer'>
              <p>The API key will be stored locally and not be seen by FormAI</p>
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


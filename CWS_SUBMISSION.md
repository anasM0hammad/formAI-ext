# FormAI — Chrome Web Store Submission: Complete Compliance Package

> This document contains every field required by the Chrome Web Store Developer Dashboard
> for publishing FormAI, including the Privacy Policy, Permission Justifications,
> Data Usage Disclosures, Single Purpose Description, and Remote Code Declaration.
> All answers are based on the actual source code behavior of the extension.

---

## TABLE OF CONTENTS

1. [Single Purpose Description](#1-single-purpose-description)
2. [Permission Justifications](#2-permission-justifications)
3. [Host Permission Justifications](#3-host-permission-justifications)
4. [Data Usage Disclosures (Checkboxes)](#4-data-usage-disclosures)
5. [Limited Use Certification (Checkboxes)](#5-limited-use-certification)
6. [Remote Code Declaration](#6-remote-code-declaration)
7. [Privacy Policy URL Content](#7-privacy-policy)

---

## 1. SINGLE PURPOSE DESCRIPTION

**Field:** *"What does your extension do? Describe the single purpose of your extension in detailed and clear language."*

```
FormAI is an AI-powered job application autofill tool. Its single purpose is to
help users fill out online job application forms by using their saved personal
information (name, email, work history, skills, education) combined with AI to
intelligently match and fill form fields. Users enter their information once,
and the extension fills job application fields on sites like Workday, Greenhouse,
Lever, iCIMS, and LinkedIn. The extension also supports importing data from
resume PDFs and generating tailored cover letters. All user data is stored
locally in the browser. The extension supports multiple AI providers including
a fully offline local AI option (WebLLM) that requires no API key and no
internet connection.
```

---

## 2. PERMISSION JUSTIFICATIONS

### Permission: `storage`

**Field:** *"Why does your extension need this permission?"*

```
The "storage" permission is required to save and retrieve user data locally within
the browser using chrome.storage.local and chrome.storage.sync. Specifically:

1. chrome.storage.local stores: the user's personal information (name, email, phone,
   work experience, education, skills) that they manually enter or import from their
   resume PDF; the user's selected AI provider and model name; the user's API key
   (encrypted with AES-256-GCM before storage); form fill history (domain, URL,
   timestamp, field counts — last 50 entries); the onboarding/picker UI state; and
   an installation-generated encryption key used for API key encryption.

2. chrome.storage.sync stores: the user's theme preference (dark/light) and whether
   onboarding has been completed, so these persist across devices.

No data is stored on any external server. All storage is browser-local. The extension
cannot function without this permission because it needs to persist the user's profile
data between sessions to fill forms on subsequent visits.
```

### Permission: `activeTab`

**Field:** *"Why does your extension need this permission?"*

```
The "activeTab" permission is required so the extension can access the content of
the currently active tab ONLY when the user explicitly clicks the extension icon or
the "Fill This Page" button. This permission grants temporary access to the active
tab's DOM, which is needed to:

1. Scan the page for form fields (input, select, textarea elements)
2. Read field labels (via aria-label, label elements, placeholder text, etc.)
3. Fill the detected form fields with the user's saved information

Without activeTab, the extension cannot read or modify form fields on the page.
The activeTab permission is preferred over broader host permissions like <all_urls>
because it only grants access when the user takes an explicit action, providing
better privacy. The extension never reads page content in the background or without
user initiation.
```

### Permission: `scripting`

**Field:** *"Why does your extension need this permission?"*

```
The "scripting" permission is required to programmatically inject the content script
into the active tab when the user clicks "Fill This Page." The extension uses
chrome.scripting.executeScript() to inject its form-detection and form-filling
logic into the current page.

This is done programmatically (rather than via the manifest content_scripts field)
specifically for privacy: the content script is ONLY injected when the user
explicitly requests it, rather than running automatically on every page the user
visits. This approach minimizes the extension's footprint and avoids unnecessary
access to pages where the user does not need form filling.

The injected script scans visible form fields, identifies their labels, sends
field data to the background service worker for AI processing, and fills fields
with the returned values. It does not read or transmit any other page content.
```

---

## 3. HOST PERMISSION JUSTIFICATIONS

### Host Permission: `https://api.openai.com/*`

**Field:** *"Why does your extension need access to this host?"*

```
Required to make API calls to OpenAI's chat completions endpoint when the user
has selected OpenAI as their AI provider. The extension sends form field labels
and the user's stored personal context to the API to get intelligent fill values.
The API key is provided by the user (BYOK — Bring Your Own Key) and stored
encrypted locally. This host is only contacted when the user has explicitly
configured OpenAI as their provider AND initiates a form fill action. No data
is sent to OpenAI unless both conditions are met.
```

### Host Permission: `https://generativelanguage.googleapis.com/*`

**Field:** *"Why does your extension need access to this host?"*

```
Required to make API calls to Google's Gemini generative AI endpoint when the
user has selected Gemini as their AI provider. The extension uses the
OpenAI-compatible endpoint at generativelanguage.googleapis.com/v1beta/openai/
to send form field labels and user context for intelligent form filling. The
API key is provided by the user (BYOK) and stored encrypted locally. This host
is only contacted when the user has explicitly configured Gemini as their
provider AND initiates a form fill action.
```

### Host Permission: `http://localhost:11434/*`

**Field:** *"Why does your extension need access to this host?"*

```
Required to communicate with a locally-running Ollama server when the user has
selected Ollama as their AI provider. Ollama is a self-hosted AI inference
server that users run on their own machine. The default port is 11434. This
host permission enables the extension to send form field data to the user's
own local AI server for processing. No data leaves the user's machine when
using Ollama. This host is only contacted when the user has explicitly
configured Ollama as their provider AND initiates a form fill action. The
user can also configure a custom Ollama URL if they run it on a different port.
```

---

## 4. DATA USAGE DISCLOSURES

**Chrome Web Store Developer Dashboard → Privacy practices → Data usage**

*"Select what types of data your extension collects from users:"*

| # | Data Type Category | Collected? | Justification |
|---|---|---|---|
| 1 | **Personally identifiable information** (e.g., name, address, email address, age, ID number) | **YES** | The user voluntarily enters their name, email, phone number, location, and LinkedIn URL in the extension's Data tab. This information is stored ONLY in the browser's local storage (chrome.storage.local) and is used ONLY to fill job application form fields when the user explicitly requests it. This data is never transmitted to any server owned or operated by the extension developer. When a cloud AI provider (OpenAI/Gemini) is used, the user's data is sent to the AI provider's API solely for form field matching — the user explicitly opts in to this by configuring their own API key. When using WebLLM (local AI) or Ollama, no personally identifiable information ever leaves the browser or the user's machine. |
| 2 | **Health information** | **NO** | The extension does not collect, request, store, or process any health-related information. |
| 3 | **Financial and payment information** | **NO** | The extension does not collect, request, store, or process any financial data, credit card numbers, bank information, or payment details. The extension is entirely free with no payment functionality. |
| 4 | **Authentication information** (e.g., passwords, credentials, security questions) | **YES** | The extension stores the user's AI provider API key (for OpenAI or Gemini) in chrome.storage.local. The API key is encrypted using AES-256-GCM via the Web Crypto API before storage, with a per-installation random 256-bit key and random 12-byte IV per encryption operation. The API key is only decrypted at the moment it is needed for an API call and is never logged, transmitted to any third party, or exposed in the UI. The user provides their own API key (BYOK model). No passwords, login credentials, or security questions are ever collected. Users who choose WebLLM or Ollama do not need to provide any authentication information at all. |
| 5 | **Personal communications** | **NO** | The extension does not access, read, or store any personal communications such as emails, text messages, or chat content. |
| 6 | **Location** | **NO** (not collected from device) | The extension does NOT access the device's geolocation. However, the user may voluntarily type a location string (e.g., "New York, NY") into the Data tab as part of their profile. This is user-provided text, not device-derived location data. It is stored locally and used only to fill "City" or "Location" fields on job applications. |
| 7 | **Web history** | **NO** | The extension does not access, monitor, or store the user's browsing history or web history. The only URL data recorded is the domain and URL of pages where the user explicitly used the "Fill This Page" feature, stored locally as "fill history" (last 50 entries) so the user can see where they previously used the extension. This is user-initiated action logging, not passive web history collection. |
| 8 | **User activity** (e.g., network monitoring, clicks, mouse position, scroll, keystroke logging) | **NO** | The extension does not monitor network activity, mouse movements, scroll position, or keystrokes. The only user-initiated action captured is a click event handler that activates ONLY when the user has explicitly entered "picker mode" to select individual form fields for filling. This handler is removed when picker mode is deactivated and does not log or store click data. |
| 9 | **Website content** | **YES** | When the user clicks "Fill This Page," the content script reads form field elements (input, select, textarea) on the current page to extract their labels (via aria-label, label elements, placeholder text, name attributes, etc.). This label text is sent to the background service worker to match against the user's profile data. The extension does NOT read the general text content, images, or other elements of the page — only form field labels. This data is processed in memory and not persisted. The extension also reads the page's hostname to match platform-specific form templates (e.g., Workday, Greenhouse) for more reliable field detection. |

---

## 5. LIMITED USE CERTIFICATION

**Chrome Web Store Developer Dashboard → Privacy practices → Data usage → Certification checkboxes**

*Developers must check all applicable certification boxes. For FormAI:*

| Certification Statement | Answer | Explanation |
|---|---|---|
| **"I do not sell or transfer user data to third parties, outside of the approved use cases"** | **CERTIFIED ✓** | FormAI never sells or transfers any user data to any third party. When the user chooses a cloud AI provider (OpenAI or Gemini), the user's profile data is sent to that provider's API solely for the core function of form filling — and only because the user explicitly configured this provider with their own API key. The developer of FormAI does not receive, store, or have access to any user data. Users who choose WebLLM (local AI) or Ollama have zero data transmitted externally. |
| **"I do not use or transfer user data for purposes that are unrelated to the item's core functionality"** | **CERTIFIED ✓** | All collected user data is used exclusively for the extension's single purpose: filling job application forms. User profile data (name, email, experience, etc.) is used only to fill form fields. API keys are used only to authenticate with the user's chosen AI provider. Fill history is used only to show the user where they previously used the extension. No data is used for advertising, analytics, profiling, or any purpose unrelated to form filling. |
| **"I do not use or transfer user data to determine creditworthiness or for lending purposes"** | **CERTIFIED ✓** | FormAI has no functionality related to credit assessment, financial scoring, or lending. User data is never transferred to any financial institution, credit bureau, or lending service. |

---

## 6. REMOTE CODE DECLARATION

**Field:** *"Does your extension execute remote code?"*

```
Answer: NO

FormAI does not load or execute any remotely-hosted code. All JavaScript,
CSS, and WASM code is bundled at build time and included in the extension
package (dist/ folder). Specifically:

- The popup UI (React), background service worker, and content script are all
  compiled and bundled via Vite at build time into static JS files.
- The PDF.js library (pdf.worker.min.mjs) is bundled in the extension package.
- The WebLLM SDK (@mlc-ai/web-llm) is bundled at build time. The WebLLM model
  weights (~1.5 GB) are downloaded at runtime from Hugging Face CDN, but these
  are DATA files (model weights in binary format), not executable code. The
  inference engine that executes these weights is the bundled WebLLM SDK and
  the browser's native WebGPU implementation.
- The embedding model (Xenova/all-MiniLM-L6-v2) used by EntityDB is loaded
  via the bundled transformers.js library. The model weights are downloaded at
  runtime but are data (ONNX model files), not executable code.
- The extension's Content Security Policy explicitly restricts script sources
  to 'self' and 'wasm-unsafe-eval' (required for WebLLM's WebAssembly
  execution). No remote scripts can be loaded.

The 'wasm-unsafe-eval' CSP directive is required because WebLLM compiles
WebAssembly modules at runtime for GPU-accelerated inference. This is not
remote code — the WASM modules are generated locally from bundled code and
downloaded model weight data.
```

---

## 7. PRIVACY POLICY

**This is the full privacy policy to be hosted at a publicly accessible URL and linked in the Developer Dashboard.**

---

# FormAI Privacy Policy

**Last Updated:** March 4, 2026
**Extension Name:** FormAI — AI Job Application Autofill
**Developer:** FormAI
**Contact:** [INSERT YOUR CONTACT EMAIL HERE]

---

## 1. Introduction

FormAI ("the Extension," "we," "our") is a Chrome browser extension that helps users fill out online job application forms using AI. This Privacy Policy describes what data the Extension collects, how it is used, how it is stored, and your rights regarding that data. We are committed to protecting your privacy. The Extension is designed with a local-first, privacy-first architecture — your data stays in your browser.

---

## 2. Data We Collect

### 2.1 Data You Provide Directly

When you use FormAI, you may voluntarily provide the following personal information by entering it into the Extension's Data tab or by importing it from a resume PDF:

- **Full Name**
- **Email Address**
- **Phone Number**
- **Location** (city/state/country — typed by you, not derived from device GPS)
- **LinkedIn Profile URL**
- **Work Experience** (job titles, company names, dates, descriptions)
- **Education** (schools, degrees, dates)
- **Skills** (comma-separated list)
- **Additional Information** (free-form text)

You choose what to enter. All fields are optional. You can delete all data at any time using the "Reset" function.

### 2.2 API Keys (Authentication Credentials)

If you choose a cloud-based AI provider (OpenAI or Google Gemini), you provide your own API key. This key is:

- Encrypted using **AES-256-GCM** via the Web Crypto API before storage
- Encrypted with a unique 256-bit key generated at installation time
- Encrypted with a random 12-byte initialization vector (IV) per encryption operation
- Stored only in `chrome.storage.local` (browser-local, not synced)
- Decrypted only at the moment of an API call, then immediately discarded from memory
- Never logged, never displayed in plain text in the UI, and never transmitted to any party other than the AI provider you configured

If you choose WebLLM (Local AI) or Ollama, no API key is needed.

### 2.3 Form Fill History

When you use the "Fill This Page" feature, the Extension records:

- The domain name (e.g., "boards.greenhouse.io")
- The full page URL
- The timestamp
- The number of form fields detected
- The number of fields successfully filled

This is stored locally (last 50 entries) so you can see where you've previously used FormAI. No fill history is transmitted externally.

### 2.4 Form Field Labels (Transient — Not Stored)

When you click "Fill This Page," the Extension reads form field labels from the current page (e.g., "First Name," "Email Address," "Years of Experience"). These labels are:

- Processed in memory to match against your saved data
- Sent to your configured AI provider (if using a cloud provider) as part of the form-filling prompt
- **Not stored** persistently — they exist only during the active fill operation

### 2.5 Resume PDF Text (Transient — Not Stored)

When you use "Import from Resume," the Extension extracts text from your uploaded PDF file using the pdf.js library running locally in your browser. The extracted text is:

- Processed locally to extract structured fields (name, email, phone via regex; experience, education, skills via AI)
- Sent to your configured AI provider for parsing (if using a cloud provider)
- **Not stored** after parsing is complete — only the extracted structured fields are saved to your profile

### 2.6 Data We Do NOT Collect

FormAI does **NOT** collect:

- Browsing history or web history
- Keystrokes, mouse movements, scroll activity, or clicks (outside the explicit picker mode)
- Device geolocation (GPS, IP-based location, etc.)
- Health information
- Financial or payment information
- Personal communications (emails, messages, chats)
- Cookies or tracking identifiers
- Device fingerprints or hardware identifiers
- Network traffic or monitoring data
- Screenshots or page content (other than form field labels)
- Any data when the Extension is not actively being used by you

---

## 3. How We Use Your Data

All data collected by FormAI is used for a **single purpose**: filling job application forms.

| Data | How It Is Used |
|---|---|
| Personal information (name, email, etc.) | Matched to form fields to auto-fill job applications |
| Work experience, education, skills | Provided as context to AI for intelligent field matching and cover letter generation |
| API key | Authenticates requests to your chosen cloud AI provider |
| Fill history | Displayed to you in the Extension popup so you can track your applications |
| Form field labels | Matched against your profile data to determine the correct value for each field |
| Resume PDF text | Parsed to extract your personal information to pre-populate your profile |

We do **NOT** use your data for:

- Advertising or personalized ads
- User profiling or behavioral analysis
- Credit assessment or lending decisions
- Training AI models (your data is not used to train any models)
- Selling or transferring to data brokers
- Analytics, telemetry, or usage tracking
- Any purpose unrelated to form filling

---

## 4. How We Store Your Data

### 4.1 Local Storage Only

All user data is stored exclusively within your browser using:

- **`chrome.storage.local`**: Your personal information, encrypted API key, provider settings, fill history
- **`chrome.storage.sync`**: Theme preference (dark/light) and onboarding completion flag only — synced across your Chrome profile
- **IndexedDB** (via EntityDB library): Vector embeddings of your profile data for semantic search during form filling. The embedding model (`Xenova/all-MiniLM-L6-v2`) runs locally in your browser

### 4.2 No External Servers

FormAI has **no backend server, no database, no cloud storage, and no developer-operated infrastructure**. There is no server for your data to be sent to. The developer never has access to your data.

### 4.3 Encryption

API keys are encrypted before storage using:

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key derivation:** A 256-bit random key generated via `crypto.getRandomValues()` at Extension installation, stored in `chrome.storage.local`
- **IV:** A fresh random 12-byte IV is generated for each encryption operation
- **Implementation:** The Web Crypto API (`crypto.subtle`), which is the browser's native cryptographic library

---

## 5. Data Sharing and Third-Party Access

### 5.1 Cloud AI Providers (User-Configured)

If you choose to use a cloud-based AI provider, the following data is sent to that provider's API when you initiate a form fill or cover letter generation:

| Provider | Endpoint | Data Sent |
|---|---|---|
| OpenAI | `https://api.openai.com/v1/chat/completions` | Your API key (in Authorization header), form field labels, relevant portions of your profile data as context |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/` | Your API key (in Authorization header), form field labels, relevant portions of your profile data as context |
| Ollama | `http://localhost:11434/v1/chat/completions` (your local machine) | Form field labels and relevant portions of your profile data — **no data leaves your machine** |
| WebLLM | None (runs in browser) | **No data is transmitted anywhere**. All inference happens locally via WebGPU |

**Important:** When using OpenAI or Gemini, the data sent to those providers is governed by **their** respective privacy policies, not ours. You are using your own API key and your own account with those providers. We encourage you to review:

- OpenAI's Privacy Policy: https://openai.com/policies/privacy-policy
- Google's Privacy Policy: https://policies.google.com/privacy

### 5.2 Model Weight Downloads

- **WebLLM**: The Gemma 2 2B model weights (~1.5 GB) are downloaded from Hugging Face's CDN (`huggingface.co`) the first time you activate local AI. This is a one-time download of model data files, cached in your browser. No personal data is sent to Hugging Face during this download.
- **Embedding model**: The `all-MiniLM-L6-v2` ONNX model is downloaded from Hugging Face via the `transformers.js` library. Same as above — no personal data is transmitted.

### 5.3 No Other Third Parties

FormAI does **NOT** share data with:

- Advertising networks or platforms
- Data brokers or information resellers
- Analytics services (no Google Analytics, no Mixpanel, no telemetry)
- Social media platforms
- The extension developer or any affiliated entity
- Any other third party not listed above

---

## 6. Data Retention and Deletion

### 6.1 Retention

Your data persists in local browser storage for as long as the Extension is installed. There is no time-based expiration.

Fill history is automatically trimmed to the most recent 50 entries.

### 6.2 Deletion

You can delete your data at any time through:

1. **Reset button** in the Extension's Data tab: Deletes all personal information and fill history from `chrome.storage.local` and clears the IndexedDB vector database
2. **Uninstalling the Extension**: Chrome automatically removes all data in `chrome.storage.local`, `chrome.storage.sync`, and IndexedDB associated with the Extension
3. **Browser data clearing**: Using Chrome's "Clear browsing data" → "Cookies and other site data" will clear IndexedDB. Storage data can be cleared via Developer Tools → Application → Storage

When you delete your data, it is permanently removed. There are no backups, no retention periods, and no recovery options (unless you previously used the Export feature).

### 6.3 Export and Import

FormAI includes a data export feature that downloads a JSON file containing your profile data, fill history, and settings. This file is saved to your local device. You can import this file to restore your data (e.g., after reinstalling or on a new device). The export file does **not** include your API key for security reasons.

---

## 7. Your Rights

You have the right to:

- **Access**: View all data the Extension has stored about you (visible in the Data and Settings tabs, or via the Export feature)
- **Modify**: Edit any of your stored personal information at any time
- **Delete**: Remove all stored data using the Reset function or by uninstalling the Extension
- **Portability**: Export your data as a JSON file for backup or migration
- **Choose your AI provider**: Switch between cloud (OpenAI, Gemini) and fully local (WebLLM, Ollama) providers at any time
- **Opt out of cloud processing**: By selecting WebLLM or Ollama, you ensure that absolutely no personal data is transmitted over the internet

---

## 8. Children's Privacy

FormAI is not directed at children under the age of 13 (or the applicable age of digital consent in your jurisdiction). We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided personal information to the Extension, please contact us and we will delete that information.

---

## 9. Security

We take reasonable measures to protect your data:

- API keys are encrypted with AES-256-GCM before storage
- Encryption keys are unique per installation
- The content script is injected only when explicitly triggered by you, not on every page
- The Extension's Content Security Policy restricts executable code to bundled sources only (`script-src 'self' 'wasm-unsafe-eval'`)
- No data is transmitted to developer-controlled servers
- No remote code is loaded or executed

However, as a browser extension, FormAI's security ultimately depends on the security of your browser, your operating system, and your device. We recommend keeping Chrome updated to the latest version.

---

## 10. Content Security Policy

The Extension uses the following Content Security Policy:

```
script-src 'self' 'wasm-unsafe-eval'; object-src 'self';
```

- `'self'`: Only scripts bundled with the Extension can execute
- `'wasm-unsafe-eval'`: Required for WebLLM's WebAssembly modules, which perform local AI inference on your GPU
- No remote scripts, inline scripts, or `eval()` are permitted

---

## 11. Permissions Explanation

| Permission | Why It's Needed |
|---|---|
| `storage` | Saves your profile data, settings, encrypted API key, and fill history locally in the browser |
| `activeTab` | Accesses the current tab's form fields ONLY when you click the extension icon or "Fill This Page" |
| `scripting` | Injects the form-filling script into the active page ONLY when you explicitly request it |
| `https://api.openai.com/*` | Communicates with OpenAI's API when you've selected OpenAI as your provider |
| `https://generativelanguage.googleapis.com/*` | Communicates with Google Gemini's API when you've selected Gemini as your provider |
| `http://localhost:11434/*` | Communicates with your local Ollama server when you've selected Ollama as your provider |

---

## 12. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. If we make material changes, we will update the "Last Updated" date at the top of this policy. Your continued use of the Extension after any changes constitutes acceptance of the updated policy. We recommend reviewing this policy periodically.

---

## 13. Limited Use Disclosure

The use of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements. Specifically:

- Data is used only for the Extension's core functionality (form filling)
- Data is not sold or transferred to third parties outside of the approved use cases
- Data is not used for purposes unrelated to form filling
- Data is not used to determine creditworthiness or for lending purposes
- Data is not used for serving advertisements

---

## 14. California Privacy Rights (CCPA)

If you are a California resident, you have the right to know what personal information is collected, the right to delete it, and the right to opt out of the sale of your personal information. FormAI does not sell personal information. You can exercise your rights by using the Extension's built-in Reset and Export features, or by contacting us.

---

## 15. European Privacy Rights (GDPR)

If you are in the European Economic Area (EEA), you have additional rights including the right to access, rectification, erasure, data portability, and the right to lodge a complaint with a supervisory authority. FormAI processes data based on your explicit consent (you choose to enter your data and choose when to fill forms). All data is stored locally in your browser. You can exercise your rights by using the Extension's built-in data management features, or by contacting us.

---

## 16. Contact

For questions or concerns about this Privacy Policy or the Extension's data practices, please contact:

**Email:** [INSERT YOUR CONTACT EMAIL HERE]
**GitHub:** [INSERT YOUR GITHUB REPOSITORY URL HERE]

---

## 17. Open Source

FormAI's source code is available for review. You can inspect exactly what data the Extension accesses, stores, and transmits by reading the source code directly.

---

*This privacy policy applies to FormAI version 1.0.0 and later.*

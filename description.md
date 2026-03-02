# FormAI -- Product Review & Transformation Plan

## Vision

FormAI is a free, privacy-first Chrome extension that eliminates the repetitive pain of filling job application forms. Users add their information once, and the extension intelligently fills any job application form they encounter -- on Workday, Greenhouse, Lever, LinkedIn, and everywhere else.

**Core principle:** Solve one pain point exceptionally well. Ship free. Earn users through quality.

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Critical Bugs & Fixes](#2-critical-bugs--fixes)
3. [Architecture Overhaul](#3-architecture-overhaul)
4. [UI/UX Redesign](#4-uiux-redesign)
5. [Feature Roadmap](#5-feature-roadmap)
6. [WebLLM Integration Plan](#6-webllm-integration-plan)
7. [Production Readiness Checklist](#7-production-readiness-checklist)
8. [User Growth Strategy](#8-user-growth-strategy)

---

## 1. Current State Assessment

### What Exists Today

FormAI is a Manifest V3 Chrome extension built with React 19, TypeScript 5.9, and Vite 7. It supports three AI providers (OpenAI, Google Gemini, Ollama) through a unified OpenAI SDK client. User data is stored as vector embeddings via EntityDB (IndexedDB wrapper) using the `Xenova/all-MiniLM-L6-v2` model. API keys are encrypted with AES-GCM via Web Crypto API.

### Current Architecture

```
src/
├── background/index.ts     # Service worker: LLM calls, encryption, message routing
├── content/index.tsx        # Content script: form detection, element picker, form filling
├── popup/
│   ├── Popup.tsx            # Main UI: 3-tab layout (General/Data/Settings)
│   ├── popup.css            # Styling with light/dark theme support
│   └── utils.ts             # Model list fetching from providers
├── options/
│   └── Options.tsx          # Empty options page (unused)
├── crypto.ts                # AES-GCM encryption/decryption
└── embeddings.ts            # EntityDB vector operations (insert/query/delete)
```

### Current User Flow

1. Install extension
2. Open popup → Settings tab → Select provider → Enter API key → Choose model → Save
3. Open popup → Data tab → Type personal info into a blank textarea → Click "Add"
4. Navigate to a job application page
5. Open popup → General tab → Click "Select"
6. Click a single form field on the page
7. Wait for LLM response (1-5 seconds, no loading indicator)
8. Field gets filled (or fails silently)
9. Repeat step 6-8 for every single field

### What Works Well

- **Privacy model**: All data stays on-device, API keys encrypted with AES-256-GCM, no telemetry
- **Encryption implementation** (`src/crypto.ts`): Clean, correct use of Web Crypto API with per-key random IVs
- **Multi-provider abstraction** (`src/background/index.ts:27-41`): Elegant use of OpenAI SDK with dynamic baseURL for Gemini/Ollama
- **Label detection** (`src/content/index.tsx:6-44`): 4 fallback strategies for finding field labels (parent label, `for` attribute, previous sibling, parent's previous sibling)
- **Manifest V3 compliance**: Proper service worker, module type, CSP policy
- **Dark/light theme**: Full theme support with smooth transitions
- **Vite build system** (`vite.config.ts`): Well-configured multi-entry build with separate outputs for popup, options, content, background

---

## 2. Critical Bugs & Fixes

### BUG-001: Popup Must Stay Open (Severity: Critical)

**Location**: `src/background/index.ts:12-15` and `src/popup/Popup.tsx:94-106`

**Problem**: The background service worker queries embeddings by sending a message to the popup:

```ts
// background/index.ts:12
const embeddingsResponse = await chrome.runtime.sendMessage({
  type: 'queryEmbeddings',
  data: label
});
```

The popup handles this in its `useEffect`:

```ts
// popup/Popup.tsx:94-106
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'queryEmbeddings') {
    query(request.data).then(embeddings => {
      sendResponse({ status: true, data: embeddings });
    });
    return true;
  }
});
```

Chrome popups close the moment the user clicks anywhere outside them. The natural flow -- click "Select", then click a form field -- closes the popup. The `queryEmbeddings` message goes unanswered. The entire pipeline fails silently.

**Fix**: Move all EntityDB operations into the background service worker or use an [offscreen document](https://developer.chrome.com/docs/extensions/reference/api/offscreen). The popup should be for configuration only, never part of the runtime data path.

---

### BUG-002: 50-Character Chunking Destroys Embeddings (Severity: High)

**Location**: `src/embeddings.ts:29-43`

**Problem**: Text is split at exactly 50 characters with no regard for word or sentence boundaries:

```ts
while(chunk < Math.ceil(data.length / 50)){
    const str = data.slice(i, 50+i);
    await DB?.insert({ text: str });
    i += 50;
    chunk++;
}
```

Input: `"I have 5 years of experience in Python and JavaScript"`
Produces:
- `"I have 5 years of experience in Python and JavaScr"`
- `"ipt"`

The embedding for `"ipt"` is semantic noise. It pollutes retrieval for every query. This directly degrades the core value proposition of the tool.

**Fix**: Split on sentence boundaries (period, newline, semicolon). For most user inputs via the textarea, each "Add" action is already a short statement -- treat the entire input as one document if it's under 200 characters. For longer inputs, use sentence-level splitting:

```ts
const sentences = data.match(/[^.!?\n]+[.!?\n]*/g) || [data];
for (const sentence of sentences) {
  if (sentence.trim().length > 0) {
    await DB?.insert({ text: sentence.trim() });
  }
}
```

---

### BUG-003: fillElement() Fires 40+ Events Per Field (Severity: High)

**Location**: `src/content/index.tsx:72-285` (213 lines)

**Problem**: The function attempts every possible method to set a form value, all at once, for every field:

1. Sets value directly (line 107-108)
2. Dispatches input/change/blur events (line 117-119)
3. Toggles `display:none` twice for "force reflow" (lines 53-56, 170-173)
4. Uses `nativeInputValueSetter` for React (lines 125-133) -- correct approach
5. Dispatches keydown/keyup/keypress (lines 136-138)
6. `setAttribute('value', ...)` (line 143) -- only affects HTML attribute, not DOM property
7. `focus() → blur() → focus() → blur()` cycle (lines 146-148)
8. Dispatches all 7 event types in a loop (lines 151-154)
9. **`Object.defineProperty` override** (lines 157-163) -- **this permanently breaks React's fiber state tracking on the element**
10. Another `display:none` toggle (lines 170-173)
11. `setTimeout(10ms)`: sets value again + more events (lines 176-180)
12. Character-by-character typing simulation (lines 188-194) -- **causes visible flickering**
13. `setTimeout(100ms)`: tries `innerHTML`, `.setValue()`, dispatches 9 event types, forces visual update (lines 202-228)
14. `setTimeout(50ms)`: dispatches custom event, another reflow, sets value again (lines 254-273)

Many of these conflict. The `Object.defineProperty` at step 9 overwrites the property descriptor, meaning subsequent `element.value = x` calls (steps 11, 14) may not work as expected. The character-by-character typing at step 12 clears the value that was just set in step 4.

**Fix**: Implement a strategy pattern. Detect the framework once, apply the correct method:

```
For React: nativeInputValueSetter.call(element, value) + new Event('input', { bubbles: true })
For Vue: element.value = value + new Event('input', { bubbles: true })
For Angular: element.value = value + new Event('input', { bubbles: true }) + new Event('change', { bubbles: true })
For vanilla: element.value = value + new Event('change', { bubbles: true })
```

The React path (which covers Workday, Greenhouse, and most modern job platforms) is literally 3 lines of code.

---

### BUG-004: API Keys Exposed in Browser Network Tab (Severity: High)

**Location**: `src/popup/utils.ts:7-8`

**Problem**: The `fetchModelList()` function uses `dangerouslyAllowBrowser: true` to make OpenAI SDK calls directly from the popup context:

```ts
OpenAI: {
    apiKey: key,
    dangerouslyAllowBrowser: true
}
```

This means API key is visible in the Network tab of Chrome DevTools as a request header. Any page with XSS could potentially intercept it.

**Fix**: Route model list fetching through the background service worker. The popup sends `{ type: 'fetchModels', provider, apiKey }` to background, background makes the API call, returns the model list.

---

### BUG-005: Content Script Injected on Every Page (Severity: Medium)

**Location**: `manifest.json:23-28`

**Problem**:

```json
"content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/index.js"],
      "type": "module"
    }
]
```

The content script injects into every page the user visits -- Gmail, YouTube, banking sites, everything. This:
- Triggers Chrome Web Store review flags (broad host permissions)
- Appears in the permissions dialog as "Read and change all your data on all websites" -- scares users
- Wastes resources running on pages with no forms

**Fix**: Remove the `content_scripts` block from manifest. Use programmatic injection:

```ts
// When user clicks "Fill This Page"
chrome.scripting.executeScript({
  target: { tabId: tab.id },
  files: ['content/index.js']
});
```

This requires only `activeTab` + `scripting` permissions, which are already declared.

---

### BUG-006: Fills "NA" or "Error" Into Form Fields (Severity: Medium)

**Location**: `src/content/index.tsx:318-327`

**Problem**: When the LLM returns `null` or fails, the code fills the form field with literal text "NA" or "Error":

```ts
if(answer && answer.length && answer != 'null'){
  fillElement(clickedElement, answer);
} else {
  fillElement(clickedElement, 'NA');
}
// ...
catch (error) {
  fillElement(clickedElement, 'Error');
}
```

A user submitting a job application with "NA" or "Error" in a field is worse than leaving it blank.

**Fix**: Skip the field entirely. Show a visual indicator (red border or tooltip) saying "Couldn't fill this field" and let the user handle it manually.

---

### BUG-007: No Loading State During LLM Calls (Severity: Medium)

**Location**: `src/content/index.tsx:296-335`

**Problem**: When a user clicks a field in picker mode, the LLM call takes 1-5 seconds. There is zero visual feedback. The user doesn't know if the click registered, if processing is happening, or if it failed. They'll click again, triggering duplicate requests.

**Fix**: Add immediate visual feedback:
- On click: add a subtle pulsing border or spinner overlay to the clicked field
- On success: flash green briefly, then show the filled value
- On failure: flash red with a tooltip

---

### BUG-008: deleteVector() Doesn't Return a Promise (Severity: Low)

**Location**: `src/embeddings.ts:70-81`

**Problem**: `deleteVector()` uses raw `indexedDB.deleteDatabase()` callbacks instead of returning a Promise. The `await deleteVector()` in `Popup.tsx:169` doesn't actually wait for completion:

```ts
export const deleteVector = async () => {
    const deleteRequest = indexedDB.deleteDatabase('EntityDB');
    deleteRequest.onsuccess = function() {
        DB = null;
    }
    // Returns immediately, doesn't wait for onsuccess
}
```

**Fix**: Wrap in a proper Promise:

```ts
export const deleteVector = () => {
    return new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase('EntityDB');
        req.onsuccess = () => { DB = null; resolve(); };
        req.onerror = () => reject(new Error('Failed to delete database'));
    });
};
```

---

### BUG-009: Model List Missing React Key Prop (Severity: Low)

**Location**: `src/popup/Popup.tsx:512`

**Problem**:

```tsx
{ modelList.map((model) => <option value={model}>{model}</option>) }
```

Missing `key` prop. React will log a console warning.

**Fix**: Add `key={model}` to the `<option>` element.

---

### BUG-010: Fetching Models on Every Keystroke (Severity: Low)

**Location**: `src/popup/Popup.tsx:280-283`

**Problem**: `selectKey` calls `fetchModels()` on every keystroke of the API key input:

```ts
const selectKey = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAPIKey(event.target.value);
    fetchModels(provider, event.target.value, url);
}
```

This fires 30+ API calls while typing a 32-character API key. Most will fail (invalid partial key) and produce error toasts.

**Fix**: Debounce the `fetchModels` call (300-500ms), or only fetch on blur/save.

---

### BUG-011: Dead Code and Non-Functional UI Elements (Severity: Low)

**Locations**:
- `src/background/index.ts:98-112`: Commented-out `store`, `reset`, `query` cases
- `src/popup/Popup.tsx:427-460`: Three toggle switches (Auto-fill, Smart detection, Auto Submit) that save state but no code reads it
- `src/options/Options.tsx`: Empty options page that's registered in manifest but does nothing
- `src/background/index.ts:122-126`: `tabs.onUpdated` listener that only logs
- `src/content/index.tsx:3`: `console.log('Content script loaded')` on every page

**Fix**: Remove all commented-out code, remove non-functional toggles (or hide behind a "coming soon" state), remove debug console.logs. Keep the options page registered but redirect to popup settings.

---

## 3. Architecture Overhaul

### Current Message Flow (Broken)

```
User clicks field
  → Content Script detects click, finds label
  → Content Script sends "askLLM" to Background Service Worker
  → Background sends "queryEmbeddings" to Popup (FAILS if popup is closed)
  → Popup queries EntityDB
  → Popup responds with embeddings
  → Background calls LLM API with embeddings as context
  → Background responds to Content Script
  → Content Script fills element
```

### Proposed Message Flow (Fixed)

```
User clicks "Fill This Page" in Popup
  → Popup sends "FILL_PAGE" to Background
  → Background injects Content Script into active tab (programmatic injection)
  → Content Script scans page for all form fields + labels
  → Content Script sends all labels to Background in one batch
  → Background queries EntityDB directly (embeddings live in background now)
  → Background makes ONE batched LLM call with all field labels + context
  → Background responds with { fieldId: answer } map
  → Content Script fills all fields at once
  → Content Script shows success/failure overlay per field
```

### Key Architecture Changes

| Component | Current | Proposed |
|-----------|---------|----------|
| **EntityDB** | Lives in popup context | Move to background service worker (or offscreen document if IndexedDB not available in SW) |
| **Content script** | Injected on all pages via manifest | Programmatic injection on user action only |
| **LLM calls** | One per field (serial) | Batched: all field labels in one prompt |
| **Form filling** | Click-per-field | Scan all fields, fill all at once |
| **Model list fetch** | Direct from popup (dangerouslyAllowBrowser) | Routed through background service worker |
| **State management** | Split across chrome.storage.sync + local + IndexedDB | Consolidate: sync for preferences, local for config, IndexedDB for user data |

### Offscreen Document Pattern

If IndexedDB access from the service worker is unreliable (it can be in some Chrome versions), use an offscreen document:

```ts
// background/index.ts
async function getEmbeddings(label: string) {
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['LOCAL_STORAGE'],
    justification: 'Query vector embeddings from IndexedDB'
  });

  const result = await chrome.runtime.sendMessage({
    type: 'queryEmbeddings',
    target: 'offscreen',
    data: label
  });

  return result;
}
```

This is persistent and doesn't depend on the popup being open.

---

## 4. UI/UX Redesign

### Design Principles

1. **Minimize time-in-popup, maximize time-on-page** -- the popup is for config, the page is where the work happens
2. **Zero-config for common fields** -- if the user told us their email, we don't need an LLM to fill an email field
3. **Show, don't tell** -- visual feedback on the page, not toast notifications in a popup the user already closed
4. **Progressive disclosure** -- simple first, advanced options available but not in the way

### Popup Redesign

**Current**: 400x530px, 3 tabs, "Welcome to FormAI" header taking 60px

**Proposed**: 380x480px, streamlined

#### First-Time User (Onboarding)

```
┌──────────────────────────────────┐
│  FormAI                    [☀/🌙]│
├──────────────────────────────────┤
│                                  │
│  Step 1 of 3                     │
│  ─────────────────               │
│                                  │
│  Choose your AI provider         │
│                                  │
│  ┌──────────────────────────┐    │
│  │ Select provider       ▼  │    │
│  └──────────────────────────┘    │
│                                  │
│  ┌──────────────────────────┐    │
│  │ API Key                  │    │
│  └──────────────────────────┘    │
│                                  │
│  ┌──────────────────────────┐    │
│  │ Model                 ▼  │    │
│  └──────────────────────────┘    │
│                                  │
│  Your key is encrypted and       │
│  stored locally on your device.  │
│                                  │
│  ┌──────────────────────────┐    │
│  │         Next →            │    │
│  └──────────────────────────┘    │
└──────────────────────────────────┘
```

Step 2: Add your information (structured fields)
Step 3: "You're all set! Go to a job application and click Fill This Page."

#### Returning User (Main View)

```
┌──────────────────────────────────┐
│  FormAI                    [☀/🌙]│
├──────────────────────────────────┤
│                                  │
│  ● Ready                         │
│  Gemini · gemini-2.0-flash       │
│                                  │
│  ┌──────────────────────────┐    │
│  │                          │    │
│  │     Fill This Page       │    │
│  │                          │    │
│  └──────────────────────────┘    │
│                                  │
│  ┌─────────┐  ┌─────────────┐   │
│  │ My Data  │  │  Settings   │   │
│  └─────────┘  └─────────────┘   │
│                                  │
│  Last used: greenhouse.io (2h)   │
│                                  │
└──────────────────────────────────┘
```

One button. One action. Everything else is secondary.

#### Data Entry Redesign

Instead of a blank textarea, structured fields with clear guidance:

```
┌──────────────────────────────────┐
│  ← My Data                      │
├──────────────────────────────────┤
│                                  │
│  Basic Info                      │
│  ┌──────────────────────────┐    │
│  │ Full Name                │    │
│  └──────────────────────────┘    │
│  ┌──────────────────────────┐    │
│  │ Email                    │    │
│  └──────────────────────────┘    │
│  ┌──────────────────────────┐    │
│  │ Phone                    │    │
│  └──────────────────────────┘    │
│  ┌──────────────────────────┐    │
│  │ Location / City          │    │
│  └──────────────────────────┘    │
│  ┌──────────────────────────┐    │
│  │ LinkedIn URL             │    │
│  └──────────────────────────┘    │
│                                  │
│  Experience & Skills             │
│  ┌──────────────────────────┐    │
│  │ Work experience...       │    │
│  │                          │    │
│  └──────────────────────────┘    │
│  ┌──────────────────────────┐    │
│  │ Education...             │    │
│  └──────────────────────────┘    │
│  ┌──────────────────────────┐    │
│  │ Skills (comma separated) │    │
│  └──────────────────────────┘    │
│                                  │
│  Additional Info                 │
│  ┌──────────────────────────┐    │
│  │ Anything else the AI     │    │
│  │ should know...           │    │
│  └──────────────────────────┘    │
│                                  │
│  ┌──────────────────────────┐    │
│  │       Save Data           │    │
│  └──────────────────────────┘    │
│                                  │
│  [Import from Resume (PDF)] ←   │
│                                  │
└──────────────────────────────────┘
```

**Why this matters**: Structured fields enable direct matching. When the form asks for "Email", we don't need an LLM call -- we have the email field stored directly. This makes common fields instant (0ms) and free (no API cost). The LLM is only invoked for ambiguous fields like "Why do you want to work here?"

### On-Page UI (Content Script Side)

This is where the real UX lives. The popup is opened for 2 seconds; the user spends minutes on the form page.

#### Field Detection Overlay

When "Fill This Page" is clicked:

```
┌─ Job Application Form ──────────────────────────────┐
│                                                      │
│  First Name  ┌──────────────────────┐                │
│              │ John              ✓  │  ← green dot   │
│              └──────────────────────┘                │
│                                                      │
│  Email       ┌──────────────────────┐                │
│              │ john@email.com    ✓  │  ← green dot   │
│              └──────────────────────┘                │
│                                                      │
│  Why do you  ┌──────────────────────┐                │
│  want this   │ [filling...]     ◌  │  ← spinner     │
│  role?       └──────────────────────┘                │
│                                                      │
│  Salary      ┌──────────────────────┐                │
│  expectation │                  ✗  │  ← red, skipped│
│              └──────────────────────┘                │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │  FormAI: Filled 8/10 fields  [Dismiss]      │     │
│  └─────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

**Visual feedback states per field:**
- **Green checkmark**: Filled successfully (direct match or high-confidence LLM)
- **Yellow dot**: Filled by LLM, review recommended
- **Red X**: Could not fill, user should handle manually
- **Spinner**: Currently processing

**Floating status bar** at bottom of page:
- "FormAI: Filled 8/10 fields" with a dismiss button
- Clicking it expands to show which fields were filled and which need attention

---

## 5. Feature Roadmap

### Phase 1: Foundation Fixes (Make It Work)

These are blockers. The extension cannot ship without them.

| ID | Feature | Description | Files Affected |
|----|---------|-------------|----------------|
| F-001 | Move embeddings to background | EntityDB initialization and query/insert/delete operations move out of popup into background service worker or offscreen document | `src/embeddings.ts`, `src/background/index.ts`, `src/popup/Popup.tsx` |
| F-002 | Fix text chunking | Replace 50-char arbitrary splitting with sentence-boundary splitting | `src/embeddings.ts` |
| F-003 | Refactor fillElement() | Replace 213-line brute-force with framework-aware strategy pattern (React, Vue, Angular, vanilla) | `src/content/index.tsx` |
| F-004 | Programmatic content script injection | Remove `<all_urls>` from manifest, inject content script only when user activates fill on a specific tab | `manifest.json`, `src/background/index.ts` |
| F-005 | Route API calls through background | Remove `dangerouslyAllowBrowser: true`, model list fetching goes through service worker | `src/popup/utils.ts`, `src/background/index.ts` |
| F-006 | Stop filling "NA" / "Error" | Skip unfillable fields, show visual indicator instead of inserting garbage text | `src/content/index.tsx` |
| F-007 | Add loading states | Spinner/highlight on fields being processed, floating status bar on page | `src/content/index.tsx` (new CSS injected) |
| F-008 | Remove dead code and non-functional UI | Delete commented-out cases in background, remove 3 non-functional toggles, clean debug logs | `src/background/index.ts`, `src/popup/Popup.tsx`, `src/content/index.tsx` |
| F-009 | Fix deleteVector() promise | Wrap indexedDB.deleteDatabase in proper Promise | `src/embeddings.ts` |
| F-010 | Debounce model fetching | Stop calling fetchModels on every keystroke of API key input | `src/popup/Popup.tsx` |

### Phase 2: Core Product (Make It Good)

These are the features that turn it from "technically works" to "I want to keep this installed."

| ID | Feature | Description | Rationale |
|----|---------|-------------|-----------|
| F-011 | **"Fill All" mode** | Scan page for all form fields + labels, batch them into one LLM call, fill all fields at once | Eliminates click-per-field UX. Turns a 5-minute process into 10 seconds |
| F-012 | **Structured data model** | Replace blank textarea with structured fields (name, email, phone, location, LinkedIn, work history, education, skills, free text) | Enables direct matching for common fields (instant, no LLM needed). Better embedding quality for complex fields |
| F-013 | **Direct field matching** | For fields with obvious mappings (email → email, phone → phone, name → name), skip the LLM entirely and fill from structured data | Makes common fields instant (0ms latency) and free (no API cost) |
| F-014 | **Resume/PDF import** | "Import from Resume" button that parses a PDF using pdf.js, extracts text, and auto-populates structured fields | Eliminates manual data entry entirely. Biggest friction reducer |
| F-015 | **Field confidence indicator** | Green/yellow/red dot on each filled field: Green = direct match, Yellow = LLM filled (review), Red = couldn't fill | Users know what to trust and what to review before submitting |
| F-016 | **Floating page UI** | Small, non-intrusive floating panel on the page showing fill progress, field status, and a dismiss button | The popup closes immediately -- all feedback must be on the page itself |
| F-017 | **Better label detection** | Extend `findNearestLabel()` to also check: `aria-label`, `aria-labelledby`, `placeholder`, `title`, `name` attribute, nearby `<span>` or `<div>` text | Many modern forms (especially Workday) use ARIA attributes or non-label elements for field names |
| F-018 | **Onboarding flow** | 3-step first-run wizard in the popup: choose provider → add data → done | Reduces drop-off for new users. Guides them through setup |
| F-019 | **Error handling with user feedback** | Replace `console.error` with user-visible error messages. Differentiate between "provider not configured", "API key invalid", "network error", "no data added" | Users currently see nothing when things fail |

### Phase 3: Differentiators (Make It Stand Out)

These are the features that make users choose FormAI over alternatives.

| ID | Feature | Description | Rationale |
|----|---------|-------------|-----------|
| F-020 | **Site-specific form templates** | Hardcoded selectors and field mappings for the top 5 job platforms: Workday, Greenhouse, Lever, iCIMS, LinkedIn Easy Apply | These 5 cover ~60% of enterprise job applications. Hardcoded selectors are more reliable than generic detection |
| F-021 | **WebLLM local mode** | Opt-in "Offline Mode" using WebLLM with Gemma 3n 2B (q4_0). Model downloads once (~1.5GB), runs entirely in-browser via WebGPU | "Works offline, zero data sent anywhere" -- unique differentiator no cloud-dependent competitor can copy |
| F-022 | **Smart field detection (no label)** | For fields without any label/aria-label, use DOM context (surrounding text, field position in form, field name/id patterns) to infer what the field is asking for | Handles poorly-built forms that have no semantic labels |
| F-023 | **Cover letter generation** | Given a job description URL + user's resume data, generate a tailored cover letter. Separate from form filling -- accessed via popup or right-click context menu | This is where LLM truly shines. High user value, high differentiation |
| F-024 | **Fill history / application tracker** | Remember which sites were filled, when, and what values were used. Simple list in popup: "greenhouse.io -- 2 days ago", "workday.com -- 1 week ago" | Sticky engagement feature. Users come back to check their application history |
| F-025 | **Data import/export** | Export all stored data as JSON. Import from JSON. Useful for backup, migration, or sharing between devices | Users feel safe knowing their data is portable and not locked in |

---

## 6. WebLLM Integration Plan

### Feasibility Assessment

WebLLM (by MLC-AI) is a proven in-browser LLM inference engine using WebGPU. It has published Chrome extension examples (`examples/chrome-extension-webgpu-service-worker`) and supports service worker persistence.

| Factor | Status | Detail |
|--------|--------|--------|
| **Technical feasibility** | Proven | MLC-AI has working Chrome extension examples |
| **Model options** | Good | Gemma 3n 2B, Phi-3.5 Mini, SmolLM2 360M all supported |
| **WebGPU support** | Chrome 113+ | Windows, Mac, ChromeOS. Linux needs flag. No Firefox stable |
| **Performance** | ~80% native | Acceptable for short form completions (1-3s per field) |
| **Memory** | 2-6GB RAM | Users with 8GB+ laptops can run it. <8GB will struggle |
| **First-run download** | 1-4GB | One-time download, cached locally |
| **Cold start** | 5-30s | Model loading into GPU memory on first use after browser restart |

### Recommended Architecture

WebLLM is positioned as Tier 3 (opt-in offline mode), not the default:

```
Tier 1 (Default): BYOK -- User brings their own API key (OpenAI/Gemini/Ollama)
Tier 2 (Opt-in):  WebLLM Offline Mode -- No key needed, fully local, zero data transmission
```

### Implementation Approach

1. **Use the service worker pattern** from `examples/chrome-extension-webgpu-service-worker` for persistence
2. **Target model**: Gemma 3n 2B with q4_0 quantization (~1.5GB download)
3. **Setup UX**: One-time wizard in Settings: "Enable Offline Mode → Download AI model (1.5GB) → [Progress bar] → Ready"
4. **Hybrid inference**: Use WebLLM for simple fields (name, dates, dropdowns). If a field looks complex (long textarea, "tell us about yourself"), suggest switching to cloud for better quality
5. **Keep existing embedding model**: `Xenova/all-MiniLM-L6-v2` is already local and tiny. Don't try to replace it with WebLLM for embeddings
6. **Hardware check**: On first enable, test WebGPU availability. If no WebGPU, show "Your browser/hardware doesn't support offline mode" with a link explaining requirements

### What WebLLM Solves for a Free Tool

If FormAI is free with no managed backend, every LLM call depends on the user's API key. WebLLM removes even that dependency -- no key, no account, no cost. The user installs the extension, downloads the model, and everything works offline forever. This is the strongest possible positioning for a free, privacy-first tool.

### What WebLLM Cannot Do Well

- Complex multi-paragraph answers (cover letters, "why do you want this job?")
- Nuanced cultural/contextual responses
- Anything requiring current knowledge (company-specific details)

For these, the tool should surface a suggestion: "This field may benefit from a cloud AI model for better quality."

### Timeline

WebLLM should ship in Phase 3, after the foundation (Phase 1) and core product (Phase 2) are solid. Estimated: 4-6 weeks of dedicated work after Phase 2 is complete.

---

## 7. Production Readiness Checklist

### Before Chrome Web Store Submission

| Category | Item | Status | Priority |
|----------|------|--------|----------|
| **Security** | Remove `dangerouslyAllowBrowser: true` | Not done | P0 |
| **Security** | Verify encryption key isn't exposed in storage (it's stored as plain array in `chrome.storage.local`) | Needs audit | P0 |
| **Permissions** | Remove `<all_urls>` content script, switch to programmatic injection | Not done | P0 |
| **Permissions** | Justify `scripting` permission in store listing | Not done | P1 |
| **Architecture** | Move embeddings out of popup context | Not done | P0 |
| **Code quality** | Remove all commented-out code | Not done | P1 |
| **Code quality** | Remove debug `console.log` statements | Not done | P1 |
| **Code quality** | Add `key` prop to `.map()` renders | Not done | P2 |
| **Testing** | Add unit tests for `crypto.ts` (encryption round-trip) | Not done | P1 |
| **Testing** | Add unit tests for `embeddings.ts` (chunking, query) | Not done | P1 |
| **Testing** | Add unit tests for `findNearestLabel()` | Not done | P1 |
| **Testing** | Add integration test for message passing flow | Not done | P2 |
| **Testing** | Manual test on Workday, Greenhouse, Lever, LinkedIn Easy Apply | Not done | P0 |
| **Store listing** | Privacy policy page (required by Chrome Web Store) | Not done | P0 |
| **Store listing** | Proper icon sizes (16/48/128px, currently same PNG for all) | Not done | P1 |
| **Store listing** | Screenshots (at least 3, showing setup, data entry, form filling) | Not done | P1 |
| **Store listing** | Description optimized for Chrome Web Store search | Not done | P1 |
| **Error handling** | User-facing error messages instead of console.error | Not done | P1 |
| **Performance** | Debounce model list fetching on keystroke | Not done | P2 |
| **UX** | Remove non-functional toggles from General tab | Not done | P1 |
| **UX** | Add loading indicators during LLM calls | Not done | P1 |
| **Dependencies** | Remove `"crypto": "^1.0.1"` from package.json (unused, Web Crypto API is used directly) | Not done | P2 |

### Testing Framework Setup

Recommended: **Vitest** (already compatible with Vite build system)

```bash
npm install -D vitest @testing-library/react jsdom
```

Priority test targets:
1. `src/crypto.ts` -- Encrypt then decrypt round-trip, invalid key handling
2. `src/embeddings.ts` -- Sentence splitting, query response formatting
3. `src/content/index.tsx: findNearestLabel()` -- DOM structure test cases
4. `src/content/index.tsx: fillElement()` -- Framework-specific strategies
5. Message passing between background and content script

---

## 8. User Growth Strategy (Free Tool)

### Target User

Active job seekers applying to 5+ jobs per week, who are frustrated by repetitive form filling. Tech-savvy enough to install a Chrome extension and configure an API key (for BYOK) or download a local model (for WebLLM).

### Growth Channels

| Channel | Action | Expected Impact |
|---------|--------|-----------------|
| **Chrome Web Store SEO** | Title: "FormAI - AI Job Application Form Filler (Free & Private)". Keywords: job application, autofill, form filler, AI, private, offline | Primary discovery channel. Optimize for search terms job seekers use |
| **Reddit** | Post on r/cscareerquestions, r/jobs, r/privacy: "I built a free, open-source form filler that never sends your data to any server" | High-intent audience. Privacy angle plays well on Reddit |
| **Product Hunt** | Launch with "Free + Privacy-First + Open Source + Offline AI" positioning | One-day traffic spike, 1-5K installs if it trends |
| **Hacker News** | "Show HN: FormAI -- Job application autofill that runs AI locally in your browser (WebLLM)" | Technical audience appreciates the local AI angle |
| **GitHub** | Keep repo public and well-documented. Stars = social proof = more installs | Developers trust open-source extensions (can audit code) |
| **YouTube** | 2-minute demo video: "Fill a Workday application in 10 seconds with FormAI" | Visual proof that it works. Embed in store listing |
| **Word of mouth** | Make it work flawlessly on Workday (the most hated job application platform) | If it handles Workday, users will tell other job seekers |

### Success Metrics

| Metric | Target (6 months) | How to Measure |
|--------|-------------------|----------------|
| Chrome Web Store installs | 5,000+ | Store dashboard |
| Weekly active users | 1,000+ | Optional anonymous usage ping (opt-in) |
| Store rating | 4.0+ stars | Store reviews |
| GitHub stars | 500+ | GitHub |
| Retention (still installed after 30 days) | 40%+ | Store dashboard |

### Key Insight

**The single most important growth driver is reliability on Workday.** Workday is universally hated by job seekers. It has complex, multi-page forms with React-based custom components. If FormAI fills a Workday application flawlessly while competitors struggle, users will share it organically. Build for Workday first, everything else second.

---

## Appendix: File-Level Change Map

Summary of every file that needs changes, mapped to the issues and features above:

| File | Changes | Related Items |
|------|---------|---------------|
| `manifest.json` | Remove `content_scripts` block, keep permissions minimal | BUG-005 |
| `src/background/index.ts` | Add EntityDB operations, model list fetching, remove commented code, remove debug logs | BUG-001, BUG-004, BUG-011, F-001, F-005 |
| `src/content/index.tsx` | Rewrite `fillElement()` with strategy pattern, add loading states, stop filling "NA"/"Error", add on-page overlay UI, add batch fill mode | BUG-003, BUG-006, BUG-007, F-003, F-007, F-011, F-015, F-016 |
| `src/popup/Popup.tsx` | Remove embedding listener, remove non-functional toggles, add onboarding flow, debounce model fetch, add key prop to model list, redesign data entry to structured fields | BUG-009, BUG-010, BUG-011, F-008, F-010, F-012, F-018 |
| `src/popup/utils.ts` | Remove `dangerouslyAllowBrowser`, route through background | BUG-004, F-005 |
| `src/popup/popup.css` | Update styles for new layout, onboarding, structured data form | F-012, F-018 |
| `src/embeddings.ts` | Fix chunking to sentence-level, fix deleteVector() promise, potentially move to background context | BUG-002, BUG-008, F-001, F-002 |
| `src/crypto.ts` | No changes needed (clean implementation) | -- |
| `src/options/Options.tsx` | Either implement with useful settings or redirect to popup settings | BUG-011 |
| `vite.config.ts` | May need adjustment if adding offscreen document entry point | F-001 |
| `package.json` | Add vitest, remove unused `crypto` dependency, add `pdf.js` for resume import | F-014, Checklist |
| **New: tests/** | Unit tests for crypto, embeddings, label detection, fill strategies | Checklist |
| **New: src/offscreen/** | Offscreen document for EntityDB if needed | F-001 |

---

## Summary

FormAI has a solid foundation -- correct encryption, good provider abstraction, working embeddings. But between the popup-dependency bug, the brute-force form filling, and the click-per-field UX, it's not production-ready today.

The path forward:

1. **Phase 1**: Fix the 11 bugs listed above. This is non-negotiable before any Chrome Web Store submission.
2. **Phase 2**: Ship "Fill All" mode, structured data, resume import, and on-page UI. This is what turns it into a tool users keep installed.
3. **Phase 3**: Add WebLLM offline mode, site-specific templates, and cover letter generation. This is what makes it stand out.

The positioning is clear: **free, private, works offline.** No competitor owns all three. Build for Workday first. Ship quality. Let the product earn its users.

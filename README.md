<div align="center">

# 🚀 FormAI Extension

### Intelligent Chrome Extension for Automated Form Filling

*Fill job applications instantly with AI-powered contextual responses*

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![React.js](https://img.shields.io/badge/-ReactJs-61DAFB?logo=react&logoColor=white&style=for-the-badge)
![Typescript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![AI Powered](https://img.shields.io/badge/AI-Powered-FF6B6B?style=for-the-badge&logo=openai&logoColor=white)

[Installation](#-installation) • [Features](#-features) • [Usage](#-usage) • [Configuration](#️-configuration) • [Roadmap](#-roadmap)

</div>

---

## 📖 Overview

**FormAI Extension** is a Chrome extension that revolutionizes the job application process by automatically filling form fields with intelligent, context-aware responses. Built with privacy-first architecture, all your data stays local and encrypted on your device.

<div align="center">

### 🎯 Key Highlights

| Feature | Description |
|---------|-------------|
| 🔒 **Privacy First** | All data stored locally with encryption |
| 🤖 **Multi-AI Support** | OpenAI, Gemini, and Ollama |
| ⚡ **Instant Fill** | Click and fill any form field |
| 💾 **Vector Search** | Smart context retrieval using embeddings |
| 🎨 **User Friendly** | Clean popup UI for easy configuration |

</div>

---

## ✨ Features

### 🎛️ **Flexible AI Provider Configuration**

Choose from multiple AI providers:

<div align="center">

![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-8E75B2?style=flat-square&logo=google&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-000000?style=flat-square&logo=ollama&logoColor=white)

</div>

- Select your preferred AI provider
- Dynamic model selection based on provider
- Secure API key storage with encryption
- Configuration persists across sessions

### 🔐 **Secure Local Storage**

- **Encrypted Configuration**: API keys stored with encryption
- **Vector Database**: EntityDB wrapper over IndexedDB
- **Privacy Focused**: No data leaves your device

### 📝 **Personal Data Management**

- Add personal information through popup UI
- Update data anytime
- Reset data with one click
- Automatic vectorization using **all-MiniLM-L6-V2**

### 🎯 **Smart Form Filling**

1. Activate selection mode
2. Click any form field
3. AI automatically fills based on:
   - User data embeddings
   - Similarity search
   - Field label context
   - LLM intelligence

---

## 🛠️ Technology Stack

<div align="center">

### Core Technologies

![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-API-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![React.js](https://img.shields.io/badge/-ReactJs-61DAFB?logo=react&logoColor=white&style=for-the-badge)
![Typescript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![IndexedDB](https://img.shields.io/badge/IndexedDB-Storage-0066CC?style=for-the-badge&logo=database&logoColor=white)

### AI & ML

![LangChain](https://img.shields.io/badge/LangChain-Framework-121212?style=for-the-badge&logo=chainlink&logoColor=white)
![Transformers](https://img.shields.io/badge/Transformers.js-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)

</div>

| Component | Technology |
|-----------|-----------|
| 🤖 **AI Providers** | OpenAI, Google Gemini, Ollama |
| 🔢 **Embeddings** | all-MiniLM-L6-V2 |
| 💾 **Vector Store** | EntityDB (IndexedDB wrapper) |
| 🔒 **Encryption** | Web Crypto API |
| 🎨 **UI** | HTML/CSS/JavaScript |
| 🔗 **LLM Framework** | LangChain.js |

---

## 🚀 Installation

### From Chrome Web Store (Coming Soon)

```
🔜 Available soon on Chrome Web Store
```

### Manual Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/anasM0hammad/formAI-ext.git
   cd formAI-ext
   ```

2. **Install dependencies** (if applicable)
   ```bash
   npm install
   npm run build
   ```

3. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the extension directory

---

## 📖 Usage

### Step 1: Configure AI Provider

<div align="center">

```mermaid
graph LR
    A[Open Extension] --> B[Select Provider]
    B --> C[Choose Model]
    C --> D[Enter API Key]
    D --> E[Save Config]
    
    style A fill:#4285F4
    style E fill:#34A853
```

</div>

1. Click the FormAI extension icon
2. Select your AI provider (OpenAI/Gemini/Ollama)
3. Choose a model from the dropdown
4. Enter your API key
5. Save configuration (stored encrypted)

### Step 2: Add Personal Data

- Open extension popup
- Navigate to **Personal Data** section
- Add your information
- Data is automatically vectorized and stored locally

### Step 3: Fill Forms

1. Navigate to any job application form
2. Click **Activate Selection** in the extension
3. Hover over the page (cursor changes to selection mode)
4. Click any form field
5. Watch as AI fills it automatically! ✨

---

## ⚙️ Configuration

### Supported AI Providers

#### 🟢 OpenAI
- Models: GPT-4, GPT-3.5-turbo, etc.
- Requires: OpenAI API key

#### 🔵 Google Gemini
- Models: Gemini-2.0-flash etc
- Requires: Google API key

#### ⚫ Ollama
- Models: Llama 3.2, Mistral, etc.
- Requires: Local Ollama installation

### Data Management

| Action | Description |
|--------|-------------|
| ➕ **Add** | Add new personal information |
| ✏️ **Update** | Modify existing data |
| 🔄 **Reset** | Clear all stored data |
| 💾 **Export** | Export data (coming soon) |

---

## 🗺️ Roadmap

### 🎯 Upcoming Features

- [ ] **Provider Embedding Models**
  - Use AI provider's native embedding models
  - Improved accuracy and consistency
  - Better semantic understanding

- [ ] **Smart Field Selection**
  - AI-powered field detection
  - Integration with AgentQL (when browser support available)
  - Automatic form structure analysis

- [ ] **Managed Backend Proxy**
  - FormAI-managed AI provider
  - No API key required
  - Seamless user experience
  - Pay-as-you-go pricing

- [ ] **Auto Submit**
  - Automatic form submission after completion
  - Configurable submission delay
  - User confirmation option

- [ ] **Enhanced Features**
  - [ ] Multi-language support
  - [ ] Custom field mappings
  - [ ] Form templates
  - [ ] Analytics dashboard
  - [ ] Data import/export

---

## 🔒 Privacy & Security

- ✅ **100% Local Storage**: All data stored on your device
- ✅ **Encrypted Keys**: API keys encrypted using Web Crypto API
- ✅ **No Data Collection**: We don't collect or transmit your data
- ✅ **Open Source**: Transparent and auditable code
- ✅ **Secure Communication**: HTTPS-only API calls

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. 🍴 Fork the repository
2. 🌿 Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. 💾 Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. 📤 Push to the branch (`git push origin feature/AmazingFeature`)
5. 🎉 Open a Pull Request

---

## 📝 Development

### Prerequisites

- Node.js (v20+)
- Chrome Browser
- AI Provider API key (OpenAI/Gemini) or Ollama installed locally

### Build

```bash
# Install dependencies
npm install

# Development build
npm run dev

# Production build
npm run build

```

---

## ⚠️ Limitations

- Currently supports standard HTML form fields
- Requires active AI provider configuration
- Manual field selection (smart detection coming soon)
- Chrome browser only (Firefox support planned)

---

## 🐛 Known Issues

- [ ] Some complex form fields may not be detected
- [ ] Large data sets may slow down similarity search
- [ ] Ollama requires local installation and running service

---

## 📄 License

This project is available for personal and educational use. Please check the repository for detailed licensing information.

---

## ⚖️ Disclaimer

**FormAI Extension** is designed for personal use to streamline job applications. Users are responsible for:

- ✅ Ensuring compliance with website terms of service
- ✅ Reviewing auto-filled information before submission
- ✅ Respecting privacy and data protection laws
- ✅ Using AI providers responsibly

---

## 🙏 Acknowledgments

- [LangChain.js](https://js.langchain.com/) for LLM framework
- [EntityDB](https://github.com/babycommando/entity-db) for vector storage
- [Transformers.js](https://huggingface.co/docs/transformers.js) for embeddings
- All AI providers for their amazing APIs

---

<div align="center">

### 📧 Contact & Support

[![GitHub Issues](https://img.shields.io/badge/GitHub-Issues-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/anasM0hammad/formAI-ext/issues)
[![Email](https://img.shields.io/badge/Email-Support-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](mailto:mail@mohdanas.me)

---

**Made with ❤️ and AI**

⭐ Star this repo if you find it helpful!

[![GitHub stars](https://img.shields.io/github/stars/anasM0hammad/formAI-ext?style=social)](https://github.com/anasM0hammad/formAI-ext/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/anasM0hammad/formAI-ext?style=social)](https://github.com/anasM0hammad/formAI-ext/network/members)

</div>
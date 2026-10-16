# ⚡ OnDemand AutoComplete

<div align="center">

> **Type less, do more with OnDemand AutoComplete for professionals.**  
> Expand custom text snippets, templates, and dynamic placeholders on any website instantly.

[![Chrome Web Store](https://shieldcn.dev/badge/Chrome%20Web%20Store-Available-blue?logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)
[![Version](https://shieldcn.dev/badge/Version-1.1-brightgreen)](manifest.json)
[![Manifest Version](https://shieldcn.dev/badge/Manifest-V3-orange)](manifest.json)
[![License](https://shieldcn.dev/badge/License-MIT-blue)](LICENSE)
[![PRs Welcome](https://shieldcn.dev/badge/PRs-welcome-green)](#-developer-workflow--contributing)

<br/>

<a href="https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID" title="Download on Chrome Web Store">
  <img src="https://raw.githubusercontent.com/abhishekmallav/OnDemand-AutoComplete/main/assets/chrome-web-store-badge.png" alt="Available in the Chrome Web Store" width="240" onerror="this.onerror=null;this.src='https://storage.googleapis.com/web-dev-uploads/image/W3z1fSfqTTScDgfdRiYj1DC6Gt2/bvdqWqG5b86rDqjXFm2R.png';" />
</a>

<br/>
<sub>Click the badge above to install directly from the <b>Chrome Web Store</b>.</sub>

</div>

---

## 📖 Table of Contents
- [✨ Key Features](#-key-features)
- [🚀 Quick Start (Chrome Web Store)](#-quick-start-chrome-web-store)
- [🛠️ Local Installation & Development Setup](#️-local-installation--development-setup)
- [💻 Developer Workflow & Contributing](#-developer-workflow--contributing)
- [⌨️ Keyboard Shortcuts & Usage Guide](#️-keyboard-shortcuts--usage-guide)
- [🧩 Dynamic Variables](#-dynamic-variables)
- [📁 Project Structure](#-project-structure)
- [🤝 Connect With Me](#-connect-with-me)
- [📜 License](#-license)

---

## ✨ Key Features

- ⚡ **Instant Text Expansion**: Type your prefix (e.g., `/`) followed by your trigger keyword to expand any snippet on the fly.
- 🎯 **In-Page Snippet Picker**: Press <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>.</kbd> on any web page to search and insert snippets without switching tabs.
- 🪄 **Dynamic Placeholders**: Automatically inject live dates, times, clipboard contents, and smart cursor placement.
- 🎨 **Modern Sleek Interface**: Clean popup UI and options manager with full **Light / Dark Mode** support.
- 💾 **Local & Private**: All data is securely stored in your browser using Chrome Storage API — no telemetry or third-party servers.
- 🔄 **Import & Export**: Backup and restore all your snippets seamlessly via JSON.

---

## 🚀 Quick Start (Chrome Web Store)

The easiest way to get started is by downloading **OnDemand AutoComplete** directly from the official store:

[![Available in the Chrome Web Store](https://storage.googleapis.com/web-dev-uploads/image/W3z1fSfqTTScDgfdRiYj1DC6Gt2/bvdqWqG5b86rDqjXFm2R.png)](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)

1. Head over to the **[Chrome Web Store Page](https://chrome.google.com/webstore/detail/YOUR_EXTENSION_ID)**.
2. Click **Add to Chrome**.
3. Pin the extension to your toolbar and start typing snippets!

---

## 🛠️ Local Installation & Development Setup

If you are a developer and want to run, test, or modify this extension locally on your machine, follow these step-by-step instructions:

### Step 1: Download or Clone the Repository
- **Option A (Download ZIP)**:
  1. Click the green **Code** button at the top of this repository.
  2. Select **Download ZIP**.
  3. Extract the downloaded `.zip` file into a directory of your choice on your computer.

- **Option B (Using Git)**:
  ```bash
  git clone https://github.com/abhishekmallav/OnDemand-AutoComplete.git
  cd OnDemand-AutoComplete
  ```

### Step 2: Open Extensions in Google Chrome
1. Open Google Chrome (or any Chromium-based browser such as Brave, Edge, or Arc).
2. In the URL address bar, enter:
   ```text
   chrome://extensions
   ```
   *(or navigate to **Menu (`⋮`)** &gt; **Extensions** &gt; **Manage Extensions**)*.

### Step 3: Turn on Developer Mode
- Locate the **Developer mode** toggle switch in the top-right corner of the Extensions page.
- Switch it **ON** (active).

### Step 4: Load Unpacked Extension
1. In the top-left corner, click the **Load unpacked** button.
2. In the file picker window, navigate to and select the project folder containing `manifest.json`.
3. Click **Select Folder** (or **OK**).

🎉 **You're all set!** The extension icon will now appear in your browser's extension list and toolbar.

---

## 💻 Developer Workflow & Contributing

Contributions and feedback are always welcome! Here is how to work on the extension:

1. **Fork the Repository**:
   Click the **Fork** button at the top right of this repo to create your own copy.

2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/awesome-new-feature
   ```

3. **Make Your Code Changes**:
   - Background service worker logic: `assets/service-worker.js` / `service-worker-loader.js`
   - In-page injection & text expansion: `assets/content-script.js` & `styles/content.css`
   - Extension popup: `src/popup/`
   - Extension settings & snippet manager: `src/options/`
   - Data & storage helpers: `assets/storage.js`

4. **Reload & Test in the Browser**:
   - Whenever you make changes to files, go back to `chrome://extensions`.
   - Click the **Reload** (circular arrow) icon on the **OnDemand AutoComplete** extension card.
   - Refresh any open test web pages to test your updated content scripts.

5. **Commit & Push**:
   ```bash
   git add .
   git commit -m "feat: add awesome new feature"
   git push origin feature/awesome-new-feature
   ```

6. **Open a Pull Request**:
   Go to your fork on GitHub and submit a **Pull Request** describing your changes.

---

## ⌨️ Keyboard Shortcuts & Usage Guide

| Action | Shortcut / Trigger | Description |
| :--- | :--- | :--- |
| **Snippet Expansion** | Type `<Prefix><Trigger>` (e.g., `/sig`) | Automatically replaces the trigger with your configured template. |
| **Snippet Picker Modal** | <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>.</kbd> | Opens a fast floating search dialog right inside the active page. |
| **Select / Insert** | <kbd>Enter</kbd> or <kbd>Tab</kbd> | Confirms snippet selection in the picker modal. |
| **Dismiss Picker** | <kbd>Esc</kbd> | Closes the picker modal without inserting text. |

> 💡 *Want a different prefix or shortcut? Open the extension **Options / Settings** page to customize your prefix symbol or visit `chrome://extensions/shortcuts` to rebind keys.*

---

## 🧩 Dynamic Variables

Add any of these placeholders to your snippet expansion text to insert real-time values:

| Variable | Description | Example Output |
| :--- | :--- | :--- |
| `{{date}}` | Current formatted date | `10/16/2026` |
| `{{time}}` | Current formatted time | `09:25 PM` |
| `{{datetime}}` | Combined date & time | `10/16/2026, 09:25 PM` |
| `{{clipboard}}` | Pastes the current text from your clipboard | *(Clipboard contents)* |
| `{{cursor}}` | Positions your blinking cursor here after expansion | — |
| `{{day}}` | Current day of the week | `Friday` |
| `{{month}}` | Current month name | `October` |
| `{{year}}` | Current four-digit year | `2026` |

---

## 📁 Project Structure

```text
ondemand-autocomplete/
├── assets/
│   ├── content-script.js          # Core injection engine & key listener
│   ├── content-script-loader.js   # Content script entrypoint
│   ├── service-worker.js          # Background service worker logic
│   ├── storage.js                 # Chrome storage abstraction layer
│   └── utils.js                   # String and formatting utilities
├── icons/                         # Extension icons (16px, 32px, 48px, 128px)
├── src/
│   ├── options/                   # Settings, snippet editor, & guide UI
│   └── popup/                     # Quick-access browser action popup
├── styles/
│   └── content.css                # Styles for the in-page snippet picker modal
├── manifest.json                  # Manifest V3 configuration
├── LICENSE                        # MIT License
└── README.md                      # Project documentation
```

---

## 🤝 Connect With Me

Built with ❤️ by **Abhishek Mallav**. Feel free to connect and follow along for updates:

[![GitHub](https://shieldcn.dev/badge/GitHub-abhishekmallav-black?logo=github&logoColor=white)](https://github.com/abhishekmallav)
[![LinkedIn](https://shieldcn.dev/badge/LinkedIn-Connect-0A66C2?logo=linkedin&logoColor=white)](https://linkedin.com/in/YOUR_LINKEDIN_USERNAME)
[![X (Twitter)](https://shieldcn.dev/badge/X%20(Twitter)-Follow-000000?logo=x&logoColor=white)](https://twitter.com/YOUR_TWITTER_HANDLE)
[![Portfolio / Website](https://shieldcn.dev/badge/Portfolio-Website-blueviolet?logo=googlechrome&logoColor=white)](https://YOUR_WEBSITE_OR_PORTFOLIO.com)
[![Email](https://shieldcn.dev/badge/Email-abhimallav1439%40gmail.com-D14836?logo=gmail&logoColor=white)](mailto:abhimallav1439@gmail.com)

---

## 📜 License

This project is licensed under the **[MIT License](LICENSE)**. Feel free to use, modify, and distribute it as per the license terms.

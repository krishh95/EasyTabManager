# EasyTabManager 📑

A visual, multi-space bookmark and tab organizer built for hosting on **GitHub Pages**. Perfect for organizing apps, links, and documents across different Google accounts (e.g., `a@gmail.com` and `b@gmail.com`) with zero server or login hassle.

---

## ✨ Features

1. **Multi-Space Account Isolation:**
   - Create separate spaces for each Google account or context (e.g. `Work (a@gmail.com)` vs `Personal (b@gmail.com)`).
   - Easily switch between accounts with top-level tabs.
   - Tag spaces with account emails and custom accent colors.

2. **Visual Cards with Auto Logo Fetching:**
   - Only enter the **URL** and **Name**; EasyTabManager automatically fetches and displays the website's high-resolution logo and favicon.
   - Fallback icon protection so no card is ever broken.
   - Shows site name, domain, full URL preview, and one-click launch link.

3. **Bookmark Management:**
   - Add, edit, and delete bookmarks at any time.
   - "Open All Tabs" button to launch all bookmarks in a space at once.
   - Global instant search (press `/` anywhere) across all spaces.

4. **Dead Link Health Checker:**
   - Run a built-in health check to ping your saved URLs.
   - Flags dead or unreachable links with a warning badge.
   - One-click "Remove Dead Links" button to keep your dashboard clean.

5. **No Login Required & 100% Client-Side:**
   - Stores all data safely in your browser's `localStorage`.
   - Dark mode and light mode support.
   - Complete JSON Export & Import for quick manual backups.

---

## 🚀 How to Host on GitHub Pages (Step-by-Step)

### Step 1: Initialize Git and Commit
Open PowerShell or your terminal inside this folder:
```powershell
cd "c:\Users\krush\OneDrive\Documents\MyToby"
git init
git add .
git commit -m "Initial commit for EasyTabManager"
```

### Step 2: Push to GitHub
1. Create a new public repository on [GitHub](https://github.com/new) named `easytabmanager` (or any name you prefer).
2. Connect and push your repository:
```powershell
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/easytabmanager.git
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. Go to your repository on GitHub.
2. Click **Settings** > **Pages** (in the left sidebar).
3. Under **Branch**, select `main` and `/ (root)`, then click **Save**.
4. In ~1 minute, your site will be live at:
   `https://<YOUR-USERNAME>.github.io/easytabmanager/`

---

## 💡 Multi-Google Account Tips
To make bookmarks open directly inside specific Google accounts:
- **Account 0 (Primary / a@gmail.com):** `https://mail.google.com/mail/u/0/` or `https://drive.google.com/drive/u/0/`
- **Account 1 (Work / b@gmail.com):** `https://mail.google.com/mail/u/1/` or `https://drive.google.com/drive/u/1/`
- Or use Google's authuser query: `https://docs.google.com/document/d/.../?authuser=your-email@gmail.com`

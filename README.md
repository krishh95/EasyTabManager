# EasyTabManager 📑

A visual, multi-space bookmark and tab organizer with a **file-based (CSV) database** as the **single source of truth**.

Host it for free on **GitHub Pages**, edit bookmarks locally, and push the CSV files directly to Git!

---

## 📁 File-Based CSV Database (Single Source of Truth)

All your data is stored in standard CSV files inside the [`data/`](file:///c:/Users/krush/OneDrive/Documents/EasyTabManager/data/) directory:
* [`data/spaces.csv`](file:///c:/Users/krush/OneDrive/Documents/EasyTabManager/data/spaces.csv) &rarr; Stores all spaces/workspaces (id, name, email, color, description).
* [`data/bookmarks.csv`](file:///c:/Users/krush/OneDrive/Documents/EasyTabManager/data/bookmarks.csv) &rarr; Stores all bookmarks (id, spaceId, name, url, createdAt, status).

---

## 🚀 How to Run Locally with Live CSV Sync

Whenever you add, edit, or delete a bookmark or space, it writes directly to `data/*.csv` on disk.

### Option 1: Double-click to start (Windows)
Double-click [`start_server.bat`](file:///c:/Users/krush/OneDrive/Documents/EasyTabManager/start_server.bat). It starts the local Python server and displays:
```text
EasyTabManager CSV Server running at: http://localhost:8000
Single Source of Truth: data/
 - spaces.csv
 - bookmarks.csv
```
Open **`http://localhost:8000`** in Chrome. Any bookmark you add or remove is instantly written to the `.csv` files on disk!

### Option 2: Terminal
```powershell
cd "c:\Users\krush\OneDrive\Documents\EasyTabManager"
python server.py
```

---

## 🔄 How to Push Your New Bookmarks to GitHub

Whenever you add bookmarks while running locally:
1. Your `data/spaces.csv` and `data/bookmarks.csv` are already updated.
2. Push your changes to GitHub:
```powershell
cd "c:\Users\krush\OneDrive\Documents\EasyTabManager"
git add data/
git commit -m "Update bookmarks in CSV database"
git push
```
3. GitHub Pages will serve your updated CSV files automatically!

---

## 🌐 Deploying to GitHub Pages (One-Time Setup)

```powershell
cd "c:\Users\krush\OneDrive\Documents\EasyTabManager"
git init
git add .
git commit -m "Initial commit with CSV file database"
git branch -M main
git remote add origin https://github.com/<YOUR-GITHUB-USERNAME>/EasyTabManager.git
git push -u origin main
```
In GitHub: **Settings > Pages > Branch: `main`, folder: `/(root)` > Save**.

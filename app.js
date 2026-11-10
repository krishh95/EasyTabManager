/**
 * EasyTabManager - Visual Tab & Bookmark Manager
 * Client-side local storage with Multi-Account spaces, auto logo fetching & dead link checker
 */

const STORAGE_KEY = 'easytabmanager_data_v1';
const LEGACY_STORAGE_KEY = 'mytoby_data_v1';
const THEME_KEY = 'easytabmanager_theme';

// Default starter dataset
const DEFAULT_DATA = {
  activeSpaceId: 'space_work',
  spaces: [
    {
      id: 'space_work',
      name: 'Work Account',
      email: 'a@gmail.com',
      color: '#4f46e5', // indigo
      description: 'Daily tools, project boards, and company portals'
    },
    {
      id: 'space_personal',
      name: 'Personal Space',
      email: 'b@gmail.com',
      color: '#059669', // emerald
      description: 'Personal projects, entertainment, and reading'
    }
  ],
  bookmarks: [
    {
      id: 'bm_1',
      spaceId: 'space_work',
      name: 'Google Drive',
      url: 'https://drive.google.com/drive/u/0/',
      createdAt: Date.now(),
      status: 'unknown' // 'alive', 'dead', 'unknown'
    },
    {
      id: 'bm_2',
      spaceId: 'space_work',
      name: 'Gmail',
      url: 'https://mail.google.com/mail/u/0/',
      createdAt: Date.now(),
      status: 'unknown'
    },
    {
      id: 'bm_3',
      spaceId: 'space_work',
      name: 'GitHub',
      url: 'https://github.com',
      createdAt: Date.now(),
      status: 'unknown'
    },
    {
      id: 'bm_4',
      spaceId: 'space_personal',
      name: 'YouTube',
      url: 'https://www.youtube.com',
      createdAt: Date.now(),
      status: 'unknown'
    },
    {
      id: 'bm_5',
      spaceId: 'space_personal',
      name: 'Reddit',
      url: 'https://www.reddit.com',
      createdAt: Date.now(),
      status: 'unknown'
    }
  ]
};

// Available Space Colors
const COLOR_PALETTE = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#8b5cf6', '#0284c7', '#db2777'];

class EasyTabManagerApp {
  constructor() {
    this.serverUrl = window.location.origin;
    this.isCsvServer = false;
    this.data = this.loadLocalFallback();
    this.selectedColor = COLOR_PALETTE[0];
    this.searchQuery = '';
    this.activeFilter = 'all';

    this.initElements();
    this.initTheme();
    this.bindEvents();
    
    // Attempt to load from CSV database
    this.initCsvSync().then(() => {
      this.render();
    });
  }

  // Check if Python local CSV server is active
  async initCsvSync() {
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      if (res.ok) {
        const info = await res.json();
        if (info.mode === 'csv_server') {
          this.isCsvServer = true;
          this.updateStorageIndicator(true);
          await this.loadFromCsv();
          return;
        }
      }
    } catch {
      // Running as static file or GitHub Pages without local python backend
    }

    // Try fetching static data/spaces.csv and data/bookmarks.csv if on GitHub Pages
    const staticLoaded = await this.tryLoadStaticCsv();
    if (!staticLoaded) {
      this.updateStorageIndicator(false);
      this.render();
    }
  }

  // Load from Python API (reading CSV files)
  async loadFromCsv() {
    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      if (res.ok) {
        const payload = await res.json();
        if (payload.spaces && payload.spaces.length > 0) {
          this.data.spaces = payload.spaces;
          this.data.bookmarks = payload.bookmarks || [];
          if (!this.data.spaces.some(s => s.id === this.data.activeSpaceId)) {
            this.data.activeSpaceId = this.data.spaces[0].id;
          }
          this.saveLocalFallback();
        }
      }
    } catch (err) {
      console.warn('Failed to load CSV from server:', err);
    }
  }

  // Parse CSV string into array of objects
  parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      // Handle commas inside quotes or regular split
      const values = [];
      let inQuotes = false;
      let curr = '';
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(curr.trim());
          curr = '';
        } else {
          curr += char;
        }
      }
      values.push(curr.trim());

      const obj = {};
      headers.forEach((h, idx) => {
        let val = values[idx] || '';
        // unquote
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        obj[h] = val;
      });
      result.push(obj);
    }
    return result;
  }

  // For GitHub Pages: load data/spaces.csv and data/bookmarks.csv statically
  async tryLoadStaticCsv() {
    try {
      const [resSpaces, resBookmarks] = await Promise.all([
        fetch('data/spaces.csv', { cache: 'no-store' }),
        fetch('data/bookmarks.csv', { cache: 'no-store' })
      ]);

      if (resSpaces.ok && resBookmarks.ok) {
        const spacesText = await resSpaces.text();
        const bookmarksText = await resBookmarks.text();

        const spaces = this.parseCsv(spacesText);
        const bookmarks = this.parseCsv(bookmarksText);

        if (spaces.length > 0) {
          this.data.spaces = spaces;
          this.data.bookmarks = bookmarks;
          if (!this.data.spaces.some(s => s.id === this.data.activeSpaceId)) {
            this.data.activeSpaceId = this.data.spaces[0].id;
          }
          this.updateStorageIndicator(true, 'CSV File Mode');
          this.render();
          return true;
        }
      }
    } catch {
      // Fallback to localStorage
    }
    return false;
  }

  // Save changes to CSV database
  async saveData() {
    this.saveLocalFallback();

    if (this.isCsvServer) {
      try {
        const res = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spaces: this.data.spaces,
            bookmarks: this.data.bookmarks
          })
        });
        if (res.ok) {
          this.showToast('Saved to data/*.csv (Ready to git push)');
          return;
        }
      } catch (err) {
        console.warn('Could not post to /api/data:', err);
      }
    }
  }

  updateStorageIndicator(isCsvActive, customLabel = null) {
    if (!this.storageModeBadge || !this.storageModeText) return;
    if (isCsvActive) {
      this.storageModeBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80 whitespace-nowrap';
      this.storageModeBadge.title = 'Changes write directly to data/spaces.csv & data/bookmarks.csv on disk!';
      this.storageModeText.textContent = customLabel || 'CSV Synced (Single Source of Truth)';
      const dot = this.storageModeBadge.querySelector('span');
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
    } else {
      this.storageModeBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80 whitespace-nowrap';
      this.storageModeBadge.title = 'Run start_server.bat to enable live 2-way disk CSV sync.';
      this.storageModeText.textContent = 'Local Storage Mode';
      const dot = this.storageModeBadge.querySelector('span');
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-500';
    }
  }

  // Fallback to localStorage
  loadLocalFallback() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.spaces && parsed.spaces.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse localStorage, resetting to default:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  saveLocalFallback() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }

  initElements() {
    // Buttons
    this.btnOpenAddBookmark = document.getElementById('btnOpenAddBookmark');
    this.btnOpenAddSpace = document.getElementById('btnOpenAddSpace');
    this.btnCheckHealth = document.getElementById('btnCheckHealth');
    this.btnOpenAllInSpace = document.getElementById('btnOpenAllInSpace');
    this.btnEditActiveSpace = document.getElementById('btnEditActiveSpace');
    this.btnDeleteActiveSpace = document.getElementById('btnDeleteActiveSpace');
    this.btnExportJson = document.getElementById('btnExportJson');
    this.fileImportJson = document.getElementById('fileImportJson');
    this.btnToggleDarkMode = document.getElementById('btnToggleDarkMode');
    this.btnToggleMore = document.getElementById('btnToggleMore');
    this.menuMore = document.getElementById('menuMore');
    this.btnRemoveAllDead = document.getElementById('btnRemoveAllDead');
    this.btnDismissDeadAlert = document.getElementById('btnDismissDeadAlert');

    // Search Inputs & Badges
    this.globalSearchInput = document.getElementById('globalSearchInput');
    this.mobileSearchInput = document.getElementById('mobileSearchInput');
    this.storageModeBadge = document.getElementById('storageModeBadge');
    this.storageModeText = document.getElementById('storageModeText');

    // Containers
    this.spacesTabsContainer = document.getElementById('spacesTabsContainer');
    this.bookmarksGrid = document.getElementById('bookmarksGrid');
    this.emptyState = document.getElementById('emptyState');
    this.activeSpaceTitle = document.getElementById('activeSpaceTitle');
    this.activeSpaceEmailBadge = document.getElementById('activeSpaceEmailBadge');
    this.activeSpaceDescription = document.getElementById('activeSpaceDescription');
    this.deadLinksAlert = document.getElementById('deadLinksAlert');
    this.deadLinksAlertText = document.getElementById('deadLinksAlertText');

    // Modals
    this.modalBookmark = document.getElementById('modalBookmark');
    this.formBookmark = document.getElementById('formBookmark');
    this.inputBookmarkId = document.getElementById('inputBookmarkId');
    this.inputBookmarkUrl = document.getElementById('inputBookmarkUrl');
    this.inputBookmarkName = document.getElementById('inputBookmarkName');
    this.selectBookmarkSpace = document.getElementById('selectBookmarkSpace');
    this.bookmarkPreviewLogo = document.getElementById('bookmarkPreviewLogo');
    this.bookmarkPreviewFallback = document.getElementById('bookmarkPreviewFallback');
    this.btnCloseBookmarkModal = document.getElementById('btnCloseBookmarkModal');
    this.btnCancelBookmarkModal = document.getElementById('btnCancelBookmarkModal');

    this.modalSpace = document.getElementById('modalSpace');
    this.formSpace = document.getElementById('formSpace');
    this.inputSpaceId = document.getElementById('inputSpaceId');
    this.inputSpaceName = document.getElementById('inputSpaceName');
    this.inputSpaceEmail = document.getElementById('inputSpaceEmail');
    this.spaceColorOptions = document.getElementById('spaceColorOptions');
    this.btnCloseSpaceModal = document.getElementById('btnCloseSpaceModal');
    this.btnCancelSpaceModal = document.getElementById('btnCancelSpaceModal');

    // Health Check Modal
    this.healthCheckModal = document.getElementById('healthCheckModal');
    this.healthProgressBar = document.getElementById('healthProgressBar');
    this.healthProgressText = document.getElementById('healthProgressText');
    this.healthSummary = document.getElementById('healthSummary');
    this.healthAliveCount = document.getElementById('healthAliveCount');
    this.healthDeadCount = document.getElementById('healthDeadCount');
    this.btnCloseHealthModal = document.getElementById('btnCloseHealthModal');

    // Popup Blocker Modal
    this.popupBlockerModal = document.getElementById('popupBlockerModal');
    this.btnClosePopupModal = document.getElementById('btnClosePopupModal');

    // Toast
    this.toastNotification = document.getElementById('toastNotification');
    this.toastMessage = document.getElementById('toastMessage');
  }

  initTheme() {
    const isDark = localStorage.getItem(THEME_KEY) === 'dark' || 
      (!localStorage.getItem(THEME_KEY) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.getElementById('themeIndicator').textContent = 'On';
    } else {
      document.documentElement.classList.remove('dark');
      document.getElementById('themeIndicator').textContent = 'Off';
    }
  }

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    document.getElementById('themeIndicator').textContent = isDark ? 'On' : 'Off';
  }

  bindEvents() {
    // Dark mode
    this.btnToggleDarkMode.addEventListener('click', () => {
      this.toggleTheme();
      this.menuMore.classList.add('hidden');
    });

    // More dropdown
    this.btnToggleMore.addEventListener('click', (e) => {
      e.stopPropagation();
      this.menuMore.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!this.menuMore.contains(e.target) && !this.btnToggleMore.contains(e.target)) {
        this.menuMore.classList.add('hidden');
      }
    });

    // Global keyboard shortcut '/' to search
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        this.globalSearchInput.focus();
      }
    });

    // Search events
    const handleSearch = (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderBookmarks();
    };
    this.globalSearchInput.addEventListener('input', handleSearch);
    this.mobileSearchInput.addEventListener('input', handleSearch);

    // Add Bookmark Modals
    this.btnOpenAddBookmark.addEventListener('click', () => this.openBookmarkModal());
    this.btnCloseBookmarkModal.addEventListener('click', () => this.closeBookmarkModal());
    this.btnCancelBookmarkModal.addEventListener('click', () => this.closeBookmarkModal());
    this.formBookmark.addEventListener('submit', (e) => this.handleSaveBookmark(e));

    // Live logo preview on URL input
    this.inputBookmarkUrl.addEventListener('input', () => {
      this.updateLogoPreview(this.inputBookmarkUrl.value);
    });

    // Auto-fill title suggestion if URL changed and title is empty
    this.inputBookmarkUrl.addEventListener('blur', () => {
      if (!this.inputBookmarkName.value.trim() && this.inputBookmarkUrl.value.trim()) {
        const domain = this.extractDomain(this.inputBookmarkUrl.value);
        if (domain) {
          const cleanName = domain.replace(/^www\./, '').split('.')[0];
          this.inputBookmarkName.value = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
        }
      }
    });

    // Add Space Modals
    this.btnOpenAddSpace.addEventListener('click', () => this.openSpaceModal());
    this.btnCloseSpaceModal.addEventListener('click', () => this.closeSpaceModal());
    this.btnCancelSpaceModal.addEventListener('click', () => this.closeSpaceModal());
    this.formSpace.addEventListener('submit', (e) => this.handleSaveSpace(e));

    // Space Management
    this.btnEditActiveSpace.addEventListener('click', () => {
      const current = this.getActiveSpace();
      if (current) this.openSpaceModal(current);
    });

    this.btnDeleteActiveSpace.addEventListener('click', () => this.handleDeleteSpace());

    // Open all in active space
    this.btnOpenAllInSpace.addEventListener('click', () => this.openAllTabsInActiveSpace());

    // Popup blocker modal close
    if (this.btnClosePopupModal) {
      this.btnClosePopupModal.addEventListener('click', () => {
        this.popupBlockerModal.classList.add('hidden');
      });
    }

    // Health check
    this.btnCheckHealth.addEventListener('click', () => this.runHealthCheck());
    this.btnCloseHealthModal.addEventListener('click', () => {
      this.healthCheckModal.classList.add('hidden');
    });

    // Dead links banner actions
    this.btnRemoveAllDead.addEventListener('click', () => this.removeAllDeadLinks());
    this.btnDismissDeadAlert.addEventListener('click', () => {
      this.deadLinksAlert.classList.add('hidden');
    });

    // Export/Import JSON
    this.btnExportJson.addEventListener('click', () => this.exportBackup());
    this.fileImportJson.addEventListener('change', (e) => this.importBackup(e));
  }

  // Extract clean domain for favicons & titles
  extractDomain(rawUrl) {
    let url = rawUrl.trim();
    if (!url) return '';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return '';
    }
  }

  // Clean and normalize URLs to valid full URLs
  normalizeUrl(rawUrl) {
    let url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return 'https://' + url;
    }
    return url;
  }

  // Get high-res logo URL with multi-fallback support (Google Favicon & DuckDuckGo Favicon)
  getLogoUrl(url) {
    const domain = this.extractDomain(url);
    if (!domain) return '';
    // High-res Google Favicon API (sz=128 gives clear crisp logos)
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  }

  getSecondaryLogoUrl(url) {
    const domain = this.extractDomain(url);
    if (!domain) return '';
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  }

  updateLogoPreview(url) {
    const logoUrl = this.getLogoUrl(url);
    if (logoUrl) {
      this.bookmarkPreviewLogo.src = logoUrl;
      this.bookmarkPreviewLogo.onload = () => {
        this.bookmarkPreviewLogo.classList.remove('hidden');
        this.bookmarkPreviewFallback.classList.add('hidden');
      };
      this.bookmarkPreviewLogo.onerror = () => {
        this.bookmarkPreviewLogo.classList.add('hidden');
        this.bookmarkPreviewFallback.classList.remove('hidden');
      };
    } else {
      this.bookmarkPreviewLogo.classList.add('hidden');
      this.bookmarkPreviewFallback.classList.remove('hidden');
    }
  }

  getActiveSpace() {
    return this.data.spaces.find(s => s.id === this.data.activeSpaceId) || this.data.spaces[0];
  }

  setActiveSpace(spaceId) {
    this.data.activeSpaceId = spaceId;
    this.saveData();
    this.render();
  }

  // UI Render
  render() {
    this.renderSpaces();
    this.renderActiveSpaceHeader();
    this.renderBookmarks();
    this.checkAndRenderDeadAlert();
    lucide.createIcons();
  }

  renderSpaces() {
    this.spacesTabsContainer.innerHTML = '';
    const activeSpace = this.getActiveSpace();

    this.data.spaces.forEach(space => {
      const isActive = space.id === activeSpace.id;
      const btn = document.createElement('button');
      btn.className = `flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
        isActive 
          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' 
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`;

      // Colored account indicator dot
      const colorDot = document.createElement('span');
      colorDot.className = 'w-2 h-2 rounded-full flex-shrink-0';
      colorDot.style.backgroundColor = space.color || '#4f46e5';

      // Title & Optional Email
      const textSpan = document.createElement('span');
      textSpan.textContent = space.name;

      btn.appendChild(colorDot);
      btn.appendChild(textSpan);

      if (space.email) {
        const emailTag = document.createElement('span');
        emailTag.className = `text-[10px] font-normal px-1.5 py-0.2 rounded-md ${
          isActive 
            ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900' 
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
        }`;
        emailTag.textContent = space.email;
        btn.appendChild(emailTag);
      }

      btn.addEventListener('click', () => this.setActiveSpace(space.id));
      this.spacesTabsContainer.appendChild(btn);
    });
  }

  renderActiveSpaceHeader() {
    const space = this.getActiveSpace();
    if (!space) return;

    this.activeSpaceTitle.textContent = space.name;
    if (space.email) {
      this.activeSpaceEmailBadge.textContent = space.email;
      this.activeSpaceEmailBadge.classList.remove('hidden');
    } else {
      this.activeSpaceEmailBadge.classList.add('hidden');
    }

    const count = this.data.bookmarks.filter(b => b.spaceId === space.id).length;
    this.activeSpaceDescription.textContent = `${count} ${count === 1 ? 'bookmark' : 'bookmarks'} in this space &bull; ${space.description || 'Quick access dashboard'}`;
  }

  renderBookmarks() {
    this.bookmarksGrid.innerHTML = '';
    const activeSpace = this.getActiveSpace();
    if (!activeSpace) return;

    // Filter by active space or global search
    let bookmarks = this.data.bookmarks;
    const isSearching = Boolean(this.searchQuery);

    if (isSearching) {
      bookmarks = bookmarks.filter(b => 
        b.name.toLowerCase().includes(this.searchQuery) || 
        b.url.toLowerCase().includes(this.searchQuery)
      );
    } else {
      bookmarks = bookmarks.filter(b => b.spaceId === activeSpace.id);
    }

    if (bookmarks.length === 0) {
      this.emptyState.classList.remove('hidden');
      return;
    }

    this.emptyState.classList.add('hidden');

    bookmarks.forEach(bm => {
      const card = this.createBookmarkCard(bm, isSearching);
      this.bookmarksGrid.appendChild(card);
    });

    lucide.createIcons();
  }

  createBookmarkCard(bm, showSpaceTag = false) {
    const card = document.createElement('div');
    card.className = 'group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-500/50 dark:hover:border-brand-500/50 rounded-2xl p-4 shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between';

    const domain = this.extractDomain(bm.url);
    const logoUrl = this.getLogoUrl(bm.url);
    const secondaryLogoUrl = this.getSecondaryLogoUrl(bm.url);

    // Status indicator badge
    let statusBadge = '';
    if (bm.status === 'dead') {
      statusBadge = '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-800">Dead</span>';
    } else if (bm.status === 'alive') {
      statusBadge = '<span class="w-2 h-2 rounded-full bg-emerald-500" title="Alive"></span>';
    }

    // Space name tag if searching globally
    let spaceTag = '';
    if (showSpaceTag) {
      const parentSpace = this.data.spaces.find(s => s.id === bm.spaceId);
      if (parentSpace) {
        spaceTag = `<span class="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 max-w-[120px] truncate">${parentSpace.name}</span>`;
      }
    }

    card.innerHTML = `
      <div>
        <!-- Card Top Bar: Icon, Title, Actions -->
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex items-center gap-3 min-w-0">
            <!-- Site Logo / Photo -->
            <div class="w-11 h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center p-2 flex-shrink-0 group-hover:scale-105 transition">
              <img 
                src="${logoUrl}" 
                alt="${bm.name}" 
                class="w-full h-full object-contain"
                onerror="this.onerror=null; this.src='${secondaryLogoUrl}'; this.onerror=()=>{ this.style.display='none'; this.nextElementSibling.style.display='block'; };" 
              />
              <i data-lucide="globe" class="w-5 h-5 text-slate-400 hidden"></i>
            </div>
            
            <!-- Site Name & Domain -->
            <div class="min-w-0">
              <h4 class="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition" title="${bm.name}">
                ${this.escapeHtml(bm.name)}
              </h4>
              <p class="text-xs text-slate-400 truncate mt-0.5" title="${domain}">
                ${domain}
              </p>
            </div>
          </div>

          <!-- Edit & Delete Buttons (appear on card hover) -->
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button 
              class="btn-edit-bm p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              title="Edit Bookmark"
            >
              <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
            </button>
            <button 
              class="btn-delete-bm p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition"
              title="Delete Bookmark"
            >
              <i data-lucide="trash" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <!-- URL Preview -->
        <p class="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800" title="${bm.url}">
          ${this.escapeHtml(bm.url)}
        </p>
      </div>

      <!-- Card Bottom Bar: Space / Status & Open Action -->
      <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
        <div class="flex items-center gap-2">
          ${statusBadge}
          ${spaceTag}
        </div>
        <a 
          href="${bm.url}" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
        >
          <span>Open</span>
          <i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i>
        </a>
      </div>
    `;

    // Button event listeners
    card.querySelector('.btn-edit-bm').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openBookmarkModal(bm);
    });

    card.querySelector('.btn-delete-bm').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleDeleteBookmark(bm.id);
    });

    return card;
  }

  // Bookmark Modal Handling
  openBookmarkModal(bm = null) {
    this.formBookmark.reset();
    this.updateBookmarkSpaceSelect();

    if (bm) {
      document.getElementById('modalBookmarkTitle').textContent = 'Edit Bookmark';
      this.inputBookmarkId.value = bm.id;
      this.inputBookmarkUrl.value = bm.url;
      this.inputBookmarkName.value = bm.name;
      this.selectBookmarkSpace.value = bm.spaceId;
      this.updateLogoPreview(bm.url);
    } else {
      document.getElementById('modalBookmarkTitle').textContent = 'Add Bookmark';
      this.inputBookmarkId.value = '';
      this.selectBookmarkSpace.value = this.data.activeSpaceId;
      this.updateLogoPreview('');
    }

    this.modalBookmark.classList.remove('hidden');
    this.inputBookmarkUrl.focus();
    lucide.createIcons();
  }

  closeBookmarkModal() {
    this.modalBookmark.classList.add('hidden');
  }

  updateBookmarkSpaceSelect() {
    this.selectBookmarkSpace.innerHTML = '';
    this.data.spaces.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name} ${s.email ? `(${s.email})` : ''}`;
      this.selectBookmarkSpace.appendChild(opt);
    });
  }

  handleSaveBookmark(e) {
    e.preventDefault();
    const id = this.inputBookmarkId.value;
    const url = this.normalizeUrl(this.inputBookmarkUrl.value);
    const name = this.inputBookmarkName.value.trim();
    const spaceId = this.selectBookmarkSpace.value;

    if (!url || !name) {
      alert('Please provide both URL and Name.');
      return;
    }

    if (id) {
      // Edit
      const index = this.data.bookmarks.findIndex(b => b.id === id);
      if (index !== -1) {
        this.data.bookmarks[index].url = url;
        this.data.bookmarks[index].name = name;
        this.data.bookmarks[index].spaceId = spaceId;
        this.data.bookmarks[index].status = 'unknown'; // Reset status for re-check
        this.showToast('Bookmark updated');
      }
    } else {
      // Create new
      const newBookmark = {
        id: 'bm_' + Date.now() + Math.random().toString(36).substring(2, 6),
        spaceId: spaceId || this.data.activeSpaceId,
        name: name,
        url: url,
        createdAt: Date.now(),
        status: 'unknown'
      };
      this.data.bookmarks.unshift(newBookmark);
      this.showToast('Bookmark added');
    }

    this.saveData();
    this.closeBookmarkModal();
    this.render();
  }

  handleDeleteBookmark(id) {
    if (confirm('Are you sure you want to delete this bookmark?')) {
      this.data.bookmarks = this.data.bookmarks.filter(b => b.id !== id);
      this.saveData();
      this.render();
      this.showToast('Bookmark deleted');
    }
  }

  // Space Modal Handling
  openSpaceModal(space = null) {
    this.formSpace.reset();
    this.renderColorPalette();

    if (space) {
      document.getElementById('modalSpaceTitle').textContent = 'Edit Space';
      this.inputSpaceId.value = space.id;
      this.inputSpaceName.value = space.name;
      this.inputSpaceEmail.value = space.email || '';
      this.selectedColor = space.color || COLOR_PALETTE[0];
    } else {
      document.getElementById('modalSpaceTitle').textContent = 'Create New Space';
      this.inputSpaceId.value = '';
      this.selectedColor = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
    }

    this.selectColorButton(this.selectedColor);
    this.modalSpace.classList.remove('hidden');
    this.inputSpaceName.focus();
    lucide.createIcons();
  }

  closeSpaceModal() {
    this.modalSpace.classList.add('hidden');
  }

  renderColorPalette() {
    this.spaceColorOptions.innerHTML = '';
    COLOR_PALETTE.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'w-7 h-7 rounded-full border-2 border-transparent transition transform hover:scale-110';
      btn.style.backgroundColor = c;
      btn.dataset.color = c;
      btn.addEventListener('click', () => {
        this.selectedColor = c;
        this.selectColorButton(c);
      });
      this.spaceColorOptions.appendChild(btn);
    });
  }

  selectColorButton(color) {
    const buttons = this.spaceColorOptions.querySelectorAll('button');
    buttons.forEach(btn => {
      if (btn.dataset.color === color) {
        btn.classList.add('ring-2', 'ring-offset-2', 'ring-slate-900', 'dark:ring-white');
      } else {
        btn.classList.remove('ring-2', 'ring-offset-2', 'ring-slate-900', 'dark:ring-white');
      }
    });
  }

  handleSaveSpace(e) {
    e.preventDefault();
    const id = this.inputSpaceId.value;
    const name = this.inputSpaceName.value.trim();
    const email = this.inputSpaceEmail.value.trim();

    if (!name) return;

    if (id) {
      // Edit
      const space = this.data.spaces.find(s => s.id === id);
      if (space) {
        space.name = name;
        space.email = email;
        space.color = this.selectedColor;
        this.showToast('Space updated');
      }
    } else {
      // Create new
      const newSpace = {
        id: 'space_' + Date.now(),
        name: name,
        email: email,
        color: this.selectedColor,
        description: email ? `Bookmarks for ${email}` : 'Custom Workspace'
      };
      this.data.spaces.push(newSpace);
      this.data.activeSpaceId = newSpace.id;
      this.showToast(`Space "${name}" created`);
    }

    this.saveData();
    this.closeSpaceModal();
    this.render();
  }

  handleDeleteSpace() {
    if (this.data.spaces.length <= 1) {
      alert('You must have at least one Space!');
      return;
    }

    const space = this.getActiveSpace();
    const count = this.data.bookmarks.filter(b => b.spaceId === space.id).length;

    if (confirm(`Delete space "${space.name}"? This will also remove ${count} bookmarks inside it.`)) {
      this.data.spaces = this.data.spaces.filter(s => s.id !== space.id);
      this.data.bookmarks = this.data.bookmarks.filter(b => b.spaceId !== space.id);
      this.data.activeSpaceId = this.data.spaces[0].id;

      this.saveData();
      this.render();
      this.showToast('Space deleted');
    }
  }

  // Open all tabs in active space
  openAllTabsInActiveSpace() {
    const space = this.getActiveSpace();
    const bookmarks = this.data.bookmarks.filter(b => b.spaceId === space.id);
    if (bookmarks.length === 0) {
      alert('No bookmarks to open in this space.');
      return;
    }

    let opened = 0;
    let blocked = false;

    // Trigger tab opening via direct synthetic click on transient <a> elements
    // to preserve trusted user gesture chain across modern browsers
    bookmarks.forEach(bm => {
      try {
        const link = document.createElement('a');
        link.href = bm.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        
        // Window open probe
        const win = window.open(bm.url, '_blank');
        if (win && !win.closed && typeof win.closed !== 'undefined') {
          opened++;
        } else {
          blocked = true;
        }
        document.body.removeChild(link);
      } catch (err) {
        blocked = true;
      }
    });

    if (blocked || opened < bookmarks.length) {
      // Chrome blocked subsequent tabs due to popup protection
      if (this.popupBlockerModal) {
        this.popupBlockerModal.classList.remove('hidden');
        lucide.createIcons();
      } else {
        alert('Chrome blocked additional tabs! Please click the "Pop-up blocked" icon in your address bar and select "Always allow popups" to open all tabs at once.');
      }
    } else {
      this.showToast(`Opened ${opened} tabs`);
    }
  }

  // Check dead links / alive status
  async runHealthCheck() {
    const activeSpace = this.getActiveSpace();
    const spaceBookmarks = this.data.bookmarks.filter(b => b.spaceId === activeSpace.id);

    if (spaceBookmarks.length === 0) {
      alert('No bookmarks in this space to test.');
      return;
    }

    this.healthCheckModal.classList.remove('hidden');
    this.healthProgressBar.style.width = '0%';
    this.healthSummary.classList.add('hidden');
    this.healthProgressText.textContent = `0 / ${spaceBookmarks.length} tested`;
    document.getElementById('healthModalTitle').textContent = `Checking ${activeSpace.name}`;
    document.getElementById('healthModalDesc').textContent = 'Validating URLs and pinging servers...';

    let alive = 0;
    let dead = 0;

    for (let i = 0; i < spaceBookmarks.length; i++) {
      const bm = spaceBookmarks[i];
      const isAlive = await this.pingUrl(bm.url);

      bm.status = isAlive ? 'alive' : 'dead';
      if (isAlive) alive++;
      else dead++;

      const progress = Math.round(((i + 1) / spaceBookmarks.length) * 100);
      this.healthProgressBar.style.width = `${progress}%`;
      this.healthProgressText.textContent = `${i + 1} / ${spaceBookmarks.length} tested (${bm.name})`;
    }

    this.saveData();
    this.render();

    // Summary display
    this.healthSummary.classList.remove('hidden');
    this.healthAliveCount.textContent = alive;
    this.healthDeadCount.textContent = dead;
    document.getElementById('healthModalTitle').textContent = 'Health Check Complete!';
    document.getElementById('healthModalDesc').textContent = 'Link status updated across all bookmarks.';
  }

  // Ping mechanism compatible with browser CORS limitations
  // (Uses fetch no-cors & image ping fallback)
  async pingUrl(url) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;

      // Method 1: Fetch with mode: 'no-cors' (detects network/DNS failures)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      try {
        await fetch(url, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-cache',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return true;
      } catch (fetchErr) {
        clearTimeout(timeoutId);

        // Method 2: Fallback image ping to favicon
        return await new Promise((resolve) => {
          const img = new Image();
          const timer = setTimeout(() => {
            img.src = '';
            resolve(false);
          }, 3500);

          img.onload = () => {
            clearTimeout(timer);
            resolve(true);
          };
          img.onerror = () => {
            clearTimeout(timer);
            // If domain favicon fails, assume unreachable
            resolve(false);
          };
          img.src = `https://${parsed.hostname}/favicon.ico?_cache=${Date.now()}`;
        });
      }
    } catch {
      return false;
    }
  }

  checkAndRenderDeadAlert() {
    const activeSpace = this.getActiveSpace();
    const deadLinks = this.data.bookmarks.filter(b => b.spaceId === activeSpace.id && b.status === 'dead');

    if (deadLinks.length > 0) {
      this.deadLinksAlertText.textContent = `${deadLinks.length} dead link(s) found in ${activeSpace.name}!`;
      this.deadLinksAlert.classList.remove('hidden');
    } else {
      this.deadLinksAlert.classList.add('hidden');
    }
  }

  removeAllDeadLinks() {
    const activeSpace = this.getActiveSpace();
    const deadCount = this.data.bookmarks.filter(b => b.spaceId === activeSpace.id && b.status === 'dead').length;

    if (confirm(`Remove all ${deadCount} dead bookmarks from this space?`)) {
      this.data.bookmarks = this.data.bookmarks.filter(b => !(b.spaceId === activeSpace.id && b.status === 'dead'));
      this.saveData();
      this.render();
      this.showToast(`Removed ${deadCount} dead links`);
    }
  }

  // Backup & Restore
  exportBackup() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.data, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `easytabmanager_backup_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchor.click();
    this.menuMore.classList.add('hidden');
    this.showToast('Backup downloaded');
  }

  importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (imported.spaces && imported.bookmarks) {
          this.data = imported;
          this.saveData();
          this.render();
          this.showToast('Backup imported successfully!');
        } else {
          alert('Invalid backup file structure.');
        }
      } catch (err) {
        alert('Could not parse JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    this.menuMore.classList.add('hidden');
  }

  showToast(msg) {
    this.toastMessage.textContent = msg;
    this.toastNotification.classList.remove('opacity-0', 'translate-y-20');
    setTimeout(() => {
      this.toastNotification.classList.add('opacity-0', 'translate-y-20');
    }, 2600);
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.easyTabManager = new EasyTabManagerApp();
});

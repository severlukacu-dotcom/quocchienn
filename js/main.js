(function(){
  // ---------- Theme: auto-follow device, manual override wins ----------
  const root = document.documentElement;
  const toggleBtn = document.getElementById('theme-toggle');
  const lightQuery = window.matchMedia('(prefers-color-scheme: light)');

  function applyTheme(mode){
    root.setAttribute('data-theme', mode);
    toggleBtn.textContent = mode === 'light' ? '☀️' : '🌙';
  }
  function getManualChoice(){
    try { return localStorage.getItem('sileo-theme'); } catch(e){ return null; }
  }

  const manual = getManualChoice();
  applyTheme(manual || (lightQuery.matches ? 'light' : 'dark'));

  // Live-follow the OS/browser theme change, but only while no manual choice has been made
  lightQuery.addEventListener('change', (e) => {
    if(!getManualChoice()){ applyTheme(e.matches ? 'light' : 'dark'); }
  });

  toggleBtn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem('sileo-theme', next); } catch(e){}
  });

  // ---------- Mobile menu ----------
  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  menuToggle.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.textContent = isOpen ? '✕' : '☰';
  });
  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.textContent = '☰';
  }));

  // ---------- Navbar scroll elevation ----------
  const navWrap = document.querySelector('.nav-wrap');
  window.addEventListener('scroll', () => {
    navWrap.classList.toggle('scrolled', window.scrollY > 12);
  }, { passive:true });

  // ---------- Add source deep link ----------
  const addSourceBtn = document.getElementById('add-source-btn');
  if(addSourceBtn){
    addSourceBtn.addEventListener('click', () => {
      copyBtnFeedback('Đang mở Sileo…');
    });
  }
  function copyBtnFeedback(msg){
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:var(--text);color:var(--bg);padding:10px 18px;border-radius:999px;font-size:13px;font-weight:600;z-index:999;box-shadow:0 12px 30px -12px rgba(0,0,0,.5);transition:opacity .3s;';
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 1600);
  }

  // ---------- Copy source ----------
  const copyBtn = document.getElementById('copy-btn');
  const sourceUrl = document.getElementById('source-url').textContent.trim();
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(sourceUrl);
      copyBtn.textContent = 'Đã copy ✓';
      copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 1800);
    } catch(e){
      copyBtn.textContent = 'Lỗi';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1800);
    }
  });

  // ---------- Terminal typewriter ----------
  const lines = [
    { html: '<span class="prompt">$</span> sileo source add' },
    { html: '<span class="path">https://severlukacu-dotcom.github.io/quocchienn/</span>' },
    { html: '<span class="ok">✓ Đã thêm nguồn</span>' },
    { html: '<span class="prompt">$</span> apt update' },
    { html: '<span class="muted-line">Đang tải danh sách gói... Xong</span>' },
    { html: '<span class="ok">Sẵn sàng cài đặt</span>' },
  ];
  const out = document.getElementById('terminal-output');
  let lineIndex = 0, charIndex = 0, currentLineEl = null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function typeStep(){
    if(reduceMotion){
      out.innerHTML = lines.map(l => `<div>${l.html}</div>`).join('');
      return;
    }
    if(lineIndex >= lines.length){
      setTimeout(() => { out.innerHTML=''; lineIndex=0; charIndex=0; typeStep(); }, 2400);
      return;
    }
    if(charIndex === 0){
      currentLineEl = document.createElement('div');
      out.appendChild(currentLineEl);
    }
    const full = lines[lineIndex].html;
    // Reveal by tag-safe chunks: split visible text but keep spans intact by revealing whole line progressively via textContent length trick
    const plain = full.replace(/<[^>]+>/g,'');
    charIndex++;
    if(charIndex <= plain.length){
      // approximate typing by re-rendering full html once enough chars revealed
      currentLineEl.innerHTML = full;
      currentLineEl.style.setProperty('clip-path', `inset(0 ${100 - (charIndex/plain.length*100)}% 0 0)`);
      setTimeout(typeStep, 18 + Math.random()*22);
    } else {
      currentLineEl.style.removeProperty('clip-path');
      currentLineEl.innerHTML = full + (lineIndex === lines.length-1 ? '' : '');
      lineIndex++; charIndex = 0;
      setTimeout(typeStep, 260);
    }
  }
  typeStep();

  // ---------- Real package data: fetch + parse the repo's Packages file ----------
  const grid = document.getElementById('package-grid');
  const searchInput = document.getElementById('search-input');
  const filtersEl = document.getElementById('filters');
  const statCount = document.getElementById('stat-count');
  const statSections = document.getElementById('stat-sections');
  const statUpdated = document.getElementById('stat-updated');
  const resultCount = document.getElementById('result-count');

  function renderSkeleton(n){
    grid.innerHTML = Array.from({length:n}).map(() => `
      <div class="skeleton-card">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div class="skeleton-icon"></div>
          <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line meta"></div>
          </div>
        </div>
        <div class="skeleton-line desc"></div>
        <div class="skeleton-line desc short"></div>
      </div>
    `).join('');
    resultCount.textContent = '';
  }

  let allPackages = [];
  let activeFilter = 'all';
  let activeSort = 'default';
  const sortSelect = document.getElementById('sort-select');
  const iconPalette = ['#7C5CFC','#33E6B3','#FFB86B','#22C1DC','#FF6B6B','#9C6BFF','#5A3FE0'];

  function colorFor(str){
    let hash = 0;
    for(let i=0;i<str.length;i++){ hash = str.charCodeAt(i) + ((hash<<5)-hash); }
    return iconPalette[Math.abs(hash) % iconPalette.length];
  }
  function initialsFor(name){
    const words = name.trim().split(/\s+/).filter(Boolean);
    if(words.length === 1) return words[0].slice(0,2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  // Parses a Debian-style control file (the format apt/dpkg-scanpackages produces)
  // into an array of stanza objects.
  function parseControlFile(text){
    const blocks = text.replace(/\r\n/g,'\n').split(/\n\n+/).map(b => b.trim()).filter(Boolean);
    return blocks.map(block => {
      const fields = {};
      let lastKey = null;
      block.split('\n').forEach(line => {
        const m = line.match(/^([A-Za-z0-9-]+):\s?(.*)$/);
        if(m){ lastKey = m[1]; fields[lastKey] = m[2]; }
        else if(lastKey && /^\s/.test(line)){ fields[lastKey] += ' ' + line.trim(); }
      });
      return fields;
    }).filter(f => f.Package);
  }

  function parseCompat(f){
    const depends = f.Depends || '';
    const tag = (f.Tag || '').toLowerCase();
    const haystack = (depends + ' ' + tag).toLowerCase();

    const minMatch = depends.match(/firmware\s*\(>=\s*([\d.]+)\)/i);
    const maxMatch = depends.match(/firmware\s*\(<=\s*([\d.]+)\)/i);
    let iosRange = null;
    if(minMatch && maxMatch) iosRange = `iOS ${minMatch[1]}–${maxMatch[1]}`;
    else if(minMatch) iosRange = `iOS ${minMatch[1]}+`;
    else if(maxMatch) iosRange = `iOS ≤ ${maxMatch[1]}`;

    let fsType = null;
    if(/rootless/.test(haystack)) fsType = 'Rootless';
    else if(/rootful/.test(haystack)) fsType = 'Rootful';

    const roothide = /roothide/.test(haystack);

    return { iosRange, fsType, roothide };
  }

  function mapToPackage(f){
    const sizeKB = f['Installed-Size'] ? parseInt(f['Installed-Size'], 10) : null;
    const author = (f.Author || f.Maintainer || '').replace(/<[^>]*>/g,'').trim();
    return {
      id: f.Package,
      name: f.Name || f.Package,
      version: f.Version || '',
      author: author || '—',
      section: (f.Section || 'Khác').trim(),
      desc: (f.Description || 'Không có mô tả.').split('\n')[0],
      icon: f.Icon || null,
      sizeKB,
      size: sizeKB ? (sizeKB/1024).toFixed(1) + ' MB' : null,
      paid: /cydia::commercial/i.test(f.Tag || ''),
      compat: parseCompat(f)
    };
  }

  async function fetchText(path){
    try{
      const res = await fetch(path, { cache:'no-store' });
      if(!res.ok) return null;
      return await res.text();
    } catch(e){ return null; }
  }

  async function fetchGzText(path){
    try{
      const res = await fetch(path, { cache:'no-store' });
      if(!res.ok) return null;
      const buf = await res.arrayBuffer();
      return window.pako ? window.pako.ungzip(new Uint8Array(buf), { to:'string' }) : null;
    } catch(e){ return null; }
  }

  async function fetchReleaseDate(){
    const text = await fetchText('./Release');
    if(!text) return null;
    const m = text.match(/^Date:\s?(.*)$/mi);
    return m ? m[1].trim() : null;
  }

  function renderFilters(sections){
    const unique = ['all', ...Array.from(new Set(sections))];
    filtersEl.innerHTML = unique.map(s => `
      <button class="chip${s === 'all' ? ' active' : ''}" data-filter="${s}">${s === 'all' ? 'Tất cả' : s}</button>
    `).join('');
    filtersEl.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filtersEl.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.dataset.filter;
        renderGrid();
      });
    });
  }

  function compareVersionsDesc(a, b){
    const pa = String(a).split(/[.+~-]/).map(x => parseInt(x, 10) || 0);
    const pb = String(b).split(/[.+~-]/).map(x => parseInt(x, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for(let i=0;i<len;i++){
      const diff = (pb[i]||0) - (pa[i]||0);
      if(diff !== 0) return diff;
    }
    return 0;
  }

  function applySort(list){
    const arr = [...list];
    if(activeSort === 'newest') arr.sort((a,b) => compareVersionsDesc(a.version, b.version));
    else if(activeSort === 'name') arr.sort((a,b) => a.name.localeCompare(b.name, 'vi'));
    else if(activeSort === 'size') arr.sort((a,b) => (a.sizeKB ?? Infinity) - (b.sizeKB ?? Infinity));
    return arr;
  }

  function renderGrid(){
    const q = searchInput.value.trim().toLowerCase();
    let filtered = allPackages.filter(p => {
      const matchesFilter = activeFilter === 'all' || p.section === activeFilter;
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
    filtered = applySort(filtered);

    if(filtered.length === 0){
      grid.innerHTML = '<div class="empty-state">Không tìm thấy gói phù hợp. Thử từ khoá khác.</div>';
      resultCount.textContent = '0 gói phù hợp';
      return;
    }

    resultCount.textContent = `${filtered.length} gói phù hợp`;

    grid.innerHTML = filtered.map((p, i) => {
      const c = p.compat;
      const compatBadges = [
        c.iosRange ? `<span class="compat-badge">${c.iosRange}</span>` : '',
        c.fsType ? `<span class="compat-badge ${c.fsType.toLowerCase()}">${c.fsType}</span>` : '',
        c.roothide ? `<span class="compat-badge roothide">RootHide</span>` : ''
      ].join('');

      return `
      <div class="pkg-card" style="animation-delay:${Math.min(i, 12) * 40}ms">
        <span class="pkg-section-chip" style="background:${colorFor(p.section)}">${p.section}</span>
        <div class="pkg-top">
          ${p.icon
            ? `<img class="pkg-icon" src="${p.icon}" alt="" loading="lazy" style="object-fit:cover">`
            : `<div class="pkg-icon" style="background:${colorFor(p.name)}">${initialsFor(p.name)}</div>`
          }
          <div>
            <div class="pkg-name">${p.name}</div>
            <div class="pkg-meta mono">v${p.version}${p.size ? ' · ' + p.size : ''} · ${p.author}</div>
          </div>
        </div>
        ${compatBadges ? `<div class="pkg-compat">${compatBadges}</div>` : ''}
        <div class="pkg-desc">${p.desc}</div>
        <div class="pkg-footer">
          <span class="pkg-price">${p.paid ? 'Trả phí' : 'Miễn phí'}</span>
          <a class="pkg-get" href="sileo://package/${p.id}">Cài đặt</a>
        </div>
      </div>
    `;
    }).join('');
  }

  function renderEmptyRepoState(){
    grid.innerHTML = `
      <div class="empty-state">
        Chưa tìm thấy file <code class="mono">Packages</code> hoặc <code class="mono">Packages.gz</code> ở gốc repo.<br>
        Hãy chạy <code class="mono">dpkg-scanpackages</code> (hoặc dùng Reposi3/repo.me) để sinh file này rồi đưa lên cùng thư mục với trang web.
      </div>`;
    statCount.textContent = '0';
    statSections.textContent = '0';
    statUpdated.textContent = '—';
    resultCount.textContent = '';
  }

  async function init(){
    renderSkeleton(6);

    let text = await fetchText('./Packages');
    if(!text) text = await fetchGzText('./Packages.gz');

    if(!text){
      renderEmptyRepoState();
      return;
    }

    allPackages = parseControlFile(text).map(mapToPackage);

    if(allPackages.length === 0){
      renderEmptyRepoState();
      return;
    }

    const sections = allPackages.map(p => p.section);
    renderFilters(sections);
    renderGrid();

    statCount.textContent = allPackages.length;
    statSections.textContent = new Set(sections).size;
    const releaseDate = await fetchReleaseDate();
    statUpdated.textContent = releaseDate ? releaseDate.slice(0,16) : '—';
  }

  searchInput.addEventListener('input', renderGrid);
  sortSelect.addEventListener('change', () => { activeSort = sortSelect.value; renderGrid(); });
  init();

  // ---------- Apps (IPA) section ----------
  const appGrid = document.getElementById('app-grid');
  const appSearchInput = document.getElementById('app-search-input');
  const appResultCount = document.getElementById('app-result-count');
  const appFiltersEl = document.getElementById('app-filters');
  let allApps = [];
  let activeAppFilter = 'all';

  function renderAppSkeleton(n){
    appGrid.innerHTML = Array.from({length:n}).map(() => `
      <div class="skeleton-card">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div class="skeleton-icon"></div>
          <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line meta"></div>
          </div>
        </div>
        <div class="skeleton-line desc"></div>
      </div>
    `).join('');
  }

  function renderAppEmptyState(){
    appGrid.innerHTML = `
      <div class="empty-state">
        Chưa tìm thấy file <code class="mono">apps.json</code> ở gốc repo.<br>
        Tạo file này với định dạng mảng JSON, mỗi app gồm <code class="mono">name, bundleId, version, size, category, description, icon, url</code>.
      </div>`;
    appResultCount.textContent = '';
  }

  function renderAppFilters(){
    const categories = allApps.map(a => (a.category || 'Khác').trim());
    const unique = ['all', ...Array.from(new Set(categories))];
    appFiltersEl.innerHTML = unique.map(c => `
      <button class="chip${c === 'all' ? ' active' : ''}" data-filter="${c}">${c === 'all' ? 'Tất cả' : c}</button>
    `).join('');
    appFiltersEl.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        appFiltersEl.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeAppFilter = chip.dataset.filter;
        renderAppGrid();
      });
    });
  }

  function renderAppGrid(){
    const q = appSearchInput.value.trim().toLowerCase();
    const filtered = allApps.filter(a => {
      const cat = (a.category || 'Khác').trim();
      const matchesFilter = activeAppFilter === 'all' || cat === activeAppFilter;
      const matchesQuery = !q || a.name.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });

    if(filtered.length === 0){
      appGrid.innerHTML = '<div class="empty-state">Không tìm thấy app phù hợp.</div>';
      appResultCount.textContent = allApps.length ? '0 app phù hợp' : '';
      return;
    }

    appResultCount.textContent = `${filtered.length} app`;

    appGrid.innerHTML = filtered.map((a, i) => {
      const cat = (a.category || 'Khác').trim();
      return `
      <div class="pkg-card" style="animation-delay:${Math.min(i, 12) * 40}ms">
        <span class="pkg-section-chip" style="background:${colorFor(cat)}">${cat}</span>
        <div class="pkg-top">
          ${a.icon
            ? `<img class="pkg-icon" src="${a.icon}" alt="" loading="lazy" style="object-fit:cover">`
            : `<div class="pkg-icon" style="background:${colorFor(a.name)}">${initialsFor(a.name)}</div>`
          }
          <div>
            <div class="pkg-name">${a.name}</div>
            <div class="pkg-meta mono">v${a.version || '—'}${a.size ? ' · ' + a.size : ''}</div>
          </div>
        </div>
        ${a.description ? `<div class="pkg-desc">${a.description}</div>` : ''}
        <div class="pkg-desc mono" style="font-size:11px; opacity:.7;">${a.bundleId || ''}</div>
        <div class="pkg-footer">
          <a class="pkg-get" href="${a.url}">Tải .ipa</a>
          <a class="pkg-get" style="background:var(--accent); color:#fff;" href="livecontainer://install?url=${encodeURIComponent(a.url)}">Mở bằng LiveContainer</a>
        </div>
      </div>
    `;
    }).join('');
  }

  async function initApps(){
    renderAppSkeleton(4);
    const text = await fetchText('./apps.json');
    if(!text){ renderAppEmptyState(); return; }
    try{
      allApps = JSON.parse(text);
      if(!Array.isArray(allApps) || allApps.length === 0){ renderAppEmptyState(); return; }
    } catch(e){ renderAppEmptyState(); return; }
    renderAppFilters();
    renderAppGrid();
  }

  appSearchInput.addEventListener('input', renderAppGrid);
  initApps();

  // ---------- Files (misc downloadable files) section ----------
  const fileGrid = document.getElementById('file-grid');
  const fileSearchInput = document.getElementById('file-search-input');
  const fileResultCount = document.getElementById('file-result-count');
  const fileFiltersEl = document.getElementById('file-filters');
  let allFiles = [];
  let activeFileFilter = 'all';

  function renderFileSkeleton(n){
    fileGrid.innerHTML = Array.from({length:n}).map(() => `
      <div class="skeleton-card">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div class="skeleton-icon"></div>
          <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
            <div class="skeleton-line title"></div>
            <div class="skeleton-line meta"></div>
          </div>
        </div>
        <div class="skeleton-line desc"></div>
      </div>
    `).join('');
  }

  function renderFileEmptyState(){
    fileGrid.innerHTML = `
      <div class="empty-state">
        Chưa tìm thấy file <code class="mono">files.json</code> ở gốc repo.<br>
        Tạo file này với định dạng mảng JSON, mỗi tệp gồm <code class="mono">name, extension, type, size, description, url</code>.
      </div>`;
    fileResultCount.textContent = '';
  }

  function renderFileFilters(){
    const types = allFiles.map(f => (f.type || 'Khác').trim());
    const unique = ['all', ...Array.from(new Set(types))];
    fileFiltersEl.innerHTML = unique.map(t => `
      <button class="chip${t === 'all' ? ' active' : ''}" data-filter="${t}">${t === 'all' ? 'Tất cả' : t}</button>
    `).join('');
    fileFiltersEl.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        fileFiltersEl.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeFileFilter = chip.dataset.filter;
        renderFileGrid();
      });
    });
  }

  function renderFileGrid(){
    const q = fileSearchInput.value.trim().toLowerCase();
    const filtered = allFiles.filter(f => {
      const type = (f.type || 'Khác').trim();
      const matchesFilter = activeFileFilter === 'all' || type === activeFileFilter;
      const matchesQuery = !q || f.name.toLowerCase().includes(q) || (f.description || '').toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });

    if(filtered.length === 0){
      fileGrid.innerHTML = '<div class="empty-state">Không tìm thấy tệp phù hợp.</div>';
      fileResultCount.textContent = allFiles.length ? '0 tệp phù hợp' : '';
      return;
    }

    fileResultCount.textContent = `${filtered.length} tệp`;

    fileGrid.innerHTML = filtered.map((f, i) => {
      const type = (f.type || 'Khác').trim();
      const ext = (f.extension || f.name.split('.').pop() || '?').slice(0, 5);
      return `
      <div class="pkg-card" style="animation-delay:${Math.min(i, 12) * 40}ms">
        <span class="pkg-section-chip" style="background:${colorFor(type)}">${type}</span>
        <div class="pkg-top">
          <div class="file-badge" style="background:${colorFor(ext)}">.${ext}</div>
          <div>
            <div class="pkg-name">${f.name}</div>
            <div class="pkg-meta mono">${f.size || '—'}</div>
          </div>
        </div>
        ${f.description ? `<div class="pkg-desc">${f.description}</div>` : ''}
        <div class="pkg-footer">
          <span class="pkg-price"></span>
          <a class="pkg-get" href="${f.url}" download>Tải xuống</a>
        </div>
      </div>
    `;
    }).join('');
  }

  async function initFiles(){
    renderFileSkeleton(4);
    const text = await fetchText('./files.json');
    if(!text){ renderFileEmptyState(); return; }
    try{
      allFiles = JSON.parse(text);
      if(!Array.isArray(allFiles) || allFiles.length === 0){ renderFileEmptyState(); return; }
    } catch(e){ renderFileEmptyState(); return; }
    renderFileFilters();
    renderFileGrid();
  }

  fileSearchInput.addEventListener('input', renderFileGrid);
  initFiles();
})();

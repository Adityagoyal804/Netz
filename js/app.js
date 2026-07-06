/* CDMS Application — Netz Company */
const { storageKeys: SK, modules: MODULES, defaultColumns, requiredFields, fieldMeta, demoUser, pageSize: PAGE_SIZE, sessionTimeoutMinutes, alertDaysAhead, tourSteps, companyName, projectName, projectFullName, version } = CDMS_CONFIG;

let data = { emp: [], machine: [], project: [], vehicle: [] };
let columns = structuredClone(defaultColumns);
let activity = [];
let sortState = {};
let searchState = {};
let pageState = { emp: 0, machine: 0, project: 0, vehicle: 0 };
let pendingConfirm = null;
let sessionTimer = null;
let tourTimeout = null;
let tourIndex = 0;

/* ── Init ── */
function init() {
    loadState();
    migrateLegacyData();
    applyTheme(localStorage.getItem(SK.theme) || 'light');
    bindEvents();
    updateBranding();
    renderFooter();

    // Clear legacy remember flag that auto-skipped login
    if (localStorage.getItem('cdms_remember') === 'true') {
        localStorage.removeItem('cdms_remember');
    }

    const isAuthed = sessionStorage.getItem(SK.auth) === 'true';

    if (isAuthed) {
        showApp();
        resetSessionTimer();
        const hash = location.hash.replace('#', '');
        const valid = Object.keys(CDMS_CONFIG.sectionLabels);
        showSection(valid.includes(hash) && hash !== 'home' && hash !== 'login' ? hash : 'dashboard', false);
        if (location.hash !== '#' + (valid.includes(hash) && hash !== 'home' && hash !== 'login' ? hash : 'dashboard')) {
            location.hash = valid.includes(hash) && hash !== 'home' && hash !== 'login' ? hash : 'dashboard';
        }
    } else {
        hideApp();
        sessionStorage.removeItem(SK.auth);
        prefillRememberedUser();
        const hash = location.hash.replace('#', '');
        if (hash === 'home') {
            showPublicPage('home');
        } else {
            if (hash && hash !== 'login') history.replaceState(null, '', location.pathname + '#login');
            showPublicPage('login');
        }
    }

    document.body.classList.remove('booting');
    document.body.classList.add('ready');
}

function prefillRememberedUser() {
    const saved = localStorage.getItem(SK.remember);
    const userEl = document.getElementById('username');
    const rememberEl = document.getElementById('rememberMe');
    if (saved && userEl) {
        userEl.value = saved;
        if (rememberEl) rememberEl.checked = true;
    }
}

function isAuthenticated() {
    return sessionStorage.getItem(SK.auth) === 'true';
}

function bindEvents() {
    document.getElementById('password')?.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    document.getElementById('username')?.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    document.getElementById('globalSearch')?.addEventListener('input', e => globalSearch(e.target.value));
    window.addEventListener('hashchange', () => {
        const hash = location.hash.replace('#', '');
        if (!hash) return;
        if (!isAuthenticated()) {
            if (hash === 'home' || hash === 'login') showPublicPage(hash);
            return;
        }
        if (document.getElementById(hash)) showSection(hash, false);
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeModal(); closeDetail(); closeNotifications(); }
    });
    ['mousemove', 'keydown', 'click'].forEach(evt => {
        document.addEventListener(evt, () => {
            if (sessionStorage.getItem(SK.auth) === 'true') resetSessionTimer();
        });
    });
}

function updateBranding() {
    document.title = `${projectName} — ${projectFullName} | ${companyName}`;
    const sub = document.getElementById('navbarSubtitle');
    if (sub) sub.textContent = companyName;
}

function renderFooter() {
    const f = document.getElementById('appFooter');
    if (!f) return;
    f.innerHTML = `© ${new Date().getFullYear()} <strong>${companyName}</strong> · <strong>${projectName}</strong> v${version} ·
        <a href="${CDMS_CONFIG.githubUrl}" target="_blank" rel="noopener">GitHub</a> ·
        Internship Project`;
}

/* ── Storage ── */
function loadState() {
    try {
        const d = localStorage.getItem(SK.data);
        const c = localStorage.getItem(SK.columns);
        const a = localStorage.getItem(SK.activity);
        if (d) data = JSON.parse(d);
        if (c) columns = JSON.parse(c);
        if (a) activity = JSON.parse(a);
    } catch (e) { console.warn('Load failed', e); }
}

function saveState() {
    localStorage.setItem(SK.data, JSON.stringify(data));
    localStorage.setItem(SK.columns, JSON.stringify(columns));
    localStorage.setItem(SK.activity, JSON.stringify(activity.slice(0, 100)));
    localStorage.setItem(SK.lastActivity, Date.now().toString());
}

function migrateLegacyData() {
    const legacy = [
        { key: 'employees', type: 'emp', map: { name: 'Name', role: 'Role', contact: 'Contact', salary: 'Salary' } },
        { key: 'machines', type: 'machine', map: { name: 'Name', type: 'Type', purchaseDate: 'Purchase Date', maintenance: 'Maintenance' } },
        { key: 'projects', type: 'project', map: { name: 'Project', client: 'Client', budget: 'Budget', deadline: 'Deadline' } }
    ];
    legacy.forEach(({ key, type, map }) => {
        if (data[type].length > 0) return;
        try {
            const raw = JSON.parse(localStorage.getItem(key));
            if (!Array.isArray(raw) || raw.length === 0) return;
            data[type] = raw.map(item => {
                const row = {};
                Object.entries(map).forEach(([s, d]) => { row[d] = item[s] || ''; });
                addAudit(row, 'import', 'Imported from legacy data');
                return row;
            });
            saveState();
        } catch (e) { /* ignore */ }
    });
}

function addAudit(row, action, detail, field, oldVal, newVal) {
    if (!row._meta) row._meta = { created: new Date().toISOString(), audit: [] };
    row._meta.audit.unshift({ action, detail, field: field || '', oldVal: oldVal || '', newVal: newVal || '', time: new Date().toISOString() });
    if (row._meta.audit.length > 20) row._meta.audit.length = 20;
}

function logActivity(action, module, detail) {
    activity.unshift({ action, module, detail, time: new Date().toISOString() });
    if (activity.length > 100) activity.length = 100;
    saveState();
    renderActivity();
    renderNotifications();
}

/* ── Session ── */
function resetSessionTimer() {
    clearTimeout(sessionTimer);
    if (!isAuthenticated()) return;
    const raw = parseInt(localStorage.getItem('cdms_session_mins') || sessionTimeoutMinutes, 10);
    const mins = Number.isFinite(raw) && raw > 0 ? raw : sessionTimeoutMinutes;
    sessionTimer = setTimeout(() => {
        sessionStorage.removeItem(SK.auth);
        toast('Session expired. Please login again.', 'warning');
        hideApp();
        prefillRememberedUser();
        showPublicPage('login');
    }, mins * 60 * 1000);
}

function cancelTour() {
    clearTimeout(tourTimeout);
    tourTimeout = null;
    document.getElementById('tourOverlay')?.classList.remove('active');
}

/* ── Navigation ── */
function showPublicPage(id) {
    cancelTour();
    if (!isAuthenticated()) hideApp();
    showSection(id, true);
}

function goToLogin() {
    sessionStorage.removeItem(SK.auth);
    showPublicPage('login');
}

function showApp() {
    document.getElementById('sidebar')?.classList.add('visible');
    document.getElementById('mainContent')?.classList.add('authenticated');
    document.getElementById('loginBg')?.classList.add('hidden');
    document.getElementById('navbarActions')?.classList.remove('hidden');
    document.getElementById('navbarSearch')?.classList.remove('hidden');
    document.getElementById('appFooter')?.classList.remove('hidden');
    renderNotifications();
}

function hideApp() {
    document.getElementById('sidebar')?.classList.remove('visible');
    document.getElementById('mainContent')?.classList.remove('authenticated');
    document.getElementById('loginBg')?.classList.remove('hidden');
    document.getElementById('navbarActions')?.classList.add('hidden');
    document.getElementById('navbarSearch')?.classList.add('hidden');
    document.getElementById('appFooter')?.classList.add('hidden');
}

function showSection(id, updateHash = true) {
    if (!document.getElementById(id)) return;

    const publicSections = ['home', 'login'];
    if (!publicSections.includes(id) && !isAuthenticated()) {
        showSection('login', updateHash);
        return;
    }

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');

    document.querySelectorAll('.sidebar a[data-section]').forEach(a => {
        a.classList.toggle('active', a.dataset.section === id);
    });

    if (updateHash) {
        if (publicSections.includes(id)) history.replaceState(null, '', location.pathname + '#' + id);
        else if (isAuthenticated()) location.hash = id;
    }
    updateBreadcrumbs(id);

    if (id === 'dashboard') { updateDashboard(); renderChart(); renderActivity(); renderAlerts(); renderRecentItems(); }
    if (id === 'reports') renderReports();
    if (['employees', 'machines', 'projects', 'vehicles'].includes(id)) {
        const type = Object.keys(MODULES).find(k => MODULES[k].section === id);
        if (type) renderModule(type);
    }

    if (window.innerWidth <= 768) document.getElementById('sidebar')?.classList.remove('open');
}

function updateBreadcrumbs(id) {
    const bc = document.getElementById('breadcrumbs');
    if (!bc) return;
    const labels = CDMS_CONFIG.sectionLabels;
    if (id === 'home') { bc.innerHTML = '<span>Home</span>'; return; }
    if (id === 'login') { bc.innerHTML = `<a onclick="showPublicPage('home')">Home</a> <span>›</span> <span>Login</span>`; return; }
    bc.innerHTML = `<a onclick="showSection('dashboard')">Dashboard</a> <span>›</span> <span>${labels[id] || id}</span>`;
}

function toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('open'); }

/* ── Auth ── */
function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const err = document.getElementById('loginError');
    const errUser = document.getElementById('usernameError');
    const errPass = document.getElementById('passwordError');
    const btn = document.querySelector('.btn-login');

    errUser.textContent = '';
    errPass.textContent = '';
    err.style.display = 'none';

    if (!username) { errUser.textContent = 'Username is required'; return; }
    if (!password) { errPass.textContent = 'Password is required'; return; }

    showLoader();
    btn.classList.add('loading');
    btn.textContent = 'Signing in...';

    setTimeout(() => {
        hideLoader();
        if (username === demoUser.username && password === demoUser.password) {
            sessionStorage.setItem(SK.auth, 'true');
            const rememberEl = document.getElementById('rememberMe');
            if (rememberEl?.checked) localStorage.setItem(SK.remember, username);
            else localStorage.removeItem(SK.remember);
            err.style.display = 'none';
            showApp();
            resetSessionTimer();
            showSection('dashboard');
            toast(`Welcome to ${projectName} at ${companyName}!`, 'success');
            logActivity('login', 'System', 'Admin logged in');
            if (!localStorage.getItem(SK.tourDone)) {
                cancelTour();
                tourTimeout = setTimeout(startTour, 1000);
            }
        } else {
            err.style.display = 'block';
            toast('Invalid credentials', 'error');
        }
        btn.classList.remove('loading');
        btn.textContent = 'Sign In';
    }, 500);
}

function logout() {
    confirmAction('Logout', 'Are you sure you want to logout?', () => {
        sessionStorage.removeItem(SK.auth);
        clearTimeout(sessionTimer);
        sessionTimer = null;
        cancelTour();
        document.getElementById('password').value = '';
        prefillRememberedUser();
        showPublicPage('login');
        toast('Logged out successfully', 'info');
    });
}

function togglePassword() {
    const pw = document.getElementById('password');
    const btn = document.querySelector('.pw-toggle');
    if (pw.type === 'password') { pw.type = 'text'; btn.textContent = '🙈'; }
    else { pw.type = 'password'; btn.textContent = '👁️'; }
}

function changePassword() {
    const current = document.getElementById('currentPassword')?.value;
    const newPw = document.getElementById('newPassword')?.value;
    const confirm = document.getElementById('confirmPassword')?.value;
    if (!current || !newPw || !confirm) { toast('Fill all password fields', 'warning'); return; }
    if (current !== demoUser.password) { toast('Current password is incorrect', 'error'); return; }
    if (newPw.length < 4) { toast('New password must be at least 4 characters', 'warning'); return; }
    if (newPw !== confirm) { toast('Passwords do not match', 'error'); return; }
    toast('Password change saved (demo — update config for production)', 'success');
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
}

/* ── Theme ── */
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem(SK.theme, next);
    document.getElementById('themeToggle')?.classList.toggle('on', next === 'dark');
    toast(`${next === 'dark' ? 'Dark' : 'Light'} mode enabled`, 'info');
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

/* ── Dashboard ── */
function updateDashboard() {
    const counts = { emp: data.emp.length, machine: data.machine.length, project: data.project.length, vehicle: data.vehicle.length };
    animateCount('empCount', counts.emp);
    animateCount('machineCount', counts.machine);
    animateCount('projectCount', counts.project);
    animateCount('vehicleCount', counts.vehicle);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const greet = document.getElementById('greeting');
    if (greet) {
        const h = new Date().getHours();
        const tg = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
        greet.textContent = `${tg}, Admin`;
    }
    const totalEl = document.getElementById('totalRecords');
    if (totalEl) totalEl.textContent = total;
    const companyEl = document.getElementById('dashboardCompany');
    if (companyEl) companyEl.textContent = companyName;
}

function animateCount(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const duration = 600;
    const startTime = performance.now();
    function step(now) {
        const p = Math.min((now - startTime) / duration, 1);
        el.textContent = Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function renderChart() {
    const container = document.getElementById('chartBars');
    if (!container) return;
    const counts = [data.emp.length, data.machine.length, data.project.length, data.vehicle.length];
    const max = Math.max(...counts, 1);
    const labels = ['Employees', 'Machinery', 'Projects', 'Vehicles'];
    const classes = ['emp', 'machine', 'project', 'vehicle'];
    container.innerHTML = counts.map((c, i) => `
        <div class="chart-bar-group">
            <div class="chart-bar ${classes[i]}" style="height:${Math.max((c / max) * 120, 4)}px"></div>
            <span class="chart-label">${labels[i]} (${c})</span>
        </div>`).join('');
}

function renderActivity() {
    const feed = document.getElementById('activityFeed');
    if (!feed) return;
    if (!activity.length) {
        feed.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><h3>No activity yet</h3><p>Actions you take will appear here</p></div>';
        return;
    }
    feed.innerHTML = activity.slice(0, 8).map(a => {
        const icon = a.action === 'add' ? 'add' : a.action === 'delete' ? 'delete' : 'edit';
        return `<div class="activity-item"><div class="activity-dot ${icon}"></div><div>
            <div class="activity-text"><strong>${capitalize(a.action)}</strong> in ${escapeHtml(a.module)}: ${escapeHtml(a.detail)}</div>
            <div class="activity-time">${timeAgo(new Date(a.time))}</div></div></div>`;
    }).join('');
}

function renderAlerts() {
    const el = document.getElementById('alertsPanel');
    if (!el) return;
    const alerts = getAlerts();
    if (!alerts.length) {
        el.innerHTML = '<div class="alert-item alert-ok">✅ No urgent alerts — all systems normal</div>';
        return;
    }
    el.innerHTML = alerts.map(a => `<div class="alert-item alert-warn" onclick="showSection('${a.section}')">⚠️ ${escapeHtml(a.text)}</div>`).join('');
}

function getAlerts() {
    const alerts = [];
    const now = new Date();
    const limit = new Date(); limit.setDate(limit.getDate() + alertDaysAhead);

    data.machine.filter(m => (m.Status || '').toLowerCase() === 'broken').forEach(m => {
        alerts.push({ text: `Machine "${m.Name}" is marked Broken`, section: 'machines' });
    });
    data.project.forEach(p => {
        if (p.Deadline) {
            const d = new Date(p.Deadline);
            if (d < now && (p.Status || '').toLowerCase() !== 'completed')
                alerts.push({ text: `Project "${p.Project}" is overdue`, section: 'projects' });
            else if (d <= limit && d >= now)
                alerts.push({ text: `Project "${p.Project}" deadline in ${Math.ceil((d - now) / 86400000)} days`, section: 'projects' });
        }
        if ((p.Status || '').toLowerCase() === 'pending')
            alerts.push({ text: `Tender "${p.Project}" is Pending`, section: 'projects' });
    });
    data.vehicle.forEach(v => {
        ['Insurance Expiry', 'Pollution Expiry'].forEach(field => {
            if (v[field]) {
                const d = new Date(v[field]);
                if (d <= limit && d >= now) alerts.push({ text: `${v['Vehicle Name']}: ${field} expiring soon`, section: 'vehicles' });
                if (d < now) alerts.push({ text: `${v['Vehicle Name']}: ${field} EXPIRED`, section: 'vehicles' });
            }
        });
    });
    return alerts.slice(0, 8);
}

function renderRecentItems() {
    const el = document.getElementById('recentItems');
    if (!el) return;
    const items = [];
    Object.entries(MODULES).forEach(([type, m]) => {
        data[type].slice(-3).forEach(row => {
            items.push({ name: row[m.primaryField] || 'Record', module: m.label, section: m.section, time: row._meta?.created || '' });
        });
    });
    items.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
    if (!items.length) { el.innerHTML = '<p class="text-muted">No records yet. Add data in any module.</p>'; return; }
    el.innerHTML = items.slice(0, 5).map(i => `
        <div class="recent-item" onclick="showSection('${i.section}')">
            <span>${escapeHtml(i.name)}</span>
            <small>${escapeHtml(i.module)}</small>
        </div>`).join('');
}

function renderNotifications() {
    const badge = document.getElementById('notifBadge');
    const alerts = getAlerts();
    if (badge) {
        badge.textContent = alerts.length;
        badge.classList.toggle('hidden', alerts.length === 0);
    }
    const panel = document.getElementById('notifPanel');
    if (panel && panel.classList.contains('open')) renderNotifPanel();
}

function toggleNotifications() {
    const panel = document.getElementById('notifPanel');
    panel?.classList.toggle('open');
    if (panel?.classList.contains('open')) renderNotifPanel();
}

function closeNotifications() { document.getElementById('notifPanel')?.classList.remove('open'); }

function renderNotifPanel() {
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    const alerts = getAlerts();
    panel.innerHTML = `<div class="notif-header">Notifications <button onclick="closeNotifications()">✕</button></div>
        ${alerts.length ? alerts.map(a => `<div class="notif-item" onclick="showSection('${a.section}');closeNotifications()">⚠️ ${escapeHtml(a.text)}</div>`).join('')
        : '<div class="notif-item">No new alerts</div>'}`;
}

/* ── Global Search ── */
function globalSearch(query) {
    const q = query.trim().toLowerCase();
    const results = document.getElementById('globalSearchResults');
    if (!results) return;
    if (!q) { results.classList.remove('open'); results.innerHTML = ''; return; }

    const matches = [];
    Object.entries(MODULES).forEach(([type, m]) => {
        data[type].forEach((row, i) => {
            const text = columns[type].map(c => row[c] || '').join(' ').toLowerCase();
            if (text.includes(q)) matches.push({ type, index: i, label: row[m.primaryField] || 'Record', module: m.label, section: m.section });
        });
    });

    if (!matches.length) {
        results.innerHTML = '<div class="search-result-empty">No results found</div>';
    } else {
        results.innerHTML = matches.slice(0, 8).map(m =>
            `<div class="search-result" onclick="openDetail('${m.type}',${m.index});document.getElementById('globalSearch').value='';globalSearch('')">${m.module}: <strong>${escapeHtml(m.label)}</strong></div>`
        ).join('');
    }
    results.classList.add('open');
}

/* ── Forms & Tables ── */
function renderModule(type) {
    renderForm(type);
    renderTable(type);
    validateForm(type);
}

function renderAll() { Object.keys(MODULES).forEach(renderModule); }

function renderForm(type) {
    const form = document.getElementById(MODULES[type].formId);
    if (!form) return;
    const req = requiredFields[type] || [];
    form.innerHTML = columns[type].map(c => {
        const meta = fieldMeta[c] || {};
        const isReq = req.includes(c);
        const fid = colId(type, c);
        let input = '';
        if (meta.type === 'select') {
            input = `<select id="${fid}" onchange="validateForm('${type}')"><option value="">Select ${c}</option>
                ${meta.options.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
        } else {
            input = `<input type="${meta.type || 'text'}" id="${fid}" placeholder="Enter ${c.toLowerCase()}" ${meta.min !== undefined ? `min="${meta.min}"` : ''} oninput="validateForm('${type}')">`;
        }
        return `<div class="form-field"><label for="${fid}">${escapeHtml(c)}${isReq ? ' <span class="req">*</span>' : ''}</label>${input}
            <span class="field-error" id="${fid}_err"></span></div>`;
    }).join('');
}

function validateForm(type) {
    const req = requiredFields[type] || [];
    let valid = true;
    req.forEach(c => {
        const el = document.getElementById(colId(type, c));
        const err = document.getElementById(colId(type, c) + '_err');
        if (!el) return;
        const empty = !el.value.trim();
        el.classList.toggle('error', empty);
        if (err) err.textContent = empty ? `${c} is required` : '';
        if (empty) valid = false;
    });
    const btn = document.getElementById(type + 'SaveBtn');
    if (btn) { btn.disabled = !valid; btn.classList.toggle('btn-disabled', !valid); }
    return valid;
}

function getFilteredData(type) {
    let rows = [...data[type]];
    const query = (searchState[type] || '').toLowerCase();
    if (query) rows = rows.filter(r => columns[type].some(c => (r[c] || '').toString().toLowerCase().includes(query)));
    const sort = sortState[type];
    if (sort) {
        rows.sort((a, b) => {
            const cmp = (a[sort.col] || '').toString().toLowerCase().localeCompare((b[sort.col] || '').toString().toLowerCase(), undefined, { numeric: true });
            return sort.dir === 'asc' ? cmp : -cmp;
        });
    }
    return rows;
}

function renderTable(type) {
    const header = document.getElementById(type + 'Header');
    const tbody = document.getElementById(type + 'Table')?.querySelector('tbody');
    const empty = document.getElementById(type + 'Empty');
    const pagination = document.getElementById(type + 'Pagination');
    if (!header || !tbody) return;

    const sort = sortState[type];
    header.innerHTML = columns[type].map(c => {
        const sorted = sort?.col === c;
        return `<th class="${sorted ? 'sorted' : ''}" onclick="sortTable('${type}','${escapeAttr(c)}')">${escapeHtml(c)} <span class="sort-arrow">${sorted ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}</span></th>`;
    }).join('') + '<th>Actions</th>';

    const filtered = getFilteredData(type);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if ((pageState[type] || 0) >= totalPages) pageState[type] = totalPages - 1;
    const start = (pageState[type] || 0) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);

    if (!filtered.length) {
        tbody.innerHTML = '';
        empty?.classList.remove('hidden');
    } else {
        empty?.classList.add('hidden');
        tbody.innerHTML = pageRows.map(row => {
            const idx = data[type].indexOf(row);
            const cells = columns[type].map(c =>
                `<td contenteditable="true" onblur="updateCell('${type}',${idx},'${escapeAttr(c)}',this.innerText)">${escapeHtml(row[c] || '')}</td>`
            ).join('');
            return `<tr>${cells}<td><div class="table-actions">
                <button class="btn btn-sm btn-secondary" onclick="openDetail('${type}',${idx})" title="View details">👁️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteRow('${type}',${idx})" title="Delete">🗑️</button>
            </div></td></tr>`;
        }).join('');
    }

    if (pagination) {
        pagination.innerHTML = filtered.length > PAGE_SIZE
            ? `<button onclick="changePage('${type}',-1)" ${pageState[type] <= 0 ? 'disabled' : ''}>← Prev</button>
               <span class="page-info">Page ${(pageState[type] || 0) + 1} of ${totalPages}</span>
               <button onclick="changePage('${type}',1)" ${pageState[type] >= totalPages - 1 ? 'disabled' : ''}>Next →</button>`
            : filtered.length ? `<span class="page-info">${filtered.length} record(s)</span>` : '';
    }
}

function changePage(type, dir) { pageState[type] = (pageState[type] || 0) + dir; renderTable(type); }
function sortTable(type, col) {
    const cur = sortState[type];
    sortState[type] = cur?.col === col ? { col, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' };
    renderTable(type);
}
function searchTable(type, q) { searchState[type] = q; pageState[type] = 0; renderTable(type); }
function toggleFormPanel(type) { document.getElementById(type + 'FormPanel')?.classList.toggle('collapsed'); }

/* ── CRUD ── */
function colId(type, col) { return type + '_' + col.replace(/\s+/g, '_'); }

function addRow(type) {
    if (!validateForm(type)) { toast('Please fill all required fields', 'warning'); return; }
    showLoader();
    setTimeout(() => {
        const row = {};
        columns[type].forEach(c => {
            const el = document.getElementById(colId(type, c));
            row[c] = el ? el.value.trim() : '';
        });
        addAudit(row, 'create', 'Record created');
        data[type].push(row);
        saveState();
        renderTable(type);
        updateDashboard();
        renderAlerts();
        columns[type].forEach(c => { const el = document.getElementById(colId(type, c)); if (el) el.value = ''; });
        validateForm(type);
        const name = row[MODULES[type].primaryField] || 'New record';
        logActivity('add', MODULES[type].label, name);
        hideLoader();
        showSuccessFlash();
        toast(`${name} added successfully`, 'success');
    }, 300);
}

function updateCell(type, i, col, val) {
    const old = data[type][i][col];
    const nv = val.trim();
    data[type][i][col] = nv;
    addAudit(data[type][i], 'edit', `Updated ${col}`, col, old, nv);
    saveState();
    if (old !== nv) logActivity('edit', MODULES[type].label, `Updated ${col} for "${data[type][i][MODULES[type].primaryField]}"`);
}

function deleteRow(type, i) {
    const name = data[type][i][MODULES[type].primaryField] || `Record #${i + 1}`;
    confirmAction('Delete Record', `Delete "${name}"? This cannot be undone.`, () => {
        data[type].splice(i, 1);
        saveState();
        renderTable(type);
        updateDashboard();
        renderAlerts();
        logActivity('delete', MODULES[type].label, name);
        toast('Record deleted', 'info');
        closeDetail();
    });
}

function addColumn(type) {
    const input = document.getElementById(type + 'NewColumn');
    const name = (input?.value || '').trim();
    if (!name) { toast('Enter a column name', 'warning'); return; }
    if (columns[type].includes(name)) { toast('Column exists', 'warning'); return; }
    columns[type].push(name);
    input.value = '';
    saveState();
    renderModule(type);
    toast(`Column "${name}" added`, 'success');
}

function removeColumn(type) {
    const input = document.getElementById(type + 'RemoveColumn');
    const col = (input?.value || '').trim();
    if (!col || !columns[type].includes(col)) { toast('Column not found', 'error'); return; }
    confirmAction('Remove Column', `Remove "${col}" from all records?`, () => {
        columns[type] = columns[type].filter(c => c !== col);
        data[type].forEach(r => delete r[col]);
        input.value = '';
        saveState();
        renderModule(type);
        toast(`Column "${col}" removed`, 'info');
    });
}

/* ── Record Detail Panel ── */
function openDetail(type, index) {
    const row = data[type][index];
    const m = MODULES[type];
    const panel = document.getElementById('detailPanel');
    const body = document.getElementById('detailBody');
    if (!panel || !body) return;

    const fields = columns[type].map(c => `
        <div class="detail-field"><label>${escapeHtml(c)}</label><p>${escapeHtml(row[c] || '—')}</p></div>`).join('');

    const audit = (row._meta?.audit || []).map(a => `
        <div class="audit-item"><span class="audit-action">${escapeHtml(a.action)}</span>
        ${escapeHtml(a.detail)} <small>${timeAgo(new Date(a.time))}</small></div>`).join('') || '<p class="text-muted">No history yet</p>';

    body.innerHTML = `
        <h3>${m.icon} ${escapeHtml(row[m.primaryField] || 'Record')}</h3>
        <p class="detail-meta">Module: ${m.label} · Created: ${row._meta?.created ? new Date(row._meta.created).toLocaleString() : '—'}</p>
        <div class="detail-grid">${fields}</div>
        <h4>Audit Trail</h4><div class="audit-list">${audit}</div>
        <div class="detail-actions">
            <button class="btn btn-danger btn-sm" onclick="deleteRow('${type}',${index})">Delete</button>
            <button class="btn btn-secondary btn-sm" onclick="closeDetail()">Close</button>
        </div>`;
    panel.classList.add('open');
    showSection(m.section, false);
}

function closeDetail() { document.getElementById('detailPanel')?.classList.remove('open'); }

/* ── Export / Import / Print ── */
function exportCSV(type) {
    if (!data[type].length) { toast('No data to export', 'warning'); return; }
    const cols = columns[type];
    const csv = [cols.join(','), ...data[type].map(r => cols.map(c => `"${(r[c] || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    downloadFile(`${MODULES[type].label}_${dateStamp()}.csv`, csv, 'text/csv');
    toast('CSV exported', 'success');
}

function exportAllJSON() {
    downloadFile(`CDMS_Backup_${dateStamp()}.json`, JSON.stringify({ data, columns, company: companyName, project: projectName, exported: new Date().toISOString() }, null, 2), 'application/json');
    toast('Backup exported', 'success');
}

function importJSON() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const parsed = JSON.parse(ev.target.result);
                if (!parsed.data) { toast('Invalid backup', 'error'); return; }
                confirmAction('Import Data', 'Merge imported data with existing records?', () => {
                    Object.keys(parsed.data).forEach(k => { if (data[k]) data[k] = [...data[k], ...parsed.data[k]]; });
                    if (parsed.columns) Object.assign(columns, parsed.columns);
                    saveState(); renderAll(); updateDashboard(); toast('Data imported', 'success');
                });
            } catch { toast('Failed to parse file', 'error'); }
        };
        reader.readAsText(file);
    };
    input.click();
}

function resetAllData() {
    confirmAction('Reset All Data', 'Permanently delete ALL records?', () => {
        data = { emp: [], machine: [], project: [], vehicle: [] };
        columns = structuredClone(defaultColumns);
        activity = [];
        saveState(); renderAll(); updateDashboard();
        toast('All data reset', 'warning');
    });
}

function printReport() {
    const totalSalary = data.emp.reduce((s, e) => s + (parseFloat((e.Salary || '0').replace(/[^0-9.]/g, '')) || 0), 0);
    const totalBudget = data.project.reduce((s, p) => s + (parseFloat((p.Budget || '0').replace(/[^0-9.]/g, '')) || 0), 0);
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>${projectName} Report — ${companyName}</title>
        <style>body{font-family:Arial,sans-serif;padding:40px;color:#111}h1{color:#4f46e5}
        table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #ddd;padding:8px}
        th{background:#4f46e5;color:#fff}.meta{color:#666;font-size:14px}</style></head><body>
        <h1>${projectName} — Company Summary Report</h1>
        <p class="meta"><strong>Company:</strong> ${companyName} · <strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <h2>Overview</h2><table><tr><th>Module</th><th>Records</th></tr>
        ${Object.entries(MODULES).map(([k, m]) => `<tr><td>${m.label}</td><td>${data[k].length}</td></tr>`).join('')}
        </table><h2>Financial Summary</h2><table>
        <tr><td>Total Payroll</td><td>₹${totalSalary.toLocaleString()}</td></tr>
        <tr><td>Total Project Budget</td><td>₹${totalBudget.toLocaleString()}</td></tr></table>
        <h2>Alerts</h2><ul>${getAlerts().map(a => `<li>${a.text}</li>`).join('') || '<li>No alerts</li>'}</ul>
        <p class="meta" style="margin-top:40px">${projectFullName} · ${companyName} Internship Project · v${version}</p>
        </body></html>`);
    w.document.close();
    w.print();
}

function downloadFile(name, content, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; a.click();
}

function dateStamp() { return new Date().toISOString().slice(0, 10); }

/* ── Reports ── */
function renderReports() {
    const container = document.getElementById('reportsContent');
    if (!container) return;
    const totalSalary = data.emp.reduce((s, e) => s + (parseFloat((e.Salary || '0').replace(/[^0-9.]/g, '')) || 0), 0);
    const totalBudget = data.project.reduce((s, p) => s + (parseFloat((p.Budget || '0').replace(/[^0-9.]/g, '')) || 0), 0);
    const activeProjects = data.project.filter(p => (p.Status || '').toLowerCase() === 'active').length;
    const machinesOk = data.machine.filter(m => (m.Status || '').toLowerCase() !== 'broken').length;
    const pendingTenders = data.project.filter(p => (p.Status || '').toLowerCase() === 'pending').length;

    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card emp"><div class="stat-icon">💰</div><div class="stat-label">Total Payroll</div><div class="stat-value">₹${totalSalary.toLocaleString()}</div></div>
            <div class="stat-card project"><div class="stat-icon">📊</div><div class="stat-label">Total Budget</div><div class="stat-value">₹${totalBudget.toLocaleString()}</div></div>
            <div class="stat-card machine"><div class="stat-icon">✅</div><div class="stat-label">Active Projects</div><div class="stat-value">${activeProjects}</div></div>
            <div class="stat-card vehicle"><div class="stat-icon">📋</div><div class="stat-label">Pending Tenders</div><div class="stat-value">${pendingTenders}</div></div>
        </div>
        <div class="card"><div class="card-title">📈 Module Summary — ${companyName}</div>
        <div class="table-wrapper"><table><thead><tr><th>Module</th><th>Records</th><th>Columns</th><th>Last Activity</th></tr></thead><tbody>
        ${Object.entries(MODULES).map(([k, m]) => {
            const last = activity.find(a => a.module === m.label);
            return `<tr><td>${m.icon} ${m.label}</td><td>${data[k].length}</td><td>${columns[k].length}</td>
                <td>${last ? timeAgo(new Date(last.time)) : '—'}</td></tr>`;
        }).join('')}</tbody></table></div></div>
        <div class="card"><div class="card-title">🔧 Machine Health</div>
        <p>${machinesOk} of ${data.machine.length} machines operational</p></div>`;
}

/* ── Tour ── */
function startTour() {
    if (!isAuthenticated()) return;
    tourIndex = 0;
    document.getElementById('tourOverlay')?.classList.add('active');
    showTourStep();
}

function showTourStep() {
    const step = tourSteps[tourIndex];
    const box = document.getElementById('tourBox');
    if (!step || !box) return;
    showSection(step.section, false);
    box.innerHTML = `<h3>${step.title}</h3><p>${step.text}</p>
        <div class="tour-actions">
            <button class="btn btn-secondary btn-sm" onclick="endTour()">Skip</button>
            <button class="btn btn-primary btn-sm" onclick="nextTour()">${tourIndex < tourSteps.length - 1 ? 'Next →' : 'Finish'}</button>
        </div><div class="tour-progress">Step ${tourIndex + 1} of ${tourSteps.length}</div>`;
}

function nextTour() {
    tourIndex++;
    if (tourIndex >= tourSteps.length) endTour();
    else showTourStep();
}

function endTour() {
    localStorage.setItem(SK.tourDone, 'true');
    document.getElementById('tourOverlay')?.classList.remove('active');
    showSection('dashboard');
    toast('Tour complete! Explore CDMS at your pace.', 'info');
}

/* ── UI Helpers ── */
function showLoader() { document.getElementById('loader')?.classList.add('active'); }
function hideLoader() { document.getElementById('loader')?.classList.remove('active'); }
function showSuccessFlash() {
    const f = document.getElementById('successFlash');
    if (!f) return;
    f.classList.add('active');
    setTimeout(() => f.classList.remove('active'), 1200);
}

function confirmAction(title, message, onConfirm) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('modalOverlay').classList.add('active');
    pendingConfirm = onConfirm;
}

function closeModal() { document.getElementById('modalOverlay').classList.remove('active'); pendingConfirm = null; }
function confirmModal() { if (pendingConfirm) pendingConfirm(); closeModal(); }

function toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    el.innerHTML = `<span>${icons[type]}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('removing'); setTimeout(() => el.remove(), 300); }, 3500);
}

function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function escapeAttr(str) { return str.replace(/'/g, "\\'"); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function timeAgo(date) {
    const s = Math.floor((Date.now() - date.getTime()) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return date.toLocaleDateString();
}

function setSessionTimeout(mins) {
    localStorage.setItem('cdms_session_mins', mins);
    resetSessionTimer();
    toast(`Session timeout set to ${mins} minutes`, 'info');
}

document.addEventListener('DOMContentLoaded', init);

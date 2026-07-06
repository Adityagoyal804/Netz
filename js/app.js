/* CDMS — Company Data Management System */
const AUTH_KEY = 'cdms_authenticated';
const DATA_KEY = 'cdms_data';
const COLUMNS_KEY = 'cdms_columns';
const ACTIVITY_KEY = 'cdms_activity';
const THEME_KEY = 'cdms_theme';
const REMEMBER_KEY = 'cdms_remember';
const PAGE_SIZE = 8;

const MODULES = {
    emp:      { section: 'employees', label: 'Employees', icon: '👥', formId: 'empForm' },
    machine:  { section: 'machines',  label: 'Machinery', icon: '⚙️', formId: 'machineForm' },
    project:  { section: 'projects',  label: 'Projects',  icon: '📋', formId: 'projectForm' },
    vehicle:  { section: 'vehicles',  label: 'Vehicles',  icon: '🚗', formId: 'vehicleForm' }
};

const defaultColumns = {
    emp:     ['Name', 'Role', 'Contact', 'Salary', 'Department', 'Join Date'],
    machine: ['Name', 'Type', 'Purchase Date', 'Maintenance', 'Status', 'Location'],
    project: ['Project', 'Client', 'Budget', 'Deadline', 'Status', 'Manager'],
    vehicle: ['Vehicle Name', 'Reg No', 'Date of Purchase', 'Insurance', 'Pollution', 'Driver']
};

let data = { emp: [], machine: [], project: [], vehicle: [] };
let columns = structuredClone(defaultColumns);
let activity = [];
let sortState = {};
let searchState = {};
let pageState = { emp: 0, machine: 0, project: 0, vehicle: 0 };
let pendingConfirm = null;

/* ── Init ── */
function init() {
    loadState();
    migrateLegacyData();
    applyTheme(localStorage.getItem(THEME_KEY) || 'light');
    bindEvents();

    if (sessionStorage.getItem(AUTH_KEY) === 'true' || localStorage.getItem(REMEMBER_KEY) === 'true') {
        if (localStorage.getItem(REMEMBER_KEY) === 'true') sessionStorage.setItem(AUTH_KEY, 'true');
        showApp();
        const hash = location.hash.replace('#', '');
        const valid = ['dashboard', 'employees', 'machines', 'projects', 'vehicles', 'settings', 'reports'];
        showSection(valid.includes(hash) ? hash : 'dashboard');
    } else {
        showSection('loginSection');
    }
}

function bindEvents() {
    document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    document.getElementById('username').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    window.addEventListener('hashchange', () => {
        if (sessionStorage.getItem(AUTH_KEY) !== 'true') return;
        const hash = location.hash.replace('#', '');
        if (document.getElementById(hash)) showSection(hash, false);
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
    });
}

/* ── Storage ── */
function loadState() {
    try {
        const d = localStorage.getItem(DATA_KEY);
        const c = localStorage.getItem(COLUMNS_KEY);
        const a = localStorage.getItem(ACTIVITY_KEY);
        if (d) data = JSON.parse(d);
        if (c) columns = JSON.parse(c);
        if (a) activity = JSON.parse(a);
    } catch (e) { console.warn('Load failed', e); }
}

function saveState() {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
    localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns));
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity.slice(0, 50)));
}

function migrateLegacyData() {
    const legacy = [
        { key: 'employees', type: 'emp', map: { name: 'Name', role: 'Role', contact: 'Contact', salary: 'Salary' } },
        { key: 'machines', type: 'machine', map: { name: 'Name', type: 'Type', purchaseDate: 'Purchase Date', maintenance: 'Maintenance' } },
        { key: 'projects', type: 'project', map: { name: 'Project', client: 'Client', budget: 'Budget', deadline: 'Deadline' } }
    ];
    let migrated = false;
    legacy.forEach(({ key, type, map }) => {
        if (data[type].length > 0) return;
        try {
            const raw = JSON.parse(localStorage.getItem(key));
            if (!Array.isArray(raw) || raw.length === 0) return;
            data[type] = raw.map(item => {
                const row = {};
                Object.entries(map).forEach(([s, d]) => { row[d] = item[s] || ''; });
                return row;
            });
            migrated = true;
        } catch (e) { /* ignore */ }
    });
    if (migrated) { saveState(); toast('Legacy data imported successfully', 'info'); }
}

function logActivity(action, module, detail) {
    activity.unshift({
        action, module, detail,
        time: new Date().toISOString()
    });
    if (activity.length > 50) activity.length = 50;
    saveState();
    renderActivity();
}

/* ── Auth ── */
function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const err = document.getElementById('loginError');
    const btn = document.querySelector('.btn-login');

    btn.classList.add('loading');
    btn.textContent = 'Signing in...';

    setTimeout(() => {
        if (username === 'admin' && password === '1234') {
            sessionStorage.setItem(AUTH_KEY, 'true');
            if (document.getElementById('rememberMe').checked) {
                localStorage.setItem(REMEMBER_KEY, 'true');
            }
            err.style.display = 'none';
            showApp();
            const hash = location.hash.replace('#', '');
            const valid = ['dashboard', 'employees', 'machines', 'projects', 'vehicles', 'settings', 'reports'];
            showSection(valid.includes(hash) ? hash : 'dashboard');
            toast('Welcome back, Admin!', 'success');
            logActivity('login', 'system', 'User logged in');
        } else {
            err.style.display = 'block';
            toast('Invalid credentials', 'error');
        }
        btn.classList.remove('loading');
        btn.textContent = 'Sign In';
    }, 600);
}

function logout() {
    confirmAction('Logout', 'Are you sure you want to logout?', () => {
        sessionStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(REMEMBER_KEY);
        document.getElementById('sidebar').classList.remove('visible');
        document.getElementById('mainContent').classList.remove('authenticated');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('loginBg').classList.remove('hidden');
        showSection('loginSection');
        toast('Logged out successfully', 'info');
    });
}

function togglePassword() {
    const pw = document.getElementById('password');
    const btn = document.querySelector('.pw-toggle');
    if (pw.type === 'password') { pw.type = 'text'; btn.textContent = '🙈'; }
    else { pw.type = 'password'; btn.textContent = '👁️'; }
}

/* ── Navigation ── */
function showApp() {
    document.getElementById('sidebar').classList.add('visible');
    document.getElementById('mainContent').classList.add('authenticated');
    document.getElementById('loginBg').classList.add('hidden');
    document.getElementById('navbarActions').classList.remove('hidden');
}

function showSection(id, updateHash = true) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('active');

    document.querySelectorAll('.sidebar a[data-section]').forEach(a => {
        a.classList.toggle('active', a.dataset.section === id);
    });

    if (updateHash && id !== 'loginSection') location.hash = id;

    if (id === 'dashboard') { updateDashboard(); renderChart(); renderActivity(); }
    if (id === 'reports') renderReports();
    if (['employees', 'machines', 'projects', 'vehicles'].includes(id)) {
        const type = Object.keys(MODULES).find(k => MODULES[k].section === id);
        if (type) renderModule(type);
    }

    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

/* ── Theme ── */
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
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

    const total = counts.emp + counts.machine + counts.project + counts.vehicle;
    const greet = document.getElementById('greeting');
    if (greet) {
        const h = new Date().getHours();
        const timeGreet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
        greet.textContent = `${timeGreet}, Admin`;
    }
    const totalEl = document.getElementById('totalRecords');
    if (totalEl) totalEl.textContent = total;
}

function animateCount(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const duration = 600;
    const startTime = performance.now();
    function step(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(start + (target - start) * eased);
        if (progress < 1) requestAnimationFrame(step);
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
            <div class="chart-bar ${classes[i]}" style="height: ${Math.max((c / max) * 120, 4)}px" title="${c} records"></div>
            <span class="chart-label">${labels[i]} (${c})</span>
        </div>
    `).join('');
}

function renderActivity() {
    const feed = document.getElementById('activityFeed');
    if (!feed) return;
    if (activity.length === 0) {
        feed.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><h3>No activity yet</h3><p>Actions you take will appear here</p></div>';
        return;
    }
    feed.innerHTML = activity.slice(0, 10).map(a => {
        const time = new Date(a.time);
        const ago = timeAgo(time);
        const icon = a.action === 'add' ? 'add' : a.action === 'delete' ? 'delete' : 'edit';
        return `<div class="activity-item">
            <div class="activity-dot ${icon}"></div>
            <div>
                <div class="activity-text"><strong>${capitalize(a.action)}</strong> in ${a.module}: ${escapeHtml(a.detail)}</div>
                <div class="activity-time">${ago}</div>
            </div>
        </div>`;
    }).join('');
}

function timeAgo(date) {
    const s = Math.floor((Date.now() - date.getTime()) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return date.toLocaleDateString();
}

/* ── Module rendering ── */
function renderModule(type) {
    renderForm(type);
    renderTable(type);
}

function renderAll() {
    Object.keys(MODULES).forEach(renderModule);
}

function renderForm(type) {
    const form = document.getElementById(MODULES[type].formId);
    if (!form) return;
    form.innerHTML = columns[type].map(c => {
        const inputType = getInputType(c);
        return `<div class="form-field">
            <label for="${colId(type, c)}">${escapeHtml(c)}</label>
            <input type="${inputType}" id="${colId(type, c)}" placeholder="Enter ${c.toLowerCase()}">
        </div>`;
    }).join('');
}

function getInputType(col) {
    const lower = col.toLowerCase();
    if (lower.includes('date') || lower.includes('deadline')) return 'date';
    if (lower.includes('salary') || lower.includes('budget') || lower.includes('contact')) return 'text';
    if (lower.includes('email')) return 'email';
    return 'text';
}

function getFilteredData(type) {
    let rows = [...data[type]];
    const query = (searchState[type] || '').toLowerCase();
    if (query) {
        rows = rows.filter(r => columns[type].some(c => (r[c] || '').toString().toLowerCase().includes(query)));
    }
    const sort = sortState[type];
    if (sort) {
        rows.sort((a, b) => {
            const av = (a[sort.col] || '').toString().toLowerCase();
            const bv = (b[sort.col] || '').toString().toLowerCase();
            const cmp = av.localeCompare(bv, undefined, { numeric: true });
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
        const isSorted = sort && sort.col === c;
        const arrow = isSorted ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅';
        return `<th class="${isSorted ? 'sorted' : ''}" onclick="sortTable('${type}', '${escapeAttr(c)}')">${escapeHtml(c)} <span class="sort-arrow">${arrow}</span></th>`;
    }).join('') + '<th>Actions</th>';

    const filtered = getFilteredData(type);
    const page = pageState[type] || 0;
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page >= totalPages) pageState[type] = totalPages - 1;
    const start = (pageState[type] || 0) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
    } else {
        if (empty) empty.classList.add('hidden');
        tbody.innerHTML = pageRows.map(row => {
            const realIndex = data[type].indexOf(row);
            const cells = columns[type].map(c =>
                `<td contenteditable="true" onblur="updateCell('${type}', ${realIndex}, '${escapeAttr(c)}', this.innerText)">${escapeHtml(row[c] || '')}</td>`
            ).join('');
            return `<tr style="animation: fadeUp 0.3s ease">${cells}
                <td><div class="table-actions">
                    <button class="btn btn-sm btn-danger" onclick="deleteRow('${type}', ${realIndex})">🗑️</button>
                </div></td></tr>`;
        }).join('');
    }

    if (pagination) {
        pagination.innerHTML = filtered.length > PAGE_SIZE ? `
            <button onclick="changePage('${type}', -1)" ${pageState[type] <= 0 ? 'disabled' : ''}>← Prev</button>
            <span class="page-info">Page ${(pageState[type] || 0) + 1} of ${totalPages} (${filtered.length} records)</span>
            <button onclick="changePage('${type}', 1)" ${(pageState[type] || 0) >= totalPages - 1 ? 'disabled' : ''}>Next →</button>
        ` : filtered.length > 0 ? `<span class="page-info">${filtered.length} record${filtered.length !== 1 ? 's' : ''}</span>` : '';
    }
}

function changePage(type, dir) {
    pageState[type] = (pageState[type] || 0) + dir;
    renderTable(type);
}

function sortTable(type, col) {
    const current = sortState[type];
    if (current && current.col === col) {
        sortState[type] = { col, dir: current.dir === 'asc' ? 'desc' : 'asc' };
    } else {
        sortState[type] = { col, dir: 'asc' };
    }
    renderTable(type);
}

function searchTable(type, query) {
    searchState[type] = query;
    pageState[type] = 0;
    renderTable(type);
}

function toggleFormPanel(type) {
    const panel = document.getElementById(type + 'FormPanel');
    if (panel) panel.classList.toggle('collapsed');
}

/* ── CRUD ── */
function colId(type, col) {
    return type + '_' + col.replace(/\s+/g, '_');
}

function addRow(type) {
    const row = {};
    let filled = 0;
    let hasError = false;

    columns[type].forEach(c => {
        const el = document.getElementById(colId(type, c));
        const val = el ? el.value.trim() : '';
        row[c] = val;
        if (el) {
            el.classList.remove('error');
            if (!val && ['Name', 'Project', 'Vehicle Name'].includes(c)) {
                el.classList.add('error');
                hasError = true;
            }
            if (val) filled++;
        }
    });

    if (hasError) { toast('Please fill required fields (marked in red)', 'warning'); return; }
    if (filled === 0) { toast('Please fill at least one field', 'warning'); return; }

    data[type].push(row);
    saveState();
    renderTable(type);
    updateDashboard();
    columns[type].forEach(c => {
        const el = document.getElementById(colId(type, c));
        if (el) el.value = '';
    });

    const name = row['Name'] || row['Project'] || row['Vehicle Name'] || 'New record';
    logActivity('add', MODULES[type].label, name);
    toast(`${MODULES[type].label}: "${name}" added`, 'success');
}

function updateCell(type, i, col, val) {
    const old = data[type][i][col];
    data[type][i][col] = val.trim();
    saveState();
    if (old !== val.trim()) {
        logActivity('edit', MODULES[type].label, `Updated ${col} for record #${i + 1}`);
    }
}

function deleteRow(type, i) {
    const name = data[type][i]['Name'] || data[type][i]['Project'] || data[type][i]['Vehicle Name'] || `Record #${i + 1}`;
    confirmAction('Delete Record', `Are you sure you want to delete "${name}"? This cannot be undone.`, () => {
        data[type].splice(i, 1);
        saveState();
        renderTable(type);
        updateDashboard();
        logActivity('delete', MODULES[type].label, name);
        toast('Record deleted', 'info');
    });
}

function addColumn(type) {
    const input = document.getElementById(type + 'NewColumn');
    const name = (input?.value || '').trim();
    if (!name) { toast('Enter a column name', 'warning'); return; }
    if (columns[type].includes(name)) { toast('Column already exists', 'warning'); return; }
    columns[type].push(name);
    input.value = '';
    saveState();
    renderModule(type);
    toast(`Column "${name}" added`, 'success');
}

function removeColumn(type) {
    const input = document.getElementById(type + 'RemoveColumn');
    const col = (input?.value || '').trim();
    if (!col || !columns[type].includes(col)) {
        toast('Column not found', 'error');
        return;
    }
    confirmAction('Remove Column', `Remove column "${col}" from all records?`, () => {
        columns[type] = columns[type].filter(c => c !== col);
        data[type].forEach(row => delete row[col]);
        input.value = '';
        saveState();
        renderModule(type);
        toast(`Column "${col}" removed`, 'info');
    });
}

/* ── Export / Import ── */
function exportCSV(type) {
    const rows = data[type];
    if (rows.length === 0) { toast('No data to export', 'warning'); return; }
    const cols = columns[type];
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => `"${(r[c] || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    downloadFile(`${MODULES[type].label}_${dateStamp()}.csv`, csv, 'text/csv');
    toast('CSV exported successfully', 'success');
}

function exportAllJSON() {
    const payload = { data, columns, exported: new Date().toISOString() };
    downloadFile(`CDMS_Backup_${dateStamp()}.json`, JSON.stringify(payload, null, 2), 'application/json');
    toast('Full backup exported', 'success');
}

function importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const parsed = JSON.parse(ev.target.result);
                if (parsed.data) {
                    confirmAction('Import Data', 'This will merge imported data with existing records. Continue?', () => {
                        Object.keys(parsed.data).forEach(k => {
                            if (data[k]) data[k] = [...data[k], ...parsed.data[k]];
                        });
                        if (parsed.columns) Object.assign(columns, parsed.columns);
                        saveState();
                        renderAll();
                        updateDashboard();
                        toast('Data imported successfully', 'success');
                    });
                } else { toast('Invalid backup file', 'error'); }
            } catch (err) { toast('Failed to parse file', 'error'); }
        };
        reader.readAsText(file);
    };
    input.click();
}

function resetAllData() {
    confirmAction('Reset All Data', 'This will permanently delete ALL records. Are you absolutely sure?', () => {
        data = { emp: [], machine: [], project: [], vehicle: [] };
        columns = structuredClone(defaultColumns);
        activity = [];
        saveState();
        renderAll();
        updateDashboard();
        toast('All data has been reset', 'warning');
    });
}

function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
}

function dateStamp() {
    return new Date().toISOString().slice(0, 10);
}

/* ── Reports ── */
function renderReports() {
    const container = document.getElementById('reportsContent');
    if (!container) return;

    const totalSalary = data.emp.reduce((s, e) => s + (parseFloat((e.Salary || '0').replace(/[^0-9.]/g, '')) || 0), 0);
    const totalBudget = data.project.reduce((s, p) => s + (parseFloat((p.Budget || '0').replace(/[^0-9.]/g, '')) || 0), 0);
    const activeProjects = data.project.filter(p => (p.Status || '').toLowerCase() === 'active').length;
    const machinesOk = data.machine.filter(m => (m.Status || '').toLowerCase() !== 'broken').length;

    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card emp"><div class="stat-icon">💰</div><div class="stat-label">Total Payroll</div><div class="stat-value">₹${totalSalary.toLocaleString()}</div></div>
            <div class="stat-card project"><div class="stat-icon">📊</div><div class="stat-label">Total Budget</div><div class="stat-value">₹${totalBudget.toLocaleString()}</div></div>
            <div class="stat-card machine"><div class="stat-icon">✅</div><div class="stat-label">Active Projects</div><div class="stat-value">${activeProjects}</div></div>
            <div class="stat-card vehicle"><div class="stat-icon">🔧</div><div class="stat-label">Machines OK</div><div class="stat-value">${machinesOk}/${data.machine.length}</div></div>
        </div>
        <div class="card">
            <div class="card-title">📈 Module Summary</div>
            <div class="table-wrapper"><table>
                <thead><tr><th>Module</th><th>Records</th><th>Columns</th><th>Last Activity</th></tr></thead>
                <tbody>${Object.entries(MODULES).map(([k, m]) => {
                    const last = activity.find(a => a.module === m.label);
                    return `<tr><td>${m.icon} ${m.label}</td><td>${data[k].length}</td><td>${columns[k].length}</td><td>${last ? timeAgo(new Date(last.time)) : '—'}</td></tr>`;
                }).join('')}</tbody>
            </table></div>
        </div>`;
}

/* ── Modal & Toast ── */
function confirmAction(title, message, onConfirm) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('modalOverlay').classList.add('active');
    pendingConfirm = onConfirm;
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    pendingConfirm = null;
}

function confirmModal() {
    if (pendingConfirm) pendingConfirm();
    closeModal();
}

function toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    el.innerHTML = `<span>${icons[type] || ''}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('removing'); setTimeout(() => el.remove(), 300); }, 3500);
}

/* ── Utilities ── */
function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function escapeAttr(str) {
    return str.replace(/'/g, "\\'");
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

document.addEventListener('DOMContentLoaded', init);

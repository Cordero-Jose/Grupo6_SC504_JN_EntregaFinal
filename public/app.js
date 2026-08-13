// ── Shared utilities for all pages ──

// Auto-ID generator — fetches existing records and returns next sequential ID
// prefix: 'C', 'CIT', 'V', etc.  pad: zero-padding width (3 = "001")
async function nextId(apiPath, prefix, pad = 3, idField = null) {
  try {
    const rows = await apiFetch(apiPath);
    if (!rows.length) return prefix + String(1).padStart(pad, '0');
    const nums = rows.map(r => {
      const key = idField
        ? idField
        : Object.keys(r).find(k => k.startsWith('ID_') || k === 'ID');
      const val = r[key] || '';
      const n = parseInt(val.replace(/\D/g, ''), 10);
      return isNaN(n) ? 0 : n;
    });
    const next = Math.max(...nums) + 1;
    return prefix + String(next).padStart(pad, '0');
  } catch { return ''; }
}

// Mark active nav link — match on filename only to avoid query-string / hash issues
(function markActiveNav() {
    const current = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.sidebar nav a').forEach(a => {
        const aPage = a.getAttribute('href').split('?')[0].split('#')[0];
        if (aPage === current) a.classList.add('active');
    });
})();

// ── Toast notification v2 (icon + styled) ───────────────────────────────────
const _toastIcons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
let _toastTimer = null;
function toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    if (!el) return;
    // Cancel any running timeout so back-to-back toasts don't flicker
    if (_toastTimer) { clearTimeout(_toastTimer); el.className = ''; }
    el.innerHTML = `<span class="toast-icon">${_toastIcons[type] || 'ℹ'}</span><span class="toast-msg">${msg}</span>`;
    // Force reflow so the animation restarts cleanly
    void el.offsetWidth;
    el.className = 'show ' + type;
    _toastTimer = setTimeout(() => { el.className = ''; _toastTimer = null; }, 3500);
}

// ── Confirm dialog (replaces browser confirm()) ──────────────────────────────
// Usage: confirmDialog({ title, message, confirmText, danger, onConfirm })
// Injects #confirm-overlay into <body> once, then reuses it.
function confirmDialog({ title = '¿Confirmar?', message = '', confirmText = 'Confirmar', danger = true, onConfirm }) {
    let overlay = document.getElementById('confirm-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'confirm-overlay';
        overlay.innerHTML = `
          <div id="confirm-box">
            <div class="confirm-icon" id="confirm-icon">⚠️</div>
            <h4 id="confirm-title"></h4>
            <p  id="confirm-msg"></p>
            <div class="confirm-actions">
              <button class="btn-cancel"  id="confirm-cancel">Cancelar</button>
              <button class="btn-confirm" id="confirm-ok"></button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
        document.getElementById('confirm-cancel').addEventListener('click', () => {
            overlay.classList.remove('open');
        });
    }
    document.getElementById('confirm-title').textContent  = title;
    document.getElementById('confirm-msg').textContent    = message;
    const okBtn = document.getElementById('confirm-ok');
    okBtn.textContent = confirmText;
    okBtn.className   = danger ? 'btn-confirm' : 'btn-confirm is-primary';
    const icon = document.getElementById('confirm-icon');
    icon.className    = danger ? 'confirm-icon danger' : 'confirm-icon';
    icon.textContent  = danger ? '🗑️' : '✅';
    // Replace old listener cleanly
    const newOk = okBtn.cloneNode(true);
    newOk.textContent = confirmText;
    newOk.className   = okBtn.className;
    okBtn.parentNode.replaceChild(newOk, okBtn);
    newOk.addEventListener('click', () => {
        overlay.classList.remove('open');
        if (typeof onConfirm === 'function') onConfirm();
    });
    overlay.classList.add('open');
}

// Open / close modal
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Generic API helpers
async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'x-role': currentRole(),
            ...(options.headers || {})
        }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    return data;
}

// Badge helper
function badgeEstado(estado) {
    const map = {
        'ACTIVO':      'badge-success',
        'ATENDIDA':    'badge-success',
        'FINALIZADA':  'badge-success',
        'PAGADA':      'badge-success',
        'CONFIRMADA':  'badge-info',
        'EN_PROCESO':  'badge-info',
        'ENTRADA':     'badge-success',
        'PENDIENTE':   'badge-warning',
        'ABIERTA':     'badge-warning',
        'INACTIVO':    'badge-muted',
        'CANCELADA':   'badge-danger',
        'ANULADA':     'badge-danger',
        'SALIDA':      'badge-danger'
    };
    const cls = map[estado] || 'badge-muted';
    return `<span class="badge ${cls}">${estado}</span>`;
}

// Format currency (Costa Rica colones)
function fmtCRC(n) {
    return '₡' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2 });
}

// ── Universal table search ────────────────────────────────────────────────────
function initTableSearch(inputId, tbodyId) {
    const inp = document.getElementById(inputId);
    const tb  = document.getElementById(tbodyId);
    if (!inp || !tb) return;
    inp.addEventListener('input', () => {
        const q = inp.value.trim().toLowerCase();
        Array.from(tb.rows).forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = (!q || text.includes(q)) ? '' : 'none';
        });
    });
}

// ── Role-based access control (RBAC) ─────────────────────────────────────────
// Roles and which nav pages they can see.
// Pages NOT in a role's list will be hidden from the sidebar AND redirect if visited directly.
const _ROLES = {
    ADMINISTRADOR: {
        label: 'Administrador',
        color: '#7c3aed',
        pages: ['index.html','clientes.html','vehiculos.html','citas.html','ordenes.html',
                'servicios.html','productos.html','inventario.html',
                'facturas.html','pagos.html','usuarios.html','auditoria.html']
    },
    MECANICO: {
        label: 'Mecánico',
        color: '#2563eb',
        pages: ['index.html','citas.html','ordenes.html','servicios.html',
                'productos.html','inventario.html','vehiculos.html','clientes.html']
    },
    CAJERO: {
        label: 'Cajero',
        color: '#16a34a',
        pages: ['index.html','facturas.html','pagos.html','clientes.html','vehiculos.html']
    },
    RECEPCIONISTA: {
        label: 'Recepcionista',
        color: '#d97706',
        pages: ['index.html','clientes.html','vehiculos.html','citas.html','servicios.html']
    }
};

// Inject the role switcher pill into the sidebar and apply visibility rules.
(function applyRBAC() {
    const stored   = localStorage.getItem('lbc_role') || 'ADMINISTRADOR';
    const roleCfg  = _ROLES[stored] || _ROLES['ADMINISTRADOR'];

    // ── Inject switcher UI above nav ────────────────────────────
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && !document.getElementById('role-switcher')) {
        const sw = document.createElement('div');
        sw.id = 'role-switcher';
        sw.style.cssText = 'padding:10px 16px 12px;border-bottom:1px solid #1e2128';
        sw.innerHTML = `
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#4a5568;font-weight:700;margin-bottom:6px">Perfil activo</div>
          <select id="roleSelect" style="width:100%;background:#1a1f28;color:#fff;border:1px solid #2d3748;border-radius:6px;padding:6px 10px;font-size:12px;font-weight:600;font-family:Inter,sans-serif;cursor:pointer;outline:none">
            ${Object.entries(_ROLES).map(([k,v]) =>
              `<option value="${k}" ${k===stored?'selected':''}>${v.label}</option>`
            ).join('')}
          </select>
          <div id="roleBadge" style="margin-top:6px;font-size:11px;font-weight:600;padding:3px 8px;border-radius:12px;display:inline-block;background:${roleCfg.color}22;color:${roleCfg.color}">${roleCfg.label}</div>`;
        // Insert before the nav
        const nav = sidebar.querySelector('nav');
        sidebar.insertBefore(sw, nav);

        document.getElementById('roleSelect').addEventListener('change', function() {
            localStorage.setItem('lbc_role', this.value);
            location.reload();
        });
    }

    // ── Hide sidebar links not in this role ─────────────────────
    const allowedPages = new Set(roleCfg.pages);
    document.querySelectorAll('.sidebar nav a').forEach(a => {
        const page = a.getAttribute('href').split('?')[0];
        if (!allowedPages.has(page)) {
            a.style.display = 'none';
            // Also hide orphan section-title if ALL links below it are hidden
        }
    });

    // Hide section-title divs where every following sibling link is hidden
    document.querySelectorAll('.sidebar nav .section-title').forEach(title => {
        let next = title.nextElementSibling;
        let hasVisible = false;
        while (next && !next.classList.contains('section-title')) {
            if (next.tagName === 'A' && next.style.display !== 'none') { hasVisible = true; break; }
            next = next.nextElementSibling;
        }
        if (!hasVisible) title.style.display = 'none';
    });

    // ── Guard: redirect if current page not allowed ──────────────
    const current = location.pathname.split('/').pop() || 'index.html';
    if (current !== 'index.html' && !allowedPages.has(current)) {
        toast(`Tu perfil (${roleCfg.label}) no tiene acceso a esta página.`, 'error');
        setTimeout(() => { location.href = 'index.html'; }, 1800);
    }
})();

// ── RBAC helpers (usable by any page script) ─────────────────────────────────
function currentRole() {
    return localStorage.getItem('lbc_role') || 'ADMINISTRADOR';
}
function isAdmin() {
    return currentRole() === 'ADMINISTRADOR';
}

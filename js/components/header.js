import { showToast, showModal } from '../utils/helpers.js';

const passwords = {
    admin: 'AdminMS',
    recepcion: 'RecepMS',
    tecnico: 'TecMS',
};

const roleIcons = {
    admin: 'fa-user-shield',
    recepcion: 'fa-user-tie',
    tecnico: 'fa-user-gear',
};

const roleNames = {
    admin: 'Administrador',
    recepcion: 'Recepcionista',
    tecnico: 'Técnico',
};

export function renderHeader(title, subtitle = '') {
    const role = window._currentRole || 'admin';
    const userName = window._currentUser || 'Usuario';
    const badgeLabels = { admin: 'TOTAL', recepcion: 'RECEPCIÓN', tecnico: 'TÉCNICO' };
    const badgeColors = { admin: '#0b1e33', recepcion: '#2e7d32', tecnico: '#e65100' };

    return `
        <div class="top-header">
            <div style="display:flex;align-items:center;gap:12px;">
                <button class="sidebar-toggle"><i class="fas fa-bars"></i></button>
                <h1>
                    ${title}
                    ${subtitle ? `<small>${subtitle}</small>` : ''}
                </h1>
            </div>
            <div class="header-right">
                <button class="theme-toggle" id="themeToggle" title="Cambiar tema">
                    <i class="fas fa-moon"></i>
                </button>
                <div class="role-selector">
                    <i class="fas ${roleIcons[role]}"></i>
                    <span>${userName}</span>
                    <select id="roleSwitcher">
                        <option value="admin" ${role === 'admin' ? 'selected' : ''}>Administrador</option>
                        <option value="recepcion" ${role === 'recepcion' ? 'selected' : ''}>Recepcionista</option>
                        <option value="tecnico" ${role === 'tecnico' ? 'selected' : ''}>Técnico</option>
                    </select>
                    <span class="role-badge" id="roleBadge" style="background:${badgeColors[role]}">${badgeLabels[role]}</span>
                </div>
                <div class="avatar" title="${userName}" onclick="window.logout()" style="cursor:pointer;">
                    ${userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
            </div>
        </div>
    `;
}

export function initHeader(onRoleChange) {
    const select = document.getElementById('roleSwitcher');
    if (!select) return;

    select.addEventListener('change', () => {
        const newRole = select.value;
        const currentRole = window._currentRole || 'admin';

        if (newRole === currentRole) return;

        const content = `
            <div style="text-align:center;margin-bottom:16px;">
                <i class="fas fa-lock" style="font-size:32px;color:var(--color-accent);margin-bottom:8px;"></i>
                <h3>Cambiar a ${roleNames[newRole]}</h3>
                <p style="font-size:13px;color:var(--color-text-muted);">Ingresá la contraseña para continuar</p>
            </div>
            <div class="form-group">
                <label>Contraseña</label>
                <input type="password" class="form-control" id="modalPassword" placeholder="Contraseña">
            </div>
            <p id="modalPassError" style="color:var(--color-danger);font-size:12px;display:none;">Contraseña incorrecta</p>
        `;

        showModal('Cambiar Rol', content, () => {
            const pass = document.getElementById('modalPassword').value;
            if (pass === passwords[newRole]) {
                localStorage.setItem('servieltec_role', newRole);
                window._currentRole = newRole;

                const badge = document.getElementById('roleBadge');
                const labels = { admin: 'TOTAL', recepcion: 'RECEPCIÓN', tecnico: 'TÉCNICO' };
                const colors = { admin: '#0b1e33', recepcion: '#2e7d32', tecnico: '#e65100' };
                badge.textContent = labels[newRole];
                badge.style.background = colors[newRole];

                if (onRoleChange) onRoleChange(newRole);
                showToast('Rol cambiado exitosamente', 'success');
            } else {
                document.getElementById('modalPassError').style.display = 'block';
                document.getElementById('modalPassword').value = '';
                document.getElementById('modalPassword').focus();
                return false;
            }
        });

        select.value = currentRole;
    });

    initThemeToggle();
}

function initThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    const savedTheme = localStorage.getItem('servieltec_theme') || 'light';
    applyTheme(savedTheme);

    toggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem('servieltec_theme', next);
    });
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
        toggle.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
}

import { $ } from '../utils/helpers.js';

export function renderSidebar() {
    const role = window._currentRole || 'admin';

    if (role === 'cliente') {
        return `
            <div class="logo"><img src="img/recorte.jpg" alt="Servieltec"></div>
            <div class="nav-section">Mi Cuenta</div>
            <div class="menu-item active" data-page="cliente">
                <i class="fas fa-box-open"></i>
                <span>Mis Equipos</span>
            </div>
            <div class="bottom-menu">
                <div class="menu-item" id="btnLogout" onclick="window.logout()">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Salir</span>
                </div>
            </div>
        `;
    }

    return `
        <div class="logo"><img src="img/recorte.jpg" alt="Servieltec"></div>
        <div class="nav-section">Principal</div>
        <div class="menu-item active" data-page="dashboard">
            <i class="fas fa-th-large"></i>
            <span>Dashboard</span>
        </div>
        <div class="menu-item" data-page="ordenes">
            <i class="fas fa-clipboard-list"></i>
            <span>Órdenes</span>
        </div>
        <div class="menu-item" data-page="servicios_domicilio">
            <i class="fas fa-home"></i>
            <span>Serv. Domicilio</span>
        </div>
        <div class="menu-item" data-page="garantias">
            <i class="fas fa-shield-alt"></i>
            <span>Garantías</span>
        </div>
        <div class="nav-section">Gestión</div>
        <div class="menu-item" data-page="clientes">
            <i class="fas fa-users"></i>
            <span>Clientes</span>
        </div>
        <div class="menu-item" data-page="tecnicos">
            <i class="fas fa-user-cog"></i>
            <span>Técnicos</span>
        </div>
        <div class="menu-item" data-page="facturacion">
            <i class="fas fa-file-invoice-dollar"></i>
            <span>Facturación</span>
        </div>
        <div class="menu-item" data-page="repuestos">
            <i class="fas fa-boxes"></i>
            <span>Repuestos</span>
        </div>
        <div class="bottom-menu">
            <div class="menu-item" id="btnLogout" onclick="window.logout()">
                <i class="fas fa-sign-out-alt"></i>
                <span>Salir</span>
            </div>
        </div>
    `;
}

export function initSidebar(onNavigate) {
    const sidebar = $('.sidebar');
    if (!sidebar) return;

    sidebar.querySelectorAll('.menu-item[data-page]').forEach(item => {
        item.addEventListener('click', () => {
            sidebar.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
            item.classList.add('active');
            onNavigate(item.dataset.page);
        });
    });

    const toggle = $('.sidebar-toggle');
    const overlay = $('.sidebar-overlay');
    if (toggle) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        });
    }
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
}

export function setActivePage(page) {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    sidebar.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    const active = sidebar.querySelector(`[data-page="${page}"]`);
    if (active) active.classList.add('active');
}

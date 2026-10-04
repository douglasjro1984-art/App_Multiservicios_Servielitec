import { Router } from './router.js';
import { renderSidebar, initSidebar, setActivePage } from './components/sidebar.js';
import { renderHeader, initHeader } from './components/header.js';
import { renderSplash, initSplash } from './components/splash.js';
import { renderLogin, initLogin, getStoredRole, getStoredUser, getStoredClienteId, clearStoredRole } from './components/login.js';
import { renderDashboard, setDashboardRole, initDashboard } from './pages/dashboard.js';
import { renderOrdenes, initOrdenes, setOrdenesRole } from './pages/ordenes.js';
import { renderClientes, initClientes } from './pages/clientes.js';
import { renderTecnicos, initTecnicos } from './pages/tecnicos.js';
import { renderFacturacion, initFacturacion } from './pages/facturacion.js';
import { renderRepuestos, initRepuestos } from './pages/repuestos.js';
import { renderGarantias, initGarantias, setGarantiasRole } from './pages/garantias.js';
import { renderClienteDashboard, initClienteDashboard } from './pages/cliente.js';
import { renderTracking, initTracking } from './pages/tracking.js';
import { renderServiciosDomicilio, initServiciosDomicilio, setServDomRole } from './pages/servicios_domicilio.js';
import { showToast } from './utils/helpers.js';

window.showToast = showToast;

const savedTheme = localStorage.getItem('servieltec_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

const app = document.getElementById('app');
const router = new Router();
let currentPage = null;

const pages = {
    dashboard: { title: 'Panel de Control', subtitle: '', render: renderDashboard, init: null },
    ordenes: { title: 'Órdenes de Servicio', subtitle: '', render: renderOrdenes, init: initOrdenes },
    servicios_domicilio: { title: 'Servicios a Domicilio', subtitle: '', render: renderServiciosDomicilio, init: initServiciosDomicilio },
    garantias: { title: 'Garantías', subtitle: '', render: renderGarantias, init: initGarantias },
    clientes: { title: 'Clientes', subtitle: '', render: renderClientes, init: initClientes },
    tecnicos: { title: 'Técnicos', subtitle: '', render: renderTecnicos, init: initTecnicos },
    facturacion: { title: 'Facturación', subtitle: '', render: renderFacturacion, init: initFacturacion },
    repuestos: { title: 'Repuestos', subtitle: '', render: renderRepuestos, init: initRepuestos },
    cliente: { title: 'Mis Equipos', subtitle: '', render: renderClienteDashboard, init: initClienteDashboard },
};

const subtitleByRole = {
    admin: '<i class="fas fa-store"></i> Multiservicios Servieltec',
    recepcion: '<i class="fas fa-clipboard-list"></i> Recepción y Entregas',
    tecnico: '<i class="fas fa-microchip"></i> Bandeja de Trabajo',
    cliente: '<i class="fas fa-user"></i> Portal del Cliente',
};

function getCurrentSubtitle() {
    return subtitleByRole[window._currentRole || 'admin'];
}

function showSplash() {
    app.innerHTML = renderSplash();
    initSplash(() => {
        if (checkAuth()) {
            if (getStoredRole() === 'cliente') {
                window._clienteId = getStoredClienteId();
                renderAdminPage('cliente');
            } else {
                renderAdminPage('dashboard');
            }
        } else {
            showLogin();
        }
    });
}

function showLogin() {
    app.innerHTML = renderLogin();
    initLogin((rol, nombre) => {
        if (rol === 'cliente') {
            window._clienteId = getStoredClienteId();
            renderAdminPage('cliente');
        } else {
            renderAdminPage('dashboard');
        }
    });
}

function renderAdminPage(pageName) {
    const page = pages[pageName];
    if (!page) return;

    if (currentPage === pageName && document.querySelector('.sidebar')) return;

    currentPage = pageName;

    app.innerHTML = `
        <div class="sidebar-overlay"></div>
        <aside class="sidebar">${renderSidebar()}</aside>
        <main class="main-content">
            ${renderHeader(page.title, getCurrentSubtitle())}
            <div class="page-content">${page.render()}</div>
        </main>
    `;

    initSidebar((p) => {
        if (currentPage !== p) router.navigate(`/${p}`);
    });
    initHeader((role) => {
        const subtitleEl = document.querySelector('.top-header h1 small');
        if (subtitleEl) subtitleEl.innerHTML = getCurrentSubtitle();

        if (currentPage === 'dashboard') {
            setDashboardRole(role);
        } else if (currentPage === 'ordenes') {
            setOrdenesRole(role);
        } else if (currentPage === 'garantias') {
            setGarantiasRole(role);
        } else if (currentPage === 'servicios_domicilio') {
            setServDomRole(role);
        }
    });
    setActivePage(pageName);

    if (page.init) page.init();
    if (pageName === 'dashboard') initDashboard();

    document.querySelector('.main-content').scrollTop = 0;
}

function renderTrackingPage() {
    currentPage = 'tracking';
    app.innerHTML = renderTracking();
    initTracking();
}

function checkAuth() {
    const stored = getStoredRole();
    if (stored) {
        window._currentRole = stored;
        window._currentUser = getStoredUser();
        return true;
    }
    return false;
}

router
    .addRoute('/', () => {
        showSplash();
    })
    .addRoute('/dashboard', () => {
        if (checkAuth()) renderAdminPage('dashboard');
        else showLogin();
    })
    .addRoute('/login', () => showLogin())
    .addRoute('/ordenes', () => {
        if (checkAuth()) renderAdminPage('ordenes');
        else showLogin();
    })
    .addRoute('/servicios_domicilio', () => {
        if (checkAuth()) renderAdminPage('servicios_domicilio');
        else showLogin();
    })
    .addRoute('/garantias', () => {
        if (checkAuth()) renderAdminPage('garantias');
        else showLogin();
    })
    .addRoute('/clientes', () => {
        if (checkAuth()) renderAdminPage('clientes');
        else showLogin();
    })
    .addRoute('/tecnicos', () => {
        if (checkAuth()) renderAdminPage('tecnicos');
        else showLogin();
    })
    .addRoute('/facturacion', () => {
        if (checkAuth()) renderAdminPage('facturacion');
        else showLogin();
    })
    .addRoute('/repuestos', () => {
        if (checkAuth()) renderAdminPage('repuestos');
        else showLogin();
    })
    .addRoute('/cliente', () => {
        if (checkAuth() && getStoredRole() === 'cliente') renderAdminPage('cliente');
        else showLogin();
    })
    .addRoute('/tracking', () => renderTrackingPage())
    .init();

window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1);
    if (hash.startsWith('/tracking') || hash.startsWith('/approval')) {
        renderTrackingPage();
    }
});

window.logout = function() {
    clearStoredRole();
    window._currentUser = null;
    window._currentRole = 'admin';
    window._clienteId = null;
    showSplash();
};

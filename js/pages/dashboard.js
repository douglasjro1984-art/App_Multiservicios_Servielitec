import { renderKpiGrid } from '../components/kpi-card.js';
import { renderBarChart } from '../components/chart.js';
import { renderKanban, initKanban } from '../components/kanban.js';
import { showToast, formatCurrency, showModal } from '../utils/helpers.js';
import { getOrdenes, loadOrdenes, saveOrdenes, notifyOrdenesChange, abrirNuevaOrden, aprobarOrden, rechazarOrden } from './ordenes.js';

let currentRole = 'admin';

function buildKanbanFromOrders(role) {
    const ordenes = getOrdenes();

    const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
    const estadoMapDom = {
        pendiente: 'recepcion',
        asignado: 'recepcion',
        en_curso: 'diagnostico',
        esperando_aprobacion: 'esperando_aprobacion',
        rechazado: 'rechazado',
        completado: 'retirar',
        pendiente_seguimiento: 'en_taller',
        facturado: 'retirado',
    };
    const idsConOrden = new Set(ordenes.filter(o => o.servicioDomicilioId).map(o => o.servicioDomicilioId));
    const serviciosKanban = serviciosDom
        .filter(s => s.estado !== 'cancelado' && !idsConOrden.has(s.id))
        .map(s => ({
            id: s.id,
            token: s.id,
            cliente: s.cliente.nombre,
            tel: s.cliente.telefono,
            email: s.cliente.email || '',
            equipo: `${s.equipo.tipo} ${s.equipo.marca}`,
            tipo: s.tipoServicio === 'mantenimiento' ? 'Electrodoméstico' : 'Otro',
            estado: estadoMapDom[s.estado] || 'recepcion',
            tecnico: s.tecnicoAsignado || '-',
            precio: s.precio || 0,
            fechaIngreso: s.fechaIngreso,
            notas: s.equipo.descripcion || '',
            fotos: [],
            diagnostico: null,
            ordenTrabajo: s.ordenTrabajo,
            servicioDomicilio: true,
            direccionDomicilio: s.cliente.direccion,
            servicioDomicilioId: s.id,
        }));

    const todas = [...ordenes, ...serviciosKanban];

    const colConfigs = {
        recepcion: { title: 'Recepción', icon: '📥', type: 'recepcion', estados: ['recepcion'] },
        diagnostico: { title: 'Diagnóstico', icon: '🔬', type: 'diagnostico', estados: ['diagnostico'] },
        esperando: { title: 'Esperando Aprob.', icon: '⏳', type: 'esperando_aprobacion', estados: ['esperando_aprobacion'] },
        en_taller: { title: 'En Taller', icon: '🔧', type: 'en_taller', estados: ['en_taller'] },
        retirar: { title: 'Para Retirar', icon: '📦', type: 'retirar', estados: ['retirar'] },
        retirado: { title: 'Retirados', icon: '✔️', type: 'retirado', estados: ['retirado'] },
        rechazado: { title: 'Rechazados', icon: '❌', type: 'rechazado', estados: ['rechazado'] },
    };

    let colsToShow;
    if (role === 'recepcion') {
        colsToShow = ['recepcion', 'diagnostico', 'esperando', 'en_taller', 'retirar', 'retirado', 'rechazado'];
    } else if (role === 'tecnico') {
        colsToShow = ['recepcion', 'diagnostico', 'esperando', 'en_taller', 'retirar'];
    } else {
        colsToShow = ['recepcion', 'diagnostico', 'esperando', 'en_taller', 'retirar', 'retirado', 'rechazado'];
    }

    const columns = colsToShow.map(key => {
        const config = colConfigs[key];
        const cards = todas
            .filter(o => config.estados.includes(o.estado))
            .map(o => {
                const precio = o.diagnostico ? o.diagnostico.total : o.precio;
                let priceText = precio > 0 ? formatCurrency(precio) : 'Pendiente';
                if (o.estado === 'esperando_aprobacion') priceText = 'Esperando OK';
                if (o.estado === 'rechazado') priceText = 'Rechazado';
                const domBadge = o.servicioDomicilio ? ' 🏠' : '';
                return {
                    id: o.id,
                    title: o.equipo + domBadge,
                    client: o.cliente.split(' ')[0] + ' ' + (o.cliente.split(' ')[1] || '').charAt(0) + '.',
                    price: priceText,
                    date: o.fechaIngreso,
                    demora: false,
                    servicioDomicilio: o.servicioDomicilio || false,
                    servicioDomicilioId: o.servicioDomicilioId || null,
                };
            });
        return { ...config, cards };
    });

    return columns;
}

function getKpisByRole(role) {
    const ordenes = getOrdenes();
    const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
    const idsConOrden = new Set(ordenes.filter(o => o.servicioDomicilioId).map(o => o.servicioDomicilioId));
    const serviciosSinOrden = serviciosDom.filter(s => s.estado !== 'cancelado' && !idsConOrden.has(s.id));
    const allItems = [...ordenes, ...serviciosSinOrden];
    const enTaller = allItems.filter(o => {
        const e = o.estado;
        return ['recepcion', 'diagnostico', 'esperando_aprobacion', 'en_taller'].includes(e) ||
            ['pendiente', 'asignado', 'en_curso', 'pendiente_seguimiento'].includes(e);
    }).length;
    const enDiagnostico = allItems.filter(o => {
        const e = o.estado;
        return e === 'diagnostico' || e === 'esperando_aprobacion' || e === 'en_curso';
    }).length;
    const paraRetirar = allItems.filter(o => o.estado === 'retirar' || o.estado === 'completado').length;
    const retirados = ordenes.filter(o => o.estado === 'retirado').length + serviciosSinOrden.filter(s => s.estado === 'facturado').length;
    const totalIngresosOrdenes = ordenes.filter(o => o.diagnostico?.aprobado === true).reduce((sum, o) => sum + (o.diagnostico?.total || 0), 0);
    const facturasPagadas = JSON.parse(localStorage.getItem('servieltec_facturas') || '[]').filter(f => f.estado === 'pagada').reduce((sum, f) => sum + (f.monto || 0), 0);
    const totalIngresos = totalIngresosOrdenes + facturasPagadas;

    if (role === 'recepcion') {
        return [
            { icon: 'clipboard-list', label: 'Recibidas Hoy', value: allItems.filter(o => o.estado === 'recepcion').length.toString(), sub: 'En recepción' },
            { icon: 'search', label: 'En Diagnóstico', value: allItems.filter(o => o.estado === 'diagnostico').length.toString(), sub: 'Siendo revisadas' },
            { icon: 'clock', label: 'Esperando Aprob.', value: allItems.filter(o => o.estado === 'esperando_aprobacion').length.toString(), sub: 'Presupuestos enviados' },
            { icon: 'check-circle', label: 'Para Retirar', value: paraRetirar.toString(), sub: paraRetirar > 0 ? 'Listos' : 'Ninguna' },
        ];
    }
    if (role === 'tecnico') {
        return [
            { icon: 'search', label: 'En Diagnóstico', value: allItems.filter(o => o.estado === 'diagnostico' || o.estado === 'en_curso').length.toString(), sub: 'Pendientes' },
            { icon: 'clock', label: 'Esperando Aprob.', value: allItems.filter(o => o.estado === 'esperando_aprobacion').length.toString(), sub: 'Presupuestos' },
            { icon: 'wrench', label: 'En Taller', value: allItems.filter(o => o.estado === 'en_taller' || o.estado === 'pendiente_seguimiento').length.toString(), sub: 'Reparando' },
            { icon: 'check-circle', label: 'Para Retirar', value: paraRetirar.toString(), sub: 'Completados' },
        ];
    }
    return [
        { icon: 'wrench', label: 'En Taller', value: enTaller.toString(), sub: `${ordenes.length} totales` },
        { icon: 'search', label: 'En Diagnóstico', value: enDiagnostico.toString(), sub: 'Pendientes' },
        { icon: 'check-circle', label: 'Para Retirar', value: paraRetirar.toString(), sub: paraRetirar > 0 ? 'Hay equipos' : 'Ninguno' },
        { icon: 'dollar-sign', label: 'Ingresos Total', value: formatCurrency(totalIngresos), sub: 'Aprobados' },
    ];
}

const VALID_TRANSITIONS = {
    recepcion: ['diagnostico'],
    diagnostico: ['esperando_aprobacion'],
    esperando_aprobacion: ['en_taller', 'rechazado'],
    en_taller: ['retirar'],
    retirar: ['retirado'],
};

function handleCardMove(cardId, fromType, toType) {
    const ordenes = getOrdenes();
    let orden = ordenes.find(o => o.id === cardId || o.id === parseInt(cardId) || o.servicioDomicilioId === cardId);

    const allowed = VALID_TRANSITIONS[fromType];
    if (!allowed || !allowed.includes(toType)) {
        showToast(`No se puede mover de "${fromType}" a "${toType}"`, 'error');
        return;
    }

    const estadoToService = {
        recepcion: 'asignado',
        diagnostico: 'en_curso',
        esperando_aprobacion: 'pendiente_seguimiento',
        en_taller: 'pendiente_seguimiento',
        retirar: 'completado',
        retirado: 'facturado',
        rechazado: 'cancelado',
    };

    if (orden) {
        orden.estado = toType;
        if (orden.servicioDomicilioId) {
            const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
            const servicio = serviciosDom.find(s => s.id === orden.servicioDomicilioId);
            if (servicio && estadoToService[toType]) {
                servicio.estado = estadoToService[toType];
                localStorage.setItem('servieltec_servicios_domicilio', JSON.stringify(serviciosDom));
            }
        }
        notifyOrdenesChange({ action: 'kanban_move', id: cardId });
        showToast(`${orden.equipo} movido a ${toType}`, 'success');
    } else {
        const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
        const servicio = serviciosDom.find(s => s.id === cardId);
        if (servicio && estadoToService[toType]) {
            servicio.estado = estadoToService[toType];
            localStorage.setItem('servieltec_servicios_domicilio', JSON.stringify(serviciosDom));
            showToast(`${servicio.equipo.tipo} ${servicio.equipo.marca} movido a ${toType}`, 'success');
            window.dispatchEvent(new CustomEvent('ordenes-change', { detail: { action: 'kanban_move_service', id: cardId } }));
        }
    }
}

function handleCardClick(cardId, columnType) {
    let orden = getOrdenes().find(o => o.id === cardId || o.id === parseInt(cardId) || o.servicioDomicilioId === cardId);
    if (!orden) {
        const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
        const s = serviciosDom.find(x => x.id === cardId);
        if (s) {
            const ordenFromServ = getOrdenes().find(o => o.servicioDomicilioId === cardId);
            if (ordenFromServ) {
                orden = ordenFromServ;
            } else {
                window.location.hash = '#/servicios_domicilio';
                return;
            }
        } else {
            return;
        }
    }

    if (columnType === 'recepcion') {
        window.location.hash = '#/ordenes';
        setTimeout(() => {
            if (window.app.ordenes) window.app.ordenes.ver(orden.id);
        }, 300);
    } else if (columnType === 'diagnostico') {
        window.location.hash = '#/ordenes';
        setTimeout(() => {
            if (window.app.ordenes) window.app.ordenes.diagnosticar(orden.id);
        }, 300);
    } else if (columnType === 'esperando_aprobacion') {
        const content = `
            <div style="text-align:center;margin-bottom:16px;">
                <i class="fas fa-hourglass-half" style="font-size:40px;color:var(--color-warning);margin-bottom:8px;"></i>
                <h3>Esperando Aprobación</h3>
                <p style="color:var(--color-text-muted);font-size:13px;">Orden #${orden.id} - ${orden.equipo}</p>
            </div>
            <div style="padding:12px;background:var(--color-footer-bg);border-radius:8px;margin-bottom:16px;">
                <p><strong>Cliente:</strong> ${orden.cliente}</p>
                <p><strong>Equipo:</strong> ${orden.equipo}</p>
                <p><strong>Presupuesto:</strong> ${orden.diagnostico ? formatCurrency(orden.diagnostico.total) : 'Pendiente'}</p>
            </div>
            <div style="display:flex;gap:10px;">
                <button class="btn btn-primary" style="flex:1;background:#2e7d32;" onclick="window.app.dashboard.aprobarKanban(${orden.id})">
                    <i class="fas fa-check"></i> Aprobar
                </button>
                <button class="btn btn-danger" style="flex:1;" onclick="window.app.dashboard.rechazarKanban(${orden.id})">
                    <i class="fas fa-times"></i> Rechazar
                </button>
            </div>
        `;
        showModal('Presupuesto Pendiente', content);
    } else if (columnType === 'en_taller') {
        const content = `
            <div style="text-align:center;margin-bottom:16px;">
                <i class="fas fa-wrench" style="font-size:40px;color:var(--color-success);margin-bottom:8px;"></i>
                <h3>En Taller</h3>
                <p style="color:var(--color-text-muted);font-size:13px;">Orden #${orden.id} - ${orden.equipo}</p>
            </div>
            <div style="padding:12px;background:var(--color-footer-bg);border-radius:8px;margin-bottom:16px;">
                <p><strong>Cliente:</strong> ${orden.cliente}</p>
                <p><strong>Técnico:</strong> ${orden.tecnico}</p>
                <p><strong>Presupuesto:</strong> ${formatCurrency(orden.diagnostico?.total || 0)}</p>
            </div>
            <button class="btn btn-primary btn-block" style="background:#2e7d32;font-size:16px;padding:14px;" onclick="window.app.ordenes.equipoListo(${orden.id});document.getElementById('app-modal').classList.remove('active');">
                <i class="fas fa-check-circle"></i> Equipo Listo - Notificar Cliente
            </button>
        `;
        showModal('Reparación en Curso', content);
    } else if (columnType === 'retirar') {
        const content = `
            <div style="text-align:center;margin-bottom:16px;">
                <i class="fas fa-box" style="font-size:40px;color:var(--color-purple);margin-bottom:8px;"></i>
                <h3>Listo para Retirar</h3>
                <p style="color:var(--color-text-muted);font-size:13px;">Orden #${orden.id} - ${orden.equipo}</p>
            </div>
            <div style="padding:12px;background:var(--color-footer-bg);border-radius:8px;margin-bottom:16px;">
                <p><strong>Cliente:</strong> ${orden.cliente}</p>
                <p><strong>Total:</strong> ${formatCurrency(orden.diagnostico?.total || 0)}</p>
            </div>
            <button class="btn btn-primary btn-block" style="background:#2e7d32;font-size:16px;padding:14px;" onclick="window.app.dashboard.realizarFactura(${orden.id});">
                <i class="fas fa-file-invoice-dollar"></i> Realizar Factura
            </button>
        `;
        showModal('Entregar Equipo', content);
    } else {
        window.location.hash = '#/ordenes';
        setTimeout(() => {
            if (window.app.ordenes) window.app.ordenes.ver(orden.id);
        }, 300);
    }
}

export function setDashboardRole(role) {
    currentRole = role;
    window._currentRole = role;
    registerDashboardHandlers();
    const container = document.getElementById('dashboardDynamic');
    function refreshDashboard() {
        if (container) {
            container.innerHTML = renderDashboardContent(role);
            initKanban(handleCardMove, abrirNuevaOrden, handleCardClick);
        }
    }
    window.app.dashboard = {
        ...window.app.dashboard,
        aprobarOrden: (id) => {
            aprobarOrden(id);
            document.getElementById('app-modal')?.classList.remove('active');
            refreshDashboard();
        },
        rechazarOrden: (id) => {
            rechazarOrden(id);
            document.getElementById('app-modal')?.classList.remove('active');
            refreshDashboard();
        },
        aprobarKanban: (id) => {
            const o = getOrdenes().find(x => x.id === id || x.id === parseInt(id) || x.servicioDomicilioId === id);
            if (!o || !o.diagnostico) return;
            o.diagnostico.aprobado = true;
            o.estado = 'en_taller';
            o.precio = o.diagnostico.total;
            if (o.servicioDomicilioId) {
                const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
                const servicio = serviciosDom.find(s => s.id === o.servicioDomicilioId);
                if (servicio) {
                    servicio.estado = 'aprobado';
                    servicio.precio = o.diagnostico.total;
                    localStorage.setItem('servieltec_servicios_domicilio', JSON.stringify(serviciosDom));
                }
            }
            saveOrdenes();
            document.getElementById('app-modal')?.classList.remove('active');
            showToast(`Orden #${id} aprobada - En taller`, 'success');
            refreshDashboard();
        },
        rechazarKanban: (id) => {
            const o = getOrdenes().find(x => x.id === id || x.id === parseInt(id) || x.servicioDomicilioId === id);
            if (!o || !o.diagnostico) return;
            o.diagnostico.aprobado = false;
            o.estado = 'rechazado';
            o.precio = o.diagnostico.costoDiagnostico;
            if (o.servicioDomicilioId) {
                const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
                const servicio = serviciosDom.find(s => s.id === o.servicioDomicilioId);
                if (servicio) {
                    servicio.estado = 'rechazado';
                    servicio.precio = o.diagnostico.costoDiagnostico;
                    localStorage.setItem('servieltec_servicios_domicilio', JSON.stringify(serviciosDom));
                }
            }
            saveOrdenes();
            document.getElementById('app-modal')?.classList.remove('active');
            showToast(`Orden #${id} rechazada - Solo cobro diagnóstico`, 'error');
            refreshDashboard();
        },
        realizarFactura: (id) => {
            const o = getOrdenes().find(x => x.id === id || x.id === parseInt(id) || x.servicioDomicilioId === id);
            if (!o) return;
            mostrarFormularioFactura(o);
        },
    };
    if (container) {
        refreshDashboard();
    }
}

function renderDashboardContent(role) {
    const kpis = getKpisByRole(role);
    const kanbanData = buildKanbanFromOrders(role);

    let html = renderKpiGrid(kpis);

    html += renderKanban(kanbanData, handleCardMove, abrirNuevaOrden, handleCardClick);

    if (role === 'admin' || role === 'recepcion') {
        html += `
            <div class="legend-bar">
                <div class="legend-item"><span class="legend-dot" style="background:var(--color-accent);"></span> Recepcion</div>
                <div class="legend-item"><span class="legend-dot" style="background:var(--color-info);"></span> Diagnostico</div>
                <div class="legend-item"><span class="legend-dot" style="background:var(--color-warning);"></span> Esperando Aprob.</div>
                <div class="legend-item"><span class="legend-dot" style="background:var(--color-success);"></span> En Taller</div>
                <div class="legend-item"><span class="legend-dot" style="background:var(--color-purple);"></span> Retirar</div>
                <div class="legend-item"><span class="legend-dot" style="background:#4caf50;"></span> Retirados</div>
                <div class="legend-item"><span class="legend-dot" style="background:var(--color-danger);"></span> Rechazados</div>
            </div>
        `;
    }

    if (role === 'admin') {
        const chartData = [
            { label: 'Lun', value: 60000 }, { label: 'Mar', value: 90000 },
            { label: 'Mie', value: 45000 }, { label: 'Jue', value: 110000 },
            { label: 'Vie', value: 75000 }, { label: 'Sab', value: 130000 },
            { label: 'Dom', value: 50000 },
        ];
        html += renderBarChart(chartData, 'Ingresos ultimos 7 dias', '+12% vs semana pasada');
    }

    {
        const hoy = new Date();
        const hoyStr = hoy.toISOString().split('T')[0];

        const enGarantia = getOrdenes().filter(o => {
            if (o.estado !== 'retirado' || !o.fechaGarantia) return false;
            return o.fechaGarantia >= hoyStr;
        }).map(o => ({
            equipo: o.equipo,
            cliente: o.cliente,
            ref: o.servicioDomicilioId ? `Serv. Domicilio #${o.servicioDomicilioId}` : `Orden #${o.id}`,
            fechaGarantia: o.fechaGarantia,
            diasRestantes: Math.ceil((new Date(o.fechaGarantia) - hoy) / (1000 * 60 * 60 * 24)),
            esServicioDomicilio: !!o.servicioDomicilioId,
        }));

        if (enGarantia.length > 0) {
            html += `
                <div class="card" style="margin-top:20px;padding:0;overflow:hidden;">
                    <div class="card-header" style="background:linear-gradient(135deg,#e3f2fd 0%,#bbdefb 100%);">
                        <h3><i class="fas fa-shield-alt" style="color:#1565c0;"></i> Equipos en Garantía (${enGarantia.length})</h3>
                        <a href="#/garantias" style="font-size:13px;color:#1565c0;text-decoration:none;font-weight:600;">Ver todas →</a>
                    </div>
                    <div style="padding:0;">
                        ${enGarantia.map(item => {
                            const diasColor = item.diasRestantes <= 7 ? '#c62828' : item.diasRestantes <= 15 ? '#e65100' : '#2e7d32';
                            const badgeBg = item.diasRestantes <= 7 ? '#ffebee' : item.diasRestantes <= 15 ? '#fff3e0' : '#e8f5e9';
                            const domBadge = item.esServicioDomicilio ? ' <span style="font-size:10px;background:#e8eaf6;color:#1a237e;padding:1px 6px;border-radius:4px;margin-left:6px;">🏠 Domicilio</span>' : '';
                            return `
                            <div style="padding:12px 16px;border-bottom:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:center;">
                                <div>
                                    <strong>${item.equipo}</strong>${domBadge}
                                    <div style="font-size:12px;color:var(--color-text-muted);">${item.cliente} | ${item.ref}</div>
                                </div>
                                <div style="text-align:right;">
                                    <span class="badge" style="background:${badgeBg};color:${diasColor};font-weight:600;">${item.diasRestantes} días restantes</span>
                                    <div style="font-size:11px;color:var(--color-text-muted);margin-top:2px;">Vence: ${item.fechaGarantia}</div>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="card" style="margin-top:20px;padding:0;overflow:hidden;">
                    <div class="card-header" style="background:linear-gradient(135deg,#e3f2fd 0%,#bbdefb 100%);">
                        <h3><i class="fas fa-shield-alt" style="color:#1565c0;"></i> Equipos en Garantía</h3>
                        <a href="#/garantias" style="font-size:13px;color:#1565c0;text-decoration:none;font-weight:600;">Ver todas →</a>
                    </div>
                    <div style="padding:30px;text-align:center;color:var(--color-text-muted);">
                        <i class="fas fa-shield-alt" style="font-size:32px;margin-bottom:8px;opacity:0.3;"></i>
                        <p>No hay equipos en garantía actualmente</p>
                    </div>
                </div>
            `;
        }
    }

    return html;
}

export function renderDashboard() {
    currentRole = window._currentRole || 'admin';
    return `<div id="dashboardDynamic">${renderDashboardContent(currentRole)}</div>`;
}

export function initDashboard() {
    loadOrdenes();
    currentRole = window._currentRole || 'admin';
    window.app = window.app || {};
    registerDashboardHandlers();
    initKanban(handleCardMove, abrirNuevaOrden, handleCardClick);

    window._dashboardListener = () => {
        const container = document.getElementById('dashboardDynamic');
        if (container) {
            container.innerHTML = renderDashboardContent(currentRole);
            initKanban(handleCardMove, abrirNuevaOrden, handleCardClick);
        }
    };
    window.addEventListener('ordenes-change', window._dashboardListener);
    window.addEventListener('servicios-domicilio-change', window._dashboardListener);
}

function mostrarFormularioFactura(orden) {
    const total = orden.diagnostico?.total || orden.precio || 0;
    const content = `
        <div style="text-align:center;margin-bottom:16px;">
            <i class="fas fa-file-invoice-dollar" style="font-size:40px;color:var(--color-primary);margin-bottom:8px;"></i>
            <h3>Generar Factura</h3>
            <p style="color:var(--color-text-muted);font-size:13px;">Orden #${orden.id} - ${orden.equipo} - ${orden.cliente}</p>
            <p style="font-size:18px;font-weight:700;color:var(--color-primary);margin-top:8px;">Total: ${formatCurrency(total)}</p>
        </div>
        <div class="form-group">
            <label>Tipo de Factura *</label>
            <select class="form-control" id="facTipo">
                <option value="B">Factura B</option>
                <option value="A">Factura A</option>
            </select>
        </div>
        <div class="form-group">
            <label>Facturar a *</label>
            <select class="form-control" id="facDestino" onchange="document.getElementById('facClienteFields').style.display = this.value === 'cliente' ? 'block' : 'none';">
                <option value="consumidor">Consumidor Final</option>
                <option value="cliente">A nombre del Cliente</option>
            </select>
        </div>
        <div id="facClienteFields" style="display:none;">
            <div class="form-group">
                <label>Nombre del Cliente *</label>
                <input type="text" class="form-control" id="facNombreCliente" value="${orden.cliente}" placeholder="Nombre completo">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>CUIT/CUIL</label>
                    <input type="text" class="form-control" id="facCuit" placeholder="20-12345678-9">
                </div>
                <div class="form-group">
                    <label>Domicilio</label>
                    <input type="text" class="form-control" id="facDomicilio" placeholder="Dirección completa">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Condición IVA</label>
                    <select class="form-control" id="facCondIva">
                        <option value="Consumidor Final">Consumidor Final</option>
                        <option value="Monotributo">Monotributo</option>
                        <option value="Responsable Inscripto">Responsable Inscripto</option>
                        <option value="Exento">Exento</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Teléfono</label>
                    <input type="text" class="form-control" id="facTel" value="${orden.tel}" placeholder="Teléfono">
                </div>
            </div>
        </div>
        <div style="padding:12px;background:var(--color-footer-bg);border-radius:8px;margin-top:12px;">
            <p style="font-size:12px;color:var(--color-text-muted);margin:0;"><i class="fas fa-info-circle"></i> La factura se generará con los datos ingresados y se marcará la orden como retirada.</p>
        </div>
    `;
    showModal('Nueva Factura', content, () => {
        const tipo = document.getElementById('facTipo')?.value;
        const destino = document.getElementById('facDestino')?.value;
        const cuit = document.getElementById('facCuit')?.value?.trim() || '';
        const domicilio = document.getElementById('facDomicilio')?.value?.trim() || '';
        const condIva = document.getElementById('facCondIva')?.value || 'Consumidor Final';
        const nombreCliente = document.getElementById('facNombreCliente')?.value?.trim() || orden.cliente;

        if (destino === 'cliente' && !cuit) {
            showToast('Ingresá el CUIT/CUIL del cliente', 'error');
            return false;
        }

        const clienteNombre = destino === 'consumidor' ? 'Consumidor Final' : nombreCliente;
        const items = [];
        let montoTotal = 0;

        if (orden.diagnostico) {
            orden.diagnostico.repuestos.forEach(r => {
                items.push({ desc: r.nombre, precio: r.precio });
                montoTotal += r.precio;
            });
            items.push({ desc: 'Mano de obra', precio: orden.diagnostico.manoDeObra });
            montoTotal += orden.diagnostico.manoDeObra;
        } else {
            items.push({ desc: `Servicio de ${orden.tipo} - ${orden.equipo}`, precio: orden.precio || 0 });
            montoTotal = orden.precio || 0;
        }

        try {
            const facturas = JSON.parse(localStorage.getItem('servieltec_facturas') || '[]');
            const nuevaFactura = {
                id: `F-${String(facturas.length + 1).padStart(3, '0')}`,
                cliente: clienteNombre,
                tel: document.getElementById('facTel')?.value?.trim() || orden.tel,
                orden: orden.id,
                monto: montoTotal,
                estado: 'pagada',
                fecha: new Date().toISOString().split('T')[0],
                items,
                tipoFactura: tipo,
                cuit: cuit,
                domicilio: domicilio,
                condIva: condIva,
                notas: `Generada desde kanban. Orden #${orden.id}`,
            };
            facturas.unshift(nuevaFactura);
            localStorage.setItem('servieltec_facturas', JSON.stringify(facturas));
        } catch (e) {}

        orden.estado = 'retirado';
        orden.fechaRetirado = new Date().toISOString().split('T')[0];
        const fechaGar = new Date(orden.fechaRetirado);
        fechaGar.setDate(fechaGar.getDate() + 30);
        orden.fechaGarantia = fechaGar.toISOString().split('T')[0];
        orden.garantiaDias = 30;

        if (orden.servicioDomicilioId) {
            const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
            const servicio = serviciosDom.find(s => s.id === orden.servicioDomicilioId);
            if (servicio) {
                servicio.estado = 'facturado';
                servicio.precio = montoTotal;
                localStorage.setItem('servieltec_servicios_domicilio', JSON.stringify(serviciosDom));
            }
            localStorage.setItem('servieltec_ordenes', JSON.stringify(getOrdenes()));
        }

        document.getElementById('app-modal')?.classList.remove('active');
        showToast(`Factura generada - Orden #${orden.id} marcada como retirada`, 'success');
        window.dispatchEvent(new CustomEvent('ordenes-change'));
        refreshAnyView();

        setTimeout(() => generarTicket(orden, total, tipo, clienteNombre, cuit, domicilio), 500);
    });
}

function generarTicket(orden, total, tipo, cliente, cuit, domicilio) {
    const ticketHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Ticket - Orden #${orden.id}</title>
            <style>
                body { font-family: 'Courier New', monospace; max-width: 300px; margin: 0 auto; padding: 10px; font-size: 12px; color: #333; }
                .logo { text-align: center; margin-bottom: 10px; }
                .logo img { max-width: 180px; }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .line { border-top: 1px dashed #999; margin: 8px 0; }
                .row { display: flex; justify-content: space-between; margin: 3px 0; }
                .qr { text-align: center; margin-top: 10px; }
                .qr img { width: 100px; height: 100px; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <div class="logo">
                <img src="img/recorte.jpg" alt="ServiElitec">
            </div>
            <div class="center bold">MULTISERVICIOS SERVIELTEC</div>
            <div class="center" style="font-size:10px;">Reparación y Mantenimiento del Hogar</div>
            <div class="line"></div>
            <div class="center bold" style="font-size:14px;">TICKET N° ${orden.id}</div>
            <div class="line"></div>
            <div class="row"><span>Fecha:</span><span>${new Date().toLocaleDateString('es-AR')}</span></div>
            <div class="row"><span>Hora:</span><span>${new Date().toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'})}</span></div>
            <div class="row"><span>Factura:</span><span>${tipo} - ${cliente}</span></div>
            ${cuit ? `<div class="row"><span>CUIT:</span><span>${cuit}</span></div>` : ''}
            ${domicilio ? `<div class="row"><span>Domicilio:</span><span>${domicilio}</span></div>` : ''}
            <div class="line"></div>
            <div class="bold">Equipo: ${orden.equipo}</div>
            <div style="font-size:11px;">Tipo: ${orden.tipo}</div>
            <div class="line"></div>
            <div class="bold">DETALLE</div>
            ${orden.diagnostico ? orden.diagnostico.repuestos.map(r => `
                <div class="row"><span>${r.nombre}</span><span>${formatCurrency(r.precio)}</span></div>
            `).join('') : ''}
            <div class="row"><span>Mano de obra</span><span>${formatCurrency(orden.diagnostico?.manoDeObra || 0)}</span></div>
            <div class="line"></div>
            <div class="row bold" style="font-size:14px;"><span>TOTAL</span><span>${formatCurrency(total)}</span></div>
            <div class="line"></div>
            <div style="margin-top:8px;font-size:10px;">
                <div class="bold">GARANTÍA: 30 DÍAS</div>
                <div>Vigente hasta: ${orden.fechaGarantia || '-'}</div>
                <div style="margin-top:4px;">Cualquier problema durante este período será cubierto sin costo adicional.</div>
            </div>
            <div class="line"></div>
                <div class="qr" id="qrContainer" style="display:flex;justify-content:center;"></div>
            <div class="center" style="margin-top:8px;font-size:10px;">
                <div>¡Gracias por confiar en nosotros!</div>
                <div>Multiservicios ServiElitec</div>
            </div>
            <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>
            <script>
                new QRCode(document.getElementById("qrContainer"), {
                    text: "https://${window.location.host}${window.location.pathname}#/tracking/${orden.token}",
                    width: 100,
                    height: 100
                });
                setTimeout(() => window.print(), 500);
            <\/script>
        </body>
        </html>
    `;
    const ticketWindow = window.open('', '_blank');
    ticketWindow.document.write(ticketHtml);
    ticketWindow.document.close();
}

export function registerDashboardHandlers() {
    window.app = window.app || {};
    window.app.dashboard = {
        aprobarOrden: (id) => {
            aprobarOrden(id);
            document.getElementById('app-modal')?.classList.remove('active');
            setDashboardRole(currentRole);
        },
        rechazarOrden: (id) => {
            rechazarOrden(id);
            document.getElementById('app-modal')?.classList.remove('active');
            setDashboardRole(currentRole);
        },
        aprobarKanban: (id) => {
            const o = getOrdenes().find(x => x.id === id || x.id === parseInt(id) || x.servicioDomicilioId === id);
            if (!o || !o.diagnostico) return;
            o.diagnostico.aprobado = true;
            o.estado = 'en_taller';
            o.precio = o.diagnostico.total;
            if (o.servicioDomicilioId) {
                const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
                const servicio = serviciosDom.find(s => s.id === o.servicioDomicilioId);
                if (servicio) {
                    servicio.estado = 'aprobado';
                    servicio.precio = o.diagnostico.total;
                    localStorage.setItem('servieltec_servicios_domicilio', JSON.stringify(serviciosDom));
                }
            }
            saveOrdenes();
            document.getElementById('app-modal')?.classList.remove('active');
            showToast(`Orden #${id} aprobada - En taller`, 'success');
            refreshAnyView();
        },
        rechazarKanban: (id) => {
            const o = getOrdenes().find(x => x.id === id || x.id === parseInt(id) || x.servicioDomicilioId === id);
            if (!o || !o.diagnostico) return;
            o.diagnostico.aprobado = false;
            o.estado = 'rechazado';
            o.precio = o.diagnostico.costoDiagnostico;
            if (o.servicioDomicilioId) {
                const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
                const servicio = serviciosDom.find(s => s.id === o.servicioDomicilioId);
                if (servicio) {
                    servicio.estado = 'rechazado';
                    servicio.precio = o.diagnostico.costoDiagnostico;
                    localStorage.setItem('servieltec_servicios_domicilio', JSON.stringify(serviciosDom));
                }
            }
            saveOrdenes();
            document.getElementById('app-modal')?.classList.remove('active');
            showToast(`Orden #${id} rechazada - Solo cobro diagnóstico`, 'error');
            refreshAnyView();
        },
        realizarFactura: (id) => {
            const o = getOrdenes().find(x => x.id === id || x.id === parseInt(id) || x.servicioDomicilioId === id);
            if (!o) return;
            mostrarFormularioFactura(o);
        },
    };
}

function refreshAnyView() {
    const container = document.getElementById('dashboardDynamic');
    if (container) {
        container.innerHTML = renderDashboardContent(currentRole);
        initKanban(handleCardMove, abrirNuevaOrden, handleCardClick);
    }
    const ordenesBody = document.getElementById('ordenesBody');
    if (ordenesBody) {
        window.dispatchEvent(new CustomEvent('ordenes-change'));
    }
}

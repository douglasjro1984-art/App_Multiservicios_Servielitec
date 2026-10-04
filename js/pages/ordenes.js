import { formatCurrency, formatDate, showToast, showModal, confirmAction, generateId, loadImageBase64, COMPANY_NAME } from '../utils/helpers.js';
import { generarFacturaDesdeOrden } from './facturacion.js';

const COSTO_DIAGNOSTICO = 5000;
const DIAS_GARANTIA = 30;

const ordenesMock = [];

function _findOrden(id) {
    const numId = typeof id === 'string' ? parseInt(id) : id;
    return ordenesMock.find(x => x.id === id || x.id === numId || x.servicioDomicilioId === id) || null;
}

export function getOrdenes() {
    if (ordenesMock.length === 0) loadOrdenes();
    return ordenesMock;
}

export function saveOrdenes() {
    localStorage.setItem('servieltec_ordenes', JSON.stringify(ordenesMock));
}

export function loadOrdenes() {
    const data = JSON.parse(localStorage.getItem('servieltec_ordenes') || '[]');
    ordenesMock.length = 0;
    ordenesMock.push(...data);
}

export function notifyOrdenesChange(detail) {
    saveOrdenes();
    window.dispatchEvent(new CustomEvent('ordenes-change', { detail }));
}

const estadoLabels = {
    recepcion: 'Recepción',
    diagnostico: 'Diagnóstico',
    esperando_aprobacion: 'Esperando Aprobación',
    aprobado: 'Aprobado',
    rechazado: 'Rechazado',
    en_taller: 'En Taller',
    retirar: 'Listo para Retirar',
    retirado: 'Retirado',
};

const estadoBadge = {
    recepcion: 'badge-warning',
    diagnostico: 'badge-info',
    esperando_aprobacion: 'badge-warning',
    aprobado: 'badge-success',
    rechazado: 'badge-danger',
    en_taller: 'badge-success',
    retirar: 'badge-accent',
    retirado: 'badge-success',
};

let filtroActual = 'todos';
let ordenes = [...ordenesMock];
let currentRole = 'admin';

const filtrosByRole = {
    admin: [
        { key: 'todos', label: 'Todas', icon: 'fa-list' },
        { key: 'recepcion', label: 'Recepción', icon: 'fa-inbox' },
        { key: 'diagnostico', label: 'Diagnóstico', icon: 'fa-stethoscope' },
        { key: 'esperando_aprobacion', label: 'Esperando Aprob.', icon: 'fa-clock' },
        { key: 'en_taller', label: 'En Taller', icon: 'fa-wrench' },
        { key: 'retirar', label: 'Para Retirar', icon: 'fa-box' },
    ],
    recepcion: [
        { key: 'todos', label: 'Todas', icon: 'fa-list' },
        { key: 'recepcion', label: 'Recepción', icon: 'fa-inbox' },
        { key: 'esperando_aprobacion', label: 'Esperando Aprob.', icon: 'fa-clock' },
        { key: 'retirar', label: 'Para Retirar', icon: 'fa-box' },
        { key: 'retirado', label: 'Retirados', icon: 'fa-check-double' },
        { key: 'rechazado', label: 'Rechazados', icon: 'fa-times-circle' },
    ],
    tecnico: [
        { key: 'todos', label: 'Todas', icon: 'fa-list' },
        { key: 'diagnostico', label: 'Diagnóstico', icon: 'fa-stethoscope' },
        { key: 'esperando_aprobacion', label: 'Esperando Aprob.', icon: 'fa-clock' },
        { key: 'en_taller', label: 'En Taller', icon: 'fa-wrench' },
        { key: 'retirar', label: 'Para Retirar', icon: 'fa-box' },
    ],
};

export function setOrdenesRole(role) {
    currentRole = role;
    window.app = window.app || {};
    window.app.dashboard = window.app.dashboard || {};
    window.app.dashboard.aprobarKanban = (id) => {
        const o = _findOrden(id);
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
        filtrarOrdenes(filtroActual);
    };
    window.app.dashboard.rechazarKanban = (id) => {
        const o = _findOrden(id);
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
        filtrarOrdenes(filtroActual);
    };
    window.app.dashboard.realizarFactura = (id) => {
        window.location.hash = '#/facturacion';
        setTimeout(() => {
            showToast(`Orden #${id} - Generá la factura desde Facturación`, 'info');
        }, 500);
    };
    filtroActual = 'todos';
    renderFilters();
    filtrarOrdenes('todos');
}

function renderFilters() {
    const bar = document.querySelector('.filters-bar');
    if (!bar) return;
    const filtros = filtrosByRole[currentRole] || filtrosByRole.admin;
    bar.innerHTML = filtros.map(f =>
        `<button class="filter-chip${f.key === filtroActual ? ' active' : ''}" data-filtro="${f.key}"><i class="fas ${f.icon}"></i> ${f.label}</button>`
    ).join('');
    bar.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => filtrarOrdenes(chip.dataset.filtro));
    });
}

function getTrackingUrl(orden) {
    const base = window.location.origin + window.location.pathname;
    return `${base}#/tracking/${orden.token}`;
}

function getWhatsAppLink(orden, mensaje) {
    const msg = encodeURIComponent(mensaje);
    return `https://wa.me/${orden.tel}?text=${msg}`;
}

function getMensajeInicial(orden) {
    const fotosTxt = orden.fotos?.length > 0
        ? `\n📸 *Fotos registradas:* ${orden.fotos.length} imagen(es) del equipo`
        : '';
    return (
        `Hola ${orden.cliente}! 👋\n\n` +
        `✅ Tu equipo fue recibido en *Servieltec*.\n\n` +
        `📋 *Orden:* #${orden.id}\n` +
        `📱 *Equipo:* ${orden.equipo}\n` +
        `🔧 *Tipo:* ${orden.tipo}\n` +
        `📝 *Problema:* ${orden.notas || 'Sin descripción'}\n` +
        `${fotosTxt}\n` +
        `📅 *Fecha de ingreso:* ${orden.fechaIngreso}\n\n` +
        `📍 *Estado:* Recibido en recepción\n\n` +
        `Te iremos informando sobre el progreso.\n` +
        `Seguí tu orden: ${getTrackingUrl(orden)}\n\n` +
        `⚡ *Servieltec*`
    );
}

function getMensajeDiagnostico(orden) {
    const d = orden.diagnostico;
    let repuestosTxt = d.repuestos.map(r => `  • ${r.nombre}: ${formatCurrency(r.precio)}`).join('\n');
    return (
        `Hola ${orden.cliente}! 👋\n\n` +
        `📋 *Presupuesto Orden #${orden.id}*\n\n` +
        `📱 *Equipo:* ${orden.equipo}\n\n` +
        `🔍 *Problema:*\n${d.problema}\n\n` +
        `🧩 *Repuestos:*\n${repuestosTxt}\n\n` +
        `👨‍🔧 *Mano de obra:* ${formatCurrency(d.manoDeObra)}\n` +
        `💰 *TOTAL:* ${formatCurrency(d.total)}\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `✅ Respondé *APROBAR* para avanzar\n` +
        `❌ Respondé *RECHAZAR* (solo cobro diagnóstico: ${formatCurrency(COSTO_DIAGNOSTICO)})\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `⚡ *Servieltec*`
    );
}

function getMensajeAprobado(orden) {
    return (
        `Hola ${orden.cliente}! ✅\n\n` +
        `¡Presupuesto aprobado!\n` +
        `Orden *#${orden.id}* - ${orden.equipo}\n` +
        `💰 Total: ${formatCurrency(orden.diagnostico.total)}\n\n` +
        `El técnico iniciará la reparación.\n` +
        `Seguí tu orden: ${getTrackingUrl(orden)}\n\n` +
        `⚡ *Servieltec*`
    );
}

function getMensajeRechazado(orden) {
    return (
        `Hola ${orden.cliente}.\n\n` +
        `Presupuesto rechazado - Orden *#${orden.id}*.\n` +
        `📱 ${orden.equipo}\n\n` +
        `💰 *Cobro diagnóstico:* ${formatCurrency(COSTO_DIAGNOSTICO)}\n\n` +
        `Podés retirar tu equipo abonando el diagnóstico.\n` +
        `📍 Av. Ejemplo 1234 | 📞 (011) 4567-8900\n\n` +
        `⚡ *Servieltec*`
    );
}

function getMensajeEquipoListo(orden) {
    const fechaHoy = new Date();
    const fechaLimite = new Date(fechaHoy);
    fechaLimite.setDate(fechaLimite.getDate() + 8);
    const fechaLimiteStr = fechaLimite.toLocaleDateString('es-AR');
    return (
        `Hola ${orden.cliente}! 🎉\n\n` +
        `✅ *¡Tu equipo está listo!*\n\n` +
        `📋 *Orden:* #${orden.id}\n` +
        `📱 *Equipo:* ${orden.equipo}\n` +
        `💰 *Total a abonar:* ${formatCurrency(orden.diagnostico?.total || orden.precio)}\n\n` +
        `📅 *Tenés hasta el ${fechaLimiteStr} para retirarlo.*\n\n` +
        `⚠️ *Importante:*\n` +
        `• Después de los 8 días se cobrará una *multa de $1.000 por día* de retraso.\n` +
        `• Pasados los *30 días*, no nos hacemos responsables del equipo.\n\n` +
        `📍 *Ubicación:* Av. Ejemplo 1234\n` +
        `📞 *Contacto:* (011) 4567-8900\n\n` +
        `Seguí tu orden: ${getTrackingUrl(orden)}\n\n` +
        `⚡ *Servieltec*`
    );
}

function filtrarOrdenes(filtro) {
    filtroActual = filtro;
    if (filtro === 'todos') ordenes = [...ordenesMock];
    else ordenes = ordenesMock.filter(o => o.estado === filtro);
    renderTabla();
    document.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.filtro === filtro);
    });
}

function renderTabla() {
    const tbody = document.getElementById('ordenesBody');
    if (!tbody) return;

    if (ordenes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-clipboard-list"></i><h3>Sin órdenes</h3><p>No hay órdenes en esta categoría</p></td></tr>`;
        return;
    }

    const isTecnico = currentRole === 'tecnico';
    const isRecepcion = currentRole === 'recepcion';

    tbody.innerHTML = ordenes.map(o => {
        let badgeExtra = '';
        if (o.estado === 'esperando_aprobacion') badgeExtra = '<div style="font-size:10px;color:var(--color-warning);margin-top:2px;">⏳ Esperando respuesta del cliente</div>';
        if (o.estado === 'rechazado') badgeExtra = '<div style="font-size:10px;color:var(--color-danger);margin-top:2px;">❌ Rechazado - Solo cobro diagnóstico</div>';
        if (o.servicioDomicilio) badgeExtra += '<div style="font-size:10px;color:var(--color-accent);margin-top:2px;"><i class="fas fa-home"></i> Domicilio</div>';

        let acciones = '';

        if (isTecnico) {
            if (o.estado === 'diagnostico') {
                acciones = `<button class="btn btn-sm btn-primary" onclick="window.app.ordenes.diagnosticar(${o.id})" title="Realizar diagnóstico"><i class="fas fa-stethoscope"></i> Diagnosticar</button>`;
            } else if (o.estado === 'en_taller') {
                acciones = `
                    <button class="btn btn-sm btn-primary" onclick="window.app.ordenes.completarOrdenTrabajo(${o.id})" title="Completar orden de trabajo" style="background:#e65100;"><i class="fas fa-clipboard-check"></i> Orden Trabajo</button>
                    <button class="btn btn-sm btn-primary" onclick="window.app.ordenes.equipoListo(${o.id})" title="Marcar equipo como listo" style="background:#2e7d32;"><i class="fas fa-check-circle"></i> Listo</button>
                `;
            } else {
                acciones = `<button class="btn btn-sm btn-outline" onclick="window.app.ordenes.ver(${o.id})" title="Ver detalle"><i class="fas fa-eye"></i></button>`;
            }
        } else if (isRecepcion) {
            if (o.estado === 'recepcion') {
                acciones = `
                    <button class="btn btn-sm btn-primary" onclick="window.app.ordenes.enviarDiagnostico(${o.id})" title="Enviar a Diagnóstico" style="background:#1565c0;"><i class="fas fa-arrow-right"></i> Diagnóstico</button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.ordenes.ver(${o.id})" title="Ver"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.ordenes.whatsapp(${o.id})" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>
                `;
            } else if (o.estado === 'esperando_aprobacion') {
                acciones = `
                    <button class="btn btn-sm btn-primary" onclick="window.app.ordenes.aprobar(${o.id})" title="Aprobar" style="background:#2e7d32;"><i class="fas fa-check"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="window.app.ordenes.rechazar(${o.id})" title="Rechazar"><i class="fas fa-times"></i></button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.ordenes.ver(${o.id})" title="Ver"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.ordenes.whatsapp(${o.id})" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>
                `;
            } else if (o.estado === 'retirar') {
                acciones = `
                    <button class="btn btn-sm btn-primary" onclick="window.app.dashboard.realizarFactura(${o.id})" title="Realizar Factura" style="background:#2e7d32;"><i class="fas fa-file-invoice-dollar"></i> Factura</button>
                    ${o.ordenTrabajo ? `<button class="btn btn-sm btn-primary" onclick="window.app.ordenes.enviarPDFCliente(${o.id})" title="Enviar PDF al cliente" style="background:#1565c0;"><i class="fas fa-file-pdf"></i> PDF</button>` : ''}
                    <button class="btn btn-sm btn-outline" onclick="window.app.ordenes.ver(${o.id})" title="Ver"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.ordenes.whatsapp(${o.id})" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>
                `;
            } else if (o.estado === 'retirado') {
                acciones = `
                    <span style="font-size:11px;color:var(--color-success);"><i class="fas fa-check-double"></i> Retirado</span>
                    <button class="btn btn-sm btn-outline" onclick="window.app.ordenes.ver(${o.id})" title="Ver"><i class="fas fa-eye"></i></button>
                `;
            } else {
                acciones = `
                    <button class="btn btn-sm btn-outline" onclick="window.app.ordenes.ver(${o.id})" title="Ver"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.ordenes.whatsapp(${o.id})" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.ordenes.editar(${o.id})" title="Editar"><i class="fas fa-edit"></i></button>
                `;
            }
        } else {
            acciones = `
                ${o.estado === 'esperando_aprobacion' ? `
                    <button class="btn btn-sm btn-primary" onclick="window.app.ordenes.aprobar(${o.id})" title="Aprobar" style="background:#2e7d32;"><i class="fas fa-check"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="window.app.ordenes.rechazar(${o.id})" title="Rechazar"><i class="fas fa-times"></i></button>
                ` : ''}
                ${o.estado === 'diagnostico' ? `<button class="btn btn-sm btn-primary" onclick="window.app.ordenes.diagnosticar(${o.id})" title="Diagnosticar"><i class="fas fa-stethoscope"></i></button>` : ''}
                ${o.diagnostico?.enviado && o.diagnostico?.aprobado === null ? `<button class="btn btn-sm btn-accent" onclick="window.app.ordenes.whatsappDiagnostico(${o.id})" title="Enviar WhatsApp"><i class="fab fa-whatsapp"></i></button>` : ''}
                ${o.ordenTrabajo ? `<button class="btn btn-sm btn-primary" onclick="window.app.ordenes.enviarPDFCliente(${o.id})" title="Enviar PDF al cliente" style="background:#1565c0;"><i class="fas fa-file-pdf"></i> PDF</button>` : ''}
                <button class="btn btn-sm btn-outline" onclick="window.app.ordenes.ver(${o.id})" title="Ver"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm btn-outline" onclick="window.app.ordenes.whatsapp(${o.id})" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>
                <button class="btn btn-sm btn-outline" onclick="window.app.ordenes.editar(${o.id})" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="window.app.ordenes.eliminar(${o.id})" title="Eliminar"><i class="fas fa-trash"></i></button>
            `;
        }

        return `
        <tr>
            <td><strong>#${o.id}</strong></td>
            <td>
                <div>${o.cliente}</div>
                <div style="font-size:11px;color:var(--color-text-muted);">${o.tel}</div>
            </td>
            <td>
                <div>${o.equipo}</div>
                ${o.fotos?.length > 0 ? `<div style="font-size:11px;color:var(--color-accent);"><i class="fas fa-camera"></i> ${o.fotos.length} foto(s)</div>` : ''}
            </td>
            <td>${o.tipo}</td>
            <td>
                <span class="badge ${estadoBadge[o.estado]}">${estadoLabels[o.estado]}</span>
                ${badgeExtra}
            </td>
            <td>${o.tecnico}</td>
            <td>
                <div style="display:flex;gap:4px;flex-wrap:wrap;">${acciones}</div>
            </td>
        </tr>`;
    }).join('');
}

export function renderOrdenes() {
    return `
        <div class="page-header">
            <h2><i class="fas fa-clipboard-list" style="color:var(--color-accent);"></i> Órdenes de Servicio</h2>
            <div class="actions">
                <div class="search-bar">
                    <i class="fas fa-search"></i>
                    <input type="text" placeholder="Buscar orden..." id="searchOrden">
                </div>
                <button class="btn btn-primary" id="btnNuevaOrdenPage"><i class="fas fa-plus"></i> Nueva Orden</button>
            </div>
        </div>
        <div class="filters-bar"></div>
        <div class="card" style="padding:0;overflow:hidden;">
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th># Orden</th>
                            <th>Cliente</th>
                            <th>Equipo</th>
                            <th>Tipo</th>
                            <th>Estado</th>
                            <th>Técnico</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="ordenesBody"></tbody>
                </table>
            </div>
        </div>
    `;
}

export function initOrdenes() {
    loadOrdenes();
    currentRole = window._currentRole || 'admin';
    window.app = window.app || {};
    window.app.dashboard = window.app.dashboard || {};
    window.app.dashboard.aprobarKanban = (id) => {
        const o = _findOrden(id);
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
        filtrarOrdenes(filtroActual);
    };
    window.app.dashboard.rechazarKanban = (id) => {
        const o = _findOrden(id);
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
        filtrarOrdenes(filtroActual);
    };
    window.app.dashboard.realizarFactura = (id) => {
        window.location.hash = '#/facturacion';
        setTimeout(() => {
            showToast(`Orden #${id} - Generá la factura desde Facturación`, 'info');
        }, 500);
    };
    renderFilters();
    renderTabla();

    const searchInput = document.getElementById('searchOrden');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            ordenes = ordenesMock.filter(o =>
                o.cliente.toLowerCase().includes(term) ||
                o.equipo.toLowerCase().includes(term) ||
                o.id.toString().includes(term) ||
                o.tel.includes(term)
            );
            renderTabla();
        });
    }

    document.getElementById('btnNuevaOrdenPage')?.addEventListener('click', () => mostrarFormularioOrden());

    window.app = window.app || {};
    window.app.ordenes = {
        ver: (id) => { const o = _findOrden(id); if (o) mostrarDetalleOrden(o); },
        editar: (id) => { const o = _findOrden(id); if (o) mostrarFormularioOrden(o); },
        diagnosticar: (id) => { const o = _findOrden(id); if (o) mostrarFormularioDiagnostico(o); },
        enviarDiagnostico: (id) => {
            const o = _findOrden(id);
            if (!o) return;
            o.estado = 'diagnostico';
            o.tecnico = 'Técnico Principal';
            filtrarOrdenes(filtroActual);
            notifyOrdenesChange({ action: 'enviar_diagnostico', id });
            showToast(`Orden #${id} enviada a Diagnóstico`, 'success');
        },
        equipoListo: (id) => { marcarEquipoListo(id); },
        completarOrdenTrabajo: (id) => { const o = _findOrden(id); if (o) mostrarFormularioOrdenTrabajo(o); },
        enviarPDFCliente: (id) => { const o = _findOrden(id); if (o) enviarPDFTrabajo(o); },
        retirado: (id) => { window.location.hash = '#/facturacion'; },
        whatsapp: (id) => {
            const o = _findOrden(id);
            if (o) { window.open(getWhatsAppLink(o, getMensajeInicial(o)), '_blank'); showToast('WhatsApp abierto', 'success'); }
        },
        whatsappDiagnostico: (id) => {
            const o = _findOrden(id);
            if (o) { window.open(getWhatsAppLink(o, getMensajeDiagnostico(o)), '_blank'); showToast('Presupuesto enviado por WhatsApp', 'success'); }
        },
        aprobar: (id) => { aprobarOrden(id); },
        rechazar: (id) => { rechazarOrden(id); },
        eliminar: async (id) => {
            const ok = await confirmAction('¿Eliminar esta orden?');
            if (ok) {
                const idx = ordenesMock.findIndex(x => x.id === id);
                if (idx > -1) ordenesMock.splice(idx, 1);
                filtrarOrdenes(filtroActual);
                notifyOrdenesChange({ action: 'eliminar', id });
                showToast('Orden eliminada', 'success');
            }
        }
    };

    window._ordenesListener = () => {
        const tbody = document.getElementById('ordenesBody');
        if (tbody) {
            ordenes = [...ordenesMock];
            filtrarOrdenes(filtroActual);
        }
    };
    window.addEventListener('ordenes-change', window._ordenesListener);
}

export function aprobarOrden(id) {
    const o = _findOrden(id);
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
    filtrarOrdenes(filtroActual);
    notifyOrdenesChange({ action: 'aprobar', id });
    showToast(`Orden #${id} aprobada - En taller`, 'success');
}

export function rechazarOrden(id) {
    const o = _findOrden(id);
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
    filtrarOrdenes(filtroActual);
    notifyOrdenesChange({ action: 'rechazar', id });
    showToast(`Orden #${id} rechazada - Solo cobro diagnóstico`, 'error');
}

function marcarEquipoListo(id) {
    const o = _findOrden(id);
    if (!o) return;
    o.estado = 'retirar';
    o.fechaNotificado = new Date().toISOString().split('T')[0];
    if (o.servicioDomicilioId) {
        const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
        const servicio = serviciosDom.find(s => s.id === o.servicioDomicilioId);
        if (servicio) {
            servicio.estado = 'completado';
            localStorage.setItem('servieltec_servicios_domicilio', JSON.stringify(serviciosDom));
        }
    }
    filtrarOrdenes(filtroActual);
    notifyOrdenesChange({ action: 'equipo_listo', id });
    window.open(getWhatsAppLink(o, getMensajeEquipoListo(o)), '_blank');
    showToast(`Orden #${id} lista - Notificación enviada a ${o.cliente}`, 'success');
}

function marcarRetirado(id) {
    const o = _findOrden(id);
    if (!o) return;
    o.estado = 'retirado';
    o.fechaRetirado = new Date().toISOString().split('T')[0];
    const fechaRetiro = new Date(o.fechaRetirado);
    fechaRetiro.setDate(fechaRetiro.getDate() + DIAS_GARANTIA);
    o.fechaGarantia = fechaRetiro.toISOString().split('T')[0];
    o.garantiaDias = DIAS_GARANTIA;
    if (o.servicioDomicilioId) {
        const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
        const servicio = serviciosDom.find(s => s.id === o.servicioDomicilioId);
        if (servicio) {
            servicio.estado = 'facturado';
            localStorage.setItem('servieltec_servicios_domicilio', JSON.stringify(serviciosDom));
        }
    }
    filtrarOrdenes(filtroActual);
    notifyOrdenesChange({ action: 'retirado', id });

    const factura = generarFacturaDesdeOrden(id);
    if (factura) {
        showToast(`Orden #${id} retirada - Factura ${factura.id} generada - Garantía ${DIAS_GARANTIA} días`, 'success');
    } else {
        showToast(`Orden #${id} marcada como retirada`, 'success');
    }
}

function mostrarDetalleOrden(o) {
    let diagnosticoHtml = '';
    if (o.diagnostico) {
        const d = o.diagnostico;
        const repuestosHtml = d.repuestos.map(r => `<tr><td>${r.nombre}</td><td style="text-align:right;">${formatCurrency(r.precio)}</td></tr>`).join('');

        let estadoAprob = '';
        let accionHtml = '';
        if (d.aprobado === true) {
            estadoAprob = '<span class="badge badge-success">Aprobado</span>';
        } else if (d.aprobado === false) {
            estadoAprob = '<span class="badge badge-danger">Rechazado</span>';
        } else {
            estadoAprob = '<span class="badge badge-warning">Esperando respuesta</span>';
            accionHtml = `
                <div style="display:flex;gap:8px;margin-top:12px;">
                    <button class="btn btn-primary" style="flex:1;background:#2e7d32;" onclick="window.app.ordenes.aprobar(${o.id});document.getElementById('app-modal').classList.remove('active');">
                        <i class="fas fa-check"></i> Aprobar
                    </button>
                    <button class="btn btn-danger" style="flex:1;" onclick="window.app.ordenes.rechazar(${o.id});document.getElementById('app-modal').classList.remove('active');">
                        <i class="fas fa-times"></i> Rechazar
                    </button>
                </div>
            `;
        }

        diagnosticoHtml = `
            <div style="margin-top:16px;">
                <h4 style="font-size:13px;color:var(--color-text-muted);margin-bottom:8px;border-bottom:1px solid var(--color-border);padding-bottom:6px;">DIAGNÓSTICO Y PRESUPUESTO</h4>
                <p style="font-size:13px;margin-bottom:8px;"><strong>Problema:</strong> ${d.problema}</p>
                <table class="data-table" style="margin-bottom:8px;">
                    <thead><tr><th>Repuesto</th><th style="text-align:right;">Precio</th></tr></thead>
                    <tbody>${repuestosHtml}
                        <tr><td>Mano de obra</td><td style="text-align:right;">${formatCurrency(d.manoDeObra)}</td></tr>
                        <tr style="font-weight:700;border-top:2px solid var(--color-border);"><td>TOTAL</td><td style="text-align:right;">${formatCurrency(d.total)}</td></tr>
                    </tbody>
                </table>
                <div style="display:flex;gap:8px;align-items:center;">
                    <strong>Estado:</strong> ${estadoAprob}
                    <span style="font-size:11px;color:var(--color-text-muted);">Diagnóstico: ${formatCurrency(COSTO_DIAGNOSTICO)}</span>
                </div>
                ${accionHtml}
            </div>
        `;
    }

    const fotosHtml = o.fotos?.length > 0
        ? `<div style="margin-top:16px;"><h4 style="font-size:13px;color:var(--color-text-muted);margin-bottom:8px;">FOTOS</h4><div style="display:flex;gap:8px;flex-wrap:wrap;">${o.fotos.map(f => `<img src="${f}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--color-border);">`).join('')}</div></div>`
        : '';

    showModal(`Orden #${o.id}`, `
        <div class="detail-grid">
            <div class="detail-card"><h4>Cliente</h4><p>${o.cliente}</p><p style="font-size:12px;color:var(--color-text-muted);">${o.tel}</p></div>
            <div class="detail-card"><h4>Equipo</h4><p>${o.equipo}</p><p style="font-size:12px;color:var(--color-text-muted);">${o.tipo}</p></div>
            <div class="detail-card"><h4>Estado</h4><p><span class="badge ${estadoBadge[o.estado]}">${estadoLabels[o.estado]}</span>${o.servicioDomicilio ? ' <span class="badge badge-accent"><i class="fas fa-home"></i> Domicilio</span>' : ''}</p></div>
            <div class="detail-card"><h4>Técnico</h4><p>${o.tecnico}</p></div>
            <div class="detail-card"><h4>Ingreso</h4><p>${o.fechaIngreso}</p></div>
            <div class="detail-card"><h4>Presupuesto</h4><p>${o.precio > 0 ? formatCurrency(o.precio) : (o.diagnostico ? formatCurrency(o.diagnostico.total) : 'Pendiente')}</p></div>
        </div>
        ${o.servicioDomicilio ? `
        <div style="margin-top:12px;padding:10px;background:#e8eaf6;border-radius:8px;font-size:13px;">
            <p style="margin:0 0 4px 0;font-weight:600;color:#1a237e;"><i class="fas fa-home"></i> SERVICIO A DOMICILIO</p>
            <p style="margin:0;font-size:12px;"><strong>Dirección:</strong> ${o.direccionDomicilio || '-'}</p>
            <p style="margin:0;font-size:12px;"><strong>Fecha:</strong> ${o.fechaServicioDomicilio || '-'}</p>
            <p style="margin:0;font-size:12px;"><strong>Hora:</strong> ${o.horaServicioDomicilio || 'A convenir'}</p>
        </div>` : ''}
        ${o.notas ? `<div style="margin-top:12px;padding:10px;background:var(--color-footer-bg);border-radius:8px;font-size:13px;color:var(--color-text-muted);"><i class="fas fa-info-circle"></i> ${o.notas}</div>` : ''}
        ${diagnosticoHtml}
        ${fotosHtml}
        ${o.ordenTrabajo ? `
        <div style="margin-top:16px;">
            <h4 style="font-size:13px;color:var(--color-text-muted);margin-bottom:8px;border-bottom:1px solid var(--color-border);padding-bottom:6px;"><i class="fas fa-clipboard-check"></i> ORDEN DE TRABAJO</h4>
            <p style="font-size:13px;margin-bottom:4px;"><strong>Trabajo:</strong> ${o.ordenTrabajo.trabajoRealizado}</p>
            <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:4px;"><strong>Tiempo:</strong> ${o.ordenTrabajo.tiempoEmpleado || '-'} | <strong>Fecha:</strong> ${o.ordenTrabajo.fechaCompletado}</p>
            ${o.ordenTrabajo.repuestosUtilizados?.length > 0 ? `<p style="font-size:12px;margin:4px 0;"><strong>Repuestos:</strong> ${o.ordenTrabajo.repuestosUtilizados.map(r => r.nombre + ' ($' + (r.precio * (r.cantidad || 1)).toLocaleString('es-AR') + ')').join(', ')}</p>` : ''}
            ${o.ordenTrabajo.pendientes?.length > 0 ? `<p style="font-size:12px;color:var(--color-warning);margin:4px 0;"><strong>Pendientes:</strong> ${o.ordenTrabajo.pendientes.join(', ')}</p>` : ''}
            ${o.ordenTrabajo.recomendaciones ? `<p style="font-size:12px;margin:4px 0;"><strong>Recomendaciones:</strong> ${o.ordenTrabajo.recomendaciones}</p>` : ''}
            <button class="btn btn-sm btn-primary" style="margin-top:8px;background:#1565c0;" onclick="window.app.ordenes.enviarPDFCliente(${o.id})"><i class="fas fa-file-pdf"></i> Enviar PDF al cliente</button>
        </div>` : ''}
        ${o.diagnostico?.enviado && o.diagnostico?.aprobado === null ? `
        <div style="margin-top:16px;padding:12px;background:#e3f2fd;border-radius:8px;">
            <p style="font-size:12px;font-weight:600;color:#1565c0;margin-bottom:6px;"><i class="fab fa-whatsapp"></i> Enviar presupuesto por WhatsApp:</p>
            <button class="btn btn-accent" onclick="window.app.ordenes.whatsappDiagnostico(${o.id})"><i class="fab fa-whatsapp"></> Enviar a ${o.cliente}</button>
        </div>` : ''}
        <div style="margin-top:16px;padding:12px;background:#e8f5e9;border-radius:8px;">
            <p style="font-size:12px;font-weight:600;color:#2e7d32;margin-bottom:6px;"><i class="fas fa-link"></i> Link de seguimiento:</p>
            <div style="display:flex;gap:4px;align-items:center;">
                <input type="text" class="form-control" value="${getTrackingUrl(o)}" readonly style="font-size:11px;flex:1;">
                <button class="btn btn-sm btn-outline" onclick="navigator.clipboard.writeText('${getTrackingUrl(o)}');showToast('Copiado!');"><i class="fas fa-copy"></i></button>
            </div>
        </div>
        ${o.estado === 'retirado' && o.fechaGarantia ? `
        <div style="margin-top:12px;padding:12px;background:#e3f2fd;border-radius:8px;">
            <p style="font-size:12px;font-weight:600;color:#1565c0;margin-bottom:6px;"><i class="fas fa-shield-alt"></i> GARANTÍA</p>
            <p style="font-size:13px;margin:0;"><strong>Retirado:</strong> ${o.fechaRetirado}</p>
            <p style="font-size:13px;margin:0;"><strong>Vigente hasta:</strong> ${o.fechaGarantia} (${o.garantiaDias || DIAS_GARANTIA} días)</p>
            <p style="font-size:12px;color:var(--color-text-muted);margin-top:4px;">Cualquier problema durante este período será cubierto sin costo adicional.</p>
        </div>` : ''}
    `);
}

function mostrarFormularioDiagnostico(orden) {
    const d = orden.diagnostico || {};
    const content = `
        <div style="padding:10px;background:#fff3e0;border-radius:8px;font-size:12px;color:#e65100;margin-bottom:16px;">
            <i class="fas fa-info-circle"></i> Al enviar, se abrirá WhatsApp para que el cliente responda APROBAR o RECHAZAR.
        </div>
        <div class="form-group">
            <label>Equipo</label>
            <input type="text" class="form-control" value="${orden.equipo} - ${orden.tipo}" readonly style="background:var(--color-footer-bg);">
        </div>
        <div class="form-group">
            <label>Problema encontrado *</label>
            <textarea class="form-control" id="diagProblema" rows="3" placeholder="Describa el problema...">${d.problema || ''}</textarea>
        </div>
        <div class="form-group">
            <label>Repuestos necesarios</label>
            <div id="repuestosList">
                ${(d.repuestos || [{ nombre: '', precio: 0 }]).map((r, i) => `
                    <div class="form-row" style="margin-bottom:8px;">
                        <div class="form-group" style="margin-bottom:0;flex:2;">
                            <input type="text" class="form-control diag-rep-nombre" value="${r.nombre}" placeholder="Repuesto">
                        </div>
                        <div class="form-group" style="margin-bottom:0;flex:1;">
                            <input type="number" class="form-control diag-rep-precio" value="${r.precio || ''}" placeholder="Precio">
                        </div>
                        ${i > 0 ? `<button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.form-row').remove()"><i class="fas fa-times"></i></button>` : ''}
                    </div>
                `).join('')}
            </div>
            <button type="button" class="btn btn-sm btn-outline" id="btnAddRepuesto" style="margin-top:4px;"><i class="fas fa-plus"></i> Agregar</button>
        </div>
        <div class="form-group">
            <label>Mano de obra *</label>
            <input type="number" class="form-control" id="diagManoDeObra" value="${d.manoDeObra || ''}" placeholder="0">
        </div>
        <div style="padding:12px;background:var(--color-footer-bg);border-radius:8px;">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
                <span>Diagnóstico (si rechaza):</span><strong>${formatCurrency(COSTO_DIAGNOSTICO)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:var(--color-primary);">
                <span>TOTAL:</span><span id="diagTotal">${d.total ? formatCurrency(d.total) : '$0'}</span>
            </div>
        </div>
    `;
    showModal(`Diagnóstico - Orden #${orden.id}`, content, () => {
        const problema = document.getElementById('diagProblema')?.value?.trim();
        if (!problema) { showToast('Describí el problema', 'error'); return; }

        const repuestos = [];
        document.querySelectorAll('#repuestosList .form-row').forEach(row => {
            const nombre = row.querySelector('.diag-rep-nombre')?.value?.trim();
            const precio = parseInt(row.querySelector('.diag-rep-precio')?.value) || 0;
            if (nombre) repuestos.push({ nombre, precio });
        });

        const manoDeObra = parseInt(document.getElementById('diagManoDeObra')?.value) || 0;
        const total = repuestos.reduce((sum, r) => sum + r.precio, 0) + manoDeObra;

        orden.diagnostico = {
            problema, repuestos, manoDeObra, total,
            costoDiagnostico: COSTO_DIAGNOSTICO,
            enviado: true, aprobado: null,
            fechaDiagnostico: new Date().toISOString().split('T')[0],
        };
        orden.estado = 'esperando_aprobacion';

        if (orden.servicioDomicilioId) {
            const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
            const servicio = serviciosDom.find(s => s.id === orden.servicioDomicilioId);
            if (servicio) {
                servicio.ordenTrabajo = {
                    trabajoRealizado: problema,
                    repuestosUtilizados: repuestos,
                    tiempoEmpleado: '',
                    observaciones: '',
                    pendientes: [],
                    recomendaciones: '',
                    fechaCompletado: new Date().toISOString().split('T')[0],
                };
                servicio.precio = total;
                servicio.estado = 'pendiente_seguimiento';
                localStorage.setItem('servieltec_servicios_domicilio', JSON.stringify(serviciosDom));
            }
        }

        filtrarOrdenes(filtroActual);
        notifyOrdenesChange({ action: 'diagnostico', id: orden.id });

        setTimeout(() => {
            window.open(getWhatsAppLink(orden, getMensajeDiagnostico(orden)), '_blank');
            showToast('WhatsApp abierto - Esperando respuesta del cliente', 'success');
        }, 500);
    });

    setTimeout(() => {
        document.getElementById('btnAddRepuesto')?.addEventListener('click', () => {
            const list = document.getElementById('repuestosList');
            const row = document.createElement('div');
            row.className = 'form-row';
            row.style.marginBottom = '8px';
            row.innerHTML = `
                <div class="form-group" style="margin-bottom:0;flex:2;"><input type="text" class="form-control diag-rep-nombre" placeholder="Repuesto"></div>
                <div class="form-group" style="margin-bottom:0;flex:1;"><input type="number" class="form-control diag-rep-precio" placeholder="Precio"></div>
                <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.form-row').remove()"><i class="fas fa-times"></i></button>
            `;
            list.appendChild(row);
        });

        const calcularTotal = () => {
            const precios = [...document.querySelectorAll('.diag-rep-precio')].map(el => parseInt(el.value) || 0);
            const mano = parseInt(document.getElementById('diagManoDeObra')?.value) || 0;
            document.getElementById('diagTotal').textContent = formatCurrency(precios.reduce((a, b) => a + b, 0) + mano);
        };
        document.querySelectorAll('.diag-rep-precio, #diagManoDeObra').forEach(el => el.addEventListener('input', calcularTotal));
    }, 100);
}

function mostrarFormularioOrden(orden = null) {
    const title = orden ? 'Editar Orden' : 'Nueva Orden';
    const clientes = JSON.parse(localStorage.getItem('servieltec_clientes') || '[]');
    const clientesOptions = clientes.map(c => `<option value="${c.id}" data-nombre="${c.nombre}" data-tel="${c.tel}" data-email="${c.email}">${c.id} - ${c.nombre}</option>`).join('');

    const content = `
        <div class="form-group">
            <label><i class="fas fa-users"></i> Cliente registrado</label>
            <div style="display:flex;gap:8px;">
                <select class="form-control" id="foClienteSelect" style="flex:1;">
                    <option value="">— Seleccionar cliente existente —</option>
                    ${clientesOptions}
                </select>
                <button type="button" class="btn btn-outline btn-sm" id="btnNuevoClienteOrden" style="white-space:nowrap;"><i class="fas fa-user-plus"></i> Nuevo</button>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Cliente *</label><input type="text" class="form-control" id="foCliente" value="${orden?.cliente || ''}" placeholder="Nombre completo"></div>
            <div class="form-group"><label>Teléfono (con código) *</label><input type="tel" class="form-control" id="foTel" value="${orden?.tel || ''}" placeholder="5491155550000"><small style="font-size:11px;color:var(--color-text-muted);">Ej: 5491155551234</small></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Email</label><input type="email" class="form-control" id="foEmail" value="${orden?.email || ''}" placeholder="cliente@email.com"></div>
            <div class="form-group"><label>Tipo</label>
                <select class="form-control" id="foTipo">
                    <option value="Electrodoméstico" ${orden?.tipo === 'Electrodoméstico' ? 'selected' : ''}>Electrodoméstico</option>
                    <option value="Electrónica" ${orden?.tipo === 'Electrónica' ? 'selected' : ''}>Electrónica</option>
                    <option value="Celular" ${orden?.tipo === 'Celular' ? 'selected' : ''}>Celular</option>
                    <option value="Computación" ${orden?.tipo === 'Computación' ? 'selected' : ''}>Computación</option>
                    <option value="Audio" ${orden?.tipo === 'Audio' ? 'selected' : ''}>Audio</option>
                    <option value="Climatización" ${orden?.tipo === 'Climatización' ? 'selected' : ''}>Climatización</option>
                    <option value="Otro">Otro</option>
                </select>
            </div>
        </div>
        <div class="form-group"><label>Equipo *</label><input type="text" class="form-control" id="foEquipo" value="${orden?.equipo || ''}" placeholder="Marca y modelo"></div>
        <div class="form-group"><label>Problema</label><textarea class="form-control" id="foNotas" rows="2" placeholder="Detalle...">${orden?.notas || ''}</textarea></div>
        <div style="padding:12px;background:var(--color-footer-bg);border-radius:8px;margin-bottom:12px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;font-size:13px;">
                <input type="checkbox" id="foServDomicilio" ${orden?.servicioDomicilio ? 'checked' : ''} style="width:18px;height:18px;">
                <i class="fas fa-home" style="color:var(--color-accent);"></i> Servicio a Domicilio
            </label>
            <div id="camposDomicilio" style="display:${orden?.servicioDomicilio ? 'block' : 'none'};margin-top:12px;">
                <div class="form-group" style="margin-bottom:8px;"><label style="font-size:12px;">Dirección del domicilio *</label><input type="text" class="form-control" id="foDireccionDom" value="${orden?.direccionDomicilio || ''}" placeholder="Dirección completa del domicilio"></div>
                <div class="form-row" style="margin-bottom:0;">
                    <div class="form-group" style="margin-bottom:0;"><label style="font-size:12px;">Fecha preferida</label><input type="date" class="form-control" id="foFechaDom" value="${orden?.fechaServicioDomicilio || ''}"></div>
                    <div class="form-group" style="margin-bottom:0;"><label style="font-size:12px;">Hora preferida</label>
                        <select class="form-control" id="foHoraDom">
                            <option value="">A convenir</option>
                            <option value="08:00-10:00" ${orden?.horaServicioDomicilio === '08:00-10:00' ? 'selected' : ''}>08:00 - 10:00</option>
                            <option value="10:00-12:00" ${orden?.horaServicioDomicilio === '10:00-12:00' ? 'selected' : ''}>10:00 - 12:00</option>
                            <option value="12:00-14:00" ${orden?.horaServicioDomicilio === '12:00-14:00' ? 'selected' : ''}>12:00 - 14:00</option>
                            <option value="14:00-16:00" ${orden?.horaServicioDomicilio === '14:00-16:00' ? 'selected' : ''}>14:00 - 16:00</option>
                            <option value="16:00-18:00" ${orden?.horaServicioDomicilio === '16:00-18:00' ? 'selected' : ''}>16:00 - 18:00</option>
                            <option value="18:00-20:00" ${orden?.horaServicioDomicilio === '18:00-20:00' ? 'selected' : ''}>18:00 - 20:00</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
        <div class="form-group">
            <label><i class="fas fa-camera"></i> Fotos</label>
            <div class="photo-upload-area">
                <div class="photo-preview-grid" id="photoGrid">${orden?.fotos?.map(f => `<div class="photo-thumb"><img src="${f}"><button class="photo-remove" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button></div>`).join('') || ''}</div>
                <div class="photo-actions">
                    <button type="button" class="btn btn-outline btn-sm" id="btnTakePhoto"><i class="fas fa-camera"></i> Foto</button>
                    <button type="button" class="btn btn-outline btn-sm" id="btnAddPhoto"><i class="fas fa-image"></i> Subir</button>
                </div>
                <input type="file" id="fileInput" accept="image/*" multiple style="display:none;">
                <input type="file" id="cameraInput" accept="image/*" capture="environment" style="display:none;">
            </div>
        </div>
    `;
    showModal(title, content, () => {
        const cliente = document.getElementById('foCliente')?.value?.trim();
        const tel = document.getElementById('foTel')?.value?.trim();
        const equipo = document.getElementById('foEquipo')?.value?.trim();
        if (!cliente || !tel || !equipo) { showToast('Completá Cliente, Teléfono y Equipo', 'error'); return; }

        const fotos = [];
        document.querySelectorAll('#photoGrid .photo-thumb img').forEach(img => fotos.push(img.src));

        const servDom = document.getElementById('foServDomicilio')?.checked;
        const extraDom = {
            servicioDomicilio: servDom || false,
            direccionDomicilio: servDom ? (document.getElementById('foDireccionDom')?.value?.trim() || '') : '',
            fechaServicioDomicilio: servDom ? (document.getElementById('foFechaDom')?.value || '') : '',
            horaServicioDomicilio: servDom ? (document.getElementById('foHoraDom')?.value || '') : '',
        };

        if (orden) {
            Object.assign(orden, { cliente, tel, email: document.getElementById('foEmail')?.value?.trim() || '', equipo, tipo: document.getElementById('foTipo')?.value || 'Otro', notas: document.getElementById('foNotas')?.value?.trim() || '', fotos, ...extraDom });
            notifyOrdenesChange({ action: 'editar', id: orden.id });
            showToast('Orden actualizada');
        } else {
            const newOrder = {
                id: Date.now(), token: generateId(), cliente, tel,
                email: document.getElementById('foEmail')?.value?.trim() || '',
                equipo, tipo: document.getElementById('foTipo')?.value || 'Otro',
                estado: 'recepcion', tecnico: '-', precio: 0,
                fechaIngreso: new Date().toISOString().split('T')[0],
                notas: document.getElementById('foNotas')?.value?.trim() || '',
                fotos, diagnostico: null, ordenTrabajo: null,
                ...extraDom,
            };
            ordenesMock.unshift(newOrder);
            notifyOrdenesChange({ action: 'crear', id: newOrder.id });
            showToast('Orden creada');
            setTimeout(() => window.open(getWhatsAppLink(newOrder, getMensajeInicial(newOrder)), '_blank'), 500);
        }
        filtrarOrdenes(filtroActual);
    });

    setTimeout(() => {
        const clienteSelect = document.getElementById('foClienteSelect');
        if (clienteSelect) {
            clienteSelect.addEventListener('change', () => {
                const option = clienteSelect.options[clienteSelect.selectedIndex];
                if (option.value) {
                    document.getElementById('foCliente').value = option.dataset.nombre || '';
                    document.getElementById('foTel').value = option.dataset.tel || '';
                    document.getElementById('foEmail').value = option.dataset.email || '';
                }
            });
        }

        document.getElementById('btnNuevoClienteOrden')?.addEventListener('click', () => {
            const content = `
                <div class="form-group">
                    <label>Nombre completo *</label>
                    <input type="text" class="form-control" id="regOrdenNombre" placeholder="Tu nombre completo">
                </div>
                <div class="form-group">
                    <label>Email *</label>
                    <input type="email" class="form-control" id="regOrdenEmail" placeholder="tu@email.com">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Teléfono *</label>
                        <input type="tel" class="form-control" id="regOrdenTel" placeholder="5491155550000">
                    </div>
                    <div class="form-group">
                        <label>Dirección *</label>
                        <input type="text" class="form-control" id="regOrdenDireccion" placeholder="Tu dirección completa">
                    </div>
                </div>
                <div class="form-group">
                    <label>Contraseña *</label>
                    <input type="password" class="form-control" id="regOrdenPassword" placeholder="Creá una contraseña">
                </div>
            `;
            showModal('Registrar Cliente', content, () => {
                const nombre = document.getElementById('regOrdenNombre')?.value?.trim();
                const email = document.getElementById('regOrdenEmail')?.value?.trim();
                const tel = document.getElementById('regOrdenTel')?.value?.trim();
                const direccion = document.getElementById('regOrdenDireccion')?.value?.trim();
                const password = document.getElementById('regOrdenPassword')?.value;

                if (!nombre || !email || !tel || !direccion || !password) {
                    showToast('Completá todos los campos', 'error');
                    return false;
                }

                const clientes = JSON.parse(localStorage.getItem('servieltec_clientes') || '[]');
                const existe = clientes.find(c => c.email.toLowerCase() === email.toLowerCase());
                if (existe) {
                    showToast(`El email ${email} ya está registrado como ${existe.id}`, 'error');
                    return false;
                }
                const num = clientes.length + 1;
                const nuevoId = 'CLI-' + String(num).padStart(4, '0');
                clientes.push({ id: nuevoId, nombre, email, tel, direccion, password, fechaRegistro: new Date().toISOString().split('T')[0] });
                localStorage.setItem('servieltec_clientes', JSON.stringify(clientes));

                document.getElementById('foCliente').value = nombre;
                document.getElementById('foTel').value = tel;
                document.getElementById('foEmail').value = email;

                showToast(`Cliente ${nuevoId} registrado y cargado`, 'success');
            });
        });

        const fileInput = document.getElementById('fileInput');
        const cameraInput = document.getElementById('cameraInput');
        const photoGrid = document.getElementById('photoGrid');
        document.getElementById('btnAddPhoto')?.addEventListener('click', () => fileInput?.click());
        document.getElementById('btnTakePhoto')?.addEventListener('click', () => cameraInput?.click());
        function handlePhotos(files) {
            Array.from(files).forEach(file => {
                if (!file.type.startsWith('image/')) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    const div = document.createElement('div');
                    div.className = 'photo-thumb';
                    div.innerHTML = `<img src="${e.target.result}"><button class="photo-remove" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
                    photoGrid?.appendChild(div);
                };
                reader.readAsDataURL(file);
            });
        }
        fileInput?.addEventListener('change', (e) => handlePhotos(e.target.files));
        cameraInput?.addEventListener('change', (e) => handlePhotos(e.target.files));

        const servDomCheck = document.getElementById('foServDomicilio');
        const camposDom = document.getElementById('camposDomicilio');
        if (servDomCheck && camposDom) {
            servDomCheck.addEventListener('change', () => {
                camposDom.style.display = servDomCheck.checked ? 'block' : 'none';
            });
        }
    }, 100);
}

export function approveOrder(token) {
    const o = ordenesMock.find(x => x.token === token);
    if (!o || !o.diagnostico) return null;
    o.diagnostico.aprobado = true;
    o.estado = 'en_taller';
    o.precio = o.diagnostico.total;
    return o;
}

export function rejectOrder(token) {
    const o = ordenesMock.find(x => x.token === token);
    if (!o || !o.diagnostico) return null;
    o.diagnostico.aprobado = false;
    o.estado = 'rechazado';
    o.precio = o.diagnostico.costoDiagnostico;
    return o;
}

export function getOrderByToken(token) {
    return ordenesMock.find(o => o.token === token);
}

export function getOrderByNumber(num) {
    return ordenesMock.find(o => o.id.toString() === num.toString());
}

export function abrirNuevaOrden() {
    mostrarFormularioOrden();
}

function mostrarFormularioOrdenTrabajo(orden) {
    const ot = orden.ordenTrabajo || {};
    const content = `
        <div style="padding:10px;background:#e8f5e9;border-radius:8px;font-size:12px;color:#2e7d32;margin-bottom:16px;">
            <i class="fas fa-info-circle"></i> Completá la orden de trabajo con todo lo realizado en el servicio${orden.servicioDomicilio ? ' (domicilio)' : ''}.
        </div>
        <div class="form-group">
            <label><strong>Trabajo realizado *</strong></label>
            <textarea class="form-control" id="otTrabajo" rows="3" placeholder="Describí detalladamente qué se hizo...">${ot.trabajoRealizado || ''}</textarea>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Tiempo empleado</label><input type="text" class="form-control" id="otTiempo" value="${ot.tiempoEmpleado || ''}" placeholder="Ej: 2 horas"></div>
            <div class="form-group"><label>Estado final</label>
                <select class="form-control" id="otEstadoFinal">
                    <option value="retirar" ${!ot.pendientes?.length ? 'selected' : ''}>Completado - Listo para entregar</option>
                    <option value="pendiente" ${ot.pendientes?.length ? 'selected' : ''}>Con pendientes</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label>Repuestos utilizados</label>
            <div id="otRepuestosList">
                ${(ot.repuestosUtilizados || [{ nombre: '', cantidad: 1, precio: 0 }]).map((r, i) => `
                    <div class="form-row" style="margin-bottom:8px;">
                        <div class="form-group" style="margin-bottom:0;flex:2;">
                            <input type="text" class="form-control ot-rep-nombre" value="${r.nombre}" placeholder="Repuesto">
                        </div>
                        <div class="form-group" style="margin-bottom:0;flex:0.5;">
                            <input type="number" class="form-control ot-rep-cant" value="${r.cantidad || 1}" min="1">
                        </div>
                        <div class="form-group" style="margin-bottom:0;flex:1;">
                            <input type="number" class="form-control ot-rep-precio" value="${r.precio || ''}" placeholder="Precio">
                        </div>
                        ${i > 0 ? `<button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.form-row').remove()"><i class="fas fa-times"></i></button>` : ''}
                    </div>
                `).join('')}
            </div>
            <button type="button" class="btn btn-sm btn-outline" id="btnAddRepOt" style="margin-top:4px;"><i class="fas fa-plus"></i> Agregar</button>
        </div>
        <div class="form-group">
            <label>Observaciones</label>
            <textarea class="form-control" id="otObservaciones" rows="2" placeholder="Observaciones generales...">${ot.observaciones || ''}</textarea>
        </div>
        <div class="form-group">
            <label>Pendientes</label>
            <div id="otPendientesList">
                ${(ot.pendientes || ['']).map((p, i) => `
                    <div class="form-row" style="margin-bottom:8px;">
                        <div class="form-group" style="margin-bottom:0;flex:1;">
                            <input type="text" class="form-control ot-pendiente" value="${p}" placeholder="Describe el pendiente...">
                        </div>
                        ${i > 0 ? `<button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.form-row').remove()"><i class="fas fa-times"></i></button>` : ''}
                    </div>
                `).join('')}
            </div>
            <button type="button" class="btn btn-sm btn-outline" id="btnAddPendiente" style="margin-top:4px;"><i class="fas fa-plus"></i> Agregar pendiente</button>
        </div>
        <div class="form-group">
            <label>Recomendaciones para el cliente</label>
            <textarea class="form-control" id="otRecomendaciones" rows="2" placeholder="Recomendaciones...">${ot.recomendaciones || ''}</textarea>
        </div>
    `;
    showModal(`Orden de Trabajo - Orden #${orden.id}`, content, () => {
        const trabajo = document.getElementById('otTrabajo')?.value?.trim();
        if (!trabajo) { showToast('Describí el trabajo realizado', 'error'); return false; }

        const repuestos = [];
        document.querySelectorAll('#otRepuestosList .form-row').forEach(row => {
            const nombre = row.querySelector('.ot-rep-nombre')?.value?.trim();
            const cantidad = parseInt(row.querySelector('.ot-rep-cant')?.value) || 1;
            const precio = parseInt(row.querySelector('.ot-rep-precio')?.value) || 0;
            if (nombre) repuestos.push({ nombre, cantidad, precio });
        });

        const pendientes = [];
        document.querySelectorAll('#otPendientesList .form-row').forEach(row => {
            const val = row.querySelector('.ot-pendiente')?.value?.trim();
            if (val) pendientes.push(val);
        });

        orden.ordenTrabajo = {
            trabajoRealizado: trabajo,
            repuestosUtilizados: repuestos,
            tiempoEmpleado: document.getElementById('otTiempo')?.value?.trim() || '',
            observaciones: document.getElementById('otObservaciones')?.value?.trim() || '',
            pendientes,
            recomendaciones: document.getElementById('otRecomendaciones')?.value?.trim() || '',
            fechaCompletado: new Date().toISOString().split('T')[0],
        };

        const nuevoEstado = document.getElementById('otEstadoFinal')?.value || 'retirar';
        orden.estado = nuevoEstado;

        const totalRepuestos = repuestos.reduce((sum, r) => sum + (r.precio * r.cantidad), 0);
        if (orden.diagnostico) {
            orden.precio = orden.diagnostico.total + totalRepuestos;
        }

        filtrarOrdenes(filtroActual);
        notifyOrdenesChange({ action: 'orden_trabajo', id: orden.id });
        showToast(`Orden de trabajo completada - Orden #${orden.id}`, 'success');
    });

    setTimeout(() => {
        document.getElementById('btnAddRepOt')?.addEventListener('click', () => {
            const list = document.getElementById('otRepuestosList');
            const row = document.createElement('div');
            row.className = 'form-row';
            row.style.marginBottom = '8px';
            row.innerHTML = `
                <div class="form-group" style="margin-bottom:0;flex:2;"><input type="text" class="form-control ot-rep-nombre" placeholder="Repuesto"></div>
                <div class="form-group" style="margin-bottom:0;flex:0.5;"><input type="number" class="form-control ot-rep-cant" value="1" min="1"></div>
                <div class="form-group" style="margin-bottom:0;flex:1;"><input type="number" class="form-control ot-rep-precio" placeholder="Precio"></div>
                <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.form-row').remove()"><i class="fas fa-times"></i></button>
            `;
            list.appendChild(row);
        });

        document.getElementById('btnAddPendiente')?.addEventListener('click', () => {
            const list = document.getElementById('otPendientesList');
            const row = document.createElement('div');
            row.className = 'form-row';
            row.style.marginBottom = '8px';
            row.innerHTML = `
                <div class="form-group" style="margin-bottom:0;flex:1;"><input type="text" class="form-control ot-pendiente" placeholder="Describe el pendiente..."></div>
                <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.form-row').remove()"><i class="fas fa-times"></i></button>
            `;
            list.appendChild(row);
        });
    }, 100);
}

async function generarPDFOrdenTrabajo(orden) {
    const ot = orden.ordenTrabajo;
    if (!ot) return null;

    const logoBase64 = await loadImageBase64('img/recorte.jpg');
    const fechaHoy = new Date().toLocaleDateString('es-AR');

    const repuestosHtml = ot.repuestosUtilizados?.length > 0
        ? ot.repuestosUtilizados.map(r => `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;">${r.nombre}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${r.cantidad || 1}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">$${(r.precio * (r.cantidad || 1)).toLocaleString('es-AR')}</td></tr>`).join('')
        : '<tr><td colspan="3" style="padding:8px;text-align:center;color:#999;">Sin repuestos</td></tr>';

    const totalRepuestos = ot.repuestosUtilizados?.reduce((sum, r) => sum + (r.precio * (r.cantidad || 1)), 0) || 0;

    const pendientesHtml = ot.pendientes?.length > 0
        ? `<ul style="margin:4px 0;padding-left:18px;">${ot.pendientes.map(p => `<li style="margin-bottom:4px;">${p}</li>`).join('')}</ul>`
        : '<p style="color:#666;margin:4px 0;">Sin pendientes</p>';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Orden de Trabajo #${orden.id}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; font-size: 13px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a237e; padding-bottom: 12px; margin-bottom: 16px; }
            .logo img { height: 50px; }
            .company-info { text-align: right; font-size: 11px; color: #666; }
            .section { margin-bottom: 14px; }
            .section-title { font-size: 12px; font-weight: 700; color: #1a237e; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
            .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .detail-item { margin-bottom: 4px; }
            .detail-label { font-size: 11px; color: #666; }
            .detail-value { font-size: 13px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            th { background: #f5f5f5; padding: 6px 8px; text-align: left; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #ddd; }
            .footer { margin-top: 20px; padding-top: 12px; border-top: 2px solid #1a237e; text-align: center; font-size: 11px; color: #666; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
            .badge-dom { background: #e8eaf6; color: #1a237e; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo"><img src="${logoBase64}" alt="${COMPANY_NAME}" style="height:50px;"></div>
            <div class="company-info">
                <strong>${COMPANY_NAME}</strong><br>
                Reparación y Mantenimiento<br>
                ${orden.servicioDomicilio ? '<span class="badge badge-dom"><i class="fas fa-home"></i> SERVICIO A DOMICILIO</span>' : ''}
            </div>
        </div>

        <div class="section">
            <div class="section-title">Datos del Cliente</div>
            <div class="detail-grid">
                <div class="detail-item"><div class="detail-label">Cliente</div><div class="detail-value">${orden.cliente}</div></div>
                <div class="detail-item"><div class="detail-label">Teléfono</div><div class="detail-value">${orden.tel}</div></div>
                <div class="detail-item"><div class="detail-label">Equipo</div><div class="detail-value">${orden.equipo} - ${orden.tipo}</div></div>
                <div class="detail-item"><div class="detail-label">Orden</div><div class="detail-value">#${orden.id}</div></div>
                ${orden.servicioDomicilio ? `<div class="detail-item"><div class="detail-label">Dirección</div><div class="detail-value">${orden.direccionDomicilio || '-'}</div></div>` : ''}
                ${orden.servicioDomicilio ? `<div class="detail-item"><div class="detail-label">Fecha servicio</div><div class="detail-value">${orden.fechaServicioDomicilio || '-'} ${orden.horaServicioDomicilio || ''}</div></div>` : ''}
            </div>
        </div>

        <div class="section">
            <div class="section-title">Orden de Trabajo</div>
            <div class="detail-item"><div class="detail-label">Trabajo Realizado</div><div class="detail-value" style="margin-top:4px;">${ot.trabajoRealizado}</div></div>
            <div class="detail-grid" style="margin-top:8px;">
                <div class="detail-item"><div class="detail-label">Tiempo Empleado</div><div class="detail-value">${ot.tiempoEmpleado || '-'}</div></div>
                <div class="detail-item"><div class="detail-label">Fecha</div><div class="detail-value">${ot.fechaCompletado}</div></div>
            </div>
        </div>

        ${ot.repuestosUtilizados?.length > 0 ? `
        <div class="section">
            <div class="section-title">Repuestos Utilizados</div>
            <table>
                <thead><tr><th style="text-align:left;">Repuesto</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Precio</th></tr></thead>
                <tbody>${repuestosHtml}
                    <tr style="font-weight:700;border-top:2px solid #1a237e;"><td colspan="2" style="padding:6px 8px;">TOTAL REPUESTOS</td><td style="padding:6px 8px;text-align:right;">$${totalRepuestos.toLocaleString('es-AR')}</td></tr>
                </tbody>
            </table>
        </div>` : ''}

        ${ot.observaciones ? `
        <div class="section">
            <div class="section-title">Observaciones</div>
            <p style="margin:4px 0;">${ot.observaciones}</p>
        </div>` : ''}

        <div class="section">
            <div class="section-title">Pendientes</div>
            ${pendientesHtml}
        </div>

        ${ot.recomendaciones ? `
        <div class="section">
            <div class="section-title">Recomendaciones</div>
            <p style="margin:4px 0;">${ot.recomendaciones}</p>
        </div>` : ''}

        <div class="footer">
            <p>${COMPANY_NAME}<br>
            Documento generado el ${fechaHoy}</p>
        </div>
    </body>
    </html>`;

    return html;
}

async function enviarPDFTrabajo(orden) {
    const html = await generarPDFOrdenTrabajo(orden);
    if (!html) { showToast('No hay orden de trabajo para enviar', 'error'); return; }

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
        win.onload = () => {
            win.print();
        };
    }

    const mensaje = `Hola ${orden.cliente}! 👋\n\n📋 *Orden de Trabajo #${orden.id}*\n📱 Equipo: ${orden.equipo}\n🔧 Trabajo: ${orden.ordenTrabajo.trabajoRealizado.substring(0, 100)}...\n\nSe te adjunta el PDF con el detalle completo.\n\n⚡ *${COMPANY_NAME}*`;
    setTimeout(() => {
        window.open(getWhatsAppLink(orden, mensaje), '_blank');
    }, 500);

    showToast('PDF generado y WhatsApp abierto', 'success');
}

setTimeout(() => {
    window.app = window.app || {};
    window.app.nuevaOrden = () => mostrarFormularioOrden();
}, 0);

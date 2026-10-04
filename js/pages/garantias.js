import { formatCurrency, formatDate, showToast, showModal, confirmAction, generateId } from '../utils/helpers.js';
import { getOrdenes } from './ordenes.js';
import { getFacturas } from './facturacion.js';

const COSTO_DIAGNOSTICO = 5000;

const garantiasMock = [];

const estadoGarantiaLabels = {
    pendiente_revision: 'Pendiente Revisión',
    en_revision: 'En Revisión',
    esperando_aprobacion: 'Esperando Aprobación',
    cubierta: 'Cubierta - Prioridad Alta',
    no_cubierta: 'No Cubierta',
};

const estadoGarantiaBadge = {
    pendiente_revision: 'badge-warning',
    en_revision: 'badge-info',
    esperando_aprobacion: 'badge-warning',
    cubierta: 'badge-success',
    no_cubierta: 'badge-danger',
};

let filtroActual = 'todos';
let garantias = [...garantiasMock];
let currentRole = 'admin';

const filtrosByRole = {
    admin: [
        { key: 'todos', label: 'Todas', icon: 'fa-list' },
        { key: 'pendiente_revision', label: 'Pendientes', icon: 'fa-clock' },
        { key: 'en_revision', label: 'En Revisión', icon: 'fa-search' },
        { key: 'esperando_aprobacion', label: 'Esperando Aprob.', icon: 'fa-hourglass-half' },
        { key: 'cubierta', label: 'Cubiertas', icon: 'fa-check-circle' },
        { key: 'no_cubierta', label: 'No Cubiertas', icon: 'fa-times-circle' },
    ],
    recepcion: [
        { key: 'todos', label: 'Todas', icon: 'fa-list' },
        { key: 'pendiente_revision', label: 'Pendientes', icon: 'fa-clock' },
        { key: 'esperando_aprobacion', label: 'Esperando Aprob.', icon: 'fa-hourglass-half' },
        { key: 'cubierta', label: 'Cubiertas', icon: 'fa-check-circle' },
        { key: 'no_cubierta', label: 'No Cubiertas', icon: 'fa-times-circle' },
    ],
    tecnico: [
        { key: 'todos', label: 'Todas', icon: 'fa-list' },
        { key: 'en_revision', label: 'En Revisión', icon: 'fa-search' },
        { key: 'cubierta', label: 'Cubiertas', icon: 'fa-check-circle' },
    ],
};

export function setGarantiasRole(role) {
    currentRole = role;
    filtroActual = 'todos';
    renderFilters();
    filtrarGarantias('todos');
}

function renderFilters() {
    const bar = document.querySelector('.filters-bar');
    if (!bar) return;
    const filtros = filtrosByRole[currentRole] || filtrosByRole.admin;
    bar.innerHTML = filtros.map(f =>
        `<button class="filter-chip${f.key === filtroActual ? ' active' : ''}" data-filtro="${f.key}"><i class="fas ${f.icon}"></i> ${f.label}</button>`
    ).join('');
    bar.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => filtrarGarantias(chip.dataset.filtro));
    });
}

function getWhatsAppLink(g, mensaje) {
    const msg = encodeURIComponent(mensaje);
    return `https://wa.me/${g.tel}?text=${msg}`;
}

function getTrackingUrl(g) {
    return window.location.origin + window.location.pathname + `#/tracking/${g.ordenOriginal}`;
}

function getMensajeEsperandoAprobacion(g) {
    return (
        `Hola ${g.cliente}! 🔍\n\n` +
        `📋 *Revisión de Garantía - ${g.id}*\n\n` +
        `📱 *Equipo:* ${g.equipo}\n` +
        `📝 *Reclamo:* ${g.motivoGarantia}\n\n` +
        `✅ *Resultado:* Nuestro técnico verificó tu equipo y *SÍ cumple con la garantía*.\n\n` +
        `💰 La reparación se realizará *SIN COSTO* bajo garantía.\n\n` +
        `Prioridad: *ALTA* 🔴\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `✅ Respondé *APROBAR* para confirmar la reparación\n` +
        `❌ Respondé *RECHAZAR* si no deseas continuar\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `Seguí tu orden: ${getTrackingUrl(g)}\n\n` +
        `⚡ *Servieltec*`
    );
}

function getMensajeCubierta(g) {
    return (
        `Hola ${g.cliente}! ✅\n\n` +
        `📋 *Garantía Aprobada - ${g.id}*\n\n` +
        `📱 *Equipo:* ${g.equipo}\n\n` +
        `✅ Aprobaste la reparación bajo garantía.\n` +
        `💰 *Costo:* $0 (cubierto por garantía)\n\n` +
        `Nuestro técnico iniciará la reparación de forma inmediata.\n\n` +
        `Seguí tu orden: ${getTrackingUrl(g)}\n\n` +
        `⚡ *Servieltec*`
    );
}

function getMensajeNoCubierta(g, nuevoPresupuesto) {
    return (
        `Hola ${g.cliente}.\n\n` +
        `📋 *Garantía No Cubierta - ${g.id}*\n\n` +
        `📱 *Equipo:* ${g.equipo}\n` +
        `🔍 *Resultado:* Tu equipo *NO* cubre la garantía.\n\n` +
        `📝 *Motivo:* ${g.reDiagnostico?.motivoRechazo || 'El daño no corresponde a la garantía original.'}\n\n` +
        `💰 *Nuevo Presupuesto:*\n` +
        `${nuevoPresupuesto.repuestos.map(r => `  • ${r.nombre}: ${formatCurrency(r.precio)}`).join('\n')}\n` +
        `  • Mano de obra: ${formatCurrency(nuevoPresupuesto.manoDeObra)}\n` +
        `  • *TOTAL:* ${formatCurrency(nuevoPresupuesto.total)}\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `✅ Respondé *APROBAR* para avanzar\n` +
        `❌ Respondé *RECHAZAR* para no continuar\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `Seguí tu orden: ${getTrackingUrl(g)}\n\n` +
        `⚡ *Servieltec*`
    );
}

function filtrarGarantias(filtro) {
    filtroActual = filtro;
    if (filtro === 'todos') garantias = [...garantiasMock];
    else garantias = garantiasMock.filter(g => g.estado === filtro);
    renderTabla();
    document.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.filtro === filtro);
    });
}

function renderTabla() {
    const tbody = document.getElementById('garantiasBody');
    if (!tbody) return;

    if (garantias.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-shield-alt"></i><h3>Sin garantías</h3><p>No hay equipos en esta categoría</p></td></tr>`;
        return;
    }

    const isTecnico = currentRole === 'tecnico';
    const isRecepcion = currentRole === 'recepcion';

    tbody.innerHTML = garantias.map((g, idx) => {
        let badgeExtra = '';
        if (g.estado === 'esperando_aprobacion') badgeExtra = '<div style="font-size:10px;color:var(--color-warning);margin-top:2px;">⏳ Esperando respuesta del cliente</div>';
        if (g.estado === 'cubierta') badgeExtra = '<div style="font-size:10px;color:var(--color-success);margin-top:2px;">🔴 Prioridad alta - En reparación</div>';

        let acciones = '';
        const globalIdx = garantiasMock.indexOf(g);

        if (isTecnico) {
            if (g.estado === 'pendiente_revision') {
                acciones = `<button class="btn btn-sm btn-primary" onclick="window.app.garantias.revisar(${globalIdx})" title="Iniciar revisión"><i class="fas fa-search"></i> Revisar</button>`;
            } else if (g.estado === 'en_revision') {
                acciones = `<button class="btn btn-sm btn-primary" onclick="window.app.garantias.diagnosticar(${globalIdx})" title="Re-diagnóstico"><i class="fas fa-stethoscope"></i> Diagnosticar</button>`;
            } else if (g.estado === 'cubierta') {
                acciones = `<span style="font-size:11px;color:var(--color-success);font-weight:600;"><i class="fas fa-wrench"></i> Reparar con prioridad</span>`;
            } else {
                acciones = `<button class="btn btn-sm btn-outline" onclick="window.app.garantias.ver(${globalIdx})" title="Ver"><i class="fas fa-eye"></i></button>`;
            }
        } else if (isRecepcion) {
            if (g.estado === 'esperando_aprobacion') {
                acciones = `
                    <button class="btn btn-sm btn-primary" onclick="window.app.garantias.aprobar(${globalIdx})" title="Aprobar" style="background:#2e7d32;"><i class="fas fa-check"></i> Aprobar</button>
                    <button class="btn btn-sm btn-danger" onclick="window.app.garantias.rechazar(${globalIdx})" title="Rechazar"><i class="fas fa-times"></i></button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.garantias.ver(${globalIdx})" title="Ver"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.garantias.whatsapp(${globalIdx})" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>
                `;
            } else if (g.estado === 'pendiente_revision') {
                acciones = `
                    <button class="btn btn-sm btn-outline" onclick="window.app.garantias.ver(${globalIdx})" title="Ver"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.garantias.whatsapp(${globalIdx})" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>
                `;
            } else {
                acciones = `
                    <button class="btn btn-sm btn-outline" onclick="window.app.garantias.ver(${globalIdx})" title="Ver"><i class="fas fa-eye"></i></button>
                `;
            }
        } else {
            acciones = `
                ${g.estado === 'esperando_aprobacion' ? `
                    <button class="btn btn-sm btn-primary" onclick="window.app.garantias.aprobar(${globalIdx})" title="Aprobar" style="background:#2e7d32;"><i class="fas fa-check"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="window.app.garantias.rechazar(${globalIdx})" title="Rechazar"><i class="fas fa-times"></i></button>
                ` : ''}
                ${g.estado === 'pendiente_revision' ? `<button class="btn btn-sm btn-primary" onclick="window.app.garantias.revisar(${globalIdx})" title="Revisar"><i class="fas fa-search"></i></button>` : ''}
                ${g.estado === 'en_revision' ? `<button class="btn btn-sm btn-primary" onclick="window.app.garantias.diagnosticar(${globalIdx})" title="Diagnosticar"><i class="fas fa-stethoscope"></i></button>` : ''}
                <button class="btn btn-sm btn-outline" onclick="window.app.garantias.ver(${globalIdx})" title="Ver"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm btn-outline" onclick="window.app.garantias.whatsapp(${globalIdx})" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>
            `;
        }

        return `
        <tr>
            <td><strong>${g.id}</strong></td>
            <td>
                <div>${g.cliente}</div>
                <div style="font-size:11px;color:var(--color-text-muted);">Orden #${g.ordenOriginal}</div>
            </td>
            <td>
                <div>${g.equipo}</div>
                <div style="font-size:11px;color:var(--color-text-muted);">${g.tipo}</div>
            </td>
            <td style="max-width:200px;font-size:12px;">${g.motivoGarantia}</td>
            <td>
                <span class="badge ${estadoGarantiaBadge[g.estado]}">${estadoGarantiaLabels[g.estado]}</span>
                ${badgeExtra}
            </td>
            <td>${g.fechaIngreso}</td>
            <td><div style="display:flex;gap:4px;flex-wrap:wrap;">${acciones}</div></td>
        </tr>`;
    }).join('');
}

export function renderGarantias() {
    return `
        <div class="page-header">
            <h2><i class="fas fa-shield-alt" style="color:var(--color-accent);"></i> Garantías</h2>
            <div class="actions">
                <div class="search-bar">
                    <i class="fas fa-search"></i>
                    <input type="text" placeholder="Buscar garantía..." id="searchGarantia">
                </div>
                <button class="btn btn-primary" id="btnNuevaGarantia"><i class="fas fa-plus"></i> Registrar Garantía</button>
            </div>
        </div>
        <div class="filters-bar"></div>
        <div class="card" style="padding:0;overflow:hidden;">
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th># Garantía</th>
                            <th>Cliente</th>
                            <th>Equipo</th>
                            <th>Motivo</th>
                            <th>Estado</th>
                            <th>Fecha</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="garantiasBody"></tbody>
                </table>
            </div>
        </div>
    `;
}

export function initGarantias() {
    currentRole = window._currentRole || 'admin';
    renderFilters();
    renderTabla();

    const searchInput = document.getElementById('searchGarantia');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            garantias = garantiasMock.filter(g =>
                g.cliente.toLowerCase().includes(term) ||
                g.equipo.toLowerCase().includes(term) ||
                g.id.toLowerCase().includes(term) ||
                g.ordenOriginal.toString().includes(term)
            );
            renderTabla();
        });
    }

    document.getElementById('btnNuevaGarantia')?.addEventListener('click', () => mostrarFormularioNuevaGarantia());

    window.app = window.app || {};
    window.app.garantias = {
        ver: (idx) => { if (garantiasMock[idx]) mostrarDetalleGarantia(garantiasMock[idx]); },
        revisar: (idx) => { if (garantiasMock[idx]) iniciarRevision(garantiasMock[idx]); },
        diagnosticar: (idx) => { if (garantiasMock[idx]) mostrarFormularioReDiagnostico(garantiasMock[idx]); },
        aprobar: (idx) => { aprobarGarantia(idx); },
        rechazar: (idx) => { rechazarGarantia(idx); },
        whatsapp: (idx) => {
            const g = garantiasMock[idx];
            if (g) {
                let msg = '';
                if (g.estado === 'esperando_aprobacion') msg = getMensajeEsperandoAprobacion(g);
                else if (g.estado === 'cubierta') msg = getMensajeCubierta(g);
                else msg = `Hola ${g.cliente}! Sobre tu garantía ${g.id} - ${g.equipo}. Comunicate con nosotros.`;
                window.open(getWhatsAppLink(g, msg), '_blank');
                showToast('WhatsApp abierto', 'success');
            }
        },
        crearDeOrden: (ordenId) => crearGarantiaDeOrden(ordenId),
    };

    window._garantiasListener = () => {
        filtrarGarantias(filtroActual);
    };
    window.addEventListener('ordenes-change', window._garantiasListener);
    window.addEventListener('servicios-domicilio-change', window._garantiasListener);
}

function mostrarFormularioNuevaGarantia() {
    const facturas = getFacturas();
    const ordenes = getOrdenes().filter(o => {
        if (o.estado !== 'retirado') return false;
        const tieneFactura = facturas.some(f => f.orden === o.id);
        return tieneFactura;
    });

    const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
    const serviciosFacturados = serviciosDom.filter(s => s.estado === 'facturado').map(s => {
        const orden = getOrdenes().find(o => o.servicioDomicilioId === s.id);
        if (orden && !ordenes.find(o => o.id === orden.id)) {
            return orden;
        }
        return null;
    }).filter(Boolean);
    const todasOrdenes = [...ordenes, ...serviciosFacturados];

    if (todasOrdenes.length === 0) {
        const ordenesRetiradas = getOrdenes().filter(o => o.estado === 'retirado');
        if (ordenesRetiradas.length > 0) {
            showToast('Las órdenes retiradas necesitan tener factura generada para entrar en garantía', 'error');
        } else {
            showToast('No hay órdenes cerradas (retiradas + facturadas) para garantía', 'error');
        }
        return;
    }

    const listaHtml = todasOrdenes.map(o => {
        const factura = facturas.find(f => f.orden === o.id);
        const domBadge = o.servicioDomicilio ? ' <span style="font-size:10px;background:#e8eaf6;color:#1a237e;padding:1px 6px;border-radius:4px;">🏠 Domicilio</span>' : '';
        return `
        <div style="padding:10px;border:1px solid var(--color-border);border-radius:8px;margin-bottom:8px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;"
             onmouseover="this.style.background='var(--color-footer-bg)'" 
             onmouseout="this.style.background='white'"
             onclick="window.app.garantias.crearDeOrden(${o.id})">
            <div>
                <strong>#${o.id}</strong> - ${o.cliente}${domBadge}
                <div style="font-size:12px;color:var(--color-text-muted);">${o.equipo} | ${o.tipo}</div>
                <div style="font-size:11px;color:var(--color-success);"><i class="fas fa-check-circle"></i> Retirado | Factura: ${factura ? factura.id : 'N/A'}</div>
            </div>
            <div style="font-size:11px;color:var(--color-text-muted);">${o.fechaRetirado || o.fechaIngreso}</div>
        </div>
    `}).join('');

    showModal('Registrar Garantía', `
        <div style="padding:10px;background:#e8f5e9;border-radius:8px;font-size:12px;color:#2e7d32;margin-bottom:16px;">
            <i class="fas fa-info-circle"></i> Solo se muestran órdenes cerradas (retiradas + facturadas)
        </div>
        <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:12px;">Seleccioná la orden original del equipo en garantía:</p>
        ${listaHtml}
    `);
}

function crearGarantiaDeOrden(ordenId) {
    const orden = getOrdenes().find(o => o.id === ordenId);
    if (!orden) return;

    const existe = garantiasMock.find(g => g.ordenOriginal === ordenId);
    if (existe) {
        showToast(`Ya existe una garantía para la orden #${ordenId}`, 'error');
        return;
    }

    const content = `
        <div style="padding:10px;background:#e3f2fd;border-radius:8px;font-size:12px;color:#1565c0;margin-bottom:16px;">
            <i class="fas fa-info-circle"></i> Orden #${ordenId} - ${orden.equipo} - ${orden.cliente}
        </div>
        <div class="form-group">
            <label>Motivo de la garantía *</label>
            <textarea class="form-control" id="garMotivo" rows="3" placeholder="Describí el problema que presentó el equipo..."></textarea>
        </div>
    `;

    showModal('Nueva Garantía', content, () => {
        const motivo = document.getElementById('garMotivo')?.value?.trim();
        if (!motivo) { showToast('Describí el motivo de la garantía', 'error'); return; }

        const nuevaGarantia = {
            id: `G-${String(garantiasMock.length + 1).padStart(3, '0')}`,
            ordenOriginal: orden.id,
            cliente: orden.cliente,
            tel: orden.tel,
            equipo: orden.equipo,
            tipo: orden.tipo,
            motivoGarantia: motivo,
            fechaIngreso: new Date().toISOString().split('T')[0],
            estado: 'pendiente_revision',
            diagnosticoOriginal: orden.diagnostico?.problema || orden.notas,
            reparacionOriginal: orden.diagnostico ? orden.diagnostico.repuestos.map(r => r.nombre).join(', ') : 'Sin datos',
            costoReparacionOriginal: orden.diagnostico?.total || orden.precio || 0,
            reDiagnostico: null,
        };

        garantiasMock.unshift(nuevaGarantia);
        filtrarGarantias(filtroActual);
        showToast('Garantía registrada', 'success');
    });
}

function iniciarRevision(garantia) {
    garantia.estado = 'en_revision';
    filtrarGarantias(filtroActual);
    showToast(`Garantía ${garantia.id} en revisión`, 'success');
}

function mostrarFormularioReDiagnostico(garantia) {
    const content = `
        <div style="padding:10px;background:#fff3e0;border-radius:8px;font-size:12px;color:#e65100;margin-bottom:16px;">
            <i class="fas fa-exclamation-triangle"></i> Verificá si el equipo cubre la garantía original.
        </div>
        <div class="form-group">
            <label>Equipo</label>
            <input type="text" class="form-control" value="${garantia.equipo} - ${garantia.tipo}" readonly style="background:var(--color-footer-bg);">
        </div>
        <div class="form-group">
            <label>Reparación original</label>
            <input type="text" class="form-control" value="${garantia.reparacionOriginal}" readonly style="background:var(--color-footer-bg);">
        </div>
        <div class="form-group">
            <label>Motivo del reclamo</label>
            <textarea class="form-control" rows="2" readonly style="background:var(--color-footer-bg);">${garantia.motivoGarantia}</textarea>
        </div>
        <div class="form-group">
            <label>Verificación del técnico *</label>
            <textarea class="form-control" id="rdVerificacion" rows="3" placeholder="Describí lo que verificaste..."></textarea>
        </div>
        <div class="form-group">
            <label>¿Cumple con la garantía? *</label>
            <div style="display:flex;gap:12px;margin-top:4px;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                    <input type="radio" name="rdCumple" value="si"> SÍ, cubre garantía
                </label>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                    <input type="radio" name="rdCumple" value="no"> NO, no cubre
                </label>
            </div>
        </div>
        <div id="noCubiertaSection" style="display:none;">
            <div class="form-group">
                <label>Motivo del rechazo *</label>
                <textarea class="form-control" id="rdMotivoRechazo" rows="2" placeholder="Por qué no cubre la garantía..."></textarea>
            </div>
            <div class="form-group">
                <label>Nuevo diagnóstico</label>
                <textarea class="form-control" id="rdNuevoDiagnostico" rows="2" placeholder="Descripción del problema actual..."></textarea>
            </div>
            <div id="rdRepuestosSection">
                <div class="form-group">
                    <label>Repuestos necesarios</label>
                    <div id="rdRepuestosList">
                        <div class="form-row" style="margin-bottom:8px;">
                            <div class="form-group" style="margin-bottom:0;flex:2;">
                                <input type="text" class="form-control rd-rep-nombre" placeholder="Repuesto">
                            </div>
                            <div class="form-group" style="margin-bottom:0;flex:1;">
                                <input type="number" class="form-control rd-rep-precio" placeholder="Precio">
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline" id="btnAddRepuestoRd" style="margin-top:4px;"><i class="fas fa-plus"></i> Agregar</button>
                </div>
                <div class="form-group">
                    <label>Mano de obra</label>
                    <input type="number" class="form-control" id="rdManoDeObra" value="" placeholder="0">
                </div>
                <div style="padding:12px;background:var(--color-footer-bg);border-radius:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:var(--color-primary);">
                        <span>NUEVO TOTAL:</span><span id="rdTotal">$0</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    showModal(`Re-diagnóstico - Garantía ${garantia.id}`, content, () => {
        const verificacion = document.getElementById('rdVerificacion')?.value?.trim();
        if (!verificacion) { showToast('Completá la verificación', 'error'); return; }

        const cumple = document.querySelector('input[name="rdCumple"]:checked')?.value;
        if (!cumple) { showToast('Indicá si cubre o no la garantía', 'error'); return; }

        garantia.reDiagnostico = {
            verificacion,
            cumpleGarantia: cumple === 'si',
            fechaRevision: new Date().toISOString().split('T')[0],
        };

        if (cumple === 'si') {
            garantia.estado = 'esperando_aprobacion';
            showToast(`Garantía ${garantia.id} - Esperando aprobación del cliente`, 'success');
            setTimeout(() => {
                window.open(getWhatsAppLink(garantia, getMensajeEsperandoAprobacion(garantia)), '_blank');
            }, 500);
        } else {
            const motivoRechazo = document.getElementById('rdMotivoRechazo')?.value?.trim();
            if (!motivoRechazo) { showToast('Indicá el motivo del rechazo', 'error'); return; }

            const repuestos = [];
            document.querySelectorAll('#rdRepuestosList .form-row').forEach(row => {
                const nombre = row.querySelector('.rd-rep-nombre')?.value?.trim();
                const precio = parseInt(row.querySelector('.rd-rep-precio')?.value) || 0;
                if (nombre) repuestos.push({ nombre, precio });
            });

            const manoDeObra = parseInt(document.getElementById('rdManoDeObra')?.value) || 0;
            const total = repuestos.reduce((sum, r) => sum + r.precio, 0) + manoDeObra;

            garantia.reDiagnostico.motivoRechazo = motivoRechazo;
            garantia.reDiagnostico.nuevoPresupuesto = {
                problema: document.getElementById('rdNuevoDiagnostico')?.value?.trim() || motivoRechazo,
                repuestos, manoDeObra, total,
            };

            garantia.estado = 'no_cubierta';
            showToast(`Garantía ${garantia.id} - No cubre. Nuevo presupuesto enviado`, 'error');
            setTimeout(() => {
                window.open(getWhatsAppLink(garantia, getMensajeNoCubierta(garantia, garantia.reDiagnostico.nuevoPresupuesto)), '_blank');
            }, 500);
        }

        filtrarGarantias(filtroActual);
    });

    setTimeout(() => {
        document.querySelectorAll('input[name="rdCumple"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.getElementById('noCubiertaSection').style.display = e.target.value === 'no' ? 'block' : 'none';
            });
        });

        document.getElementById('btnAddRepuestoRd')?.addEventListener('click', () => {
            const list = document.getElementById('rdRepuestosList');
            const row = document.createElement('div');
            row.className = 'form-row';
            row.style.marginBottom = '8px';
            row.innerHTML = `
                <div class="form-group" style="margin-bottom:0;flex:2;"><input type="text" class="form-control rd-rep-nombre" placeholder="Repuesto"></div>
                <div class="form-group" style="margin-bottom:0;flex:1;"><input type="number" class="form-control rd-rep-precio" placeholder="Precio"></div>
                <button type="button" class="btn btn-sm btn-danger" onclick="this.closest('.form-row').remove()"><i class="fas fa-times"></i></button>
            `;
            list.appendChild(row);
        });

        const calcularTotal = () => {
            const precios = [...document.querySelectorAll('.rd-rep-precio')].map(el => parseInt(el.value) || 0);
            const mano = parseInt(document.getElementById('rdManoDeObra')?.value) || 0;
            document.getElementById('rdTotal').textContent = formatCurrency(precios.reduce((a, b) => a + b, 0) + mano);
        };
        document.querySelectorAll('.rd-rep-precio, #rdManoDeObra').forEach(el => el.addEventListener('input', calcularTotal));
    }, 100);
}

function aprobarGarantia(idx) {
    const g = garantiasMock[idx];
    if (!g) return;
    g.estado = 'cubierta';
    g.fechaAprobacion = new Date().toISOString().split('T')[0];
    filtrarGarantias(filtroActual);
    showToast(`Garantía ${g.id} APROBADA - Prioridad alta`, 'success');
    setTimeout(() => {
        window.open(getWhatsAppLink(g, getMensajeCubierta(g)), '_blank');
    }, 500);
}

function rechazarGarantia(idx) {
    const g = garantiasMock[idx];
    if (!g) return;
    g.estado = 'no_cubierta';
    g.fechaRechazo = new Date().toISOString().split('T')[0];
    filtrarGarantias(filtroActual);
    showToast(`Garantía ${g.id} RECHAZADA`, 'error');
}

function mostrarDetalleGarantia(g) {
    let reDiagnosticoHtml = '';
    if (g.reDiagnostico) {
        const rd = g.reDiagnostico;
        reDiagnosticoHtml = `
            <div style="margin-top:16px;">
                <h4 style="font-size:13px;color:var(--color-text-muted);margin-bottom:8px;border-bottom:1px solid var(--color-border);padding-bottom:6px;">RE-DIAGNÓSTICO</h4>
                <p style="font-size:13px;margin-bottom:8px;"><strong>Verificación:</strong> ${rd.verificacion}</p>
                <p style="font-size:13px;margin-bottom:8px;"><strong>Resultado:</strong> 
                    <span class="badge ${rd.cumpleGarantia ? 'badge-success' : 'badge-danger'}">
                        ${rd.cumpleGarantia ? 'Cubre Garantía' : 'No Cubre'}
                    </span>
                </p>
                <p style="font-size:12px;color:var(--color-text-muted);">Fecha revisión: ${rd.fechaRevision}</p>
                ${!rd.cumpleGarantia && rd.nuevoPresupuesto ? `
                    <div style="margin-top:12px;padding:10px;background:#fff3e0;border-radius:8px;">
                        <p style="font-size:12px;font-weight:600;color:#e65100;margin-bottom:6px;"><i class="fas fa-exclamation-triangle"></i> Nuevo Presupuesto:</p>
                        <p style="font-size:12px;">${rd.motivoRechazo}</p>
                        <table class="data-table" style="margin-top:8px;">
                            <thead><tr><th>Repuesto</th><th style="text-align:right;">Precio</th></tr></thead>
                            <tbody>
                                ${rd.nuevoPresupuesto.repuestos.map(r => `<tr><td>${r.nombre}</td><td style="text-align:right;">${formatCurrency(r.precio)}</td></tr>`).join('')}
                                <tr><td>Mano de obra</td><td style="text-align:right;">${formatCurrency(rd.nuevoPresupuesto.manoDeObra)}</td></tr>
                                <tr style="font-weight:700;border-top:2px solid var(--color-border);"><td>TOTAL</td><td style="text-align:right;">${formatCurrency(rd.nuevoPresupuesto.total)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                ` : ''}
            </div>
        `;
    }

    showModal(`Garantía ${g.id}`, `
        <div class="detail-grid">
            <div class="detail-card"><h4>Cliente</h4><p>${g.cliente}</p><p style="font-size:12px;color:var(--color-text-muted);">${g.tel}</p></div>
            <div class="detail-card"><h4>Equipo</h4><p>${g.equipo}</p><p style="font-size:12px;color:var(--color-text-muted);">${g.tipo}</p></div>
            <div class="detail-card"><h4>Orden Original</h4><p>#${g.ordenOriginal}</p></div>
            <div class="detail-card"><h4>Estado</h4><p><span class="badge ${estadoGarantiaBadge[g.estado]}">${estadoGarantiaLabels[g.estado]}</span></p></div>
            <div class="detail-card"><h4>Fecha Ingreso</h4><p>${g.fechaIngreso}</p></div>
            <div class="detail-card"><h4>Costo Original</h4><p>${formatCurrency(g.costoReparacionOriginal)}</p></div>
        </div>
        <div style="margin-top:12px;">
            <h4 style="font-size:13px;color:var(--color-text-muted);margin-bottom:8px;">REPARACIÓN ORIGINAL</h4>
            <p style="font-size:13px;">${g.reparacionOriginal}</p>
        </div>
        <div style="margin-top:12px;">
            <h4 style="font-size:13px;color:var(--color-text-muted);margin-bottom:8px;">MOTIVO DEL RECLAMO</h4>
            <p style="font-size:13px;padding:10px;background:var(--color-footer-bg);border-radius:8px;">${g.motivoGarantia}</p>
        </div>
        ${reDiagnosticoHtml}
        ${g.estado === 'esperando_aprobacion' ? `
        <div style="margin-top:16px;padding:12px;background:#e3f2fd;border-radius:8px;">
            <p style="font-size:12px;font-weight:600;color:#1565c0;margin-bottom:6px;"><i class="fas fa-clock"></i> Esperando respuesta del cliente</p>
            <div style="display:flex;gap:8px;margin-top:8px;">
                <button class="btn btn-sm btn-primary" style="background:#2e7d32;" onclick="window.app.garantias.aprobar(${garantiasMock.indexOf(g)});document.getElementById('app-modal').classList.remove('active');">
                    <i class="fas fa-check"></i> Aprobar
                </button>
                <button class="btn btn-sm btn-danger" onclick="window.app.garantias.rechazar(${garantiasMock.indexOf(g)});document.getElementById('app-modal').classList.remove('active');">
                    <i class="fas fa-times"></i> Rechazar
                </button>
            </div>
        </div>` : ''}
        <div style="margin-top:16px;padding:12px;background:#e8f5e9;border-radius:8px;">
            <p style="font-size:12px;font-weight:600;color:#2e7d32;margin-bottom:6px;"><i class="fas fa-link"></i> Link de seguimiento:</p>
            <div style="display:flex;gap:4px;align-items:center;">
                <input type="text" class="form-control" value="${getTrackingUrl(g)}" readonly style="font-size:11px;flex:1;">
                <button class="btn btn-sm btn-outline" onclick="navigator.clipboard.writeText('${getTrackingUrl(g)}');showToast('Copiado!');"><i class="fas fa-copy"></i></button>
            </div>
        </div>
    `);
}

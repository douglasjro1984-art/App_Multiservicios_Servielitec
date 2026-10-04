import { formatCurrency, showToast, showModal } from '../utils/helpers.js';
import { getOrdenes, saveOrdenes, notifyOrdenesChange } from './ordenes.js';

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

const estadoIcon = {
    recepcion: 'fa-inbox',
    diagnostico: 'fa-stethoscope',
    esperando_aprobacion: 'fa-hourglass-half',
    aprobado: 'fa-check-circle',
    rechazado: 'fa-times-circle',
    en_taller: 'fa-wrench',
    retirar: 'fa-box',
    retirado: 'fa-check-double',
};

function getMisOrdenes() {
    const clienteId = window._clienteId || localStorage.getItem('servieltec_cliente_id');
    if (!clienteId) return [];
    const ordenes = getOrdenes();
    const cliente = JSON.parse(localStorage.getItem('servieltec_clientes') || '[]').find(c => c.id === clienteId);
    if (!cliente) return [];

    const ordenesCliente = ordenes.filter(o => o.tel === cliente.tel || o.email === cliente.email || o.cliente === cliente.nombre);

    const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
    const estadoMapDom = {
        pendiente: 'recepcion',
        asignado: 'recepcion',
        en_curso: 'diagnostico',
        completado: 'retirar',
        pendiente_seguimiento: 'en_taller',
        cancelado: 'rechazado',
        facturado: 'retirado',
    };
    const serviciosCliente = serviciosDom
        .filter(s => s.cliente.telefono === cliente.tel || s.cliente.email === cliente.email || s.cliente.nombre === cliente.nombre)
        .map(s => ({
            id: s.id,
            cliente: s.cliente.nombre,
            tel: s.cliente.telefono,
            email: s.cliente.email || '',
            equipo: `${s.equipo.tipo} ${s.equipo.marca} - ${s.equipo.descripcion || ''}`,
            tipo: s.tipoServicio === 'mantenimiento' ? 'Electrodoméstico' : 'Otro',
            estado: estadoMapDom[s.estado] || 'recepcion',
            tecnico: s.tecnicoAsignado || '-',
            precio: s.precio || 0,
            fechaIngreso: s.fechaIngreso,
            notas: s.equipo.descripcion || '',
            diagnostico: null,
            ordenTrabajo: s.ordenTrabajo,
            servicioDomicilio: true,
        }));

    return [...ordenesCliente, ...serviciosCliente];
}

export function renderClienteDashboard() {
    const ordenes = getMisOrdenes();
    const enTaller = ordenes.filter(o => ['recepcion', 'diagnostico', 'esperando_aprobacion', 'en_taller'].includes(o.estado)).length;
    const listos = ordenes.filter(o => o.estado === 'retirar').length;
    const retirados = ordenes.filter(o => o.estado === 'retirado').length;

    return `
        <div class="page-header">
            <h2><i class="fas fa-user" style="color:var(--color-success);"></i> Mis Equipos</h2>
        </div>

        <div class="stats-row">
            <div class="stat-card">
                <div class="stat-value" style="color:var(--color-warning);">${enTaller}</div>
                <div class="stat-label">En Servicio</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color:var(--color-success);">${listos}</div>
                <div class="stat-label">Listos para Retirar</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color:var(--color-info);">${retirados}</div>
                <div class="stat-label">Retirados</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${ordenes.length}</div>
                <div class="stat-label">Total Equipos</div>
            </div>
        </div>

        <div class="card" style="padding:0;overflow:hidden;">
            <div style="padding:16px 20px;border-bottom:1px solid var(--color-border);">
                <h3 style="font-size:16px;font-weight:600;"><i class="fas fa-list"></i> Mis Equipos</h3>
            </div>
            <div id="clienteOrdenesBody">
                ${ordenes.length === 0 ? `
                    <div class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <h3>Sin equipos</h3>
                        <p>No tenés equipos en servicio actualmente</p>
                    </div>
                ` : ordenes.map(o => renderEquipoCard(o)).join('')}
            </div>
        </div>
    `;
}

function renderEquipoCard(o) {
    const progreso = getProgreso(o.estado);
    const idStr = typeof o.id === 'string' ? `'${o.id}'` : o.id;
    return `
        <div style="padding:16px 20px;border-bottom:1px solid var(--color-border);cursor:pointer;transition:background 0.2s;" 
             onmouseover="this.style.background='var(--color-footer-bg)'" 
             onmouseout="this.style.background='transparent'"
             onclick="window.app.cliente.verEquipo(${idStr})">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div style="flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        <i class="fas ${estadoIcon[o.estado]}" style="color:var(--color-accent);font-size:16px;"></i>
                        <strong style="font-size:15px;">${o.equipo}</strong>
                        ${o.servicioDomicilio ? '<span class="badge badge-accent" style="font-size:10px;"><i class="fas fa-home"></i> Domicilio</span>' : ''}
                    </div>
                    <div style="font-size:12px;color:var(--color-text-muted);margin-bottom:4px;">
                        Orden #${o.id} | ${o.tipo}
                    </div>
                    <div style="font-size:12px;color:var(--color-text-muted);">
                        Ingreso: ${o.fechaIngreso}
                        ${o.tecnico !== '-' ? ` | Técnico: ${o.tecnico}` : ''}
                    </div>
                </div>
                <div style="text-align:right;">
                    <span class="badge ${estadoBadge[o.estado]}">${estadoLabels[o.estado]}</span>
                    ${o.diagnostico ? `<div style="font-size:13px;font-weight:600;margin-top:4px;color:var(--color-primary);">${formatCurrency(o.diagnostico.total)}</div>` : ''}
                </div>
            </div>
            <div style="margin-top:10px;">
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-muted);margin-bottom:4px;">
                    <span>Progreso</span>
                    <span>${progreso}%</span>
                </div>
                <div style="height:6px;background:var(--color-border);border-radius:3px;overflow:hidden;">
                    <div style="height:100%;width:${progreso}%;background:var(--color-accent);border-radius:3px;transition:width 0.3s;"></div>
                </div>
            </div>
        </div>
    `;
}

function getProgreso(estado) {
    const map = { recepcion: 10, diagnostico: 25, esperando_aprobacion: 40, aprobado: 50, en_taller: 70, retirar: 90, retirado: 100, rechazado: 100 };
    return map[estado] || 0;
}

function mostrarDetalleEquipo(o) {
    let diagnosticoHtml = '';
    if (o.diagnostico) {
        const d = o.diagnostico;
        const repuestosHtml = d.repuestos.map(r => `<tr><td>${r.nombre}</td><td style="text-align:right;">${formatCurrency(r.precio)}</td></tr>`).join('');

        let estadoAprob = '';
        if (d.aprobado === true) estadoAprob = '<span class="badge badge-success">Aprobado</span>';
        else if (d.aprobado === false) estadoAprob = '<span class="badge badge-danger">Rechazado</span>';
        else estadoAprob = '<span class="badge badge-warning">Esperando respuesta</span>';

        diagnosticoHtml = `
            <div style="margin-top:16px;">
                <h4 style="font-size:13px;color:var(--color-text-muted);margin-bottom:8px;border-bottom:1px solid var(--color-border);padding-bottom:6px;">DIAGNÓSTICO</h4>
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
                </div>
            </div>
        `;
    }

    let ordenTrabajoHtml = '';
    if (o.ordenTrabajo) {
        const ot = o.ordenTrabajo;
        ordenTrabajoHtml = `
            <div style="margin-top:16px;">
                <h4 style="font-size:13px;color:var(--color-text-muted);margin-bottom:8px;border-bottom:1px solid var(--color-border);padding-bottom:6px;"><i class="fas fa-clipboard-check"></i> ORDEN DE TRABAJO</h4>
                <p style="font-size:13px;margin-bottom:4px;"><strong>Trabajo realizado:</strong> ${ot.trabajoRealizado}</p>
                <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:4px;"><strong>Tiempo:</strong> ${ot.tiempoEmpleado || '-'} | <strong>Fecha:</strong> ${ot.fechaCompletado}</p>
                ${ot.pendientes?.length > 0 ? `<p style="font-size:12px;color:var(--color-warning);margin:4px 0;"><strong>Pendientes:</strong> ${ot.pendientes.join(', ')}</p>` : ''}
                ${ot.recomendaciones ? `<p style="font-size:12px;margin:4px 0;"><strong>Recomendaciones:</strong> ${ot.recomendaciones}</p>` : ''}
            </div>
        `;
    }

    const idStr = `'${o.id}'`;
    showModal(`Equipo - Orden #${o.id}`, `
        <div class="detail-grid">
            <div class="detail-card"><h4>Equipo</h4><p>${o.equipo}</p><p style="font-size:12px;color:var(--color-text-muted);">${o.tipo}</p></div>
            <div class="detail-card"><h4>Estado</h4><p><span class="badge ${estadoBadge[o.estado]}">${estadoLabels[o.estado]}</span>${o.servicioDomicilio ? ' <span class="badge badge-accent"><i class="fas fa-home"></i> Domicilio</span>' : ''}</p></div>
            <div class="detail-card"><h4>Técnico</h4><p>${o.tecnico}</p></div>
            <div class="detail-card"><h4>Ingreso</h4><p>${o.fechaIngreso}</p></div>
        </div>
        ${o.notas ? `<div style="margin-top:12px;padding:10px;background:var(--color-footer-bg);border-radius:8px;font-size:13px;color:var(--color-text-muted);"><i class="fas fa-info-circle"></i> ${o.notas}</div>` : ''}
        ${diagnosticoHtml}
        ${ordenTrabajoHtml}
        ${o.estado === 'esperando_aprobacion' ? `
        <div style="margin-top:16px;padding:12px;background:#fff3e0;border-radius:8px;">
            <p style="font-size:13px;color:#e65100;margin-bottom:12px;"><i class="fas fa-hourglass-half"></i> <strong>Presupuesto pendiente de tu aprobación</strong></p>
            <div style="display:flex;gap:10px;">
                <button class="btn btn-primary" style="flex:1;background:#2e7d32;" onclick="window.app.cliente.aprobar(${idStr});document.getElementById('app-modal').classList.remove('active');">
                    <i class="fas fa-check"></i> Aprobar
                </button>
                <button class="btn btn-danger" style="flex:1;" onclick="window.app.cliente.rechazar(${idStr});document.getElementById('app-modal').classList.remove('active');">
                    <i class="fas fa-times"></i> Rechazar
                </button>
            </div>
        </div>` : ''}
        ${o.estado === 'retirar' ? `
            <div style="margin-top:16px;padding:12px;background:#fff3e0;border-radius:8px;">
                <p style="font-size:13px;color:#e65100;"><i class="fas fa-exclamation-triangle"></i> <strong>Tu equipo está listo para retirar.</strong> Tenés 8 días para retirarlo sin multa.</p>
            </div>
        ` : ''}
        ${o.estado === 'retirado' && o.fechaGarantia ? `
        <div style="margin-top:16px;padding:12px;background:#e3f2fd;border-radius:8px;">
            <p style="font-size:13px;font-weight:600;color:#1565c0;margin-bottom:6px;"><i class="fas fa-shield-alt"></i> GARANTÍA</p>
            <p style="font-size:13px;margin:0;"><strong>Retirado:</strong> ${o.fechaRetirado}</p>
            <p style="font-size:13px;margin:0;"><strong>Vigente hasta:</strong> ${o.fechaGarantia} (${o.garantiaDias || 30} días)</p>
            <p style="font-size:12px;color:var(--color-text-muted);margin-top:4px;">Cualquier problema durante este período será cubierto sin costo adicional.</p>
        </div>` : ''}
    `);
}

function refreshClientePage() {
    const content = document.querySelector('.page-content');
    if (content) {
        content.innerHTML = renderClienteDashboard();
    }
}

function _findClientOrder(id) {
    const numId = typeof id === 'string' ? parseInt(id) : id;
    let orden = getOrdenes().find(x => x.id === id || x.id === numId || x.servicioDomicilioId === id);
    if (orden) return { type: 'orden', obj: orden };
    const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
    const sIdx = serviciosDom.findIndex(x => x.id === id);
    if (sIdx > -1) return { type: 'servicio', obj: serviciosDom[sIdx], idx: sIdx, arr: serviciosDom };
    return null;
}

export function initClienteDashboard() {
    window.app = window.app || {};
    window.app.cliente = {
        verEquipo: (id) => {
            const ordenes = getMisOrdenes();
            const numId = typeof id === 'string' ? parseInt(id) : id;
            const o = ordenes.find(x => x.id === id || x.id === numId);
            if (o) mostrarDetalleEquipo(o);
        },
        aprobar: (id) => {
            const found = _findClientOrder(id);
            if (!found) {
                showToast('No se encontró el equipo', 'error');
                return;
            }
            document.getElementById('app-modal')?.classList.remove('active');
            if (found.type === 'orden') {
                const o = found.obj;
                if (o.diagnostico) {
                    o.diagnostico.aprobado = true;
                }
                o.estado = 'en_taller';
                o.precio = o.diagnostico?.total || o.precio || 0;
                if (o.servicioDomicilioId) {
                    const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
                    const servicio = serviciosDom.find(s => s.id === o.servicioDomicilioId);
                    if (servicio) {
                        servicio.estado = 'aprobado';
                        servicio.precio = o.precio;
                        localStorage.setItem('servieltec_servicios_domicilio', JSON.stringify(serviciosDom));
                    }
                }
                notifyOrdenesChange({ action: 'aprobar_cliente', id: o.id });
            } else {
                const s = found.obj;
                s.estado = 'en_curso';
                const serviciosDom = found.arr;
                localStorage.setItem('servieltec_servicios_domicilio', JSON.stringify(serviciosDom));
                window.dispatchEvent(new CustomEvent('servicios-domicilio-change'));
            }
            showToast(`Equipo aprobado - En taller`, 'success');
            setTimeout(refreshClientePage, 50);
        },
        rechazar: (id) => {
            const found = _findClientOrder(id);
            if (!found) {
                showToast('No se encontró el equipo', 'error');
                return;
            }
            document.getElementById('app-modal')?.classList.remove('active');
            if (found.type === 'orden') {
                const o = found.obj;
                if (o.diagnostico) {
                    o.diagnostico.aprobado = false;
                }
                o.estado = 'rechazado';
                o.precio = o.diagnostico?.costoDiagnostico || o.precio || 0;
                if (o.servicioDomicilioId) {
                    const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
                    const servicio = serviciosDom.find(s => s.id === o.servicioDomicilioId);
                    if (servicio) {
                        servicio.estado = 'rechazado';
                        servicio.precio = o.precio;
                        localStorage.setItem('servieltec_servicios_domicilio', JSON.stringify(serviciosDom));
                    }
                }
                notifyOrdenesChange({ action: 'rechazar_cliente', id: o.id });
            } else {
                const s = found.obj;
                s.estado = 'cancelado';
                const serviciosDom = found.arr;
                localStorage.setItem('servieltec_servicios_domicilio', JSON.stringify(serviciosDom));
                window.dispatchEvent(new CustomEvent('servicios-domicilio-change'));
            }
            showToast(`Equipo rechazado`, 'error');
            setTimeout(refreshClientePage, 50);
        },
    };

    window._clienteListener = () => {
        const content = document.querySelector('.page-content');
        if (content && document.getElementById('clienteOrdenesBody')) {
            content.innerHTML = renderClienteDashboard();
        }
    };
    window.addEventListener('ordenes-change', window._clienteListener);
    window.addEventListener('servicios-domicilio-change', window._clienteListener);
}

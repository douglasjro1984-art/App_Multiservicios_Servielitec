import { formatCurrency, formatDate, showToast, showModal, confirmAction } from '../utils/helpers.js';
import { getOrdenes } from './ordenes.js';

const estadoBadge = {
    pagada: 'badge-success',
    pendiente: 'badge-warning',
    multa: 'badge-danger',
};

const estadoLabels = {
    pagada: 'Pagada',
    pendiente: 'Pendiente',
    multa: 'Con Multa',
};

function _read() {
    return JSON.parse(localStorage.getItem('servieltec_facturas') || '[]');
}

function _write(arr) {
    localStorage.setItem('servieltec_facturas', JSON.stringify(arr));
}

function _save(factura) {
    const arr = _read();
    arr.unshift(factura);
    _write(arr);
}

function _update(id, updates) {
    const arr = _read();
    const idx = arr.findIndex(f => f.id === id);
    if (idx > -1) {
        Object.assign(arr[idx], updates);
        _write(arr);
        return arr[idx];
    }
    return null;
}

function _find(id) {
    return _read().find(f => f.id === id) || null;
}

export function getFacturas() {
    return _read();
}

function _nextId() {
    const arr = _read();
    const nums = arr.map(f => parseInt(f.id.replace('F-', ''), 10)).filter(n => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `F-${String(next).padStart(3, '0')}`;
}

function _renderTabla(filtradas) {
    const tbody = document.getElementById('facturasBody');
    if (!tbody) return;

    if (filtradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-file-invoice"></i><h3>Sin facturas</h3></td></tr>`;
        return;
    }

    tbody.innerHTML = filtradas.map(f => `
        <tr>
            <td><strong>${f.id}</strong></td>
            <td>${f.cliente}</td>
            <td>#${f.orden}</td>
            <td>${f.monto > 0 ? formatCurrency(f.monto) : '<span style="color:var(--color-text-muted);">Pendiente</span>'}</td>
            <td><span class="badge ${estadoBadge[f.estado] || 'badge-info'}">${estadoLabels[f.estado] || f.estado}</span></td>
            <td>${f.fecha}</td>
            <td>
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-sm btn-outline" onclick="window.app.facturacion.ver(${JSON.stringify(f.id).replace(/"/g, '&quot;')})" title="Ver detalle"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-accent" onclick="window.app.facturacion.pdf(${JSON.stringify(f.id).replace(/"/g, '&quot;')})" title="Generar PDF"><i class="fas fa-file-pdf"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderTablaFromStorage() {
    const term = document.getElementById('searchFactura')?.value?.toLowerCase() || '';
    let todas = _read();
    if (term) {
        todas = todas.filter(f =>
            f.cliente.toLowerCase().includes(term) ||
            f.id.toLowerCase().includes(term) ||
            f.orden.toString().includes(term)
        );
    }
    _renderTabla(todas);
}

export function renderFacturacion() {
    const todasLasFacturas = _read();
    const totalCobrado = todasLasFacturas.filter(f => f.estado === 'pagada').reduce((sum, f) => sum + f.monto, 0);
    const pendiente = todasLasFacturas.filter(f => f.estado === 'pendiente').reduce((sum, f) => sum + f.monto, 0);
    const multas = todasLasFacturas.filter(f => f.estado === 'multa').reduce((sum, f) => sum + f.monto, 0);

    return `
        <div class="page-header">
            <h2><i class="fas fa-file-invoice-dollar" style="color:var(--color-success);"></i> Facturación</h2>
            <div class="actions">
                <div class="search-bar">
                    <i class="fas fa-search"></i>
                    <input type="text" placeholder="Buscar factura..." id="searchFactura">
                </div>
                <button class="btn btn-accent" id="btnGenDesdeOrden">
                    <i class="fas fa-file-invoice"></i> Generar desde Orden
                </button>
                <button class="btn btn-primary" id="btnNuevaFactura">
                    <i class="fas fa-plus"></i> Nueva Factura
                </button>
                <button class="btn btn-outline" id="btnNuevaCompra" style="border-color:var(--color-danger);color:var(--color-danger);">
                    <i class="fas fa-shopping-cart"></i> Nueva Compra
                </button>
            </div>
        </div>

        <div class="stats-row">
            <div class="stat-card" style="cursor:pointer;" onclick="window.app.facturacion.desglose('pagada')">
                <div class="stat-value" style="color:var(--color-success);">${formatCurrency(totalCobrado)}</div>
                <div class="stat-label">Total Cobrado</div>
            </div>
            <div class="stat-card" style="cursor:pointer;" onclick="window.app.facturacion.desglose('pendiente')">
                <div class="stat-value" style="color:var(--color-warning);">${formatCurrency(pendiente)}</div>
                <div class="stat-label">Pendiente Cobro</div>
            </div>
            <div class="stat-card" style="cursor:pointer;" onclick="window.app.facturacion.desglose('multa')">
                <div class="stat-value" style="color:var(--color-danger);">${formatCurrency(multas)}</div>
                <div class="stat-label">Multas</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${todasLasFacturas.length}</div>
                <div class="stat-label">Total Facturas</div>
            </div>
        </div>

        <div class="card" style="margin-bottom:20px;">
            <div class="card-header">
                <h3><i class="fas fa-calendar-day"></i> Registro Contable Diario</h3>
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-sm btn-outline" onclick="window.app.facturacion.balance('diario')"><i class="fas fa-cash-register"></i> Caja Diaria</button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.facturacion.balance('semanal')"><i class="fas fa-calendar-week"></i> Semanal</button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.facturacion.balance('mensual')"><i class="fas fa-calendar-alt"></i> Mensual</button>
                </div>
            </div>
            <div id="registroContableBody" style="padding:12px;">
                ${renderRegistroContable()}
            </div>
        </div>

        <div class="card" style="margin-bottom:20px;padding:0;overflow:hidden;">
            <div class="card-header">
                <h3><i class="fas fa-shopping-cart" style="color:var(--color-danger);"></i> Compras / Gastos</h3>
            </div>
            <div id="comprasBody" style="padding:12px;">
                ${renderCompras()}
            </div>
        </div>

        <div class="card" style="padding:0;overflow:hidden;">
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Factura</th>
                            <th>Cliente</th>
                            <th>Orden</th>
                            <th>Monto</th>
                            <th>Estado</th>
                            <th>Fecha</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="facturasBody"></tbody>
                </table>
            </div>
        </div>
    `;
}

function renderRegistroContable() {
    const hoy = new Date().toISOString().split('T')[0];
    const todasLasFacturas = _read();
    const facturasHoy = todasLasFacturas.filter(f => f.fecha === hoy);
    const cobradoHoy = facturasHoy.filter(f => f.estado === 'pagada').reduce((s, f) => s + f.monto, 0);
    const pendienteHoy = facturasHoy.filter(f => f.estado === 'pendiente').reduce((s, f) => s + f.monto, 0);

    const compras = JSON.parse(localStorage.getItem('servieltec_compras') || '[]');
    const comprasHoy = compras.filter(c => c.fecha === hoy);
    const gastosHoy = comprasHoy.reduce((s, c) => s + c.monto, 0);

    const balance = cobradoHoy - gastosHoy;

    return `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
            <div style="padding:10px;background:#e8f5e9;border-radius:8px;text-align:center;">
                <div style="font-size:11px;color:#2e7d32;">Ingresos Hoy</div>
                <div style="font-size:16px;font-weight:700;color:#2e7d32;">${formatCurrency(cobradoHoy)}</div>
                <div style="font-size:10px;color:var(--color-text-muted);">${facturasHoy.filter(f => f.estado === 'pagada').length} facturas</div>
            </div>
            <div style="padding:10px;background:#fff3e0;border-radius:8px;text-align:center;">
                <div style="font-size:11px;color:#e65100;">Pendiente</div>
                <div style="font-size:16px;font-weight:700;color:#e65100;">${formatCurrency(pendienteHoy)}</div>
            </div>
            <div style="padding:10px;background:#ffebee;border-radius:8px;text-align:center;">
                <div style="font-size:11px;color:#c62828;">Gastos Hoy</div>
                <div style="font-size:16px;font-weight:700;color:#c62828;">${formatCurrency(gastosHoy)}</div>
            </div>
            <div style="padding:10px;background:${balance >= 0 ? '#e3f2fd' : '#ffebee'};border-radius:8px;text-align:center;">
                <div style="font-size:11px;color:${balance >= 0 ? '#1565c0' : '#c62828'};">Balance</div>
                <div style="font-size:16px;font-weight:700;color:${balance >= 0 ? '#1565c0' : '#c62828'};">${formatCurrency(balance)}</div>
            </div>
        </div>
    `;
}

function renderCompras() {
    const compras = JSON.parse(localStorage.getItem('servieltec_compras') || '[]');
    if (compras.length === 0) {
        return '<p style="text-align:center;color:var(--color-text-muted);padding:20px;">Sin compras registradas</p>';
    }
    return `
        <table class="data-table">
            <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Proveedor</th><th>Factura</th><th>Monto</th></tr></thead>
            <tbody>
                ${compras.slice(0, 20).map(c => `
                    <tr>
                        <td>${c.fecha}</td>
                        <td>${c.descripcion}</td>
                        <td><span class="badge badge-info">${c.categoria}</span></td>
                        <td>${c.proveedor || '-'}</td>
                        <td>${c.facturaProveedor || '-'}</td>
                        <td style="font-weight:600;color:var(--color-danger);">${formatCurrency(c.monto)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function desgloseFacturas(estado) {
    const todas = _read();
    const filtradas = todas.filter(f => f.estado === estado);
    const total = filtradas.reduce((s, f) => s + f.monto, 0);
    const titulo = estado === 'pagada' ? 'Total Cobrado' : estado === 'pendiente' ? 'Pendiente de Cobro' : 'Multas';
    const color = estado === 'pagada' ? '#2e7d32' : estado === 'pendiente' ? '#e65100' : '#c62828';

    const itemsHtml = filtradas.length === 0
        ? '<p style="text-align:center;color:var(--color-text-muted);padding:20px;">Sin facturas en esta categoría</p>'
        : `<table class="data-table" style="margin-bottom:12px;">
            <thead><tr><th>Factura</th><th>Cliente</th><th>Orden</th><th>Monto</th><th>Fecha</th></tr></thead>
            <tbody>${filtradas.map(f => `
                <tr>
                    <td><strong>${f.id}</strong></td>
                    <td>${f.cliente}</td>
                    <td>#${f.orden}</td>
                    <td style="font-weight:600;">${formatCurrency(f.monto)}</td>
                    <td>${f.fecha}</td>
                </tr>
            `).join('')}</tbody>
        </table>`;

    showModal(`${titulo} (${filtradas.length})`, `
        <div style="padding:12px;background:${color}15;border-radius:8px;margin-bottom:16px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:${color};">${formatCurrency(total)}</div>
            <div style="font-size:12px;color:var(--color-text-muted);">${filtradas.length} facturas</div>
        </div>
        ${itemsHtml}
    `);
}

function mostrarBalance(tipo) {
    const hoy = new Date();
    let titulo = '', fechaInicio = '', fechaFin = '';

    if (tipo === 'diario') {
        titulo = `Balance Diario - ${hoy.toLocaleDateString('es-AR')}`;
        fechaInicio = hoy.toISOString().split('T')[0];
        fechaFin = fechaInicio;
    } else if (tipo === 'semanal') {
        const lunes = new Date(hoy);
        lunes.setDate(hoy.getDate() - hoy.getDay() + 1);
        const domingo = new Date(lunes);
        domingo.setDate(lunes.getDate() + 6);
        titulo = `Balance Semanal: ${lunes.toLocaleDateString('es-AR')} al ${domingo.toLocaleDateString('es-AR')}`;
        fechaInicio = lunes.toISOString().split('T')[0];
        fechaFin = domingo.toISOString().split('T')[0];
    } else {
        titulo = `Balance Mensual - ${hoy.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`;
        fechaInicio = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
        const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        fechaFin = ultimoDia.toISOString().split('T')[0];
    }

    const todas = _read();
    const facturasRango = todas.filter(f => f.fecha >= fechaInicio && f.fecha <= fechaFin);
    const ingresos = facturasRango.filter(f => f.estado === 'pagada').reduce((s, f) => s + f.monto, 0);
    const pendientes = facturasRango.filter(f => f.estado === 'pendiente').reduce((s, f) => s + f.monto, 0);

    const compras = JSON.parse(localStorage.getItem('servieltec_compras') || '[]');
    const gastos = compras.filter(c => c.fecha >= fechaInicio && c.fecha <= fechaFin).reduce((s, c) => s + c.monto, 0);

    const balance = ingresos - gastos;

    showModal(titulo, `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div style="padding:12px;background:#e8f5e9;border-radius:8px;text-align:center;">
                <div style="font-size:11px;color:#2e7d32;"><i class="fas fa-arrow-down"></i> Ingresos</div>
                <div style="font-size:20px;font-weight:700;color:#2e7d32;">${formatCurrency(ingresos)}</div>
                <div style="font-size:11px;color:var(--color-text-muted);">${facturasRango.filter(f => f.estado === 'pagada').length} facturas pagadas</div>
            </div>
            <div style="padding:12px;background:#ffebee;border-radius:8px;text-align:center;">
                <div style="font-size:11px;color:#c62828;"><i class="fas fa-arrow-up"></i> Gastos</div>
                <div style="font-size:20px;font-weight:700;color:#c62828;">${formatCurrency(gastos)}</div>
                <div style="font-size:11px;color:var(--color-text-muted);">Compras de insumos</div>
            </div>
        </div>
        <div style="padding:12px;background:${balance >= 0 ? '#e3f2fd' : '#ffebee'};border-radius:8px;text-align:center;margin-bottom:16px;">
            <div style="font-size:11px;color:${balance >= 0 ? '#1565c0' : '#c62828'};">BALANCE NETO</div>
            <div style="font-size:24px;font-weight:700;color:${balance >= 0 ? '#1565c0' : '#c62828'};">${formatCurrency(balance)}</div>
        </div>
        <div style="font-size:13px;">
            <p><strong>Pendientes de cobro:</strong> ${formatCurrency(pendientes)}</p>
            <p><strong>Facturas en período:</strong> ${facturasRango.length}</p>
        </div>
    `);
}

function mostrarFormularioCompra() {
    const content = `
        <div class="form-group">
            <label>Descripción del gasto *</label>
            <input type="text" class="form-control" id="compraDesc" placeholder="Ej: Repuesto, Herramienta, Gas etc.">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Monto *</label>
                <input type="number" class="form-control" id="compraMonto" placeholder="0">
            </div>
            <div class="form-group">
                <label>Fecha</label>
                <input type="date" class="form-control" id="compraFecha" value="${new Date().toISOString().split('T')[0]}">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Categoría</label>
                <select class="form-control" id="compraCat">
                    <option value="Repuestos">Repuestos</option>
                    <option value="Herramientas">Herramientas</option>
                    <option value="Insumos">Insumos</option>
                    <option value="Servicios">Servicios</option>
                    <option value="Otro">Otro</option>
                </select>
            </div>
            <div class="form-group">
                <label>Proveedor</label>
                <input type="text" class="form-control" id="compraProv" placeholder="Nombre del proveedor">
            </div>
        </div>
        <div class="form-group">
            <label>N° Factura / Remito</label>
            <input type="text" class="form-control" id="compraFactura" placeholder="Número de factura del proveedor">
        </div>
        <div class="form-group">
            <label>Notas</label>
            <textarea class="form-control" id="compraNotas" rows="2" placeholder="Detalles adicionales..."></textarea>
        </div>
    `;
    showModal('Registrar Compra / Gasto', content, () => {
        const desc = document.getElementById('compraDesc')?.value?.trim();
        const monto = parseInt(document.getElementById('compraMonto')?.value) || 0;
        const fecha = document.getElementById('compraFecha')?.value;
        const categoria = document.getElementById('compraCat')?.value;
        const proveedor = document.getElementById('compraProv')?.value?.trim() || '';
        const factura = document.getElementById('compraFactura')?.value?.trim() || '';
        const notas = document.getElementById('compraNotas')?.value?.trim() || '';

        if (!desc || !monto) {
            showToast('Completá descripción y monto', 'error');
            return false;
        }

        const compras = JSON.parse(localStorage.getItem('servieltec_compras') || '[]');
        compras.unshift({
            id: Date.now(),
            descripcion: desc,
            monto,
            fecha,
            categoria,
            proveedor,
            facturaProveedor: factura,
            notas,
        });
        localStorage.setItem('servieltec_compras', JSON.stringify(compras));
        showToast('Compra registrada', 'success');
    });
}

function refreshAllSections() {
    renderTablaFromStorage();
    const registroBody = document.getElementById('registroContableBody');
    if (registroBody) registroBody.innerHTML = renderRegistroContable();
    const comprasBody = document.getElementById('comprasBody');
    if (comprasBody) comprasBody.innerHTML = renderCompras();
}

export function initFacturacion() {
    renderTablaFromStorage();

    document.getElementById('btnNuevaFactura')?.addEventListener('click', () => mostrarFormularioFactura());
    document.getElementById('btnGenDesdeOrden')?.addEventListener('click', () => mostrarSelectorOrden());
    document.getElementById('btnNuevaCompra')?.addEventListener('click', () => mostrarFormularioCompra());

    document.getElementById('searchFactura')?.addEventListener('input', () => renderTablaFromStorage());

    window._facturacionListener = () => refreshAllSections();
    window.addEventListener('ordenes-change', window._facturacionListener);
    window.addEventListener('servicios-domicilio-change', window._facturacionListener);

    window.app = window.app || {};

    window.app.facturacion = {
        ver: (id) => { const f = _find(id); if (f) mostrarDetalleFactura(f); },
        editar: (id) => { const f = _find(id); if (f) mostrarFormularioFactura(f); },
        pdf: (id) => { const f = _find(id); if (f) generarPDF(f); },
        generarDeOrden: (id) => { generarFacturaDesdeOrden(id); },
        desglose: (estado) => { desgloseFacturas(estado); },
        balance: (tipo) => { mostrarBalance(tipo); },
        marcarPagada: (id) => {
            const f = _update(id, {
                estado: 'pagada',
                fechaPago: new Date().toISOString().split('T')[0]
            });
            if (!f) return;
            refreshAllSections();
            showToast(`Factura ${f.id} marcada como pagada - ${formatCurrency(f.monto)} registrado`, 'success');
        },
    };
}

function mostrarSelectorOrden() {
    const ordenes = getOrdenes().filter(o =>
        o.estado === 'en_taller' || o.estado === 'retirar'
    );

    const serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');
    const facturasArr = _read();
    const serviciosFacturar = serviciosDom.filter(s => {
        if (s.estado !== 'completado' && s.estado !== 'pendiente_seguimiento' && s.estado !== 'facturado') return false;
        return !facturasArr.find(f => f.orden === s.id || f.orden === s.id);
    }).map(s => ({
        id: s.id,
        cliente: s.cliente.nombre,
        tel: s.cliente.telefono,
        equipo: `${s.equipo.tipo} ${s.equipo.marca}`,
        precio: s.precio || 0,
        esServicioDomicilio: true,
    }));

    const todas = [...ordenes, ...serviciosFacturar];

    if (todas.length === 0) {
        showToast('No hay órdenes o servicios listos para facturar', 'error');
        return;
    }

    const listaHtml = todas.map(o => {
        const total = o.diagnostico ? o.diagnostico.total : o.precio;
        const domBadge = o.esServicioDomicilio ? ' <span style="font-size:10px;background:#e8eaf6;color:#1a237e;padding:1px 6px;border-radius:4px;">🏠 Domicilio</span>' : '';
        return `
            <div style="padding:12px;border:1px solid var(--color-border);border-radius:8px;margin-bottom:8px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;" 
                 onmouseover="this.style.background='var(--color-footer-bg)'" 
                 onmouseout="this.style.background='white'"
                 onclick="window.app.facturacion.generarDeOrden(${JSON.stringify(o.id).replace(/"/g, '&quot;')})">
                <div>
                    <strong>#${o.id}</strong> - ${o.cliente}${domBadge}
                    <div style="font-size:12px;color:var(--color-text-muted);">${o.equipo} | ${o.estado === 'retirar' || o.estado === 'completado' ? 'Listo' : 'En reparación'}</div>
                </div>
                <div style="font-weight:700;">${total > 0 ? formatCurrency(total) : 'Pendiente'}</div>
            </div>
        `;
    }).join('');

    showModal('Seleccionar Orden para Facturar', `
        <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:12px;">Elegí una orden para generar la factura automáticamente:</p>
        ${listaHtml}
    `);
}

export function generarFacturaDesdeOrden(ordenId) {
    let orden = getOrdenes().find(o => o.id === ordenId);
    let esServicioDomicilio = false;
    let servicioDom = null;
    let serviciosDom = JSON.parse(localStorage.getItem('servieltec_servicios_domicilio') || '[]');

    if (!orden) {
        servicioDom = serviciosDom.find(s => s.id === ordenId);
        if (!servicioDom) return null;
        esServicioDomicilio = true;
    }

    const facturasArr = _read();
    const existe = facturasArr.find(f => f.orden === ordenId);
    if (existe) {
        showToast(`Ya existe la factura ${existe.id} para esta orden`, 'error');
        return null;
    }

    let items = [];
    let total = 0;
    let cliente, tel, notas;
    let ordenRef = ordenId;

    if (esServicioDomicilio && servicioDom) {
        cliente = servicioDom.cliente.nombre;
        tel = servicioDom.cliente.telefono;
        notas = `Servicio a domicilio #${servicioDom.id} - ${servicioDom.equipo.tipo} ${servicioDom.equipo.marca}`;

        items.push({ desc: `Servicio a domicilio - ${servicioDom.tipoServicio}`, precio: 3000 });
        total += 3000;

        if (servicioDom.ordenTrabajo?.repuestosUtilizados) {
            servicioDom.ordenTrabajo.repuestosUtilizados.forEach(r => {
                const subtotal = r.precio * (r.cantidad || 1);
                items.push({ desc: r.nombre, precio: subtotal });
                total += subtotal;
            });
        }

        if (servicioDom.presupuesto?.aprobado === true) {
            items.push({ desc: servicioDom.presupuesto.descripcion || 'Trabajo adicional', precio: servicioDom.presupuesto.monto });
            total += servicioDom.presupuesto.monto;
        }

        servicioDom.estado = 'facturado';
        servicioDom.precio = total;
        localStorage.setItem('servieltec_servicios_domicilio', JSON.stringify(serviciosDom));

        const ordenes = getOrdenes();
        const ordenDom = ordenes.find(o => o.servicioDomicilioId === servicioDom.id);
        if (ordenDom) {
            ordenDom.estado = 'retirado';
            ordenDom.fechaRetirado = new Date().toISOString().split('T')[0];
            const fechaGar = new Date();
            fechaGar.setDate(fechaGar.getDate() + 30);
            ordenDom.fechaGarantia = fechaGar.toISOString().split('T')[0];
            ordenDom.garantiaDias = 30;
            ordenRef = ordenDom.id;
        }
    } else {
        cliente = orden.cliente;
        tel = orden.tel;
        notas = `Generada desde orden #${orden.id}. ${orden.notas || ''}`;

        const d = orden.diagnostico;
        if (d) {
            d.repuestos.forEach(r => {
                items.push({ desc: r.nombre, precio: r.precio });
                total += r.precio;
            });
            items.push({ desc: 'Mano de obra', precio: d.manoDeObra });
            total += d.manoDeObra;
        } else {
            items.push({ desc: `Servicio de ${orden.tipo} - ${orden.equipo}`, precio: 0 });
        }

        orden.estado = 'retirado';
        orden.precio = total;
        const fechaRetiro = new Date();
        orden.fechaRetirado = fechaRetiro.toISOString().split('T')[0];
        fechaRetiro.setDate(fechaRetiro.getDate() + 30);
        orden.fechaGarantia = fechaRetiro.toISOString().split('T')[0];
        orden.garantiaDias = 30;
    }

    const nuevaFactura = {
        id: _nextId(),
        cliente,
        tel,
        orden: ordenRef,
        monto: total,
        estado: 'pendiente',
        fecha: new Date().toISOString().split('T')[0],
        items,
        notas,
    };

    _save(nuevaFactura);

    refreshAllSections();
    showToast(`Factura ${nuevaFactura.id} generada`, 'success');
    window.dispatchEvent(new CustomEvent('ordenes-change'));
    window.dispatchEvent(new CustomEvent('servicios-domicilio-change'));
    return nuevaFactura;
}

function mostrarDetalleFactura(f) {
    const itemsHtml = f.items.map(item => `
        <tr>
            <td>${item.desc}</td>
            <td style="text-align:right;">${item.precio > 0 ? formatCurrency(item.precio) : '-'}</td>
        </tr>
    `).join('');

    const telLimpio = (f.tel || '').replace(/[^0-9]/g, '');
    const whatsappUrl = telLimpio
        ? `https://wa.me/${telLimpio.startsWith('54') ? telLimpio : '54' + telLimpio}?text=${encodeURIComponent(`Hola ${f.cliente}, le enviamos la factura ${f.id} por un total de ${formatCurrency(f.monto)}. Gracias por su preferencia - Multiservicios ServiElitec`)}` 
        : '';

    showModal(`Factura ${f.id}`, `
        <div class="detail-grid" style="margin-bottom:16px;">
            <div class="detail-card">
                <h4>Cliente</h4>
                <p>${f.cliente}</p>
                <p style="font-size:13px;color:var(--color-text-muted);">${f.tel}</p>
            </div>
            <div class="detail-card">
                <h4>Orden de Servicio</h4>
                <p>#${f.orden}</p>
            </div>
            <div class="detail-card">
                <h4>Estado</h4>
                <p><span class="badge ${estadoBadge[f.estado]}">${estadoLabels[f.estado]}</span></p>
            </div>
            <div class="detail-card">
                <h4>Fecha</h4>
                <p>${f.fecha}</p>
            </div>
        </div>
        <table class="data-table" style="margin-bottom:12px;">
            <thead><tr><th>Descripción</th><th style="text-align:right;">Precio</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot>
                <tr style="font-weight:700;border-top:2px solid var(--color-border);">
                    <td>TOTAL</td>
                    <td style="text-align:right;">${formatCurrency(f.monto)}</td>
                </tr>
            </tfoot>
        </table>
        ${f.notas ? `<div style="padding:10px;background:var(--color-footer-bg);border-radius:8px;font-size:13px;color:var(--color-text-muted);"><i class="fas fa-info-circle"></i> ${f.notas}</div>` : ''}
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
            ${f.estado === 'pendiente' ? `
            <button class="btn btn-primary" style="flex:1;background:#2e7d32;" onclick="window.app.facturacion.marcarPagada('${f.id}');document.getElementById('app-modal').classList.remove('active');">
                <i class="fas fa-check-circle"></i> Marcar como Pagada
            </button>` : ''}
            <button class="btn btn-accent" style="flex:1;" onclick="window.app.facturacion.pdf('${f.id}')">
                <i class="fas fa-file-pdf"></i> Ver / Imprimir PDF
            </button>
            ${whatsappUrl ? `
            <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="flex:1;background:#25d366;text-align:center;text-decoration:none;">
                <i class="fab fa-whatsapp"></i> Enviar por WhatsApp
            </a>` : ''}
        </div>
    `);
}

function generarBloqueFactura(f, tipo) {
    const itemsHtml = f.items.map(item => `
        <tr>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:12px;">${item.desc}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12px;">${item.precio > 0 ? formatCurrency(item.precio) : '-'}</td>
        </tr>
    `).join('');

    return `
        <div class="invoice-block">
            <div class="copy-label">${tipo}</div>
            <div class="header">
                <div class="company">
                    <img src="img/recorte.jpg" alt="Servieltec" style="height:45px;object-fit:contain;margin-bottom:4px;">
                    <h1>Multiservicios ServiElitec</h1>
                    <p>Av. Ejemplo 1234, Buenos Aires</p>
                    <p>Tel: (011) 4567-8900</p>
                    <p>CUIT: 30-12345678-9</p>
                </div>
                <div class="invoice-num">
                    <h2>${f.id}</h2>
                    <p>Fecha: ${f.fecha}</p>
                    <p style="margin-top:6px;"><span class="badge badge-${f.estado}">${estadoLabels[f.estado]}</span></p>
                </div>
            </div>
            <div class="client-info">
                <div>
                    <h4>Cliente</h4>
                    <p>${f.cliente}</p>
                </div>
                <div>
                    <h4>Teléfono</h4>
                    <p>${f.tel}</p>
                </div>
                <div>
                    <h4>Orden de Servicio</h4>
                    <p>#${f.orden}</p>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Descripción</th>
                        <th style="text-align:right;">Precio</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                    <tr class="total-row">
                        <td style="padding:10px;font-weight:700;">TOTAL</td>
                        <td style="padding:10px;text-align:right;font-weight:700;font-size:16px;">${formatCurrency(f.monto)}</td>
                    </tr>
                </tbody>
            </table>
            ${f.notas ? `<div class="notes"><strong>Notas:</strong> ${f.notas}</div>` : ''}
            <div class="footer">
                <p>Multiservicios ServiElitec | Factura generada electrónicamente</p>
                <p style="margin-top:4px;">Gracias por su preferencia</p>
            </div>
        </div>
    `;
}

function generarPDF(f) {
    const telLimpio = (f.tel || '').replace(/[^0-9]/g, '');
    const whatsappHref = telLimpio
        ? `https://wa.me/${telLimpio.startsWith('54') ? telLimpio : '54' + telLimpio}?text=${encodeURIComponent(`Hola ${f.cliente}, le adjuntamos la factura ${f.id} por un total de ${formatCurrency(f.monto)}. Gracias por su preferencia - Multiservicios ServiElitec`)}`
        : '';

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Factura ${f.id} - Multiservicios ServiElitec</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family:'Inter',sans-serif; color:#1a1a1a; font-size:12px; }
            .invoice-block { padding:12px 20px; }
            .copy-label { text-align:center; font-size:9px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#999; margin-bottom:6px; padding:2px 0; border-bottom:1px dashed #ccc; }
            .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; padding-bottom:8px; border-bottom:2px solid #f9b81b; }
            .company h1 { font-size:16px; color:#0b1e33; }
            .company p { font-size:10px; color:#666; margin-top:1px; }
            .invoice-num { text-align:right; }
            .invoice-num h2 { font-size:20px; color:#f9b81b; }
            .invoice-num p { font-size:10px; color:#666; }
            .client-info { background:#f8f9fa; padding:8px 12px; border-radius:6px; margin-bottom:10px; display:flex; justify-content:space-between; }
            .client-info div h4 { font-size:9px; text-transform:uppercase; color:#999; margin-bottom:2px; letter-spacing:0.5px; }
            .client-info div p { font-size:11px; font-weight:500; }
            table { width:100%; border-collapse:collapse; margin-bottom:8px; }
            th { background:#0b1e33; color:white; padding:5px 8px; text-align:left; font-size:9px; text-transform:uppercase; letter-spacing:0.5px; }
            th:last-child { text-align:right; }
            td { padding:4px 8px; font-size:11px; }
            .total-row { background:#f8f9fa; }
            .total-row td { padding:6px 8px; font-size:13px; font-weight:700; }
            .badge { display:inline-block; padding:2px 8px; border-radius:20px; font-size:9px; font-weight:600; }
            .badge-pagada { background:#e8f5e9; color:#2e7d32; }
            .badge-pendiente { background:#fff3e0; color:#e65100; }
            .badge-multa { background:#ffebee; color:#c62828; }
            .notes { margin-top:6px; padding:6px 10px; background:#fff3e0; border-left:3px solid #ff9800; border-radius:3px; font-size:10px; color:#666; }
            .footer { margin-top:10px; text-align:center; font-size:9px; color:#999; border-top:1px solid #eee; padding-top:6px; }
            .cut-line { border:none; border-top:2px dashed #ccc; margin:4px 0; }
            .whatsapp-bar { text-align:center; margin-top:10px; padding:8px; }
            .whatsapp-bar a { display:inline-block; background:#25d366; color:white; padding:8px 20px; border-radius:20px; text-decoration:none; font-size:12px; font-weight:600; }
            .whatsapp-bar a:hover { background:#1da851; }
            @media print {
                body { padding:0; margin:0; }
                .invoice-block { page-break-inside:avoid; }
                .cut-line { margin:4px 0; }
                .no-print { display:none !important; }
            }
            @page { size:A4 portrait; margin:8mm; }
        </style>
    </head>
    <body>
        ${generarBloqueFactura(f, 'ORIGINAL')}
        <hr class="cut-line">
        ${generarBloqueFactura(f, 'COPIA')}
        ${whatsappHref ? `<div class="whatsapp-bar no-print"><a href="${whatsappHref}" target="_blank" rel="noopener noreferrer">📱 Enviar por WhatsApp</a></div>` : ''}
    </body>
    </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = function() { printWindow.print(); };
}

function mostrarFormularioFactura(factura = null) {
    const title = factura ? 'Editar Factura' : 'Nueva Factura';
    const content = `
        <div class="form-row">
            <div class="form-group">
                <label>Cliente</label>
                <input type="text" class="form-control" id="ffCliente" value="${factura?.cliente || ''}" placeholder="Nombre del cliente">
            </div>
            <div class="form-group">
                <label>Teléfono</label>
                <input type="text" class="form-control" id="ffTel" value="${factura?.tel || ''}" placeholder="Teléfono">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Orden #</label>
                <input type="text" class="form-control" id="ffOrden" value="${factura?.orden || ''}" placeholder="N° de orden">
            </div>
            <div class="form-group">
                <label>Estado</label>
                <select class="form-control" id="ffEstado">
                    <option value="pendiente" ${factura?.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="pagada" ${factura?.estado === 'pagada' ? 'selected' : ''}>Pagada</option>
                    <option value="multa" ${factura?.estado === 'multa' ? 'selected' : ''}>Con Multa</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label>Monto Total</label>
            <input type="number" class="form-control" id="ffMonto" value="${factura?.monto || ''}" placeholder="0">
        </div>
        <div class="form-group">
            <label>Descripción del servicio</label>
            <textarea class="form-control" id="ffItems" rows="3" placeholder="Detalle los servicios realizados...">${factura?.items?.map(i => i.desc).join('\n') || ''}</textarea>
        </div>
        <div class="form-group">
            <label>Notas</label>
            <textarea class="form-control" id="ffNotas" rows="2" placeholder="Notas adicionales...">${factura?.notas || ''}</textarea>
        </div>
    `;
    showModal(title, content, () => {
        showToast(factura ? 'Factura actualizada' : 'Factura creada correctamente');
    });
}

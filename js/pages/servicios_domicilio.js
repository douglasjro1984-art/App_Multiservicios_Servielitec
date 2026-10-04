import { formatCurrency, showToast, showModal, confirmAction, generateId, loadImageBase64, COMPANY_NAME } from '../utils/helpers.js';
import { getOrdenes, notifyOrdenesChange } from './ordenes.js';
import { generarFacturaDesdeOrden } from './facturacion.js';

const serviciosKey = 'servieltec_servicios_domicilio';

const COSTO_VISITA = 3000;

const estadoLabels = {
    pendiente: 'Pendiente',
    asignado: 'Asignado',
    en_curso: 'En Curso',
    completado: 'Completado',
    pendiente_seguimiento: 'Pendiente Seguimiento',
    cancelado: 'Cancelado',
    facturado: 'Facturado',
};

const estadoBadge = {
    pendiente: 'badge-warning',
    asignado: 'badge-info',
    en_curso: 'badge-success',
    completado: 'badge-success',
    pendiente_seguimiento: 'badge-warning',
    cancelado: 'badge-danger',
    facturado: 'badge-accent',
};

const tipoServicioLabels = {
    mantenimiento: 'Mantenimiento',
    reparacion: 'Reparación',
    instalacion: 'Instalación',
    relevamiento: 'Relevamiento',
    otro: 'Otro',
};

let filtroActual = 'todos';
let servicios = [];
let currentRole = 'admin';

function getServicios() {
    return JSON.parse(localStorage.getItem(serviciosKey) || '[]');
}

function saveServicios(data) {
    localStorage.setItem(serviciosKey, JSON.stringify(data));
}

function initStorage() {
    const data = getServicios();
    if (data.length === 0) {
        saveServicios([]);
    }
}

function notifyServiciosChange(detail) {
    window.dispatchEvent(new CustomEvent('servicios-domicilio-change', { detail }));
}

const filtrosByRole = {
    admin: [
        { key: 'todos', label: 'Todas', icon: 'fa-list' },
        { key: 'pendiente', label: 'Pendientes', icon: 'fa-clock' },
        { key: 'asignado', label: 'Asignados', icon: 'fa-user-check' },
        { key: 'en_curso', label: 'En Curso', icon: 'fa-spinner' },
        { key: 'completado', label: 'Completados', icon: 'fa-check-circle' },
        { key: 'facturado', label: 'Facturados', icon: 'fa-file-invoice-dollar' },
        { key: 'pendiente_seguimiento', label: 'Pendientes', icon: 'fa-exclamation-triangle' },
    ],
    recepcion: [
        { key: 'todos', label: 'Todas', icon: 'fa-list' },
        { key: 'pendiente', label: 'Pendientes', icon: 'fa-clock' },
        { key: 'asignado', label: 'Asignados', icon: 'fa-user-check' },
        { key: 'completado', label: 'Completados', icon: 'fa-check-circle' },
        { key: 'facturado', label: 'Facturados', icon: 'fa-file-invoice-dollar' },
        { key: 'cancelado', label: 'Cancelados', icon: 'fa-times-circle' },
    ],
    tecnico: [
        { key: 'todos', label: 'Todas', icon: 'fa-list' },
        { key: 'asignado', label: 'Asignados', icon: 'fa-user-check' },
        { key: 'en_curso', label: 'En Curso', icon: 'fa-spinner' },
        { key: 'pendiente_seguimiento', label: 'Pendientes', icon: 'fa-exclamation-triangle' },
    ],
};

function renderFilters() {
    const bar = document.querySelector('.filters-bar');
    if (!bar) return;
    const filtros = filtrosByRole[currentRole] || filtrosByRole.admin;
    bar.innerHTML = filtros.map(f =>
        `<button class="filter-chip${f.key === filtroActual ? ' active' : ''}" data-filtro="${f.key}"><i class="fas ${f.icon}"></i> ${f.label}</button>`
    ).join('');
    bar.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => filtrarServicios(chip.dataset.filtro));
    });
}

function filtrarServicios(filtro) {
    filtroActual = filtro;
    const all = getServicios();
    if (filtro === 'todos') servicios = all;
    else servicios = all.filter(s => s.estado === filtro);
    renderTabla();
    document.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.filtro === filtro);
    });
}

function renderTabla() {
    const tbody = document.getElementById('servDomBody');
    if (!tbody) return;

    if (servicios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fas fa-home"></i><h3>Sin servicios</h3><p>No hay servicios a domicilio en esta categoría</p></td></tr>`;
        return;
    }

    const isTecnico = currentRole === 'tecnico';
    const isRecepcion = currentRole === 'recepcion';

    tbody.innerHTML = servicios.map(s => {
        let badgeExtra = '';
        if (s.estado === 'pendiente') badgeExtra = '<div style="font-size:10px;color:var(--color-warning);margin-top:2px;">⏳ Sin asignar</div>';
        if (s.estado === 'asignado') badgeExtra = `<div style="font-size:10px;color:var(--color-info);margin-top:2px;">📅 ${s.fechaProgramada || 'Sin fecha'}</div>`;
        if (s.estado === 'pendiente_seguimiento') badgeExtra = '<div style="font-size:10px;color:var(--color-warning);margin-top:2px;">⚠️ Trabajo incompleto</div>';

        let acciones = '';

        if (isTecnico) {
            if (s.estado === 'asignado') {
                acciones = `<button class="btn btn-sm btn-primary" onclick="window.app.servDom.iniciarServicio('${s.id}')" title="Iniciar servicio" style="background:#1565c0;"><i class="fas fa-play"></i> Iniciar</button>`;
            } else if (s.estado === 'en_curso') {
                acciones = `<button class="btn btn-sm btn-primary" onclick="window.app.servDom.abrirOrdenTrabajo('${s.id}')" title="Completar orden de trabajo" style="background:#2e7d32;"><i class="fas fa-clipboard-check"></i> Orden Trabajo</button>`;
            } else if (s.estado === 'pendiente_seguimiento') {
                acciones = `<button class="btn btn-sm btn-primary" onclick="window.app.servDom.abrirOrdenTrabajo('${s.id}')" title="Completar pendientes" style="background:#e65100;"><i class="fas fa-clipboard-check"></i> Completar</button>`;
            } else if (s.estado === 'completado') {
                acciones = `
                    <button class="btn btn-sm btn-primary" onclick="window.app.servDom.generarFactura('${s.id}')" title="Generar factura" style="background:#2e7d32;"><i class="fas fa-file-invoice-dollar"></i> Facturar</button>
                    ${s.ordenTrabajo ? `<button class="btn btn-sm btn-primary" onclick="window.app.servDom.enviarPDF('${s.id}')" title="Enviar PDF al cliente" style="background:#1565c0;"><i class="fas fa-file-pdf"></i></button>` : ''}
                    <button class="btn btn-sm btn-outline" onclick="window.app.servDom.ver('${s.id}')" title="Ver"><i class="fas fa-eye"></i></button>
                `;
            } else {
                acciones = `<button class="btn btn-sm btn-outline" onclick="window.app.servDom.ver('${s.id}')" title="Ver"><i class="fas fa-eye"></i></button>`;
            }
        } else if (isRecepcion) {
            if (s.estado === 'pendiente') {
                acciones = `
                    <button class="btn btn-sm btn-primary" onclick="window.app.servDom.asignarTecnico('${s.id}')" title="Asignar técnico" style="background:#1565c0;"><i class="fas fa-user-check"></i></button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.servDom.ver('${s.id}')" title="Ver"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.servDom.editar('${s.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="window.app.servDom.cancelar('${s.id}')" title="Cancelar"><i class="fas fa-times"></i></button>
                `;
            } else if (s.estado === 'completado') {
                acciones = `
                    <button class="btn btn-sm btn-primary" onclick="window.app.servDom.generarFactura('${s.id}')" title="Generar factura" style="background:#2e7d32;"><i class="fas fa-file-invoice-dollar"></i></button>
                    ${s.ordenTrabajo ? `<button class="btn btn-sm btn-primary" onclick="window.app.servDom.enviarPDF('${s.id}')" title="Enviar PDF al cliente" style="background:#1565c0;"><i class="fas fa-file-pdf"></i></button>` : ''}
                    <button class="btn btn-sm btn-outline" onclick="window.app.servDom.ver('${s.id}')" title="Ver"><i class="fas fa-eye"></i></button>
                `;
            } else if (s.estado === 'facturado') {
                const facturasLocal = JSON.parse(localStorage.getItem('servieltec_facturas') || '[]');
                const yaFacturado = facturasLocal.find(f => f.orden === s.id);
                acciones = `
                    ${!yaFacturado ? `<button class="btn btn-sm btn-primary" onclick="window.app.servDom.generarFactura('${s.id}')" title="Generar factura" style="background:#2e7d32;"><i class="fas fa-file-invoice-dollar"></i></button>` : ''}
                    ${s.ordenTrabajo ? `<button class="btn btn-sm btn-primary" onclick="window.app.servDom.enviarPDF('${s.id}')" title="Enviar PDF al cliente" style="background:#1565c0;"><i class="fas fa-file-pdf"></i></button>` : ''}
                    <button class="btn btn-sm btn-outline" onclick="window.app.servDom.ver('${s.id}')" title="Ver"><i class="fas fa-eye"></i></button>
                `;
            } else {
                acciones = `
                    <button class="btn btn-sm btn-outline" onclick="window.app.servDom.ver('${s.id}')" title="Ver"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.servDom.editar('${s.id}')" title="Editar"><i class="fas fa-edit"></i></button>
                `;
            }
        } else {
            if (s.estado === 'pendiente') {
                acciones = `
                    <button class="btn btn-sm btn-primary" onclick="window.app.servDom.asignarTecnico('${s.id}')" title="Asignar técnico"><i class="fas fa-user-check"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="window.app.servDom.cancelar('${s.id}')" title="Cancelar"><i class="fas fa-times"></i></button>
                `;
            } else if (s.estado === 'completado') {
                acciones = `
                    <button class="btn btn-sm btn-primary" onclick="window.app.servDom.generarFactura('${s.id}')" title="Facturar"><i class="fas fa-file-invoice-dollar"></i></button>
                    ${s.ordenTrabajo ? `<button class="btn btn-sm btn-primary" onclick="window.app.servDom.enviarPDF('${s.id}')" title="Enviar PDF" style="background:#1565c0;"><i class="fas fa-file-pdf"></i></button>` : ''}
                `;
            } else if (s.estado === 'facturado') {
                const facturasLocal2 = JSON.parse(localStorage.getItem('servieltec_facturas') || '[]');
                const yaFacturado2 = facturasLocal2.find(f => f.orden === s.id);
                acciones = `
                    ${!yaFacturado2 ? `<button class="btn btn-sm btn-primary" onclick="window.app.servDom.generarFactura('${s.id}')" title="Generar factura" style="background:#2e7d32;"><i class="fas fa-file-invoice-dollar"></i></button>` : ''}
                    ${s.ordenTrabajo ? `<button class="btn btn-sm btn-primary" onclick="window.app.servDom.enviarPDF('${s.id}')" title="Enviar PDF" style="background:#1565c0;"><i class="fas fa-file-pdf"></i></button>` : ''}
                `;
            }
            acciones += `<button class="btn btn-sm btn-outline" onclick="window.app.servDom.ver('${s.id}')" title="Ver"><i class="fas fa-eye"></i></button>`;
        }

        return `
        <tr>
            <td><strong>#${s.id}</strong></td>
            <td>
                <div>${s.cliente.nombre}</div>
                <div style="font-size:11px;color:var(--color-text-muted);">${s.cliente.telefono}</div>
            </td>
            <td>
                <div>${s.equipo.tipo} - ${s.equipo.marca}</div>
                <div style="font-size:11px;color:var(--color-text-muted);">${s.equipo.descripcion || ''}</div>
            </td>
            <td>${tipoServicioLabels[s.tipoServicio] || s.tipoServicio}</td>
            <td>
                <span class="badge ${estadoBadge[s.estado]}">${estadoLabels[s.estado]}</span>
                ${badgeExtra}
            </td>
            <td>${s.fechaProgramada || '-'}</td>
            <td>${s.tecnicoAsignado || '-'}</td>
            <td>
                <div style="display:flex;gap:4px;flex-wrap:wrap;">${acciones}</div>
            </td>
        </tr>`;
    }).join('');
}

function getWhatsAppLink(servicio, mensaje) {
    const tel = servicio.cliente.telefono?.replace(/[^0-9]/g, '') || '';
    const msg = encodeURIComponent(mensaje);
    return `https://wa.me/${tel}?text=${msg}`;
}

function getMensajeInicial(servicio) {
    return (
        `Hola ${servicio.cliente.nombre}! 👋\n\n` +
        `✅ Tu servicio a domicilio fue registrado.\n\n` +
        `📋 *Servicio:* #${servicio.id}\n` +
        `🔧 *Tipo:* ${tipoServicioLabels[servicio.tipoServicio]}\n` +
        `📱 *Equipo:* ${servicio.equipo.tipo} ${servicio.equipo.marca}\n` +
        `📍 *Dirección:* ${servicio.cliente.direccion}\n` +
        `📅 *Fecha:* ${servicio.fechaProgramada || 'A confirmar'}\n\n` +
        `⚡ *Servieltec*`
    );
}

function mostrarFormularioServicio(servicio = null) {
    const title = servicio ? 'Editar Servicio a Domicilio' : 'Nuevo Servicio a Domicilio';
    const clientes = JSON.parse(localStorage.getItem('servieltec_clientes') || '[]');
    const tecnicos = JSON.parse(localStorage.getItem('servieltec_tecnicos') || '[]');
    const clientesOptions = clientes.map(c => `<option value="${c.id}" data-nombre="${c.nombre}" data-tel="${c.tel}" data-email="${c.email}" data-direccion="${c.direccion || ''}">${c.id} - ${c.nombre}</option>`).join('');

    const content = `
        <div class="form-group">
            <label><i class="fas fa-users"></i> Cliente registrado</label>
            <div style="display:flex;gap:8px;">
                <select class="form-control" id="sdClienteSelect" style="flex:1;">
                    <option value="">— Seleccionar cliente existente —</option>
                    ${clientesOptions}
                </select>
                <button type="button" class="btn btn-outline btn-sm" id="btnNuevoClienteServDom" style="white-space:nowrap;"><i class="fas fa-user-plus"></i> Nuevo</button>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Nombre *</label><input type="text" class="form-control" id="sdNombre" value="${servicio?.cliente?.nombre || ''}" placeholder="Nombre del cliente"></div>
            <div class="form-group"><label>Teléfono *</label><input type="tel" class="form-control" id="sdTelefono" value="${servicio?.cliente?.telefono || ''}" placeholder="5491155550000"></div>
        </div>
        <div class="form-group"><label>Dirección del servicio *</label><input type="text" class="form-control" id="sdDireccion" value="${servicio?.cliente?.direccion || ''}" placeholder="Dirección completa del domicilio"></div>
        <div class="form-row">
            <div class="form-group">
                <label>Tipo de servicio *</label>
                <select class="form-control" id="sdTipoServicio">
                    <option value="mantenimiento" ${servicio?.tipoServicio === 'mantenimiento' ? 'selected' : ''}>Mantenimiento</option>
                    <option value="reparacion" ${servicio?.tipoServicio === 'reparacion' ? 'selected' : ''}>Reparación</option>
                    <option value="instalacion" ${servicio?.tipoServicio === 'instalacion' ? 'selected' : ''}>Instalación</option>
                    <option value="relevamiento" ${servicio?.tipoServicio === 'relevamiento' ? 'selected' : ''}>Relevamiento</option>
                    <option value="otro" ${servicio?.tipoServicio === 'otro' ? 'selected' : ''}>Otro</option>
                </select>
            </div>
            <div class="form-group">
                <label>Equipo *</label>
                <select class="form-control" id="sdTipoEquipo">
                    <option value="Heladera" ${servicio?.equipo?.tipo === 'Heladera' ? 'selected' : ''}>Heladera</option>
                    <option value="Freezer" ${servicio?.equipo?.tipo === 'Freezer' ? 'selected' : ''}>Freezer</option>
                    <option value="Aire Acondicionado" ${servicio?.equipo?.tipo === 'Aire Acondicionado' ? 'selected' : ''}>Aire Acondicionado</option>
                    <option value="Lavarropas" ${servicio?.equipo?.tipo === 'Lavarropas' ? 'selected' : ''}>Lavarropas</option>
                    <option value="Secarropas" ${servicio?.equipo?.tipo === 'Secarropas' ? 'selected' : ''}>Secarropas</option>
                    <option value="Cocina" ${servicio?.equipo?.tipo === 'Cocina' ? 'selected' : ''}>Cocina</option>
                    <option value="Horno" ${servicio?.equipo?.tipo === 'Horno' ? 'selected' : ''}>Horno</option>
                    <option value="Microondas" ${servicio?.equipo?.tipo === 'Microondas' ? 'selected' : ''}>Microondas</option>
                    <option value="Otros" ${servicio?.equipo?.tipo === 'Otros' ? 'selected' : ''}>Otros</option>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Marca</label><input type="text" class="form-control" id="sdMarca" value="${servicio?.equipo?.marca || ''}" placeholder="Ej: Samsung, LG, BGH"></div>
            <div class="form-group"><label>Modelo</label><input type="text" class="form-control" id="sdModelo" value="${servicio?.equipo?.modelo || ''}" placeholder="Modelo (opcional)"></div>
        </div>
        <div class="form-group"><label>Descripción / Falla reportada</label><textarea class="form-control" id="sdDescripcion" rows="2" placeholder="Describa el problema o servicio solicitado...">${servicio?.equipo?.descripcion || ''}</textarea></div>
        <div class="form-row">
            <div class="form-group"><label>Fecha programada *</label><input type="date" class="form-control" id="sdFecha" value="${servicio?.fechaProgramada || ''}"></div>
            <div class="form-group"><label>Hora preferida</label>
                <select class="form-control" id="sdHora">
                    <option value="">A convenir</option>
                    <option value="08:00-10:00" ${servicio?.horaPreferida === '08:00-10:00' ? 'selected' : ''}>08:00 - 10:00</option>
                    <option value="10:00-12:00" ${servicio?.horaPreferida === '10:00-12:00' ? 'selected' : ''}>10:00 - 12:00</option>
                    <option value="12:00-14:00" ${servicio?.horaPreferida === '12:00-14:00' ? 'selected' : ''}>12:00 - 14:00</option>
                    <option value="14:00-16:00" ${servicio?.horaPreferida === '14:00-16:00' ? 'selected' : ''}>14:00 - 16:00</option>
                    <option value="16:00-18:00" ${servicio?.horaPreferida === '16:00-18:00' ? 'selected' : ''}>16:00 - 18:00</option>
                    <option value="18:00-20:00" ${servicio?.horaPreferida === '18:00-20:00' ? 'selected' : ''}>18:00 - 20:00</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label><i class="fas fa-user-cog"></i> Técnico asignado</label>
            <select class="form-control" id="sdTecnico">
                <option value="">— Sin asignar —</option>
                ${tecnicos.map(t => `<option value="${t.nombre}" ${servicio?.tecnicoAsignado === t.nombre ? 'selected' : ''}>${t.nombre}</option>`).join('')}
            </select>
        </div>
        <div class="form-group"><label>Notas internas</label><textarea class="form-control" id="sdNotas" rows="2" placeholder="Notas para el técnico...">${servicio?.notas || ''}</textarea></div>
    `;
    showModal(title, content, () => {
        const nombre = document.getElementById('sdNombre')?.value?.trim();
        const telefono = document.getElementById('sdTelefono')?.value?.trim();
        const direccion = document.getElementById('sdDireccion')?.value?.trim();
        const fecha = document.getElementById('sdFecha')?.value;
        if (!nombre || !telefono || !direccion || !fecha) {
            showToast('Completá nombre, teléfono, dirección y fecha', 'error');
            return false;
        }

        const data = {
            cliente: {
                nombre,
                telefono,
                email: '',
                direccion,
            },
            tipoServicio: document.getElementById('sdTipoServicio')?.value || 'mantenimiento',
            equipo: {
                tipo: document.getElementById('sdTipoEquipo')?.value || 'Otros',
                marca: document.getElementById('sdMarca')?.value?.trim() || '',
                modelo: document.getElementById('sdModelo')?.value?.trim() || '',
                descripcion: document.getElementById('sdDescripcion')?.value?.trim() || '',
            },
            fechaProgramada: fecha,
            horaPreferida: document.getElementById('sdHora')?.value || '',
            tecnicoAsignado: document.getElementById('sdTecnico')?.value || '',
            notas: document.getElementById('sdNotas')?.value?.trim() || '',
        };

        if (servicio) {
            Object.assign(servicio, data);
            notifyServiciosChange({ action: 'editar', id: servicio.id });
            showToast('Servicio actualizado');
        } else {
            const servicioId = 'SD-' + Date.now().toString().slice(-6);
            const newServicio = {
                id: servicioId,
                ...data,
                estado: data.tecnicoAsignado ? 'asignado' : 'pendiente',
                fechaIngreso: new Date().toISOString().split('T')[0],
                ordenTrabajo: null,
                presupuesto: null,
                precio: 0,
            };
            const all = getServicios();
            all.unshift(newServicio);
            saveServicios(all);

            const ordenKanban = {
                id: Date.now(), token: generateId(), cliente: data.cliente.nombre,
                tel: data.cliente.telefono, email: data.cliente.email || '',
                equipo: `${data.equipo.tipo} ${data.equipo.marca}`, tipo: data.tipoServicio === 'mantenimiento' ? 'Electrodoméstico' : 'Otro',
                estado: 'recepcion', tecnico: data.tecnicoAsignado || '-', precio: 0,
                fechaIngreso: new Date().toISOString().split('T')[0],
                notas: `[Serv. Domicilio #${servicioId}] ${data.equipo.descripcion || ''}`,
                fotos: [], diagnostico: null, ordenTrabajo: null,
                servicioDomicilio: true,
                direccionDomicilio: data.cliente.direccion,
                fechaServicioDomicilio: data.fechaProgramada,
                horaServicioDomicilio: data.horaPreferida,
                servicioDomicilioId: servicioId,
            };
            getOrdenes().unshift(ordenKanban);
            notifyOrdenesChange({ action: 'crear', id: ordenKanban.id });

            notifyServiciosChange({ action: 'crear', id: servicioId });
            showToast('Servicio registrado - Aparece en el kanban de Recepción');
            setTimeout(() => {
                window.open(getWhatsAppLink(newServicio, getMensajeInicial(newServicio)), '_blank');
            }, 500);
        }
        filtrarServicios(filtroActual);
    });

    setTimeout(() => {
        const clienteSelect = document.getElementById('sdClienteSelect');
        if (clienteSelect) {
            clienteSelect.addEventListener('change', () => {
                const option = clienteSelect.options[clienteSelect.selectedIndex];
                if (option.value) {
                    document.getElementById('sdNombre').value = option.dataset.nombre || '';
                    document.getElementById('sdTelefono').value = option.dataset.tel || '';
                    document.getElementById('sdDireccion').value = option.dataset.direccion || '';
                }
            });
        }

        document.getElementById('btnNuevoClienteServDom')?.addEventListener('click', () => {
            const regContent = `
                <div class="form-group">
                    <label>Nombre completo *</label>
                    <input type="text" class="form-control" id="regServDomNombre" placeholder="Nombre completo">
                </div>
                <div class="form-group">
                    <label>Email *</label>
                    <input type="email" class="form-control" id="regServDomEmail" placeholder="cliente@email.com">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Teléfono *</label>
                        <input type="tel" class="form-control" id="regServDomTel" placeholder="5491155550000">
                    </div>
                    <div class="form-group">
                        <label>Dirección *</label>
                        <input type="text" class="form-control" id="regServDomDireccion" placeholder="Dirección completa">
                    </div>
                </div>
                <div class="form-group">
                    <label>Contraseña *</label>
                    <input type="password" class="form-control" id="regServDomPassword" placeholder="Creá una contraseña">
                </div>
            `;
            showModal('Registrar Cliente', regContent, () => {
                const nombre = document.getElementById('regServDomNombre')?.value?.trim();
                const email = document.getElementById('regServDomEmail')?.value?.trim();
                const tel = document.getElementById('regServDomTel')?.value?.trim();
                const direccion = document.getElementById('regServDomDireccion')?.value?.trim();
                const password = document.getElementById('regServDomPassword')?.value;

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

                document.getElementById('sdNombre').value = nombre;
                document.getElementById('sdTelefono').value = tel;
                document.getElementById('sdDireccion').value = direccion;

                showToast(`Cliente ${nuevoId} registrado y cargado`, 'success');
            });
        });
    }, 100);
}

function mostrarDetalleServicio(s) {
    let ordenTrabajoHtml = '';
    if (s.ordenTrabajo) {
        const ot = s.ordenTrabajo;
        const repuestosHtml = ot.repuestosUtilizados?.length > 0
            ? ot.repuestosUtilizados.map(r => `<tr><td>${r.nombre}</td><td>${r.cantidad || 1}</td><td style="text-align:right;">${formatCurrency(r.precio)}</td></tr>`).join('')
            : '<tr><td colspan="3" style="text-align:center;color:var(--color-text-muted);">Sin repuestos</td></tr>';

        const pendientesHtml = ot.pendientes?.length > 0
            ? `<ul style="margin:0;padding-left:16px;">${ot.pendientes.map(p => `<li>${p}</li>`).join('')}</ul>`
            : '<p style="color:var(--color-text-muted);">Sin pendientes</p>';

        ordenTrabajoHtml = `
            <div style="margin-top:16px;">
                <h4 style="font-size:13px;color:var(--color-text-muted);margin-bottom:8px;border-bottom:1px solid var(--color-border);padding-bottom:6px;">
                    <i class="fas fa-clipboard-check"></i> ORDEN DE TRABAJO
                </h4>
                <div class="detail-grid" style="grid-template-columns:1fr 1fr;">
                    <div class="detail-card"><h4>Trabajo Realizado</h4><p>${ot.trabajoRealizado || '-'}</p></div>
                    <div class="detail-card"><h4>Tiempo Empleado</h4><p>${ot.tiempoEmpleado || '-'}</p></div>
                </div>
                <div style="margin-top:8px;">
                    <h4 style="font-size:12px;color:var(--color-text-muted);margin-bottom:4px;">Repuestos Utilizados</h4>
                    <table class="data-table" style="font-size:12px;">
                        <thead><tr><th>Repuesto</th><th>Cant.</th><th style="text-align:right;">Precio</th></tr></thead>
                        <tbody>${repuestosHtml}</tbody>
                    </table>
                </div>
                <div style="margin-top:8px;">
                    <h4 style="font-size:12px;color:var(--color-text-muted);margin-bottom:4px;">Observaciones</h4>
                    <p style="font-size:13px;">${ot.observaciones || '-'}</p>
                </div>
                <div style="margin-top:8px;">
                    <h4 style="font-size:12px;color:var(--color-text-muted);margin-bottom:4px;">Pendientes</h4>
                    ${pendientesHtml}
                </div>
                ${ot.recomendaciones ? `
                <div style="margin-top:8px;">
                    <h4 style="font-size:12px;color:var(--color-text-muted);margin-bottom:4px;">Recomendaciones</h4>
                    <p style="font-size:13px;">${ot.recomendaciones}</p>
                </div>` : ''}
            </div>
        `;
    }

    let presupuestoHtml = '';
    if (s.presupuesto) {
        const p = s.presupuesto;
        const estadoPresup = p.aprobado === true
            ? '<span class="badge badge-success">Aprobado</span>'
            : p.aprobado === false
                ? '<span class="badge badge-danger">Rechazado</span>'
                : '<span class="badge badge-warning">Esperando respuesta</span>';

        presupuestoHtml = `
            <div style="margin-top:16px;">
                <h4 style="font-size:13px;color:var(--color-text-muted);margin-bottom:8px;border-bottom:1px solid var(--color-border);padding-bottom:6px;">
                    <i class="fas fa-dollar-sign"></i> PRESUPUESTO ADICIONAL
                </h4>
                <p style="font-size:13px;margin-bottom:4px;"><strong>Descripción:</strong> ${p.descripcion}</p>
                <p style="font-size:16px;font-weight:700;color:var(--color-primary);margin-bottom:8px;">Total: ${formatCurrency(p.monto)}</p>
                <div style="display:flex;gap:8px;align-items:center;">
                    <strong>Estado:</strong> ${estadoPresup}
                </div>
                ${p.aprobado === null ? `
                <div style="display:flex;gap:8px;margin-top:12px;">
                    <button class="btn btn-primary" style="flex:1;background:#2e7d32;" onclick="window.app.servDom.aprobarPresupuesto('${s.id}');document.getElementById('app-modal').classList.remove('active');">
                        <i class="fas fa-check"></i> Aprobar
                    </button>
                    <button class="btn btn-danger" style="flex:1;" onclick="window.app.servDom.rechazarPresupuesto('${s.id}');document.getElementById('app-modal').classList.remove('active');">
                        <i class="fas fa-times"></i> Rechazar
                    </button>
                </div>` : ''}
            </div>
        `;
    }

    showModal(`Servicio #${s.id}`, `
        <div class="detail-grid">
            <div class="detail-card"><h4>Cliente</h4><p>${s.cliente.nombre}</p><p style="font-size:12px;color:var(--color-text-muted);">${s.cliente.telefono}</p></div>
            <div class="detail-card"><h4>Dirección</h4><p>${s.cliente.direccion}</p></div>
            <div class="detail-card"><h4>Equipo</h4><p>${s.equipo.tipo} ${s.equipo.marca}</p><p style="font-size:12px;color:var(--color-text-muted);">${s.equipo.modelo || ''}</p></div>
            <div class="detail-card"><h4>Estado</h4><p><span class="badge ${estadoBadge[s.estado]}">${estadoLabels[s.estado]}</span></p></div>
            <div class="detail-card"><h4>Fecha Programada</h4><p>${s.fechaProgramada} ${s.horaPreferida ? '(' + s.horaPreferida + ')' : ''}</p></div>
            <div class="detail-card"><h4>Técnico</h4><p>${s.tecnicoAsignado || 'Sin asignar'}</p></div>
            <div class="detail-card"><h4>Tipo</h4><p>${tipoServicioLabels[s.tipoServicio]}</p></div>
            <div class="detail-card"><h4>Precio</h4><p>${s.precio > 0 ? formatCurrency(s.precio) : 'Pendiente'}</p></div>
        </div>
        ${s.equipo?.descripcion ? `<div style="margin-top:12px;padding:10px;background:var(--color-footer-bg);border-radius:8px;font-size:13px;color:var(--color-text-muted);"><i class="fas fa-info-circle"></i> ${s.equipo.descripcion}</div>` : ''}
        ${s.notas ? `<div style="margin-top:8px;padding:10px;background:#fff3e0;border-radius:8px;font-size:12px;color:#e65100;"><i class="fas fa-sticky-note"></i> ${s.notas}</div>` : ''}
        ${ordenTrabajoHtml}
        ${presupuestoHtml}
    `);
}

function mostrarFormularioAsignar(servicio) {
    const tecnicos = JSON.parse(localStorage.getItem('servieltec_tecnicos') || '[]');
    const content = `
        <div style="padding:10px;background:#e3f2fd;border-radius:8px;font-size:12px;color:#1565c0;margin-bottom:16px;">
            <i class="fas fa-info-circle"></i> Asigná un técnico para ir al domicilio de ${servicio.cliente.nombre}.
        </div>
        <div class="form-group">
            <label><i class="fas fa-user-cog"></i> Técnico *</label>
            <select class="form-control" id="asigTecnico">
                <option value="">— Seleccionar técnico —</option>
                ${tecnicos.map(t => `<option value="${t.nombre}">${t.nombre}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Fecha y hora de visita</label>
            <div class="form-row">
                <input type="date" class="form-control" id="asigFecha" value="${servicio.fechaProgramada || ''}">
                <select class="form-control" id="asigHora">
                    <option value="">Hora</option>
                    <option value="08:00-10:00">08:00 - 10:00</option>
                    <option value="10:00-12:00">10:00 - 12:00</option>
                    <option value="12:00-14:00">12:00 - 14:00</option>
                    <option value="14:00-16:00">14:00 - 16:00</option>
                    <option value="16:00-18:00">16:00 - 18:00</option>
                    <option value="18:00-20:00">18:00 - 20:00</option>
                </select>
            </div>
        </div>
    `;
    showModal(`Asignar Técnico - Servicio #${servicio.id}`, content, () => {
        const tecnico = document.getElementById('asigTecnico')?.value;
        if (!tecnico) { showToast('Seleccioná un técnico', 'error'); return false; }

        servicio.tecnicoAsignado = tecnico;
        servicio.estado = 'asignado';
        servicio.fechaProgramada = document.getElementById('asigFecha')?.value || servicio.fechaProgramada;
        servicio.horaPreferida = document.getElementById('asigHora')?.value || servicio.horaPreferida;

        const all = getServicios();
        const idx = all.findIndex(x => x.id === servicio.id);
        if (idx > -1) { all[idx] = servicio; saveServicios(all); }

        notifyServiciosChange({ action: 'asignar', id: servicio.id });
        showToast(`Técnico ${tecnico} asignado al servicio #${servicio.id}`);
        filtrarServicios(filtroActual);
    });
}

function mostrarFormularioOrdenTrabajo(servicio) {
    const ot = servicio.ordenTrabajo || {};
    const content = `
        <div style="padding:10px;background:#e8f5e9;border-radius:8px;font-size:12px;color:#2e7d32;margin-bottom:16px;">
            <i class="fas fa-info-circle"></i> Completá la orden de trabajo con todo lo realizado en el domicilio de ${servicio.cliente.nombre}.
        </div>
        <div class="form-group">
            <label><strong>Trabajo realizado *</strong></label>
            <textarea class="form-control" id="otTrabajo" rows="3" placeholder="Describí detalladamente qué se hizo...">${ot.trabajoRealizado || ''}</textarea>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Tiempo empleado</label><input type="text" class="form-control" id="otTiempo" value="${ot.tiempoEmpleado || ''}" placeholder="Ej: 2 horas"></div>
            <div class="form-group"><label>Estado final</label>
                <select class="form-control" id="otEstadoFinal">
                    <option value="completado" ${!ot.pendientes?.length ? 'selected' : ''}>Completado</option>
                    <option value="pendiente_seguimiento" ${ot.pendientes?.length ? 'selected' : ''}>Pendiente seguimiento</option>
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
                            <input type="number" class="form-control ot-rep-cant" value="${r.cantidad || 1}" min="1" placeholder="Cant.">
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
            <label>Recomendaciones</label>
            <textarea class="form-control" id="otRecomendaciones" rows="2" placeholder="Recomendaciones para el cliente...">${ot.recomendaciones || ''}</textarea>
        </div>
        <div style="margin-top:16px;padding:12px;background:#fff3e0;border-radius:8px;">
            <h4 style="font-size:13px;color:#e65100;margin-bottom:8px;"><i class="fas fa-dollar-sign"></i> Presupuesto adicional (opcional)</h4>
            <p style="font-size:11px;color:var(--color-text-muted);margin-bottom:8px;">Si hay trabajos extra pendientes de aprobación del cliente, cargalos acá.</p>
            <div class="form-group" style="margin-bottom:8px;">
                <label style="font-size:12px;">Descripción del presupuesto</label>
                <textarea class="form-control" id="otPresupDesc" rows="2" placeholder="Trabajo adicional necesario...">${servicio.presupuesto?.descripcion || ''}</textarea>
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label style="font-size:12px;">Monto estimado</label>
                <input type="number" class="form-control" id="otPresupMonto" value="${servicio.presupuesto?.monto || ''}" placeholder="0">
            </div>
        </div>
    `;
    showModal(`Orden de Trabajo - Servicio #${servicio.id}`, content, () => {
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

        const presupDesc = document.getElementById('otPresupDesc')?.value?.trim();
        const presupMonto = parseInt(document.getElementById('otPresupMonto')?.value) || 0;

        servicio.ordenTrabajo = {
            trabajoRealizado: trabajo,
            repuestosUtilizados: repuestos,
            tiempoEmpleado: document.getElementById('otTiempo')?.value?.trim() || '',
            observaciones: document.getElementById('otObservaciones')?.value?.trim() || '',
            pendientes,
            recomendaciones: document.getElementById('otRecomendaciones')?.value?.trim() || '',
            fechaCompletado: new Date().toISOString().split('T')[0],
        };

        if (presupDesc && presupMonto > 0) {
            servicio.presupuesto = {
                descripcion: presupDesc,
                monto: presupMonto,
                aprobado: null,
                fechaPresupuesto: new Date().toISOString().split('T')[0],
            };
        }

        servicio.estado = 'completado';

        const totalRepuestos = repuestos.reduce((sum, r) => sum + (r.precio * r.cantidad), 0);
        servicio.precio = COSTO_VISITA + totalRepuestos;

        const all = getServicios();
        const idx = all.findIndex(x => x.id === servicio.id);
        if (idx > -1) { all[idx] = servicio; saveServicios(all); }

        const ordenAsociada = getOrdenes().find(o => o.servicioDomicilioId === servicio.id);
        if (ordenAsociada) {
            ordenAsociada.estado = 'retirar';
            ordenAsociada.precio = servicio.precio;
            if (servicio.ordenTrabajo) {
                ordenAsociada.ordenTrabajo = servicio.ordenTrabajo;
            }
            if (servicio.presupuesto) {
                ordenAsociada.presupuestoServicio = servicio.presupuesto;
            }
            notifyOrdenesChange({ action: 'orden_trabajo_servicio', id: ordenAsociada.id });
        }

        notifyServiciosChange({ action: 'orden_trabajo', id: servicio.id });
        showToast(`Orden de trabajo completada - Servicio #${servicio.id}`);
        filtrarServicios(filtroActual);
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

export function setServDomRole(role) {
    currentRole = role;
    filtroActual = 'todos';
    renderFilters();
    filtrarServicios('todos');
}

export function renderServiciosDomicilio() {
    return `
        <div class="page-header">
            <h2><i class="fas fa-home" style="color:var(--color-accent);"></i> Servicios a Domicilio</h2>
            <div class="actions">
                <div class="search-bar">
                    <i class="fas fa-search"></i>
                    <input type="text" placeholder="Buscar servicio..." id="searchServDom">
                </div>
                <button class="btn btn-primary" id="btnNuevoServDom"><i class="fas fa-plus"></i> Nuevo Servicio</button>
            </div>
        </div>
        <div class="filters-bar"></div>
        <div class="card" style="padding:0;overflow:hidden;">
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th># Servicio</th>
                            <th>Cliente</th>
                            <th>Equipo</th>
                            <th>Tipo</th>
                            <th>Estado</th>
                            <th>Fecha</th>
                            <th>Técnico</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="servDomBody"></tbody>
                </table>
            </div>
        </div>
    `;
}

export function initServiciosDomicilio() {
    currentRole = window._currentRole || 'admin';
    initStorage();

    window.app = window.app || {};
    window.app.servDom = {
        ver: (id) => {
            const s = getServicios().find(x => x.id === id);
            if (s) mostrarDetalleServicio(s);
        },
        editar: (id) => {
            const s = getServicios().find(x => x.id === id);
            if (s) mostrarFormularioServicio(s);
        },
        asignarTecnico: (id) => {
            const s = getServicios().find(x => x.id === id);
            if (s) mostrarFormularioAsignar(s);
        },
        iniciarServicio: (id) => {
            const all = getServicios();
            const s = all.find(x => x.id === id);
            if (!s) return;
            s.estado = 'en_curso';
            saveServicios(all);

            const ordenAsociada = getOrdenes().find(o => o.servicioDomicilioId === id);
            if (ordenAsociada) {
                ordenAsociada.estado = 'diagnostico';
                notifyOrdenesChange({ action: 'iniciar_servicio', id: ordenAsociada.id });
            }

            notifyServiciosChange({ action: 'iniciar', id });
            showToast(`Servicio #${id} - En curso`, 'success');
            filtrarServicios(filtroActual);
        },
        abrirOrdenTrabajo: (id) => {
            const s = getServicios().find(x => x.id === id);
            if (s) mostrarFormularioOrdenTrabajo(s);
        },
        cancelar: async (id) => {
            const ok = await confirmAction('¿Cancelar este servicio?');
            if (!ok) return;
            const all = getServicios();
            const s = all.find(x => x.id === id);
            if (!s) return;
            s.estado = 'cancelado';
            saveServicios(all);
            notifyServiciosChange({ action: 'cancelar', id });
            showToast(`Servicio #${id} cancelado`, 'error');
            filtrarServicios(filtroActual);
        },
        generarFactura: (id) => {
            const factura = generarFacturaDesdeOrden(id);
            if (factura) {
                window.location.hash = '#/facturacion';
            } else {
                showToast(`Servicio #${id} - Verificá en Facturación`, 'info');
                window.location.hash = '#/facturacion';
            }
        },
        aprobarPresupuesto: (id) => {
            const all = getServicios();
            const s = all.find(x => x.id === id);
            if (!s || !s.presupuesto) return;
            s.presupuesto.aprobado = true;
            s.estado = 'completado';
            s.precio += s.presupuesto.monto;
            saveServicios(all);

            const ordenAsociada = getOrdenes().find(o => o.servicioDomicilioId === id);
            if (ordenAsociada) {
                ordenAsociada.estado = 'retirar';
                notifyOrdenesChange({ action: 'aprobar_presupuesto_servicio', id: ordenAsociada.id });
            }

            notifyServiciosChange({ action: 'aprobar_presupuesto', id });
            showToast(`Presupuesto aprobado - Servicio #${id}`, 'success');
            filtrarServicios(filtroActual);
        },
        rechazarPresupuesto: (id) => {
            const all = getServicios();
            const s = all.find(x => x.id === id);
            if (!s || !s.presupuesto) return;
            s.presupuesto.aprobado = false;
            s.estado = 'completado';
            saveServicios(all);

            const ordenAsociada = getOrdenes().find(o => o.servicioDomicilioId === id);
            if (ordenAsociada) {
                ordenAsociada.estado = 'retirar';
                notifyOrdenesChange({ action: 'rechazar_presupuesto_servicio', id: ordenAsociada.id });
            }

            notifyServiciosChange({ action: 'rechazar_presupuesto', id });
            showToast(`Presupuesto rechazado - Servicio #${id}`, 'error');
            filtrarServicios(filtroActual);
        },
        enviarPDF: (id) => {
            const s = getServicios().find(x => x.id === id);
            if (s) enviarPDFServicio(s);
        },
    };

    renderFilters();
    filtrarServicios('todos');

    const searchInput = document.getElementById('searchServDom');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const all = getServicios();
            servicios = all.filter(s =>
                s.cliente.nombre.toLowerCase().includes(term) ||
                s.id.toLowerCase().includes(term) ||
                s.equipo.tipo.toLowerCase().includes(term) ||
                (s.tecnicoAsignado || '').toLowerCase().includes(term)
            );
            renderTabla();
        });
    }

    document.getElementById('btnNuevoServDom')?.addEventListener('click', () => mostrarFormularioServicio());

    window._servDomListener = () => {
        const tbody = document.getElementById('servDomBody');
        if (tbody) {
            filtrarServicios(filtroActual);
        }
    };
    window.addEventListener('servicios-domicilio-change', window._servDomListener);
}

async function enviarPDFServicio(servicio) {
    const ot = servicio.ordenTrabajo;
    if (!ot) { showToast('No hay orden de trabajo para enviar', 'error'); return; }

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
        <title>Orden de Trabajo ${servicio.id}</title>
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
            .badge-dom { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #e8eaf6; color: #1a237e; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo"><img src="${logoBase64}" alt="${COMPANY_NAME}" style="height:50px;"></div>
            <div class="company-info">
                <strong>${COMPANY_NAME}</strong><br>
                Reparación y Mantenimiento<br>
                <span class="badge-dom"><i class="fas fa-home"></i> SERVICIO A DOMICILIO</span>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Datos del Cliente</div>
            <div class="detail-grid">
                <div class="detail-item"><div class="detail-label">Cliente</div><div class="detail-value">${servicio.cliente.nombre}</div></div>
                <div class="detail-item"><div class="detail-label">Teléfono</div><div class="detail-value">${servicio.cliente.telefono}</div></div>
                <div class="detail-item"><div class="detail-label">Dirección</div><div class="detail-value">${servicio.cliente.direccion}</div></div>
                <div class="detail-item"><div class="detail-label">Servicio</div><div class="detail-value">#${servicio.id}</div></div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Equipo</div>
            <div class="detail-grid">
                <div class="detail-item"><div class="detail-label">Tipo</div><div class="detail-value">${servicio.equipo.tipo}</div></div>
                <div class="detail-item"><div class="detail-label">Marca</div><div class="detail-value">${servicio.equipo.marca}</div></div>
                ${servicio.equipo.modelo ? `<div class="detail-item"><div class="detail-label">Modelo</div><div class="detail-value">${servicio.equipo.modelo}</div></div>` : ''}
                <div class="detail-item"><div class="detail-label">Servicio</div><div class="detail-value">${tipoServicioLabels[servicio.tipoServicio]}</div></div>
            </div>
            ${servicio.equipo?.descripcion ? `<p style="margin:8px 0;font-size:12px;"><strong>Descripción:</strong> ${servicio.equipo.descripcion}</p>` : ''}
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

        ${servicio.presupuesto ? `
        <div class="section">
            <div class="section-title">Presupuesto Adicional</div>
            <p style="margin:4px 0;"><strong>Descripción:</strong> ${servicio.presupuesto.descripcion}</p>
            <p style="margin:4px 0;font-size:16px;font-weight:700;color:#1a237e;">Total: $${servicio.presupuesto.monto.toLocaleString('es-AR')}</p>
            <p style="margin:4px 0;"><strong>Estado:</strong> ${servicio.presupuesto.aprobado === true ? 'Aprobado' : servicio.presupuesto.aprobado === false ? 'Rechazado' : 'Pendiente'}</p>
        </div>` : ''}

        <div class="footer">
            <p>${COMPANY_NAME}<br>
            Documento generado el ${fechaHoy}</p>
        </div>
    </body>
    </html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
        win.onload = () => { win.print(); };
    }

    const msg = `Hola ${servicio.cliente.nombre}! 👋\n\n📋 *Orden de Trabajo #${servicio.id}*\n📱 Equipo: ${servicio.equipo.tipo} ${servicio.equipo.marca}\n🔧 Trabajo: ${ot.trabajoRealizado.substring(0, 100)}...\n\nSe te adjunta el PDF con el detalle completo.\n\n⚡ *${COMPANY_NAME}*`;
    const tel = servicio.cliente.telefono?.replace(/[^0-9]/g, '') || '';
    setTimeout(() => {
        window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank');
    }, 500);

    showToast('PDF generado y WhatsApp abierto', 'success');
}

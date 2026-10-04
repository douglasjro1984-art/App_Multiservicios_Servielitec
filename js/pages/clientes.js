import { showToast, showModal, confirmAction } from '../utils/helpers.js';

function getClientes() {
    return JSON.parse(localStorage.getItem('servieltec_clientes') || '[]');
}

function saveClientes(list) {
    localStorage.setItem('servieltec_clientes', JSON.stringify(list));
}

const clientesIniciales = [
    { id: 'CLI-0001', nombre: 'Cliente Test', email: 'cliente@test.com', tel: '5491155550000', direccion: 'Av. Principal 1234', password: '1234', fechaRegistro: new Date().toISOString().split('T')[0] },
];

function initStorage() {
    const stored = getClientes();
    if (stored.length === 0) {
        saveClientes(clientesIniciales);
    } else {
        const seen = new Set();
        const deduped = stored.filter(c => {
            const key = `${c.nombre}|${c.email}|${c.tel}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        if (deduped.length < stored.length) {
            saveClientes(deduped);
        }
    }
}

function contarOrdenesCliente(nombre) {
    try {
        const ordenes = JSON.parse(localStorage.getItem('servieltec_ordenes') || '[]');
        return ordenes.filter(o => o.cliente === nombre).length;
    } catch {
        return 0;
    }
}

let clientes = [];

function renderTabla() {
    const tbody = document.getElementById('clientesBody');
    if (!tbody) return;

    clientes = getClientes();

    tbody.innerHTML = clientes.map((c, i) => `
        <tr>
            <td><strong>#${i + 1}</strong></td>
            <td>${c.nombre}</td>
            <td>${c.email}</td>
            <td>${c.tel}</td>
            <td>${c.direccion || '-'}</td>
            <td>${c.fechaRegistro || '-'}</td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn-sm btn-outline" onclick="window.app.clientes.editar(${i})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="window.app.clientes.eliminar(${i})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

export function renderClientes() {
    return `
        <div class="page-header">
            <h2><i class="fas fa-users" style="color:var(--color-info);"></i> Clientes</h2>
            <div class="actions">
                <div class="search-bar">
                    <i class="fas fa-search"></i>
                    <input type="text" placeholder="Buscar cliente..." id="searchCliente">
                </div>
                <button class="btn btn-primary" id="btnNuevoCliente">
                    <i class="fas fa-plus"></i> Nuevo Cliente
                </button>
            </div>
        </div>

        <div class="stats-row">
            <div class="stat-card">
                <div class="stat-value" id="statTotal">0</div>
                <div class="stat-label">Total Clientes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="statRecorrentes">0</div>
                <div class="stat-label">Clientes Recurrentes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="statNuevos">0</div>
                <div class="stat-label">Nuevos este Año</div>
            </div>
        </div>

        <div class="card" style="padding:0;overflow:hidden;">
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Nombre</th>
                            <th>Email</th>
                            <th>Teléfono</th>
                            <th>Dirección</th>
                            <th>Registro</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="clientesBody"></tbody>
                </table>
            </div>
        </div>
    `;
}

export function initClientes() {
    initStorage();
    renderTabla();
    updateStats();

    document.getElementById('btnNuevoCliente')?.addEventListener('click', () => mostrarFormularioCliente());

    document.getElementById('searchCliente')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const all = getClientes();
        if (!term) {
            clientes = all;
        } else {
            clientes = all.filter(c =>
                c.nombre.toLowerCase().includes(term) ||
                c.email.toLowerCase().includes(term) ||
                c.tel.includes(term) ||
                c.id.toLowerCase().includes(term)
            );
        }
        renderTabla();
    });

    window.app = window.app || {};
    window.app.clientes = {
        editar: (idx) => {
            const list = getClientes();
            const cliente = list[idx];
            if (cliente) mostrarFormularioCliente(cliente, idx);
        },
        eliminar: async (idx) => {
            const ok = await confirmAction('¿Eliminar este cliente?');
            if (ok) {
                const list = getClientes();
                list.splice(idx, 1);
                saveClientes(list);
                renderTabla();
                updateStats();
                showToast('Cliente eliminado', 'success');
            }
        }
    };
}

function updateStats() {
    const list = getClientes();
    const totalEl = document.getElementById('statTotal');
    const recEl = document.getElementById('statRecorrentes');
    const nuevosEl = document.getElementById('statNuevos');
    if (totalEl) totalEl.textContent = list.length;
    if (recEl) recEl.textContent = list.filter(c => c.ordenes > 1).length;
    if (nuevosEl) nuevosEl.textContent = list.filter(c => c.fechaRegistro && c.fechaRegistro.startsWith('2026')).length;
}

function mostrarFormularioCliente(cliente = null, idx = null) {
    const title = cliente ? 'Editar Cliente' : 'Nuevo Cliente';
    const content = `
        <div class="form-group">
            <label>Nombre completo *</label>
            <input type="text" class="form-control" id="fcNombre" value="${cliente?.nombre || ''}" placeholder="Nombre y apellido">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Email *</label>
                <input type="email" class="form-control" id="fcEmail" value="${cliente?.email || ''}" placeholder="email@ejemplo.com">
            </div>
            <div class="form-group">
                <label>Teléfono *</label>
                <input type="text" class="form-control" id="fcTel" value="${cliente?.tel || ''}" placeholder="5491155550000">
            </div>
        </div>
        <div class="form-group">
            <label>Dirección *</label>
            <input type="text" class="form-control" id="fcDir" value="${cliente?.direccion || ''}" placeholder="Dirección completa">
        </div>
        ${!cliente ? `
        <div class="form-group">
            <label>Contraseña *</label>
            <input type="password" class="form-control" id="fcPass" placeholder="Contraseña del cliente">
        </div>
        ` : ''}
    `;
    showModal(title, content, () => {
        const nombre = document.getElementById('fcNombre')?.value?.trim();
        const email = document.getElementById('fcEmail')?.value?.trim();
        const tel = document.getElementById('fcTel')?.value?.trim();
        const direccion = document.getElementById('fcDir')?.value?.trim();

        if (!nombre || !email || !tel) {
            showToast('Completá nombre, email y teléfono', 'error');
            return false;
        }

        const list = getClientes();

        if (cliente && idx !== null) {
            list[idx] = { ...list[idx], nombre, email, tel, direccion };
            showToast('Cliente actualizado', 'success');
        } else {
            const existe = list.find(c => c.email.toLowerCase() === email.toLowerCase());
            if (existe) {
                showToast(`El email ${email} ya está registrado como ${existe.id}`, 'error');
                return false;
            }
            const password = document.getElementById('fcPass')?.value;
            if (!password) {
                showToast('Ingresá una contraseña', 'error');
                return false;
            }
            const num = list.length + 1;
            const nuevoId = 'CLI-' + String(num).padStart(4, '0');
            list.push({
                id: nuevoId,
                nombre, email, tel, direccion, password,
                fechaRegistro: new Date().toISOString().split('T')[0],
            });
            showToast(`Cliente ${nuevoId} registrado`, 'success');
        }

        saveClientes(list);
        renderTabla();
        updateStats();
    });
}

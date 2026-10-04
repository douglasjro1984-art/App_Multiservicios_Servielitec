import { showToast, showModal, confirmAction } from '../utils/helpers.js';

const repuestosMock = [];

let repuestos = [...repuestosMock];

function renderTabla() {
    const tbody = document.getElementById('repuestosBody');
    if (!tbody) return;

    tbody.innerHTML = repuestos.map(r => `
        <tr>
            <td><strong>#${r.id}</strong></td>
            <td>${r.nombre}</td>
            <td>${r.categoria}</td>
            <td><span class="badge ${r.stock === 0 ? 'badge-danger' : r.stock <= 2 ? 'badge-warning' : 'badge-success'}">${r.stock} ${r.stock === 0 ? 'Sin stock' : 'un.'}</span></td>
            <td>$${r.precio.toLocaleString('es-AR')}</td>
            <td>${r.proveedor}</td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn-sm btn-outline" onclick="window.app.repuestos.editar(${r.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="window.app.repuestos.eliminar(${r.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

export function renderRepuestos() {
    const sinStock = repuestosMock.filter(r => r.stock === 0).length;
    const bajoStock = repuestosMock.filter(r => r.stock > 0 && r.stock <= 2).length;
    const valorTotal = repuestosMock.reduce((sum, r) => sum + (r.stock * r.precio), 0);

    return `
        <div class="page-header">
            <h2><i class="fas fa-boxes" style="color:var(--color-purple);"></i> Repuestos</h2>
            <div class="actions">
                <div class="search-bar">
                    <i class="fas fa-search"></i>
                    <input type="text" placeholder="Buscar repuesto..." id="searchRepuesto">
                </div>
                <button class="btn btn-primary" id="btnNuevoRepuesto">
                    <i class="fas fa-plus"></i> Nuevo Repuesto
                </button>
            </div>
        </div>

        <div class="stats-row">
            <div class="stat-card">
                <div class="stat-value">${repuestosMock.length}</div>
                <div class="stat-label">Total Repuestos</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color:var(--color-danger);">${sinStock}</div>
                <div class="stat-label">Sin Stock</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color:var(--color-warning);">${bajoStock}</div>
                <div class="stat-label">Bajo Stock</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">$${(valorTotal / 1000).toFixed(0)}k</div>
                <div class="stat-label">Valor en Inventario</div>
            </div>
        </div>

        <div class="card" style="padding:0;overflow:hidden;">
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Nombre</th>
                            <th>Categoría</th>
                            <th>Stock</th>
                            <th>Precio</th>
                            <th>Proveedor</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="repuestosBody"></tbody>
                </table>
            </div>
        </div>
    `;
}

export function initRepuestos() {
    renderTabla();

    document.getElementById('btnNuevoRepuesto')?.addEventListener('click', () => mostrarFormularioRepuesto());

    document.getElementById('searchRepuesto')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        repuestos = repuestosMock.filter(r =>
            r.nombre.toLowerCase().includes(term) ||
            r.categoria.toLowerCase().includes(term) ||
            r.proveedor.toLowerCase().includes(term)
        );
        renderTabla();
    });

    window.app = window.app || {};
    window.app.repuestos = {
        editar: (id) => {
            const repuesto = repuestosMock.find(r => r.id === id);
            if (repuesto) mostrarFormularioRepuesto(repuesto);
        },
        eliminar: async (id) => {
            const ok = await confirmAction('¿Eliminar este repuesto?');
            if (ok) showToast('Repuesto eliminado', 'success');
        }
    };
}

function mostrarFormularioRepuesto(repuesto = null) {
    const title = repuesto ? 'Editar Repuesto' : 'Nuevo Repuesto';
    const content = `
        <div class="form-group">
            <label>Nombre</label>
            <input type="text" class="form-control" value="${repuesto?.nombre || ''}" placeholder="Nombre del repuesto">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Categoría</label>
                <select class="form-control">
                    <option value="Celulares">Celulares</option>
                    <option value="Computación">Computación</option>
                    <option value="Electrodomésticos">Electrodomésticos</option>
                    <option value="Electrónica">Electrónica</option>
                    <option value="Audio">Audio</option>
                    <option value="Climatización">Climatización</option>
                </select>
            </div>
            <div class="form-group">
                <label>Proveedor</label>
                <input type="text" class="form-control" value="${repuesto?.proveedor || ''}" placeholder="Proveedor">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Stock</label>
                <input type="number" class="form-control" value="${repuesto?.stock ?? ''}" placeholder="0">
            </div>
            <div class="form-group">
                <label>Precio</label>
                <input type="number" class="form-control" value="${repuesto?.precio || ''}" placeholder="0">
            </div>
        </div>
    `;
    showModal(title, content, () => {
        showToast(repuesto ? 'Repuesto actualizado' : 'Repuesto registrado correctamente');
    });
}

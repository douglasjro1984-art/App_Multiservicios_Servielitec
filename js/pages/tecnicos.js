import { showToast, showModal, confirmAction } from '../utils/helpers.js';

const tecnicosKey = 'servieltec_tecnicos';

const tecnicosDefault = [
    { id: 1, nombre: 'Técnico Principal', especialidad: 'General', ordenes: 0, activas: 0, estado: 'activo', email: 'tecnico@servieltec.com' },
];

function getTecnicosStore() {
    const stored = localStorage.getItem(tecnicosKey);
    if (stored) return JSON.parse(stored);
    localStorage.setItem(tecnicosKey, JSON.stringify(tecnicosDefault));
    return [...tecnicosDefault];
}

function saveTecnicosStore(data) {
    localStorage.setItem(tecnicosKey, JSON.stringify(data));
}

const tecnicosMock = getTecnicosStore();

let tecnicos = [...tecnicosMock];

const estadoBadge = {
    activo: 'badge-success',
    disponible: 'badge-info',
    inactivo: 'badge-danger',
};

function renderTabla() {
    const tbody = document.getElementById('tecnicosBody');
    if (!tbody) return;

    tbody.innerHTML = tecnicos.map(t => `
        <tr>
            <td><strong>#${t.id}</strong></td>
            <td>${t.nombre}</td>
            <td>${t.especialidad}</td>
            <td>${t.email}</td>
            <td>${t.ordenes}</td>
            <td><span class="badge ${estadoBadge[t.estado]}">${t.estado.charAt(0).toUpperCase() + t.estado.slice(1)}</span></td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn-sm btn-outline" onclick="window.app.tecnicos.editar(${t.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="window.app.tecnicos.eliminar(${t.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

export function renderTecnicos() {
    const disponibles = tecnicosMock.filter(t => t.estado === 'disponible').length;
    const ocupados = tecnicosMock.filter(t => t.estado === 'activo').length;

    return `
        <div class="page-header">
            <h2><i class="fas fa-user-cog" style="color:var(--color-warning);"></i> Técnicos</h2>
            <div class="actions">
                <div class="search-bar">
                    <i class="fas fa-search"></i>
                    <input type="text" placeholder="Buscar técnico..." id="searchTecnico">
                </div>
                <button class="btn btn-primary" id="btnNuevoTecnico">
                    <i class="fas fa-plus"></i> Nuevo Técnico
                </button>
            </div>
        </div>

        <div class="stats-row">
            <div class="stat-card">
                <div class="stat-value">${tecnicosMock.length}</div>
                <div class="stat-label">Total Técnicos</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${ocupados}</div>
                <div class="stat-label">Con Órdenes Activas</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${disponibles}</div>
                <div class="stat-label">Disponibles</div>
            </div>
        </div>

        <div class="card" style="padding:0;overflow:hidden;">
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Nombre</th>
                            <th>Especialidad</th>
                            <th>Email</th>
                            <th>Órdenes Totales</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tecnicosBody"></tbody>
                </table>
            </div>
        </div>
    `;
}

export function initTecnicos() {
    renderTabla();

    document.getElementById('btnNuevoTecnico')?.addEventListener('click', () => mostrarFormularioTecnico());

    document.getElementById('searchTecnico')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        tecnicos = tecnicosMock.filter(t =>
            t.nombre.toLowerCase().includes(term) ||
            t.especialidad.toLowerCase().includes(term)
        );
        renderTabla();
    });

    window.app = window.app || {};
    window.app.tecnicos = {
        editar: (id) => {
            const tecnico = tecnicosMock.find(t => t.id === id);
            if (tecnico) mostrarFormularioTecnico(tecnico);
        },
        eliminar: async (id) => {
            const ok = await confirmAction('¿Eliminar este técnico?');
            if (ok) {
                const idx = tecnicosMock.findIndex(t => t.id === id);
                if (idx > -1) tecnicosMock.splice(idx, 1);
                saveTecnicosStore(tecnicosMock);
                renderTabla();
                showToast('Técnico eliminado', 'success');
            }
        }
    };
}

function mostrarFormularioTecnico(tecnico = null) {
    const title = tecnico ? 'Editar Técnico' : 'Nuevo Técnico';
    const content = `
        <div class="form-group">
            <label>Nombre completo</label>
            <input type="text" class="form-control" id="ftNombre" value="${tecnico?.nombre || ''}" placeholder="Nombre y apellido">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Especialidad</label>
                <select class="form-control" id="ftEspecialidad">
                    <option value="Electrónica">Electrónica</option>
                    <option value="Electrodomésticos">Electrodomésticos</option>
                    <option value="Climatización">Climatización</option>
                    <option value="Computación">Computación</option>
                    <option value="Audio / Video">Audio / Video</option>
                    <option value="Celulares">Celulares</option>
                    <option value="General">General</option>
                </select>
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" class="form-control" id="ftEmail" value="${tecnico?.email || ''}" placeholder="tecnico@servieltec.com">
            </div>
        </div>
    `;
    showModal(title, content, () => {
        const nombre = document.getElementById('ftNombre')?.value?.trim();
        const especialidad = document.getElementById('ftEspecialidad')?.value;
        const email = document.getElementById('ftEmail')?.value?.trim();
        if (!nombre) { showToast('Completá el nombre', 'error'); return false; }

        if (tecnico) {
            tecnico.nombre = nombre;
            tecnico.especialidad = especialidad;
            tecnico.email = email;
        } else {
            const newId = tecnicosMock.length > 0 ? Math.max(...tecnicosMock.map(t => t.id)) + 1 : 1;
            tecnicosMock.push({ id: newId, nombre, especialidad, email: email || '', ordenes: 0, activas: 0, estado: 'activo' });
        }
        saveTecnicosStore(tecnicosMock);
        renderTabla();
        showToast(tecnico ? 'Técnico actualizado' : 'Técnico registrado correctamente');
    });
}

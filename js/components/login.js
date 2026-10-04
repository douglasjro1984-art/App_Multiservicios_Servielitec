import { showToast, showModal } from '../utils/helpers.js';

const usuarios = {
    admin: { password: 'AdminMS', nombre: 'Administrador', rol: 'admin', icon: 'fa-user-shield' },
    recepcion: { password: 'RecepMS', nombre: 'Recepcionista', rol: 'recepcion', icon: 'fa-user-tie' },
    tecnico: { password: 'TecMS', nombre: 'Técnico', rol: 'tecnico', icon: 'fa-user-gear' },
    cliente: { password: null, nombre: 'Cliente', rol: 'cliente', icon: 'fa-user' },
};

function getClientes() {
    return JSON.parse(localStorage.getItem('servieltec_clientes') || '[]');
}

function saveClientes(clientes) {
    localStorage.setItem('servieltec_clientes', JSON.stringify(clientes));
}

export function renderLogin() {
    return `
        <div class="login-page">
            <div class="login-container">
                <img src="img/recorte.jpg" alt="Servieltec" class="login-logo-img">
                <h1>Panel de Control</h1>
                <p>Seleccioná tu usuario e ingresá la contraseña</p>
                
                <div class="login-cards">
                    <div class="login-card" data-rol="admin">
                        <i class="fas fa-user-shield"></i>
                        <h3>Administrador</h3>
                        <p>Control total del sistema</p>
                    </div>
                    <div class="login-card" data-rol="recepcion">
                        <i class="fas fa-user-tie"></i>
                        <h3>Recepcionista</h3>
                        <p>Gestión de clientes y entregas</p>
                    </div>
                    <div class="login-card" data-rol="tecnico">
                        <i class="fas fa-user-gear"></i>
                        <h3>Técnico</h3>
                        <p>Bandeja de trabajo</p>
                    </div>
                    <div class="login-card" data-rol="cliente" style="border-color:var(--color-success);">
                        <i class="fas fa-user" style="color:var(--color-success);"></i>
                        <h3>Cliente</h3>
                        <p>Seguí tus equipos</p>
                    </div>
                </div>

                <div class="login-form" id="loginForm" style="display:none;">
                    <div class="login-selected" id="loginSelected"></div>
                    <div id="loginFields">
                        <div class="form-group">
                            <label><i class="fas fa-lock"></i> Contraseña</label>
                            <input type="password" class="form-control" id="loginPassword" placeholder="Ingresá tu contraseña" autocomplete="off">
                        </div>
                        <button class="btn btn-primary btn-block" id="btnLogin">
                            <i class="fas fa-sign-in-alt"></i> Ingresar
                        </button>
                        <p class="login-error" id="loginError" style="display:none;">Contraseña incorrecta</p>
                    </div>
                    <div id="clienteFields" style="display:none;">
                        <div style="text-align:center;margin-bottom:14px;">
                            <button type="button" class="btn btn-outline" id="btnShowRegister" style="width:100%;">
                                <i class="fas fa-user-plus"></i> Crear cuenta nueva / Recuperar acceso
                            </button>
                        </div>
                        <div style="text-align:center;margin:16px 0;font-size:12px;color:var(--color-text-muted);">— o ingresá con tu ID —</div>
                        <div class="form-row">
                            <div class="form-group">
                                <label><i class="fas fa-id-card"></i> ID de Cliente</label>
                                <input type="text" class="form-control" id="clienteId" placeholder="Ej: CLI-0001" autocomplete="off">
                            </div>
                            <div class="form-group">
                                <label><i class="fas fa-lock"></i> Contraseña</label>
                                <input type="password" class="form-control" id="clientePassword" placeholder="Ingresá tu contraseña" autocomplete="off">
                            </div>
                        </div>
                        <button class="btn btn-primary btn-block" id="btnClienteLogin">
                            <i class="fas fa-sign-in-alt"></i> Ingresar
                        </button>
                        <p class="login-error" id="clienteLoginError" style="display:none;">ID o contraseña incorrectos</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function mostrarModalRegistro() {
    const content = `
        <div class="form-group">
            <label>Nombre completo *</label>
            <input type="text" class="form-control" id="regNombre" placeholder="Tu nombre completo">
        </div>
        <div class="form-group">
            <label>Email *</label>
            <input type="email" class="form-control" id="regEmail" placeholder="tu@email.com">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Teléfono *</label>
                <input type="tel" class="form-control" id="regTel" placeholder="5491155550000">
            </div>
            <div class="form-group">
                <label>Dirección *</label>
                <input type="text" class="form-control" id="regDireccion" placeholder="Tu dirección completa">
            </div>
        </div>
        <div class="form-group">
            <label>Contraseña *</label>
            <input type="password" class="form-control" id="regPassword" placeholder="Creá una contraseña">
        </div>
    `;
    showModal('Registro de Cliente', content, () => {
        const nombre = document.getElementById('regNombre')?.value?.trim();
        const email = document.getElementById('regEmail')?.value?.trim();
        const tel = document.getElementById('regTel')?.value?.trim();
        const direccion = document.getElementById('regDireccion')?.value?.trim();
        const password = document.getElementById('regPassword')?.value;

        if (!nombre || !email || !tel || !direccion || !password) {
            showToast('Completá todos los campos', 'error');
            return false;
        }

        const clientes = getClientes();
        const existe = clientes.find(c => c.email.toLowerCase() === email.toLowerCase());
        if (existe) {
            existe.nombre = nombre;
            existe.tel = tel;
            existe.direccion = direccion;
            existe.password = password;
            saveClientes(clientes);
            showToast(`Se actualizó tu acceso en ${existe.id}. Ingresá con tu nueva contraseña.`, 'success');
            setTimeout(() => {
                document.getElementById('clienteId').value = existe.id;
                document.getElementById('clientePassword').focus();
            }, 300);
            return false;
        }
        const nuevoId = generarIdCliente();
        const nuevoCliente = { id: nuevoId, nombre, email, tel, direccion, password, fechaRegistro: new Date().toISOString().split('T')[0] };
        clientes.push(nuevoCliente);
        saveClientes(clientes);

        setTimeout(() => {
            showModal('¡Registro Exitoso!', `
                <div style="text-align:center;padding:10px 0;">
                    <i class="fas fa-check-circle" style="font-size:48px;color:var(--color-success);margin-bottom:12px;"></i>
                    <h3 style="color:var(--color-success);margin-bottom:8px;">Bienvenido ${nombre}</h3>
                    <p style="font-size:13px;color:var(--color-text-muted);margin-bottom:12px;">Tu ID de cliente es:</p>
                    <div style="background:var(--color-footer-bg);padding:14px;border-radius:8px;font-size:26px;font-weight:700;color:var(--color-primary);letter-spacing:2px;">${nuevoId}</div>
                    <p style="font-size:12px;color:var(--color-text-muted);margin-top:12px;">Guardá este ID para ingresar después</p>
                </div>
            `);

            document.getElementById('clienteId').value = nuevoId;
            document.getElementById('clientePassword').focus();
            showToast(`Tu ID es: ${nuevoId}`, 'success');
        }, 300);
    });
}

export function initLogin(onLogin) {
    let selectedRol = null;

    document.querySelectorAll('.login-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.login-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedRol = card.dataset.rol;

            const user = usuarios[selectedRol];
            document.getElementById('loginSelected').innerHTML = `
                <i class="fas ${user.icon}"></i>
                <span>${user.nombre}</span>
            `;
            document.getElementById('loginForm').style.display = 'block';

            if (selectedRol === 'cliente') {
                document.getElementById('loginFields').style.display = 'none';
                document.getElementById('clienteFields').style.display = 'block';
                document.getElementById('clienteId').value = '';
                document.getElementById('clientePassword').value = '';
                document.getElementById('clienteLoginError').style.display = 'none';
                document.getElementById('clienteId').focus();
            } else {
                document.getElementById('loginFields').style.display = 'block';
                document.getElementById('clienteFields').style.display = 'none';
                document.getElementById('loginPassword').value = '';
                document.getElementById('loginError').style.display = 'none';
                document.getElementById('loginPassword').focus();
            }
        });
    });

    const btnLogin = document.getElementById('btnLogin');
    const loginPassword = document.getElementById('loginPassword');

    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            const password = loginPassword.value;
            if (!selectedRol || selectedRol === 'cliente') return;

            if (password === usuarios[selectedRol].password) {
                const user = usuarios[selectedRol];
                localStorage.setItem('servieltec_role', user.rol);
                localStorage.setItem('servieltec_user', user.nombre);
                window._currentRole = user.rol;
                window._currentUser = user.nombre;
                onLogin(user.rol, user.nombre);
            } else {
                document.getElementById('loginError').style.display = 'block';
                loginPassword.value = '';
                loginPassword.focus();
            }
        });
    }

    if (loginPassword) {
        loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') btnLogin.click();
        });
    }

    document.getElementById('btnShowRegister')?.addEventListener('click', (e) => {
        e.preventDefault();
        mostrarModalRegistro();
    });

    document.getElementById('btnClienteLogin')?.addEventListener('click', () => {
        const id = document.getElementById('clienteId')?.value?.trim().toUpperCase();
        const password = document.getElementById('clientePassword')?.value;
        if (!id || !password) {
            document.getElementById('clienteLoginError').textContent = 'Completá todos los campos';
            document.getElementById('clienteLoginError').style.display = 'block';
            return;
        }
        const clientes = getClientes();
        const cliente = clientes.find(c => c.id === id && c.password === password);
        if (cliente) {
            localStorage.setItem('servieltec_role', 'cliente');
            localStorage.setItem('servieltec_user', cliente.nombre);
            localStorage.setItem('servieltec_cliente_id', cliente.id);
            window._currentRole = 'cliente';
            window._currentUser = cliente.nombre;
            window._clienteId = cliente.id;
            onLogin('cliente', cliente.nombre);
        } else {
            document.getElementById('clienteLoginError').textContent = 'ID o contraseña incorrectos';
            document.getElementById('clienteLoginError').style.display = 'block';
        }
    });

    if (document.getElementById('clientePassword')) {
        document.getElementById('clientePassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') document.getElementById('btnClienteLogin').click();
        });
    }
}

function generarIdCliente() {
    const clientes = getClientes();
    let num = clientes.length + 1;
    let id = 'CLI-' + String(num).padStart(4, '0');
    while (clientes.some(c => c.id === id)) {
        num++;
        id = 'CLI-' + String(num).padStart(4, '0');
    }
    return id;
}

export function getStoredRole() {
    return localStorage.getItem('servieltec_role');
}

export function getStoredUser() {
    return localStorage.getItem('servieltec_user');
}

export function getStoredClienteId() {
    return localStorage.getItem('servieltec_cliente_id');
}

export function clearStoredRole() {
    localStorage.removeItem('servieltec_role');
    localStorage.removeItem('servieltec_user');
    localStorage.removeItem('servieltec_cliente_id');
}

export function $(selector) {
    return document.querySelector(selector);
}

export function $$(selector) {
    return document.querySelectorAll(selector);
}

export function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'className') el.className = value;
        else if (key === 'innerHTML') el.innerHTML = value;
        else if (key === 'textContent') el.textContent = value;
        else if (key.startsWith('on')) {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === 'dataset') {
            Object.entries(value).forEach(([k, v]) => el.dataset[k] = v);
        } else {
            el.setAttribute(key, value);
        }
    });
    children.forEach(child => {
        if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
        } else if (child) {
            el.appendChild(child);
        }
    });
    return el;
}

export function formatCurrency(amount) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0
    }).format(amount);
}

export function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

export function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Hace un momento';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
    return `Hace ${Math.floor(diff / 86400)} días`;
}

export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

export function showToast(message, type = 'success') {
    let toast = document.getElementById('app-toast');
    if (!toast) {
        toast = createElement('div', { id: 'app-toast', className: 'toast' });
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast ${type}`;
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

export function showModal(title, content, onSave) {
    let overlay = document.getElementById('app-modal');
    if (!overlay) {
        overlay = createElement('div', { id: 'app-modal', className: 'modal-overlay' });
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">${content}</div>
            <div class="modal-footer" style="margin-top:20px; display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn btn-outline" id="modalCancel">Cancelar</button>
                ${onSave ? '<button class="btn btn-primary" id="modalSave">Guardar</button>' : ''}
            </div>
        </div>
    `;

    overlay.classList.add('active');

    const close = () => overlay.classList.remove('active');
    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('#modalCancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    if (onSave) {
        overlay.querySelector('#modalSave').addEventListener('click', () => {
            const result = onSave(overlay);
            if (result !== false) {
                close();
            }
        });
    }

    return overlay;
}

export function confirmAction(message) {
    return new Promise((resolve) => {
        const overlay = createElement('div', { id: 'confirm-modal', className: 'modal-overlay active' });
        overlay.innerHTML = `
            <div class="modal" style="max-width:400px;text-align:center;">
                <div style="margin-bottom:16px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:40px;color:var(--color-warning);"></i>
                </div>
                <h3 style="margin-bottom:12px;">Confirmar</h3>
                <p style="color:var(--color-text-muted);margin-bottom:24px;">${message}</p>
                <div style="display:flex;justify-content:center;gap:10px;">
                    <button class="btn btn-outline" id="confirmNo">Cancelar</button>
                    <button class="btn btn-danger" id="confirmSi">Eliminar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = (result) => {
            overlay.remove();
            resolve(result);
        };

        overlay.querySelector('#confirmNo').addEventListener('click', () => close(false));
        overlay.querySelector('#confirmSi').addEventListener('click', () => close(true));
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close(false);
        });
    });
}

export function loadImageBase64(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => resolve('');
        img.src = src;
    });
}

export const COMPANY_NAME = 'Multiservicios ServiElitec';

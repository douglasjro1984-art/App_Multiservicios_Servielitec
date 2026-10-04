const API_BASE = '/api';

async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    };

    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, config);
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Error del servidor' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }
        if (response.status === 204) return null;
        return await response.json();
    } catch (error) {
        if (error.message === 'Failed to fetch') {
            throw new Error('Sin conexión al servidor');
        }
        throw error;
    }
}

export const api = {
    get: (endpoint) => request(endpoint),
    post: (endpoint, data) => request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
    put: (endpoint, data) => request(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
    patch: (endpoint, data) => request(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
};

export const ordenesService = {
    getAll: (params = '') => api.get(`/ordenes${params ? '?' + params : ''}`),
    getById: (id) => api.get(`/ordenes/${id}`),
    create: (data) => api.post('/ordenes', data),
    update: (id, data) => api.put(`/ordenes/${id}`, data),
    delete: (id) => api.delete(`/ordenes/${id}`),
};

export const clientesService = {
    getAll: (params = '') => api.get(`/clientes${params ? '?' + params : ''}`),
    getById: (id) => api.get(`/clientes/${id}`),
    create: (data) => api.post('/clientes', data),
    update: (id, data) => api.put(`/clientes/${id}`, data),
    delete: (id) => api.delete(`/clientes/${id}`),
};

export const tecnicosService = {
    getAll: (params = '') => api.get(`/tecnicos${params ? '?' + params : ''}`),
    getById: (id) => api.get(`/tecnicos/${id}`),
    create: (data) => api.post('/tecnicos', data),
    update: (id, data) => api.put(`/tecnicos/${id}`, data),
    delete: (id) => api.delete(`/tecnicos/${id}`),
};

export const facturacionService = {
    getAll: (params = '') => api.get(`/facturacion${params ? '?' + params : ''}`),
    getById: (id) => api.get(`/facturacion/${id}`),
    create: (data) => api.post('/facturacion', data),
    update: (id, data) => api.put(`/facturacion/${id}`, data),
    delete: (id) => api.delete(`/facturacion/${id}`),
};

export const repuestosService = {
    getAll: (params = '') => api.get(`/repuestos${params ? '?' + params : ''}`),
    getById: (id) => api.get(`/repuestos/${id}`),
    create: (data) => api.post('/repuestos', data),
    update: (id, data) => api.put(`/repuestos/${id}`, data),
    delete: (id) => api.delete(`/repuestos/${id}`),
};

export const authService = {
    login: (credentials) => api.post('/auth/login', credentials),
    logout: () => api.post('/auth/logout'),
    me: () => api.get('/auth/me'),
};

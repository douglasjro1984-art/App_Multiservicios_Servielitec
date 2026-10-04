import { formatCurrency, showToast } from '../utils/helpers.js';
import { getOrderByToken, getOrderByNumber, approveOrder, rejectOrder } from './ordenes.js';

const ordenesRef = [];

function fetchOrdenes() {
    return [];
}

const estadoLabels = {
    recepcion: 'Recepción',
    diagnostico: 'Diagnóstico',
    esperando_aprobacion: 'Esperando Aprobación',
    aprobado: 'Aprobado',
    rechazado: 'Rechazado',
    en_taller: 'En Taller',
    retirar: 'Listo para Retirar',
};

const estadoIcon = {
    recepcion: '📥',
    diagnostico: '🔍',
    esperando_aprobacion: '⏳',
    aprobado: '✅',
    rechazado: '❌',
    en_taller: '🔧',
    retirar: '📦',
};

const estadoDescripcion = {
    recepcion: 'Tu equipo fue recibido y está a la espera de ser revisado.',
    diagnostico: 'Nuestro técnico está analizando tu equipo.',
    esperando_aprobacion: 'El diagnóstico está listo. Esperamos tu aprobación del presupuesto.',
    aprobado: 'Aprobaste el presupuesto. Nuestro técnico iniciará la reparación.',
    rechazado: 'Rechazaste el presupuesto. Solo se cobra el diagnóstico. Podés retirar tu equipo.',
    en_taller: 'Tu equipo está siendo reparado en nuestro taller.',
    retirar: 'Tu equipo está listo para ser retirado. ¡Te esperamos!',
};

const pasosBase = ['recepcion', 'diagnostico', 'en_taller', 'retirar'];

function getHistorial(orden) {
    const h = [];
    h.push({ fecha: orden.fechaIngreso + ' 09:00', texto: 'Equipo recibido en recepción' });
    if (orden.diagnostico) {
        h.push({ fecha: orden.diagnostico.fechaDiagnostico + ' 10:00', texto: 'Diagnóstico realizado por ' + orden.tecnico });
        h.push({ fecha: orden.diagnostico.fechaDiagnostico + ' 10:05', texto: 'Presupuesto enviado al cliente' });
        if (orden.diagnostico.aprobado === true) {
            h.push({ fecha: orden.diagnostico.fechaDiagnostico + ' 14:00', texto: '✅ Presupuesto aprobado por el cliente' });
        } else if (orden.diagnostico.aprobado === false) {
            h.push({ fecha: orden.diagnostico.fechaDiagnostico + ' 14:00', texto: '❌ Presupuesto rechazado por el cliente' });
            h.push({ fecha: orden.diagnostico.fechaDiagnostico + ' 14:01', texto: 'Solo se cobra diagnóstico (' + formatCurrency(orden.diagnostico.costoDiagnostico) + ')' });
        }
    }
    if (orden.estado === 'en_taller') {
        h.push({ fecha: '2026-07-18 09:00', texto: 'Reparación en curso - En taller' });
    }
    if (orden.estado === 'retirar') {
        h.push({ fecha: (orden.fechaNotificado || '2026-07-19') + ' 16:00', texto: 'Equipo listo para retirar - Notificado al cliente' });
    }
    return h.reverse();
}

export function renderTracking() {
    const hash = window.location.hash;

    if (hash.includes('/approval/')) {
        const token = hash.split('/approval/')[1];
        return renderApprovalPage(token);
    }

    if (hash.includes('/tracking/')) {
        const token = hash.split('/tracking/')[1];
        return renderOrderTracking(token);
    }

    return renderBuscador();
}

function renderBuscador() {
    return `
        <div class="tracking-page">
            <div class="tracking-header">
                <div class="tracking-logo">⚡ Serviel<span>tec</span></div>
                <h1>Seguimiento de Orden</h1>
                <p>Ingresá el número de tu orden para ver el estado</p>
            </div>
            <div class="tracking-card" style="max-width:500px;margin:0 auto;">
                <div style="text-align:center;margin-bottom:20px;">
                    <i class="fas fa-clipboard-list" style="font-size:40px;color:var(--color-accent);"></i>
                </div>
                <div class="form-group">
                    <label>Número de Orden</label>
                    <div style="display:flex;gap:8px;">
                        <input type="text" class="form-control" id="trackingInput" placeholder="Ej: 1024" style="font-size:18px;text-align:center;padding:14px;">
                        <button class="btn btn-primary" id="btnBuscar" style="padding:14px 24px;font-size:16px;"><i class="fas fa-search"></i></button>
                    </div>
                </div>
                <p style="font-size:12px;color:var(--color-text-muted);text-align:center;margin-top:12px;">El número de orden te fue dado al ingresar tu equipo.</p>
            </div>
        </div>
    `;
}

function renderOrderTracking(token) {
    const orden = getOrderByToken(token);

    if (!orden) {
        return `
            <div class="tracking-page">
                <div class="tracking-header">
                    <div class="tracking-logo">⚡ Serviel<span>tec</span></div>
                    <h1>Seguimiento de Orden</h1>
                </div>
                <div class="tracking-card" style="text-align:center;">
                    <i class="fas fa-exclamation-circle" style="font-size:48px;color:var(--color-warning);margin-bottom:16px;"></i>
                    <h2 style="margin-bottom:8px;">Orden no encontrada</h2>
                    <p style="color:var(--color-text-muted);">El enlace no es válido o la orden fue eliminada.</p>
                    <button class="btn btn-primary" onclick="window.location.hash='#/tracking'" style="margin-top:20px;"><i class="fas fa-search"></i> Buscar otra orden</button>
                </div>
            </div>
        `;
    }

    let pasos = [...pasosBase];
    let pasoActual;
    if (orden.estado === 'esperando_aprobacion') {
        pasoActual = 1;
    } else if (orden.estado === 'rechazado') {
        pasoActual = -1;
    } else {
        pasoActual = pasos.indexOf(orden.estado);
    }

    const progressHtml = pasos.map((paso, i) => {
        const isCompleted = orden.estado !== 'rechazado' && i <= pasoActual;
        const isCurrent = i === pasoActual;
        return `
            <div class="progress-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}">
                <div class="step-circle">${isCompleted ? '<i class="fas fa-check"></i>' : (i + 1)}</div>
                <div class="step-label">${estadoIcon[paso]} ${estadoLabels[paso]}</div>
                ${i < pasos.length - 1 ? '<div class="step-line"></div>' : ''}
            </div>
        `;
    }).join('');

    let diagnosticoHtml = '';
    if (orden.diagnostico) {
        const d = orden.diagnostico;
        const repuestosHtml = d.repuestos.map(r => `<tr><td>${r.nombre}</td><td style="text-align:right;">${formatCurrency(r.precio)}</td></tr>`).join('');

        let statusBox = '';
        if (d.aprobado === null) {
            statusBox = `<div class="status-message status-waiting">⏳ Esperando tu respuesta. Aprobá o rechazá el presupuesto más abajo.</div>`;
        } else if (d.aprobado === true) {
            statusBox = `<div class="status-message status-ready">✅ Aprobaste el presupuesto. ¡El técnico iniciará la reparación!</div>`;
        } else {
            statusBox = `<div class="status-message status-rejected">❌ Rechazaste el presupuesto. Solo se cobra el diagnóstico (${formatCurrency(COSTO_DIAGNOSTICO)}).</div>`;
        }

        diagnosticoHtml = `
            <div class="tracking-card">
                <h3><i class="fas fa-stethoscope"></i> Diagnóstico Técnico</h3>
                ${statusBox}
                <div style="margin-bottom:12px;">
                    <span class="info-label">Problema detectado</span>
                    <p style="margin-top:4px;font-size:14px;">${d.problema}</p>
                </div>
                <table class="data-table" style="margin-bottom:12px;">
                    <thead><tr><th>Repuesto</th><th style="text-align:right;">Precio</th></tr></thead>
                    <tbody>
                        ${repuestosHtml}
                        <tr><td>Mano de obra</td><td style="text-align:right;">${formatCurrency(d.manoDeObra)}</td></tr>
                    </tbody>
                    <tfoot>
                        <tr style="font-weight:700;border-top:2px solid var(--color-border);">
                            <td>TOTAL PRESUPUESTO</td>
                            <td style="text-align:right;font-size:16px;">${formatCurrency(d.total)}</td>
                        </tr>
                    </tfoot>
                </table>
                <div style="padding:10px;background:var(--color-footer-bg);border-radius:8px;font-size:12px;color:var(--color-text-muted);">
                    <i class="fas fa-info-circle"></i> Costo de diagnóstico: ${formatCurrency(COSTO_DIAGNOSTICO)} ${d.aprobado === false ? '(se cobra al rechazar)' : ''}
                </div>
            </div>
        `;
    }

    const historialHtml = getHistorial(orden).map(h => `
        <div class="timeline-item">
            <div class="timeline-date">${h.fecha}</div>
            <div class="timeline-text">${h.texto}</div>
        </div>
    `).join('');

    return `
        <div class="tracking-page">
            <div class="tracking-header">
                <div class="tracking-logo">⚡ Serviel<span>tec</span></div>
                <h1>Orden #${orden.id}</h1>
            </div>

            <div class="tracking-card">
                <div class="order-info-grid">
                    <div class="info-item"><span class="info-label">Equipo</span><span class="info-value">${orden.equipo}</span></div>
                    <div class="info-item"><span class="info-label">Tipo</span><span class="info-value">${orden.tipo}</span></div>
                    <div class="info-item"><span class="info-label">Ingreso</span><span class="info-value">${orden.fechaIngreso}</span></div>
                    <div class="info-item"><span class="info-label">Presupuesto</span><span class="info-value">${orden.diagnostico ? formatCurrency(orden.diagnostico.total) : 'Pendiente'}</span></div>
                </div>
            </div>

            <div class="tracking-card">
                <h3>Estado actual</h3>
                <div class="status-message ${orden.estado === 'retirar' ? 'status-ready' : ''} ${orden.estado === 'rechazado' ? 'status-rejected' : ''}">
                    ${estadoIcon[orden.estado]} ${estadoDescripcion[orden.estado]}
                </div>
                <div class="progress-bar">${progressHtml}</div>
            </div>

            ${diagnosticoHtml}

            ${orden.diagnostico && orden.diagnostico.aprobado === null ? `
            <div class="tracking-card" style="border:2px solid var(--color-accent);">
                <h3 style="text-align:center;"><i class="fas fa-hand-pointer"></i> ¿Aprobás el presupuesto?</h3>
                <p style="text-align:center;font-size:13px;color:var(--color-text-muted);margin-bottom:16px;">
                    Revisá el diagnóstico y decidí si querés avanzar con la reparación.
                </p>
                <div style="display:flex;gap:12px;justify-content:center;">
                    <button class="btn btn-primary" style="padding:14px 32px;font-size:16px;" id="btnApprove">
                        <i class="fas fa-check"></i> Aprobar
                    </button>
                    <button class="btn btn-danger" style="padding:14px 32px;font-size:16px;" id="btnReject">
                        <i class="fas fa-times"></i> Rechazar
                    </button>
                </div>
                <p style="text-align:center;font-size:11px;color:var(--color-text-muted);margin-top:12px;">
                    Si rechazás, solo se cobrará el diagnóstico (${formatCurrency(COSTO_DIAGNOSTICO)})
                </p>
            </div>
            ` : ''}

            ${orden.notas ? `<div class="tracking-card"><h3><i class="fas fa-info-circle"></i> Notas</h3><p style="margin-top:8px;color:var(--color-text-muted);">${orden.notas}</p></div>` : ''}

            <div class="tracking-card">
                <h3><i class="fas fa-history"></i> Historial</h3>
                <div class="timeline" style="margin-top:12px;">${historialHtml}</div>
            </div>

            <div class="tracking-footer">
                <p><i class="fas fa-phone"></i> ¿Tenés dudas? Llamanos al (011) 4567-8900</p>
                <p><i class="fas fa-map-marker-alt"></i> Av. Ejemplo 1234, Buenos Aires</p>
            </div>
        </div>
    `;
}

function renderApprovalPage(token) {
    const orden = getOrderByToken(token);

    if (!orden || !orden.diagnostico) {
        return `
            <div class="tracking-page">
                <div class="tracking-header">
                    <div class="tracking-logo">⚡ Serviel<span>tec</span></div>
                    <h1>Aprobación de Presupuesto</h1>
                </div>
                <div class="tracking-card" style="text-align:center;">
                    <i class="fas fa-exclamation-circle" style="font-size:48px;color:var(--color-warning);margin-bottom:16px;"></i>
                    <h2 style="margin-bottom:8px;">Presupuesto no encontrado</h2>
                    <p style="color:var(--color-text-muted);">El enlace no es válido o el presupuesto ya fue procesado.</p>
                    <button class="btn btn-primary" onclick="window.location.hash='#/tracking'" style="margin-top:20px;"><i class="fas fa-search"></i> Ver mi orden</button>
                </div>
            </div>
        `;
    }

    if (orden.diagnostico.aprobado !== null) {
        const yaProcesado = orden.diagnostico.aprobado
            ? '<div class="status-message status-ready">✅ Ya aprobaste este presupuesto. La reparación está en curso.</div>'
            : '<div class="status-message status-rejected">❌ Ya rechazaste este presupuesto.</div>';
        return `
            <div class="tracking-page">
                <div class="tracking-header">
                    <div class="tracking-logo">⚡ Serviel<span>tec</span></div>
                    <h1>Presupuesto #${orden.id}</h1>
                </div>
                <div class="tracking-card" style="text-align:center;">
                    ${yaProcesado}
                    <button class="btn btn-primary" onclick="window.location.hash='#/tracking/${token}'" style="margin-top:16px;"><i class="fas fa-eye"></i> Ver estado de mi orden</button>
                </div>
            </div>
        `;
    }

    const d = orden.diagnostico;
    const repuestosHtml = d.repuestos.map(r => `<tr><td>${r.nombre}</td><td style="text-align:right;">${formatCurrency(r.precio)}</td></tr>`).join('');

    return `
        <div class="tracking-page">
            <div class="tracking-header">
                <div class="tracking-logo">⚡ Serviel<span>tec</span></div>
                <h1>Presupuesto de Reparación</h1>
                <p>Orden #${orden.id} - ${orden.equipo}</p>
            </div>

            <div class="tracking-card">
                <div class="order-info-grid">
                    <div class="info-item"><span class="info-label">Cliente</span><span class="info-value">${orden.cliente}</span></div>
                    <div class="info-item"><span class="info-label">Equipo</span><span class="info-value">${orden.equipo}</span></div>
                    <div class="info-item"><span class="info-label">Fecha diagnóstico</span><span class="info-value">${d.fechaDiagnostico}</span></div>
                    <div class="info-item"><span class="info-label">Técnico</span><span class="info-value">${orden.tecnico}</span></div>
                </div>
            </div>

            <div class="tracking-card">
                <h3><i class="fas fa-stethoscope"></i> Diagnóstico</h3>
                <p style="margin:10px 0;font-size:14px;">${d.problema}</p>
            </div>

            <div class="tracking-card">
                <h3><i class="fas fa-calculator"></i> Detalle del Presupuesto</h3>
                <table class="data-table" style="margin-top:10px;">
                    <thead><tr><th>Concepto</th><th style="text-align:right;">Precio</th></tr></thead>
                    <tbody>
                        ${repuestosHtml}
                        <tr><td>Mano de obra</td><td style="text-align:right;">${formatCurrency(d.manoDeObra)}</td></tr>
                        <tr style="font-weight:700;border-top:2px solid var(--color-border);background:var(--color-footer-bg);">
                            <td style="font-size:16px;">TOTAL</td>
                            <td style="text-align:right;font-size:18px;">${formatCurrency(d.total)}</td>
                        </tr>
                    </tbody>
                </table>
                <div style="margin-top:10px;padding:8px 12px;background:#fff3e0;border-radius:6px;font-size:12px;color:#e65100;">
                    <i class="fas fa-info-circle"></i> Si rechazás, solo se cobrará el diagnóstico: <strong>${formatCurrency(COSTO_DIAGNOSTICO)}</strong>
                </div>
            </div>

            <div class="tracking-card" style="border:2px solid var(--color-accent);" id="decisionCard">
                <h3 style="text-align:center;font-size:18px;"><i class="fas fa-hand-pointer"></i> ¿Aprobás el presupuesto?</h3>
                <p style="text-align:center;font-size:14px;color:var(--color-text-muted);margin:12px 0 20px;">
                    Revisá el detalle y decidí si querés que reparemos tu equipo.
                </p>
                <div style="display:flex;gap:16px;justify-content:center;">
                    <button class="btn btn-primary" style="padding:16px 40px;font-size:18px;" id="btnFinalApprove">
                        <i class="fas fa-check"></i> Aprobar
                    </button>
                    <button class="btn btn-danger" style="padding:16px 40px;font-size:18px;" id="btnFinalReject">
                        <i class="fas fa-times"></i> Rechazar
                    </button>
                </div>
            </div>

            <div class="tracking-footer">
                <p><i class="fas fa-phone"></i> ¿Tenés dudas? Llamanos al (011) 4567-8900</p>
            </div>
        </div>
    `;
}

const COSTO_DIAGNOSTICO = 5000;

function processApproval(token, approved) {
    const result = approved ? approveOrder(token) : rejectOrder(token);
    if (!result) return;

    const card = document.getElementById('decisionCard');
    if (card) {
        if (approved) {
            card.innerHTML = `
                <div style="text-align:center;padding:20px;">
                    <div style="font-size:60px;margin-bottom:12px;">✅</div>
                    <h3 style="color:#2e7d32;margin-bottom:8px;">¡Presupuesto Aprobado!</h3>
                    <p style="color:var(--color-text-muted);margin-bottom:16px;">Nuestro técnico iniciará la reparación de tu equipo.</p>
                    <p style="font-size:14px;font-weight:600;margin-bottom:20px;">Total: <span style="font-size:20px;">${formatCurrency(result.precio)}</span></p>
                    <button class="btn btn-primary" onclick="window.location.hash='#/tracking/${token}'"><i class="fas fa-eye"></i> Ver estado de mi orden</button>
                </div>
            `;
        } else {
            card.innerHTML = `
                <div style="text-align:center;padding:20px;">
                    <div style="font-size:60px;margin-bottom:12px;">❌</div>
                    <h3 style="color:#c62828;margin-bottom:8px;">Presupuesto Rechazado</h3>
                    <p style="color:var(--color-text-muted);margin-bottom:16px;">Solo se cobrará el diagnóstico: <strong>${formatCurrency(COSTO_DIAGNOSTICO)}</strong></p>
                    <p style="color:var(--color-text-muted);margin-bottom:20px;">Podés retirar tu equipo en el local abonando el diagnóstico.</p>
                    <button class="btn btn-primary" onclick="window.location.hash='#/tracking/${token}'"><i class="fas fa-eye"></i> Ver estado de mi orden</button>
                </div>
            `;
        }
    }

    showToast(approved ? 'Presupuesto aprobado' : 'Presupuesto rechazado');
}

export function initTracking() {
    const hash = window.location.hash;

    if (hash.includes('/approval/')) {
        const token = hash.split('/approval/')[1];
        document.getElementById('btnFinalApprove')?.addEventListener('click', () => processApproval(token, true));
        document.getElementById('btnFinalReject')?.addEventListener('click', () => processApproval(token, false));
    }

    if (!hash.includes('/tracking/') && !hash.includes('/approval/')) {
        const btnBuscar = document.getElementById('btnBuscar');
        const input = document.getElementById('trackingInput');
        if (btnBuscar && input) {
            const buscar = () => {
                const val = input.value.trim();
                if (!val) { showToast('Ingresá un número de orden', 'error'); return; }
                const orden = getOrderByNumber(val);
                if (orden) {
                    window.location.hash = `#/tracking/${orden.token}`;
                } else {
                    showToast('Orden no encontrada', 'error');
                }
            };
            btnBuscar.addEventListener('click', buscar);
            input.addEventListener('keypress', (e) => { if (e.key === 'Enter') buscar(); });
        }
    }
}

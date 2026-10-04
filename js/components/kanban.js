const nextStepActions = {
    recepcion: { label: 'Enviar a Diagnóstico', icon: 'fa-arrow-right', color: '#1565c0', action: 'enviarDiagnostico' },
    diagnostico: { label: 'Diagnosticar', icon: 'fa-stethoscope', color: '#e65100', action: 'diagnosticar' },
    esperando_aprobacion: null,
    en_taller: { label: 'Equipo Listo', icon: 'fa-check-circle', color: '#2e7d32', action: 'equipoListo' },
    retirar: { label: 'Realizar Factura', icon: 'fa-file-invoice-dollar', color: '#2e7d32', action: 'realizarFactura' },
};

export function renderKanban(columns, onMove, onNuevaOrden, onCardClick) {
    const cols = columns.map(col => {
        const cards = col.cards.map(card => {
            const demoraClass = card.demora ? ' demora' : '';
            const step = nextStepActions[card.type];
            const btnHtml = step ? `
                <button class="btn btn-sm" style="background:${step.color};color:#fff;width:100%;margin-top:8px;font-size:11px;padding:5px 8px;" onclick="event.stopPropagation();window.app.kanban.${step.action}(${typeof card.id === 'number' ? card.id : JSON.stringify(card.id)})">
                    <i class="fas ${step.icon}"></i> ${step.label}
                </button>
            ` : '';
            return `
                <div class="task-card ${col.type}${demoraClass}" draggable="true" data-id="${card.id}" data-type="${col.type}" onclick="window.app.kanban.clickCard('${card.id}', '${col.type}')" style="cursor:pointer;">
                    <div class="task-title">${card.demora ? '⚠️ ' : ''}${card.title}</div>
                    <div class="task-sub">
                        <i class="fas fa-user"></i> ${card.client}
                        <i class="fas fa-tag"></i> #${card.id}
                    </div>
                    <div class="task-footer">
                        <span class="price">${card.price}</span>
                        <span class="date" ${card.demora ? 'style="color:var(--color-danger-dark);"' : ''}>${card.date}</span>
                    </div>
                    ${btnHtml}
                </div>
            `;
        }).join('');

        return `
            <div class="kanban-col" data-status="${col.type}">
                <div class="col-header">
                    <span>${col.icon} ${col.title}</span>
                    <span class="badge-count">${col.cards.length}</span>
                </div>
                <div class="kanban-cards" data-status="${col.type}">
                    ${cards}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-columns"></i> Flujo de Trabajo (Órdenes activas)</h3>
                <button class="btn btn-primary" id="btnNuevaOrden">
                    <i class="fas fa-plus"></i> Nueva Orden
                </button>
            </div>
            <div class="kanban-board" id="kanbanBoard">${cols}</div>
        </div>
    `;
}

export function initKanban(onMove, onNuevaOrden, onCardClick) {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;

    window.app = window.app || {};
    window.app.kanban = {
        clickCard: (id, type) => {
            if (onCardClick) onCardClick(id, type);
        },
        enviarDiagnostico: (id) => {
            if (window.app.ordenes?.enviarDiagnostico) window.app.ordenes.enviarDiagnostico(id);
        },
        diagnosticar: (id) => {
            if (window.app.ordenes?.diagnosticar) window.app.ordenes.diagnosticar(id);
        },
        equipoListo: (id) => {
            if (window.app.ordenes?.equipoListo) window.app.ordenes.equipoListo(id);
        },
        realizarFactura: (id) => {
            if (window.app.dashboard?.realizarFactura) window.app.dashboard.realizarFactura(id);
        },
    };

    const btnNueva = document.getElementById('btnNuevaOrden');
    if (btnNueva && onNuevaOrden) {
        btnNueva.addEventListener('click', onNuevaOrden);
    }

    let draggedCard = null;

    board.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.task-card');
        if (!card) return;
        draggedCard = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.id);
    });

    board.addEventListener('dragend', (e) => {
        const card = e.target.closest('.task-card');
        if (card) card.classList.remove('dragging');
        draggedCard = null;
        board.querySelectorAll('.kanban-cards').forEach(col => {
            col.classList.remove('drag-over');
        });
    });

    board.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const cardsContainer = e.target.closest('.kanban-cards');
        if (cardsContainer) {
            cardsContainer.classList.add('drag-over');
        }
    });

    board.addEventListener('dragleave', (e) => {
        const cardsContainer = e.target.closest('.kanban-cards');
        if (cardsContainer && !cardsContainer.contains(e.relatedTarget)) {
            cardsContainer.classList.remove('drag-over');
        }
    });

    board.addEventListener('drop', (e) => {
        e.preventDefault();
        const cardsContainer = e.target.closest('.kanban-cards');
        if (!cardsContainer || !draggedCard) return;

        cardsContainer.classList.remove('drag-over');

        const cardIdRaw = draggedCard.dataset.id;
        const cardId = isNaN(parseInt(cardIdRaw)) ? cardIdRaw : parseInt(cardIdRaw);
        const fromType = draggedCard.dataset.type;
        const toType = cardsContainer.dataset.status;

        if (fromType === toType) return;

        const afterElement = getDragAfterElement(cardsContainer, e.clientY);
        if (afterElement) {
            cardsContainer.insertBefore(draggedCard, afterElement);
        } else {
            cardsContainer.appendChild(draggedCard);
        }

        draggedCard.dataset.type = toType;
        draggedCard.className = draggedCard.className.replace(/\b(recepcion|diagnostico|esperando_aprobacion|en_taller|retirar|retirado|rechazado)\b/, toType);

        updateBadgeCounts(board);

        if (onMove) onMove(cardId, fromType, toType);
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateBadgeCounts(board) {
    board.querySelectorAll('.kanban-col').forEach(col => {
        const count = col.querySelector('.kanban-cards').children.length;
        col.querySelector('.badge-count').textContent = count;
    });
}

export function renderKpiCard(icon, label, value, subText = '', subStyle = '') {
    return `
        <div class="kpi-card">
            <div class="kpi-info">
                <h4><i class="fas fa-${icon}"></i> ${label}</h4>
                <div class="number">${value}</div>
                ${subText ? `<span class="sub" ${subStyle ? `style="${subStyle}"` : ''}>${subText}</span>` : ''}
            </div>
            <div class="kpi-icon"><i class="fas fa-${icon}"></i></div>
        </div>
    `;
}

export function renderKpiGrid(kpis) {
    return `
        <div class="kpi-grid">
            ${kpis.map(kpi => renderKpiCard(kpi.icon, kpi.label, kpi.value, kpi.sub, kpi.subStyle)).join('')}
        </div>
    `;
}

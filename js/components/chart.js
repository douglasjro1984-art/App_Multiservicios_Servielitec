export function renderBarChart(data, title, subtitle = '') {
    const max = Math.max(...data.map(d => d.value));
    const bars = data.map(d => {
        const height = (d.value / max) * 120;
        return `
            <div class="bar-item">
                <div class="bar" style="height:${height}px;" title="${d.value}"></div>
                <span>${d.label}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="card">
            <div class="card-header">
                <h3><i class="fas fa-chart-bar" style="color:var(--color-accent);"></i> ${title}</h3>
                ${subtitle ? `<span style="font-size:14px;color:var(--color-text-muted);">${subtitle}</span>` : ''}
            </div>
            <div class="bar-chart">${bars}</div>
        </div>
    `;
}

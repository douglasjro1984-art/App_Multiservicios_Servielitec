export function renderSplash() {
    return `
        <div class="splash-screen" id="splashScreen">
            <div class="splash-content">
                <h2 class="splash-welcome">Bienvenidos a</h2>
                <img src="img/principal.png" alt="Servieltec" class="splash-logo">
                <h1 class="splash-title">Multiservicios ServiElitec</h1>
                <p class="splash-subtitle">Gracias por elegirnos</p>
                <button class="btn btn-primary splash-btn" id="splashEnter">
                    <i class="fas fa-arrow-right"></i> Ingresar
                </button>
            </div>
        </div>
    `;
}

export function initSplash(onContinue) {
    const btn = document.getElementById('splashEnter');
    if (btn) {
        btn.addEventListener('click', () => {
            const splash = document.getElementById('splashScreen');
            splash.classList.add('splash-fade');
            setTimeout(() => onContinue(), 500);
        });
    }
}

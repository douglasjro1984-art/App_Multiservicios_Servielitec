export class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        this.beforeEach = null;
        window.addEventListener('hashchange', () => this.resolve());
    }

    addRoute(path, handler) {
        this.routes[path] = handler;
        return this;
    }

    navigate(path) {
        window.location.hash = path;
    }

    resolve() {
        const hash = window.location.hash.slice(1) || '/';
        const route = this.routes[hash];

        if (this.beforeEach) {
            const canProceed = this.beforeEach(hash, this.currentRoute);
            if (!canProceed) return;
        }

        if (route) {
            this.currentRoute = hash;
            route();
        } else {
            this.navigate('/');
        }
    }

    setBeforeEach(fn) {
        this.beforeEach = fn;
    }

    init() {
        this.resolve();
        return this;
    }
}

// Menu di navigazione globale
class NavigationMenu {
    constructor() {
        this.createMenu();
        this.setupEventListeners();
        this.setActivePage();
    }

    createMenu() {
        // Crea la struttura del menu
        const nav = document.createElement('nav');
        nav.className = 'global-nav';
        nav.innerHTML = `
            <div class="nav-container">
                <a href="index.html" class="nav-logo">🎲 Ludo Online</a>
                <ul class="nav-menu">
                    <li class="nav-item">
                        <a href="/index.html" class="nav-link" data-page="index">Gioca</a>
                    </li>
                    <li class="nav-item">
                        <a href="/login.html" class="nav-link" data-page="login">Login</a>
                    </li>
                    <li class="nav-item">
                        <a href="private/resoconto-partite.html" class="nav-link" data-page="resoconto">Statistiche</a>
                    </li>
                </ul>
                <div class="nav-toggle">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;

        // Inserisce il menu all'inizio del body
        document.body.insertBefore(nav, document.body.firstChild);
    }

    setupEventListeners() {
        // Toggle menu mobile
        const toggle = document.querySelector('.nav-toggle');
        const menu = document.querySelector('.nav-menu');

        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            menu.classList.toggle('active');
        });

        // Chiudi menu quando si clicca su un link (mobile)
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                toggle.classList.remove('active');
                menu.classList.remove('active');
            });
        });

        // Chiudi menu quando si clicca fuori (mobile)
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.global-nav')) {
                toggle.classList.remove('active');
                menu.classList.remove('active');
            }
        });
    }

    setActivePage() {
        // Determina la pagina corrente e imposta il link attivo
        const currentPage = this.getCurrentPage();
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            const page = link.getAttribute('data-page');
            if (page === currentPage) {
                link.classList.add('active');
            }
        });

        // Imposta la classe del body per stili specifici della pagina
        document.body.classList.add(`${currentPage}-page`);
    }

    getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.split('/').pop().split('.')[0];
        
        // Mappa i nomi dei file alle pagine
        const pageMap = {
            'index': 'index',
            'gioca': 'gioca',
            'login': 'login',
            'register': 'register',
            'resoconto-partite': 'resoconto',
            'restricted': 'restricted',
            '': 'index' // per il caso della root
        };

        return pageMap[filename] || 'index';
    }
}

// Inizializza il menu quando il DOM è caricato
document.addEventListener('DOMContentLoaded', () => {
    new NavigationMenu();
});

// Utility per verificare se l'utente è autenticato
function checkAuthStatus() {
    // Questa funzione può essere espansa per verificare lo stato di autenticazione
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    return !!token;
}

// Aggiorna la visibilità dei link in base allo stato di autenticazione
function updateMenuForAuth() {
    const isAuthenticated = checkAuthStatus();
    const protectedLinks = document.querySelectorAll('[data-page="resoconto"], [data-page="restricted"]');
    const authLinks = document.querySelectorAll('[data-page="login"], [data-page="register"]');
    
    if (isAuthenticated) {
        protectedLinks.forEach(link => link.style.display = 'block');
        authLinks.forEach(link => link.style.display = 'none');
    } else {
        protectedLinks.forEach(link => link.style.display = 'none');
        authLinks.forEach(link => link.style.display = 'block');
    }
}

// Funzione per aggiornare il menu dopo il login/logout
window.updateNavigationMenu = updateMenuForAuth;
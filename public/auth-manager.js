// auth-manager.js - Gestore di autenticazione con sessionStorage

class AuthManager {
    constructor() {
        this.token = null;
        this.user = null;
        this.useSessionStorage = false; // Flag per decidere quale metodo usare
    }

    // Metodo per decidere quale tipo di autenticazione usare
    setAuthMode(useSession = false) {
        this.useSessionStorage = useSession;
        if (useSession) {
            console.log('Modalità: SessionStorage (sessioni indipendenti per scheda)');
        } else {
            console.log('Modalità: Cookie (sessioni condivise tra schede)');
        }
    }

    // Login con supporto per entrambe le modalità
    async login(email, password) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    useSessionStorage: this.useSessionStorage
                })
            });

            const data = await response.json();

            if (data.success) {
                if (this.useSessionStorage) {
                    // Salva il token in sessionStorage
                    sessionStorage.setItem('authToken', data.token);
                    sessionStorage.setItem('user', JSON.stringify(data.user));
                    this.token = data.token;
                    this.user = data.user;
                } else {
                    // Il cookie è già impostato dal server
                    this.token = null; // Non serve salvarlo localmente
                    this.user = null;  // Sarà recuperato con una chiamata separata
                }
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Errore durante il login:', error);
            return { success: false, message: 'Errore di connessione' };
        }
    }

    // Logout
    async logout() {
        try {
            if (this.useSessionStorage) {
                // Rimuovi i dati dalla sessionStorage
                sessionStorage.removeItem('authToken');
                sessionStorage.removeItem('user');
                this.token = null;
                this.user = null;
                return { success: true, message: 'Logout effettuato' };
            } else {
                // Chiama l'endpoint di logout per rimuovere il cookie
                const response = await fetch('/api/logout', {
                    method: 'POST'
                });
                const data = await response.json();
                return data;
            }
        } catch (error) {
            console.error('Errore durante il logout:', error);
            return { success: false, message: 'Errore di connessione' };
        }
    }

    // Controlla se l'utente è autenticato
    isAuthenticated() {
        if (this.useSessionStorage) {
            const token = sessionStorage.getItem('authToken');
            return token !== null;
        } else {
            // Per i cookie, dovresti fare una chiamata al server per verificare
            return document.cookie.includes('token=');
        }
    }

    // Ottieni il token per le richieste autenticate
    getAuthToken() {
        if (this.useSessionStorage) {
            return sessionStorage.getItem('authToken');
        }
        return null; // Per i cookie, il browser li invia automaticamente
    }

    // Ottieni le informazioni dell'utente
    async getUserInfo() {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };

            // Se usa sessionStorage, aggiungi l'header Authorization
            if (this.useSessionStorage) {
                const token = this.getAuthToken();
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
            }

            const response = await fetch('/api/userinfo', {
                method: 'GET',
                headers: headers
            });

            const data = await response.json();
            
            if (data.success) {
                this.user = {
                    id: data.userId,
                    nome: data.nome
                };
                return data;
            } else {
                return null;
            }
        } catch (error) {
            console.error('Errore nel recupero info utente:', error);
            return null;
        }
    }

    // Metodo helper per fare richieste autenticate
    async authenticatedFetch(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        };

        // Se usa sessionStorage, aggiungi l'header Authorization
        if (this.useSessionStorage) {
            const token = this.getAuthToken();
            if (token) {
                defaultOptions.headers['Authorization'] = `Bearer ${token}`;
            }
        }

        // Unisci le opzioni
        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };

        return fetch(url, finalOptions);
    }

    // Inizializza l'auth manager al caricamento della pagina
    async initialize() {
        if (this.useSessionStorage) {
            // Recupera i dati dalla sessionStorage
            const token = sessionStorage.getItem('authToken');
            const userData = sessionStorage.getItem('user');
            
            if (token && userData) {
                this.token = token;
                this.user = JSON.parse(userData);
                return true;
            }
        } else {
            // Per i cookie, verifica se l'utente è loggato
            if (this.isAuthenticated()) {
                await this.getUserInfo();
                return true;
            }
        }
        return false;
    }
}

// Crea un'istanza globale
window.authManager = new AuthManager();

// Esempio di utilizzo:
/*
// Per usare sessionStorage (sessioni indipendenti per scheda):
authManager.setAuthMode(true);

// Per usare cookie (sessioni condivise tra schede):
authManager.setAuthMode(false);

// Login
const result = await authManager.login('email@example.com', 'password');

// Logout
await authManager.logout();

// Fare una richiesta autenticata
const response = await authManager.authenticatedFetch('/api/user-stats');
*/
window.onload = function() {
    // Imposta la modalità di autenticazione
    authManager.setAuthMode(true); // true = sessionStorage, false = cookie

    // Elementi del DOM
    const loading = document.getElementById('loading');
    const content = document.getElementById('content');
    const error = document.getElementById('error');
    const userName = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');
    const retryBtn = document.getElementById('retryBtn');
    const errorMessage = document.getElementById('errorMessage');

    // Elementi statistiche personali
    const userWins = document.getElementById('userWins');
    const userPlayed = document.getElementById('userPlayed');
    const userWinRate = document.getElementById('userWinRate');
    const userLosses = document.getElementById('userLosses');

    // Elementi classifica
    const rankingBody = document.getElementById('rankingBody');

    // Elementi statistiche globali
    const totalPlayers = document.getElementById('totalPlayers');
    const totalGames = document.getElementById('totalGames');
    const avgWinRate = document.getElementById('avgWinRate');

    // Funzione per caricare i dati dell'utente
    async function loadUserInfo() {
        try {
            const response = await authManager.authenticatedFetch('/api/userinfo', { method: 'GET' });
            if (!response.ok) throw new Error('Non autorizzato');
            const data = await response.json();
            if (data.success) {
                userName.textContent = data.nome;
            }
        } catch (err) {
            console.error('Errore caricamento info utente:', err);
            window.location.href = '/login.html';
        }
    }

    // Funzione per caricare le statistiche personali
    async function loadUserStats() {
        try {
            const response = await authManager.authenticatedFetch('/api/user-stats', { method: 'GET' });
            if (!response.ok) throw new Error('Errore nel caricamento delle statistiche personali');
            const data = await response.json();
            if (data.success) {
                const stats = data.stats;
                userWins.textContent = stats.vinte || 0;
                userPlayed.textContent = stats.giocate || 0;
                userLosses.textContent = (stats.giocate - stats.vinte) || 0;
                const winRate = stats.giocate > 0 ? ((stats.vinte / stats.giocate) * 100).toFixed(1) : 0;
                userWinRate.textContent = winRate + '%';
            }
        } catch (err) {
            console.error('Errore caricamento statistiche utente:', err);
            throw err;
        }
    }

    // Funzione per caricare la classifica generale
    async function loadRanking() {
        try {
            const response = await authManager.authenticatedFetch('/api/ranking', { method: 'GET' });
            if (!response.ok) throw new Error('Errore nel caricamento della classifica');
            const data = await response.json();
            if (data.success) {
                renderRanking(data.ranking, data.currentUserId);
            }
        } catch (err) {
            console.error('Errore caricamento classifica:', err);
            throw err;
        }
    }

    // Funzione per caricare le statistiche globali
    async function loadGlobalStats() {
        try {
            const response = await authManager.authenticatedFetch('/api/global-stats', { method: 'GET' });
            if (!response.ok) throw new Error('Errore nel caricamento delle statistiche globali');
            const data = await response.json();
            if (data.success) {
                const stats = data.stats;
                totalPlayers.textContent = stats.totalPlayers || 0;
                totalGames.textContent = stats.totalGames || 0;
                avgWinRate.textContent = (stats.avgWinRate || 0).toFixed(1) + '%';
            }
        } catch (err) {
            console.error('Errore caricamento statistiche globali:', err);
            throw err;
        }
    }

    // Funzione principale per caricare tutti i dati
    async function loadAllData() {
        loading.style.display = 'block';
        content.style.display = 'none';
        error.style.display = 'none';

        try {
            // Carica tutti i dati in parallelo
            await Promise.all([
                loadUserInfo(),
                loadUserStats(),
                loadRanking(),
                loadGlobalStats()
            ]);

            // Mostra il contenuto
            loading.style.display = 'none';
            content.style.display = 'block';
            
        } catch (err) {
            console.error('Errore generale:', err);
            showError(err.message);
        }
    }

    // Funzione per mostrare gli errori
    function showError(message) {
        loading.style.display = 'none';
        content.style.display = 'none';
        error.style.display = 'block';
        errorMessage.textContent = message;
    }

    // Funzione di logout
    async function logout() {
        try {
            const result = await authManager.logout();
            if (result.success) {
                window.location.href = '/login.html';
            } else {
                alert('Errore durante il logout');
            }
        } catch (err) {
            console.error('Errore logout:', err);
            alert('Errore durante il logout');
        }
    }

    // Event listeners
    logoutBtn.addEventListener('click', logout);
    retryBtn.addEventListener('click', loadAllData);

    // Carica i dati all'avvio
    loadAllData();
};
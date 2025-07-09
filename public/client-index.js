// client-index.js - JavaScript per il client Ludo con supporto autenticazione
//Si connette al server lobby (porta 3001)
class LudoClient {
    constructor() {
        this.socket = null;
        this.gameId = null;
        this.playerId = null;
        this.playerName = null;
        this.gameState = null;
        this.isConnected = false;
        this.isAuthenticated = false;
        this.userInfo = null;
        
        this.checkAuthStatus();
    }

    async checkAuthStatus() {
        try {
            // Usa authManager per ottenere info utente (supporta cookie e sessionStorage)
            const data = await authManager.getUserInfo();
            if (data && data.success) {
                this.isAuthenticated = true;
                this.userInfo = data;
                this.playerName = data.nome;
                console.log('Utente autenticato:', this.playerName);
                this.updateUIForAuthenticatedUser();
            } else {
                console.log('Utente non autenticato');
                this.isAuthenticated = false;
            }
        } catch (error) {
            console.log('Utente non autenticato - errore:', error);
            this.isAuthenticated = false;
        }
        // Inizializza la connessione WebSocket solo dopo aver verificato l'autenticazione
        this.initializeConnection();
    }

    updateUIForAuthenticatedUser() {
        // Pre-compila i campi nome con il nome dell'utente autenticato
        const playerNameInputs = document.querySelectorAll('#playerName, #joinPlayerName');
        playerNameInputs.forEach(input => {
            input.value = this.playerName;
            input.disabled = true; // Disabilita la modifica del nome per utenti autenticati
        });

        // Mostra un messaggio di benvenuto
        this.showStatus(`Benvenuto, ${this.playerName}! Le tue statistiche verranno salvate.`, 'success');
        
        // Aggiorna l'interfaccia per mostrare lo stato di autenticazione
        const authStatus = document.createElement('div');
        authStatus.className = 'auth-status authenticated';
        authStatus.innerHTML = `
            <span class="auth-icon">👤</span>
            <span>Connesso come: <strong>${this.playerName}</strong></span>
        `;
        
        const container = document.querySelector('.container');
        container.insertBefore(authStatus, container.firstChild);
    }

    initializeConnection() {
        try {
            this.socket = new WebSocket('ws:///10.109.3.17:3001');

            this.socket.onopen = () => {
                console.log('Connessione WebSocket lobby aperta');
                this.isConnected = true;
                this.showStatus('Connesso al server lobby', 'success');
                
                // INVIA IL TOKEN JWT SE PRESENTE (sessionStorage)
                if (authManager.useSessionStorage) {
                    const token = authManager.getAuthToken();
                    if (token) {
                        this.socket.send(JSON.stringify({ type: 'auth', data: { token } }));
                    }
                }
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.socket.onclose = () => {
                console.log('Connessione lobby chiusa');
                this.isConnected = false;
                this.showStatus('Connessione al server lobby persa', 'error');
            };

            this.socket.onerror = (error) => {
                console.error('Errore WebSocket lobby:', error);
                this.showStatus('Errore di connessione al server lobby', 'error');
            };
        } catch (error) {
            console.error('Errore inizializzazione lobby:', error);
            this.showStatus('Impossibile connettersi al server lobby', 'error');
        }
    }

    handleMessage(message) {
        console.log('Messaggio lobby ricevuto:', message);
        
        switch (message.type) {
            case 'game-created':
                this.handleGameCreated(message.data);
                break;
            case 'game-joined':
                this.handleGameJoined(message.data);
                break;
            case 'game-updated':
                this.handleGameUpdated(message.data);
                break;
            case 'game-started':
                this.handleGameStarted(message.data);
                break;
            case 'error':
                this.showStatus(message.message, 'error');
                break;
            case 'info':
                this.showStatus(message.message, 'info');
                break;
        }
    }

    sendMessage(type, data = {}) {
        if (this.socket && this.isConnected) {
            console.log('Invio messaggio lobby:', type, data);
            this.socket.send(JSON.stringify({ type, data }));
        } else {
            this.showStatus('Non connesso al server lobby', 'error');
        }
    }

    createGame(playerName) {
        // Se l'utente è autenticato, invia comunque il nome
        const nameToSend = this.isAuthenticated ? this.playerName : playerName?.trim();
        if (!nameToSend) {
            this.showStatus('Inserisci un nome valido', 'error');
            return;
        }
        this.sendMessage('create-game', { playerName: nameToSend });
    }

    joinGame(playerName, gameId) {
        if (!gameId?.trim()) {
            this.showStatus('Inserisci l\'ID partita', 'error');
            return;
        }
        // Se l'utente è autenticato, invia comunque il nome
        const nameToSend = this.isAuthenticated ? this.playerName : playerName?.trim();
        if (!nameToSend) {
            this.showStatus('Inserisci un nome valido', 'error');
            return;
        }
        this.sendMessage('join-game', { playerName: nameToSend, gameId: gameId.trim() });
    }

    leaveGame() {
        if (this.gameId) {
            this.sendMessage('leave-game', { 
                gameId: this.gameId, 
                playerId: this.playerId 
            });
        }
        this.resetGameState();
    }

    startGame() {
        if (this.gameId) {
            this.sendMessage('start-game', { gameId: this.gameId });
        }
    }

    handleGameCreated(data) {
        this.gameId = data.gameId;
        this.playerId = data.playerId;
        this.gameState = data.gameState;
        
        this.showGameInfo();
        this.updateGameDisplay();
        this.showStatus(`Partita creata! ID: ${this.gameId}. Servono 4 giocatori per iniziare.`, 'success');
    }

    handleGameJoined(data) {
        this.gameId = data.gameId;
        this.playerId = data.playerId;
        this.gameState = data.gameState;
        
        this.showGameInfo();
        this.updateGameDisplay();
        
        // Mostra messaggio personalizzato in base al numero di giocatori
        const playerCount = this.gameState.players.length;
        if (playerCount === 4) {
            this.showStatus('Sei entrato nella partita! Tutti i giocatori sono pronti.', 'success');
        } else {
            this.showStatus(`Sei entrato nella partita! Giocatori: ${playerCount}/4`, 'success');
        }
    }

    handleGameUpdated(data) {
        this.gameState = data.gameState;
        this.updateGameDisplay();
        
        // Mostra messaggio se fornito dal server
        if (data.message) {
            this.showStatus(data.message, 'info');
        }
    }

    handleGameStarted(data) {
        this.gameState = data.gameState;
        
        console.log('Partita iniziata! Redirect al gameplay...');
        this.showStatus('Partita iniziata! Reindirizzamento...', 'success');
        
        //Usa l'URL di redirect fornito dal server
        if (data.redirectUrl) {
            // Piccolo delay per mostrare il messaggio
            setTimeout(() => {
                window.location.href = data.redirectUrl;
            }, 1000);
        } else {
            // Fallback al metodo originale
            setTimeout(() => {
                window.location.href = `gioca.html?gameId=${this.gameId}&playerId=${this.playerId}`;
            }, 1000);
        }
    }

    async updateGameStats(won) {
        try {
            // Usa authManager per la richiesta autenticata
            const response = await authManager.authenticatedFetch('/api/update-game-stats', {
                method: 'POST',
                body: JSON.stringify({ won })
            });

            if (response.ok) {
                console.log('Statistiche aggiornate con successo');
            }
        } catch (error) {
            console.error('Errore aggiornamento statistiche:', error);
        }
    }

    showGameInfo() {
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('gameInfo').classList.add('show');
    }

    updateGameDisplay() {
        if (!this.gameState) return;

        // Aggiorna info partita
        document.getElementById('currentGameId').textContent = this.gameId;
        document.getElementById('playerCount').textContent = `${this.gameState.players.length}/4`;

        // Aggiorna lista giocatori con indicatore di autenticazione
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = '';
        
        this.gameState.players.forEach((player, index) => {
            const li = document.createElement('li');
            const authIcon = player.isAuthenticated ? '👤' : '👤‍🦯';
            const authStatus = player.isAuthenticated ? ' (Registrato)' : ' (Ospite)';
            const isYou = player.id === this.playerId ? ' (Tu)' : '';
            
            li.innerHTML = `
                <span class="player-auth-icon">${authIcon}</span>
                <span class="player-name">${player.name}${isYou}</span>
                <span class="player-status">${authStatus}</span>
            `;
            li.style.borderLeft = `5px solid ${this.getPlayerColor(index)}`;
            playersList.appendChild(li);
        });

        // Mostra informazioni sui giocatori mancanti
        const playersNeeded = 4 - this.gameState.players.length;
        if (playersNeeded > 0) {
            const infoDiv = document.createElement('div');
            infoDiv.className = 'players-info';
            infoDiv.innerHTML = `
                <p><strong>Servono ancora ${playersNeeded} giocatori per iniziare</strong></p>
                <p>Condividi l'ID partita: <code>${this.gameId}</code></p>
            `;
            playersList.appendChild(infoDiv);
        }

        // Mostra bottone start solo se:
        // 1. Sei il creatore (host)
        // 2. Ci sono esattamente 4 giocatori
        // 3. La partita è in attesa
        const startBtn = document.getElementById('startGameBtn');
        if (this.gameState.host === this.playerId && 
            this.gameState.players.length === 4 && 
            this.gameState.status === 'waiting') {
            startBtn.style.display = 'block';
            startBtn.disabled = false;
            startBtn.textContent = 'Inizia Partita';
        } else if (this.gameState.host === this.playerId && 
                   this.gameState.players.length < 4) {
            startBtn.style.display = 'block';
            startBtn.disabled = true;
            startBtn.textContent = `Aspetta altri giocatori (${this.gameState.players.length}/4)`;
        } else {
            startBtn.style.display = 'none';
        }
    }

    getPlayerColor(index) {
        const colors = ['#ff6b6b', '#4ecdc4', '#feca57', '#48dbfb'];
        return colors[index % colors.length];
    }

    resetGameState() {
        this.gameId = null;
        this.playerId = null;
        this.gameState = null;
        
        // Mostra menu principale
        document.getElementById('mainMenu').style.display = 'block';
        document.getElementById('gameInfo').classList.remove('show');
        
        // Pulisci input solo se non autenticato
        if (!this.isAuthenticated) {
            const playerNameInput = document.getElementById('playerName');
            const joinPlayerNameInput = document.getElementById('joinPlayerName');
            if (playerNameInput) playerNameInput.value = '';
            if (joinPlayerNameInput) joinPlayerNameInput.value = '';
        }
        
        const gameIdInput = document.getElementById('gameId');
        if (gameIdInput) gameIdInput.value = '';
    }

    showStatus(message, type) {
        const statusDiv = document.getElementById('status');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.className = `status ${type}`;
            statusDiv.classList.remove('hidden');
            
            // Nascondi dopo 5 secondi
            setTimeout(() => {
                statusDiv.classList.add('hidden');
            }, 5000);
        }
    }
}

// Istanza globale del client
let ludoClient;

// Funzioni globali per l'HTML
function createGame() {
    const playerName = document.getElementById('playerName').value;
    ludoClient.createGame(playerName);
}

function joinGame() {
    const playerName = document.getElementById('joinPlayerName').value;
    const gameId = document.getElementById('gameId').value;
    ludoClient.joinGame(playerName, gameId);
}

function leaveGame() {
    ludoClient.leaveGame();
}

function startGame() {
    ludoClient.startGame();
}

// Inizializza il client quando la pagina è caricata
window.onload = function () {
    ludoClient = new LudoClient();
    // Imposta la modalità di autenticazione all'avvio
    authManager.setAuthMode(true); // true = sessionStorage, false = cookie
};

// Gestione chiusura finestra
window.addEventListener('beforeunload', () => {
    if (ludoClient && ludoClient.gameId) {
        ludoClient.leaveGame();
    }
});
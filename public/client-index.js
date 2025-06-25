// client-index.js - JavaScript per il client Ludo con supporto autenticazione
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
            const response = await fetch('/api/userinfo', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.isAuthenticated = true;
                    this.userInfo = data;
                    this.playerName = data.nome;
                    console.log('Utente autenticato:', this.playerName);
                    this.updateUIForAuthenticatedUser();
                } else {
                    console.log('Utente non autenticato');
                    this.isAuthenticated = false;
                }
            } else {
                console.log('Utente non autenticato - response not ok');
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
            this.socket = new WebSocket('ws://localhost:3001');
            
            this.socket.onopen = () => {
                console.log('Connessione WebSocket aperta');
                this.isConnected = true;
                this.showStatus('Connesso al server', 'success');
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.socket.onclose = () => {
                console.log('Connessione chiusa');
                this.isConnected = false;
                this.showStatus('Connessione al server persa', 'error');
            };

            this.socket.onerror = (error) => {
                console.error('Errore WebSocket:', error);
                this.showStatus('Errore di connessione al server', 'error');
            };
        } catch (error) {
            console.error('Errore inizializzazione:', error);
            this.showStatus('Impossibile connettersi al server', 'error');
        }
    }

    handleMessage(message) {
        console.log('Messaggio ricevuto:', message);
        
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
            case 'game-finished':
                this.handleGameFinished(message.data);
                break;
            case 'player-turn':
                this.handlePlayerTurn(message.data);
                break;
            case 'dice-rolled':
                this.handleDiceRolled(message.data);
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
            console.log('Invio messaggio:', type, data);
            this.socket.send(JSON.stringify({ type, data }));
        } else {
            this.showStatus('Non connesso al server', 'error');
        }
    }

    createGame(playerName) {
        console.log('Creazione partita - isAuthenticated:', this.isAuthenticated);
        
        // Se l'utente è autenticato, non serve il nome dall'input
        if (this.isAuthenticated) {
            console.log('Creazione partita con utente autenticato:', this.playerName);
            this.sendMessage('create-game', {});
        } else {
            // Utente ospite - usa il nome fornito
            const finalPlayerName = playerName?.trim();
            if (!finalPlayerName) {
                this.showStatus('Inserisci un nome valido', 'error');
                return;
            }
            console.log('Creazione partita con utente ospite:', finalPlayerName);
            this.playerName = finalPlayerName;
            this.sendMessage('create-game', { playerName: this.playerName });
        }
    }

    joinGame(playerName, gameId) {
        console.log('Join partita - isAuthenticated:', this.isAuthenticated);
        
        if (!gameId?.trim()) {
            this.showStatus('Inserisci l\'ID partita', 'error');
            return;
        }

        // Se l'utente è autenticato, non serve il nome dall'input
        if (this.isAuthenticated) {
            console.log('Join partita con utente autenticato:', this.playerName);
            this.sendMessage('join-game', { gameId: gameId.trim() });
        } else {
            // Utente ospite - usa il nome fornito
            const finalPlayerName = playerName?.trim();
            if (!finalPlayerName) {
                this.showStatus('Inserisci un nome valido', 'error');
                return;
            }
            console.log('Join partita con utente ospite:', finalPlayerName);
            this.playerName = finalPlayerName;
            this.sendMessage('join-game', { 
                playerName: this.playerName, 
                gameId: gameId.trim() 
            });
        }
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

    rollDice() {
        if (this.gameId && this.canRoll()) {
            this.sendMessage('roll-dice', { 
                gameId: this.gameId, 
                playerId: this.playerId 
            });
        }
    }

    canRoll() {
        return this.gameState && 
               this.gameState.currentPlayer === this.playerId && 
               this.gameState.status === 'playing';
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
        this.showGameBoard();
        this.updateGameDisplay();
        this.showStatus('Partita iniziata!', 'success');
    }

    handleGameFinished(data) {
        this.gameState = data.gameState;
        const { winner, rankings } = data;
        
        // Mostra risultato partita
        let resultMessage = `Partita terminata! `;
        if (winner.id === this.playerId) {
            resultMessage += `🎉 HAI VINTO! 🎉`;
            if (this.isAuthenticated) {
                resultMessage += ` Le tue statistiche sono state aggiornate.`;
            }
        } else {
            resultMessage += `Ha vinto: ${winner.name}`;
        }
        
        this.showStatus(resultMessage, winner.id === this.playerId ? 'success' : 'info');
        
        // Aggiorna le statistiche se l'utente è autenticato
        if (this.isAuthenticated) {
            this.updateGameStats(winner.id === this.playerId);
        }
    }

    async updateGameStats(won) {
        try {
            const response = await fetch('/api/update-game-stats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ won })
            });
            
            if (response.ok) {
                console.log('Statistiche aggiornate con successo');
            }
        } catch (error) {
            console.error('Errore aggiornamento statistiche:', error);
        }
    }

    handlePlayerTurn(data) {
        this.gameState = data.gameState;
        this.updateCurrentPlayerDisplay();
        
        if (data.gameState.currentPlayer === this.playerId) {
            this.showStatus('È il tuo turno! Clicca il dado', 'info');
        } else {
            const currentPlayerName = this.getCurrentPlayerName();
            this.showStatus(`Turno di ${currentPlayerName}`, 'info');
        }
    }

    handleDiceRolled(data) {
        this.gameState = data.gameState;
        this.updateDiceDisplay(data.diceValue);
        
        if (data.playerId === this.playerId) {
            this.showStatus(`Hai tirato: ${data.diceValue}`, 'success');
        } else {
            const playerName = this.getPlayerName(data.playerId);
            this.showStatus(`${playerName} ha tirato: ${data.diceValue}`, 'info');
        }
    }

    showGameInfo() {
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('gameInfo').classList.add('show');
    }

    showGameBoard() {
        // Passa gameId e playerId nell'URL
        window.location.href = `gioca.html?gameId=${this.gameId}&playerId=${this.playerId}`;
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

        this.updateCurrentPlayerDisplay();
    }

    updateCurrentPlayerDisplay() {
        if (this.gameState && this.gameState.status === 'playing') {
            const currentPlayerName = this.getCurrentPlayerName();
            document.getElementById('currentPlayer').textContent = `Turno di: ${currentPlayerName}`;
        }
    }

    updateDiceDisplay(value) {
        const dice = document.getElementById('dice');
        if (dice) {
            dice.textContent = value;
            
            // Animazione del dado
            dice.style.transform = 'rotate(360deg) scale(1.2)';
            setTimeout(() => {
                dice.style.transform = 'rotate(0deg) scale(1)';
            }, 500);
        }
    }

    getCurrentPlayerName() {
        if (!this.gameState) return '';
        const currentPlayer = this.gameState.players.find(p => p.id === this.gameState.currentPlayer);
        return currentPlayer ? currentPlayer.name : '';
    }

    getPlayerName(playerId) {
        if (!this.gameState) return '';
        const player = this.gameState.players.find(p => p.id === playerId);
        return player ? player.name : '';
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
        const gameBoard = document.getElementById('gameBoard');
        const gameInfo = document.getElementById('gameInfo');
        
        if (gameBoard) gameBoard.style.display = 'none';
        if (gameInfo) gameInfo.style.display = 'none';
        
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

    // Utility per leggere il cookie
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
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

function rollDice() {
    ludoClient.rollDice();
}

// Inizializza il client quando la pagina è caricata
window.onload = function () {
    ludoClient = new LudoClient();
};

// Gestione chiusura finestra
window.addEventListener('beforeunload', () => {
    if (ludoClient && ludoClient.gameId) {
        ludoClient.leaveGame();
    }
});
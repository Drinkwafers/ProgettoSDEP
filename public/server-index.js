// server-index.js - Server Node.js per Ludo con supporto autenticazione completo
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
const cookieParser = require('cookie-parser');

const JWT_SECRET = "mia_chiave_super_segreta";

// Pool di connessioni MySQL
const pool = mysql.createPool({
    host: "localhost",
    user: "admin",
    password: "#C4labriaM!a",
    database: "sdep_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

class LudoServer {
    constructor() {
        this.games = new Map(); // Mappa delle partite attive
        this.clients = new Map(); // Mappa dei client connessi
        this.setupServer();
    }

    setupServer() {
        // Crea server Express per servire i file statici
        const app = express();
        app.use(express.static('.'));
        app.use(express.json());
        app.use(cookieParser());
        
        // API per ottenere info utente dal token
        app.get('/api/userinfo', (req, res) => {
            try {
                const token = req.cookies.authToken;
                if (!token) {
                    return res.json({ success: false, message: 'Token non trovato' });
                }

                const decoded = jwt.verify(token, JWT_SECRET);
                res.json({ 
                    success: true, 
                    userId: decoded.id,
                    nome: decoded.nome,
                    email: decoded.email 
                });
            } catch (error) {
                res.json({ success: false, message: 'Token non valido' });
            }
        });

        // API per aggiornare statistiche partita
        app.post('/api/update-game-stats', async (req, res) => {
            try {
                const token = req.cookies.authToken;
                if (!token) {
                    return res.json({ success: false, message: 'Non autenticato' });
                }

                const decoded = jwt.verify(token, JWT_SECRET);
                const { won } = req.body;
                
                await this.updatePlayerStats(decoded.id, won);
                res.json({ success: true });
            } catch (error) {
                console.error('Errore aggiornamento statistiche:', error);
                res.json({ success: false, message: 'Errore interno' });
            }
        });

        const server = http.createServer(app);
        
        // Crea server WebSocket
        this.wss = new WebSocket.Server({ server });
        
        this.wss.on('connection', (ws, req) => {
            console.log('Nuovo client connesso');
            
            // Genera ID unico per il client
            const clientId = this.generateId();
            this.clients.set(clientId, { 
                ws, 
                gameId: null,
                userInfo: null,
                isAuthenticated: false
            });
            
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data);

                    // Gestione autenticazione
                    if (message.type === 'auth' && message.token) {
                        try {
                            const payload = jwt.verify(message.token, JWT_SECRET);
                            const client = this.clients.get(clientId);
                            client.isAuthenticated = true;
                            client.userInfo = {
                                userId: payload.userId,
                                userName: payload.userName
                            };
                            console.log(`Client ${clientId} autenticato come ${payload.userName}`);
                        } catch (err) {
                            // Token non valido, resta ospite
                            console.log(`Token JWT non valido per client ${clientId}`);
                        }
                        return; // Non processare altro per questo messaggio
                    }

                    this.handleClientMessage(clientId, message);
                } catch (error) {
                    console.error('Errore parsing messaggio:', error);
                    this.sendError(ws, 'Messaggio non valido');
                }
            });
            
            ws.on('close', () => {
                console.log('Client disconnesso');
                this.handleClientDisconnect(clientId);
            });
            
            ws.on('error', (error) => {
                console.error('Errore WebSocket:', error);
            });
        });
        
        // Avvia server
        const PORT = process.env.PORT || 3001;
        server.listen(PORT, () => {
            console.log(`Server Ludo avviato su porta ${PORT}`);
            console.log(`Apri http://localhost:${PORT} nel browser`);
        });
    }

    async verifyUserAuth(userInfo) {
        if (!userInfo || !userInfo.userId) {
            return null;
        }

        try {
            // Verifica che l'utente esista nel database
            const query = "SELECT id, nome FROM utenti WHERE id = ?";
            const [rows] = await pool.promise().execute(query, [userInfo.userId]);
            
            if (rows.length > 0) {
                return {
                    userId: rows[0].id,
                    userName: rows[0].nome
                };
            }
        } catch (error) {
            console.error('Errore verifica autenticazione:', error);
        }
        
        return null;
    }

    async handleClientMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client) return;

        console.log(`Messaggio da ${clientId}:`, message);

        // Gestisci informazioni di autenticazione se presenti
        if (message.data && message.data.isAuthenticated && message.data.userInfo) {
            const verifiedUser = await this.verifyUserAuth(message.data.userInfo);
            if (verifiedUser) {
                client.isAuthenticated = true;
                client.userInfo = verifiedUser;
                console.log(`Client ${clientId} autenticato come ${verifiedUser.userName}`);
            }
        }

        switch (message.type) {
            case 'create-game':
                this.createGame(clientId, message.data);
                break;
            case 'join-game':
                this.joinGame(clientId, message.data);
                break;
            case 'leave-game':
                this.leaveGame(clientId, message.data);
                break;
            case 'start-game':
                this.startGame(clientId, message.data);
                break;
            case 'roll-dice':
                this.rollDice(clientId, message.data);
                break;
            default:
                this.sendError(client.ws, 'Tipo messaggio non riconosciuto');
        }
    }

    createGame(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { playerName } = data;
        if (!playerName || playerName.trim() === '') {
            this.sendError(client.ws, 'Nome giocatore richiesto');
            return;
        }

        // Genera ID partita unico
        const gameId = this.generateGameId();
        const playerId = this.generateId();

        // Crea nuova partita
        const game = {
            id: gameId,
            host: playerId,
            players: [{
                id: playerId,
                name: playerName.trim(),
                clientId: clientId,
                color: 0,
                pieces: [0, 0, 0, 0], // Posizioni dei pezzi
                finished: false,
                isAuthenticated: client.isAuthenticated,
                userId: client.isAuthenticated ? client.userInfo.userId : null
            }],
            status: 'waiting', // waiting, playing, finished
            currentPlayer: null,
            lastDiceRoll: null,
            created: new Date()
        };

        this.games.set(gameId, game);
        client.gameId = gameId;

        // Invia conferma al client
        this.sendToClient(clientId, {
            type: 'game-created',
            data: {
                gameId: gameId,
                playerId: playerId,
                gameState: this.getGameStateForClient(game)
            }
        });

        console.log(`Partita ${gameId} creata da ${playerName} (${client.isAuthenticated ? 'Autenticato' : 'Ospite'})`);
    }

    joinGame(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { playerName, gameId } = data;
        if (!playerName || !gameId) {
            this.sendError(client.ws, 'Nome giocatore e ID partita richiesti');
            return;
        }

        const game = this.games.get(gameId);
        if (!game) {
            this.sendError(client.ws, 'Partita non trovata');
            return;
        }

        if (game.status !== 'waiting') {
            this.sendError(client.ws, 'Partita già iniziata');
            return;
        }

        if (game.players.length >= 4) {
            this.sendError(client.ws, 'Partita piena');
            return;
        }

        // Controlla se il nome è già in uso
        if (game.players.some(p => p.name === playerName.trim())) {
            this.sendError(client.ws, 'Nome già in uso in questa partita');
            return;
        }

        // Se l'utente è autenticato, controlla se è già in partita con lo stesso account
        if (client.isAuthenticated) {
            const existingPlayer = game.players.find(p => p.isAuthenticated && p.userId === client.userInfo.userId);
            if (existingPlayer) {
                this.sendError(client.ws, 'Account già presente in questa partita');
                return;
            }
        }

        const playerId = this.generateId();
        const player = {
            id: playerId,
            name: playerName.trim(),
            clientId: clientId,
            color: game.players.length,
            pieces: [0, 0, 0, 0],
            finished: false,
            isAuthenticated: client.isAuthenticated,
            userId: client.isAuthenticated ? client.userInfo.userId : null
        };

        game.players.push(player);
        client.gameId = gameId;

        // Invia conferma al nuovo giocatore
        this.sendToClient(clientId, {
            type: 'game-joined',
            data: {
                gameId: gameId,
                playerId: playerId,
                gameState: this.getGameStateForClient(game)
            }
        });

        // Notifica tutti i giocatori dell'aggiornamento
        this.broadcastToGame(gameId, {
            type: 'game-updated',
            data: {
                gameState: this.getGameStateForClient(game)
            }
        });

        console.log(`${playerName} (${client.isAuthenticated ? 'Autenticato' : 'Ospite'}) si è unito alla partita ${gameId}`);
    }

    leaveGame(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client || !client.gameId) return;

        const game = this.games.get(client.gameId);
        if (!game) return;

        // Rimuovi giocatore dalla partita
        game.players = game.players.filter(p => p.clientId !== clientId);
        client.gameId = null;

        if (game.players.length === 0) {
            // Elimina partita se vuota
            this.games.delete(game.id);
            console.log(`Partita ${game.id} eliminata`);
        } else {
            // Se era l'host, passa l'host al prossimo giocatore
            if (game.host === data.playerId && game.players.length > 0) {
                game.host = game.players[0].id;
            }

            // Notifica giocatori rimanenti
            this.broadcastToGame(game.id, {
                type: 'game-updated',
                data: {
                    gameState: this.getGameStateForClient(game)
                }
            });
        }
    }

    startGame(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { gameId } = data;
        const game = this.games.get(gameId);
        
        if (!game) {
            this.sendError(client.ws, 'Partita non trovata');
            return;
        }

        const player = game.players.find(p => p.clientId === clientId);
        if (!player || player.id !== game.host) {
            this.sendError(client.ws, 'Solo l\'host può iniziare la partita');
            return;
        }

        if (game.players.length < 2) {
            this.sendError(client.ws, 'Servono almeno 2 giocatori');
            return;
        }

        if (game.status !== 'waiting') {
            this.sendError(client.ws, 'Partita già iniziata');
            return;
        }

        // Inizia la partita
        game.status = 'playing';
        game.currentPlayer = game.players[0].id;

        // Notifica tutti i giocatori
        this.broadcastToGame(gameId, {
            type: 'game-started',
            data: {
                gameState: this.getGameStateForClient(game)
            }
        });

        // Notifica del turno
        this.broadcastToGame(gameId, {
            type: 'player-turn',
            data: {
                gameState: this.getGameStateForClient(game)
            }
        });

        console.log(`Partita ${gameId} iniziata`);
    }

    rollDice(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { gameId, playerId } = data;
        const game = this.games.get(gameId);
        
        if (!game) {
            this.sendError(client.ws, 'Partita non trovata');
            return;
        }

        if (game.status !== 'playing') {
            this.sendError(client.ws, 'Partita non in corso');
            return;
        }

        if (game.currentPlayer !== playerId) {
            this.sendError(client.ws, 'Non è il tuo turno');
            return;
        }

        // Simula il lancio del dado
        const diceValue = Math.floor(Math.random() * 6) + 1;
        game.lastDiceRoll = diceValue;

        // Notifica tutti i giocatori del risultato del dado
        this.broadcastToGame(gameId, {
            type: 'dice-rolled',
            data: {
                gameState: this.getGameStateForClient(game),
                playerId: playerId,
                diceValue: diceValue
            }
        });

        // Simula fine partita (per test - da implementare la logica reale)
        const shouldEndGame = Math.random() < 0.1; // 10% probabilità di finire la partita
        if (shouldEndGame) {
            this.endGame(game);
        } else {
            // Passa al prossimo giocatore
            this.nextPlayer(game);
        }
    }

    async endGame(game) {
        game.status = 'finished';
        
        // Determina il vincitore (per ora casuale - da implementare logica reale)
        const winner = game.players[Math.floor(Math.random() * game.players.length)];
        
        // Aggiorna statistiche per tutti i giocatori autenticati
        for (const player of game.players) {
            if (player.isAuthenticated && player.userId) {
                const won = player.id === winner.id;
                await this.updatePlayerStats(player.userId, won);
            }
        }

        // Notifica fine partita
        this.broadcastToGame(game.id, {
            type: 'game-finished',
            data: {
                gameState: this.getGameStateForClient(game),
                winner: {
                    id: winner.id,
                    name: winner.name
                }
            }
        });

        console.log(`Partita ${game.id} terminata. Vincitore: ${winner.name}`);
    }

    async updatePlayerStats(userId, won) {
        try {
            // Controlla se l'utente ha già un record nella tabella partite
            const checkQuery = "SELECT vinte, giocate FROM partite WHERE utente_id = ?";
            const [rows] = await pool.promise().execute(checkQuery, [userId]);
            
            if (rows.length > 0) {
                // Aggiorna record esistente
                const newWins = rows[0].vinte + (won ? 1 : 0);
                const newGames = rows[0].giocate + 1;
                
                const updateQuery = "UPDATE partite SET vinte = ?, giocate = ? WHERE utente_id = ?";
                await pool.promise().execute(updateQuery, [newWins, newGames, userId]);
                
                console.log(`Statistiche aggiornate per utente ${userId}: ${newWins}/${newGames}`);
            } else {
                // Crea nuovo record
                const insertQuery = "INSERT INTO partite (utente_id, vinte, giocate) VALUES (?, ?, ?)";
                const wins = won ? 1 : 0;
                await pool.promise().execute(insertQuery, [userId, wins, 1]);
                
                console.log(`Nuovo record statistiche creato per utente ${userId}: ${wins}/1`);
            }
        } catch (error) {
            console.error('Errore aggiornamento statistiche database:', error);
        }
    }

    nextPlayer(game) {
        const currentIndex = game.players.findIndex(p => p.id === game.currentPlayer);
        const nextIndex = (currentIndex + 1) % game.players.length;
        game.currentPlayer = game.players[nextIndex].id;

        this.broadcastToGame(game.id, {
            type: 'player-turn',
            data: {
                gameState: this.getGameStateForClient(game)
            }
        });
    }

    handleClientDisconnect(clientId) {
        const client = this.clients.get(clientId);
        if (client && client.gameId) {
            this.leaveGame(clientId, {});
        }
        this.clients.delete(clientId);
    }

    getGameStateForClient(game) {
        return {
            id: game.id,
            host: game.host,
            players: game.players.map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                pieces: p.pieces,
                finished: p.finished,
                isAuthenticated: p.isAuthenticated
            })),
            status: game.status,
            currentPlayer: game.currentPlayer,
            lastDiceRoll: game.lastDiceRoll
        };
    }

    getPlayerName(game, playerId) {
        const player = game.players.find(p => p.id === playerId);
        return player ? player.name : 'Sconosciuto';
    }

    broadcastToGame(gameId, message) {
        const game = this.games.get(gameId);
        if (!game) return;

        game.players.forEach(player => {
            const client = this.clients.get(player.clientId);
            if (client && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify(message));
            }
        });
    }

    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    }

    sendError(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'error',
                message: message
            }));
        }
    }

    sendInfo(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'info',
                message: message
            }));
        }
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    generateGameId() {
        let gameId;
        do {
            gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
        } while (this.games.has(gameId));
        return gameId;
    }

    // Metodi di utilità per il debug
    getGamesInfo() {
        const gamesInfo = [];
        this.games.forEach((game, gameId) => {
            gamesInfo.push({
                id: gameId,
                players: game.players.length,
                status: game.status,
                authenticatedPlayers: game.players.filter(p => p.isAuthenticated).length,
                created: game.created
            });
        });
        return gamesInfo;
    }

    getClientsInfo() {
        const authenticatedClients = Array.from(this.clients.values()).filter(c => c.isAuthenticated).length;
        return {
            total: this.clients.size,
            authenticated: authenticatedClients,
            guests: this.clients.size - authenticatedClients,
            inGame: Array.from(this.clients.values()).filter(c => c.gameId).length
        };
    }
}

// Avvia il server
const ludoServer = new LudoServer();

// Gestione graceful shutdown
process.on('SIGINT', () => {
    console.log('\nChiusura server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nChiusura server...');
    process.exit(0);
});

// Log periodico delle statistiche
setInterval(() => {
    const gamesInfo = ludoServer.getGamesInfo();
    const clientsInfo = ludoServer.getClientsInfo();
    
    console.log(`\n=== Statistiche Server ===`);
    console.log(`Partite attive: ${gamesInfo.length}`);
    console.log(`Client connessi: ${clientsInfo.total}`);
    console.log(`  - Autenticati: ${clientsInfo.authenticated}`);
    console.log(`  - Ospiti: ${clientsInfo.guests}`);
    console.log(`  - In partita: ${clientsInfo.inGame}`);
    
    if (gamesInfo.length > 0) {
        console.log('Partite:');
        gamesInfo.forEach(game => {
            console.log(`  ${game.id}: ${game.players} giocatori (${game.authenticatedPlayers} autenticati), ${game.status}`);
        });
    }
    console.log(`========================\n`);
}, 30000); // Ogni 30 secondi

module.exports = LudoServer;
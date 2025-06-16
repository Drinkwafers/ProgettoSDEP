// server.js - Server Node.js per Ludo
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

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
        
        const server = http.createServer(app);
        
        // Crea server WebSocket
        this.wss = new WebSocket.Server({ server });
        
        this.wss.on('connection', (ws) => {
            console.log('Nuovo client connesso');
            
            // Genera ID unico per il client
            const clientId = this.generateId();
            this.clients.set(clientId, { ws, gameId: null });
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
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

    handleClientMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client) return;

        console.log(`Messaggio da ${clientId}:`, message);

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
                finished: false
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

        console.log(`Partita ${gameId} creata da ${playerName}`);
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

        const playerId = this.generateId();
        const player = {
            id: playerId,
            name: playerName.trim(),
            clientId: clientId,
            color: game.players.length,
            pieces: [0, 0, 0, 0],
            finished: false
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

        console.log(`${playerName} si è unito alla partita ${gameId}`);
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
            this.sendError(client.ws, 'La partita non è iniziata');
            return;
        }

        if (game.currentPlayer !== playerId) {
            this.sendError(client.ws, 'Non è il tuo turno');
            return;
        }

        // Tira il dado (1-6)
        const diceValue = Math.floor(Math.random() * 6) + 1;
        game.lastDiceRoll = diceValue;

        // Notifica il risultato del dado
        this.broadcastToGame(gameId, {
            type: 'dice-rolled',
            data: {
                playerId: playerId,
                diceValue: diceValue,
                gameState: this.getGameStateForClient(game)
            }
        });

        // Passa al prossimo giocatore dopo un breve delay
        setTimeout(() => {
            this.nextPlayer(game);
        }, 2000);

        console.log(`${this.getPlayerName(game, playerId)} ha tirato ${diceValue} nella partita ${gameId}`);
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
                finished: p.finished
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
                created: game.created
            });
        });
        return gamesInfo;
    }

    getClientsInfo() {
        return {
            total: this.clients.size,
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
    console.log(`Client connessi: ${clientsInfo.total} (${clientsInfo.inGame} in partita)`);
    
    if (gamesInfo.length > 0) {
        console.log('Partite:');
        gamesInfo.forEach(game => {
            console.log(`  ${game.id}: ${game.players} giocatori, ${game.status}`);
        });
    }
    console.log(`========================\n`);
}, 30000); // Ogni 30 secondi

module.exports = LudoServer;
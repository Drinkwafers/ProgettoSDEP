// server-index.js (WebSocket - porta 3001)
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT_WS || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'mia_chiave_super_segreta'; // Usa la stessa chiave del server di login

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(cookieParser());

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// Variabili globali per tenere traccia delle partite
const games = {};
const playerSockets = {}; // playerId -> ws

server.on('upgrade', (request, socket, head) => {
  cookieParser()(request, null, () => {
    let user = null;
    try {
      // Correggi: usa 'token' invece di 'access_token'
      const token = request.cookies.token;
      if (token) {
        const payload = jwt.verify(token, JWT_SECRET);
        user = { userId: payload.userId, userName: payload.userName };
      }
    } catch (error) {
      console.log('Token non valido o assente:', error.message);
      user = null;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.user = user;
      wss.emit('connection', ws, request);
    });
  });
});

wss.on('connection', (ws) => {
  console.log('Nuova connessione WebSocket:', {
    isAuthenticated: Boolean(ws.user),
    user: ws.user
  });

  ws.on('message', function incoming(message) {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Messaggio non valido' }));
      return;
    }

    console.log('Messaggio ricevuto:', msg.type, msg.data);

    if (msg.type === 'create-game') {
      // Determina il nome del giocatore
      let playerName;
      let isAuthenticated = false;
      
      if (ws.user) {
        // Utente autenticato - usa il nome dal JWT
        playerName = ws.user.userName;
        isAuthenticated = true;
        console.log('Creazione partita - Utente autenticato:', playerName);
      } else {
        // Utente ospite - usa il nome fornito
        playerName = msg.data?.playerName?.trim();
        if (!playerName) {
          ws.send(JSON.stringify({ type: 'error', message: 'Nome giocatore mancante' }));
          return;
        }
        console.log('Creazione partita - Utente ospite:', playerName);
      }

      const gameId = Math.random().toString(36).substr(2, 8);
      const playerId = Math.random().toString(36).substr(2, 9);

      // Stato base della partita
      const gameState = {
        players: [{
          id: playerId,
          name: playerName,
          isAuthenticated: isAuthenticated
        }],
        host: playerId,
        status: 'waiting'
      };

      // Salva la partita
      games[gameId] = gameState;

      // Salva la connessione
      playerSockets[playerId] = ws;

      ws.send(JSON.stringify({
        type: 'game-created',
        data: {
          gameId,
          playerId,
          gameState,
          message: 'Partita creata! Attendere altri 3 giocatori per iniziare.'
        }
      }));
    }
    else if (msg.type === 'join-game') {
      const { gameId } = msg.data || {};
      
      // Determina il nome del giocatore
      let playerName;
      let isAuthenticated = false;
      
      if (ws.user) {
        // Utente autenticato - usa il nome dal JWT
        playerName = ws.user.userName;
        isAuthenticated = true;
        console.log('Join partita - Utente autenticato:', playerName);
      } else {
        // Utente ospite - usa il nome fornito
        playerName = msg.data?.playerName?.trim();
        if (!playerName) {
          ws.send(JSON.stringify({ type: 'error', message: 'Nome giocatore mancante' }));
          return;
        }
        console.log('Join partita - Utente ospite:', playerName);
      }

      if (!gameId || !gameId.trim()) {
        ws.send(JSON.stringify({ type: 'error', message: 'ID partita mancante' }));
        return;
      }

      // Cerca la partita
      const game = games[gameId.trim()];
      if (!game) {
        ws.send(JSON.stringify({ type: 'error', message: 'Partita non trovata' }));
        return;
      }

      // Limite giocatori
      if (game.players.length >= 4) {
        ws.send(JSON.stringify({ type: 'error', message: 'La partita è piena' }));
        return;
      }

      // Nome già presente
      if (game.players.some(p => p.name === playerName)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Nome già presente nella partita' }));
        return;
      }

      // Genera un nuovo playerId
      const playerId = Math.random().toString(36).substr(2, 9);

      // Aggiungi il giocatore alla partita
      game.players.push({
        id: playerId,
        name: playerName,
        isAuthenticated: isAuthenticated
      });

      // Salva la connessione
      playerSockets[playerId] = ws;

      // Notifica il join solo a chi si è appena connesso
      const joinMessage = game.players.length === 4 
        ? 'Sei entrato nella partita! Tutti i giocatori sono pronti.' 
        : `Sei entrato nella partita! Giocatori: ${game.players.length}/4`;

      ws.send(JSON.stringify({
        type: 'game-joined',
        data: {
          gameId,
          playerId,
          gameState: game,
          message: joinMessage
        }
      }));

      // Notifica a tutti i giocatori lo stato aggiornato
      const updateMessage = game.players.length === 4 
        ? 'Tutti i giocatori sono pronti! L\'host può avviare la partita.' 
        : `Giocatori: ${game.players.length}/4 - Attendere altri giocatori`;

      game.players.forEach(player => {
        const playerWs = playerSockets[player.id];
        if (playerWs) {
          playerWs.send(JSON.stringify({
            type: 'game-updated',
            data: { 
              gameState: game,
              message: updateMessage
            }
          }));
        }
      });
    }
    else if (msg.type === 'start-game') {
      const { gameId } = msg.data || {};
      if (!gameId || !games[gameId]) {
        ws.send(JSON.stringify({ type: 'error', message: 'Partita non trovata' }));
        return;
      }

      const game = games[gameId];

      // Trova l'host nella lista dei giocatori
      const hostPlayer = game.players.find(p => p.id === game.host);
      if (!hostPlayer) {
        ws.send(JSON.stringify({ type: 'error', message: 'Host non trovato' }));
        return;
      }

      // Verifica che il messaggio arrivi dall'host
      const senderPlayer = game.players.find(p => playerSockets[p.id] === ws);
      if (!senderPlayer || senderPlayer.id !== game.host) {
        ws.send(JSON.stringify({ type: 'error', message: 'Solo l\'host può avviare la partita' }));
        return;
      }

      // CONTROLLO CRUCIALE: Verifica che ci siano esattamente 4 giocatori
      if (game.players.length !== 4) {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: `Servono esattamente 4 giocatori per iniziare! Attualmente: ${game.players.length}/4` 
        }));
        return;
      }

      // Assegna i colori ai giocatori nell'ordine di ingresso
      const colori = ['blu', 'rosso', 'verde', 'giallo'];
      game.players.forEach((player, idx) => {
        player.color = colori[idx];
      });

      game.status = 'in-progress';

      // AGGIUNGI: imposta il turno corrente al primo giocatore
      game.turnoCorrente = game.players[0].color;

      // Notifica a tutti i giocatori con i dati necessari
      game.players.forEach((player, idx) => {
        const playerWs = playerSockets[player.id];
        if (playerWs) {
          playerWs.send(JSON.stringify({
            type: 'game-started',
            data: {
              gameId,
              playerId: player.id,
              color: player.color,
              gameState: game,
              turnoCorrente: game.turnoCorrente
            }
          }));
        }
      });
    }
    else if (msg.type === 'leave-game') {
      const { gameId, playerId } = msg.data || {};
      if (!gameId || !games[gameId] || !playerId) {
        return;
      }

      const game = games[gameId];
      
      // Rimuovi il giocatore dalla partita
      game.players = game.players.filter(p => p.id !== playerId);
      
      // Rimuovi la connessione
      delete playerSockets[playerId];

      // Se non ci sono più giocatori, elimina la partita
      if (game.players.length === 0) {
        delete games[gameId];
        return;
      }

      // Se l'host ha lasciato la partita, assegna il ruolo al primo giocatore rimasto
      if (game.host === playerId && game.players.length > 0) {
        game.host = game.players[0].id;
      }

      // Notifica a tutti i giocatori rimasti
      const updateMessage = `Un giocatore ha lasciato la partita. Giocatori: ${game.players.length}/4`;
      
      game.players.forEach(player => {
        const playerWs = playerSockets[player.id];
        if (playerWs) {
          playerWs.send(JSON.stringify({
            type: 'game-updated',
            data: { 
              gameState: game,
              message: updateMessage
            }
          }));
        }
      });
    }
  });

  // Gestione disconnessione
  ws.on('close', () => {
    console.log('Connessione WebSocket chiusa');
    // Trova il giocatore associato a questa connessione
    const playerId = Object.keys(playerSockets).find(id => playerSockets[id] === ws);
    if (playerId) {
      // Trova la partita in cui è il giocatore
      const gameId = Object.keys(games).find(id => 
        games[id].players.some(p => p.id === playerId)
      );
      
      if (gameId) {
        const game = games[gameId];
        
        // Rimuovi il giocatore
        game.players = game.players.filter(p => p.id !== playerId);
        delete playerSockets[playerId];

        // Se non ci sono più giocatori, elimina la partita
        if (game.players.length === 0) {
          delete games[gameId];
          return;
        }

        // Se l'host si è disconnesso, assegna il ruolo al primo giocatore rimasto
        if (game.host === playerId && game.players.length > 0) {
          game.host = game.players[0].id;
        }

        // Notifica agli altri giocatori
        const updateMessage = `Un giocatore si è disconnesso. Giocatori: ${game.players.length}/4`;
        
        game.players.forEach(player => {
          const playerWs = playerSockets[player.id];
          if (playerWs) {
            playerWs.send(JSON.stringify({
              type: 'game-updated',
              data: { 
                gameState: game,
                message: updateMessage
              }
            }));
          }
        });
      }
    }
  });
});

server.listen(PORT, () => console.log(`WS server listening on ${PORT}`));
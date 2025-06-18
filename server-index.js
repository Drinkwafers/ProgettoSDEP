// server-index.js (WebSocket - porta 3001)
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT_WS || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

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
      const token = request.cookies.access_token;
      const payload = jwt.verify(token, JWT_SECRET);
      user = { userId: payload.userId, userName: payload.userName };
    } catch {
      user = null;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      ws.user = user;
      wss.emit('connection', ws, request);
    });
  });
});

wss.on('connection', (ws) => {
  const clientInfo = {
    isAuthenticated: Boolean(ws.user),
    userInfo: ws.user
  };

  ws.on('message', function incoming(message) {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Messaggio non valido' }));
      return;
    }

    if (msg.type === 'create-game') {
      const playerName = msg.data?.playerName?.trim();
      if (!playerName) {
        ws.send(JSON.stringify({ type: 'error', message: 'Nome giocatore mancante' }));
        return;
      }

      const gameId = Math.random().toString(36).substr(2, 8);
      const playerId = Math.random().toString(36).substr(2, 9);

      // Stato base della partita
      const gameState = {
        players: [{
          id: playerId,
          name: playerName,
          isAuthenticated: clientInfo.isAuthenticated
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
          message: 'Partita creata!'
        }
      }));
    }
    else if (msg.type === 'join-game') {
      const { gameId, playerName } = msg.data || {};
      const finalPlayerName = clientInfo.isAuthenticated && clientInfo.userInfo?.userName
        ? clientInfo.userInfo.userName
        : (playerName ? playerName.trim() : '');

      if (!finalPlayerName || !gameId || !gameId.trim()) {
        ws.send(JSON.stringify({ type: 'error', message: 'Inserisci nome e ID partita' }));
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
      if (game.players.some(p => p.name === finalPlayerName)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Nome già presente nella partita' }));
        return;
      }

      // Genera un nuovo playerId
      const playerId = Math.random().toString(36).substr(2, 9);

      // Aggiungi il giocatore alla partita
      game.players.push({
        id: playerId,
        name: finalPlayerName,
        isAuthenticated: clientInfo.isAuthenticated
      });

      // Salva la connessione
      playerSockets[playerId] = ws;

      // Notifica il join solo a chi si è appena connesso
      ws.send(JSON.stringify({
        type: 'game-joined',
        data: {
          gameId,
          playerId,
          gameState: game,
          message: 'Sei entrato nella partita!'
        }
      }));

      // Notifica a tutti i giocatori lo stato aggiornato
      game.players.forEach(player => {
        const playerWs = playerSockets[player.id];
        if (playerWs && playerWs !== ws) {
          playerWs.send(JSON.stringify({
            type: 'game-updated',
            data: { gameState: game }
          }));
        }
      });
    }

    // ...gestione altri tipi di messaggi...
  });
});

server.listen(PORT, () => console.log(`WS server listening on ${PORT}`));

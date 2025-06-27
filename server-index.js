// server-index.js (porta WS 3001)
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT_WS || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'mia_chiave_super_segreta';

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(cookieParser());

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// Stato partite e mapping socket
const games = {};
const playerSockets = {};

// Upgrade per WS con verifica cookie JWT
server.on('upgrade', (req, socket, head) => {
  cookieParser()(req, null, () => {
    let user = null;
    try {
      const token = req.cookies.token;
      if (token) user = jwt.verify(token, JWT_SECRET);
    } catch {}
    wss.handleUpgrade(req, socket, head, ws => {
      ws.user = user;
      wss.emit('connection', ws, req);
    });
  });
});

wss.on('connection', ws => {
  console.log('Connessione WS:', Boolean(ws.user));
  ws.on('message', msgStr => {
    let msg;
    try { msg = JSON.parse(msgStr); } catch {
      return ws.send(JSON.stringify({ type: 'error', message: 'Messaggio non valido' }));
    }

    // Auth via sessionStorage token
    if (msg.type === 'auth' && msg.data?.token) {
      try {
        ws.user = jwt.verify(msg.data.token, JWT_SECRET);
        ws.send(JSON.stringify({ type: 'info', message: 'Autenticazione WS riuscita' }));
      } catch {
        return ws.send(JSON.stringify({ type: 'error', message: 'Token non valido' }));
      }
      return;
    }

    // Rejoin dopo redirect
    if (msg.type === 'rejoin-game') {
      const { gameId, playerId } = msg.data;
      const game = games[gameId];
      if (!game) return ws.send(JSON.stringify({ type: 'error', message: 'Partita non trovata' }));
      playerSockets[playerId] = ws;
      return ws.send(JSON.stringify({ type: 'rejoined', data: { gameState: game } }));
    }

    // Crea nuova partita
    if (msg.type === 'create-game') {
      const name = msg.data.playerName;
      const gameId = Math.random().toString(36).substr(2,8);
      const playerId = Math.random().toString(36).substr(2,9);
      const colorOrder = ['blu','rosso','verde','giallo'];
      const gameState = {
        players: [{ id: playerId, name, color: null, pedine: [] }],
        host: playerId,
        turnoCorrente: null,
        gameData: {},
        status: 'waiting'
      };
      games[gameId] = gameState;
      playerSockets[playerId] = ws;
      ws.send(JSON.stringify({ type: 'game-created', data: { gameId, playerId, gameState } }));
      return;
    }

    // Join partita
    if (msg.type === 'join-game') {
      const { gameId, playerName } = msg.data;
      const game = games[gameId];
      if (!game || game.players.length >= 4) return ws.send(JSON.stringify({ type: 'error', message: 'Impossibile entrare' }));
      const playerId = Math.random().toString(36).substr(2,9);
      game.players.push({ id: playerId, name: playerName, color: null, pedine: [] });
      playerSockets[playerId] = ws;
      // Notifica join
      ws.send(JSON.stringify({ type: 'game-joined', data: { gameId, playerId, gameState: game } }));
      // Broadcast update
      game.players.forEach(p => playerSockets[p.id]?.send(JSON.stringify({ type: 'game-updated', data: { gameState: game } })));
      return;
    }

    // Start partita
    if (msg.type === 'start-game') {
      const { gameId } = msg.data;
      const game = games[gameId];
      if (!game || game.players.length !== 4) return ws.send(JSON.stringify({ type: 'error', message: 'Serve 4 giocatori' }));
      // Assegna colori e pedine
      const colors = ['blu','rosso','verde','giallo'];
      game.players.forEach((p,i) => {
        p.color = colors[i];
        p.pedine = Array(4).fill({ posizione:'base', casella:null });
      });
      game.turnoCorrente = colors[0];
      game.status = 'playing';
      // Broadcast start
      game.players.forEach(p => {
        playerSockets[p.id]?.send(JSON.stringify({ type: 'game-started', data: { gameState: game, color: p.color } }));
      });
      return;
    }

    // Tira dado
    if (msg.type === 'throw-dice') {
      console.log('Ricevuto comando di tiro dado:', msg);
      const { gameId, playerId } = msg.data;
      const game = games[gameId];
      if (!game) return;
      const player = game.players.find(p=>p.id===playerId);
      if (game.turnoCorrente !== player.color) return ws.send(JSON.stringify({ type: 'error', message: 'Non è il tuo turno' }));
      const roll = Math.floor(Math.random()*6)+1;
      game.gameData.ultimoDado = roll;
      game.gameData.dadoTirato = true;
      game.players.forEach(p => playerSockets[p.id]?.send(JSON.stringify({ type:'dice-thrown', data:{ gameState:game, diceResult:roll, playerColor:p.color } })));      
      return;
    }

    // Muovi pedina
    if (msg.type === 'move-piece') {
      console.log('Ricevuto comando di movimento pedina:', msg);
      const { gameId, playerId, pieceId, newPosition } = msg.data;
      const game = games[gameId];
      if (!game) return;
      const player = game.players.find(p=>p.id===playerId);
      if (game.turnoCorrente!==player.color || !game.gameData.dadoTirato) return ws.send(JSON.stringify({ type:'error', message:'Azione non valida' }));
      const [type, idx] = newPosition.split('-');
      player.pedine[pieceId-1] = { posizione:type, casella:parseInt(idx,10) };
      game.gameData.dadoTirato = false;
      // Avanza turno
      const i = game.players.findIndex(p=>p.id===playerId);
      game.turnoCorrente = game.players[(i+1)%game.players.length].color;
      // Broadcast move
      game.players.forEach(p => playerSockets[p.id]?.send(JSON.stringify({ type:'piece-moved', data:{ gameState:game } })));
      // Verifica vittoria
      if (player.pedine.every(pd=>pd.posizione==='destinazione')) {
        game.status='finished';
        game.players.forEach(p => playerSockets[p.id]?.send(JSON.stringify({ type:'game-finished', data:{ gameState:game, winner:player } })));
        delete games[gameId];
      }
      return;
    }

    // Leave e close
  });
});
server.listen(PORT, () => console.log(`WS server listening on ${PORT}`));
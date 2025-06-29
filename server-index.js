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
        const gameId = Math.random().toString(36).substr(2, 8);
        const playerId = Math.random().toString(36).substr(2, 9);

        // Rileva se l'utente è autenticato (sessionStorage o cookie)
        const isAuth = ws.user && ws.user.userId;
        const playerEntry = {
            id: playerId,
            name: isAuth ? ws.user.userName : name,
            color: null,
            pedine: [],
            isAuthenticated: Boolean(isAuth),
            userId: isAuth ? ws.user.userId : null
        };

        const gameState = {
            players: [playerEntry],
            host: playerId,
            gameData: {
                turnoNumero: 1,
                dadoTirato: false,
                ultimoDado: 0
            },
            status: 'waiting'
        };

        games[gameId] = gameState;
        playerSockets[playerId] = ws;
        ws.send(JSON.stringify({
            type: 'game-created',
            data: { gameId, playerId, gameState }
        }));
        return;
    }

    // Join partita
    if (msg.type === 'join-game') {
        const { gameId, playerName } = msg.data;
        const game = games[gameId];

        if (!game || game.players.length >= 4) {
            return ws.send(JSON.stringify({
                type: 'error',
                message: 'Impossibile entrare nella partita'
            }));
       }

       const playerId = Math.random().toString(36).substr(2, 9);
        // Rileva autenticazione
        const isAuth = ws.user && ws.user.userId;
        const playerEntry = {
            id: playerId,
            name: isAuth ? ws.user.userName : playerName,
            color: null,
            pedine: [],
            isAuthenticated: Boolean(isAuth),
            userId: isAuth ? ws.user.userId : null
        };

        game.players.push(playerEntry);
       playerSockets[playerId] = ws;

        // Notifica join
        ws.send(JSON.stringify({
            type: 'game-joined',
            data: { gameId, playerId, gameState: game }
        }));

        // Broadcast update
        game.players.forEach(p => {
            if (playerSockets[p.id]) {
                playerSockets[p.id].send(JSON.stringify({
                    type: 'game-updated',
                    data: { gameState: game }
                }));
            }
        });
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
        p.pedine = Array(4).fill(0).map(() => ({ posizione:'base', casella:null }));
      });
      
      game.turnoCorrente = colors[0];
      game.status = 'playing';
      game.gameData.turnoNumero = 1;
      
      // Broadcast start
      game.players.forEach(p => {
        playerSockets[p.id]?.send(JSON.stringify({ type: 'game-started', data: { gameState: game, color: p.color } }));
      });
      return;
    }

    // Tira dado
    if (msg.type === 'throw-dice') {
      const { gameId, playerId } = msg.data;
      const game = games[gameId];
      if (!game) return;
      
      const player = game.players.find(p=>p.id===playerId);
      if (game.turnoCorrente !== player.color) return ws.send(JSON.stringify({ type: 'error', message: 'Non è il tuo turno' }));
      
      const roll = Math.floor(Math.random()*6)+1;
      game.gameData.ultimoDado = roll;
      game.gameData.dadoTirato = true;
      
      // Broadcast dice result
      game.players.forEach(p => {
        playerSockets[p.id]?.send(JSON.stringify({ 
          type:'dice-thrown', 
          data:{ 
            gameState:game, 
            diceResult:roll, 
            playerColor:p.color 
          } 
        }));
      });
      
      return;
    }

    // Skip turn (quando non ci sono mosse possibili)
    if (msg.type === 'skip-turn') {
      const { gameId, playerId } = msg.data;
      const game = games[gameId];
      if (!game) return;
      
      const player = game.players.find(p=>p.id===playerId);
      if (game.turnoCorrente !== player.color) return;
      
      // Passa al prossimo turno
      advanceTurn(game);
      
      // Broadcast update
      game.players.forEach(p => {
        playerSockets[p.id]?.send(JSON.stringify({ 
          type:'piece-moved', 
          data:{ gameState:game } 
        }));
      });
      
      return;
    }

    // Muovi pedina
    if (msg.type === 'move-piece') {
      const { gameId, playerId, pieceId, currentPosition } = msg.data;
      const game = games[gameId];
      if (!game) return;
      
      const player = game.players.find(p=>p.id===playerId);
      if (game.turnoCorrente!==player.color || !game.gameData.dadoTirato) {
        return ws.send(JSON.stringify({ type:'error', message:'Azione non valida' }));
      }
      
      const piece = player.pedine[pieceId];
      const diceValue = game.gameData.ultimoDado;
      
      // Verifica se la mossa è valida
      if (!canMovePiece(piece, diceValue, game.gameData.turnoNumero)) {
        return ws.send(JSON.stringify({ type:'error', message:'Mossa non valida' }));
      }
      
      // Calcola nuova posizione
      const newPosition = calculateNewPosition(piece, diceValue, player.color);
      
      // Controlla se c'è una pedina da mangiare
      const eatenPiece = checkForEating(game, newPosition, player.color);
      
      // Muovi la pedina
      player.pedine[pieceId] = newPosition;
      
      // Se ha mangiato una pedina
      if (eatenPiece) {
        // Rimanda la pedina mangiata alla base
        eatenPiece.player.pedine[eatenPiece.pieceIndex] = { posizione: 'base', casella: null };
        
        // Notifica che una pedina è stata mangiata
        game.players.forEach(p => {
          playerSockets[p.id]?.send(JSON.stringify({ 
            type:'piece-eaten', 
            data:{ 
              gameState: game,
              eaterPlayerId: playerId,
              eatenPlayerId: eatenPiece.player.id,
              eatenColor: eatenPiece.player.color,
              position: newPosition.casella
            } 
          }));
        });
      }
      
      game.gameData.dadoTirato = false;
      
      // Se ha fatto 6, può tirare di nuovo, altrimenti avanza turno
      if (diceValue !== 6) {
        advanceTurn(game);
      }
      
      // Broadcast move
      game.players.forEach(p => {
        playerSockets[p.id]?.send(JSON.stringify({ 
          type:'piece-moved', 
          data:{ gameState:game } 
        }));
      });
      
      // Verifica vittoria
      if (player.pedine.every(pd => pd.posizione === 'destinazione')) {
        game.status = 'finished';
        game.players.forEach(p => {
          playerSockets[p.id]?.send(JSON.stringify({ 
            type:'game-finished', 
            data:{ gameState:game, winner:player } 
          }));
        });
        delete games[gameId];
      }
      
      return;
    }
  });
});

// Funzioni helper

function canMovePiece(piece, diceValue, turnNumber) {
  // Se è in base, può uscire solo con 6 o al primo turno
  if (piece.posizione === 'base') {
    return diceValue === 6 || turnNumber === 1;
  }
  
  // Se è nel percorso, può sempre muoversi (logica semplificata)
  if (piece.posizione === 'percorso') {
    return true;
  }
  
  return true;
}

function calculateNewPosition(piece, diceValue, playerColor) {
  if (piece.posizione === 'base') {
    // Esce dalla base e va alla casella di partenza del suo colore
    const startPositions = { blu: 1, rosso: 11, verde: 21, giallo: 31 };
    return { posizione: 'percorso', casella: startPositions[playerColor] };
  }
  
  if (piece.posizione === 'percorso') {
    let newCasella = piece.casella + diceValue;
    
    // Gestione del percorso circolare (40 caselle)
    if (newCasella > 40) {
      newCasella = newCasella - 40;
    }
    
    // Logica semplificata - in un gioco reale dovrebbe gestire l'entrata nella zona di destinazione
    // Per ora manteniamo tutto nel percorso principale
    return { posizione: 'percorso', casella: newCasella };
  }
  
  return piece;
}

function checkForEating(game, newPosition, currentPlayerColor) {
  if (newPosition.posizione !== 'percorso') return null;
  
  // Cerca se c'è una pedina di un altro giocatore nella nuova posizione
  for (let player of game.players) {
    if (player.color === currentPlayerColor) continue;
    
    for (let i = 0; i < player.pedine.length; i++) {
      const piece = player.pedine[i];
      if (piece.posizione === 'percorso' && piece.casella === newPosition.casella) {
        return {
          player: player,
          pieceIndex: i,
          piece: piece
        };
      }
    }
  }
  
  return null;
}

function advanceTurn(game) {
  const currentIndex = game.players.findIndex(p => p.color === game.turnoCorrente);
  const nextIndex = (currentIndex + 1) % game.players.length;
  game.turnoCorrente = game.players[nextIndex].color;
  
  // Se è tornato al primo giocatore, incrementa il numero del turno
  if (nextIndex === 0) {
    game.gameData.turnoNumero = (game.gameData.turnoNumero || 1) + 1;
  }
}

server.listen(PORT, () => console.log(`WS server listening on ${PORT}`));
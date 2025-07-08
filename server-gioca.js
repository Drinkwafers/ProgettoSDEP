// server-gioca.js (porta WS 3002) - Gestisce solo il gameplay
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT_GIOCA || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'mia_chiave_super_segreta';

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(cookieParser());

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// Stato delle partite attive e mapping socket
const activeGames = {};
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
  console.log('🎮 Connessione gameplay WS:', Boolean(ws.user));
  
  ws.on('message', msgStr => {
    let msg;
    try { 
      msg = JSON.parse(msgStr); 
    } catch {
      return ws.send(JSON.stringify({ type: 'error', message: 'Messaggio non valido' }));
    }

    console.log('📨 Messaggio ricevuto nel server gioca:', msg.type);

    // Auth via sessionStorage token
    if (msg.type === 'auth' && msg.data?.token) {
      try {
        ws.user = jwt.verify(msg.data.token, JWT_SECRET);
        console.log('✅ Autenticazione gameplay WS riuscita per:', ws.user.userName);
        ws.send(JSON.stringify({ type: 'info', message: 'Autenticazione gameplay riuscita' }));
      } catch {
        return ws.send(JSON.stringify({ type: 'error', message: 'Token non valido' }));
      }
      return;
    }

    // Rejoin dopo redirect da lobby
    if (msg.type === 'rejoin-game') {
      const { gameId, playerId } = msg.data;
      console.log(`🔄 Rejoin game: ${gameId}, player: ${playerId}`);
      
      const game = activeGames[gameId];
      if (!game) {
        console.log('❌ Partita non trovata:', gameId);
        return ws.send(JSON.stringify({ type: 'error', message: 'Partita non trovata' }));
      }
      
      playerSockets[playerId] = ws;
      console.log('✅ Player reconnesso al gameplay');
      return ws.send(JSON.stringify({ type: 'rejoined', data: { gameState: game } }));
    }

    // Ricevi partita dalla lobby
    if (msg.type === 'transfer-game') {
      const { gameState } = msg.data;
      console.log('📤 Ricevuta partita dalla lobby:', gameState.gameId);
      
      // Memorizza la partita nel server gameplay
      activeGames[gameState.gameId] = gameState;
      
      // Non mandare risposta, la lobby gestirà il redirect
      return;
    }

    // Tira dado
    if (msg.type === 'throw-dice') {
      const { gameId, playerId } = msg.data;
      const game = activeGames[gameId];
      if (!game) return;
      
      const player = game.players.find(p => p.id === playerId);
      if (game.turnoCorrente !== player.color) {
        return ws.send(JSON.stringify({ type: 'error', message: 'Non è il tuo turno' }));
      }
      
      if (game.gameData.dadoTirato) {
        return ws.send(JSON.stringify({ type: 'error', message: 'Dado già tirato' }));
      }
      
      let roll;
      if (player.haPedinaUscitaDallaBase) {
        roll = Math.floor(Math.random() * 4) + 3; 
        player.haPedinaUscitaDallaBase = 0;
      } else {
        roll = Math.floor(Math.random() * 6) + 1;
      }

      game.gameData.ultimoDado = roll;
      game.gameData.dadoTirato = true;
      
      console.log(`🎲 ${player.color} ha tirato: ${roll}`);
      
      // Broadcast dice result
      game.players.forEach(p => {
        if (playerSockets[p.id]) {
          playerSockets[p.id].send(JSON.stringify({ 
            type: 'dice-thrown', 
            data: { 
              gameState: game, 
              diceResult: roll, 
              playerColor: player.color 
            } 
          }));
        }
      });
      
      return;
    }

    // Skip turn (quando non ci sono mosse possibili)
    if (msg.type === 'skip-turn') {
      const { gameId, playerId } = msg.data;
      const game = activeGames[gameId];
      if (!game) return;
      
      const player = game.players.find(p => p.id === playerId);
      if (game.turnoCorrente !== player.color) return;
      
      console.log(`⏭️ ${player.color} salta il turno`);
      
      // Passa al prossimo turno
      advanceTurn(game);
      
      // Broadcast update
      game.players.forEach(p => {
        if (playerSockets[p.id]) {
          playerSockets[p.id].send(JSON.stringify({ 
            type: 'piece-moved', 
            data: { gameState: game } 
          }));
        }
      });
      
      return;
    }

    // Muovi pedina
    if (msg.type === 'move-piece') {
      const { gameId, playerId, pieceId, currentPosition } = msg.data;
      const game = activeGames[gameId];
      if (!game) return;
      
      const player = game.players.find(p => p.id === playerId);
      if (game.turnoCorrente !== player.color || !game.gameData.dadoTirato) {
        return ws.send(JSON.stringify({ type: 'error', message: 'Azione non valida' }));
      }
      
      const piece = player.pedine[pieceId];
      const diceValue = game.gameData.ultimoDado;
      
      // Verifica se la mossa è valida
      if (!canMovePiece(piece, diceValue, game.gameData.turnoNumero, player.color)) {
        return ws.send(JSON.stringify({ type: 'error', message: 'Mossa non valida' }));
      }
      
      console.log(`🚶 ${player.color} muove pedina ${pieceId}`);
      
      // Calcola nuova posizione
      const newPosition = calculateNewPosition(piece, diceValue, player.color);
      if (piece.posizione === 'base') {
        player.haPedinaUscitaDallaBase = 1;
      }
      
      // Controlla se c'è una pedina da mangiare (solo se rimane nel percorso)
      let eatenPiece = null;
      if (newPosition.posizione === 'percorso') {
        eatenPiece = checkForEating(game, newPosition, player.color);
      }
      
      // Muovi la pedina
      player.pedine[pieceId] = newPosition;
      
      // Se ha mangiato una pedina
      if (eatenPiece) {
        eatenPiece.player.pedine[eatenPiece.pieceIndex] = { posizione: 'base', casella: null };
        
        console.log(`😋 ${player.color} ha mangiato ${eatenPiece.player.color}`);
        
        // Notifica che una pedina è stata mangiata
        game.players.forEach(p => {
          if (playerSockets[p.id]) {
            playerSockets[p.id].send(JSON.stringify({ 
              type: 'piece-eaten', 
              data: { 
                gameState: game,
                eaterPlayerId: playerId,
                eatenPlayerId: eatenPiece.player.id,
                eatenColor: eatenPiece.player.color,
                position: newPosition.casella
              } 
            }));
          }
        });
      }
      
      game.gameData.dadoTirato = false;
      
      // Se ha fatto 6, può tirare di nuovo, altrimenti avanza turno
      if (diceValue !== 6) {
        advanceTurn(game);
      }
      
      // Broadcast move
      game.players.forEach(p => {
        if (playerSockets[p.id]) {
          playerSockets[p.id].send(JSON.stringify({ 
            type: 'piece-moved', 
            data: { gameState: game } 
          }));
        }
      });
      
      // Verifica vittoria
      if (player.pedine.every(pd => pd.posizione === 'destinazione')) {
        game.status = 'finished';
        console.log(`🏆 ${player.color} ha vinto!`);
        
        game.players.forEach(p => {
          if (playerSockets[p.id]) {
            playerSockets[p.id].send(JSON.stringify({ 
              type: 'game-finished', 
              data: { gameState: game, winner: player } 
            }));
          }
        });
        
        // Rimuovi la partita finita
        delete activeGames[gameId];
      }
      
      return;
    }

    // Disconnessione
    ws.on('close', () => {
      console.log('❌ Connessione gameplay chiusa');
      // Rimuovi il socket dai mapping
      for (const [playerId, socket] of Object.entries(playerSockets)) {
        if (socket === ws) {
          delete playerSockets[playerId];
          break;
        }
      }
    });
  });
});

// Funzioni helper per la logica di gioco (spostate dal server-index originale)

function canMovePiece(piece, diceValue, turnNumber, playerColor) {
  if (piece.posizione === 'base') {
    return diceValue === 6 || turnNumber === 1;
  }
  
  if (piece.posizione === 'percorso') {
    const newPosition = calculateNewPosition(piece, diceValue, playerColor);
    if (newPosition.posizione === 'destinazione') {
      return newPosition.casella <= 4;
    }
    return true;
  }
  
  if (piece.posizione === 'destinazione') {
    return piece.casella + diceValue <= 4;
  }
  
  return true;
}

function calculateNewPosition(piece, diceValue, playerColor) {
  if (piece.posizione === 'base') {
    const startPositions = { blu: 1, rosso: 11, verde: 21, giallo: 31 };
    return { posizione: 'percorso', casella: startPositions[playerColor] };
  }
  
  if (piece.posizione === 'percorso') {
    let newCasella = piece.casella + diceValue;
    
    const homeEntrances = { 
      blu: 40, rosso: 10, verde: 20, giallo: 30
    };
    
    const homeEntrance = homeEntrances[playerColor];
    
    if (newCasella > 40) {
      newCasella = newCasella - 40;
    }
    
    const originalCasella = piece.casella;
    
    let crossesHome = false;
    if (originalCasella <= homeEntrance && newCasella >= homeEntrance) {
      crossesHome = true;
    } else if (originalCasella > homeEntrance && (newCasella + 40) >= (homeEntrance + 40)) {
      crossesHome = true;
    }
    
    if (crossesHome) {
      let stepsIntoHome;
      if (originalCasella <= homeEntrance) {
        stepsIntoHome = newCasella - homeEntrance;
      } else {
        stepsIntoHome = (newCasella + 40) - (homeEntrance + 40);
      }
      
      if (stepsIntoHome >= 0) {
        const destinationSlot = stepsIntoHome + 1;
        if (destinationSlot <= 4) {
          return { posizione: 'destinazione', casella: destinationSlot };
        } else {
          return { posizione: 'percorso', casella: newCasella };
        }
      }
    }
    
    return { posizione: 'percorso', casella: newCasella };
  }
  
  if (piece.posizione === 'destinazione') {
    const newDestinationSlot = piece.casella + diceValue;
    if (newDestinationSlot <= 4) {
      return { posizione: 'destinazione', casella: newDestinationSlot };
    } else {
      return piece;
    }
  }
  
  return piece;
}

function checkForEating(game, newPosition, currentPlayerColor) {
  if (newPosition.posizione !== 'percorso') return null;
  
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
  
  if (nextIndex === 0) {
    game.gameData.turnoNumero = (game.gameData.turnoNumero || 1) + 1;
  }
}

server.listen(PORT, () => {
  console.log(`🎮 Server gameplay in ascolto su porta ${PORT}`);
});
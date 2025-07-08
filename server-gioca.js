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

      // Controlla se il giocatore può effettivamente muoversi
const canMove = canPlayerMove(player, roll, game.gameData.turnoNumero);
if (!canMove) {
  console.log(`⏭️ ${player.color} non può muoversi con dado ${roll}, turno automaticamente passato`);
  
  setTimeout(() => {
    game.gameData.dadoTirato = false;
    advanceTurn(game);
    
    game.players.forEach(p => {
      if (playerSockets[p.id]) {
        playerSockets[p.id].send(JSON.stringify({ 
          type: 'piece-moved', 
          data: { 
            gameState: game,
            autoSkipped: true,
            message: `${player.color} non può muoversi e passa automaticamente il turno`
          } 
        }));
      }
    });
  }, 2000);
}
      
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
      if (!canMovePiece(piece, diceValue, game.gameData.turnoNumero, player.color, player.pedine)) {
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

// ✅ SOSTITUISCI anche questa funzione nel server-gioca.js (circa linea 190)
// ✅ SOSTITUISCI nel server-gioca.js - Aggiorna la funzione canMovePiece

function canMovePiece(piece, diceValue, turnNumber, playerColor, allPlayerPieces) {
  console.log(`🔍 Validazione mossa: ${playerColor}, posizione: ${piece.posizione}, dado: ${diceValue}`);
  
  // CASO 1: Pedina in base
  if (piece.posizione === 'base') {
    // Regola standard: può uscire con 6
    if (diceValue === 6) {
      console.log(`🏠 Pedina in base: PUÒ uscire con 6`);
      return true;
    }
    
    // Regola primo turno: può uscire con qualsiasi numero
    if (turnNumber === 1) {
      console.log(`🏠 Pedina in base: PUÒ uscire (primo turno)`);
      return true;
    }
    
    // ✅ NUOVA REGOLA: Se tutte le pedine sono in base, può uscire con qualsiasi numero
    const allPiecesInBase = allPlayerPieces.every(p => p.posizione === 'base');
    if (allPiecesInBase) {
      console.log(`🏠 Pedina in base: PUÒ uscire (tutte le pedine in base)`);
      return true;
    }
    
    console.log(`🏠 Pedina in base: NON PUÒ uscire (serve 6)`);
    return false;
  }
  
  // CASO 2: Pedina nel percorso
  if (piece.posizione === 'percorso') {
    const newPosition = calculateNewPosition(piece, diceValue, playerColor);
    if (newPosition.posizione === 'destinazione') {
      const isValid = newPosition.casella <= 4;
      console.log(`🎯 Destinazione: casella ${newPosition.casella} - ${isValid ? 'VALIDA' : 'NON VALIDA'}`);
      return isValid;
    }
    console.log(`🔄 Percorso: movimento valido`);
    return true;
  }
  
  // CASO 3: Pedina nella destinazione
  if (piece.posizione === 'destinazione') {
    const newSlot = piece.casella + diceValue;
    const isValid = newSlot <= 4;
    console.log(`🏁 Destinazione: ${piece.casella} + ${diceValue} = ${newSlot} - ${isValid ? 'VALIDA' : 'NON VALIDA'}`);
    return isValid;
  }
  
  return false;
}

function canPlayerMove(player, diceValue, turnNumber) {
  return player.pedine.some(piece => 
    canMovePiece(piece, diceValue, turnNumber, player.color, player.pedine)
  );
}

// ✅ SOSTITUISCI questa funzione nel server-gioca.js (circa linea 220)

function calculateNewPosition(piece, diceValue, playerColor) {
  console.log(`🎯 Calcolo mossa: ${playerColor}, posizione: ${piece.posizione}, casella: ${piece.casella}, dado: ${diceValue}`);
  
  // CASO 1: Pedina esce dalla base
  if (piece.posizione === 'base') {
    const startPositions = { blu: 1, rosso: 11, verde: 21, giallo: 31 };
    const newPosition = { posizione: 'percorso', casella: startPositions[playerColor] };
    console.log(`🚀 Pedina ${playerColor} esce dalla base → casella ${newPosition.casella}`);
    return newPosition;
  }
  
  // CASO 2: Pedina nel percorso principale
  if (piece.posizione === 'percorso') {
    const currentCasella = piece.casella;
    let newCasella = currentCasella + diceValue;
    
    // Gestione percorso circolare (1-40)
    if (newCasella > 40) {
      newCasella = newCasella - 40;
    }
    
    console.log(`📍 ${playerColor}: ${currentCasella} + ${diceValue} = ${newCasella} (prima del controllo destinazione)`);
    
    // Caselle di ingresso destinazione per ogni colore
    const destinationEntries = { blu: 40, rosso: 10, verde: 20, giallo: 30 };
    const entryPoint = destinationEntries[playerColor];
    
    // ✅ LOGICA CORRETTA: Verifica se deve entrare in destinazione
    let shouldEnter = false;
    let stepsToEntry = 0;
    
    // CASO A: Movimento normale (senza attraversare 40→1)
    if (currentCasella <= newCasella) {
      if (currentCasella < entryPoint && newCasella >= entryPoint) {
        shouldEnter = true;
        stepsToEntry = entryPoint - currentCasella;
        console.log(`✅ Movimento normale: attraversa casella ${entryPoint}, passi per arrivarci: ${stepsToEntry}`);
      }
    }
    // CASO B: Movimento con wrap-around (attraversa 40→1)
    else {
      // La pedina ha attraversato il punto 40→1
      // Esempio: da 38 con dado 5 → 38,39,40,1,2,3
      
      if (currentCasella < entryPoint) {
        // Caso: pedina prima del punto di ingresso, attraversa durante il wrap
        shouldEnter = true;
        stepsToEntry = entryPoint - currentCasella;
        console.log(`✅ Wrap-around caso A: attraversa casella ${entryPoint}, passi: ${stepsToEntry}`);
      } else if (newCasella >= entryPoint) {
        // Caso: pedina dopo il wrap raggiunge il punto di ingresso
        shouldEnter = true;
        stepsToEntry = (40 - currentCasella) + entryPoint;
        console.log(`✅ Wrap-around caso B: raggiunge casella ${entryPoint} dopo wrap, passi: ${stepsToEntry}`);
      }
    }
    
    if (shouldEnter) {
      const stepsInDestination = diceValue - stepsToEntry;
      console.log(`🏠 ${playerColor}: entra in destinazione, passi dentro: ${stepsInDestination}`);
      
      if (stepsInDestination <= 0) {
        // Arriva esattamente al punto di ingresso
        console.log(`🎯 ${playerColor}: entra in destinazione casella 1`);
        return { posizione: 'destinazione', casella: 1 };
      } else if (stepsInDestination <= 4) {
        // Entra e avanza nella destinazione
        const finalSlot = stepsInDestination + 1;
        console.log(`🎯 ${playerColor}: entra in destinazione casella ${finalSlot}`);
        return { posizione: 'destinazione', casella: finalSlot };
      } else {
        // Supererebbe la destinazione (più di 4 caselle), rimane nel percorso
        console.log(`❌ ${playerColor}: supererebbe la destinazione, rimane nel percorso casella ${newCasella}`);
        return { posizione: 'percorso', casella: newCasella };
      }
    }
    
    // Non entra in destinazione, rimane nel percorso
    console.log(`🔄 ${playerColor}: rimane nel percorso → casella ${newCasella}`);
    return { posizione: 'percorso', casella: newCasella };
  }
  
  // CASO 3: Pedina già nella zona destinazione
  if (piece.posizione === 'destinazione') {
    const newSlot = piece.casella + diceValue;
    if (newSlot <= 4) {
      console.log(`🏁 ${playerColor}: destinazione ${piece.casella} → ${newSlot}`);
      return { posizione: 'destinazione', casella: newSlot };
    } else {
      console.log(`❌ ${playerColor}: non può muoversi, supererebbe casella 4`);
      return piece; // Non può muoversi
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
// server-index.js (porta WS 3001) - Gestisce solo lobby/matchmaking
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT_WS || 3001;
const GAMEPLAY_PORT = process.env.PORT_GIOCA || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'mia_chiave_super_segreta';

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(cookieParser());

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// Stato lobby e mapping socket
const lobbyGames = {};
const lobbyPlayerSockets = {};

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
  console.log('🏠 Connessione lobby WS:', Boolean(ws.user));
  
  ws.on('message', msgStr => {
    let msg;
    try { 
      msg = JSON.parse(msgStr); 
    } catch {
      return ws.send(JSON.stringify({ type: 'error', message: 'Messaggio non valido' }));
    }

    console.log('📨 Messaggio ricevuto nella lobby:', msg.type);

    // Auth via sessionStorage token
    if (msg.type === 'auth' && msg.data?.token) {
      try {
        ws.user = jwt.verify(msg.data.token, JWT_SECRET);
        console.log('✅ Autenticazione lobby WS riuscita per:', ws.user.userName);
        ws.send(JSON.stringify({ type: 'info', message: 'Autenticazione lobby riuscita' }));
      } catch {
        return ws.send(JSON.stringify({ type: 'error', message: 'Token non valido' }));
      }
      return;
    }

    // Crea nuova partita
    if (msg.type === 'create-game') {
      const name = msg.data.playerName;
      const gameId = Math.random().toString(36).substr(2, 8);
      const playerId = Math.random().toString(36).substr(2, 9);

      console.log(`🎲 Creazione partita: ${gameId} per ${name}`);

      // Rileva se l'utente è autenticato
      const isAuth = ws.user && ws.user.userId;
      const playerEntry = {
        id: playerId,
        name: isAuth ? ws.user.userName : name,
        color: null,
        pedine: [],
        isAuthenticated: Boolean(isAuth),
        userId: isAuth ? ws.user.userId : null,
        haPedinaUscitaDallaBase: 0
      };

      const gameState = {
        gameId: gameId, // ✅ Aggiungi gameId al gameState
        players: [playerEntry],
        host: playerId,
        gameData: {
          turnoNumero: 1,
          dadoTirato: false,
          ultimoDado: 0
        },
        status: 'waiting'
      };

      lobbyGames[gameId] = gameState;
      lobbyPlayerSockets[playerId] = ws;
      
      ws.send(JSON.stringify({
        type: 'game-created',
        data: { gameId, playerId, gameState }
      }));
      
      console.log('✅ Partita creata e aggiunta alla lobby');
      return;
    }

    // Join partita
    if (msg.type === 'join-game') {
      const { gameId, playerName } = msg.data;
      const game = lobbyGames[gameId];

      console.log(`👥 Tentativo join: ${playerName} -> ${gameId}`);

      if (!game || game.players.length >= 4) {
        console.log('❌ Join fallito: partita non trovata o piena');
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
        userId: isAuth ? ws.user.userId : null,
        haPedinaUscitaDallaBase: 0
      };

      game.players.push(playerEntry);
      lobbyPlayerSockets[playerId] = ws;

      console.log(`✅ ${playerName} si è unito. Giocatori: ${game.players.length}/4`);

      // Notifica join
      ws.send(JSON.stringify({
        type: 'game-joined',
        data: { gameId, playerId, gameState: game }
      }));

      // Broadcast update a tutti i giocatori nella lobby
      game.players.forEach(p => {
        if (lobbyPlayerSockets[p.id]) {
          lobbyPlayerSockets[p.id].send(JSON.stringify({
            type: 'game-updated',
            data: { gameState: game }
          }));
        }
      });
      
      return;
    }

    // Leave partita
    if (msg.type === 'leave-game') {
      const { gameId, playerId } = msg.data;
      const game = lobbyGames[gameId];
      
      if (!game) return;
      
      console.log(`👋 ${playerId} lascia la partita ${gameId}`);
      
      // Rimuovi il giocatore
      game.players = game.players.filter(p => p.id !== playerId);
      delete lobbyPlayerSockets[playerId];
      
      // Se era l'host e ci sono altri giocatori, cambia host
      if (game.host === playerId && game.players.length > 0) {
        game.host = game.players[0].id;
        console.log(`👑 Nuovo host: ${game.players[0].name}`);
      }
      
      // Se non ci sono più giocatori, elimina la partita
      if (game.players.length === 0) {
        delete lobbyGames[gameId];
        console.log(`🗑️ Partita ${gameId} eliminata (vuota)`);
        return;
      }
      
      // Broadcast update ai giocatori rimasti
      game.players.forEach(p => {
        if (lobbyPlayerSockets[p.id]) {
          lobbyPlayerSockets[p.id].send(JSON.stringify({
            type: 'game-updated',
            data: { gameState: game, message: `${playerId} ha lasciato la partita` }
          }));
        }
      });
      
      return;
    }

    // Start partita
    if (msg.type === 'start-game') {
      const { gameId } = msg.data;
      const game = lobbyGames[gameId];
      
      if (!game || game.players.length !== 4) {
        return ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Servono esattamente 4 giocatori per iniziare' 
        }));
      }
      
      console.log(`🚀 Avvio partita: ${gameId}`);
      
      // Assegna colori e pedine
      const colors = ['blu', 'rosso', 'verde', 'giallo'];
      game.players.forEach((p, i) => {
        p.color = colors[i];
        p.pedine = Array(4).fill(0).map(() => ({ posizione: 'base', casella: null }));
      });
      
      game.turnoCorrente = colors[0];
      game.status = 'playing';
      game.gameData.turnoNumero = 1;
      
      // ✅ TRASFERIMENTO AL SERVER GAMEPLAY
      console.log(`📤 Trasferimento partita ${gameId} al server gameplay`);
      
      // Crea connessione al server gameplay per trasferire la partita
      const gameplayWs = new WebSocket(`ws://localhost:${GAMEPLAY_PORT}`);
      
      gameplayWs.on('open', () => {
        // Invia la partita al server gameplay
        gameplayWs.send(JSON.stringify({
          type: 'transfer-game',
          data: { gameState: game }
        }));
        
        console.log('✅ Partita trasferita al server gameplay');
        
        // Chiudi la connessione di trasferimento
        gameplayWs.close();
        
        // Notifica ai client di fare redirect
        game.players.forEach(p => {
          if (lobbyPlayerSockets[p.id]) {
            lobbyPlayerSockets[p.id].send(JSON.stringify({ 
              type: 'game-started', 
              data: { 
                gameState: game, 
                color: p.color,
                redirectUrl: `gioca.html?gameId=${gameId}&playerId=${p.id}`
              } 
            }));
          }
        });
        
        // Rimuovi la partita dalla lobby (ora è gestita dal server gameplay)
        delete lobbyGames[gameId];
        
        // Pulisci i socket dei giocatori dalla lobby
        game.players.forEach(p => {
          delete lobbyPlayerSockets[p.id];
        });
        
        console.log(`🧹 Partita ${gameId} rimossa dalla lobby`);
      });
      
      gameplayWs.on('error', (error) => {
        console.error('❌ Errore connessione al server gameplay:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Impossibile avviare la partita. Server gameplay non disponibile.' 
        }));
      });
      
      return;
    }
  });

  // Gestione disconnessione
  ws.on('close', () => {
    console.log('❌ Connessione lobby chiusa');
    
    // Trova e rimuovi il giocatore dai socket
    for (const [playerId, socket] of Object.entries(lobbyPlayerSockets)) {
      if (socket === ws) {
        console.log(`👋 Player ${playerId} disconnesso dalla lobby`);
        
        // Trova la partita del giocatore e gestisci la disconnessione
        for (const [gameId, game] of Object.entries(lobbyGames)) {
          const playerIndex = game.players.findIndex(p => p.id === playerId);
          if (playerIndex !== -1) {
            // Rimuovi il giocatore
            game.players.splice(playerIndex, 1);
            
            // Se era l'host e ci sono altri giocatori, cambia host
            if (game.host === playerId && game.players.length > 0) {
              game.host = game.players[0].id;
            }
            
            // Se non ci sono più giocatori, elimina la partita
            if (game.players.length === 0) {
              delete lobbyGames[gameId];
            } else {
              // Notifica gli altri giocatori
              game.players.forEach(p => {
                if (lobbyPlayerSockets[p.id]) {
                  lobbyPlayerSockets[p.id].send(JSON.stringify({
                    type: 'game-updated',
                    data: { gameState: game, message: `Un giocatore si è disconnesso` }
                  }));
                }
              });
            }
            break;
          }
        }
        
        delete lobbyPlayerSockets[playerId];
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`🏠 Server lobby in ascolto su porta ${PORT}`);
});
// client-gioca.js modificato - Si connette al server gameplay (porta 3002)
document.addEventListener('DOMContentLoaded', () => {
  let ws, gameId, playerId, playerColor, gameState, isMyTurn=false, dadoTirato=false, dado=0;
  
  // Ottieni parametri dall'URL
  const url = new URLSearchParams(window.location.search);
  gameId = url.get('gameId'); 
  playerId = url.get('playerId');
  
  if (!gameId || !playerId) {
    alert('Parametri di gioco mancanti!');
    window.location.href = '/';
    return;
  }

  console.log(`🎮 Inizializzazione gameplay - Game: ${gameId}, Player: ${playerId}`);

  // ✅ CAMBIATO: Connessione al server gameplay (porta 3002)
  ws = new WebSocket('ws://localhost:3002');

  ws.onopen = () => {
    console.log('🎮 Connesso al server gameplay');
    
    // Autentica se necessario (sessionStorage)
    const token = authManager.getAuthToken();
    if (token) {
      console.log('🔐 Invio token di autenticazione al server gameplay');
      ws.send(JSON.stringify({ type: 'auth', data: { token } }));
    }
    
    // ✅ IMPORTANTE: Rejoin della partita trasferita dalla lobby
    console.log('🔄 Tentativo rejoin partita...');
    ws.send(JSON.stringify({ 
      type: 'rejoin-game', 
      data: { gameId, playerId } 
    }));
  };

  ws.onmessage = e => {
    const message = JSON.parse(e.data);
    console.log('📨 Messaggio gameplay ricevuto:', message.type);
    handleMsg(message);
  };

  ws.onclose = () => {
    console.log('❌ Connessione gameplay persa');
    alert('Connessione persa con il server di gioco!');
  };

  ws.onerror = e => {
    console.error('❌ Errore WebSocket gameplay:', e);
  };

  function handleMsg(msg) {
    switch(msg.type) {
      case 'rejoined': 
        console.log('✅ Rejoin successful');
        onStart(msg.data.gameState); 
        break;
      case 'game-started': 
        console.log('🚀 Game started message');
        onStart(msg.data.gameState, msg.data.color); 
        break;
      case 'dice-thrown': 
        console.log('🎲 Dice thrown');
        onDice(msg.data); 
        break;
      case 'piece-moved': 
        console.log('🚶 Piece moved');
        onMove(msg.data.gameState); 
        break;
      case 'piece-eaten': 
        console.log('😋 Piece eaten');
        onPieceEaten(msg.data); 
        break;
      case 'game-finished': 
        console.log('🏆 Game finished');
        onFinish(msg.data); 
        break;
      case 'error': 
        console.log('❌ Error:', msg.message);
        return alert(msg.message);
      case 'info':
        console.log('ℹ️ Info:', msg.message);
        break;
    }
  }

  function onStart(gs, color) {
    console.log('🎯 Inizializzazione partita...');
    gameState = gs;
    
    if (color) {
      playerColor = color;
    } else {
      // Trova il colore del giocatore dal gameState
      const player = gameState.players.find(p => p.id === playerId);
      playerColor = player ? player.color : null;
    }
    
    if (!playerColor) {
      console.error('❌ Colore giocatore non trovato!');
      alert('Errore: impossibile determinare il colore del giocatore');
      return;
    }
    
    console.log(`🎨 Player color: ${playerColor}`);
    inizialize();
  }
  
  function inizialize(){
    dadoTirato = gameState.gameData.dadoTirato;
    dado = gameState.gameData.ultimoDado;
    isMyTurn = (gameState.turnoCorrente === playerColor);
    
    console.log(`🎯 Stato iniziale - Turno: ${gameState.turnoCorrente}, Mio turno: ${isMyTurn}, Dado: ${dado}`);
    
    renderPieces();
    renderInfo();
    bindCells();
  }
  
  function renderPieces(){ 
    console.log('🎨 Rendering pedine...');
    document.querySelectorAll('td img').forEach(i => i.remove());
    
    gameState.players.forEach(pl => {
      pl.pedine.forEach((p, idx) => {
        const img = document.createElement('img'); 
        img.src = `immagini/pedina-${pl.color}.png`;
        img.dataset.pieceId = idx;
        img.dataset.playerColor = pl.color;
        
        let cell;
        if (p.posizione === 'base') {
          cell = document.querySelector(`.base-${pl.color}:not(:has(img))`);
        } else if (p.posizione === 'destinazione') {
          cell = document.querySelector(`.casella-destinazione-${pl.color}-${p.casella}`);
        } else {
          cell = document.querySelector(`.casella-${p.casella}`);
        }
        
        if (cell) {
          cell.appendChild(img);
        } else {
          console.warn(`⚠️ Cella non trovata per pedina ${pl.color} ${idx} in posizione ${p.posizione}-${p.casella}`);
        }
      });
    }); 
  }

  function bindCells(){ 
    document.querySelectorAll('td:not([id*="bianco"])').forEach(cell => {
      cell.onclick = () => {
        if (!isMyTurn) {
          alert('Non è il tuo turno');
          return;
        }
        if (!dadoTirato) {
          alert('Tira il dado prima');
          return;
        }
        
        const img = cell.querySelector('img'); 
        if (!img) return;
        
        const pieceColor = img.dataset.playerColor;
        const pieceId = parseInt(img.dataset.pieceId);
        
        if (pieceColor !== playerColor) {
          alert('Non tua pedina');
          return;
        }
        
        const currentPlayer = gameState.players.find(p => p.color === playerColor);
        const piece = currentPlayer.pedine[pieceId];
        
        // Controlla se la pedina può muoversi
        if (!canMovePiece(piece, dado, currentPlayer.pedine)) {
          alert('Questa pedina non può muoversi');
          return;
        }
        
        console.log(`🎯 Tentativo mossa pedina ${pieceId} del colore ${playerColor}`);
        
        ws.send(JSON.stringify({ 
          type: 'move-piece', 
          data: { gameId, playerId, pieceId, currentPosition: piece } 
        }));
      };
    }); 
  }

  // ✅ SOSTITUISCI anche questa funzione nel client-gioca.js (circa linea 150)

 function canMovePiece(piece, diceValue, allPlayerPieces) {
  console.log(`🔍 CLIENT - Validazione mossa: ${playerColor}, posizione: ${piece.posizione}, dado: ${diceValue}`);
  
  // CASO 1: Pedina in base
  if (piece.posizione === 'base') {
    // Regola standard: può uscire con 6
    if (diceValue === 6) {
      console.log(`🏠 CLIENT - Pedina in base: PUÒ uscire con 6`);
      return true;
    }
    
    // Regola primo turno: può uscire con qualsiasi numero
    const isFirstTurn = gameState.gameData.turnoNumero === 1;
    if (isFirstTurn) {
      console.log(`🏠 CLIENT - Pedina in base: PUÒ uscire (primo turno)`);
      return true;
    }
    
    // ✅ NUOVA REGOLA: Se tutte le pedine sono in base, può uscire con qualsiasi numero
    const allPiecesInBase = allPlayerPieces.every(p => p.posizione === 'base');
    if (allPiecesInBase) {
      console.log(`🏠 CLIENT - Pedina in base: PUÒ uscire (tutte le pedine in base)`);
      return true;
    }
    
    console.log(`🏠 CLIENT - Pedina in base: NON PUÒ uscire (serve 6)`);
    return false;
  }
  
  // CASO 2: Pedina nel percorso
  if (piece.posizione === 'percorso') {
    const newPosition = calculateNewPositionClient(piece, diceValue, playerColor);
    if (newPosition.posizione === 'destinazione') {
      const isValid = newPosition.casella <= 4;
      console.log(`🎯 CLIENT - Destinazione: casella ${newPosition.casella} - ${isValid ? 'VALIDA' : 'NON VALIDA'}`);
      return isValid;
    }
    console.log(`🔄 CLIENT - Percorso: movimento valido`);
    return true;
  }
  
  // CASO 3: Pedina già in destinazione
  if (piece.posizione === 'destinazione') {
    const newSlot = piece.casella + diceValue;
    const isValid = newSlot <= 4;
    console.log(`🏁 CLIENT - Destinazione: ${piece.casella} + ${diceValue} = ${newSlot} - ${isValid ? 'VALIDA' : 'NON VALIDA'}`);
    return isValid;
  }
  
  return false;
}

  // ✅ SOSTITUISCI questa funzione nel client-gioca.js (circa linea 180)

function calculateNewPositionClient(piece, diceValue, playerColor) {
  console.log(`🎯 CLIENT - Calcolo mossa: ${playerColor}, posizione: ${piece.posizione}, casella: ${piece.casella}, dado: ${diceValue}`);
  
  // CASO 1: Pedina esce dalla base
  if (piece.posizione === 'base') {
    const startPositions = { blu: 1, rosso: 11, verde: 21, giallo: 31 };
    const newPosition = { posizione: 'percorso', casella: startPositions[playerColor] };
    console.log(`🚀 CLIENT - Pedina ${playerColor} esce dalla base → casella ${newPosition.casella}`);
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
    
    console.log(`📍 CLIENT - ${playerColor}: ${currentCasella} + ${diceValue} = ${newCasella}`);
    
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
        console.log(`✅ CLIENT - Movimento normale: attraversa casella ${entryPoint}`);
      }
    }
    // CASO B: Movimento con wrap-around (attraversa 40→1)
    else {
      if (currentCasella < entryPoint) {
        shouldEnter = true;
        stepsToEntry = entryPoint - currentCasella;
        console.log(`✅ CLIENT - Wrap-around caso A: attraversa casella ${entryPoint}`);
      } else if (newCasella >= entryPoint) {
        shouldEnter = true;
        stepsToEntry = (40 - currentCasella) + entryPoint;
        console.log(`✅ CLIENT - Wrap-around caso B: raggiunge casella ${entryPoint} dopo wrap`);
      }
    }
    
    if (shouldEnter) {
      const stepsInDestination = diceValue - stepsToEntry;
      console.log(`🏠 CLIENT - ${playerColor}: entra in destinazione, passi dentro: ${stepsInDestination}`);
      
      if (stepsInDestination <= 0) {
        console.log(`🎯 CLIENT - ${playerColor}: entra in destinazione casella 1`);
        return { posizione: 'destinazione', casella: 1 };
      } else if (stepsInDestination <= 4) {
        const finalSlot = stepsInDestination + 1;
        console.log(`🎯 CLIENT - ${playerColor}: entra in destinazione casella ${finalSlot}`);
        return { posizione: 'destinazione', casella: finalSlot };
      } else {
        console.log(`❌ CLIENT - ${playerColor}: supererebbe la destinazione, rimane nel percorso`);
        return { posizione: 'percorso', casella: newCasella };
      }
    }
    
    // Non entra in destinazione, rimane nel percorso
    console.log(`🔄 CLIENT - ${playerColor}: rimane nel percorso → casella ${newCasella}`);
    return { posizione: 'percorso', casella: newCasella };
  }
  
  // CASO 3: Pedina già nella zona destinazione
  if (piece.posizione === 'destinazione') {
    const newSlot = piece.casella + diceValue;
    if (newSlot <= 4) {
      console.log(`🏁 CLIENT - ${playerColor}: destinazione ${piece.casella} → ${newSlot}`);
      return { posizione: 'destinazione', casella: newSlot };
    } else {
      console.log(`❌ CLIENT - ${playerColor}: non può muoversi, supererebbe casella 4`);
      return piece; // Non può muoversi
    }
  }
  
  return piece;
}

  function onDice(d){ 
    gameState = d.gameState; 
    dado = d.diceResult; 
    dadoTirato = true; 
    isMyTurn = (d.playerColor === playerColor); 
    
    const message = `${d.playerColor.toUpperCase()} ha tirato ${dado}`;
    const canMove = checkIfCanMove();
    
    if (!canMove && isMyTurn) {
      alert(message + ' - Nessuna mossa possibile, turno passato');
      // Auto-passa il turno se non ci sono mosse possibili
      setTimeout(() => {
        ws.send(JSON.stringify({ 
          type: 'skip-turn', 
          data: { gameId, playerId } 
        }));
      }, 1000);
    } else {
      alert(message);
    }
    
    renderInfo();
  }
  
  function checkIfCanMove() {
    const currentPlayer = gameState.players.find(p => p.color === playerColor);
    return currentPlayer.pedine.some(piece => canMovePiece(piece, dado, currentPlayer.pedine));
  }
  
  function onMove(gs){ 
    gameState = gs; 
    dadoTirato = false; 
    isMyTurn = (gameState.turnoCorrente === playerColor); 
    renderPieces(); 
    renderInfo(); 
  }
  
  function onPieceEaten(data) {
    gameState = data.gameState;
    const eatenPlayer = gameState.players.find(p => p.id === data.eatenPlayerId);
    const eaterPlayer = gameState.players.find(p => p.id === data.eaterPlayerId);
    
    if (data.eatenPlayerId === playerId) {
      alert(`La tua pedina ${data.eatenColor} è stata mangiata da ${eaterPlayer.name}!`);
    } else if (data.eaterPlayerId === playerId) {
      alert(`Hai mangiato la pedina ${data.eatenColor} di ${eatenPlayer.name}!`);
    } else {
      alert(`${eaterPlayer.name} ha mangiato una pedina di ${eatenPlayer.name}`);
    }
    
    renderPieces();
    renderInfo();
  }
  
  function onFinish(d){ 
    const isWinner = d.winner.id === playerId;
    alert(isWinner ? 'Hai vinto!' : `Vince ${d.winner.name}`);
    
    // ✅ Aggiorna statistiche se autenticato
    if (authManager.isAuthenticated()) {
      updateGameStats(isWinner);
    }
    
    // Redirect alla lobby dopo qualche secondo
    setTimeout(() => {
      window.location.href = '/index.html';
    }, 3000);
  }

  async function updateGameStats(won) {
    try {
      const response = await authManager.authenticatedFetch('/api/update-game-stats', {
        method: 'POST',
        body: JSON.stringify({ won })
      });

      if (response.ok) {
        console.log('✅ Statistiche aggiornate');
      }
    } catch (error) {
      console.error('❌ Errore aggiornamento statistiche:', error);
    }
  }

  function renderInfo(){ 
    let info = document.getElementById('game-info'); 
    if (!info){ 
      info = document.createElement('div'); 
      info.id = 'game-info'; 
      info.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: white;
        padding: 15px;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        font-weight: bold;
        text-align: center;
        min-width: 200px;
        z-index: 1000;
      `;
      document.body.appendChild(info);
    } 
    
    const currentPlayer = gameState.players.find(p => p.color === playerColor);
    const piecesInBase = currentPlayer.pedine.filter(p => p.posizione === 'base').length;
    const piecesInPlay = currentPlayer.pedine.filter(p => p.posizione === 'percorso').length;
    const piecesFinished = currentPlayer.pedine.filter(p => p.posizione === 'destinazione').length;
    
    info.innerHTML = `
      <div style="color: ${playerColor}; font-size: 18px; margin-bottom: 10px;">
        ${playerColor.toUpperCase()} (Tu)
      </div>
      <div>Turno: <span style="color: ${gameState.turnoCorrente};">${gameState.turnoCorrente.toUpperCase()}</span></div>
      <div>Ultimo dado: ${dado}</div>
      <div>Turno n°: ${gameState.gameData.turnoNumero || 1}</div>
      <div style="margin-top: 10px; font-size: 14px;">
        <div>In base: ${piecesInBase}</div>
        <div>In gioco: ${piecesInPlay}</div>
        <div>Arrivate: ${piecesFinished}</div>
      </div>
      ${isMyTurn ? '<div style="color: green; margin-top: 10px;">È IL TUO TURNO!</div>' : ''}
    `; 
  }

  window.tiraDado=()=>{ 
    if(!isMyTurn) return alert('Non è il tuo turno'); 
    if(dadoTirato) return alert('Dado già tirato'); 
    ws.send(JSON.stringify({type:'throw-dice',data:{gameId,playerId}})); 
  };
});
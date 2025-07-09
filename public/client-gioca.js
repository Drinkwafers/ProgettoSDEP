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

  console.log(` Inizializzazione gameplay - Game: ${gameId}, Player: ${playerId}`);

  // Connessione al server gameplay (porta 3002)
  ws = new WebSocket('ws:///localhost:3002');

  ws.onopen = () => {
    console.log(' Connesso al server gameplay');
    
    // Autentica se necessario (sessionStorage)
    const token = authManager.getAuthToken();
    if (token) {
      console.log(' Invio token di autenticazione al server gameplay');
      ws.send(JSON.stringify({ type: 'auth', data: { token } }));
    }
    
    //Rejoin della partita trasferita dalla lobby
    console.log(' Tentativo rejoin partita...');
    ws.send(JSON.stringify({ 
      type: 'rejoin-game', 
      data: { gameId, playerId } 
    }));
  };

  ws.onmessage = e => {
    const message = JSON.parse(e.data);
    console.log(' Messaggio gameplay ricevuto:', message.type);
    handleMsg(message);
  };

  ws.onclose = () => {
    console.log('Connessione gameplay persa');
    alert('Connessione persa con il server di gioco!');
  };

  ws.onerror = e => {
    console.error('Errore WebSocket gameplay:', e);
  };

  function handleMsg(msg) {
    switch(msg.type) {
      case 'rejoined': 
        console.log(' Rejoin successful');
        onStart(msg.data.gameState); 
        break;
      case 'game-started': 
        console.log(' Partita iniziata');
        onStart(msg.data.gameState, msg.data.color); 
        break;
      case 'dice-thrown': 
        console.log(' Dado tirato');
        onDice(msg.data); 
        break;
      case 'piece-moved': 
        console.log('Pedina mossa');
        onMove(msg.data.gameState); 
        break;
      case 'piece-eaten': 
        console.log('Pedina mangiata');
        onPieceEaten(msg.data); 
        break;
      case 'game-finished': 
        console.log('Gioco terminato');
        onFinish(msg.data); 
        break;
      case 'error': 
        console.log(' Error:', msg.message);
        return alert(msg.message);
      case 'info':
        console.log(' Info:', msg.message);
        break;
    }
  }

  function onStart(gs, color) {
    console.log(' Inizializzazione partita...');
    gameState = gs;
    
    if (color) {
      playerColor = color;
    } else {
      // Trova il colore del giocatore dal gameState
      const player = gameState.players.find(p => p.id === playerId);
      playerColor = player ? player.color : null;
    }
    
    if (!playerColor) {
      console.error(' Colore giocatore non trovato!');
      alert('Errore: impossibile determinare il colore del giocatore');
      return;
    }
    
    console.log(` Player color: ${playerColor}`);
    inizialize();
  }
  
  function inizialize(){
    dadoTirato = gameState.gameData.dadoTirato;
    dado = gameState.gameData.ultimoDado;
    isMyTurn = (gameState.turnoCorrente === playerColor);
    
    console.log(` Stato iniziale - Turno: ${gameState.turnoCorrente}, Mio turno: ${isMyTurn}, Dado: ${dado}`);
    
    renderPieces();
    renderInfo();
    bindCells();
  }
  
  function renderPieces(){ 
    console.log(' Rendering pedine...');
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
          console.warn(` Cella non trovata per pedina ${pl.color} ${idx} in posizione ${p.posizione}-${p.casella}`);
        }
      });
    }); 
  
    //  AGGIUNGI QUESTO alla fine di renderPieces:
    setTimeout(() => {
      updatePieceIndicators();
    }, 100);
  }

  // 4. MODIFICA la funzione bindCells - sostituisci la parte con canMovePiece:
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
      
        //  MODIFICA QUESTA PARTE:
        if (!canMovePiece(piece, dado, currentPlayer.pedine, pieceId)) {
          // Messaggio più specifico
          const newPos = calculateNewPositionClient(piece, dado, playerColor);
          if (isPositionOccupiedBySameColor(newPos, playerColor, currentPlayer.pedine, pieceId)) {
            alert('Questa pedina non può muoversi - casella di destinazione occupata da un\'altra tua pedina');
          } else {
            alert('Questa pedina non può muoversi - mossa non valida');
          }
          return;
        }
      
        console.log(` Tentativo mossa pedina ${pieceId} del colore ${playerColor}`);
      
        ws.send(JSON.stringify({ 
          type: 'move-piece', 
          data: { gameId, playerId, pieceId, currentPosition: piece } 
        }));
      };
    }); 
  }

  //  SOSTITUISCI anche questa funzione nel client-gioca.js (circa linea 150)

 function canMovePiece(piece, diceValue, allPlayerPieces, pieceId = -1) {
  console.log(` CLIENT - Validazione mossa: ${playerColor}, posizione: ${piece.posizione}, dado: ${diceValue}, pieceId: ${pieceId}`);
  
  // CASO 1: Pedina in base
  if (piece.posizione === 'base') {
    // Regola standard: può uscire con 6
    if (diceValue === 6) {
      //  CONTROLLO COLLISIONE: Verifica se la casella di partenza è libera
      const startPositions = { blu: 1, rosso: 11, verde: 21, giallo: 31 };
      const startPosition = { posizione: 'percorso', casella: startPositions[playerColor] };
      
      if (isPositionOccupiedBySameColor(startPosition, playerColor, allPlayerPieces, pieceId)) {
        console.log(` CLIENT - Pedina in base: NON PUÒ uscire con 6 (casella di partenza occupata)`);
        return false;
      }
      
      console.log(` CLIENT - Pedina in base: PUÒ uscire con 6`);
      return true;
    }
    
    // Regola primo turno: può uscire con qualsiasi numero
    const isFirstTurn = gameState.gameData.turnoNumero === 1;
    if (isFirstTurn) {
      const startPositions = { blu: 1, rosso: 11, verde: 21, giallo: 31 };
      const startPosition = { posizione: 'percorso', casella: startPositions[playerColor] };
      
      if (isPositionOccupiedBySameColor(startPosition, playerColor, allPlayerPieces, pieceId)) {
        console.log(` CLIENT - Pedina in base: NON PUÒ uscire (primo turno, casella occupata)`);
        return false;
      }
      
      console.log(` CLIENT - Pedina in base: PUÒ uscire (primo turno)`);
      return true;
    }
    
    // Regola tutte le pedine in base: può uscire con qualsiasi numero
    const allPiecesInBase = allPlayerPieces.every(p => p.posizione === 'base');
    if (allPiecesInBase) {
      const startPositions = { blu: 1, rosso: 11, verde: 21, giallo: 31 };
      const startPosition = { posizione: 'percorso', casella: startPositions[playerColor] };
      
      if (isPositionOccupiedBySameColor(startPosition, playerColor, allPlayerPieces, pieceId)) {
        console.log(` CLIENT - Pedina in base: NON PUÒ uscire (tutte in base, casella occupata)`);
        return false;
      }
      
      console.log(` CLIENT - Pedina in base: PUÒ uscire (tutte le pedine in base)`);
      return true;
    }
    
    console.log(` CLIENT - Pedina in base: NON PUÒ uscire (serve 6)`);
    return false;
  }
  
  // CASO 2: Pedina nel percorso
  if (piece.posizione === 'percorso') {
    const newPosition = calculateNewPositionClient(piece, diceValue, playerColor);
    
    // Se va in destinazione, controlla che non superi la casella 4
    if (newPosition.posizione === 'destinazione') {
      if (newPosition.casella > 4) {
        console.log(` CLIENT - Destinazione: casella ${newPosition.casella} - NON VALIDA (supera 4)`);
        return false;
      }
      
      //  CONTROLLO COLLISIONE per destinazione
      if (isPositionOccupiedBySameColor(newPosition, playerColor, allPlayerPieces, pieceId)) {
        console.log(` CLIENT - Destinazione: casella ${newPosition.casella} - NON VALIDA (occupata)`);
        return false;
      }
      
      console.log(` CLIENT - Destinazione: casella ${newPosition.casella} - VALIDA`);
      return true;
    }
    
    // Se rimane nel percorso, controlla collisioni
    //  CONTROLLO COLLISIONE per percorso
    if (isPositionOccupiedBySameColor(newPosition, playerColor, allPlayerPieces, pieceId)) {
      console.log(` CLIENT - Percorso: casella ${newPosition.casella} - NON VALIDA (occupata)`);
      return false;
    }
    
    console.log(` CLIENT - Percorso: movimento valido`);
    return true;
  }
  
  // CASO 3: Pedina già in destinazione
  if (piece.posizione === 'destinazione') {
    const newSlot = piece.casella + diceValue;
    if (newSlot > 4) {
      console.log(` CLIENT - Destinazione: ${piece.casella} + ${diceValue} = ${newSlot} - NON VALIDA (supera 4)`);
      return false;
    }
    
    //  CONTROLLO COLLISIONE in destinazione
    const newPosition = { posizione: 'destinazione', casella: newSlot };
    if (isPositionOccupiedBySameColor(newPosition, playerColor, allPlayerPieces, pieceId)) {
      console.log(` CLIENT - Destinazione: casella ${newSlot} - NON VALIDA (occupata)`);
      return false;
    }
    
    console.log(` CLIENT - Destinazione: ${piece.casella} + ${diceValue} = ${newSlot} - VALIDA`);
    return true;
  }
  
  return false;
}

  //  SOSTITUISCI questa funzione nel client-gioca.js (circa linea 180)

function calculateNewPositionClient(piece, diceValue, playerColor) {
  console.log(` CLIENT - Calcolo mossa: ${playerColor}, posizione: ${piece.posizione}, casella: ${piece.casella}, dado: ${diceValue}`);
  
  // CASO 1: Pedina esce dalla base
  if (piece.posizione === 'base') {
    const startPositions = { blu: 1, rosso: 11, verde: 21, giallo: 31 };
    const newPosition = { posizione: 'percorso', casella: startPositions[playerColor] };
    console.log(` CLIENT - Pedina ${playerColor} esce dalla base → casella ${newPosition.casella}`);
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
    
    console.log(` CLIENT - ${playerColor}: ${currentCasella} + ${diceValue} = ${newCasella}`);
    
    // Caselle di ingresso destinazione per ogni colore
    const destinationEntries = { blu: 40, rosso: 10, verde: 20, giallo: 30 };
    const entryPoint = destinationEntries[playerColor];
    
    //  LOGICA CORRETTA: Verifica se deve entrare in destinazione
    let shouldEnter = false;
    let stepsToEntry = 0;
    
    // CASO A: Movimento normale (senza attraversare 40→1)
    if (currentCasella <= newCasella) {
      if (currentCasella < entryPoint && newCasella >= entryPoint) {
        shouldEnter = true;
        stepsToEntry = entryPoint - currentCasella;
        console.log(` CLIENT - Movimento normale: attraversa casella ${entryPoint}`);
      }
    }
    // CASO B: Movimento con wrap-around (attraversa 40→1)
    else {
      if (currentCasella < entryPoint) {
        shouldEnter = true;
        stepsToEntry = entryPoint - currentCasella;
        console.log(` CLIENT - Wrap-around caso A: attraversa casella ${entryPoint}`);
      } else if (newCasella >= entryPoint) {
        shouldEnter = true;
        stepsToEntry = (40 - currentCasella) + entryPoint;
        console.log(` CLIENT - Wrap-around caso B: raggiunge casella ${entryPoint} dopo wrap`);
      }
    }
    
    if (shouldEnter) {
      const stepsInDestination = diceValue - stepsToEntry;
      console.log(` CLIENT - ${playerColor}: entra in destinazione, passi dentro: ${stepsInDestination}`);
      
      if (stepsInDestination <= 0) {
        console.log(` CLIENT - ${playerColor}: entra in destinazione casella 1`);
        return { posizione: 'destinazione', casella: 1 };
      } else if (stepsInDestination <= 4) {
        const finalSlot = stepsInDestination + 1;
        console.log(` CLIENT - ${playerColor}: entra in destinazione casella ${finalSlot}`);
        return { posizione: 'destinazione', casella: finalSlot };
      } else {
        console.log(` CLIENT - ${playerColor}: supererebbe la destinazione, rimane nel percorso`);
        return { posizione: 'percorso', casella: newCasella };
      }
    }
    
    // Non entra in destinazione, rimane nel percorso
    console.log(` CLIENT - ${playerColor}: rimane nel percorso → casella ${newCasella}`);
    return { posizione: 'percorso', casella: newCasella };
  }
  
  // CASO 3: Pedina già nella zona destinazione
  if (piece.posizione === 'destinazione') {
    const newSlot = piece.casella + diceValue;
    if (newSlot <= 4) {
      console.log(` CLIENT - ${playerColor}: destinazione ${piece.casella} → ${newSlot}`);
      return { posizione: 'destinazione', casella: newSlot };
    } else {
      console.log(` CLIENT - ${playerColor}: non può muoversi, supererebbe casella 4`);
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
  
  let message = `${d.playerColor.toUpperCase()} ha tirato ${dado}`;
  const canMove = checkIfCanMove();
  
  // Aggiungi informazioni extra se tutte le pedine sono in base
  if (isMyTurn) {
    const currentPlayer = gameState.players.find(p => p.color === playerColor);
    const allInBase = currentPlayer.pedine.every(p => p.posizione === 'base');
    
    if (allInBase && dado !== 6) {
      message += ' - Tutte le pedine in base: puoi uscire con qualsiasi numero!';
    }
  }

  if (!canMove && isMyTurn) {
    // Analisi dettagliata per messaggi più informativi
    const currentPlayer = gameState.players.find(p => p.color === playerColor);
    let blockedByCollision = 0;
    let blockedByRules = 0;
    
    for (let i = 0; i < currentPlayer.pedine.length; i++) {
      const piece = currentPlayer.pedine[i];
      
      // Controlla solo le regole base (senza collisioni)
      let canMoveByRules = false;
      if (piece.posizione === 'base') {
        canMoveByRules = dado === 6 || gameState.gameData.turnoNumero === 1 || 
                        currentPlayer.pedine.every(p => p.posizione === 'base');
      } else {
        canMoveByRules = true;
      }
      
      if (canMoveByRules) {
        if (!canMovePiece(piece, dado, currentPlayer.pedine, i)) {
          blockedByCollision++;
        }
      } else {
        blockedByRules++;
      }
    }
    
    let detailMessage = ' - Nessuna mossa possibile';
    if (blockedByCollision > 0) {
      detailMessage += ` (${blockedByCollision} pedine bloccate da altre pedine)`;
    }
    detailMessage += ', turno passato';
    
    alert(message + detailMessage);
    
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
  
  //  AGGIUNGI QUESTO alla fine di onDice:
  updatePieceIndicators();
  if (isMyTurn) {
    showPieceStats(); // Per debug - puoi rimuovere in produzione
  }
}

  
  //  AGGIORNA la funzione checkIfCanMove
  function checkIfCanMove() {
    const currentPlayer = gameState.players.find(p => p.color === playerColor);
    for (let i = 0; i < currentPlayer.pedine.length; i++) {
      if (canMovePiece(currentPlayer.pedine[i], dado, currentPlayer.pedine, i)) {
       return true;
      }
    }
    return false;
  }
  
  // 3. MODIFICA la funzione onMove (ALLA FINE, AGGIUNGI):
function onMove(gs){ 
  gameState = gs; 
  dadoTirato = false; 
  isMyTurn = (gameState.turnoCorrente === playerColor); 
  renderPieces(); 
  renderInfo(); 
  
  //  AGGIUNGI QUESTO alla fine di onMove:
  updatePieceIndicators();
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
    
    //  Aggiorna statistiche se autenticato
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
        console.log(' Statistiche aggiornate');
      }
    } catch (error) {
      console.error(' Errore aggiornamento statistiche:', error);
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
  //  AGGIUNGI queste funzioni helper sia nel server-gioca.js che nel client-gioca.js

/**
 * Controlla se una posizione è occupata da un'altra pedina dello stesso colore
 * @param {Object} targetPosition - La posizione da controllare {posizione: 'percorso'|'destinazione', casella: number}
 * @param {string} playerColor - Il colore del giocatore
 * @param {Array} allPlayerPieces - Tutte le pedine del giocatore
 * @param {number} currentPieceId - ID della pedina che si sta muovendo (per escluderla dal controllo)
 * @returns {boolean} true se la posizione è occupata da un'altra pedina dello stesso colore
 */
function isPositionOccupiedBySameColor(targetPosition, playerColor, allPlayerPieces, currentPieceId = -1) {
  // Non controllare le pedine in base (possono essere multiple)
  if (targetPosition.posizione === 'base') {
    return false;
  }
  
  // Controlla se un'altra pedina dello stesso colore occupa la posizione
  for (let i = 0; i < allPlayerPieces.length; i++) {
    // Salta la pedina che si sta muovendo
    if (i === currentPieceId) continue;
    
    const otherPiece = allPlayerPieces[i];
    
    // Controlla se l'altra pedina è nella stessa posizione
    if (otherPiece.posizione === targetPosition.posizione && 
        otherPiece.casella === targetPosition.casella) {
      console.log(` Collisione rilevata: posizione ${targetPosition.posizione}-${targetPosition.casella} occupata da pedina ${i}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Controlla se una mossa causerebbe una collisione con pedine dello stesso colore
 * @param {Object} piece - La pedina da muovere
 * @param {number} diceValue - Valore del dado
 * @param {string} playerColor - Colore del giocatore
 * @param {Array} allPlayerPieces - Tutte le pedine del giocatore
 * @param {number} pieceId - ID della pedina che si sta muovendo
 * @returns {boolean} true se la mossa causerebbe una collisione
 */
function wouldCauseCollision(piece, diceValue, playerColor, allPlayerPieces, pieceId) {
  // Calcola la nuova posizione
  let newPosition;
  
  // Usa la funzione appropriata (server o client)
  if (typeof calculateNewPosition === 'function') {
    // Server
    newPosition = calculateNewPosition(piece, diceValue, playerColor);
  } else if (typeof calculateNewPositionClient === 'function') {
    // Client
    newPosition = calculateNewPositionClient(piece, diceValue, playerColor);
  } else {
    console.error(' Funzione calculateNewPosition non trovata');
    return true; // Blocca la mossa per sicurezza
  }
  
  // Se la pedina non si muove (es: supererebbe destinazione), non c'è collisione
  if (newPosition.posizione === piece.posizione && newPosition.casella === piece.casella) {
    return false;
  }
  
  // Controlla se la nuova posizione è occupata
  return isPositionOccupiedBySameColor(newPosition, playerColor, allPlayerPieces, pieceId);
}

/**
 * Trova tutte le mosse valide per un giocatore (utile per debug)
 * @param {Array} allPlayerPieces - Tutte le pedine del giocatore
 * @param {number} diceValue - Valore del dado
 * @param {string} playerColor - Colore del giocatore
 * @param {number} turnNumber - Numero del turno
 * @returns {Array} Array di ID delle pedine che possono muoversi
 */
function getValidMoves(allPlayerPieces, diceValue, playerColor, turnNumber) {
  const validMoves = [];
  
  for (let i = 0; i < allPlayerPieces.length; i++) {
    const piece = allPlayerPieces[i];
    
    // Controlla se la pedina può muoversi base sulla logica di gioco
    let canMove = false;
    
    if (typeof canMovePiece === 'function') {
      canMove = canMovePiece(piece, diceValue, turnNumber, playerColor, allPlayerPieces);
    }
    
    // Se può muoversi secondo le regole base, controlla le collisioni
    if (canMove) {
      const hasCollision = wouldCauseCollision(piece, diceValue, playerColor, allPlayerPieces, i);
      if (!hasCollision) {
        validMoves.push(i);
      }
    }
  }
  
  console.log(` Mosse valide per ${playerColor} con dado ${diceValue}:`, validMoves);
    return validMoves;
  }

  window.tiraDado=()=>{ 
    if(!isMyTurn) return alert('Non è il tuo turno'); 
    if(dadoTirato) return alert('Dado già tirato'); 
    ws.send(JSON.stringify({type:'throw-dice',data:{gameId,playerId}})); 
  };
});
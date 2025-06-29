// client-gioca.js (in gioca.html)
document.addEventListener('DOMContentLoaded', () => {
  let ws, gameId, playerId, playerColor, gameState, isMyTurn=false, dadoTirato=false, dado=0;
  const url = new URLSearchParams(window.location.search);
  gameId = url.get('gameId'); playerId = url.get('playerId');
  if (!gameId||!playerId) return window.location.href='/';
  ws = new WebSocket((location.protocol==='https:'?'wss':'ws')+'://'+location.hostname+':3001');

  ws.onopen = () => {
    const token = authManager.getAuthToken();
    if (token) ws.send(JSON.stringify({ type:'auth', data:{ token } }));
    ws.send(JSON.stringify({ type:'rejoin-game', data:{ gameId, playerId } }));
  };
  ws.onmessage = e => handleMsg(JSON.parse(e.data));
  ws.onclose = ()=>alert('Connessione persa');
  ws.onerror= e=>console.error(e);

  function handleMsg(msg) {
    switch(msg.type) {
      case 'rejoined': onStart(msg.data.gameState); break;
      case 'game-started': onStart(msg.data.gameState, msg.data.color); break;
      case 'dice-thrown': onDice(msg.data); break;
      case 'piece-moved': onMove(msg.data.gameState); break;
      case 'piece-eaten': onPieceEaten(msg.data); break;
      case 'game-finished': onFinish(msg.data); break;
      case 'error': return alert(msg.message);
    }
  }

  function onStart(gs,color) {
    gameState=gs;
    if(color) playerColor=color;
    else playerColor=gameState.players.find(p=>p.id===playerId).color;
    inizialize();
  }
  
  function inizialize(){
    dadoTirato=gameState.gameData.dadoTirato;
    dado=gameState.gameData.ultimoDado;
    isMyTurn=(gameState.turnoCorrente===playerColor);
    renderPieces();
    renderInfo();
    bindCells();
  }
  
  function renderPieces(){ 
    document.querySelectorAll('td img').forEach(i=>i.remove());
    gameState.players.forEach(pl=>pl.pedine.forEach((p,idx)=>{
      const img=document.createElement('img'); 
      img.src=`immagini/pedina-${pl.color}.png`;
      img.dataset.pieceId = idx;
      img.dataset.playerColor = pl.color;
      
      let cell;
      if(p.posizione==='base') cell=document.querySelector(`.base-${pl.color}:not(:has(img))`);
      else if(p.posizione==='destinazione') cell=document.querySelector(`.casella-destinazione-${pl.color}-${p.casella}`);
      else cell=document.querySelector(`.casella-${p.casella}`);
      cell?.appendChild(img);
    })); 
  }

  function bindCells(){ 
    document.querySelectorAll('td:not([id*="bianco"])').forEach(cell=>{
      cell.onclick=()=>{
        if(!isMyTurn) return alert('Non è il tuo turno');
        if(!dadoTirato) return alert('Tira il dado prima');
        
        const img=cell.querySelector('img'); 
        if(!img) return;
        
        const pieceColor = img.dataset.playerColor;
        const pieceId = parseInt(img.dataset.pieceId);
        
        if(pieceColor !== playerColor) return alert('Non tua pedina');
        
        const currentPlayer = gameState.players.find(p => p.color === playerColor);
        const piece = currentPlayer.pedine[pieceId];
        
        // Controlla se la pedina può muoversi
        if(!canMovePiece(piece, dado)) {
          return alert('Questa pedina non può muoversi');
        }
        
        ws.send(JSON.stringify({ 
          type:'move-piece', 
          data:{ gameId, playerId, pieceId, currentPosition: piece } 
        }));
      };
    }); 
  }

  function canMovePiece(piece, diceValue) {
    // Se è in base, può uscire solo con 6 (o primo turno)
    if(piece.posizione === 'base') {
      const isFirstTurn = gameState.gameData.turnoNumero === 1;
      return diceValue === 6 || isFirstTurn;
    }
    
    // Se è nel percorso, controlla se può muoversi
    if(piece.posizione === 'percorso') {
      // Simula il calcolo della nuova posizione per verificare se è valida
      const newPosition = calculateNewPositionClient(piece, diceValue, playerColor);
      if (newPosition.posizione === 'destinazione') {
        return newPosition.casella <= 4;
      }
      return true;
    }
    
    // Se è già in destinazione, può muoversi solo se non supera la casella 4
    if(piece.posizione === 'destinazione') {
      return piece.casella + diceValue <= 4;
    }
    
    return true;
  }

  function calculateNewPositionClient(piece, diceValue, playerColor) {
    if (piece.posizione === 'base') {
      const startPositions = { blu: 1, rosso: 11, verde: 21, giallo: 31 };
      return { posizione: 'percorso', casella: startPositions[playerColor] };
    }
    
    if (piece.posizione === 'percorso') {
      let newCasella = piece.casella + diceValue;
      
      // Definisci le caselle di ingresso alla zona destinazione per ogni colore
      const homeEntrances = { 
        blu: 40,
        rosso: 10,
        verde: 20,
        giallo: 30
      };
      
      const homeEntrance = homeEntrances[playerColor];
      
      // Gestione del percorso circolare (40 caselle)
      if (newCasella > 40) {
        newCasella = newCasella - 40;
      }
      
      // Controlla se la pedina dovrebbe entrare nella zona di destinazione
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

  function onDice(d){ 
    gameState=d.gameState; 
    dado=d.diceResult; 
    dadoTirato=true; 
    isMyTurn=(d.playerColor===playerColor); 
    
    const message = `Hai tirato ${dado}`;
    const canMove = checkIfCanMove();
    
    if(!canMove && isMyTurn) {
      alert(message + ' - Nessuna mossa possibile, turno passato');
      // Auto-passa il turno se non ci sono mosse possibili
      setTimeout(() => {
        ws.send(JSON.stringify({ 
          type:'skip-turn', 
          data:{ gameId, playerId } 
        }));
      }, 1000);
    } else {
      alert(message);
    }
  }
  
  function checkIfCanMove() {
    const currentPlayer = gameState.players.find(p => p.color === playerColor);
    return currentPlayer.pedine.some(piece => canMovePiece(piece, dado));
  }
  
  function onMove(gs){ 
    gameState=gs; 
    dadoTirato=false; 
    isMyTurn=(gameState.turnoCorrente===playerColor); 
    renderPieces(); 
    renderInfo(); 
  }
  
  function onPieceEaten(data) {
    gameState = data.gameState;
    const eatenPlayer = gameState.players.find(p => p.id === data.eatenPlayerId);
    const eaterPlayer = gameState.players.find(p => p.id === data.eaterPlayerId);
    
    if(data.eatenPlayerId === playerId) {
      alert(`La tua pedina ${data.eatenColor} è stata mangiata da ${eaterPlayer.name}!`);
    } else if(data.eaterPlayerId === playerId) {
      alert(`Hai mangiato la pedina ${data.eatenColor} di ${eatenPlayer.name}!`);
    } else {
      alert(`${eaterPlayer.name} ha mangiato una pedina di ${eatenPlayer.name}`);
    }
    
    renderPieces();
    renderInfo();
  }
  
  function onFinish(d){ 
    alert(d.winner.id===playerId?'Hai vinto!':`Vince ${d.winner.name}`); 
  }

  function renderInfo(){ 
    let info=document.getElementById('game-info'); 
    if(!info){ 
      info=document.createElement('div'); 
      info.id='game-info'; 
      document.body.appendChild(info);
    } 
    
    const currentPlayer = gameState.players.find(p => p.color === playerColor);
    const piecesInBase = currentPlayer.pedine.filter(p => p.posizione === 'base').length;
    const piecesInPlay = currentPlayer.pedine.filter(p => p.posizione === 'percorso').length;
    const piecesFinished = currentPlayer.pedine.filter(p => p.posizione === 'destinazione').length;
    
    info.innerHTML=`
      Giocatore: ${playerColor.toUpperCase()}<br>
      Turno: ${gameState.turnoCorrente.toUpperCase()}<br>
      Ultimo dado: ${dado}<br>
      Turno n°: ${gameState.gameData.turnoNumero || 1}<br>
      Pedine in base: ${piecesInBase}<br>
      Pedine in gioco: ${piecesInPlay}<br>
      Pedine arrivate: ${piecesFinished}
    `; 
  }

  window.tiraDado=()=>{ 
    if(!isMyTurn) return alert('Non è il tuo turno'); 
    if(dadoTirato) return alert('Dado già tirato'); 
    ws.send(JSON.stringify({type:'throw-dice',data:{gameId,playerId}})); 
  };
});
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
  function renderPieces(){ document.querySelectorAll('td img').forEach(i=>i.remove());
    gameState.players.forEach(pl=>pl.pedine.forEach(p=>{
      const img=document.createElement('img'); img.src=`immagini/pedina-${pl.color}.png`;
      let cell;
      if(p.posizione==='base') cell=document.querySelector(`.base-${pl.color}:not(:has(img))`);
      else if(p.posizione==='destinazione') cell=document.querySelector(`.casella-destinazione-${pl.color}-${p.casella}`);
      else cell=document.querySelector(`.casella-${p.casella}`);
      cell?.appendChild(img);
    })); }

  function bindCells(){ document.querySelectorAll('td:not([id*="bianco"])').forEach(cell=>{
      cell.onclick=()=>{
        if(!isMyTurn) return alert('Non è il tuo turno');
        if(!dadoTirato) return alert('Tira il dado prima');
        const img=cell.querySelector('img'); if(!img) return;
        const col=img.src.includes('pedina-blu')?'blu':img.src.includes('rosso')?'rosso':img.src.includes('verde')?'verde':'giallo';
        if(col!==playerColor) return alert('Non tua pedina');
        const cls=cell.className;
        const curr={ posizione: cls.includes('casella-')?'percorso':'base', casella:cls.includes('casella-')?parseInt(cls.split('-')[1]):null, pieceId:1 };
        let np= curr.casella? ((curr.casella+dado-1)%40+1):1;
        ws.send(JSON.stringify({ type:'move-piece', data:{ gameId, playerId, pieceId:curr.pieceId, newPosition:`percorso-${np}` } }));
      };
    }); }

  function onDice(d){ gameState=d.gameState; dado=d.diceResult; dadoTirato=true; isMyTurn=(d.playerColor===playerColor); alert(`Hai tirato ${dado}`); }
  function onMove(gs){ gameState=gs; dadoTirato=false; isMyTurn=(gameState.turnoCorrente===playerColor); renderPieces(); renderInfo(); }
  function onFinish(d){ alert(d.winner.id===playerId?'Hai vinto!':`Vince ${d.winner.name}`); }

  function renderInfo(){ let info=document.getElementById('game-info'); if(!info){ info=document.createElement('div'); info.id='game-info'; document.body.appendChild(info);} info.innerHTML=`Giocatore:${playerColor.toUpperCase()}<br>Turno:${gameState.turnoCorrente.toUpperCase()}<br>Ultimo dado:${dado}`; }

  window.tiraDado=()=>{ if(!isMyTurn) return alert('Non è il tuo turno'); if(dadoTirato) return alert('Dado già tirato'); ws.send(JSON.stringify({type:'throw-dice',data:{gameId,playerId}})); };
});

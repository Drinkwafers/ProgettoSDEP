// client-gioca.js - Versione integrata con WebSocket
document.addEventListener('DOMContentLoaded', function() {
    // Variabili WebSocket e di gioco
    let ws = null;
    let gameId = null;
    let playerId = null;
    let playerColor = null;
    let gameState = null;
    let isMyTurn = false;

    // Mappa delle caselle del percorso principale in ordine (40 caselle totali)
    const percorsoGlobale = [
        '.casella-1', '.casella-2', '.casella-3', '.casella-4', '.casella-5',
        '.casella-6', '.casella-7', '.casella-8', '.casella-9', '.casella-10',
        '.casella-11', '.casella-12', '.casella-13', '.casella-14', '.casella-15',
        '.casella-16', '.casella-17', '.casella-18', '.casella-19', '.casella-20',
        '.casella-21', '.casella-22', '.casella-23', '.casella-24', '.casella-25',
        '.casella-26', '.casella-27', '.casella-28', '.casella-29', '.casella-30',
        '.casella-31', '.casella-32', '.casella-33', '.casella-34', '.casella-35',
        '.casella-36', '.casella-37', '.casella-38', '.casella-39', '.casella-40'
    ];

    // Caselle di ingresso alle case al tabellone
    const casellePartenza = {
        'blu': '.casella-1',
        'rosso': '.casella-11',
        'verde': '.casella-21',
        'giallo': '.casella-31'
    };

    // Caselle di ingresso alle case finali
    const caselleDestinazione = {
        'blu': 40,
        'rosso': 10,
        'verde': 20,
        'giallo': 30
    };

    // Variabili di stato locale (sincronizzate con il server)
    let turnoCorrente = 'blu';
    let dado = 0;
    let dadoTirato = false;

    // Inizializza la connessione WebSocket
    function connectWebSocket() {
        // Ottieni i parametri dall'URL
        const urlParams = new URLSearchParams(window.location.search);
        gameId = urlParams.get('gameId');
        playerId = urlParams.get('playerId');

        if (!gameId || !playerId) {
            alert('Parametri di gioco mancanti!');
            window.location.href = '/';
            return;
        }

        // Connetti al WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:3001`;
        
        ws = new WebSocket(wsUrl);

        ws.onopen = function() {
            console.log('Connesso al server WebSocket');
        };

        ws.onmessage = function(event) {
            const message = JSON.parse(event.data);
            handleServerMessage(message);
        };

        ws.onclose = function() {
            console.log('Connessione WebSocket chiusa');
            alert('Connessione persa con il server!');
        };

        ws.onerror = function(error) {
            console.error('Errore WebSocket:', error);
        };
    }

    // Gestisce i messaggi dal server
    function handleServerMessage(message) {
        console.log('Messaggio ricevuto:', message);

        switch (message.type) {
            case 'game-started':
                gameState = message.data.gameState;
                playerColor = gameState.players.find(p => p.id === playerId)?.color;
                // AGGIUNGI QUESTO:
                turnoCorrente = message.data.turnoCorrente || gameState.players[0].color;
                initializeLocalGame();
                break;

            case 'dice-thrown':
                handleDiceThrown(message.data);
                break;

            case 'piece-moved':
                handlePieceMoved(message.data);
                break;

            case 'game-updated':
                gameState = message.data.gameState;
                updateGameDisplay();
                if (message.data.message) {
                    showMessage(message.data.message);
                }
                break;

            case 'error':
                alert('Errore: ' + message.message);
                break;
        }
    }

    // Inizializza il gioco locale dopo aver ricevuto lo stato dal server
    function initializeLocalGame() {
        if (!gameState || !playerColor) return;

        // Sincronizza lo stato locale con quello del server
        turnoCorrente = gameState.gameData.turnoCorrente;
        dadoTirato = gameState.gameData.dadoTirato;
        dado = gameState.gameData.ultimoDado;
        isMyTurn = (playerColor === turnoCorrente);

        // Posiziona le pedine secondo lo stato del server
        updatePiecePositions();
        
        // Aggiorna l'interfaccia
        aggiornaIndicatoreTurno();
        updateGameDisplay();
        
        listener();
        document.addEventListener('keydown', gestisciTastiera);

        showMessage(`Gioco iniziato! Sei il giocatore ${playerColor.toUpperCase()}`);
    }

    // Aggiorna le posizioni delle pedine basandosi sullo stato del server
    function updatePiecePositions() {
        if (!gameState) return;

        // Pulisci tutte le pedine dal tabellone
        document.querySelectorAll('img').forEach(img => {
            if (img.src.includes('pedina-')) {
                img.remove();
            }
        });

        // Riposiziona le pedine secondo lo stato del server
        gameState.players.forEach(player => {
            player.pedine.forEach(pedina => {
                const img = document.createElement('img');
                img.src = `immagini/pedina-${player.color}.png`;
                
                let targetCell;
                if (pedina.posizione === 'base') {
                    // Pedina nella base
                    targetCell = document.querySelector(`.base-${player.color}:not(:has(img))`);
                } else if (pedina.posizione === 'destinazione') {
                    // Pedina nella zona destinazione
                    targetCell = document.querySelector(`.casella-destinazione-${player.color}-${pedina.casella}`);
                } else if (pedina.posizione === 'percorso') {
                    // Pedina sul percorso principale
                    targetCell = document.querySelector(`.casella-${pedina.casella}`);
                }

                if (targetCell) {
                    targetCell.appendChild(img);
                }
            });
        });
    }

    // Gestisce il risultato del dado dal server
    function handleDiceThrown(data) {
        turnoCorrente = data.playerColor;
        dado = data.diceResult;
        dadoTirato = true;
        isMyTurn = (playerColor === turnoCorrente);

        mostraRisultatoDado(dado, data.playerColor);
        aggiornaIndicatoreTurno();
    }

    // Gestisce il movimento di una pedina dal server
    function handlePieceMoved(data) {
        gameState = data.gameState;
        updatePiecePositions();
        
        turnoCorrente = gameState.gameData.turnoCorrente;
        dadoTirato = gameState.gameData.dadoTirato;
        dado = gameState.gameData.ultimoDado;
        isMyTurn = (playerColor === turnoCorrente);
        
        aggiornaIndicatoreTurno();
    }

    function listener() {
        // Aggiungi event listeners alle caselle del percorso
        document.querySelectorAll('td:not([id*="bianco"])').forEach(cell => {
            cell.addEventListener('click', function() {
                gestisciClick(this);
            });
        });
    }

    function gestisciClick(casella) {
        if (!isMyTurn) {
            alert(`Non è il tuo turno! È il turno del giocatore ${turnoCorrente.toUpperCase()}`);
            return;
        }

        console.log('Casella cliccata:', casella.className);

        const pedina = casella.querySelector('img');
        
        if (!pedina) {
            console.log('Nessuna pedina in questa casella');
            return;
        }

        // Ottieni il colore della pedina dalla sua immagine
        const colorePedina = ottieniColorePedina(pedina);
        console.log('Colore pedina:', colorePedina, 'Player color:', playerColor);

        // Controlla se è una pedina del giocatore
        if (colorePedina !== playerColor) {
            alert('Non puoi muovere le pedine degli altri giocatori!');
            return;
        }

        // Logica per il movimento delle pedine (semplificata per WebSocket)
        if (casella.className === 'base-' + playerColor + ' turno-attivo') {
            handleBaseClick(casella, pedina);
        } else if (casella.className.startsWith('casella-')) {
            handleBoardClick(casella, pedina);
        }
    }

    function handleBaseClick(casella, pedina) {
        if (!dadoTirato) {
            alert('Prima tira il dado!');
            return;
        }

        // Trova l'ID della pedina (semplificata)
        const pedinaNellaBase = Array.from(casella.parentElement.querySelectorAll('.base-' + playerColor)).indexOf(casella) + 1;
        
        // Invia la mossa al server
        ws.send(JSON.stringify({
            type: 'move-piece',
            data: {
                gameId: gameId,
                playerId: playerId,
                pieceId: pedinaNellaBase,
                newPosition: 'percorso-1' // Entra nel percorso
            }
        }));
    }

    function handleBoardClick(casella, pedina) {
        if (!dadoTirato) {
            alert('Prima tira il dado!');
            return;
        }

        // Trova l'ID della pedina e calcola la nuova posizione
        const currentPosition = getCurrentPiecePosition(casella);
        const newPosition = calculateNewPosition(currentPosition, dado);
        
        // Invia la mossa al server
        ws.send(JSON.stringify({
            type: 'move-piece',
            data: {
                gameId: gameId,
                playerId: playerId,
                pieceId: 1, // Semplificato - dovrebbe essere l'ID reale della pedina
                newPosition: newPosition
            }
        }));
    }

    function getCurrentPiecePosition(casella) {
        if (casella.className.startsWith('casella-destinazione')) {
            const parts = casella.className.split('-');
            return {
                type: 'destinazione',
                color: parts[2],
                position: parseInt(parts[3])
            };
        } else if (casella.className.startsWith('casella-')) {
            const parts = casella.className.split('-');
            return {
                type: 'percorso',
                position: parseInt(parts[1])
            };
        }
        return null;
    }

    function calculateNewPosition(currentPos, steps) {
        // Logica semplificata - dovresti implementare la logica completa del movimento
        if (currentPos.type === 'percorso') {
            let newPos = currentPos.position + steps;
            if (newPos > 40) newPos = newPos - 40;
            return 'percorso-' + newPos;
        }
        return 'percorso-1';
    }

    function ottieniColorePedina(pedina) {
        const src = pedina.getAttribute('src');
        if (src.includes('pedina-blu')) return 'blu';
        if (src.includes('pedina-rosso')) return 'rosso';
        if (src.includes('pedina-verde')) return 'verde';
        if (src.includes('pedina-giallo')) return 'giallo';
        return null;
    }

    function aggiornaIndicatoreTurno() {
        // Rimuovi l'effetto pulse da tutte le basi
        document.querySelectorAll('.base-blu, .base-rosso, .base-verde, .base-giallo').forEach(base => {
            base.classList.remove('turno-attivo');
        });
        
        // Aggiungi l'effetto pulse alle basi del turno corrente solo se è il nostro turno
        if (isMyTurn) {
            document.querySelectorAll(`.base-${playerColor}`).forEach(base => {
                base.classList.add('turno-attivo');
            });
        }
    }

    function tiraDado() {
        if (!isMyTurn) {
            alert(`Non è il tuo turno! È il turno del giocatore ${turnoCorrente.toUpperCase()}`);
            return;
        }

        if (dadoTirato) {
            alert('Hai già tirato il dado!');
            return;
        }

        // Invia la richiesta di tirare il dado al server
        ws.send(JSON.stringify({
            type: 'throw-dice',
            data: {
                gameId: gameId,
                playerId: playerId
            }
        }));
    }

    function mostraRisultatoDado(risultato, coloreGiocatore) {
        // Rimuovi messaggi precedenti
        const vecchioMessaggio = document.querySelector('.messaggio-dado');
        if (vecchioMessaggio) {
            vecchioMessaggio.remove();
        }
        
        const messaggio = document.createElement('div');
        messaggio.className = 'messaggio-dado';
        messaggio.innerHTML = `Turno ${coloreGiocatore.toUpperCase()}: Ha tirato ${risultato}`;
        messaggio.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 10px 20px;
            border: 2px solid ${coloreGiocatore};
            border-radius: 5px;
            z-index: 1000;
            font-size: 18px;
            font-weight: bold;
            color: ${coloreGiocatore === 'giallo' ? 'black' : coloreGiocatore};
        `;
        document.body.appendChild(messaggio);
        
        setTimeout(() => {
            if (messaggio.parentNode) {
                messaggio.remove();
            }
        }, 3000);
    }

    function showMessage(text) {
        const messaggio = document.createElement('div');
        messaggio.className = 'messaggio-gioco';
        messaggio.innerHTML = text;
        messaggio.style.cssText = `
            position: fixed;
            top: 60px;
            left: 50%;
            transform: translateX(-50%);
            background: #f0f0f0;
            padding: 10px 20px;
            border: 1px solid #ccc;
            border-radius: 5px;
            z-index: 999;
            font-size: 16px;
        `;
        document.body.appendChild(messaggio);
        
        setTimeout(() => {
            if (messaggio.parentNode) {
                messaggio.remove();
            }
        }, 3000);
    }

    function updateGameDisplay() {
        if (!gameState) return;
        
        // Aggiorna informazioni del gioco
        const infoDiv = document.getElementById('game-info') || createGameInfoDiv();
        infoDiv.innerHTML = `
            <div>Giocatore: ${playerColor ? playerColor.toUpperCase() : 'N/A'}</div>
            <div>Turno: ${turnoCorrente.toUpperCase()}</div>
            <div>Ultimo dado: ${dado || 'N/A'}</div>
            <div>Giocatori: ${gameState.players.map(p => p.name + ' (' + p.color + ')').join(', ')}</div>
        `;
    }

    function createGameInfoDiv() {
        const infoDiv = document.createElement('div');
        infoDiv.id = 'game-info';
        infoDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: white;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 5px;
            font-size: 14px;
            z-index: 1000;
        `;
        document.body.appendChild(infoDiv);
        return infoDiv;
    }

    // Funzione per gestire i tasti premuti
    function gestisciTastiera(evento) {
        switch(evento.code) {
            case 'Enter':
                evento.preventDefault();
                tiraDado();
                break;
        }
    }

    // Inizializza la connessione WebSocket
    connectWebSocket();

    // Rendi le funzioni accessibili globalmente
    window.tiraDado = tiraDado;
});
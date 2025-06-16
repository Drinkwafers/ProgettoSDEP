// Attendi che il DOM sia completamente caricato
document.addEventListener('DOMContentLoaded', function() {
    
    // Mappa delle caselle del percorso principale in ordine
    const percorsoGlobale = [
        '.casella-1', '.casella-2', '.casella-3', '.casella-4', '.casella-5',
        '.casella-6', '.casella-7', '.casella-8', '.casella-9', '.casella-10',
        '.casella-11', '.casella-12', '.casella-13', '.casella-14', '.casella-15',
        '.casella-16', '.casella-17', '.casella-18', '.casella-19', '.casella-20',
        '.casella-21', '.casella-22', '.casella-23', '.casella-24', '.casella-25',
        '.casella-26', '.casella-27', '.casella-28', '.casella-29', '.casella-30',
        '.casella-31', '.casella-32', '.casella-33', '.casella-34', '.casella-35',
        '.casella-36', '.casella-37', '.casella-38', '.casella-39', '.casella-20',
    ];
    
    let turnoCorrente = 'blu'; // Tiene traccia del turno
    let ultimoTiroDado = 0;
    
    // Inizializza il gioco
    inizializzaGioco();
    
    function inizializzaGioco() {
        // Aggiungi event listeners alle celle
        document.querySelectorAll('td').forEach(cell => {
            cell.addEventListener('click', function() {
                gestisciClickCella(this);
            });
        });
        
        // Segna la casella iniziale
        const casellaIniziale = document.querySelector('.casella-1');
        if (casellaIniziale) {
            casellaIniziale.classList.add('has-image');
        }
    }
    
    function tiraDado() {
        ultimoTiroDado = Math.floor(Math.random() * 6) + 1;
        console.log('Dado tirato:', ultimoTiroDado);
        
        // Mostra il risultato in modo più elegante
        const risultato = document.createElement('div');
        risultato.innerHTML = `Hai tirato: ${ultimoTiroDado}`;
        risultato.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 10px 20px;
            border: 2px solid black;
            border-radius: 5px;
            z-index: 1000;
            font-size: 18px;
            font-weight: bold;
        `;
        document.body.appendChild(risultato);
        
        // Rimuovi il messaggio dopo 2 secondi
        setTimeout(() => {
            document.body.removeChild(risultato);
        }, 2000);
        
        return ultimoTiroDado;
    }
    
    function gestisciClickCella(cella) {
        const pedina = cella.querySelector('img');
        
        if (!pedina) {
            console.log('Nessuna pedina in questa cella');
            return;
        }
        
        if (ultimoTiroDado === 0) {
            alert('Prima tira il dado!');
            return;
        }
        
        // Verifica se è il turno giusto
        const colorePedina = ottieniColorePedina(pedina);
        if (colorePedina !== turnoCorrente) {
            alert(`Non è il turno del giocatore ${colorePedina}!`);
            return;
        }
        
        // Muovi la pedina
        muoviPedina(cella, ultimoTiroDado);
        
        // Reset del dado e cambio turno
        ultimoTiroDado = 0;
        cambiaTurno();
    }
    
    function ottieniColorePedina(imgElement) {
        const src = imgElement.src;
        if (src.includes('blu')) return 'blu';
        if (src.includes('rosso')) return 'rosso';
        if (src.includes('verde')) return 'verde';
        if (src.includes('giallo')) return 'giallo';
        return 'sconosciuto';
    }
    
    function muoviPedina(cellaCorrente, passi) {
        const pedina = cellaCorrente.querySelector('img');
        if (!pedina) return;
        
        let cellaDest = trovaCellaDestinazione(cellaCorrente, passi);
        
        if (cellaDest && cellaDest !== cellaCorrente) {
            // Rimuovi la pedina dalla cella corrente
            cellaCorrente.removeChild(pedina);
            cellaCorrente.classList.remove('has-image');
            
            // Aggiungi la pedina alla cella destinazione
            cellaDest.appendChild(pedina);
            cellaDest.classList.add('has-image');
            
            console.log(`Pedina spostata di ${passi} caselle`);
        }
    }
    
    function trovaCellaDestinazione(cellaCorrente, passi) {
        // Questa è una versione semplificata
        // Dovresti implementare la logica completa del percorso del Ludo
        
        const classiCella = Array.from(cellaCorrente.classList);
        const casellaCorrente = classiCella.find(classe => classe.startsWith('casella-'));
        
        if (casellaCorrente) {
            const numeroCorrente = parseInt(casellaCorrente.split('-')[1]);
            const numeroDestinazione = numeroCorrente + passi;
            
            // Cerca la cella di destinazione
            const cellaDestinazione = document.querySelector(`.casella-${numeroDestinazione}`);
            return cellaDestinazione || trovaProximaCellaDisponibile(cellaCorrente, passi);
        }
        
        return trovaProximaCellaDisponibile(cellaCorrente, passi);
    }
    
    function trovaProximaCellaDisponibile(cellaCorrente, passi) {
        // Implementazione semplificata - cerca nella stessa tabella
        const tabella = cellaCorrente.closest('table');
        const celle = Array.from(tabella.querySelectorAll('td'));
        const indiceCorrente = celle.indexOf(cellaCorrente);
        
        if (indiceCorrente !== -1) {
            const indiceDestinazione = (indiceCorrente + passi) % celle.length;
            return celle[indiceDestinazione];
        }
        
        return null;
    }
    
    function cambiaTurno() {
        const ordineTurni = ['blu', 'rosso', 'verde', 'giallo'];
        const indiceCorrente = ordineTurni.indexOf(turnoCorrente);
        turnoCorrente = ordineTurni[(indiceCorrente + 1) % ordineTurni.length];
        
        console.log(`Turno di: ${turnoCorrente}`);
        
        // Aggiorna l'interfaccia per mostrare il turno corrente
        aggiornaIndicatoreTurno();
    }
    
    function aggiornaIndicatoreTurno() {
        // Rimuovi indicatori precedenti
        document.querySelectorAll('.turno-corrente').forEach(el => {
            el.classList.remove('turno-corrente');
        });
        
        // Aggiungi stile per il turno corrente
        const style = document.createElement('style');
        style.textContent = `
            .turno-corrente {
                box-shadow: 0 0 10px 3px gold !important;
                animation: pulse 1s infinite;
            }
            @keyframes pulse {
                0% { box-shadow: 0 0 10px 3px gold; }
                50% { box-shadow: 0 0 20px 5px gold; }
                100% { box-shadow: 0 0 10px 3px gold; }
            }
        `;
        document.head.appendChild(style);
        
        // Trova e evidenzia le pedine del giocatore corrente
        document.querySelectorAll('img').forEach(img => {
            if (ottieniColorePedina(img) === turnoCorrente) {
                img.closest('td').classList.add('turno-corrente');
            }
        });
    }
    
    function resetGame() {
        // Reset completo del gioco
        document.querySelectorAll('td').forEach(cella => {
            cella.classList.remove('has-image', 'turno-corrente');
        });
        
        // Riposiziona tutte le pedine nelle loro case iniziali
        riposizionaPedineIniziali();
        
        turnoCorrente = 'blu';
        ultimoTiroDado = 0;
        aggiornaIndicatoreTurno();
    }
    
    function riposizionaPedineIniziali() {
        // Questa funzione dovrebbe riposizionare le pedine nelle loro posizioni iniziali
        // Implementazione semplificata
        const pedinaBlu = document.querySelector('img[src*="blu"]');
        const casellaIniziale = document.querySelector('.casella-1');
        
        if (pedinaBlu && casellaIniziale) {
            casellaIniziale.appendChild(pedinaBlu);
            casellaIniziale.classList.add('has-image');
        }
    }
    
    // Rendi le funzioni accessibili globalmente
    window.tiraDado = tiraDado;
    window.resetGame = resetGame;
    
    // Inizializza l'indicatore del turno
    aggiornaIndicatoreTurno();
});
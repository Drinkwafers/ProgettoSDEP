// Attendi che il DOM sia completamente caricato
document.addEventListener('DOMContentLoaded', function() {
    
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
    
    // Caselle di partenza per ogni colore
    const casellePartenza = {
        'blu': 1,
        'rosso': 11,
        'verde': 21,
        'giallo': 31
    };
    
    // Caselle di ingresso alle case finali
    const caselleIngressoCasa = {
        'blu': 6,
        'rosso': 16,
        'verde': 26,
        'giallo': 36
    };
    
    let turnoCorrente = 'blu';
    let ultimoTiroDado = 0;
    let pedineFuoriCasa = {
        'blu': 1,    // Una pedina già fuori (come nel tuo HTML)
        'rosso': 1,
        'verde': 1,
        'giallo': 1
    };
    
    // Inizializza il gioco
    inizializzaGioco();
    
    function inizializzaGioco() {
        // Aggiungi event listeners alle celle del percorso
        document.querySelectorAll('td[class*="casella-"]').forEach(cell => {
            cell.addEventListener('click', function() {
                gestisciClickCella(this);
            });
        });
        
        // Aggiungi listeners per le pedine nelle case iniziali
        document.querySelectorAll('table:not([id]) img').forEach(img => {
            img.closest('td').addEventListener('click', function() {
                gestisciClickCasaIniziale(this);
            });
        });
        
        aggiornaIndicatoreTurno();
    }
    
    function tiraDado() {
        ultimoTiroDado = Math.floor(Math.random() * 6) + 1;
        console.log('Dado tirato:', ultimoTiroDado);
        
        // Mostra il risultato
        mostraRisultatoDado(ultimoTiroDado);
        
        return ultimoTiroDado;
    }
    
    function mostraRisultatoDado(risultato) {
        // Rimuovi messaggi precedenti
        const vecchioMessaggio = document.querySelector('.messaggio-dado');
        if (vecchioMessaggio) {
            vecchioMessaggio.remove();
        }
        
        const messaggio = document.createElement('div');
        messaggio.className = 'messaggio-dado';
        messaggio.innerHTML = `Turno ${turnoCorrente}: Hai tirato ${risultato}`;
        messaggio.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 10px 20px;
            border: 2px solid ${turnoCorrente};
            border-radius: 5px;
            z-index: 1000;
            font-size: 18px;
            font-weight: bold;
            color: ${turnoCorrente === 'giallo' ? 'black' : turnoCorrente};
        `;
        document.body.appendChild(messaggio);
        
        setTimeout(() => {
            if (messaggio.parentNode) {
                messaggio.remove();
            }
        }, 3000);
    }
    
    function gestisciClickCasaIniziale(cella) {
        const pedina = cella.querySelector('img');
        if (!pedina) return;
        
        if (ultimoTiroDado === 0) {
            alert('Prima tira il dado!');
            return;
        }
        
        const colorePedina = ottieniColorePedina(pedina);
        if (colorePedina !== turnoCorrente) {
            alert(`Non è il turno del giocatore ${colorePedina}!`);
            return;
        }
        
        // Per uscire di casa serve un 6
        if (ultimoTiroDado === 6) {
            const casellaPartenza = document.querySelector(`.casella-${casellePartenza[colorePedina]}`);
            if (casellaPartenza && !casellaPartenza.querySelector('img')) {
                // Sposta la pedina sulla casella di partenza
                cella.removeChild(pedina);
                casellaPartenza.appendChild(pedina);
                pedineFuoriCasa[colorePedina]++;
                
                console.log(`Pedina ${colorePedina} esce di casa!`);
                
                // Con un 6 si tira di nuovo
                ultimoTiroDado = 0;
                return; // Non cambiare turno
            } else {
                alert('Casella di partenza occupata!');
            }
        } else {
            alert('Serve un 6 per uscire di casa!');
        }
        
        ultimoTiroDado = 0;
        cambiaTurno();
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
        
        const colorePedina = ottieniColorePedina(pedina);
        if (colorePedina !== turnoCorrente) {
            alert(`Non è il turno del giocatore ${colorePedina}!`);
            return;
        }
        
        // Muovi la pedina
        const successo = muoviPedina(cella, ultimoTiroDado);
        
        // Reset del dado
        ultimoTiroDado = 0;
        
        // Cambia turno solo se non è uscito un 6
        if (ultimoTiroDado !== 6 || !successo) {
            cambiaTurno();
        }
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
        if (!pedina) return false;
        
        const colorePedina = ottieniColorePedina(pedina);
        const cellaDest = trovaCellaDestinazione(cellaCorrente, passi, colorePedina);
        
        if (cellaDest && cellaDest !== cellaCorrente) {
            // Gestisci cattura
            const pedinaNemica = cellaDest.querySelector('img');
            if (pedinaNemica && ottieniColorePedina(pedinaNemica) !== colorePedina) {
                catturaPedina(pedinaNemica, cellaDest);
            }
            
            // Muovi la pedina
            cellaCorrente.removeChild(pedina);
            cellaDest.appendChild(pedina);
            
            console.log(`Pedina ${colorePedina} spostata di ${passi} caselle`);
            return true;
        }
        
        return false;
    }
    
    function trovaCellaDestinazione(cellaCorrente, passi, colorePedina) {
        const classiCella = Array.from(cellaCorrente.classList);
        const casellaCorrente = classiCella.find(classe => classe.startsWith('casella-'));
        
        if (!casellaCorrente) return null;
        
        const numeroCorrente = parseInt(casellaCorrente.split('-')[1]);
        let numeroDestinazione = numeroCorrente + passi;
        
        // Gestisci il percorso circolare (40 caselle)
        if (numeroDestinazione > 40) {
            numeroDestinazione = numeroDestinazione - 40;
        }
        
        // Verifica se la pedina deve entrare nella casa finale
        const casellaIngresso = caselleIngressoCasa[colorePedina];
        if (numeroCorrente < casellaIngresso && numeroDestinazione >= casellaIngresso) {
            // La pedina dovrebbe entrare nella casa finale
            // Per ora, rimani sulla casella di ingresso
            numeroDestinazione = casellaIngresso;
        }
        
        const selettoreDestinazione = `.casella-${numeroDestinazione}`;
        return document.querySelector(selettoreDestinazione);
    }
    
    function catturaPedina(pedinaNemica, cella) {
        const coloreNemico = ottieniColorePedina(pedinaNemica);
        
        // Rimuovi la pedina nemica dal tabellone
        cella.removeChild(pedinaNemica);
        
        // Trova una casa libera per rimetterla
        const tabelleCase = document.querySelectorAll('table:not([id])');
        for (let tabella of tabelleCase) {
            const immaginiInTabella = tabella.querySelectorAll('img');
            const coloriPresenti = Array.from(immaginiInTabella).map(img => ottieniColorePedina(img));
            
            if (coloriPresenti.includes(coloreNemico)) {
                // Trova una cella vuota in questa tabella
                const celleVuote = Array.from(tabella.querySelectorAll('td')).filter(td => !td.querySelector('img'));
                if (celleVuote.length > 0) {
                    celleVuote[0].appendChild(pedinaNemica);
                    pedineFuoriCasa[coloreNemico]--;
                    console.log(`Pedina ${coloreNemico} catturata e rimandata a casa!`);
                    break;
                }
            }
        }
    }
    
    function cambiaTurno() {
        const ordineTurni = ['blu', 'rosso', 'verde', 'giallo'];
        const indiceCorrente = ordineTurni.indexOf(turnoCorrente);
        turnoCorrente = ordineTurni[(indiceCorrente + 1) % ordineTurni.length];
        
        console.log(`Turno di: ${turnoCorrente}`);
        aggiornaIndicatoreTurno();
    }
    
    function aggiornaIndicatoreTurno() {
        // Rimuovi indicatori precedenti
        document.querySelectorAll('.turno-corrente').forEach(el => {
            el.classList.remove('turno-corrente');
        });
        
        // Aggiungi stile per il turno corrente se non esiste già
        if (!document.querySelector('#turno-style')) {
            const style = document.createElement('style');
            style.id = 'turno-style';
            style.textContent = `
                .turno-corrente {
                    box-shadow: 0 0 10px 3px gold !important;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 10px 3px gold; }
                    50% { box-shadow: 0 0 20px 5px gold; }
                    100% { box-shadow: 0 0 10px 3px gold; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Evidenzia le pedine del giocatore corrente
        document.querySelectorAll('img').forEach(img => {
            if (ottieniColorePedina(img) === turnoCorrente) {
                img.closest('td').classList.add('turno-corrente');
            }
        });
    }
    
    function resetGame() {
        // Reset completo del gioco
        turnoCorrente = 'blu';
        ultimoTiroDado = 0;
        pedineFuoriCasa = { 'blu': 1, 'rosso': 1, 'verde': 1, 'giallo': 1 };
        
        // Rimuovi tutti gli indicatori
        document.querySelectorAll('.turno-corrente').forEach(el => {
            el.classList.remove('turno-corrente');
        });
        
        aggiornaIndicatoreTurno();
        console.log('Gioco resettato');
    }
    
    // Rendi le funzioni accessibili globalmente
    window.tiraDado = tiraDado;
    window.resetGame = resetGame;
    
    // Inizializza l'indicatore del turno
    aggiornaIndicatoreTurno();
});
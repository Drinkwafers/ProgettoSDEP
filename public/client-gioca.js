// Attendi che il DOM sia completamente caricato
document.addEventListener('DOMContentLoaded', function()
{
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

    // Caselle di ingresso alle case finali (corrette)
    const caselleDestinazione = {
        'blu': 40,
        'rosso': 10,
        'verde': 20,
        'giallo': 30
    };

    // Ordine dei turni
    const ordineTurni = ['blu', 'rosso', 'verde', 'giallo'];

    const pedinePosizionate = {
        'blu': 0,
        'rosso': 0,
        'verde': 0,
        'giallo': 0
    };
    
    let turnoCorrente = 'blu';
    let dado = 0;
    let dadoTirato = false; // Flag per controllare se il dado è stato tirato nel turno corrente

    listener();
    aggiornaIndicatoreTurno();
    document.addEventListener('keydown', gestisciTastiera);

    function listener()
    {
        // Aggiungi event listeners alle caselle del percorso
        document.querySelectorAll('td:not([id*="bianco"])').forEach(cell => {
            cell.addEventListener('click', function()
            {
                gestisciClick(this);
            });
        });
    }

    function gestisciClick(casella)
    {
        console.log('Casella cliccata:', casella.className);

        const pedina = casella.querySelector('img');
        
        if (!pedina)
        {
            console.log('Nessuna pedina in questa casella');
            return;
        }

        // Ottieni il colore della pedina dalla sua immagine
        const colorePedina = ottieniColorePedina(pedina);
        console.log('Colore pedina:', colorePedina, 'Turno corrente:', turnoCorrente);

        // Controlla se è il turno del giocatore corretto
        if (colorePedina !== turnoCorrente)
        {
            alert(`Non è il tuo turno! È il turno del giocatore ${turnoCorrente.toUpperCase()}`);
            return;
        }

        if (casella.className === 'base-' + turnoCorrente + ' turno-attivo')
        {
            console.log('La pedina è nella base di partenza del turno corrente');

            // Se non ci sono pedine in gioco, la prima può entrare automaticamente
            if (pedinePosizionate[turnoCorrente] < 1)
            {
                entraPedina(casella, pedina);
                console.log(`Prima pedina entrata nella base di partenza. Pedine posizionate: ${pedinePosizionate[turnoCorrente]}`);
                passaTurno();
                return;
            }
            
            // Per uscire dalla base serve un 6 se ci sono già pedine in gioco
            if (!dadoTirato)
            {
                alert('Prima tira il dado!');
                return;
            }
            
            if (dado === 6)
            {
                entraPedina(casella, pedina);
                // Con un 6 si tira di nuovo, quindi non cambiare turno
                dadoTirato = false;
                dado = 0;
                alert('Hai fatto 6! Tira di nuovo!');
            }
            else
            {
                alert('Serve un 6 per uscire dalla base!');
                passaTurno();
            }
            return;
        }

        if (casella.className.startsWith('casella-'))
        {
            if (!dadoTirato)
            {
                alert('Prima tira il dado!');
            } else
            {
                controllaPedina(casella, pedina);
            }
        }
    }

    function ottieniColorePedina(pedina)
    {
        const src = pedina.getAttribute('src');
        if (src.includes('pedina-blu')) return 'blu';
        if (src.includes('pedina-rosso')) return 'rosso';
        if (src.includes('pedina-verde')) return 'verde';
        if (src.includes('pedina-giallo')) return 'giallo';
        return null;
    }

    async function controllaPedina(casella, pedina)
    {
        let classi = casella.className.split('-');
        let numPosizione = parseInt(classi[classi.length - 1]);
        let casellaCorrente = casella;
        let haFatto6 = dado === 6;
        
        for (let i = 0; i < dado; i++)
        {
            let prossimaNumPosizione;
            let prossimaCasella;

            // Se la pedina è nelle caselle di destinazione
            if (casellaCorrente.className.startsWith('casella-destinazione'))
            {
                const coloneParts = casellaCorrente.className.split('-');
                const colore = coloneParts[2];
                const posizioneDestinazione = parseInt(coloneParts[3]);
                const nuovaPosizione = posizioneDestinazione + 1;
                
                if (nuovaPosizione <= 4) {
                    prossimaCasella = document.querySelector('.casella-destinazione-' + colore + '-' + nuovaPosizione);
                    
                    // Verifica sovrapposizione nelle caselle destinazione
                    const pedinaNellaDestinazione = prossimaCasella.querySelector('img');
                    if (pedinaNellaDestinazione && ottieniColorePedina(pedinaNellaDestinazione) === turnoCorrente) {
                        alert('Non puoi muovere questa pedina! La casella di destinazione è occupata da una tua pedina.');
                        passaTurno();
                        return;
                    }
                } else {
                    alert('Non puoi muovere una pedina fuori dal tabellone!');
                    passaTurno();
                    return;
                }
            }
            else
            {
                // La pedina è sul percorso principale
                if (numPosizione == caselleDestinazione[turnoCorrente])
                {
                    // Entra nella zona destinazione
                    prossimaCasella = document.querySelector('.casella-destinazione-' + turnoCorrente + '-1');
                    pedinePosizionate[turnoCorrente]--;
                    
                    // Verifica se può entrare nella zona destinazione
                    const pedinaNellaDestinazione = prossimaCasella.querySelector('img');
                    if (pedinaNellaDestinazione && ottieniColorePedina(pedinaNellaDestinazione) === turnoCorrente) {
                        alert('Non puoi muovere questa pedina! La casella di destinazione è occupata da una tua pedina.');
                        passaTurno();
                        return;
                    }
                } else {
                    // Continua sul percorso principale
                    prossimaNumPosizione = numPosizione + 1;
                    if (prossimaNumPosizione === 41)
                        prossimaNumPosizione = 1; // Torna all'inizio se supera 40

                    prossimaCasella = document.querySelector('.casella-' + prossimaNumPosizione);
                }
            }

            // Controlla se mangia solo sull'ultimo movimento e solo sul percorso principale
            if (i === dado - 1 && !prossimaCasella.className.startsWith('casella-destinazione')) {
                controllaMangia(casellaCorrente, pedina, prossimaCasella);
                
                // Verifica sovrapposizione dopo aver controllato se mangia
                const pedinaNellaDestinazione = prossimaCasella.querySelector('img');
                if (pedinaNellaDestinazione && ottieniColorePedina(pedinaNellaDestinazione) === turnoCorrente) {
                    alert('Non puoi muovere questa pedina! La casella di destinazione è occupata da una tua pedina.');
                    passaTurno();
                    return;
                }
            }

            // Muovi la pedina
            casellaCorrente.removeChild(pedina);
            prossimaCasella.appendChild(pedina);
            casellaCorrente = prossimaCasella;

            // Aggiorna la posizione per il prossimo ciclo se necessario
            if (!prossimaCasella.className.startsWith('casella-destinazione')) {
                numPosizione = prossimaNumPosizione;
            }

            // Controlla vittoria
            if (prossimaCasella.className === `casella-destinazione-${turnoCorrente}-4`)
            {
                console.log(`Pedina ${turnoCorrente} raggiunta la destinazione!`);
                alert(`Pedina ${turnoCorrente} raggiunta la destinazione!`);
                // Qui puoi aggiungere logica per gestire la vittoria
            }
            
            // Aspetta mezzo secondo prima del prossimo passo
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Dopo aver mosso la pedina, passa al turno successivo
        // (a meno che non sia stato fatto un 6, nel qual caso si tira di nuovo)
        if (haFatto6)
        {
            alert('Hai fatto 6! Tira di nuovo!');
            dadoTirato = false;
            dado = 0;
        }
        else
        {
            passaTurno();
        }
    }

    function controllaMangia(casellaCorrente, pedina, casellaDestinazione)
    {
        const pedinaDaMangiare = casellaDestinazione.querySelector('img');
        console.log('Pedina nella casella di destinazione:', pedinaDaMangiare);
        
        if (pedinaDaMangiare)
        {
            const nomeVittima = pedinaDaMangiare.getAttribute('src').split('/').pop().replace("pedina-", "").replace(".png", "");
            console.log('Pedina da mangiare:', nomeVittima);
            
            // Se la pedina nella casella di destinazione è di un colore diverso, la "mangia"
            if (nomeVittima !== turnoCorrente)
            {
                console.log(`Pedina ${nomeVittima} mangiata da ${turnoCorrente}!`);
                
                // Rimuovi la pedina dalla casella di destinazione
                casellaDestinazione.removeChild(pedinaDaMangiare);
                
                // Rimetti la pedina mangiata nella sua base
                const baseVittima = document.querySelector(`.base-${nomeVittima}:not(:has(img))`);
                if (baseVittima) {
                    baseVittima.appendChild(pedinaDaMangiare);
                    pedinePosizionate[nomeVittima]--;
                    console.log(`Pedine posizionate di ${nomeVittima}: ${pedinePosizionate[nomeVittima]}`);
                }
                
                // Mostra un messaggio
                alert(`Pedina ${nomeVittima} è stata mangiata e rimandata alla base!`);
                console.log(`Pedina ${nomeVittima} rimandata alla base.`);
            }
        }
    }

    function entraPedina(casella, pedina)
    {
        const casellaPartenza = document.querySelector(casellePartenza[turnoCorrente]);
        
        // Controlla se c'è già una pedina nella casella di partenza
        const pedinaNellaPartenza = casellaPartenza.querySelector('img');
        if (pedinaNellaPartenza)
        {
            // Se c'è una pedina di colore diverso, la mangia
            const coloreVittima = ottieniColorePedina(pedinaNellaPartenza);
            if (coloreVittima !== turnoCorrente) {
                controllaMangia(casella, pedina, casellaPartenza);
            } else {
                alert('Non puoi muovere questa pedina! La casella di partenza è occupata da una tua pedina.');
                return;
            }
        }
        
        // Muovi la pedina
        casella.removeChild(pedina);
        casellaPartenza.appendChild(pedina);
        
        pedinePosizionate[turnoCorrente]++;
        console.log(`Pedina ${turnoCorrente} spostata nella casella di partenza. Pedine posizionate: ${pedinePosizionate[turnoCorrente]}`);
    }

    function passaTurno()
    {
        // Trova l'indice del turno corrente
        const indiceCorrente = ordineTurni.indexOf(turnoCorrente);
        
        // Passa al turno successivo (con ciclo)
        const prossimoIndice = (indiceCorrente + 1) % ordineTurni.length;
        turnoCorrente = ordineTurni[prossimoIndice];
        
        // Reset del dado per il nuovo turno
        dadoTirato = false;
        dado = 0;
        
        console.log(`Turno passato a: ${turnoCorrente}`);
        aggiornaIndicatoreTurno();
    }

    function aggiornaIndicatoreTurno()
    {
        // Rimuovi l'effetto pulse da tutte le basi
        document.querySelectorAll('.base-blu, .base-rosso, .base-verde, .base-giallo').forEach(base => {
            base.classList.remove('turno-attivo');
        });
        
        // Aggiungi l'effetto pulse alle basi del turno corrente
        document.querySelectorAll(`.base-${turnoCorrente}`).forEach(base => {
            base.classList.add('turno-attivo');
        });
    }

    function tiraDado()
    {
        if (dadoTirato)
        {
            alert(`Hai già tirato il dado! È il turno di ${turnoCorrente.toUpperCase()}`);
            return;
        }

        dado = Math.floor(Math.random() * 6) + 1;
        dadoTirato = true;
        console.log('Dado tirato:', dado);
        
        // Mostra il risultato
        mostraRisultatoDado(dado);
        
        return dado;
    }

    function mostraRisultatoDado(risultato)
    {
        // Rimuovi messaggi precedenti
        const vecchioMessaggio = document.querySelector('.messaggio-dado');
        if (vecchioMessaggio) {
            vecchioMessaggio.remove();
        }
        
        const messaggio = document.createElement('div');
        messaggio.className = 'messaggio-dado';
        messaggio.innerHTML = `Turno ${turnoCorrente.toUpperCase()}: Hai tirato ${risultato}`;
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

    // Funzione per gestire i tasti premuti
    function gestisciTastiera(evento)
    {
        switch(evento.code) {
            case 'Enter':
                evento.preventDefault();
                tiraDado();
                break;
        }
    }

    // Rendi le funzioni accessibili globalmente
    window.tiraDado = tiraDado;
});
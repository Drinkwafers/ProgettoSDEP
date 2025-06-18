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

    // Caselle di ingresso alle case finali
    const caselleDestinazione = {
        'blu': 40,
        'rosso': 10,
        'verde': 20,
        'giallo': 30
    };

    // Ordine dei turni
    const ordineTurni = ['blu', 'rosso', 'verde', 'giallo'];

    pedinePosizionate = 0;
    
    let turnoCorrente = 'blu';
    let dado = 0;
    let dadoTirato = false; // Flag per controllare se il dado è stato tirato nel turno corrente

    listener();
    aggiornaIndicatoreTurno();

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

            if (pedinePosizionate < 4)
            {
                entraPedina(casella, pedina);
                console.log(`Pedina entrata nella base di partenza. Pedine posizionate: ${pedinePosizionate}`);
                return;
            }
            
            // Per uscire dalla base serve un 6
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
            }
            else
            {
                alert('Serve un 6 per uscire dalla base!');
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
        numPosizione = classi[classi.length - 1];
        for (let i = 0; i < dado; dado--)
        {
            if (numPosizione == caselleDestinazione[turnoCorrente])
            {
                numPosizione = 1;
                casella = muoviPedina(casella, pedina, 'destinazione-' + turnoCorrente + '-1');
            } else
            {
                numPosizione++;
                if (numPosizione === 41)
                    numPosizione = 1; // Torna all'inizio se supera 40

                if (dado == 1)
                    controllaMangia (casella, pedina, document.querySelector('.casella-' + numPosizione));

                if (casella.className.startsWith('casella-destinazione'))
                {
                    if (numPosizione + dado <= 6 - pedinePosizionate)
                        casella = muoviPedina(casella, pedina, 'destinazione-' + turnoCorrente + '-' + numPosizione);
                    else
                    {
                        alert('Non puoi muovere una pedina fuori dal tabellone!');
                        console.log(numPosizione, dado);
                        passaTurno();
                        return;
                    }
                } else
                    casella = muoviPedina(casella, pedina, numPosizione);

                if (casella.className ==='casella-destinazione'+ turnoCorrente + '-' + (4 - pedinePosizionate))
                {
                    console.log(`Pedina ${turnoCorrente} raggiunta la destinazione!`);
                    alert(`Pedina ${turnoCorrente} raggiunta la destinazione!`);
                    // Qui puoi aggiungere logica per gestire la vittoria
                }
            }
            
            // Aspetta mezzo secondo prima del prossimo passo
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Dopo aver mosso la pedina, passa al turno successivo
        // (a meno che non sia stato fatto un 6, nel qual caso si tira di nuovo)
        if (dado === 6)
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
                }
                
                // Mostra un messaggio
                alert(`Pedina ${nomeVittima} è stata mangiata e rimandata alla base!`);
                
                // Quando si mangia una pedina, si tira di nuovo il dado
                alert('Hai mangiato una pedina! Tira di nuovo!');
                dadoTirato = false;
                dado = 0;
            }
        }
    }

    function muoviPedina(casella, pedina, tipocasella)
    {
        const nuovaPosizione = document.querySelector('.casella-' + tipocasella);
        casella.removeChild(pedina);
        nuovaPosizione.appendChild(pedina);
        return nuovaPosizione;
    }

    function entraPedina(casella, pedina)
    {
        const casellaPartenza = document.querySelector(casellePartenza[turnoCorrente]);
        if (casellaPartenza.querySelector('img'))
        {
            alert(`La casella di partenza ${turnoCorrente} ha già una pedina!`);
            return;
        }

        controllaMangia(casella, pedina, casellaPartenza);
        
        // Muovi la pedina
        casella.removeChild(pedina);
        casellaPartenza.appendChild(pedina);
        
        console.log(`Pedina ${turnoCorrente} spostata nella casella di partenza`);
        pedinePosizionate++;
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

    // Rendi le funzioni accessibili globalmente
    window.tiraDado = tiraDado;
});
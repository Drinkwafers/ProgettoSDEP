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

    let pedinePosizionate = 0;
    let turnoCorrente = 'blu';
    let dado = 0;
    let dadoTirato = false; // Flag per controllare se il dado è stato tirato nel turno corrente
    let sei = false; // Flag per controllare se è stato tirato un 6 (dal paste.txt)

    listener();
    aggiornaIndicatoreTurno();
    
    // Aggiungi il listener per i controlli da tastiera
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

    // Funzione per verificare se una pedina può muoversi (migliorata)
    function puoMuoverePedina(casellaCorrente, pedina, numeroPosizioni) {
        const colorePedina = ottieniColorePedina(pedina);
        
        // Se la pedina è in una casella di destinazione
        if (casellaCorrente.className.includes('casella-destinazione')) {
            const posizioneCorrente = parseInt(casellaCorrente.className.split('-').pop());
            const nuovaPosizione = posizioneCorrente + numeroPosizioni;
            
            // Controlla se può muoversi nella zona di destinazione
            if (nuovaPosizione <= 4) {
                const casellaDestinazione = document.querySelector(`.casella-destinazione-${colorePedina}-${nuovaPosizione}`);
                if (casellaDestinazione) {
                    const pedinaDestinazione = casellaDestinazione.querySelector('img');
                    return !(pedinaDestinazione && ottieniColorePedina(pedinaDestinazione) === colorePedina);
                }
            }
            return false; // Non può muoversi oltre la zona di destinazione
        }
        
        // Se la pedina è sul tabellone normale
        let posizione = parseInt(casellaCorrente.className.split('-').pop());
        let posizioneFinale = posizione + numeroPosizioni;
        
        // Gestisci il caso di superamento del tabellone (da 40 a 1)
        if (posizioneFinale > 40) {
            posizioneFinale = posizioneFinale - 40;
        }
        
        // Controlla se la pedina entra nella zona di destinazione
        if (posizione <= caselleDestinazione[colorePedina] && 
            posizioneFinale > caselleDestinazione[colorePedina]) {
            // La pedina entra nella zona di destinazione
            const posizioneDestinazione = posizioneFinale - caselleDestinazione[colorePedina];
            const casellaDestinazione = document.querySelector(`.casella-destinazione-${colorePedina}-${posizioneDestinazione}`);
            
            if (casellaDestinazione) {
                const pedinaDestinazione = casellaDestinazione.querySelector('img');
                return !(pedinaDestinazione && ottieniColorePedina(pedinaDestinazione) === colorePedina);
            }
        } else {
            // Movimento normale sul tabellone
            const casellaDestinazione = document.querySelector(`.casella-${posizioneFinale}`);
            
            if (casellaDestinazione) {
                const pedinaDestinazione = casellaDestinazione.querySelector('img');
                return !(pedinaDestinazione && ottieniColorePedina(pedinaDestinazione) === colorePedina);
            }
        }
        
        return true; // La pedina può muoversi
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
            
            if (sei === true)
            {
                entraPedina(casella, pedina);
                // Con un 6 si tira di nuovo, quindi non cambiare turno
                sei = false; // Reset del flag sei
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
                // Controllo se la pedina può muoversi
                if (!puoMuoverePedina(casella, pedina, dado)) {
                    alert('Non puoi muovere questa pedina! La casella di destinazione è occupata da una tua pedina. Prova a muovere un\'altra pedina.');
                    return;
                }
                
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
        
        for (let i = 0; i < dado; i++) // Corretto: era dado-- che causava loop infinito
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

                // Controlla se mangia solo sull'ultimo movimento
                if (i === dado - 1)
                    controllaMangia(casella, pedina, document.querySelector('.casella-' + numPosizione));

                if (casella.className.startsWith('casella-destinazione'))
                {
                    const nuovaPosizione = parseInt(casella.className.split('-').pop()) + 1;
                    if (nuovaPosizione <= 4)
                        casella = muoviPedina(casella, pedina, 'destinazione-' + turnoCorrente + '-' + nuovaPosizione);
                    else
                    {
                        alert('Non puoi muovere una pedina fuori dal tabellone!');
                        console.log(numPosizione, dado);
                        passaTurno();
                        return;
                    }
                } else
                    casella = muoviPedina(casella, pedina, numPosizione);

                // Controlla vittoria
                if (casella.className === `casella-destinazione-${turnoCorrente}-4`)
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
        if (sei === true) // Usa la variabile sei dal paste.txt
        {
            alert('Hai fatto 6! Tira di nuovo!');
            dadoTirato = false;
            dado = 0;
            sei = false; // Reset del flag per il prossimo turno
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
        
        // Imposta il flag sei se il dado è 6 (dal paste.txt)
        if (dado === 6)
            sei = true;
        
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


    // Funzione per trovare una pedina movibile casuale (CORRETTA)
    function trovaPedinaCasuale()
    {
        // Prima controlla se ci sono pedine nella base che possono uscire (con dado = 6)
        if (dado === 6)
        {
            const basi = document.querySelectorAll(`.base-${turnoCorrente}.turno-attivo`);
            for (let base of basi)
            {
                const pedina = base.querySelector('img');
                if (pedina) {
                    const colorePedina = ottieniColorePedina(pedina);
                    if (colorePedina === turnoCorrente) {
                        const casellaPartenza = document.querySelector(casellePartenza[turnoCorrente]);
                        // Controlla se la casella di partenza è libera o occupata da una pedina avversaria
                        const pedinaNellaPartenza = casellaPartenza.querySelector('img');
                        if (!pedinaNellaPartenza || ottieniColorePedina(pedinaNellaPartenza) !== turnoCorrente) {
                            return { casella: base, pedina: pedina };
                        }
                    }
                }
            }
        }
    
        // Cerca pedine sul tabellone che possono muoversi
        const pedineDelTurno = [];
        
        // Controlla tutte le caselle del percorso principale
        for (let i = 1; i <= 40; i++) {
            const casella = document.querySelector(`.casella-${i}`);
            if (casella) {
                const pedina = casella.querySelector('img');
                if (pedina && ottieniColorePedina(pedina) === turnoCorrente) {
                    // Verifica se questa pedina può muoversi
                    if (puoMuoverePedina(casella, pedina, dado)) {
                        pedineDelTurno.push({ casella: casella, pedina: pedina });
                    }
                }
            }
        }
        
        // Controlla anche le caselle di destinazione
        for (let i = 1; i <= 4; i++) {
            const casella = document.querySelector(`.casella-destinazione-${turnoCorrente}-${i}`);
            if (casella) {
                const pedina = casella.querySelector('img');
                if (pedina && ottieniColorePedina(pedina) === turnoCorrente) {
                    // Per le caselle di destinazione, controlla se può muoversi verso il centro
                    const nuovaPosizione = i + dado;
                    if (nuovaPosizione <= 4) {
                        const casellaDestinazione = document.querySelector(`.casella-destinazione-${turnoCorrente}-${nuovaPosizione}`);
                        if (!casellaDestinazione || !casellaDestinazione.querySelector('img')) {
                            pedineDelTurno.push({ casella: casella, pedina: pedina });
                        }
                    }
                }
            }
        }
        
        // Se ci sono pedine movibili, scegline una a caso
        if (pedineDelTurno.length > 0) {
            const indiceRandom = Math.floor(Math.random() * pedineDelTurno.length);
            return pedineDelTurno[indiceRandom];
        }
        
        return null; // Nessuna pedina può muoversi
    }

    // Funzione per muovere una pedina casuale
    function muoviPedinaCasuale() {
        if (!dadoTirato) {
            alert('Prima devi tirare il dado!');
            return;
        }
        
        const pedinaDaMuovere = trovaPedinaCasuale();
        
        if (!pedinaDaMuovere) {
            alert('Nessuna pedina può muoversi con questo dado!');
            passaTurno();
            return;
        }
        
        console.log('Muovo pedina casuale:', pedinaDaMuovere);
        
        // Simula il click sulla pedina trovata
        gestisciClick(pedinaDaMuovere.casella);
    }

    // Funzione per gestire i tasti premuti
    function gestisciTastiera(evento) {
        switch(evento.code) {
            case 'Enter':
                evento.preventDefault();
                tiraDado();
                break;
                
            case 'Space':
                evento.preventDefault();
                muoviPedinaCasuale();
                break;
        }
    }

    // Rendi le funzioni accessibili globalmente
    window.tiraDado = tiraDado;
    window.muoviPedinaCasuale = muoviPedinaCasuale;
});
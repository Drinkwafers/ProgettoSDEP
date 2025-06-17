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
    const partenzaBlu = document.querySelector('.casella-1');
    const partenzaRosso = document.querySelector('.casella-11');
    const partenzaVerde = document.querySelector('.casella-21');
    const partenzaGiallo = document.querySelector('.casella-31');
    const casellePartenza = {
        'blu': 1,
        'rosso': 11,
        'verde': 21,
        'giallo': 31
    };

    // Caselle di ingresso alle case finali
    const caselleIngressoCasa = {
        'blu': 40,
        'rosso': 10,
        'verde': 20,
        'giallo': 30
    };
    
    let turnoCorrente = 'blu';
    let ultimoTiroDado = 0;

    listener();

    function listener()
    {
        // Aggiungi event listeners alle caselle del percorso
        document.querySelectorAll('td:not([id*="bianco"])').forEach(cell => {
            cell.addEventListener('click', function()
            {
                gestisciClick(this);
            });
        });
        /* aggiornaIndicatoreTurno(); */
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
        
        // Corretto: controlla se la pedina ha la classe base del colore corrente
        if (pedina.classList.contains('base-' + turnoCorrente))
        {
            console.log('La pedina è nella base di partenza del turno corrente');
            entraPedina(casella, pedina); // Passa anche la pedina come parametro
        }
        
        if (ultimoTiroDado === 0)
        {
            alert('Prima tira il dado!');
            return;
        }
    }

    function entraPedina(casella, pedina)
    {
        // Determina la casella di partenza in base al colore del turno corrente
        let casellaPartenza;
        switch(turnoCorrente) {
            case 'blu':
                casellaPartenza = partenzaBlu;
                break;
            case 'rosso':
                casellaPartenza = partenzaRosso;
                break;
            case 'verde':
                casellaPartenza = partenzaVerde;
                break;
            case 'giallo':
                casellaPartenza = partenzaGiallo;
                break;
            default:
                console.error('Colore turno non valido');
                return;
        }
        
        if (casellaPartenza.querySelector('img'))
        {
            alert(`La casella di partenza ${turnoCorrente} ha già una pedina!`);
            return;
        }
        
        // Muovi la pedina
        casella.removeChild(pedina);
        casellaPartenza.appendChild(pedina);
        
        console.log(`Pedina ${turnoCorrente} spostata nella casella di partenza`);
    }

    function tiraDado()
    {
        ultimoTiroDado = Math.floor(Math.random() * 6) + 1;
        console.log('Dado tirato:', ultimoTiroDado);
        
        // Mostra il risultato
        mostraRisultatoDado(ultimoTiroDado);
        
        return ultimoTiroDado;
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

    // Rendi le funzioni accessibili globalmente
    window.tiraDado = tiraDado;
});
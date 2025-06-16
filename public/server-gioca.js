function moveImageToNext(currentCell)
{
    const image = currentCell.querySelector("img");
    if (!image) return false;
    
    const table = currentCell.closest('table');
    const cells = table.querySelectorAll('td');
    const currentIndex = Array.from(cells).indexOf(currentCell);
    
    // Calcola l'indice della cella successiva (torna alla prima se è l'ultima)
    const nextIndex = (currentIndex + 1) % cells.length;
    const nextCell = cells[nextIndex];
    
    if (nextCell) {
        // Rimuovi la classe dalla cella corrente
        currentCell.classList.remove('has-image');
        // Aggiungi la classe alla nuova cella
        nextCell.classList.add('has-image');
        // Sposta l'immagine
        nextCell.appendChild(image);
        return true;
    }
    return false;
}

    // Aggiungi event listener a tutte le celle
    document.querySelectorAll('td').forEach(cell => {
        cell.addEventListener('click', () => {
            const hasImage = cell.querySelector('img');
            if (hasImage) {
                moveImageToNext(cell);
            }
        });
    });

    // Inizializza la prima cella con la classe
    document.querySelector('td').classList.add('has-image');
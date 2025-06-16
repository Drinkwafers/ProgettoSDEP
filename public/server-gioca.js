function tiraDado()
{
    let s = Math.floor(Math.random() * 6) + 1;;
    console.log(s);
    window.alert(s)
}

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
    
    if (nextCell)
    {
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

function resetGame()
{
    const table = document.getElementById('gameTable');
    const cells = table.querySelectorAll('td');
    const firstCell = cells[0];
    
    // Rimuovi tutte le classi has-image
    cells.forEach(cell => cell.classList.remove('has-image'));
    
    // Trova l'immagine e spostala nella prima cella
    const image = table.querySelector('img');
    if (image)
    {
        firstCell.appendChild(image);
        firstCell.classList.add('has-image');
    }
}

// Aggiungi event listener a tutte le celle
document.querySelectorAll('td').forEach(cell => {
    cell.addEventListener('click', () => {
        const hasImage = cell.querySelector('img');
        if (hasImage)
        {
            moveImageToNext(cell);
        }
    });
});

window.addEventListener("load", function()
{
    document.querySelector('.casella-1').classList.add('has-image');
});
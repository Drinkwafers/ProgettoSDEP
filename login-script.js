window.onload = function () {

    const form = document.getElementById("loginForm");

    form.addEventListener("submit", async function(e) {
        e.preventDefault();

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const message = document.getElementById("message");

        // Reset del messaggio precedente
        message.textContent = "";
        message.className = "";

        // Validazione base lato client
        if (!email || !password) {
            message.textContent = "Inserisci email e password";
            message.className = "error";
            return;
        }

        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                message.textContent = "Login effettuato con successo!";
                message.className = "success";
                
                // Attesa di 1 secondo prima del redirect per mostrare il messaggio
                setTimeout(() => {
                    window.location.href = "/private/restricted.html";
                }, 1000);
            }
            else {
                message.textContent = "Errore: " + data.message;
                message.className = "error";
            }
        }
        catch (error) {
            message.textContent = "Errore di rete.";
            message.className = "error";
            console.error('Errore di connessione:', error);
        }

    });

};
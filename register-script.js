window.onload = function () {

    const form = document.getElementById("registerForm");

    form.addEventListener("submit", async function(e) {
        e.preventDefault();

        const nome = document.getElementById("nome").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;
        const message = document.getElementById("message");

        // Reset del messaggio precedente
        message.textContent = "";
        message.className = "";

        // Validazioni lato client
        if (!nome || !email || !password || !confirmPassword) {
            message.textContent = "Tutti i campi sono obbligatori";
            message.className = "error";
            return;
        }

        if (password !== confirmPassword) {
            message.textContent = "Le password non coincidono";
            message.className = "error";
            return;
        }

        if (password.length < 6) {
            message.textContent = "La password deve essere di almeno 6 caratteri";
            message.className = "error";
            return;
        }

        // Validazione email base
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            message.textContent = "Inserisci un'email valida";
            message.className = "error";
            return;
        }

        try {
            const response = await fetch("/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({ nome, email, password })
            });

            const data = await response.json();

            if (data.success) {
                message.textContent = "Registrazione completata con successo!";
                message.className = "success";
                
                // Reset del form
                form.reset();
                
                // Attesa di 2 secondi prima del redirect al login
                setTimeout(() => {
                    window.location.href = "/login.html";
                }, 2000);
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

    // Validazione in tempo reale per la conferma password
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    
    confirmPasswordInput.addEventListener("input", function() {
        if (passwordInput.value !== confirmPasswordInput.value) {
            confirmPasswordInput.setCustomValidity("Le password non coincidono");
        } else {
            confirmPasswordInput.setCustomValidity("");
        }
    });

};
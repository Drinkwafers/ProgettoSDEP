window.onload = function () {
    // Imposta la modalità di autenticazione
    authManager.setAuthMode(true); // true = sessionStorage, false = cookie

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

        // Usa authManager per il login
        const result = await authManager.login(email, password);

        if (result.success) {
            message.textContent = "Login effettuato con successo!";
            message.className = "success";
            setTimeout(() => {
                window.location.href = "/private/resoconto-partite.html";
            }, 1000);
        } else {
            message.textContent = "Errore: " + result.message;
            message.className = "error";
        }
    });
};
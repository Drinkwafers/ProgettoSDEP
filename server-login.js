const express = require("express");
const mysql = require("mysql2");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

app.use(express.static("public"));


const JWT_SECRET = "mia_chiave_super_segreta";

const pool = mysql.createPool({
    host: "localhost",
    user: "user1",
    password: "pass1",
    database: "mio_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


// Middleware di autenticazione JWT
function authenticateToken(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.redirect(302, "/index.html");
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    }
    catch (err) {
        return res.redirect(302, "/index.html");
    }
}


// Proteggo la cartella /private
app.use("/private", authenticateToken, express.static("private"));


// Endpoint registrazione
app.post("/api/register", async (req, res) => {
    const { nome, email, password } = req.body;

    // Validazione input
    if (!nome || !email || !password) {
        return res.status(400).json({
            success: false,
            message: "Nome, email e password sono obbligatori"
        });
    }

    // Validazione lunghezza password
    if (password.length < 6) {
        return res.status(400).json({
            success: false,
            message: "La password deve essere di almeno 6 caratteri"
        });
    }

    // Validazione email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            message: "Email non valida"
        });
    }

    try {
        // Controllo se l'email esiste già
        const checkQuery = "SELECT id FROM utenti WHERE email = ?";
        const [existingUsers] = await pool.promise().execute(checkQuery, [email]);

        if (existingUsers.length > 0) {
            return res.status(409).json({ // Conflict
                success: false,
                message: "Email già registrata"
            });
        }

        // Inserimento nuovo utente
        const insertQuery = "INSERT INTO utenti (nome, email, password) VALUES (?, ?, ?)";
        const [result] = await pool.promise().execute(insertQuery, [nome, email, password]);

        return res.status(201).json({
            success: true,
            message: "Registrazione completata con successo"
        });

    } catch (err) {
        console.error("Errore query DB registrazione:", err);
        return res.status(500).json({
            success: false,
            message: "Errore interno al server"
        });
    }
});


// Endpoint login con controllo nel DB
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Email e password sono obbligatori"
        });
    }

    const query = "SELECT id, nome FROM utenti WHERE email = ? AND password = ?";

    try {
        const [righe, colonne] = await pool.promise().execute(query, [email, password]);

        if (righe.length == 0) {
            return res.status(401).json({ // Unauthorized
                success: false,
                message: "Credenziali non valide"
            });
        }

        const user = righe[0];

        const payload = {
            userId: user.id,
            userName: user.nome,
        };

        const token = jwt.sign(payload, JWT_SECRET, {
            algorithm: "HS256",
            expiresIn: "1h"
        });

        // Imposto il cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: true,
            maxAge: 3600000,
            sameSite: "Strict"
        });

        return res.json({
            success: true,
            message: "Login riuscito"
        });

    }
    catch (err) {
        console.error("Errore query DB:", err);
        return res.status(500).json({
            success: false,
            message: "Errore interno al server"
        });
    }

});


// Endpoit per il logout
app.post("/api/logout", authenticateToken, (req, res) => {
    res.clearCookie("token");
    res.json({
        success: true,
        message: "Logout effettuato"
    });
});


app.get("/api/userinfo", authenticateToken, (req, res) => {
    res.json({
        success: true,
        nome: req.user.userName
    });
});


app.listen(PORT, () => {
    console.log("Server in ascolto su http://localhost:" + PORT);
});
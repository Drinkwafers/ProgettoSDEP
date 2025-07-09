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
    user: "admin",
    password: "#C4labriaM!a",
    database: "sdep_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// SOLUZIONE 1: Middleware per gestire token da SessionStorage
function authenticateTokenFromHeader(req, res, next) {
    // Prova prima con l'header Authorization
    const authHeader = req.headers.authorization;
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        // Fallback ai cookie per compatibilità
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Token di autenticazione mancante"
        });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: "Token non valido"
        });
    }
}

// Middleware di autenticazione JWT originale (per le pagine)
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
app.use("/private", express.static("private"));

// Endpoint registrazione
app.post("/api/register", async (req, res) => {
    const { nome, email, password } = req.body;

    if (!nome || !email || !password) {
        return res.status(400).json({
            success: false,
            message: "Nome, email e password sono obbligatori"
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            success: false,
            message: "La password deve essere di almeno 6 caratteri"
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            message: "Email non valida"
        });
    }

    try {
        const checkQuery = "SELECT id FROM utenti WHERE email = ?";
        const [existingUsers] = await pool.promise().execute(checkQuery, [email]);

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email già registrata"
            });
        }

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

// SOLUZIONE 1: Login modificato per supportare sia cookie che header
app.post("/api/login", async (req, res) => {
    const { email, password, useSessionStorage } = req.body;

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
            return res.status(401).json({
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

        // Se useSessionStorage è true, invia solo il token senza impostare cookie
        if (useSessionStorage) {
            return res.json({
                success: true,
                message: "Login riuscito",
                token: token,
                user: {
                    id: user.id,
                    nome: user.nome
                }
            });
        } else {
            // Comportamento originale con cookie
            res.cookie("token", token, {
                httpOnly: false,
                secure: false,
                maxAge: 3600000,
            });

            return res.json({
                success: true,
                message: "Login riuscito"
            });
        }

    } catch (err) {
        console.error("Errore query DB:", err);
        return res.status(500).json({
            success: false,
            message: "Errore interno al server"
        });
    }
});

// Endpoint per il logout
app.post("/api/logout", authenticateToken, (req, res) => {
    res.clearCookie("token");
    res.json({
        success: true,
        message: "Logout effettuato"
    });
});

// SOLUZIONE 1: Endpoint userinfo modificato per supportare header
app.get("/api/userinfo", authenticateTokenFromHeader, (req, res) => {
    res.json({
        success: true,
        nome: req.user.userName,
        userId: req.user.userId,
    });
});

// SOLUZIONE 1: Endpoint statistiche utente modificato
app.get("/api/user-stats", authenticateTokenFromHeader, async (req, res) => {
    const userId = req.user.userId;

    try {
        const query = "SELECT vinte, giocate FROM partite WHERE id_giocatore = ?";
        const [righe] = await pool.promise().execute(query, [userId]);

        if (righe.length === 0) {
            return res.json({
                success: true,
                stats: {
                    vinte: 0,
                    giocate: 0
                }
            });
        }

        const stats = righe[0];
        
        return res.json({
            success: true,
            stats: stats
        });

    } catch (err) {
        console.error("Errore query statistiche utente:", err);
        return res.status(500).json({
            success: false,
            message: "Errore interno al server"
        });
    }
});

// SOLUZIONE 1: Endpoint classifica modificato
app.get("/api/ranking", authenticateTokenFromHeader, async (req, res) => {
    const currentUserId = req.user.userId;

    try {
        const query = `
            SELECT u.id, u.nome, COALESCE(p.vinte, 0) as vinte, COALESCE(p.giocate, 0) as giocate,
                   CASE 
                       WHEN COALESCE(p.giocate, 0) = 0 THEN 0
                       ELSE (COALESCE(p.vinte, 0) / COALESCE(p.giocate, 0)) * 100
                   END as percentuale_vittorie
            FROM utenti u
            LEFT JOIN partite p ON u.id = p.id_giocatore
            ORDER BY COALESCE(p.vinte, 0) DESC, percentuale_vittorie DESC, COALESCE(p.giocate, 0) DESC
        `;
        
        const [righe] = await pool.promise().execute(query);

        return res.json({
            success: true,
            ranking: righe,
            currentUserId: currentUserId
        });

    } catch (err) {
        console.error("Errore query classifica:", err);
        return res.status(500).json({
            success: false,
            message: "Errore interno al server"
        });
    }
});

// SOLUZIONE 1: Endpoint statistiche globali modificato
app.get("/api/global-stats", authenticateTokenFromHeader, async (req, res) => {
    try {
        const playersQuery = "SELECT COUNT(*) as totalPlayers FROM utenti";
        const [playersResult] = await pool.promise().execute(playersQuery);

        const statsQuery = `
            SELECT 
                COUNT(*) as playersWithGames,
                SUM(giocate) as totalGames,
                AVG(CASE 
                    WHEN giocate = 0 THEN 0
                    ELSE (vinte / giocate) * 100
                END) as avgWinRate
            FROM partite
        `;
        const [statsResult] = await pool.promise().execute(statsQuery);

        const totalPlayers = playersResult[0].totalPlayers;
        const totalGames = statsResult[0].totalGames || 0;
        const avgWinRate = parseFloat(statsResult[0].avgWinRate) || 0;

        return res.json({
            success: true,
            stats: {
                totalPlayers: totalPlayers,
                totalGames: totalGames,
                avgWinRate: avgWinRate
            }
        });

    } catch (err) {
        console.error("Errore query statistiche globali:", err);
        return res.status(500).json({
            success: false,
            message: "Errore interno al server"
        });
    }
});

// SOLUZIONE 1: Endpoint aggiornamento statistiche modificato
app.post("/api/update-game-stats", authenticateTokenFromHeader, async (req, res) => {
    const userId = req.user.userId;
    const { won } = req.body;

    if (typeof won !== 'boolean') {
        return res.status(400).json({
            success: false,
            message: "Il parametro 'won' deve essere un boolean"
        });
    }

    try {
        const checkQuery = "SELECT vinte, giocate FROM partite WHERE id_giocatore = ?";
        const [existingRows] = await pool.promise().execute(checkQuery, [userId]);

        if (existingRows.length === 0) {
            const insertQuery = "INSERT INTO partite (id_giocatore, vinte, giocate) VALUES (?, ?, 1)";
            const vinte = won ? 1 : 0;
            await pool.promise().execute(insertQuery, [userId, vinte]);
        } else {
            const currentStats = existingRows[0];
            const newVinte = won ? currentStats.vinte + 1 : currentStats.vinte;
            const newGiocate = currentStats.giocate + 1;
            
            const updateQuery = "UPDATE partite SET vinte = ?, giocate = ? WHERE id_giocatore = ?";
            await pool.promise().execute(updateQuery, [newVinte, newGiocate, userId]);
        }

        return res.json({
            success: true,
            message: "Statistiche aggiornate con successo"
        });

    } catch (err) {
        console.error("Errore aggiornamento statistiche partita:", err);
        return res.status(500).json({
            success: false,
            message: "Errore interno al server"
        });
    }
});
/*
app.listen(PORT, () => {
    console.log("Server in ascolto su http://localhost:" + PORT);
});
*/

app.listen(PORT, 'localhost',  () => {
    console.log("Server in ascolto su http://localhost:" + PORT);
});
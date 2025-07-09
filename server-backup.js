const express = require('express');
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = 3003;

// Database principale
const mainPool = mysql.createPool({
    host: 'localhost',
    user: 'admin', 
    password: '#C4labriaM!a',
    database: 'sdep_db'
});

// Database backup (può essere su altro server)
const backupPool = mysql.createPool({
    host: 'localhost',
    user: 'admin',
    password: '#C4labriaM!a', 
    database: 'sdep_db_backup'
});

// BACKUP AUTOMATICO OGNI ORA
cron.schedule('0 * * * *', () => {
    console.log(' Avvio backup automatico...');
    performFullBackup();
});

// BACKUP GIORNALIERO COMPLETO (3:00 AM)
cron.schedule('0 3 * * *', () => {
    console.log('Backup giornaliero completo...');
    performFullBackup();
    createSQLDump();
});

async function performFullBackup() {
    try {
        // Backup tabella utenti
        const [utenti] = await mainPool.promise().execute('SELECT * FROM utenti');
        await backupPool.promise().execute('DELETE FROM utenti');
        
        for (const user of utenti) {
            await backupPool.promise().execute(
                'INSERT INTO utenti (id, nome, email, password) VALUES (?, ?, ?, ?)',
                [user.id, user.nome, user.email, user.password]
            );
        }

        // Backup tabella partite  
        const [partite] = await mainPool.promise().execute('SELECT * FROM partite');
        await backupPool.promise().execute('DELETE FROM partite');
        
        for (const partita of partite) {
            await backupPool.promise().execute(
                'INSERT INTO partite (id_giocatore, vinte, giocate) VALUES (?, ?, ?)',
                [partita.id_giocatore, partita.vinte, partita.giocate]
            );
        }

        console.log(`Backup completato: ${utenti.length} utenti, ${partite.length} record partite`);
        
    } catch (error) {
        console.error(' Errore backup:', error);
        // Invia notifica di errore (email, Slack, etc.)
    }
}

// CREAZIONE SQL DUMP FILE
async function createSQLDump() {
    const timestamp = new Date().toISOString().slice(0,10);
    const filename = `backup_sdep_${timestamp}.sql`;
    const backupDir = './backups';
    
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }
    
    const exec = require('child_process').exec;
    const command = `mysqldump -u admin -p'#C4labriaM!a' sdep_db > ${backupDir}/${filename}`;
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(' Errore SQL dump:', error);
        } else {
            console.log(` SQL dump creato: ${filename}`);
            cleanOldBackups(); // Rimuovi backup vecchi
        }
    });
}

// PULIZIA BACKUP VECCHI (mantieni ultimi 7 giorni)
function cleanOldBackups() {
    const backupDir = './backups';
    const files = fs.readdirSync(backupDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    
    files.forEach(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            console.log(`Backup rimosso: ${file}`);
        }
    });
}

// ENDPOINT EMERGENZA - RIPRISTINO
app.post('/api/restore-backup', async (req, res) => {
    try {
        console.log(' RIPRISTINO EMERGENZA AVVIATO');
        
        // Copia dal backup al database principale
        const [utenti] = await backupPool.promise().execute('SELECT * FROM utenti');
        const [partite] = await backupPool.promise().execute('SELECT * FROM partite');
        
        await mainPool.promise().execute('DELETE FROM utenti');
        await mainPool.promise().execute('DELETE FROM partite');
        
        for (const user of utenti) {
            await mainPool.promise().execute(
                'INSERT INTO utenti (id, nome, email, password) VALUES (?, ?, ?, ?)',
                [user.id, user.nome, user.email, user.password]
            );
        }
        
        for (const partita of partite) {
            await mainPool.promise().execute(
                'INSERT INTO partite (id_giocatore, vinte, giocate) VALUES (?, ?, ?)',
                [partita.id_giocatore, partita.vinte, partita.giocate]
            );
        }
        
        res.json({ success: true, message: 'Database ripristinato dal backup' });
        
    } catch (error) {
        console.error(' Errore ripristino:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ENDPOINT STATUS BACKUP
app.get('/api/backup-status', async (req, res) => {
    try {
        const [mainUsers] = await mainPool.promise().execute('SELECT COUNT(*) as count FROM utenti');
        const [backupUsers] = await backupPool.promise().execute('SELECT COUNT(*) as count FROM utenti');
        
        const backupFiles = fs.readdirSync('./backups').length;
        
        res.json({
            success: true,
            status: {
                mainDB: mainUsers[0].count,
                backupDB: backupUsers[0].count,
                sqlDumps: backupFiles,
                lastBackup: new Date().toISOString()
            }
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(` Server Backup in ascolto sulla porta ${PORT}`);
    console.log(' Backup automatico: ogni ora');
    console.log(' Backup completo: ogni giorno alle 3:00');
});
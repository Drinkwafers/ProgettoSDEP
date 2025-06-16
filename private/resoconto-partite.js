//tabella partite 
//+--------------+------+------+-----+---------+-------+
//| Field        | Type | Null | Key | Default | Extra |
//+--------------+------+------+-----+---------+-------+
//| id_giocatore | int  | NO   | MUL | NULL    |       |
//| vinte        | int  | NO   |     | NULL    |       |
//| giocate      | int  | NO   |     | NULL    |       |
//+--------------+------+------+-----+---------+-------+


//tabella utenti


//+----------+--------------+------+-----+---------+----------------+
//| Field    | Type         | Null | Key | Default | Extra          |
//+----------+--------------+------+-----+---------+----------------+
//| id       | int          | NO   | PRI | NULL    | auto_increment |
//| nome     | varchar(100) | NO   |     | NULL    |                |
//| email    | varchar(100) | NO   |     | NULL    |                |
//| password | varchar(255) | NO   |     | NULL    |                |
//+----------+--------------+------+-----+---------+----------------+



//mi serve fatta una pagina resoconto.html, resoconto.css, resoconto.js(per inviare le fetch al server) e le funzioni del server che già ho(server-login.js) che basandosi sui dati del db mi faccia il resoconto di ste partite solo se hai effettuato il login
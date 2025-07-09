// models.js
const { Sequelize, DataTypes, Model } = require('sequelize');
const bcrypt = require('bcrypt');

// 1) Configurazione connessione MySQL
const sequelize = new Sequelize('sdep_db', 'admin', '#C4labriaM!a', {
  host: '10.109.3.17',
  dialect: 'mysql',
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  logging: false
});

// 2) Modello User
class User extends Model {
  // Confronta la password in chiaro con l’hash
  async verifyPassword(password) {
    return bcrypt.compare(password, this.passwordHash);
  }
}
User.init({
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',         // cambia se la tua tabella si chiama diversamente
  timestamps: true
});

// 3) Modello RefreshToken
class RefreshToken extends Model {}
RefreshToken.init({
  token: {
    type: DataTypes.STRING(500),
    allowNull: false,
    unique: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'RefreshToken',
  tableName: 'refresh_tokens',  // cambia se la tua tabella si chiama diversamente
  timestamps: true
});

// 4) Definisco le relazioni
User.hasMany(RefreshToken, { foreignKey: 'userId', onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'userId' });

// 5) Sincronizzo i modelli con il database
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connessione a MySQL OK');
    await sequelize.sync();  
    console.log('Modelli sincronizzati con il database');
  } catch (err) {
    console.error('Errore di connessione o sync:', err);
  }
})();

module.exports = { User, RefreshToken, sequelize };

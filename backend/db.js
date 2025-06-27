const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'bingo.db'));

db.serialize(() => {
  // Tabela de jogos
  db.run(`CREATE TABLE IF NOT EXISTS games (
    game_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME
  )`);

  // Tabela de kits de acesso
  db.run(`CREATE TABLE IF NOT EXISTS kits (
    kit_id TEXT PRIMARY KEY,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabela de cartelas (agora associada a kits e jogos)
  db.run(`CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kit_id TEXT NOT NULL,
    game_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    quina_awarded BOOLEAN DEFAULT 0,
    full_awarded BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kit_id) REFERENCES kits (kit_id),
    FOREIGN KEY (game_id) REFERENCES games (game_id)
  )`);

  // Tabela de números sorteados (agora associada a jogos)
  db.run(`CREATE TABLE IF NOT EXISTS drawn_numbers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    number INTEGER NOT NULL,
    drawn_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games (game_id)
  )`);

  // Tabela de prêmios (agora associada a kits e jogos)
  db.run(`CREATE TABLE IF NOT EXISTS prizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kit_id TEXT NOT NULL,
    card_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    game_id INTEGER NOT NULL,
    claimed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kit_id) REFERENCES kits (kit_id),
    FOREIGN KEY (card_id) REFERENCES cards (id),
    FOREIGN KEY (game_id) REFERENCES games (game_id)
  )`);

  // Remover tabelas antigas se existirem
  db.run(`DROP TABLE IF EXISTS users`);
  db.run(`DROP TABLE IF EXISTS old_cards`);
  db.run(`DROP TABLE IF EXISTS old_drawn_numbers`);
  db.run(`DROP TABLE IF EXISTS old_prizes`);
});

module.exports = db; 
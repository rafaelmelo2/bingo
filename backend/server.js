const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const db = require('./db');
const { checkAllCardsAndAward } = require('./prizeLogic');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Utilitário para gerar kit_id xxxx-xxxx-xxxx
function generateKitId() {
  return Array(3).fill(0).map(() => crypto.randomBytes(2).toString('hex')).join('-');
}

// Utilitário para gerar nomes de jogos
const GAME_NAMES = ['Jogo do Rato', 'Cachorro', 'Gato', 'Coelho'];

// Estado do jogo atual (em memória)
let currentGameId = null;
let pauseUntil = null;

// Iniciar novo jogo (admin)
app.post('/admin/start-game', (req, res) => {
  const { name } = req.body;
  const gameName = name || GAME_NAMES[Math.floor(Math.random() * GAME_NAMES.length)];
  db.run('INSERT INTO games (name) VALUES (?)', [gameName], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao iniciar jogo' });
    currentGameId = this.lastID;
    res.json({ game_id: currentGameId, name: gameName });
  });
});

// Obter jogo atual
app.get('/game/current', (req, res) => {
  if (!currentGameId) return res.json({ game_id: null });
  db.get('SELECT * FROM games WHERE game_id = ?', [currentGameId], (err, row) => {
    if (err || !row) return res.json({ game_id: null });
    res.json(row);
  });
});

// Gerar novo kit
app.post('/kit/new', (req, res) => {
  const kit_id = generateKitId();
  const { name } = req.body;
  db.run('INSERT INTO kits (kit_id, name) VALUES (?, ?)', [kit_id, name || null], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao criar kit' });
    res.json({ kit_id });
  });
});

// Validar kit existente
app.post('/kit/login', (req, res) => {
  const { kit_id } = req.body;
  db.get('SELECT * FROM kits WHERE kit_id = ?', [kit_id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Kit não encontrado' });
    res.json(row);
  });
});

// Comprar cartela
app.post('/buy-card', (req, res) => {
  const { kit_id } = req.body;
  if (!currentGameId) return res.status(400).json({ error: 'Nenhum jogo em andamento' });
  // Gerar cartela
  const card = generateBingoCard();
  db.run('INSERT INTO cards (kit_id, game_id, data) VALUES (?, ?, ?)', [kit_id, currentGameId, JSON.stringify(card)], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao criar cartela' });
    res.json({ card_id: this.lastID, card });
  });
});

// Listar cartelas do kit no jogo atual
app.get('/cards/:kit_id', (req, res) => {
  if (!currentGameId) return res.json([]);
  db.all('SELECT * FROM cards WHERE kit_id = ? AND game_id = ?', [req.params.kit_id, currentGameId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar cartelas' });
    res.json(rows.map(r => ({
      id: r.id,
      data: JSON.parse(r.data),
      quina_awarded: !!r.quina_awarded,
      full_awarded: !!r.full_awarded
    })));
  });
});

// Sacar prêmio
app.post('/claim-prize', (req, res) => {
  const { kit_id, type } = req.body;
  if (!currentGameId) return res.status(400).json({ error: 'Nenhum jogo em andamento' });
  db.run('UPDATE prizes SET claimed = 1 WHERE kit_id = ? AND type = ? AND game_id = ?', [kit_id, type, currentGameId], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao sacar prêmio' });
    res.json({ ok: true });
  });
});

// Histórico de jogos
app.get('/games/history', (req, res) => {
  db.all('SELECT * FROM games ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar histórico' });
    res.json(rows);
  });
});

// Listar todos os kits e cartelas (admin)
app.get('/admin/kits', (req, res) => {
  db.all('SELECT * FROM kits', [], (err, kits) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar kits' });
    db.all('SELECT * FROM cards', [], (err2, cards) => {
      if (err2) return res.status(500).json({ error: 'Erro ao buscar cartelas' });
      res.json({ kits, cards });
    });
  });
});

// Ranking (adaptado para kits)
app.get('/ranking', (req, res) => {
  db.all(`
    SELECT k.kit_id, k.name, 
           COUNT(DISTINCT c.id) as cards_count,
           COUNT(CASE WHEN p.type = 'quina' THEN 1 END) as quinas,
           COUNT(CASE WHEN p.type = 'full' THEN 1 END) as fulls,
           (COUNT(CASE WHEN p.type = 'quina' THEN 1 END) * 30 + 
            COUNT(CASE WHEN p.type = 'full' THEN 1 END) * 100) as points
    FROM kits k
    LEFT JOIN cards c ON k.kit_id = c.kit_id
    LEFT JOIN prizes p ON k.kit_id = p.kit_id
    GROUP BY k.kit_id, k.name
    ORDER BY points DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar ranking' });
    res.json(rows);
  });
});

// Função para gerar cartela de bingo 5x5
function generateBingoCard() {
  const card = [];
  for (let i = 0; i < 5; i++) {
    const col = [];
    while (col.length < 5) {
      const min = i * 15 + 1;
      const max = i * 15 + 15;
      const num = Math.floor(Math.random() * (max - min + 1)) + min;
      if (!col.includes(num)) col.push(num);
    }
    card.push(col);
  }
  card[2][2] = 'FREE';
  return card;
}

// Sorteio de número (admin ou automático)
let autoDrawInterval = null;
let isPaused = false;

function pauseAll(ms) {
  isPaused = true;
  pauseUntil = Date.now() + ms;
  setTimeout(() => { isPaused = false; pauseUntil = null; }, ms);
}

io.on('connection', (socket) => {
  socket.on('draw-number', () => {
    if (!currentGameId || isPaused) return;
    drawNumberAndCheck(socket);
  });

  socket.on('admin-auto-draw', (active) => {
    if (active) {
      if (!autoDrawInterval) {
        autoDrawInterval = setInterval(() => {
          if (!currentGameId || isPaused) return;
          drawNumberAndCheck(socket);
        }, 3000);
      }
    } else {
      if (autoDrawInterval) {
        clearInterval(autoDrawInterval);
        autoDrawInterval = null;
      }
    }
  });

  socket.on('disconnect', () => {});
});

function drawNumberAndCheck(socket) {
  db.all('SELECT number FROM drawn_numbers WHERE game_id = ?', [currentGameId], (err, rows) => {
    const drawnNumbers = rows.map(r => r.number);
    let num;
    do {
      num = Math.floor(Math.random() * 75) + 1;
    } while (drawnNumbers.includes(num) && drawnNumbers.length < 75);
    if (drawnNumbers.length < 75) {
      db.run('INSERT INTO drawn_numbers (game_id, number) VALUES (?, ?)', [currentGameId, num], (err) => {
        if (!err) {
          io.emit('number-drawn', num);
          checkAllCardsAndAward(io, currentGameId, () => {
            // Após prêmio, pausa 10s
            pauseAll(10000);
            // Checar se cartela cheia acabou o jogo
            db.get('SELECT COUNT(*) as cnt FROM prizes WHERE game_id = ? AND type = "full"', [currentGameId], (err, row) => {
              if (row && row.cnt >= 1) {
                // Encerrar jogo
                db.run('UPDATE games SET ended_at = CURRENT_TIMESTAMP WHERE game_id = ?', [currentGameId]);
                currentGameId = null;
                io.emit('game-ended');
              }
            });
          });
        }
      });
    }
  });
}

// Resetar jogo (admin)
app.post('/admin/reset', (req, res) => {
  db.run('DELETE FROM drawn_numbers');
  db.run('DELETE FROM cards');
  db.run('DELETE FROM prizes');
  db.run('UPDATE games SET ended_at = CURRENT_TIMESTAMP WHERE ended_at IS NULL');
  currentGameId = null;
  res.json({ ok: true });
});

// Listar números sorteados por jogo
app.get('/drawn-numbers/:gameId', (req, res) => {
  db.all('SELECT number FROM drawn_numbers WHERE game_id = ? ORDER BY drawn_at ASC', [req.params.gameId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar números sorteados' });
    res.json(rows);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
}); 
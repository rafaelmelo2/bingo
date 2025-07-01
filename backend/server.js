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
  const { name, gameType, scheduledTime } = req.body;
  const gameName = name || GAME_NAMES[Math.floor(Math.random() * GAME_NAMES.length)];
  
  // gameType: 'manual', 'auto', 'scheduled'
  const gameData = {
    name: gameName,
    game_type: gameType || 'manual',
    scheduled_time: scheduledTime || null,
    auto_draw: gameType === 'auto'
  };
  
  db.run('INSERT INTO games (name, game_type, scheduled_time, auto_draw) VALUES (?, ?, ?, ?)', 
    [gameData.name, gameData.game_type, gameData.scheduled_time, gameData.auto_draw ? 1 : 0], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao iniciar jogo' });
    currentGameId = this.lastID;
    
    // Se for automático, iniciar o sorteio automático
    if (gameType === 'auto') {
      if (!autoDrawInterval) {
        autoDrawInterval = setInterval(() => {
          if (!currentGameId || isPaused) return;
          drawNumberAndCheck();
        }, 3000);
      }
    }
    
    res.json({ game_id: currentGameId, ...gameData });
  });
});

// Iniciar jogo existente
app.post('/admin/start-game/:gameId', (req, res) => {
  const { gameId } = req.params;
  
  console.log('Tentando iniciar jogo:', gameId);
  
  db.get('SELECT * FROM games WHERE game_id = ?', [gameId], (err, game) => {
    if (err) {
      console.error('Erro ao buscar jogo:', err);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
    
    if (!game) {
      console.log('Jogo não encontrado:', gameId);
      return res.status(404).json({ error: 'Jogo não encontrado' });
    }
    
    console.log('Jogo encontrado:', game);
    
    if (game.started_at) {
      console.log('Jogo já foi iniciado:', gameId);
      return res.status(400).json({ error: 'Jogo já foi iniciado' });
    }
    
    // Marcar jogo como iniciado
    db.run('UPDATE games SET started_at = CURRENT_TIMESTAMP WHERE game_id = ?', [gameId], function(err) {
      if (err) {
        console.error('Erro ao atualizar jogo:', err);
        return res.status(500).json({ error: 'Erro ao iniciar jogo' });
      }
      
      console.log('Jogo iniciado com sucesso:', gameId);
      
      currentGameId = gameId;
      
      // Se o jogo for automático, iniciar o sorteio
      if (game.auto_draw) {
        if (!autoDrawInterval) {
          autoDrawInterval = setInterval(() => {
            if (!currentGameId || isPaused) return;
            drawNumberAndCheck();
          }, 3000);
        }
      }
      
      // Buscar o jogo atualizado para retornar
      db.get('SELECT * FROM games WHERE game_id = ?', [gameId], (err, updatedGame) => {
        if (err) {
          console.error('Erro ao buscar jogo atualizado:', err);
          return res.status(500).json({ error: 'Erro ao buscar dados do jogo' });
        }
        
        // Emitir evento de jogo iniciado
        io.emit('game_started', { game_id: gameId, game: updatedGame });
        
        res.json({ 
          ok: true, 
          game: updatedGame,
          message: 'Jogo iniciado com sucesso'
        });
      });
    });
  });
});

// Parar sorteio automático
app.post('/admin/stop-auto', (req, res) => {
  if (autoDrawInterval) {
    clearInterval(autoDrawInterval);
    autoDrawInterval = null;
  }
  res.json({ ok: true });
});

// Obter status do sorteio automático
app.get('/admin/auto-status', (req, res) => {
  res.json({ 
    isActive: !!autoDrawInterval,
    currentGameId,
    isPaused
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
    
    // Dar pontos iniciais (50 pontos para comprar 5 cartelas)
    db.run('INSERT INTO prizes (kit_id, card_id, type, game_id, points) VALUES (?, ?, ?, ?, ?)', 
      [kit_id, 0, 'initial_points', 0, 50], (err) => {
      if (err) console.error('Erro ao dar pontos iniciais:', err);
      res.json({ kit_id });
    });
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
  const { kit_id, game_id } = req.body;
  const targetGameId = game_id || currentGameId;
  
  if (!targetGameId) return res.status(400).json({ error: 'Nenhum jogo especificado' });
  
  // Verificar se o jogo existe e está ativo
  db.get('SELECT * FROM games WHERE game_id = ? AND started_at IS NOT NULL AND ended_at IS NULL', [targetGameId], (err, game) => {
    if (err || !game) return res.status(400).json({ error: 'Jogo não encontrado ou não está ativo' });
    
    // Verificar se ainda está no período de compra (1 minuto após início)
    const gameStartTime = new Date(game.started_at);
    const currentTime = new Date();
    const timeDiff = currentTime - gameStartTime;
    const purchaseWindow = 60000; // 1 minuto em milissegundos
    
    if (timeDiff > purchaseWindow) {
      return res.status(400).json({ error: 'Período de compra de cartelas encerrado. O jogo já começou há mais de 1 minuto.' });
    }
    
    // Verificar se o jogador tem pontos suficientes
    db.get('SELECT * FROM kits WHERE kit_id = ?', [kit_id], (err, kit) => {
      if (err || !kit) return res.status(404).json({ error: 'Kit não encontrado' });
      
      // Calcular pontos atuais do jogador
      db.get('SELECT COALESCE(SUM(points), 0) as total_points FROM prizes WHERE kit_id = ?', [kit_id], (err, result) => {
        if (err) return res.status(500).json({ error: 'Erro ao calcular pontos' });
        
        const currentPoints = result.total_points || 0;
        
        if (currentPoints < 10) {
          return res.status(400).json({ error: 'Pontos insuficientes para comprar cartela (mínimo 10 pontos)' });
        }
        
        // Verificar se o jogador já comprou cartelas neste jogo
        db.get('SELECT COUNT(*) as card_count FROM cards WHERE kit_id = ? AND game_id = ?', [kit_id, targetGameId], (err, cardResult) => {
          if (err) return res.status(500).json({ error: 'Erro ao verificar cartelas existentes' });
          
          if (cardResult.card_count >= 5) {
            return res.status(400).json({ error: 'Limite máximo de 5 cartelas por jogo atingido' });
          }
          
          // Gerar cartela
          const card = generateBingoCard();
          db.run('INSERT INTO cards (kit_id, game_id, data) VALUES (?, ?, ?)', [kit_id, targetGameId, JSON.stringify(card)], function (err) {
            if (err) return res.status(500).json({ error: 'Erro ao criar cartela' });
            
            // Descontar pontos (criar um prêmio negativo)
            db.run('INSERT INTO prizes (kit_id, card_id, type, game_id, points) VALUES (?, ?, ?, ?, ?)', 
              [kit_id, this.lastID, 'card_purchase', targetGameId, -10], (err) => {
              if (err) console.error('Erro ao descontar pontos:', err);
              res.json({ 
                card_id: this.lastID, 
                card, 
                points_deducted: 10,
                remaining_time: Math.max(0, purchaseWindow - timeDiff),
                cards_bought: cardResult.card_count + 1
              });
            });
          });
        });
      });
    });
  });
});

// Listar cartelas do kit no jogo específico
app.get('/cards/:kit_id', (req, res) => {
  const { kit_id } = req.params;
  const { game_id } = req.query;
  const targetGameId = game_id || currentGameId;
  
  if (!targetGameId) return res.json([]);
  
  db.all('SELECT * FROM cards WHERE kit_id = ? AND game_id = ?', [kit_id, targetGameId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar cartelas' });
    res.json(rows.map(r => ({
      id: r.id,
      data: JSON.parse(r.data),
      quina_awarded: !!r.quina_awarded,
      full_awarded: !!r.full_awarded
    })));
  });
});

// Obter informações sobre período de compra de cartelas
app.get('/game/:gameId/purchase-info', (req, res) => {
  const { gameId } = req.params;
  const { kit_id } = req.query;
  
  db.get('SELECT * FROM games WHERE game_id = ?', [gameId], (err, game) => {
    if (err || !game) return res.status(404).json({ error: 'Jogo não encontrado' });
    
    if (!game.started_at) {
      return res.json({ 
        can_purchase: false, 
        reason: 'Jogo ainda não foi iniciado',
        remaining_time: null,
        cards_bought: 0
      });
    }
    
    const gameStartTime = new Date(game.started_at);
    const currentTime = new Date();
    const timeDiff = currentTime - gameStartTime;
    const purchaseWindow = 60000; // 1 minuto
    
    const canPurchase = timeDiff <= purchaseWindow;
    const remainingTime = Math.max(0, purchaseWindow - timeDiff);
    
    // Se kit_id foi fornecido, buscar informações específicas do jogador
    if (kit_id) {
      db.get('SELECT COUNT(*) as card_count FROM cards WHERE kit_id = ? AND game_id = ?', [kit_id, gameId], (err, cardResult) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar cartelas do jogador' });
        
        res.json({
          can_purchase: canPurchase && cardResult.card_count < 5,
          reason: !canPurchase ? 'Período de compra encerrado' : 
                  cardResult.card_count >= 5 ? 'Limite de cartelas atingido' : 'Pode comprar',
          remaining_time: remainingTime,
          cards_bought: cardResult.card_count,
          max_cards: 5
        });
      });
    } else {
      res.json({
        can_purchase: canPurchase,
        reason: canPurchase ? 'Pode comprar' : 'Período de compra encerrado',
        remaining_time: remainingTime,
        cards_bought: 0,
        max_cards: 5
      });
    }
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
           COALESCE(SUM(p.points), 0) as points
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
    drawNumberAndCheck();
  });

  socket.on('admin-auto-draw', (active) => {
    if (active) {
      if (!autoDrawInterval) {
        autoDrawInterval = setInterval(() => {
          if (!currentGameId || isPaused) return;
          drawNumberAndCheck();
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

function drawNumberAndCheck() {
  if (!currentGameId) return;
  
  db.all('SELECT number FROM drawn_numbers WHERE game_id = ?', [currentGameId], (err, rows) => {
    if (err) return;
    
    const drawnNumbers = rows.map(r => r.number);
    let num;
    do {
      num = Math.floor(Math.random() * 75) + 1;
    } while (drawnNumbers.includes(num) && drawnNumbers.length < 75);
    
    if (drawnNumbers.length < 75) {
      db.run('INSERT INTO drawn_numbers (game_id, number) VALUES (?, ?)', [currentGameId, num], (err) => {
        if (!err) {
          // Emitir para todos os clientes conectados
          io.emit('number_drawn', { number: num, gameId: currentGameId });
          
          // Verificar prêmios
          checkAllCardsAndAward(io, currentGameId, () => {
            // Após prêmio, pausa 10s
            pauseAll(10000);
            
            // Checar se cartela cheia acabou o jogo
            db.get('SELECT COUNT(*) as cnt FROM prizes WHERE game_id = ? AND type = "full"', [currentGameId], (err, row) => {
              if (row && row.cnt >= 1) {
                // Encerrar jogo
                db.run('UPDATE games SET ended_at = CURRENT_TIMESTAMP WHERE game_id = ?', [currentGameId]);
                currentGameId = null;
                
                // Parar sorteio automático
                if (autoDrawInterval) {
                  clearInterval(autoDrawInterval);
                  autoDrawInterval = null;
                }
                
                io.emit('game_ended', { gameId: currentGameId });
              }
            });
          });
        }
      });
    } else {
      // Todos os números foram sorteados
      db.run('UPDATE games SET ended_at = CURRENT_TIMESTAMP WHERE game_id = ?', [currentGameId]);
      currentGameId = null;
      
      // Parar sorteio automático
      if (autoDrawInterval) {
        clearInterval(autoDrawInterval);
        autoDrawInterval = null;
      }
      
      io.emit('game_ended', { gameId: currentGameId });
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

// Listar todos os jogos disponíveis
app.get('/games', (req, res) => {
  db.all('SELECT * FROM games ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar jogos' });
    res.json(rows);
  });
});

// Listar jogos passados (finalizados)
app.get('/games/past', (req, res) => {
  db.all('SELECT * FROM games WHERE ended_at IS NOT NULL ORDER BY ended_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar jogos passados' });
    res.json(rows);
  });
});

// Listar jogos ativos (iniciados mas não finalizados)
app.get('/games/active', (req, res) => {
  db.all('SELECT * FROM games WHERE started_at IS NOT NULL AND ended_at IS NULL ORDER BY started_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar jogos ativos' });
    res.json(rows);
  });
});

// Listar jogos aguardando início
app.get('/games/waiting', (req, res) => {
  db.all('SELECT * FROM games WHERE started_at IS NULL AND ended_at IS NULL ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar jogos aguardando' });
    res.json(rows);
  });
});

// Buscar pontos de um kit específico
app.get('/points/:kitId', (req, res) => {
  const { kitId } = req.params;
  db.get('SELECT COALESCE(SUM(points), 0) as points FROM prizes WHERE kit_id = ?', [kitId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar pontos' });
    res.json({ points: row.points || 0 });
  });
});

// Buscar dados de um jogador específico
app.get('/player/:playerName', (req, res) => {
  const { playerName } = req.params;
  db.get('SELECT * FROM kits WHERE name = ?', [playerName], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar jogador' });
    if (!row) return res.status(404).json({ error: 'Jogador não encontrado' });
    res.json(row);
  });
});

// Buscar cartelas de um jogador em um jogo específico
app.get('/player/:playerName/cards/:gameId', (req, res) => {
  const { playerName, gameId } = req.params;
  
  // Primeiro buscar o kit_id do jogador
  db.get('SELECT kit_id FROM kits WHERE name = ?', [playerName], (err, kit) => {
    if (err || !kit) return res.status(404).json({ error: 'Jogador não encontrado' });
    
    // Depois buscar as cartelas
    db.all('SELECT * FROM cards WHERE kit_id = ? AND game_id = ?', [kit.kit_id, gameId], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Erro ao buscar cartelas' });
      res.json(rows.map(r => ({
        id: r.id,
        data: JSON.parse(r.data),
        quina_awarded: !!r.quina_awarded,
        full_awarded: !!r.full_awarded
      })));
    });
  });
});

// Buscar dados de um jogo específico
app.get('/game/:gameId', (req, res) => {
  const { gameId } = req.params;
  db.get('SELECT * FROM games WHERE game_id = ?', [gameId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar jogo' });
    if (!row) return res.status(404).json({ error: 'Jogo não encontrado' });
    res.json(row);
  });
});

// Buscar jogadores
app.get('/players', (req, res) => {
  db.all('SELECT * FROM kits ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar jogadores' });
    res.json(rows);
  });
});

// Buscar kits
app.get('/kits', (req, res) => {
  db.all(`
    SELECT k.kit_id, k.name, k.created_at,
           COUNT(DISTINCT c.id) as cards_count,
           COUNT(CASE WHEN p.type = 'quina' THEN 1 END) as quinas,
           COUNT(CASE WHEN p.type = 'full' THEN 1 END) as fulls,
           COALESCE(SUM(p.points), 0) as total_points
    FROM kits k
    LEFT JOIN cards c ON k.kit_id = c.kit_id
    LEFT JOIN prizes p ON k.kit_id = p.kit_id
    GROUP BY k.kit_id, k.name, k.created_at
    ORDER BY total_points DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar kits' });
    res.json(rows);
  });
});

// Buscar estatísticas gerais
app.get('/stats', (req, res) => {
  db.all(`
    SELECT 
      COUNT(DISTINCT k.kit_id) as totalPlayers,
      COUNT(DISTINCT c.id) as totalCards,
      COUNT(CASE WHEN p.type = 'quina' THEN 1 END) as totalQuinas,
      COUNT(CASE WHEN p.type = 'full' THEN 1 END) as totalFulls,
      COALESCE(SUM(p.points), 0) as totalPoints
    FROM kits k
    LEFT JOIN cards c ON k.kit_id = c.kit_id
    LEFT JOIN prizes p ON k.kit_id = p.kit_id
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    res.json(rows[0] || {
      totalPlayers: 0,
      totalCards: 0,
      totalQuinas: 0,
      totalFulls: 0,
      totalPoints: 0
    });
  });
});

// Buscar estatísticas por jogo
app.get('/stats/:gameId', (req, res) => {
  const { gameId } = req.params;
  db.all(`
    SELECT 
      COUNT(DISTINCT c.kit_id) as totalPlayers,
      COUNT(DISTINCT c.id) as totalCards,
      COUNT(CASE WHEN p.type = 'quina' THEN 1 END) as totalQuinas,
      COUNT(CASE WHEN p.type = 'full' THEN 1 END) as totalFulls,
      COUNT(DISTINCT dn.number) as numbersDrawn
    FROM games g
    LEFT JOIN cards c ON g.game_id = c.game_id
    LEFT JOIN prizes p ON g.game_id = p.game_id
    LEFT JOIN drawn_numbers dn ON g.game_id = dn.game_id
    WHERE g.game_id = ?
    GROUP BY g.game_id
  `, [gameId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    res.json(rows[0] || {
      totalPlayers: 0,
      totalCards: 0,
      totalQuinas: 0,
      totalFulls: 0,
      numbersDrawn: 0
    });
  });
});

// Buscar jogadores por jogo
app.get('/game/:gameId/players', (req, res) => {
  const { gameId } = req.params;
  db.all(`
    SELECT DISTINCT k.kit_id, k.name, k.created_at,
           COUNT(c.id) as cards_count,
           COUNT(CASE WHEN p.type = 'quina' THEN 1 END) as quinas,
           COUNT(CASE WHEN p.type = 'full' THEN 1 END) as fulls,
           COALESCE(SUM(p.points), 0) as points
    FROM kits k
    INNER JOIN cards c ON k.kit_id = c.kit_id AND c.game_id = ?
    LEFT JOIN prizes p ON k.kit_id = p.kit_id AND p.game_id = ?
    GROUP BY k.kit_id, k.name, k.created_at
    ORDER BY points DESC
  `, [gameId, gameId], (err, players) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar jogadores' });
    res.json(players);
  });
});



// Estatísticas por jogo
app.get('/admin/game-stats/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  db.get('SELECT * FROM games WHERE game_id = ?', [gameId], (err, game) => {
    if (err || !game) return res.status(404).json({ error: 'Jogo não encontrado' });
    
    // Buscar estatísticas do jogo
    db.all(`
      SELECT 
        COUNT(DISTINCT c.kit_id) as unique_players,
        COUNT(c.id) as total_cards,
        COUNT(CASE WHEN p.type = 'quina' THEN 1 END) as quinas,
        COUNT(CASE WHEN p.type = 'full' THEN 1 END) as fulls,
        COUNT(DISTINCT dn.number) as numbers_drawn
      FROM games g
      LEFT JOIN cards c ON g.game_id = c.game_id
      LEFT JOIN prizes p ON g.game_id = p.game_id
      LEFT JOIN drawn_numbers dn ON g.game_id = dn.game_id
      WHERE g.game_id = ?
      GROUP BY g.game_id
    `, [gameId], (err, stats) => {
      if (err) return res.status(500).json({ error: 'Erro ao buscar estatísticas' });
      
      const gameStats = stats[0] || {
        unique_players: 0,
        total_cards: 0,
        quinas: 0,
        fulls: 0,
        numbers_drawn: 0
      };
      
      res.json({ game, stats: gameStats });
    });
  });
});

// Listar jogadores por jogo
app.get('/admin/game-players/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  db.all(`
    SELECT DISTINCT k.kit_id, k.name, k.created_at,
           COUNT(c.id) as cards_count,
           COUNT(CASE WHEN p.type = 'quina' THEN 1 END) as quinas,
           COUNT(CASE WHEN p.type = 'full' THEN 1 END) as fulls,
           COALESCE(SUM(p.points), 0) as points
    FROM kits k
    INNER JOIN cards c ON k.kit_id = c.kit_id AND c.game_id = ?
    LEFT JOIN prizes p ON k.kit_id = p.kit_id AND p.game_id = ?
    GROUP BY k.kit_id, k.name, k.created_at
    ORDER BY points DESC
  `, [gameId, gameId], (err, players) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar jogadores' });
    res.json(players);
  });
});

// Endpoint para dar pontos extras (admin)
app.post('/admin/give-points', (req, res) => {
  const { kit_id, points, reason } = req.body;
  
  if (!kit_id || !points) {
    return res.status(400).json({ error: 'Kit ID e pontos são obrigatórios' });
  }
  
  db.run('INSERT INTO prizes (kit_id, card_id, type, game_id, points) VALUES (?, ?, ?, ?, ?)', 
    [kit_id, 0, reason || 'admin_bonus', 0, points], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao dar pontos' });
    res.json({ ok: true, points_given: points });
  });
});

// Endpoint para remover pontos (admin)
app.post('/admin/remove-points', (req, res) => {
  const { kit_id, points, reason } = req.body;
  
  if (!kit_id || !points) {
    return res.status(400).json({ error: 'Kit ID e pontos são obrigatórios' });
  }
  
  db.run('INSERT INTO prizes (kit_id, card_id, type, game_id, points) VALUES (?, ?, ?, ?, ?)', 
    [kit_id, 0, reason || 'admin_penalty', 0, -points], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao remover pontos' });
    res.json({ ok: true, points_removed: points });
  });
});

// Buscar kits com pontos (admin)
app.get('/admin/kits-with-points', (req, res) => {
  db.all(`
    SELECT k.kit_id, k.name, k.created_at,
           COALESCE(SUM(p.points), 0) as total_points,
           COUNT(DISTINCT c.id) as cards_count
    FROM kits k
    LEFT JOIN prizes p ON k.kit_id = p.kit_id
    LEFT JOIN cards c ON k.kit_id = c.kit_id
    GROUP BY k.kit_id, k.name, k.created_at
    ORDER BY total_points DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar kits' });
    res.json(rows);
  });
});

// Sorteio de número (admin)
app.post('/admin/draw-number', (req, res) => {
  const { game_id } = req.body;
  
  if (!game_id) {
    return res.status(400).json({ error: 'Game ID é obrigatório' });
  }
  
  db.all('SELECT number FROM drawn_numbers WHERE game_id = ?', [game_id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar números sorteados' });
    
    const drawnNumbers = rows.map(r => r.number);
    let num;
    do {
      num = Math.floor(Math.random() * 75) + 1;
    } while (drawnNumbers.includes(num) && drawnNumbers.length < 75);
    
    if (drawnNumbers.length < 75) {
      db.run('INSERT INTO drawn_numbers (game_id, number) VALUES (?, ?)', [game_id, num], (err) => {
        if (!err) {
          io.emit('number_drawn', { number: num, gameId: game_id });
          checkAllCardsAndAward(io, game_id, () => {
            pauseAll(10000);
          });
          res.json({ number: num });
        } else {
          res.status(500).json({ error: 'Erro ao sortear número' });
        }
      });
    } else {
      res.status(400).json({ error: 'Todos os números já foram sorteados' });
    }
  });
});

// Ativar/desativar sorteio automático
app.post('/admin/auto-draw', (req, res) => {
  const { game_id, enabled } = req.body;
  
  if (enabled) {
    if (!autoDrawInterval) {
      autoDrawInterval = setInterval(() => {
        if (!game_id || isPaused) return;
        drawNumberAndCheck();
      }, 3000);
    }
  } else {
    if (autoDrawInterval) {
      clearInterval(autoDrawInterval);
      autoDrawInterval = null;
    }
  }
  
  res.json({ ok: true, auto_draw: enabled });
});

// Finalizar jogo
app.post('/admin/end-game', (req, res) => {
  const { game_id } = req.body;
  
  if (!game_id) {
    return res.status(400).json({ error: 'Game ID é obrigatório' });
  }
  
  db.run('UPDATE games SET ended_at = CURRENT_TIMESTAMP WHERE game_id = ?', [game_id], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao finalizar jogo' });
    
    // Parar sorteio automático se estiver ativo
    if (autoDrawInterval) {
      clearInterval(autoDrawInterval);
      autoDrawInterval = null;
    }
    
    // Limpar jogo atual se for o mesmo
    if (currentGameId === game_id) {
      currentGameId = null;
    }
    
    io.emit('game_ended', { game_id });
    res.json({ ok: true });
  });
});

// Resetar jogo específico
app.post('/admin/reset-game', (req, res) => {
  const { game_id } = req.body;
  
  if (!game_id) {
    return res.status(400).json({ error: 'Game ID é obrigatório' });
  }
  
  db.run('DELETE FROM drawn_numbers WHERE game_id = ?', [game_id], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao resetar números sorteados' });
    
    db.run('DELETE FROM cards WHERE game_id = ?', [game_id], (err) => {
      if (err) return res.status(500).json({ error: 'Erro ao resetar cartelas' });
      
      db.run('DELETE FROM prizes WHERE game_id = ?', [game_id], (err) => {
        if (err) return res.status(500).json({ error: 'Erro ao resetar prêmios' });
        
        res.json({ ok: true });
      });
    });
  });
});

// Excluir jogo
app.delete('/admin/game/:gameId', (req, res) => {
  const { gameId } = req.params;
  
  db.run('DELETE FROM drawn_numbers WHERE game_id = ?', [gameId], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao excluir números sorteados' });
    
    db.run('DELETE FROM cards WHERE game_id = ?', [gameId], (err) => {
      if (err) return res.status(500).json({ error: 'Erro ao excluir cartelas' });
      
      db.run('DELETE FROM prizes WHERE game_id = ?', [gameId], (err) => {
        if (err) return res.status(500).json({ error: 'Erro ao excluir prêmios' });
        
        db.run('DELETE FROM games WHERE game_id = ?', [gameId], (err) => {
          if (err) return res.status(500).json({ error: 'Erro ao excluir jogo' });
          
          res.json({ ok: true });
        });
      });
    });
  });
});

// Endpoint para limpar rodadas (substitui o botão de limpar cache)
app.post('/admin/clear-rounds', (req, res) => {
  const { gameId } = req.body;
  
  if (gameId) {
    // Limpar apenas um jogo específico
    db.run('DELETE FROM drawn_numbers WHERE game_id = ?', [gameId], (err) => {
      if (err) return res.status(500).json({ error: 'Erro ao limpar rodadas do jogo' });
      res.json({ ok: true, message: 'Rodadas do jogo limpas com sucesso' });
    });
  } else {
    // Limpar todos os jogos
    db.run('DELETE FROM drawn_numbers', (err) => {
      if (err) return res.status(500).json({ error: 'Erro ao limpar rodadas' });
      res.json({ ok: true, message: 'Todas as rodadas foram limpas com sucesso' });
    });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
}); 
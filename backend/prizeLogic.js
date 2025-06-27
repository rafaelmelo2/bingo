const db = require('./db');

// Limites de prêmios por rodada
const PRIZE_LIMITS = {
  quina: 2, // 2 quinas por rodada
  full: 1  // 1 cartela cheia por rodada
};

function getDrawnNumbers(cb) {
  db.all('SELECT number FROM drawn_numbers', [], (err, rows) => {
    if (err) return cb([]);
    cb(rows.map(r => r.number));
  });
}

function countPrizes(type, cb) {
  db.all('SELECT COUNT(*) as count FROM prizes WHERE type = ?', [type], (err, rows) => {
    if (err) return cb(0);
    cb(rows[0].count);
  });
}

function checkAllCardsAndAward(io, gameId, onPrizeCallback) {
  // Buscar todos os números sorteados no jogo atual
  db.all('SELECT number FROM drawn_numbers WHERE game_id = ?', [gameId], (err, drawnRows) => {
    if (err) return;
    const drawnNumbers = drawnRows.map(r => r.number);
    
    // Buscar todas as cartelas do jogo atual
    db.all('SELECT * FROM cards WHERE game_id = ?', [gameId], (err, cardRows) => {
      if (err) return;
      
      cardRows.forEach(cardRow => {
        const card = JSON.parse(cardRow.data);
        const kitId = cardRow.kit_id;
        const cardId = cardRow.id;
        
        // Verificar se já ganhou prêmios nesta cartela
        if (cardRow.quina_awarded && cardRow.full_awarded) return;
        
        // Verificar quina (5 números em linha)
        if (!cardRow.quina_awarded) {
          if (checkQuina(card, drawnNumbers)) {
            awardPrize(io, kitId, cardId, 'quina', gameId, onPrizeCallback);
            db.run('UPDATE cards SET quina_awarded = 1 WHERE id = ?', [cardId]);
          }
        }
        
        // Verificar cartela cheia (todos os números)
        if (!cardRow.full_awarded) {
          if (checkFullCard(card, drawnNumbers)) {
            awardPrize(io, kitId, cardId, 'full', gameId, onPrizeCallback);
            db.run('UPDATE cards SET full_awarded = 1 WHERE id = ?', [cardId]);
          }
        }
      });
    });
  });
}

function checkQuina(card, drawnNumbers) {
  // Verificar linhas horizontais
  for (let row = 0; row < 5; row++) {
    let count = 0;
    for (let col = 0; col < 5; col++) {
      const num = card[col][row];
      if (num === 'FREE' || drawnNumbers.includes(num)) {
        count++;
      }
    }
    if (count === 5) return true;
  }
  
  // Verificar linhas verticais
  for (let col = 0; col < 5; col++) {
    let count = 0;
    for (let row = 0; row < 5; row++) {
      const num = card[col][row];
      if (num === 'FREE' || drawnNumbers.includes(num)) {
        count++;
      }
    }
    if (count === 5) return true;
  }
  
  // Verificar diagonais
  let count1 = 0, count2 = 0;
  for (let i = 0; i < 5; i++) {
    const num1 = card[i][i];
    const num2 = card[i][4-i];
    if (num1 === 'FREE' || drawnNumbers.includes(num1)) count1++;
    if (num2 === 'FREE' || drawnNumbers.includes(num2)) count2++;
  }
  if (count1 === 5 || count2 === 5) return true;
  
  return false;
}

function checkFullCard(card, drawnNumbers) {
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 5; row++) {
      const num = card[col][row];
      if (num !== 'FREE' && !drawnNumbers.includes(num)) {
        return false;
      }
    }
  }
  return true;
}

function awardPrize(io, kitId, cardId, type, gameId, onPrizeCallback) {
  // Verificar se já existe prêmio deste tipo para este kit neste jogo
  db.get('SELECT COUNT(*) as cnt FROM prizes WHERE kit_id = ? AND type = ? AND game_id = ?', [kitId, type, gameId], (err, row) => {
    if (err || row.cnt > 0) return; // Já tem prêmio ou erro
    
    // Inserir prêmio
    db.run('INSERT INTO prizes (kit_id, card_id, type, game_id) VALUES (?, ?, ?, ?)', [kitId, cardId, type, gameId], (err) => {
      if (!err) {
        io.emit('prize', { type, kitId, cardId });
        if (onPrizeCallback) onPrizeCallback();
      }
    });
  });
}

module.exports = { checkAllCardsAndAward }; 
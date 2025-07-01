import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './GamePlay.css';

const socket = io('http://localhost:3001');

function GamePlay({ playerName, kitId, selectedGame, onBackToSelection }) {
  const [cards, setCards] = useState([]);
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [playerPoints, setPlayerPoints] = useState(0);

  const [buyingCard, setBuyingCard] = useState(false);
  const [notification, setNotification] = useState(null);
  const [gameStatus, setGameStatus] = useState('active');
  const [purchaseInfo, setPurchaseInfo] = useState(null);
  const [purchaseTimer, setPurchaseTimer] = useState(null);

  const fetchCards = React.useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:3001/cards/${kitId}?game_id=${selectedGame.game_id}`);
      if (response.ok) {
        const cardsData = await response.json();
        setCards(cardsData);
      }
    } catch (error) {
      console.error('Erro ao buscar cartelas:', error);
    }
  }, [kitId, selectedGame]);

  const fetchDrawnNumbers = React.useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:3001/drawn-numbers/${selectedGame.game_id}`);
      if (response.ok) {
        const data = await response.json();
        setDrawnNumbers(data.map(n => n.number));
      }
    } catch (error) {
      console.error('Erro ao buscar números sorteados:', error);
    }
  }, [selectedGame]);

  const fetchPlayerPoints = React.useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:3001/points/${kitId}`);
      if (response.ok) {
        const data = await response.json();
        setPlayerPoints(data.points || 0);
      }
    } catch (error) {
      console.error('Erro ao buscar pontos:', error);
    }
  }, [kitId]);

  const fetchPurchaseInfo = React.useCallback(async () => {
    if (!selectedGame) return;
    
    try {
      const response = await fetch(`http://localhost:3001/game/${selectedGame.game_id}/purchase-info?kit_id=${kitId}`);
      if (response.ok) {
        const info = await response.json();
        setPurchaseInfo(info);
        
        // Se ainda pode comprar e há tempo restante, iniciar timer
        if (info.can_purchase && info.remaining_time > 0) {
          setPurchaseTimer(info.remaining_time);
        } else {
          setPurchaseTimer(null);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar informações de compra:', error);
    }
  }, [selectedGame, kitId]);

  useEffect(() => {
    if (selectedGame) {
      fetchCards();
      fetchDrawnNumbers();
      fetchPlayerPoints();
      fetchPurchaseInfo();
    }
  }, [selectedGame, fetchCards, fetchDrawnNumbers, fetchPlayerPoints, fetchPurchaseInfo]);

  useEffect(() => {
    // Socket listeners para atualizações em tempo real
    socket.on('number_drawn', (data) => {
      setDrawnNumbers(prev => [...prev, data.number]);
    });

    socket.on('prize_won', (data) => {
      if (data.kit_id === kitId) {
        setNotification({
          type: data.type,
          cardId: data.cardId,
          isWinner: true
        });
        setTimeout(() => setNotification(null), 8000);
      } else {
        // Notificar sobre outros ganhadores
        fetch(`http://localhost:3001/ranking`).then(res => res.json()).then(ranking => {
          const winner = ranking.find(u => u.kit_id === data.kit_id);
          setNotification({
            type: data.type,
            name: winner ? winner.name : 'Desconhecido',
            cardId: data.cardId,
            isWinner: false
          });
          setTimeout(() => setNotification(null), 5000);
        });
      }
    });

    socket.on('game_ended', (data) => {
      if (data.game_id === selectedGame.game_id) {
        setGameStatus('ended');
        setNotification({
          type: 'game_ended',
          message: 'O jogo foi finalizado pelo administrador!'
        });
      }
    });

    return () => {
      socket.off('number_drawn');
      socket.off('prize_won');
      socket.off('game_ended');
    };
  }, [selectedGame, kitId]);

  // Timer para período de compra
  useEffect(() => {
    if (purchaseTimer && purchaseTimer > 0) {
      const interval = setInterval(() => {
        setPurchaseTimer(prev => {
          if (prev <= 1000) {
            // Timer acabou, atualizar informações
            fetchPurchaseInfo();
            return null;
          }
          return prev - 1000;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [purchaseTimer, fetchPurchaseInfo]);

  const handleBuyCard = async () => {
    if (!purchaseInfo?.can_purchase) {
      alert(purchaseInfo?.reason || 'Não é possível comprar cartelas no momento');
      return;
    }

    if (playerPoints < 10) {
      alert('Você precisa de pelo menos 10 pontos para comprar uma cartela!');
      return;
    }

    setBuyingCard(true);
    try {
      const response = await fetch('http://localhost:3001/buy-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kit_id: kitId,
          game_id: selectedGame.game_id
        })
      });

      if (response.ok) {
        const data = await response.json();
        fetchCards();
        fetchPlayerPoints();
        fetchPurchaseInfo();
        alert(`Cartela comprada com sucesso! ID: ${data.card_id}`);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Erro ao comprar cartela');
      }
    } catch (error) {
      alert('Erro ao comprar cartela: ' + error.message);
    } finally {
      setBuyingCard(false);
    }
  };

  const formatTime = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const isNumberMarked = (number) => {
    return drawnNumbers.includes(number);
  };

  const checkCardWin = (card) => {
    if (!card.data) return { quina: false, full: false };
    
    const markedNumbers = card.data.flat().filter(num => isNumberMarked(num));
    const totalNumbers = card.data.flat().length;
    
    return {
      quina: markedNumbers.length >= 5 && !card.quina_awarded,
      full: markedNumbers.length === totalNumbers && !card.full_awarded
    };
  };

  const renderBingoCard = (card, index) => {
    if (!card.data) return null;

    const winStatus = checkCardWin(card);

    return (
      <div key={card.id} className={`bingo-card ${winStatus.quina ? 'quina-won' : ''} ${winStatus.full ? 'full-won' : ''}`}>
        <div className="card-header">
          <h4>Cartela #{card.id}</h4>
          <div className="card-status">
            {card.quina_awarded && <span className="status-badge quina">🏅 Quina</span>}
            {card.full_awarded && <span className="status-badge full">🏆 Cheia</span>}
          </div>
        </div>
        
        <div className="bingo-grid">
          {card.data.map((row, rowIndex) => (
            <div key={rowIndex} className="bingo-row">
              {row.map((number, colIndex) => (
                <div 
                  key={colIndex} 
                  className={`bingo-cell ${isNumberMarked(number) ? 'marked' : ''}`}
                >
                  {number}
                </div>
              ))}
            </div>
          ))}
        </div>
        
        {winStatus.quina && (
          <div className="win-indicator quina">
            🏅 Quina Conquistada!
          </div>
        )}
        
        {winStatus.full && (
          <div className="win-indicator full">
            🏆 Cartela Cheia!
          </div>
        )}
      </div>
    );
  };

  if (gameStatus === 'ended') {
    return (
      <div className="game-play">
        <div className="game-ended">
          <h2>Jogo Finalizado</h2>
          <p>O jogo "{selectedGame.name}" foi finalizado pelo administrador.</p>
          <button onClick={onBackToSelection} className="btn-back">
            Voltar para Seleção de Jogos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-play">
      <div className="game-header">
        <div className="game-info">
          <h2>{selectedGame.name}</h2>
          <p>Jogador: {playerName} | Kit ID: {kitId}</p>
        </div>
        <div className="player-stats">
          <div className="stat-item">
            <span className="stat-label">Pontos</span>
            <span className="stat-value">{playerPoints}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Cartelas</span>
            <span className="stat-value">{cards.length}</span>
          </div>
        </div>
      </div>

      {notification && (
        <div className={`notification ${notification.isWinner ? 'winner' : 'info'}`}>
          <div className="notification-content">
            {notification.isWinner ? (
              <>
                <h3>
                  {notification.type === 'quina' && '🏅 Parabéns! Você fez uma Quina!'}
                  {notification.type === 'full' && '🏆 Parabéns! Você completou a cartela!'}
                </h3>
                <p>Cartela #{notification.cardId}</p>
              </>
            ) : (
              <>
                <h3>
                  {notification.type === 'quina' && '🏅 Quina Conquistada!'}
                  {notification.type === 'full' && '🏆 Cartela Cheia!'}
                </h3>
                <p>{notification.name} ganhou na cartela #{notification.cardId}</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="game-content">
        <div className="left-panel">
          <div className="drawn-numbers-section">
            <h3>Números Sorteados</h3>
            <div className="drawn-numbers">
              {drawnNumbers.length === 0 ? (
                <p>Nenhum número sorteado ainda</p>
              ) : (
                drawnNumbers.map((number, index) => (
                  <span key={index} className="drawn-number">
                    {number}
                  </span>
                ))
              )}
            </div>
            <p className="numbers-count">Total: {drawnNumbers.length} números</p>
          </div>

          <div className="buy-card-section">
            <h3>Comprar Cartela</h3>
            {purchaseInfo && (
              <div className="purchase-info">
                <p>
                  {purchaseInfo.can_purchase 
                    ? `✅ Você pode comprar cartelas! (${purchaseInfo.cards_bought}/${purchaseInfo.max_cards})`
                    : `❌ ${purchaseInfo.reason}`
                  }
                </p>
                {purchaseTimer && purchaseTimer > 0 && (
                  <p className="timer-warning">
                    ⏰ Tempo restante para comprar: <strong>{formatTime(purchaseTimer)}</strong>
                  </p>
                )}
              </div>
            )}
            <p>Cada cartela custa 10 pontos</p>
            <button 
              onClick={handleBuyCard}
              disabled={buyingCard || !purchaseInfo?.can_purchase || playerPoints < 10}
              className="btn-buy-card"
            >
              {buyingCard ? 'Comprando...' : `Comprar Cartela (${playerPoints} pts)`}
            </button>
          </div>

          <button onClick={onBackToSelection} className="btn-back">
            ← Voltar para Seleção
          </button>
        </div>

        <div className="right-panel">
          <h3>Suas Cartelas</h3>
          {cards.length === 0 ? (
            <div className="no-cards">
              <p>Você ainda não tem cartelas neste jogo.</p>
              <p>Compre uma cartela para começar a jogar!</p>
            </div>
          ) : (
            <div className="cards-grid">
              {cards.map((card, index) => renderBingoCard(card, index))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GamePlay; 
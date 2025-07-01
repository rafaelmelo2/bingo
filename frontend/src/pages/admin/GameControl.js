import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './GameControl.css';

const socket = io('http://localhost:3001');

function GameControl({ currentGame, onGameEnded }) {
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [autoDraw, setAutoDraw] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [notification, setNotification] = useState(null);
  const [gameStats, setGameStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchDrawnNumbers = React.useCallback(async () => {
    if (!currentGame) return;
    try {
      const response = await fetch(`http://localhost:3001/drawn-numbers/${currentGame.game_id}`);
      if (response.ok) {
        const data = await response.json();
        setDrawnNumbers(data.map(n => n.number));
      }
    } catch (error) {
      console.error('Erro ao buscar números sorteados:', error);
    }
  }, [currentGame]);

  const fetchGameStats = React.useCallback(async () => {
    if (!currentGame) return;
    try {
      const response = await fetch(`http://localhost:3001/admin/game-stats/${currentGame.game_id}`);
      if (response.ok) {
        const data = await response.json();
        setGameStats(data);
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  }, [currentGame]);

  useEffect(() => {
    if (currentGame) {
      fetchDrawnNumbers();
      fetchGameStats();
    }
  }, [currentGame, fetchDrawnNumbers, fetchGameStats]);

  useEffect(() => {
    socket.on('number_drawn', (data) => {
      setDrawnNumbers(prev => [...prev, data.number]);
    });

    socket.on('prize_won', (data) => {
      fetch(`http://localhost:3001/ranking`).then(res => res.json()).then(ranking => {
        const winner = ranking.find(u => u.kit_id === data.kit_id);
        setNotification({
          type: data.type,
          name: winner ? winner.name : 'Desconhecido',
          cardId: data.cardId
        });
        setIsPaused(true);
        setTimeout(() => {
          setNotification(null);
          setIsPaused(false);
        }, 10000);
      });
    });

    return () => {
      socket.off('number_drawn');
      socket.off('prize_won');
    };
  }, []);

  const handleDrawNumber = async () => {
    if (!currentGame) return;
    
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/admin/draw-number`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: currentGame.game_id })
      });

      if (response.ok) {
        fetchDrawnNumbers();
        fetchGameStats();
      } else {
        alert('Erro ao sortear número');
      }
    } catch (error) {
      alert('Erro ao sortear número: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoDraw = async () => {
    if (!currentGame) return;

    try {
      const response = await fetch(`http://localhost:3001/admin/auto-draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          game_id: currentGame.game_id,
          enabled: !autoDraw 
        })
      });

      if (response.ok) {
        setAutoDraw(!autoDraw);
        alert(autoDraw ? 'Sorteio automático desativado' : 'Sorteio automático ativado');
      } else {
        alert('Erro ao alterar sorteio automático');
      }
    } catch (error) {
      alert('Erro ao alterar sorteio automático: ' + error.message);
    }
  };

  const handleEndGame = async () => {
    if (!currentGame || !window.confirm('Tem certeza que deseja finalizar este jogo?')) return;

    try {
      const response = await fetch(`http://localhost:3001/admin/end-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: currentGame.game_id })
      });

      if (response.ok) {
        onGameEnded && onGameEnded();
        alert('Jogo finalizado com sucesso!');
      } else {
        alert('Erro ao finalizar jogo');
      }
    } catch (error) {
      alert('Erro ao finalizar jogo: ' + error.message);
    }
  };

  const handleResetGame = async () => {
    if (!currentGame || !window.confirm('Tem certeza que deseja resetar este jogo? Isso apagará todos os números sorteados.')) return;

    try {
      const response = await fetch(`http://localhost:3001/admin/reset-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: currentGame.game_id })
      });

      if (response.ok) {
        setDrawnNumbers([]);
        fetchGameStats();
        alert('Jogo resetado com sucesso!');
      } else {
        alert('Erro ao resetar jogo');
      }
    } catch (error) {
      alert('Erro ao resetar jogo: ' + error.message);
    }
  };

  if (!currentGame) {
    return (
      <div className="game-control">
        <div className="no-game">
          <h2>Nenhum Jogo Ativo</h2>
          <p>Não há nenhum jogo em andamento no momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-control">
      <div className="game-header">
        <h2>Controle do Jogo: {currentGame.name}</h2>
        <div className="game-status">
          <span className={`status-indicator ${isPaused ? 'paused' : 'active'}`}>
            {isPaused ? 'Pausado' : 'Ativo'}
          </span>
        </div>
      </div>

      {notification && (
        <div className="notification">
          <div className="notification-content">
            <h3>
              {notification.type === 'quina' && '🏅 Quina Conquistada!'}
              {notification.type === 'full' && '🏆 Cartela Cheia!'}
            </h3>
            <p>{notification.name} ganhou na cartela #{notification.cardId}</p>
          </div>
        </div>
      )}

      <div className="control-panel">
        <div className="control-buttons">
          <button 
            onClick={handleDrawNumber} 
            disabled={loading || isPaused}
            className="btn-draw"
          >
            {loading ? 'Sorteando...' : 'Sortear Número'}
          </button>

          <button 
            onClick={handleToggleAutoDraw}
            className={`btn-auto ${autoDraw ? 'active' : ''}`}
          >
            {autoDraw ? 'Parar Sorteio Automático' : 'Ativar Sorteio Automático'}
          </button>

          <button 
            onClick={handleResetGame}
            className="btn-reset"
          >
            Resetar Jogo
          </button>

          <button 
            onClick={handleEndGame}
            className="btn-end"
          >
            Finalizar Jogo
          </button>
        </div>

        <div className="game-info">
          <div className="info-card">
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

          {gameStats && (
            <div className="info-card">
              <h3>Estatísticas do Jogo</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Jogadores</span>
                  <span className="stat-value">{gameStats.totalPlayers || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Cartelas</span>
                  <span className="stat-value">{gameStats.totalCards || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Quinas</span>
                  <span className="stat-value">{gameStats.quinas || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Cartelas Cheias</span>
                  <span className="stat-value">{gameStats.fullCards || 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GameControl; 
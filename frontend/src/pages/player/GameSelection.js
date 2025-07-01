import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './GameSelection.css';

const socket = io('http://localhost:3001');

function GameSelection({ playerName, kitId, onGameSelected }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState(null);
  const [purchaseInfo, setPurchaseInfo] = useState(null);
  const [purchaseTimer, setPurchaseTimer] = useState(null);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 3000);
    
    // Socket para atualizações em tempo real
    socket.on('game_created', () => {
      fetchGames();
    });
    
    socket.on('game_started', (data) => {
      fetchGames();
      // Se o jogo selecionado foi iniciado, notificar
      if (selectedGame && selectedGame.game_id === data.game_id) {
        onGameSelected && onGameSelected(data);
      }
    });
    
    socket.on('game_ended', (data) => {
      fetchGames();
      // Se o jogo selecionado foi finalizado, limpar seleção
      if (selectedGame && selectedGame.game_id === data.game_id) {
        setSelectedGame(null);
      }
    });

    return () => {
      clearInterval(interval);
      socket.off('game_created');
      socket.off('game_started');
      socket.off('game_ended');
    };
  }, [selectedGame, onGameSelected]);

  // Timer para período de compra
  useEffect(() => {
    if (purchaseTimer && purchaseTimer > 0) {
      const interval = setInterval(() => {
        setPurchaseTimer(prev => {
          if (prev <= 1000) {
            // Timer acabou, atualizar informações
            if (selectedGame) {
              fetchPurchaseInfo(selectedGame.game_id);
            }
            return null;
          }
          return prev - 1000;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [purchaseTimer, selectedGame]);

  const fetchGames = async () => {
    try {
      const response = await fetch('http://localhost:3001/games');
      if (response.ok) {
        const gamesData = await response.json();
        setGames(gamesData);
      }
    } catch (error) {
      console.error('Erro ao buscar jogos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseInfo = async (gameId) => {
    if (!gameId || !kitId) return;
    
    try {
      const response = await fetch(`http://localhost:3001/game/${gameId}/purchase-info?kit_id=${kitId}`);
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
  };

  const handleGameSelect = (game) => {
    setSelectedGame(game);
    if (game.started_at && !game.ended_at) {
      fetchPurchaseInfo(game.game_id);
    } else {
      setPurchaseInfo(null);
      setPurchaseTimer(null);
    }
  };

  const handleJoinGame = React.useCallback(() => {
    if (selectedGame) {
      onGameSelected && onGameSelected(selectedGame);
    }
  }, [selectedGame, onGameSelected]);

  const getStatusText = (game) => {
    if (game.ended_at) return 'Finalizado';
    if (game.started_at) return 'Em andamento';
    if (game.scheduled_time) return 'Agendado';
    return 'Aguardando início';
  };

  const getStatusColor = (game) => {
    if (game.ended_at) return '#dc3545';
    if (game.started_at) return '#28a745';
    if (game.scheduled_time) return '#ffc107';
    return '#6c757d';
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Não agendado';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatTime = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const canJoinGame = (game) => {
    return game.started_at && !game.ended_at;
  };

  if (loading) {
    return (
      <div className="game-selection">
        <div className="loading">
          <div className="spinner"></div>
          <p>Carregando jogos disponíveis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-selection">
      <div className="player-info">
        <h2>Bem-vindo, {playerName}!</h2>
        <p>Seu Kit ID: <strong>{kitId}</strong></p>
      </div>

      <div className="games-section">
        <h3>Jogos Disponíveis</h3>
        
        {games.length === 0 ? (
          <div className="no-games">
            <p>Nenhum jogo disponível no momento.</p>
            <p>Novos jogos aparecerão aqui automaticamente.</p>
          </div>
        ) : (
          <div className="games-grid">
            {games.map(game => (
              <div 
                key={game.game_id} 
                className={`game-card ${selectedGame?.game_id === game.game_id ? 'selected' : ''} ${canJoinGame(game) ? 'joinable' : ''}`}
                onClick={() => handleGameSelect(game)}
              >
                <div className="game-header">
                  <h4>{game.name}</h4>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(game) }}
                  >
                    {getStatusText(game)}
                  </span>
                </div>
                
                <div className="game-info">
                  <p><strong>Tipo:</strong> {game.game_type}</p>
                  <p><strong>Criado em:</strong> {formatDateTime(game.created_at)}</p>
                  {game.scheduled_time && (
                    <p><strong>Agendado para:</strong> {formatDateTime(game.scheduled_time)}</p>
                  )}
                  {game.started_at && (
                    <p><strong>Iniciado em:</strong> {formatDateTime(game.started_at)}</p>
                  )}
                  {game.ended_at && (
                    <p><strong>Finalizado em:</strong> {formatDateTime(game.ended_at)}</p>
                  )}
                </div>

                {canJoinGame(game) && (
                  <div className="join-indicator">
                    <span className="join-badge">🎮 Entrar no Jogo</span>
                    {selectedGame?.game_id === game.game_id && purchaseInfo && (
                      <div className="purchase-timer">
                        <span className="timer-label">⏰ Tempo para comprar cartelas:</span>
                        <span className={`timer-value ${purchaseTimer && purchaseTimer < 10000 ? 'urgent' : ''}`}>
                          {purchaseTimer ? formatTime(purchaseTimer) : 'Encerrado'}
                        </span>
                        <span className="purchase-status">
                          {purchaseInfo.cards_bought}/{purchaseInfo.max_cards} cartelas compradas
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {!game.started_at && !game.ended_at && (
                  <div className="waiting-indicator">
                    <span className="waiting-badge">⏳ Aguardando início</span>
                  </div>
                )}

                {game.ended_at && (
                  <div className="ended-indicator">
                    <span className="ended-badge">🏁 Jogo Finalizado</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedGame && canJoinGame(selectedGame) && (
        <div className="join-section">
          <div className="selected-game-info">
            <h4>Jogo Selecionado: {selectedGame.name}</h4>
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
            <p>Clique em "Entrar no Jogo" para começar a jogar!</p>
          </div>
          <button 
            onClick={handleJoinGame}
            className="btn-join"
          >
            🎮 Entrar no Jogo
          </button>
        </div>
      )}

      {selectedGame && !canJoinGame(selectedGame) && (
        <div className="game-status-info">
          <p>
            {!selectedGame.started_at && !selectedGame.ended_at && 
              "Este jogo ainda não foi iniciado. Aguarde o administrador iniciar o jogo."
            }
            {selectedGame.ended_at && 
              "Este jogo já foi finalizado. Selecione outro jogo ativo."
            }
          </p>
        </div>
      )}
    </div>
  );
}

export default GameSelection; 
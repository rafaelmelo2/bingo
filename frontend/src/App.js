import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';
import AdminPanel from './AdminPanel';
import { useCache, useGamesCache, useRankingCache } from './hooks/useCache';

const socket = io('http://localhost:3001');

function App() {
  const [step, setStep] = useState('login'); // 'login' or 'bingo'
  const [kitId, setKitId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [cards, setCards] = useState([]); // [{id, data, quina_awarded, full_awarded}]
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [rankingState, setRankingState] = useState([]);
  const [points, setPoints] = useState(0);
  const [notification, setNotification] = useState(null);
  const [currentGame, setCurrentGame] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [isGamePaused, setIsGamePaused] = useState(false);
  const [availableGames, setAvailableGames] = useState([]);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [playerPoints, setPlayerPoints] = useState(0);
  const [selectedGame, setSelectedGame] = useState(null);
  const [showPrize, setShowPrize] = useState(false);
  const [prizeInfo, setPrizeInfo] = useState(null);
  const [pauseTimer, setPauseTimer] = useState(null);
  
  // Nova variável para controlar a página atual
  const [currentPage, setCurrentPage] = useState('current-game'); // 'current-game' ou 'upcoming-games'

  // Cache hooks
  const { gamesCache, setGamesToCache, updateGameInCache } = useGamesCache();
  const { rankingCache, setRankingToCache } = useRankingCache();

  // Cache para dados do jogador
  const { data: playerData, refreshData: refreshPlayerData } = useCache(
    'player_data',
    async () => {
      if (!playerName) return null;
      const response = await fetch(`http://localhost:3001/player/${playerName}`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    },
    [playerName]
  );

  // Cache para jogos disponíveis
  const { data: games, loading: gamesLoading, refreshData: refreshGames } = useCache(
    'available_games',
    async () => {
      const response = await fetch('http://localhost:3001/games');
      if (response.ok) {
        const gamesData = await response.json();
        setGamesToCache(gamesData);
        return gamesData;
      }
      return [];
    },
    []
  );

  // Cache para ranking
  const { data: rankingData, loading: rankingLoading, refreshData: refreshRanking } = useCache(
    'ranking',
    async () => {
      const response = await fetch('http://localhost:3001/ranking');
      if (response.ok) {
        const rankingData = await response.json();
        setRankingToCache(rankingData);
        return rankingData;
      }
      return [];
    },
    []
  );

  // Cache para dados do jogo selecionado
  const { data: gameData, loading: gameLoading, refreshData: refreshGameData } = useCache(
    `game_${selectedGame?.id}`,
    async () => {
      if (!selectedGame) return null;
      const response = await fetch(`http://localhost:3001/game/${selectedGame.game_id}`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    },
    [selectedGame?.game_id]
  );

  // Cache para cartelas do jogador
  const { data: playerCards, loading: cardsLoading, refreshData: refreshPlayerCards } = useCache(
    `player_cards_${playerName}_${selectedGame?.game_id}`,
    async () => {
      if (!playerName || !selectedGame) return [];
      const response = await fetch(`http://localhost:3001/player/${playerName}/cards/${selectedGame.game_id}`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    },
    [playerName, selectedGame?.game_id]
  );

  // --- Socket listeners ---
  useEffect(() => {
    socket.on('number_drawn', (data) => {
      setDrawnNumbers(prev => [...prev, data.number]);
    });
    
    socket.on('prize_won', (data) => {
      // Buscar nome do ganhador
      fetch(`http://localhost:3001/ranking`).then(res => res.json()).then(ranking => {
        const winner = ranking.find(u => u.kit_id === data.kit_id);
        setNotification({
          type: data.type,
          name: winner ? winner.name : 'Desconhecido',
          cardId: data.cardId
        });
        setIsGamePaused(true);
        setTimeout(() => {
          setNotification(null);
          setIsGamePaused(false);
        }, 10000);
      });
    });
    
    socket.on('game_updated', (data) => {
      // Atualiza cache do jogo
      updateGameInCache(selectedGame?.game_id, data.game);
      refreshGameData();
    });
    
    return () => {
      socket.off('number_drawn');
      socket.off('prize_won');
      socket.off('game_updated');
    };
  }, [selectedGame]);

  // --- Login com kit existente ---
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!kitId) return;
    
    try {
      const res = await fetch('http://localhost:3001/kit/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kit_id: kitId })
      });
      
      if (res.ok) {
        const data = await res.json();
        setPlayerName(data.name || 'Jogador');
        setStep('bingo');
        fetchAvailableGames();
        fetchPoints(kitId);
        fetchRanking();
        fetchGameHistory();
      } else {
        alert('Kit não encontrado!');
      }
    } catch (error) {
      alert('Erro ao fazer login: ' + error.message);
    }
  };

  // --- Criar novo kit ---
  const handleCreateKit = async (e) => {
    e.preventDefault();
    if (!playerName) return;
    
    try {
      const res = await fetch('http://localhost:3001/kit/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName })
      });
      
      if (res.ok) {
        const data = await res.json();
        setKitId(data.kit_id);
        setStep('bingo');
        fetchAvailableGames();
        fetchPoints(data.kit_id);
        fetchRanking();
        fetchGameHistory();
        alert(`Kit criado com sucesso! Seu código: ${data.kit_id}`);
      } else {
        alert('Erro ao criar kit!');
      }
    } catch (error) {
      alert('Erro ao criar kit: ' + error.message);
    }
  };

  // --- Buscar jogos disponíveis ---
  const fetchAvailableGames = async () => {
    try {
      const res = await fetch('http://localhost:3001/games');
      const data = await res.json();
      setAvailableGames(data);
      
      // Selecionar automaticamente o primeiro jogo ativo
      const activeGame = data.find(game => !game.ended_at);
      if (activeGame) {
        setSelectedGameId(activeGame.game_id);
        setSelectedGame(activeGame);
        setCurrentGame(activeGame);
        fetchCards(kitId, activeGame.game_id);
        fetchDrawnNumbers(activeGame.game_id);
      }
    } catch (error) {
      console.error('Erro ao buscar jogos:', error);
    }
  };

  // --- Selecionar jogo ---
  const handleGameSelection = (gameId) => {
    setSelectedGameId(gameId);
    const game = availableGames.find(g => g.game_id === gameId);
    setSelectedGame(game);
    setCurrentGame(game);
    fetchCards(kitId, gameId);
    fetchDrawnNumbers(gameId);
  };

  // --- Buscar cartelas ---
  const fetchCards = async (kit = kitId, gameId = selectedGameId) => {
    if (!kit || !gameId) return;
    try {
      const res = await fetch(`http://localhost:3001/cards/${kit}?game_id=${gameId}`);
      const data = await res.json();
      setCards(data);
    } catch (error) {
      console.error('Erro ao buscar cartelas:', error);
    }
  };

  // --- Buscar pontos do jogador ---
  const fetchPoints = async (kit = kitId) => {
    if (!kit) return;
    try {
      const res = await fetch(`http://localhost:3001/points/${kit}`);
      const data = await res.json();
      setPlayerPoints(data.points || 0);
      setPoints(data.points || 0);
    } catch (error) {
      console.error('Erro ao buscar pontos:', error);
    }
  };

  // --- Comprar cartela ---
  const handleBuyCard = async () => {
    if (!selectedGameId || playerPoints < 10) {
      alert('Você precisa de pelo menos 10 pontos para comprar uma cartela!');
      return;
    }
    
    try {
      const res = await fetch('http://localhost:3001/buy-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          kit_id: kitId, 
          game_id: selectedGameId 
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setCards(prev => [...prev, { id: data.card_id, data: data.card, quina_awarded: false, full_awarded: false }]);
        setPlayerPoints(prev => prev - 10);
        setPoints(prev => prev - 10);
        alert('Cartela comprada com sucesso!');
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Erro ao comprar cartela');
      }
    } catch (error) {
      alert('Erro ao comprar cartela: ' + error.message);
    }
  };

  // --- Buscar ranking ---
  const fetchRanking = async () => {
    try {
      const res = await fetch('http://localhost:3001/ranking');
      const data = await res.json();
      setRankingState(data);
    } catch (error) {
      console.error('Erro ao buscar ranking:', error);
    }
  };

  // --- Buscar histórico de jogos ---
  const fetchGameHistory = async () => {
    try {
      const res = await fetch('http://localhost:3001/games/history');
      const data = await res.json();
      setGameHistory(data);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
  };

  // --- Buscar números sorteados ---
  const fetchDrawnNumbers = async (gameId) => {
    if (!gameId) return;
    try {
      const res = await fetch(`http://localhost:3001/drawn-numbers/${gameId}`);
      const data = await res.json();
      setDrawnNumbers(data.map(n => n.number));
    } catch (error) {
      console.error('Erro ao buscar números sorteados:', error);
    }
  };

  // --- Login administrativo ---
  const handleAdminLogin = (adminName, password) => {
    if (adminName === 'admin' && password === 'admin123') {
      setIsAdmin(true);
    } else {
      alert('Credenciais inválidas!');
    }
  };

  // --- Atualizar pontos periodicamente ---
  useEffect(() => {
    if (kitId) {
      const interval = setInterval(() => {
        fetchPoints(kitId);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [kitId]);

  // --- Atualizar ranking periodicamente ---
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRanking();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // --- Atualizar números sorteados periodicamente ---
  useEffect(() => {
    if (selectedGameId) {
      const interval = setInterval(() => {
        fetchDrawnNumbers(selectedGameId);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [selectedGameId]);

  // --- Atualizar cartelas periodicamente ---
  useEffect(() => {
    if (kitId && selectedGameId) {
      const interval = setInterval(() => {
        fetchCards(kitId, selectedGameId);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [kitId, selectedGameId]);

  return (
    <div className="App">
      {/* Notificação central de prêmio */}
      {notification && (
        <div className="prize-notification">
          <div className="prize-content">
            <div className="prize-icon">
              {notification.type === 'quina' && '🏅'}
              {notification.type === 'full' && '🏆'}
            </div>
            <div className="prize-text">
              <h2>
                {notification.type === 'quina' && 'QUINA CONQUISTADA!'}
                {notification.type === 'full' && 'CARTELA CHEIA!'}
              </h2>
              <p>{notification.name} ganhou na cartela #{notification.cardId}</p>
              <div className="pause-indicator">
                <span>Jogo pausado por 10 segundos...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'login' && (
        <div className="login-container">
          <div className="login-section">
            <h3>Entrar com Kit Existente</h3>
            <form onSubmit={handleLogin} className="login-form">
              <input
                type="text"
                value={kitId}
                onChange={e => setKitId(e.target.value)}
                placeholder="Digite seu código do kit (xxxx-xxxx-xxxx)"
                required
                pattern="[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}"
                title="Formato: xxxx-xxxx-xxxx"
              />
              <button type="submit">Entrar</button>
            </form>
          </div>

          <div className="login-section">
            <h3>Criar Novo Kit</h3>
            <form onSubmit={handleCreateKit} className="login-form">
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Seu nome"
                required
              />
              <button type="submit">Criar Kit</button>
            </form>
          </div>
        </div>
      )}

      {step === 'bingo' && (
        <div className="game-container">
          {/* Header com informações do jogador */}
          <div className="game-header">
            <div className="player-info">
              <h2>Olá, {playerName}!</h2>
              <div className="player-stats">
                <span className="kit-id">Kit: {kitId}</span>
                <span className="points">Pontos: {playerPoints}</span>
              </div>
            </div>
            
            {/* Navegação entre páginas */}
            <div className="page-navigation">
              <button 
                className={`nav-btn ${currentPage === 'current-game' ? 'active' : ''}`}
                onClick={() => setCurrentPage('current-game')}
              >
                🎮 Jogo Atual
              </button>
              <button 
                className={`nav-btn ${currentPage === 'upcoming-games' ? 'active' : ''}`}
                onClick={() => setCurrentPage('upcoming-games')}
              >
                📅 Próximos Jogos
              </button>
            </div>
          </div>

          {/* Página do Jogo Atual */}
          {currentPage === 'current-game' && (
            <div className="current-game-page">
              {/* Ranking apenas na página do jogo atual */}
              <div className="ranking-section">
                <h3>🏆 Ranking do Jogo Atual</h3>
                <div className="ranking-container">
                  {rankingLoading ? (
                    <div className="loading">Carregando ranking...</div>
                  ) : (
                    <div className="ranking-list">
                      {rankingState?.slice(0, 10).map((player, i) => (
                        <div key={player.kit_id} className={`ranking-item ${player.kit_id === kitId ? 'current-player' : ''}`}>
                          <span className="rank">#{i + 1}</span>
                          <span className="name">{player.name || 'Jogador'}</span>
                          <span className="points">{player.points} pts</span>
                          <span className="cards">({player.cards_count} cartelas)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Informações do jogo atual */}
              <div className="game-status">
                {/* Seleção de Jogo */}
                <div className="game-selection">
                  <h3>🎮 Selecionar Jogo</h3>
                  {gamesLoading ? (
                    <div className="loading">Carregando jogos...</div>
                  ) : (
                    <div className="games-selector">
                      {games?.filter(game => !game.ended_at).map((game) => (
                        <div 
                          key={game.game_id} 
                          className={`game-option ${selectedGameId === game.game_id ? 'selected' : ''}`}
                          onClick={() => handleGameSelection(game.game_id)}
                        >
                          <div className="game-info">
                            <h4>{game.name}</h4>
                            <div className="game-details">
                              <span className="game-type">
                                {game.game_type === 'manual' && '🎲 Manual'}
                                {game.game_type === 'auto' && '⚡ Automático'}
                                {game.game_type === 'scheduled' && '⏰ Agendado'}
                              </span>
                              {game.scheduled_time && (
                                <span className="scheduled-time">
                                  Início: {new Date(game.scheduled_time).toLocaleString('pt-BR')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="game-status-badge">
                            {selectedGameId === game.game_id ? 'Ativo' : 'Disponível'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {currentGame && (
                  <div className="current-game">
                    <h3>🎮 Jogo Atual: {currentGame.name}</h3>
                    <div className="game-info-display">
                      <div className="game-type-info">
                        <span>Tipo: </span>
                        <span className="type-badge">
                          {currentGame.game_type === 'manual' && '🎲 Manual - Você controla o sorteio'}
                          {currentGame.game_type === 'auto' && '⚡ Automático - Sorteio a cada 3s'}
                          {currentGame.game_type === 'scheduled' && '⏰ Agendado - Inicia automaticamente'}
                        </span>
                      </div>
                      {currentGame.scheduled_time && (
                        <div className="scheduled-info">
                          <span>Início agendado: {new Date(currentGame.scheduled_time).toLocaleString('pt-BR')}</span>
                        </div>
                      )}
                      <div className="drawn-number-display">
                        <span>Último número:</span>
                        <span className="drawn-number">{drawnNumbers.slice(-1)[0] || 'Aguardando...'}</span>
                      </div>
                      {isGamePaused && (
                        <div className="game-paused">
                          ⏸️ Jogo pausado - Prêmio em andamento
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="game-actions">
                  <button onClick={handleBuyCard} className="buy-card-btn" disabled={!selectedGameId || playerPoints < 10}>
                    Comprar Cartela (-10 pts) - Seus pontos: {playerPoints}
                  </button>
                </div>
              </div>

              {/* Cartelas */}
              <div className="cards-section">
                <h3>📋 Suas Cartelas</h3>
                {cardsLoading ? (
                  <div className="loading">Carregando cartelas...</div>
                ) : (
                  <div className="cards-grid">
                    {playerCards?.map((cardObj) => (
                      <div key={cardObj.id} className="bingo-card-container">
                        <div className="card-header">
                          <h4>Cartela #{cardObj.id}</h4>
                          <div className="prize-labels">
                            {cardObj.quina_awarded && <span className="prize-label quina">🏅</span>}
                            {cardObj.full_awarded && <span className="prize-label full">🏆</span>}
                          </div>
                        </div>
                        <table className="bingo-card">
                          <thead>
                            <tr>
                              <th>B</th><th>I</th><th>N</th><th>G</th><th>O</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array(5).fill(0).map((_, row) => (
                              <tr key={row}>
                                {Array(5).fill(0).map((_, col) => {
                                  const value = cardObj.data[col][row];
                                  const isDrawn = drawnNumbers.includes(value) || value === 'FREE';
                                  return (
                                    <td
                                      key={col}
                                      className={isDrawn ? 'drawn' : ''}
                                    >
                                      {value}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Página de Próximos Jogos */}
          {currentPage === 'upcoming-games' && (
            <div className="upcoming-games-page">
              <h3>📅 Próximos Jogos</h3>
              <div className="games-list">
                {gamesLoading ? (
                  <div className="loading">Carregando jogos...</div>
                ) : (
                  <div className="games-grid">
                    {games?.map((game, index) => (
                      <div key={game.game_id} className="game-item">
                        <div className="game-info">
                          <h4>{game.name}</h4>
                          <div className="game-details">
                            <span className="game-type">
                              {game.game_type === 'manual' && '🎲 Manual'}
                              {game.game_type === 'auto' && '⚡ Automático'}
                              {game.game_type === 'scheduled' && '⏰ Agendado'}
                            </span>
                            <span className="game-date">
                              Criado: {new Date(game.created_at).toLocaleDateString('pt-BR')}
                            </span>
                            {game.scheduled_time && (
                              <span className="scheduled-time">
                                Início: {new Date(game.scheduled_time).toLocaleString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="game-status-badge">
                          {game.ended_at ? 'Finalizado' : game.started_at ? 'Em andamento' : 'Aguardando'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notificação de prêmio */}
      {showPrize && (
        <div className="prize-overlay">
          <div className="prize-content">
            <div className="prize-icon">🎉</div>
            <div className="prize-text">
              <h2>Parabéns!</h2>
              <p>{prizeInfo?.message || 'Você ganhou um prêmio!'}</p>
              {pauseTimer > 0 && (
                <div className="pause-indicator">
                  Pausa: {pauseTimer}s
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Painel administrativo */}
      {isAdmin && <AdminPanel />}
    </div>
  );
}

export default App; 
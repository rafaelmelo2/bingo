import React, { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import './AdminPage.css';
import { useCache, useStatsCache } from '../hooks/useCache';

const socket = io('http://localhost:3001');

function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentGame, setCurrentGame] = useState(null);
  const [kits, setKits] = useState([]);
  const [cards, setCards] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [autoDraw, setAutoDraw] = useState(false);
  const [autoInterval, setAutoInterval] = useState(null);
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [newGameName, setNewGameName] = useState('');
  const [newGameType, setNewGameType] = useState('manual');
  const [scheduledTime, setScheduledTime] = useState('');
  const [selectedGameForStats, setSelectedGameForStats] = useState('all');
  const [gameStats, setGameStats] = useState(null);
  const [gamePlayers, setGamePlayers] = useState([]);
  const [kitsWithPoints, setKitsWithPoints] = useState([]);
  const [pointsToGive, setPointsToGive] = useState('');
  const [pointsReason, setPointsReason] = useState('');
  const [selectedKitForPoints, setSelectedKitForPoints] = useState('');
  const [isAutoMode, setIsAutoMode] = useState(false);

  const ADMIN_PASSWORD = 'admin123';

  // Cache hooks
  const { getStatsFromCache, setStatsToCache, clearStatsCache } = useStatsCache();

  // Cache para jogos disponíveis
  const { data: games, loading: gamesLoading, refreshData: refreshGames } = useCache(
    'admin_games',
    async () => {
      const response = await fetch('http://localhost:3001/games');
      if (response.ok) {
        return await response.json();
      }
      return [];
    },
    []
  );

  // Cache para jogadores
  const { data: players, loading: playersLoading, refreshData: refreshPlayers } = useCache(
    'admin_players',
    async () => {
      const response = await fetch('http://localhost:3001/players');
      if (response.ok) {
        return await response.json();
      }
      return [];
    },
    []
  );

  // Cache para estatísticas
  const { data: stats, loading: statsLoading, refreshData: refreshStats } = useCache(
    `admin_stats_${selectedGameForStats}`,
    async () => {
      const url = selectedGameForStats === 'all' 
        ? 'http://localhost:3001/stats' 
        : `http://localhost:3001/stats/${selectedGameForStats}`;
      const response = await fetch(url);
      if (response.ok) {
        const statsData = await response.json();
        setStatsToCache(selectedGameForStats, statsData);
        return statsData;
      }
      return {};
    },
    [selectedGameForStats]
  );

  // Cache para jogadores por jogo
  const { data: gamePlayersCache, loading: gamePlayersLoading, refreshData: refreshGamePlayers } = useCache(
    `admin_game_players_${selectedGameForStats}`,
    async () => {
      if (selectedGameForStats === 'all') return [];
      const response = await fetch(`http://localhost:3001/game/${selectedGameForStats}/players`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    },
    [selectedGameForStats]
  );

  // Cache para histórico de jogos
  const { data: history, loading: historyLoading, refreshData: refreshHistory } = useCache(
    'admin_history',
    async () => {
      const response = await fetch('http://localhost:3001/games/history');
      if (response.ok) {
        return await response.json();
      }
      return [];
    },
    []
  );

  // Cache para kits
  const { data: kitsCache, loading: kitsLoading, refreshData: refreshKits } = useCache(
    'admin_kits',
    async () => {
      const response = await fetch('http://localhost:3001/kits');
      if (response.ok) {
        return await response.json();
      }
      return [];
    },
    []
  );

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      alert('Senha incorreta!');
    }
  };

  // Funções fetch com useCallback para evitar recriação
  const fetchCurrentGame = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/game/current');
      const data = await res.json();
      setCurrentGame(data.game_id ? data : null);
      if (data.game_id) {
        fetchDrawnNumbers(data.game_id);
      }
    } catch (error) {
      console.error('Erro ao buscar jogo atual:', error);
    }
  }, []);

  const fetchDrawnNumbers = useCallback(async (gameId) => {
    try {
      const res = await fetch(`http://localhost:3001/drawn-numbers/${gameId}`);
      const data = await res.json();
      setDrawnNumbers(data.map(n => n.number));
    } catch (error) {
      console.error('Erro ao buscar números sorteados:', error);
    }
  }, []);

  const fetchKits = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/admin/kits');
      const data = await res.json();
      setKits(data.kits);
      setCards(data.cards);
    } catch (error) {
      console.error('Erro ao buscar kits:', error);
    }
  }, []);

  const fetchKitsWithPoints = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/admin/kits-with-points');
      const data = await res.json();
      setKitsWithPoints(data);
    } catch (error) {
      console.error('Erro ao buscar kits com pontos:', error);
    }
  }, []);

  const fetchGameHistory = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/games/history');
      const data = await res.json();
      setGameHistory(data);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
  }, []);

  const fetchGameStats = useCallback(async (gameId) => {
    if (!gameId) return;
    try {
      const res = await fetch(`http://localhost:3001/admin/game-stats/${gameId}`);
      const data = await res.json();
      setGameStats(data);
    } catch (error) {
      console.error('Erro ao buscar estatísticas do jogo:', error);
    }
  }, []);

  const fetchGamePlayers = useCallback(async (gameId) => {
    if (!gameId) return;
    try {
      const res = await fetch(`http://localhost:3001/admin/game-players/${gameId}`);
      const data = await res.json();
      setGamePlayers(data);
    } catch (error) {
      console.error('Erro ao buscar jogadores do jogo:', error);
    }
  }, []);

  // Buscar dados iniciais
  useEffect(() => {
    if (isAuthenticated) {
      fetchCurrentGame();
      fetchKits();
      fetchKitsWithPoints();
      fetchGameHistory();
    }
  }, [isAuthenticated, fetchCurrentGame, fetchKits, fetchKitsWithPoints, fetchGameHistory]);

  // Limpar intervalo quando componente for desmontado
  useEffect(() => {
    return () => {
      if (autoInterval) {
        clearInterval(autoInterval);
      }
    };
  }, [autoInterval]);

  useEffect(() => {
    if (currentGame) {
      setDrawnNumbers(currentGame.drawn_numbers || []);
    }
  }, [currentGame]);

  const startNewGame = async () => {
    try {
      const gameData = {
        name: newGameName,
        gameType: newGameType,
        scheduledTime: newGameType === 'scheduled' ? scheduledTime : null
      };

      const res = await fetch('http://localhost:3001/admin/start-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameData)
      });
      const data = await res.json();
      setCurrentGame(data);
      setDrawnNumbers([]);
      setNewGameName('');
      setNewGameType('manual');
      setScheduledTime('');
      fetchGameHistory();
    } catch (error) {
      console.error('Erro ao iniciar jogo:', error);
    }
  };

  const drawNumber = () => {
    socket.emit('draw-number');
  };

  const toggleAutoDraw = () => {
    const newState = !autoDraw;
    setAutoDraw(newState);
    socket.emit('admin-auto-draw', newState);
  };

  const resetGame = async () => {
    if (!window.confirm('Tem certeza que deseja resetar o jogo? Isso apagará todos os dados.')) return;
    
    try {
      await fetch('http://localhost:3001/admin/reset', { method: 'POST' });
      setCurrentGame(null);
      setDrawnNumbers([]);
      setAutoDraw(false);
      fetchKits();
      fetchKitsWithPoints();
      fetchGameHistory();
    } catch (error) {
      console.error('Erro ao resetar jogo:', error);
    }
  };

  const givePoints = async () => {
    if (!selectedKitForPoints || !pointsToGive) {
      alert('Selecione um kit e digite a quantidade de pontos!');
      return;
    }

    try {
      const res = await fetch('http://localhost:3001/admin/give-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kit_id: selectedKitForPoints,
          points: parseInt(pointsToGive),
          reason: pointsReason
        })
      });
      const data = await res.json();
      if (data.ok) {
        alert(`Pontos dados com sucesso! ${pointsToGive} pontos adicionados.`);
        setPointsToGive('');
        setPointsReason('');
        setSelectedKitForPoints('');
        fetchKitsWithPoints();
      }
    } catch (error) {
      alert('Erro ao dar pontos: ' + error.message);
    }
  };

  const removePoints = async () => {
    if (!selectedKitForPoints || !pointsToGive) {
      alert('Selecione um kit e digite a quantidade de pontos!');
      return;
    }

    try {
      const res = await fetch('http://localhost:3001/admin/remove-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kit_id: selectedKitForPoints,
          points: parseInt(pointsToGive),
          reason: pointsReason
        })
      });
      const data = await res.json();
      if (data.ok) {
        alert(`Pontos removidos com sucesso! ${pointsToGive} pontos removidos.`);
        setPointsToGive('');
        setPointsReason('');
        setSelectedKitForPoints('');
        fetchKitsWithPoints();
      }
    } catch (error) {
      alert('Erro ao remover pontos: ' + error.message);
    }
  };

  const handleGameStatsChange = (gameId) => {
    setSelectedGameForStats(gameId);
    if (gameId) {
      fetchGameStats(gameId);
      fetchGamePlayers(gameId);
    } else {
      setGameStats(null);
      setGamePlayers([]);
    }
  };

  const handleCreateGame = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const gameData = {
      name: formData.get('gameName'),
      type: formData.get('gameType'),
      scheduled_time: formData.get('scheduledTime') || null
    };

    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameData)
      });

      if (response.ok) {
        const newGame = await response.json();
        setCurrentGame(newGame);
        refreshGames();
        clearStatsCache(); // Limpa cache de estatísticas
        e.target.reset();
      }
    } catch (error) {
      console.error('Erro ao criar jogo:', error);
    }
  };

  const handleStartGame = async () => {
    if (!currentGame) return;

    try {
      const response = await fetch(`http://localhost:3001/game/${currentGame.game_id}/start`, {
        method: 'POST'
      });

      if (response.ok) {
        alert('Jogo iniciado com sucesso!');
        
        // Se for automático, verificar status
        if (currentGame.auto_draw) {
          const statusResponse = await fetch('http://localhost:3001/admin/auto-status');
          if (statusResponse.ok) {
            const status = await statusResponse.json();
            setIsAutoMode(status.isActive);
          }
        }
        
        refreshGames();
      } else {
        alert('Erro ao iniciar jogo');
      }
    } catch (error) {
      console.error('Erro ao iniciar jogo:', error);
      alert('Erro ao iniciar jogo');
    }
  };

  const handleDrawNumber = async () => {
    if (!currentGame) return;

    try {
      const response = await fetch(`http://localhost:3001/game/${currentGame.game_id}/draw`, {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        setDrawnNumbers(prev => [...prev, result.number]);
        
        // Atualiza cache do jogo atual
        const updatedGame = { ...currentGame, drawn_numbers: [...drawnNumbers, result.number] };
        setCurrentGame(updatedGame);
        
        // Limpa cache de estatísticas para atualizar
        clearStatsCache(selectedGameForStats);
      } else {
        alert('Erro ao sortear número');
      }
    } catch (error) {
      console.error('Erro ao sortear número:', error);
      alert('Erro ao sortear número');
    }
  };

  const handleAutoMode = async () => {
    if (isAutoMode) {
      // Parar modo automático
      try {
        const response = await fetch('http://localhost:3001/admin/stop-auto', {
          method: 'POST'
        });
        
        if (response.ok) {
          clearInterval(autoInterval);
          setIsAutoMode(false);
          setAutoInterval(null);
          alert('Modo automático parado!');
        }
      } catch (error) {
        console.error('Erro ao parar modo automático:', error);
      }
    } else {
      // Iniciar modo automático
      if (!currentGame) {
        alert('Selecione um jogo primeiro!');
        return;
      }
      
      try {
        const response = await fetch(`http://localhost:3001/game/${currentGame.game_id}/start`, {
          method: 'POST'
        });
        
        if (response.ok) {
          setIsAutoMode(true);
          alert('Modo automático iniciado!');
        } else {
          alert('Erro ao iniciar modo automático');
        }
      } catch (error) {
        console.error('Erro ao iniciar modo automático:', error);
        alert('Erro ao iniciar modo automático');
      }
    }
  };

  const handleResetGame = async () => {
    if (!currentGame) return;

    try {
      const response = await fetch(`http://localhost:3001/game/${currentGame.game_id}/reset`, {
        method: 'POST'
      });

      if (response.ok) {
        setDrawnNumbers([]);
        setCurrentGame({ ...currentGame, drawn_numbers: [] });
        clearStatsCache();
        alert('Jogo resetado com sucesso!');
      } else {
        alert('Erro ao resetar jogo');
      }
    } catch (error) {
      console.error('Erro ao resetar jogo:', error);
      alert('Erro ao resetar jogo');
    }
  };

  const handleGameSelect = (game) => {
    setCurrentGame(game);
    setDrawnNumbers(game.drawn_numbers || []);
  };

  const handleStatsGameChange = (gameId) => {
    setSelectedGameForStats(gameId);
    // Limpa cache específico do jogo anterior
    if (selectedGameForStats !== gameId) {
      clearStatsCache(selectedGameForStats);
    }
  };

  const clearAllCache = () => {
    clearStatsCache();
    localStorage.removeItem('bingo_cache_admin_games');
    localStorage.removeItem('bingo_cache_admin_players');
    localStorage.removeItem('bingo_cache_admin_history');
    localStorage.removeItem('bingo_cache_admin_kits');
    refreshGames();
    refreshPlayers();
    refreshHistory();
    refreshKits();
  };

  // Nova função para limpar rodadas
  const clearRounds = async (gameId = null) => {
    try {
      const response = await fetch('http://localhost:3001/admin/clear-rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message || 'Rodadas limpas com sucesso!');
        
        // Atualizar dados
        if (currentGame) {
          fetchDrawnNumbers(currentGame.game_id);
        }
        refreshGames();
        clearStatsCache();
      } else {
        alert('Erro ao limpar rodadas');
      }
    } catch (error) {
      console.error('Erro ao limpar rodadas:', error);
      alert('Erro ao limpar rodadas');
    }
  };

  // Função para sincronizar com o backend
  const syncWithBackend = async () => {
    try {
      // Buscar jogo atual do backend
      const gameResponse = await fetch('http://localhost:3001/game/current');
      if (gameResponse.ok) {
        const gameData = await gameResponse.json();
        if (gameData.game_id) {
          setCurrentGame(gameData);
          fetchDrawnNumbers(gameData.game_id);
        }
      }

      // Atualizar todos os caches
      refreshGames();
      refreshPlayers();
      refreshHistory();
      refreshKits();
      refreshStats();
      
      alert('Sincronização concluída!');
    } catch (error) {
      console.error('Erro na sincronização:', error);
      alert('Erro na sincronização');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-login">
        <h2>🔐 Painel Administrativo</h2>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha de administrador"
            required
          />
          <button type="submit">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>🎮 Painel Administrativo</h1>
        <div className="admin-controls">
          <button onClick={syncWithBackend} className="sync-btn">
            🔄 Sincronizar
          </button>
          <button onClick={clearAllCache} className="clear-cache-btn">
            🗑️ Limpar Cache
          </button>
        </div>
      </div>

      <div className="admin-content">
        {/* Controle de Jogos */}
        <div className="admin-section">
          <h2>🎯 Controle de Jogos</h2>
          
          <div className="game-status">
            <h3>Jogo Atual</h3>
            {currentGame ? (
              <div>
                <p><strong>Nome:</strong> {currentGame.name}</p>
                <p><strong>Tipo:</strong> {currentGame.game_type}</p>
                <p><strong>Status:</strong> {currentGame.ended_at ? 'Finalizado' : 'Ativo'}</p>
                <p><strong>Números Sorteados:</strong> {drawnNumbers.length}</p>
              </div>
            ) : (
              <p>Nenhum jogo selecionado</p>
            )}
          </div>

          <form onSubmit={handleCreateGame} className="game-form">
            <h3>Criar Novo Jogo</h3>
            <input
              type="text"
              name="gameName"
              placeholder="Nome do jogo"
              required
            />
            <select name="gameType" required>
              <option value="">Selecione o tipo</option>
              <option value="manual">Manual</option>
              <option value="auto">Automático</option>
              <option value="scheduled">Agendado</option>
            </select>
            <input
              type="datetime-local"
              name="scheduledTime"
              placeholder="Horário agendado (opcional)"
            />
            <button type="submit">Criar Jogo</button>
          </form>

          <div className="game-controls">
            <button onClick={handleStartGame} className="start-btn" disabled={!currentGame}>
              ▶️ Iniciar Jogo
            </button>
            <button onClick={handleDrawNumber} className="draw-btn" disabled={!currentGame}>
              🎲 Sortear Número
            </button>
            <button onClick={handleAutoMode} className={`auto-btn ${isAutoMode ? 'active' : ''}`}>
              {isAutoMode ? '⏸️ Parar Auto' : '🔄 Modo Auto'}
            </button>
            <button onClick={handleResetGame} className="reset-btn" disabled={!currentGame}>
              🔄 Resetar Jogo
            </button>
          </div>

          <div className="drawn-numbers">
            <h3>Números Sorteados</h3>
            <div className="numbers-grid">
              {drawnNumbers.map((num, index) => (
                <span key={index} className="drawn-number">{num}</span>
              ))}
            </div>
          </div>

          <div className="games-list">
            <h3>Jogos Disponíveis</h3>
            {gamesLoading ? (
              <div className="loading">Carregando jogos...</div>
            ) : (
              <div className="games-grid">
                {games?.map(game => (
                  <div 
                    key={game.game_id} 
                    className={`game-item ${currentGame?.game_id === game.game_id ? 'selected' : ''}`}
                    onClick={() => handleGameSelect(game)}
                  >
                    <h4>{game.name}</h4>
                    <p>Tipo: {game.game_type}</p>
                    <p>Status: {game.ended_at ? 'Finalizado' : 'Ativo'}</p>
                    {game.scheduled_time && (
                      <p>Agendado: {new Date(game.scheduled_time).toLocaleString()}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Seção de Limpeza de Rodadas */}
        <div className="admin-section">
          <h2>🧹 Limpeza de Rodadas</h2>
          
          <div className="rounds-management">
            <div className="rounds-info">
              <p><strong>Limpar rodadas</strong> remove apenas os números sorteados, mantendo cartelas e prêmios.</p>
            </div>
            
            <div className="rounds-controls">
              <button 
                onClick={() => clearRounds()} 
                className="clear-all-rounds-btn"
              >
                🗑️ Limpar Todas as Rodadas
              </button>
              
              {currentGame && (
                <button 
                  onClick={() => clearRounds(currentGame.game_id)} 
                  className="clear-game-rounds-btn"
                >
                  🎯 Limpar Rodadas do Jogo Atual
                </button>
              )}
            </div>
            
            <div className="rounds-warning">
              <p>⚠️ <strong>Atenção:</strong> Esta ação não pode ser desfeita!</p>
            </div>
          </div>
        </div>

        {/* Administração de Pontos */}
        <div className="admin-section">
          <h2>💰 Administração de Pontos</h2>
          
          <div className="points-management">
            <form className="points-form">
              <select 
                value={selectedKitForPoints} 
                onChange={(e) => setSelectedKitForPoints(e.target.value)}
                required
              >
                <option value="">Selecione um kit...</option>
                {kitsWithPoints.map(kit => (
                  <option key={kit.kit_id} value={kit.kit_id}>
                    {kit.kit_id} - {kit.name || 'Sem nome'} ({kit.total_points} pts)
                  </option>
                ))}
              </select>
              
              <input
                type="number"
                value={pointsToGive}
                onChange={(e) => setPointsToGive(e.target.value)}
                placeholder="Quantidade de pontos"
                required
              />
              
              <input
                type="text"
                value={pointsReason}
                onChange={(e) => setPointsReason(e.target.value)}
                placeholder="Motivo (opcional)"
              />
              
              <div className="points-buttons">
                <button type="button" onClick={givePoints} className="give-points-btn">
                  ➕ Dar Pontos
                </button>
                <button type="button" onClick={removePoints} className="remove-points-btn">
                  ➖ Remover Pontos
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="admin-section">
          <h2>📊 Estatísticas</h2>
          
          <div className="game-stats-selector">
            <select 
              value={selectedGameForStats} 
              onChange={(e) => handleStatsGameChange(e.target.value)}
            >
              <option value="all">Todos os Jogos</option>
              {games?.map(game => (
                <option key={game.game_id} value={game.game_id}>
                  {game.name}
                </option>
              ))}
            </select>
          </div>

          {statsLoading ? (
            <div className="loading">Carregando estatísticas...</div>
          ) : (
            <div className="game-stats">
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Total de Jogadores</h3>
                  <div className="stat-number">{stats?.totalPlayers || 0}</div>
                </div>
                <div className="stat-card">
                  <h3>Total de Cartelas</h3>
                  <div className="stat-number">{stats?.totalCards || 0}</div>
                </div>
                <div className="stat-card">
                  <h3>Prêmios Distribuídos</h3>
                  <div className="stat-number">{(stats?.totalQuinas || 0) + (stats?.totalFulls || 0)}</div>
                </div>
                <div className="stat-card">
                  <h3>Pontos em Jogo</h3>
                  <div className="stat-number">{stats?.totalPoints || 0}</div>
                </div>
              </div>
            </div>
          )}

          <div className="game-players">
            <h4>Jogadores por Jogo</h4>
            {gamePlayersLoading ? (
              <div className="loading">Carregando jogadores...</div>
            ) : (
              <div className="players-list">
                {gamePlayers?.map((player, index) => (
                  <div key={player.kit_id} className="player-item">
                    <span className="player-rank">#{index + 1}</span>
                    <span className="player-name">{player.name}</span>
                    <span className="player-kit">Kit: {player.kit_id}</span>
                    <span className="player-cards">Cartelas: {player.cards_count}</span>
                    <span className="player-points">Pontos: {player.points}</span>
                    <span className="player-prizes">Prêmios: {(player.quinas || 0) + (player.fulls || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Histórico de Jogos */}
        <div className="admin-section">
          <h2>📜 Histórico de Jogos</h2>
          
          {historyLoading ? (
            <div className="loading">Carregando histórico...</div>
          ) : (
            <div className="history-list">
              {history?.map(game => (
                <div key={game.game_id} className="history-item">
                  <div className="game-info">
                    <strong>{game.name}</strong>
                    <span className="game-type">{game.game_type}</span>
                  </div>
                  <div className="game-dates">
                    <div>Criado: {new Date(game.created_at).toLocaleString()}</div>
                    {game.started_at && (
                      <div>Iniciado: {new Date(game.started_at).toLocaleString()}</div>
                    )}
                    {game.ended_at && (
                      <div>Finalizado: {new Date(game.ended_at).toLocaleString()}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lista de Kits */}
        <div className="admin-section">
          <h2>🎁 Kits Disponíveis</h2>
          
          {kitsLoading ? (
            <div className="loading">Carregando kits...</div>
          ) : (
            <div className="kits-list">
              {kitsCache?.map(kit => (
                <div key={kit.kit_id} className="kit-item">
                  <div className="kit-info">
                    <strong>Kit #{kit.kit_id}</strong>
                    <p>Proprietário: {kit.name || 'Não atribuído'}</p>
                  </div>
                  <div className="kit-stats">
                    <span>Pontos: {kit.total_points}</span>
                    <span>Cartelas: {kit.cards_count}</span>
                    <span>Prêmios: {(kit.quinas || 0) + (kit.fulls || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPage; 
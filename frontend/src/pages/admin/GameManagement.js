import React, { useState, useEffect } from 'react';
import './GameManagement.css';

function GameManagement({ onGameCreated, onGameStarted }) {
  const [games, setGames] = useState([]);
  const [newGameName, setNewGameName] = useState('');
  const [newGameType, setNewGameType] = useState('manual');
  const [scheduledTime, setScheduledTime] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchGames = async () => {
    try {
      const response = await fetch('http://localhost:3001/games');
      if (response.ok) {
        const gamesData = await response.json();
        setGames(gamesData);
      }
    } catch (error) {
      console.error('Erro ao buscar jogos:', error);
    }
  };

  const handleCreateGame = async (e) => {
    e.preventDefault();
    if (!newGameName.trim()) {
      alert('Digite um nome para o jogo');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/admin/start-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGameName,
          gameType: newGameType,
          scheduledTime: scheduledTime || null
        })
      });

      if (response.ok) {
        const gameData = await response.json();
        setNewGameName('');
        setScheduledTime('');
        fetchGames();
        onGameCreated && onGameCreated(gameData);
        alert('Jogo criado com sucesso!');
      } else {
        alert('Erro ao criar jogo');
      }
    } catch (error) {
      alert('Erro ao criar jogo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async (gameId) => {
    try {
      const response = await fetch(`http://localhost:3001/admin/start-game/${gameId}`, {
        method: 'POST'
      });

      if (response.ok) {
        fetchGames();
        onGameStarted && onGameStarted(gameId);
        alert('Jogo iniciado com sucesso!');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Erro ao iniciar jogo');
      }
    } catch (error) {
      alert('Erro ao iniciar jogo: ' + error.message);
    }
  };

  const handleDeleteGame = async (gameId) => {
    if (!window.confirm('Tem certeza que deseja excluir este jogo?')) return;

    try {
      const response = await fetch(`http://localhost:3001/admin/game/${gameId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchGames();
        alert('Jogo excluído com sucesso!');
      } else {
        alert('Erro ao excluir jogo');
      }
    } catch (error) {
      alert('Erro ao excluir jogo: ' + error.message);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Não agendado';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getStatusText = (game) => {
    if (game.ended_at) return 'Finalizado';
    if (game.started_at) return 'Em andamento';
    if (game.scheduled_time) return 'Agendado';
    return 'Criado';
  };

  const getStatusColor = (game) => {
    if (game.ended_at) return '#dc3545';
    if (game.started_at) return '#28a745';
    if (game.scheduled_time) return '#ffc107';
    return '#6c757d';
  };

  return (
    <div className="game-management">
      <h2>Gerenciamento de Jogos</h2>
      
      {/* Formulário para criar novo jogo */}
      <div className="create-game-form">
        <h3>Criar Novo Jogo</h3>
        <form onSubmit={handleCreateGame}>
          <div className="form-group">
            <label>Nome do Jogo:</label>
            <input
              type="text"
              value={newGameName}
              onChange={(e) => setNewGameName(e.target.value)}
              placeholder="Ex: Jogo do Rato"
              required
            />
          </div>

          <div className="form-group">
            <label>Tipo de Jogo:</label>
            <select value={newGameType} onChange={(e) => setNewGameType(e.target.value)}>
              <option value="manual">Manual (Admin controla sorteios)</option>
              <option value="auto">Automático (Sorteios automáticos)</option>
              <option value="scheduled">Agendado (Inicia em horário específico)</option>
            </select>
          </div>

          {newGameType === 'scheduled' && (
            <div className="form-group">
              <label>Data e Hora de Início:</label>
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                required
              />
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Criando...' : 'Criar Jogo'}
          </button>
        </form>
      </div>

      {/* Lista de jogos */}
      <div className="games-list">
        <h3>Jogos Disponíveis</h3>
        {games.length === 0 ? (
          <p>Nenhum jogo encontrado</p>
        ) : (
          <div className="games-grid">
            {games.map(game => (
              <div key={game.game_id} className="game-card">
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

                <div className="game-actions">
                  {!game.started_at && !game.ended_at && (
                    <button 
                      onClick={() => handleStartGame(game.game_id)}
                      className="btn-start"
                    >
                      Iniciar Jogo
                    </button>
                  )}
                  
                  {!game.started_at && !game.ended_at && (
                    <button 
                      onClick={() => handleDeleteGame(game.game_id)}
                      className="btn-delete"
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default GameManagement; 
import React, { useState, useEffect } from 'react';
import './PastGames.css';

function PastGames() {
  const [pastGames, setPastGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPastGames();
  }, []);

  const fetchPastGames = async () => {
    try {
      const response = await fetch('http://localhost:3001/games/past');
      if (response.ok) {
        const gamesData = await response.json();
        setPastGames(gamesData);
      }
    } catch (error) {
      console.error('Erro ao buscar jogos passados:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Não disponível';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getGameStats = async (gameId) => {
    try {
      const response = await fetch(`http://localhost:3001/admin/game-stats/${gameId}`);
      if (response.ok) {
        const stats = await response.json();
        return stats.stats;
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
    return null;
  };

  if (loading) {
    return (
      <div className="past-games">
        <div className="loading">
          <div className="spinner"></div>
          <p>Carregando jogos passados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="past-games">
      <h2>Jogos Passados</h2>
      
      {pastGames.length === 0 ? (
        <div className="no-games">
          <p>Nenhum jogo finalizado encontrado.</p>
        </div>
      ) : (
        <div className="games-grid">
          {pastGames.map(game => (
            <div key={game.game_id} className="game-card past">
              <div className="game-header">
                <h4>{game.name}</h4>
                <span className="status-badge ended">Finalizado</span>
              </div>
              
              <div className="game-info">
                <p><strong>Tipo:</strong> {game.game_type}</p>
                <p><strong>Criado em:</strong> {formatDateTime(game.created_at)}</p>
                <p><strong>Iniciado em:</strong> {formatDateTime(game.started_at)}</p>
                <p><strong>Finalizado em:</strong> {formatDateTime(game.ended_at)}</p>
              </div>

              <div className="game-duration">
                {game.started_at && game.ended_at && (
                  <p>
                    <strong>Duração:</strong> {
                      Math.round((new Date(game.ended_at) - new Date(game.started_at)) / 60000)
                    } minutos
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PastGames; 
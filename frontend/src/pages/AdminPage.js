import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './AdminPage.css';

const socket = io('http://localhost:3001');

function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentGame, setCurrentGame] = useState(null);
  const [kits, setKits] = useState([]);
  const [cards, setCards] = useState([]);
  const [prizes, setPrizes] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [autoDraw, setAutoDraw] = useState(false);
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [newGameName, setNewGameName] = useState('');

  const ADMIN_PASSWORD = 'admin123';

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      alert('Senha incorreta!');
    }
  };

  // Buscar dados iniciais
  useEffect(() => {
    if (!isAuthenticated) return;
    
    fetchCurrentGame();
    fetchKits();
    fetchGameHistory();
    
    // Socket listeners
    socket.on('number-drawn', (num) => {
      setDrawnNumbers(prev => [...prev, num]);
    });
    
    socket.on('prize', ({ type, kitId, cardId }) => {
      fetchKits(); // Atualizar dados após prêmio
    });
    
    socket.on('game-ended', () => {
      setCurrentGame(null);
      setDrawnNumbers([]);
      fetchGameHistory();
    });
    
    return () => {
      socket.off('number-drawn');
      socket.off('prize');
      socket.off('game-ended');
    };
  }, [isAuthenticated]);

  const fetchCurrentGame = async () => {
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
  };

  const fetchDrawnNumbers = async (gameId) => {
    try {
      const res = await fetch(`http://localhost:3001/drawn-numbers/${gameId}`);
      const data = await res.json();
      setDrawnNumbers(data.map(n => n.number));
    } catch (error) {
      console.error('Erro ao buscar números sorteados:', error);
    }
  };

  const fetchKits = async () => {
    try {
      const res = await fetch('http://localhost:3001/admin/kits');
      const data = await res.json();
      setKits(data.kits);
      setCards(data.cards);
    } catch (error) {
      console.error('Erro ao buscar kits:', error);
    }
  };

  const fetchGameHistory = async () => {
    try {
      const res = await fetch('http://localhost:3001/games/history');
      const data = await res.json();
      setGameHistory(data);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
  };

  const startNewGame = async () => {
    try {
      const res = await fetch('http://localhost:3001/admin/start-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGameName })
      });
      const data = await res.json();
      setCurrentGame(data);
      setDrawnNumbers([]);
      setNewGameName('');
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
    if (!confirm('Tem certeza que deseja resetar o jogo? Isso apagará todos os dados.')) return;
    
    try {
      await fetch('http://localhost:3001/admin/reset', { method: 'POST' });
      setCurrentGame(null);
      setDrawnNumbers([]);
      setAutoDraw(false);
      fetchKits();
      fetchGameHistory();
    } catch (error) {
      console.error('Erro ao resetar jogo:', error);
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
      <h1>🎮 Painel Administrativo</h1>
      
      {/* Status do Jogo Atual */}
      <div className="admin-section">
        <h2>🎯 Jogo Atual</h2>
        {currentGame ? (
          <div className="game-status">
            <p><strong>Jogo:</strong> {currentGame.name} (ID: {currentGame.game_id})</p>
            <p><strong>Números sorteados:</strong> {drawnNumbers.length}/75</p>
            <p><strong>Status:</strong> {drawnNumbers.length >= 75 ? 'Finalizado' : 'Em andamento'}</p>
          </div>
        ) : (
          <p>Nenhum jogo em andamento</p>
        )}
      </div>

      {/* Controles do Jogo */}
      <div className="admin-section">
        <h2>🎲 Controles</h2>
        <div className="controls">
          {!currentGame ? (
            <div className="start-game">
              <input
                type="text"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                placeholder="Nome do jogo (opcional)"
              />
              <button onClick={startNewGame} className="start-btn">
                🚀 Iniciar Novo Jogo
              </button>
            </div>
          ) : (
            <div className="game-controls">
              <button onClick={drawNumber} disabled={drawnNumbers.length >= 75} className="draw-btn">
                🎲 Sortear Número
              </button>
              <button 
                onClick={toggleAutoDraw} 
                className={autoDraw ? 'auto-btn active' : 'auto-btn'}
              >
                {autoDraw ? '⏸️ Parar Sorteio Automático' : '▶️ Iniciar Sorteio Automático'}
              </button>
              <button onClick={resetGame} className="reset-btn">
                🔄 Resetar Jogo
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Números Sorteados */}
      {drawnNumbers.length > 0 && (
        <div className="admin-section">
          <h2>🎯 Números Sorteados ({drawnNumbers.length}/75)</h2>
          <div className="drawn-numbers">
            {drawnNumbers.map((num, index) => (
              <span key={index} className="drawn-number">{num}</span>
            ))}
          </div>
        </div>
      )}

      {/* Estatísticas */}
      <div className="admin-section">
        <h2>📊 Estatísticas</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>👥 Kits Registrados</h3>
            <p className="stat-number">{kits.length}</p>
          </div>
          <div className="stat-card">
            <h3>🎫 Cartelas Compradas</h3>
            <p className="stat-number">{cards.length}</p>
          </div>
          <div className="stat-card">
            <h3>🏆 Prêmios Ganhos</h3>
            <p className="stat-number">{prizes.length}</p>
          </div>
          <div className="stat-card">
            <h3>🎮 Jogos Realizados</h3>
            <p className="stat-number">{gameHistory.length}</p>
          </div>
        </div>
      </div>

      {/* Lista de Kits */}
      <div className="admin-section">
        <h2>👥 Kits de Acesso</h2>
        <div className="kits-list">
          {kits.map(kit => (
            <div key={kit.kit_id} className="kit-item">
              <div className="kit-info">
                <strong>Kit:</strong> {kit.kit_id}
                {kit.name && <span> - {kit.name}</span>}
              </div>
              <div className="kit-stats">
                <span>Cartelas: {cards.filter(c => c.kit_id === kit.kit_id).length}</span>
                <span>Criado: {new Date(kit.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Histórico de Jogos */}
      <div className="admin-section">
        <h2>📚 Histórico de Jogos</h2>
        <div className="history-list">
          {gameHistory.map(game => (
            <div key={game.game_id} className="history-item">
              <div className="game-info">
                <strong>{game.name}</strong>
                <span>ID: {game.game_id}</span>
              </div>
              <div className="game-dates">
                <span>Início: {new Date(game.created_at).toLocaleString()}</span>
                {game.ended_at && (
                  <span>Fim: {new Date(game.ended_at).toLocaleString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AdminPage; 
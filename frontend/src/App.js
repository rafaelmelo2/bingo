import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:3001');

function App() {
  const [step, setStep] = useState('login'); // 'login' or 'bingo'
  const [kitId, setKitId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [cards, setCards] = useState([]); // [{id, data, quina_awarded, full_awarded}]
  const [drawnNumber, setDrawnNumber] = useState(null);
  const [numbersDrawn, setNumbersDrawn] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [points, setPoints] = useState(0);
  const [notification, setNotification] = useState(null);
  const [currentGame, setCurrentGame] = useState(null);

  // --- Socket listeners ---
  useEffect(() => {
    socket.on('number-drawn', (num) => {
      setDrawnNumber(num);
      setNumbersDrawn(prev => [...prev, num]);
    });
    socket.on('prize', ({ type, kit_id, cardId }) => {
      // Buscar nome do ganhador
      fetch(`http://localhost:3001/ranking`).then(res => res.json()).then(ranking => {
        const winner = ranking.find(u => u.kit_id === kit_id);
        setNotification({
          type,
          name: winner ? winner.name : 'Desconhecido',
          cardId
        });
        setTimeout(() => setNotification(null), 7000);
      });
    });
    socket.on('game-ended', () => {
      alert('Jogo encerrado! Uma cartela cheia foi completada!');
      setCurrentGame(null);
    });
    return () => {
      socket.off('number-drawn');
      socket.off('prize');
      socket.off('game-ended');
    };
  }, []);

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
        fetchCards(kitId);
        fetchPoints(kitId);
        fetchRanking();
        fetchCurrentGame();
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
        fetchCards(data.kit_id);
        fetchPoints(data.kit_id);
        fetchRanking();
        fetchCurrentGame();
        alert(`Kit criado com sucesso! Seu código: ${data.kit_id}`);
      } else {
        alert('Erro ao criar kit!');
      }
    } catch (error) {
      alert('Erro ao criar kit: ' + error.message);
    }
  };

  // --- Buscar cartelas ---
  const fetchCards = async (kit = kitId) => {
    if (!kit) return;
    try {
      const res = await fetch(`http://localhost:3001/cards/${kit}`);
      const data = await res.json();
      setCards(data);
    } catch (error) {
      console.error('Erro ao buscar cartelas:', error);
    }
  };

  // --- Buscar pontos ---
  const fetchPoints = async (kit = kitId) => {
    if (!kit) return;
    try {
      const res = await fetch('http://localhost:3001/ranking');
      const data = await res.json();
      const player = data.find(u => u.kit_id === kit);
      setPoints(player ? player.points : 0);
    } catch (error) {
      console.error('Erro ao buscar pontos:', error);
    }
  };

  // --- Comprar cartela ---
  const handleBuyCard = async () => {
    try {
      const res = await fetch('http://localhost:3001/buy-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kit_id: kitId })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        fetchCards();
        fetchPoints();
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
      setRanking(data);
    } catch (error) {
      console.error('Erro ao buscar ranking:', error);
    }
  };

  // --- Buscar jogo atual ---
  const fetchCurrentGame = async () => {
    try {
      const res = await fetch('http://localhost:3001/game/current');
      const data = await res.json();
      setCurrentGame(data);
    } catch (error) {
      console.error('Erro ao buscar jogo atual:', error);
    }
  };

  // --- Efeitos ---
  useEffect(() => {
    if (step === 'bingo' && kitId) {
      fetchCards();
      fetchPoints();
      fetchRanking();
      fetchCurrentGame();
    }
  }, [step, kitId]);

  // --- Render ---
  return (
    <div className="App">
      <h1>Bingo Online</h1>
      
      {notification && (
        <div className="notification">
          <strong>
            {notification.type === 'quina' && '🏅 Quina conquistada!'}
            {notification.type === 'full' && '🏆 Cartela Cheia!'}
          </strong>
          <br />
          {notification.name} ganhou na cartela #{notification.cardId}
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
        <div>
          <div className="player-info">
            <h2>Bem-vindo, {playerName}!</h2>
            <p><strong>Seu Kit:</strong> {kitId}</p>
            <p><strong>Pontos:</strong> {points}</p>
            {currentGame && (
              <p><strong>Jogo Atual:</strong> {currentGame.name}</p>
            )}
          </div>

          <div className="actions">
            <button onClick={handleBuyCard} className="buy-card-btn">
              Comprar Cartela (-10 pts)
            </button>
          </div>

          <div className="cards-container">
            {cards.length === 0 ? (
              <p>Você ainda não tem cartelas. Compre uma para começar!</p>
            ) : (
              cards.map((cardObj) => (
                <div key={cardObj.id} className="bingo-card-container">
                  <h4>Cartela #{cardObj.id}</h4>
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
                            const isDrawn = numbersDrawn.includes(value) || value === 'FREE';
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
                  <div className="prize-labels">
                    {cardObj.quina_awarded && <span className="prize-label quina">🏅 Quina</span>}
                    {cardObj.full_awarded && <span className="prize-label full">🏆 Cartela Cheia</span>}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="game-info">
            <h3>Número Sorteado: {drawnNumber ? <span className="drawn-number">{drawnNumber}</span> : 'Aguardando...'}</h3>
            
            <h3>Ranking</h3>
            <div className="ranking-list">
              {ranking.map((player, i) => (
                <div key={player.kit_id} className={`ranking-item ${player.kit_id === kitId ? 'current-player' : ''}`}>
                  <span className="rank">#{i + 1}</span>
                  <span className="name">{player.name || 'Jogador'}</span>
                  <span className="points">{player.points} pts</span>
                  <span className="stats">({player.quinas} quinas, {player.fulls} cartelas cheias)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 
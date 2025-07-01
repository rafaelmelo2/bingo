import React, { useState } from 'react';
import './App.css';

// Importar as novas telas
import GameManagement from './pages/admin/GameManagement';
import GameControl from './pages/admin/GameControl';
import PastGames from './pages/admin/PastGames';
import GameSelection from './pages/player/GameSelection';
import GamePlay from './pages/player/GamePlay';

function App() {
  // Estados de autenticação
  const [step, setStep] = useState('login'); // 'login', 'admin', 'player'
  const [kitId, setKitId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Estados do admin
  const [adminScreen, setAdminScreen] = useState('management'); // 'management', 'control', 'past'
  const [currentGame, setCurrentGame] = useState(null);
  
  // Estados do player
  const [playerScreen, setPlayerScreen] = useState('selection'); // 'selection', 'play'
  const [selectedGame, setSelectedGame] = useState(null);

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
        setStep('player');
        setPlayerScreen('selection');
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
        setStep('player');
        setPlayerScreen('selection');
        alert(`Kit criado com sucesso! Seu código: ${data.kit_id}`);
      } else {
        alert('Erro ao criar kit!');
      }
    } catch (error) {
      alert('Erro ao criar kit: ' + error.message);
    }
  };

  // --- Login do admin ---
  const handleAdminLogin = (adminName, password) => {
    const ADMIN_PASSWORD = 'admin123';
    if (password === ADMIN_PASSWORD) {
      setPlayerName(adminName);
      setIsAdmin(true);
      setStep('admin');
      setAdminScreen('management');
    } else {
      alert('Senha incorreta!');
    }
  };

  // --- Handlers do Admin ---
  const handleGameCreated = (gameData) => {
    // Jogo criado, pode continuar na tela de gerenciamento
    console.log('Jogo criado:', gameData);
  };

  const handleGameStarted = (gameId) => {
    // Buscar dados do jogo iniciado
    fetch(`http://localhost:3001/game/${gameId}`).then(res => res.json()).then(game => {
      setCurrentGame(game);
      setAdminScreen('control');
    });
  };

  const handleGameEnded = () => {
    setCurrentGame(null);
    setAdminScreen('management');
  };

  // --- Handlers do Player ---
  const handleGameSelected = (game) => {
    setSelectedGame(game);
    setPlayerScreen('play');
  };

  const handleBackToSelection = () => {
    setSelectedGame(null);
    setPlayerScreen('selection');
  };

  // --- Logout ---
  const handleLogout = () => {
    setStep('login');
    setKitId('');
    setPlayerName('');
    setIsAdmin(false);
    setCurrentGame(null);
    setSelectedGame(null);
    setAdminScreen('management');
    setPlayerScreen('selection');
  };

  // Renderizar tela de login
  if (step === 'login') {
    return (
      <div className="App">
        <div className="login-container">
          <div className="login-header">
            <h1>🎰 Bingo Online</h1>
            <p>Entre com seu kit ou crie um novo</p>
          </div>

          <div className="login-tabs">
            <div className="tab-buttons">
              <button 
                className={`tab-button ${!isAdmin ? 'active' : ''}`}
                onClick={() => setIsAdmin(false)}
              >
                Jogador
              </button>
              <button 
                className={`tab-button ${isAdmin ? 'active' : ''}`}
                onClick={() => setIsAdmin(true)}
              >
                Administrador
              </button>
            </div>

            {!isAdmin ? (
              <div className="login-content">
                <div className="login-section">
                  <h3>Entrar com Kit Existente</h3>
                  <form onSubmit={handleLogin}>
                    <div className="form-group">
                      <label>Kit ID:</label>
                      <input
                        type="text"
                        value={kitId}
                        onChange={(e) => setKitId(e.target.value)}
                        placeholder="Ex: ab12-cd34-ef56"
                        required
                      />
                    </div>
                    <button type="submit">Entrar</button>
                  </form>
                </div>

                <div className="login-divider">
                  <span>ou</span>
                </div>

                <div className="login-section">
                  <h3>Criar Novo Kit</h3>
                  <form onSubmit={handleCreateKit}>
                    <div className="form-group">
                      <label>Seu Nome:</label>
                      <input
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Digite seu nome"
                        required
                      />
                    </div>
                    <button type="submit">Criar Kit</button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="login-content">
                <div className="login-section">
                  <h3>Login do Administrador</h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    handleAdminLogin('Admin', e.target.password.value);
                  }}>
                    <div className="form-group">
                      <label>Senha:</label>
                      <input
                        type="password"
                        name="password"
                        placeholder="Digite a senha do admin"
                        required
                      />
                    </div>
                    <button type="submit">Entrar como Admin</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Renderizar tela do admin
  if (step === 'admin') {
    return (
      <div className="App">
        <div className="admin-header">
          <div className="admin-info">
            <h2>Painel Administrativo</h2>
            <p>Bem-vindo, {playerName}!</p>
          </div>
          <div className="admin-nav">
            <button 
              className={`nav-button ${adminScreen === 'management' ? 'active' : ''}`}
              onClick={() => setAdminScreen('management')}
            >
              Gerenciar Jogos
            </button>
            <button 
              className={`nav-button ${adminScreen === 'control' ? 'active' : ''}`}
              onClick={() => setAdminScreen('control')}
              disabled={!currentGame}
            >
              Controle do Jogo
            </button>
            <button 
              className={`nav-button ${adminScreen === 'past' ? 'active' : ''}`}
              onClick={() => setAdminScreen('past')}
            >
              Jogos Passados
            </button>
            <button onClick={handleLogout} className="logout-button">
              Sair
            </button>
          </div>
        </div>

        <div className="admin-content">
          {adminScreen === 'management' && (
            <GameManagement 
              onGameCreated={handleGameCreated}
              onGameStarted={handleGameStarted}
            />
          )}
          
          {adminScreen === 'control' && (
            <GameControl 
              currentGame={currentGame}
              onGameEnded={handleGameEnded}
            />
          )}

          {adminScreen === 'past' && (
            <PastGames />
          )}
        </div>
      </div>
    );
  }

  // Renderizar tela do player
  if (step === 'player') {
    return (
      <div className="App">
        <div className="player-header">
          <div className="player-info">
            <h2>Bingo Online</h2>
            <p>Jogador: {playerName} | Kit: {kitId}</p>
          </div>
          <button onClick={handleLogout} className="logout-button">
            Sair
          </button>
        </div>

        <div className="player-content">
          {playerScreen === 'selection' && (
            <GameSelection 
              playerName={playerName}
              kitId={kitId}
              onGameSelected={handleGameSelected}
            />
          )}
          
          {playerScreen === 'play' && (
            <GamePlay 
              playerName={playerName}
              kitId={kitId}
              selectedGame={selectedGame}
              onBackToSelection={handleBackToSelection}
            />
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default App; 
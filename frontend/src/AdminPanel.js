import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

function AdminPanel() {
  const [adminStatus, setAdminStatus] = useState(null);
  const [autoDraw, setAutoDraw] = useState(false);
  const [notification, setNotification] = useState(null);

  // Atualização automática do status
  useEffect(() => {
    const fetchStatus = async () => {
      const res = await fetch('http://localhost:3001/admin/status');
      const data = await res.json();
      setAdminStatus(data);
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // Notificações de prêmios
  useEffect(() => {
    socket.on('prize', ({ type, userId, cardId }) => {
      // Buscar nome do ganhador
      fetch(`http://localhost:3001/ranking`).then(res => res.json()).then(ranking => {
        const winner = ranking.find(u => u.id === userId);
        setNotification({
          type,
          name: winner ? winner.name : 'Desconhecido',
          cardId
        });
        setTimeout(() => setNotification(null), 7000);
      });
    });
    return () => {
      socket.off('prize');
    };
  }, []);

  // Sorteio automático
  useEffect(() => {
    socket.emit('admin-auto-draw', autoDraw);
  }, [autoDraw]);

  const handleAdminReset = async () => {
    await fetch('http://localhost:3001/admin/reset', { method: 'POST' });
    setAdminStatus(null);
    alert('Jogo resetado!');
  };

  return (
    <div className="admin-panel">
      <h2>Painel Admin</h2>
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
      <button onClick={() => setAutoDraw(!autoDraw)} style={{ background: autoDraw ? '#28a745' : '#2b7cff' }}>
        {autoDraw ? 'Parar sorteio automático' : 'Ativar sorteio automático'}
      </button>
      <button onClick={handleAdminReset} style={{ marginLeft: 8, background: '#c00' }}>Resetar Jogo</button>
      <div style={{ marginTop: 16, textAlign: 'left', maxWidth: 800, margin: '16px auto' }}>
        {adminStatus && (
          <>
            <h3>Jogadores</h3>
            <ul>
              {adminStatus.users.map(u => (
                <li key={u.id}>{u.name} (ID: {u.id}) - {u.points} pts</li>
              ))}
            </ul>
            <h3>Cartelas</h3>
            <ul>
              {adminStatus.cards.map(c => (
                <li key={c.id}>Cartela #{c.id} - Usuário: {c.user_id} | Quina: {c.quina_awarded ? 'Sim' : 'Não'} | Cheia: {c.full_awarded ? 'Sim' : 'Não'}</li>
              ))}
            </ul>
            <h3>Prêmios</h3>
            <ul>
              {adminStatus.prizes.map((p, i) => (
                <li key={i}>{p.type} - Cartela #{p.card_id} - Usuário: {p.user_id}</li>
              ))}
            </ul>
            <h3>Números sorteados</h3>
            <div>{adminStatus.drawnNumbers.join(', ')}</div>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminPanel; 
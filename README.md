# Bingo Online - Sistema de Kit de Acesso

Um jogo de bingo online com sistema de kit de acesso único para cada jogador.

## 🚀 Como Executar

### Backend
```bash
cd backend
npm install
npm start
```
O servidor rodará na porta 3001.

### Frontend
```bash
cd frontend
npm install
npm start
```
O frontend rodará na porta 3000.

## 🎮 Como Jogar

### Para Jogadores

1. **Acesse** http://localhost:3000
2. **Crie um novo kit** ou **entre com um kit existente**
   - Para criar: Digite seu nome e clique em "Criar Kit"
   - Para entrar: Digite o código do kit (formato: xxxx-xxxx-xxxx)
3. **Compre cartelas** usando seus pontos
4. **Aguarde** os números serem sorteados automaticamente
5. **Marque** os números sorteados em suas cartelas
6. **Ganhe prêmios** por quinas e cartelas cheias!

### Para Administradores

1. **Acesse** http://localhost:3000/admin
2. **Digite a senha** (padrão: "admin123")
3. **Inicie um novo jogo** com um nome personalizado
4. **Ative o sorteio automático** para números serem sorteados a cada 3 segundos
5. **Monitore** os prêmios e o progresso do jogo
6. **Reset o jogo** quando necessário

## 🏆 Sistema de Prêmios

- **Quina** (5 números em linha): 30 pontos
- **Cartela Cheia**: 100 pontos + fim do jogo
- **Cartelas custam** 10 pontos cada

## 🔧 Funcionalidades

### Para Jogadores
- ✅ Sistema de kit único (xxxx-xxxx-xxxx)
- ✅ Múltiplas cartelas por jogador
- ✅ Marcação automática de números sorteados
- ✅ Sistema de pontos e ranking
- ✅ Notificações de prêmios
- ✅ Interface responsiva

### Para Administradores
- ✅ Painel administrativo protegido por senha
- ✅ Criação de jogos com nomes personalizados
- ✅ Sorteio automático de números
- ✅ Monitoramento de prêmios
- ✅ Reset completo do jogo
- ✅ Visualização de todos os kits e cartelas

## 🎯 Tecnologias Utilizadas

- **Backend**: Node.js, Express, Socket.io, SQLite
- **Frontend**: React, Socket.io-client
- **Banco de Dados**: SQLite com persistência local

## 📁 Estrutura do Projeto

```
bingo-online/
├── backend/
│   ├── server.js          # Servidor principal
│   ├── db.js             # Configuração do banco
│   ├── prizeLogic.js     # Lógica de prêmios
│   └── bingo.db          # Banco SQLite
└── frontend/
    ├── src/
    │   ├── App.js         # Página principal
    │   ├── pages/
    │   │   └── AdminPage.js # Painel administrativo
    │   └── App.css        # Estilos
    └── public/
```

## 🎲 Como Funciona

1. **Cada jogador recebe um kit único** com código xxxx-xxxx-xxxx
2. **Os jogadores compram cartelas** usando pontos
3. **Números são sorteados automaticamente** a cada 3 segundos
4. **O sistema verifica automaticamente** quinas e cartelas cheias
5. **Prêmios são atribuídos** e notificações enviadas
6. **Quando uma cartela cheia é completada**, o jogo termina

## 🔐 Segurança

- Senha administrativa protegida
- Validação de kits únicos
- Prevenção de duplicação de prêmios
- Sistema de pausa após prêmios

## 🎨 Interface

- Design moderno e responsivo
- Animações suaves
- Notificações em tempo real
- Ranking atualizado automaticamente
- Cartelas com marcação visual

## 🚀 Próximas Melhorias

- [ ] Sistema de chat
- [ ] Sons e efeitos sonoros
- [ ] Temas personalizáveis
- [ ] Sistema de convites
- [ ] Estatísticas detalhadas
- [ ] Modo torneio
- [ ] Integração com redes sociais

---

**Divirta-se jogando Bingo Online! 🎉** 
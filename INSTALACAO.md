# 🚀 Guia de Instalação e Execução

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (versão 14 ou superior)
- **npm** (gerenciador de pacotes do Node.js)

### Verificar Instalação

```bash
node --version
npm --version
```

## 🛠️ Instalação

### 1. Clone o Repositório

```bash
git clone <url-do-repositorio>
cd bingo
```

### 2. Instalar Dependências do Backend

```bash
cd backend
npm install
```

### 3. Instalar Dependências do Frontend

```bash
cd ../frontend
npm install
```

## 🚀 Execução

### 1. Iniciar o Backend

```bash
cd backend
npm start
```

O servidor backend será iniciado na porta **3001**

### 2. Iniciar o Frontend

Em um novo terminal:

```bash
cd frontend
npm start
```

O frontend será iniciado na porta **3000**

### 3. Acessar o Sistema

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## 🎮 Primeiro Uso

### Para Administradores

1. Acesse http://localhost:3000
2. Clique na aba "Administrador"
3. Digite a senha: `admin123`
4. Clique em "Entrar como Admin"

### Para Jogadores

1. Acesse http://localhost:3000
2. Na aba "Jogador":
   - **Criar novo kit**: Digite seu nome e clique "Criar Kit"
   - **Entrar com kit existente**: Digite o código do kit e clique "Entrar"

## 🔧 Configuração do Banco de Dados

O sistema usa SQLite e cria automaticamente o banco de dados na primeira execução.

### Estrutura do Banco

- **games**: Jogos criados
- **kits**: Jogadores/usuários
- **cards**: Cartelas de bingo
- **drawn_numbers**: Números sorteados
- **prizes**: Prêmios e pontos

### Localização do Banco

O arquivo do banco será criado em:
```
bingo/backend/bingo.db
```

## 🎯 Funcionalidades Principais

### Admin
- ✅ Criar jogos (Manual/Automático/Agendado)
- ✅ Iniciar e controlar jogos
- ✅ Sortear números manualmente
- ✅ Ativar sorteio automático
- ✅ Monitorar estatísticas
- ✅ Gerenciar pontos dos jogadores

### Player
- ✅ Criar ou entrar com kit
- ✅ Ver jogos disponíveis
- ✅ Entrar em jogos ativos
- ✅ Comprar cartelas com pontos
- ✅ Acompanhar números sorteados
- ✅ Receber notificações de prêmios

## 🔍 Solução de Problemas

### Backend não inicia

```bash
# Verificar se a porta 3001 está livre
netstat -an | grep 3001

# Verificar logs
cd backend
npm start
```

### Frontend não conecta

```bash
# Verificar se o backend está rodando
curl http://localhost:3001/games

# Verificar configuração do socket
# No arquivo frontend/src/App.js, linha 7:
const socket = io('http://localhost:3001');
```

### Erro de CORS

Se aparecer erro de CORS, verifique se o backend está configurado corretamente:

```javascript
// backend/server.js
app.use(cors());
```

### Banco de dados corrompido

```bash
# Fazer backup
cp backend/bingo.db backend/bingo.db.backup

# Remover banco corrompido
rm backend/bingo.db

# Reiniciar backend (criará novo banco)
npm start
```

## 📱 Teste em Diferentes Dispositivos

### Desktop
- Acesse http://localhost:3000
- Interface completa disponível

### Mobile/Tablet
- Acesse http://[seu-ip]:3000
- Interface responsiva adaptada

### Para acessar de outros dispositivos na rede

```bash
# Descobrir IP da máquina
ipconfig  # Windows
ifconfig  # Linux/Mac

# Acessar usando o IP
http://[seu-ip]:3000
```

## 🔄 Atualizações

### Atualizar Dependências

```bash
# Backend
cd backend
npm update

# Frontend
cd frontend
npm update
```

### Atualizar Código

```bash
git pull origin main
```

## 🗂️ Estrutura de Arquivos

```
bingo/
├── backend/
│   ├── server.js          # Servidor principal
│   ├── db.js             # Configuração do banco
│   ├── prizeLogic.js     # Lógica de prêmios
│   ├── package.json      # Dependências do backend
│   └── bingo.db          # Banco SQLite (criado automaticamente)
├── frontend/
│   ├── src/
│   │   ├── App.js        # Componente principal
│   │   ├── pages/
│   │   │   ├── admin/    # Telas do administrador
│   │   │   └── player/   # Telas do jogador
│   │   └── hooks/        # Hooks personalizados
│   └── package.json      # Dependências do frontend
└── README.md             # Documentação principal
```

## 🎯 Próximos Passos

1. **Teste todas as funcionalidades**
2. **Configure para produção** (se necessário)
3. **Personalize cores e textos**
4. **Adicione novos recursos**

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs no console
2. Teste a conectividade entre frontend e backend
3. Verifique se todas as dependências estão instaladas
4. Reinicie os serviços

---

**Sistema pronto para uso! 🎉** 
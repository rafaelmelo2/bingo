import { useState, useEffect } from 'react';

const CACHE_PREFIX = 'bingo_cache_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export const useCache = (key, fetchFunction, dependencies = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cacheKey = `${CACHE_PREFIX}${key}`;

  const getCachedData = () => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data: cachedData, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        // Verifica se o cache ainda é válido
        if (now - timestamp < CACHE_DURATION) {
          return cachedData;
        } else {
          // Remove cache expirado
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.error('Erro ao ler cache:', error);
    }
    return null;
  };

  const setCachedData = (newData) => {
    try {
      const cacheData = {
        data: newData,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Erro ao salvar cache:', error);
    }
  };

  const clearCache = () => {
    try {
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const newData = await fetchFunction();
      setData(newData);
      setCachedData(newData);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      // Tenta buscar do cache primeiro
      const cachedData = getCachedData();
      
      if (cachedData) {
        setData(cachedData);
        setLoading(false);
        
        // Atualiza em background se necessário
        try {
          const freshData = await fetchFunction();
          if (JSON.stringify(freshData) !== JSON.stringify(cachedData)) {
            setData(freshData);
            setCachedData(freshData);
          }
        } catch (err) {
          console.error('Erro ao atualizar dados em background:', err);
        }
      } else {
        // Se não há cache, busca da API
        try {
          const newData = await fetchFunction();
          setData(newData);
          setCachedData(newData);
        } catch (err) {
          setError(err);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, dependencies);

  return { data, loading, error, refreshData, clearCache };
};

// Hook específico para cache de jogos
export const useGamesCache = () => {
  const [gamesCache, setGamesCache] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);

  const getGamesFromCache = () => {
    try {
      const cached = localStorage.getItem(`${CACHE_PREFIX}games`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        if (now - timestamp < CACHE_DURATION) {
          return data;
        }
      }
    } catch (error) {
      console.error('Erro ao ler cache de jogos:', error);
    }
    return null;
  };

  const setGamesToCache = (games) => {
    try {
      const cacheData = {
        data: games,
        timestamp: Date.now()
      };
      localStorage.setItem(`${CACHE_PREFIX}games`, JSON.stringify(cacheData));
      setGamesCache(games);
      setLastUpdate(Date.now());
    } catch (error) {
      console.error('Erro ao salvar cache de jogos:', error);
    }
  };

  const updateGameInCache = (gameId, updatedGame) => {
    const currentCache = getGamesFromCache() || gamesCache;
    const updatedCache = currentCache.map(game => 
      game.id === gameId ? { ...game, ...updatedGame } : game
    );
    setGamesToCache(updatedCache);
  };

  const clearGamesCache = () => {
    try {
      localStorage.removeItem(`${CACHE_PREFIX}games`);
      setGamesCache({});
      setLastUpdate(null);
    } catch (error) {
      console.error('Erro ao limpar cache de jogos:', error);
    }
  };

  return {
    gamesCache: getGamesFromCache() || gamesCache,
    lastUpdate,
    setGamesToCache,
    updateGameInCache,
    clearGamesCache
  };
};

// Hook para cache de ranking
export const useRankingCache = () => {
  const [rankingCache, setRankingCache] = useState([]);

  const getRankingFromCache = () => {
    try {
      const cached = localStorage.getItem(`${CACHE_PREFIX}ranking`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        if (now - timestamp < CACHE_DURATION) {
          return data;
        }
      }
    } catch (error) {
      console.error('Erro ao ler cache de ranking:', error);
    }
    return null;
  };

  const setRankingToCache = (ranking) => {
    try {
      const cacheData = {
        data: ranking,
        timestamp: Date.now()
      };
      localStorage.setItem(`${CACHE_PREFIX}ranking`, JSON.stringify(cacheData));
      setRankingCache(ranking);
    } catch (error) {
      console.error('Erro ao salvar cache de ranking:', error);
    }
  };

  const clearRankingCache = () => {
    try {
      localStorage.removeItem(`${CACHE_PREFIX}ranking`);
      setRankingCache([]);
    } catch (error) {
      console.error('Erro ao limpar cache de ranking:', error);
    }
  };

  return {
    rankingCache: getRankingFromCache() || rankingCache,
    setRankingToCache,
    clearRankingCache
  };
};

// Hook para cache de estatísticas
export const useStatsCache = () => {
  const [statsCache, setStatsCache] = useState({});

  const getStatsFromCache = (gameId) => {
    try {
      const cached = localStorage.getItem(`${CACHE_PREFIX}stats_${gameId}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const now = Date.now();
        
        if (now - timestamp < CACHE_DURATION) {
          return data;
        }
      }
    } catch (error) {
      console.error('Erro ao ler cache de estatísticas:', error);
    }
    return null;
  };

  const setStatsToCache = (gameId, stats) => {
    try {
      const cacheData = {
        data: stats,
        timestamp: Date.now()
      };
      localStorage.setItem(`${CACHE_PREFIX}stats_${gameId}`, JSON.stringify(cacheData));
      setStatsCache(prev => ({ ...prev, [gameId]: stats }));
    } catch (error) {
      console.error('Erro ao salvar cache de estatísticas:', error);
    }
  };

  const clearStatsCache = (gameId = null) => {
    try {
      if (gameId) {
        localStorage.removeItem(`${CACHE_PREFIX}stats_${gameId}`);
        setStatsCache(prev => {
          const newCache = { ...prev };
          delete newCache[gameId];
          return newCache;
        });
      } else {
        // Limpa todos os caches de estatísticas
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith(`${CACHE_PREFIX}stats_`)) {
            localStorage.removeItem(key);
          }
        });
        setStatsCache({});
      }
    } catch (error) {
      console.error('Erro ao limpar cache de estatísticas:', error);
    }
  };

  return {
    getStatsFromCache,
    setStatsToCache,
    clearStatsCache
  };
}; 
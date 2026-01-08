// Sports API Integration for Live Stats
// Using Ball Don't Lie API for NBA (free, no key required)

const SportsAPI = {
    NBA_API: 'https://api.balldontlie.io/v1',

    // Cache for player lookups
    playerCache: JSON.parse(localStorage.getItem('playerCache')) || {},

    // Search for NBA player by name
    async searchPlayer(playerName) {
        const cacheKey = playerName.toLowerCase().trim();

        if (this.playerCache[cacheKey]) {
            console.log(`Found ${playerName} in cache`);
            return this.playerCache[cacheKey];
        }

        try {
            console.log(`Searching for player: ${playerName}`);
            const response = await fetch(
                `${this.NBA_API}/players?search=${encodeURIComponent(playerName)}`
            );

            if (!response.ok) {
                console.error('API response not ok:', response.status);
                return null;
            }

            const data = await response.json();

            if (data.data && data.data.length > 0) {
                // Find best match
                const player = this.findBestMatch(playerName, data.data);
                if (player) {
                    this.playerCache[cacheKey] = player;
                    localStorage.setItem('playerCache', JSON.stringify(this.playerCache));
                    console.log(`Found player:`, player);
                    return player;
                }
            }

            console.log(`No player found for: ${playerName}`);
            return null;
        } catch (error) {
            console.error('Error searching player:', error);
            return null;
        }
    },

    // Find best matching player from search results
    findBestMatch(searchName, players) {
        const searchLower = searchName.toLowerCase();

        // First try exact match
        for (const player of players) {
            const fullName = `${player.first_name} ${player.last_name}`.toLowerCase();
            if (fullName === searchLower) {
                return player;
            }
        }

        // Then try partial match (last name)
        for (const player of players) {
            if (player.last_name.toLowerCase() === searchLower.split(' ').pop()) {
                return player;
            }
        }

        // Return first result as fallback
        return players[0];
    },

    // Get player's recent/live stats
    async getPlayerStats(playerId) {
        try {
            const today = new Date();
            const startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 3); // Last 3 days

            const response = await fetch(
                `${this.NBA_API}/stats?player_ids[]=${playerId}&start_date=${startDate.toISOString().split('T')[0]}&end_date=${today.toISOString().split('T')[0]}`
            );

            if (!response.ok) {
                return null;
            }

            const data = await response.json();

            if (data.data && data.data.length > 0) {
                // Get most recent game
                const latest = data.data[data.data.length - 1];
                return {
                    points: latest.pts || 0,
                    rebounds: latest.reb || 0,
                    assists: latest.ast || 0,
                    steals: latest.stl || 0,
                    blocks: latest.blk || 0,
                    threes: latest.fg3m || 0,
                    minutes: latest.min || '0',
                    gameDate: latest.game?.date,
                    gameId: latest.game?.id,
                    gameStatus: latest.game?.status
                };
            }

            return null;
        } catch (error) {
            console.error('Error fetching stats:', error);
            return null;
        }
    },

    // Calculate combined stats
    calculateStat(stats, statType) {
        if (!stats) return 0;

        switch (statType) {
            case 'points': return stats.points || 0;
            case 'rebounds': return stats.rebounds || 0;
            case 'assists': return stats.assists || 0;
            case 'steals': return stats.steals || 0;
            case 'blocks': return stats.blocks || 0;
            case 'threes': return stats.threes || 0;
            case 'pts+reb': return (stats.points || 0) + (stats.rebounds || 0);
            case 'pts+ast': return (stats.points || 0) + (stats.assists || 0);
            case 'reb+ast': return (stats.rebounds || 0) + (stats.assists || 0);
            case 'pts+reb+ast': return (stats.points || 0) + (stats.rebounds || 0) + (stats.assists || 0);
            case 'fantasy':
                return (stats.points || 0) +
                       ((stats.threes || 0) * 0.5) +
                       ((stats.rebounds || 0) * 1.25) +
                       ((stats.assists || 0) * 1.5) +
                       ((stats.steals || 0) * 2) +
                       ((stats.blocks || 0) * 2);
            default: return 0;
        }
    },

    // Main function to get live stats for a tracked player
    async getLiveStats(playerName, statType) {
        const player = await this.searchPlayer(playerName);

        if (!player) {
            return { current: 0, found: false };
        }

        const stats = await this.getPlayerStats(player.id);

        if (!stats) {
            return { current: 0, found: true, noGame: true };
        }

        const current = this.calculateStat(stats, statType);

        return {
            current,
            found: true,
            noGame: false,
            minutes: stats.minutes,
            gameStatus: stats.gameStatus,
            rawStats: stats
        };
    }
};

window.SportsAPI = SportsAPI;

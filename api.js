// Sports API Integration for Live Stats
// Using NBA's official free CDN endpoints

const SportsAPI = {
    // Using CORS proxy for browser access
    PROXY: 'https://api.codetabs.com/v1/proxy/?quest=',
    NBA_SCOREBOARD: 'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json',
    NBA_BOXSCORE: 'https://cdn.nba.com/static/json/liveData/boxscore/boxscore_',

    // Cache for today's games
    gamesCache: null,
    gamesCacheTime: null,

    // Get display stat label
    getStatLabel(statType) {
        const labels = {
            'points': 'PTS',
            'rebounds': 'REB',
            'assists': 'AST',
            'threes': '3PM',
            'steals': 'STL',
            'blocks': 'BLK',
            'pts+reb': 'PTS+REB',
            'pts+ast': 'PTS+AST',
            'reb+ast': 'REB+AST',
            'pts+reb+ast': 'PRA',
            'fantasy': 'FPTS'
        };
        return labels[statType] || statType.toUpperCase();
    },

    // Get today's games
    async getTodaysGames() {
        // Use cache if less than 30 seconds old
        if (this.gamesCache && this.gamesCacheTime && (Date.now() - this.gamesCacheTime) < 30000) {
            return this.gamesCache;
        }

        try {
            const response = await fetch(this.PROXY + this.NBA_SCOREBOARD);
            if (!response.ok) return [];

            const data = await response.json();
            this.gamesCache = data.scoreboard?.games || [];
            this.gamesCacheTime = Date.now();
            return this.gamesCache;
        } catch (error) {
            console.error('Error fetching games:', error);
            return [];
        }
    },

    // Get boxscore for a specific game
    async getBoxscore(gameId) {
        try {
            const response = await fetch(this.PROXY + `${this.NBA_BOXSCORE}${gameId}.json`);
            if (!response.ok) return null;

            const data = await response.json();
            return data.game;
        } catch (error) {
            console.error('Error fetching boxscore:', error);
            return null;
        }
    },

    // Find player in boxscore
    findPlayerInBoxscore(boxscore, playerName) {
        const searchName = playerName.toLowerCase();
        const allPlayers = [
            ...(boxscore.homeTeam?.players || []),
            ...(boxscore.awayTeam?.players || [])
        ];

        for (const player of allPlayers) {
            const fullName = `${player.firstName || ''} ${player.familyName || ''}`.toLowerCase().trim();
            const nameI = (player.nameI || '').toLowerCase();
            const familyName = (player.familyName || '').toLowerCase();

            // Check various name formats
            if (fullName.includes(searchName) ||
                searchName.includes(fullName) ||
                nameI.includes(searchName) ||
                searchName.includes(familyName) ||
                familyName === searchName.split(' ').pop()) {
                return player;
            }
        }
        return null;
    },

    // Calculate stat from player data
    calculateStat(stats, statType) {
        if (!stats) return 0;

        switch (statType) {
            case 'points': return stats.points || 0;
            case 'rebounds': return stats.reboundsTotal || 0;
            case 'assists': return stats.assists || 0;
            case 'steals': return stats.steals || 0;
            case 'blocks': return stats.blocks || 0;
            case 'threes': return stats.threePointersMade || 0;
            case 'pts+reb': return (stats.points || 0) + (stats.reboundsTotal || 0);
            case 'pts+ast': return (stats.points || 0) + (stats.assists || 0);
            case 'reb+ast': return (stats.reboundsTotal || 0) + (stats.assists || 0);
            case 'pts+reb+ast': return (stats.points || 0) + (stats.reboundsTotal || 0) + (stats.assists || 0);
            case 'fantasy':
                return (stats.points || 0) +
                       ((stats.threePointersMade || 0) * 0.5) +
                       ((stats.reboundsTotal || 0) * 1.25) +
                       ((stats.assists || 0) * 1.5) +
                       ((stats.steals || 0) * 2) +
                       ((stats.blocks || 0) * 2);
            default: return 0;
        }
    },

    // Main function to get live stats
    async getLiveStats(playerName, statType) {
        try {
            // Get today's games
            const games = await this.getTodaysGames();

            if (games.length === 0) {
                return { current: 0, found: true, noGame: true, message: 'No games today' };
            }

            // Search each game's boxscore for the player
            for (const game of games) {
                // Only check games that are live or finished
                if (game.gameStatus < 2) continue;

                const boxscore = await this.getBoxscore(game.gameId);
                if (!boxscore) continue;

                const player = this.findPlayerInBoxscore(boxscore, playerName);
                if (player && player.statistics) {
                    const current = this.calculateStat(player.statistics, statType);

                    // Get game info
                    const homeTeam = game.homeTeam?.teamTricode || '';
                    const awayTeam = game.awayTeam?.teamTricode || '';
                    const homeScore = game.homeTeam?.score || 0;
                    const awayScore = game.awayTeam?.score || 0;

                    return {
                        current,
                        found: true,
                        noGame: false,
                        gameStatus: game.gameStatusText,
                        gameInfo: `${awayTeam} ${awayScore} - ${homeScore} ${homeTeam}`,
                        minutes: player.statistics.minutes || '0:00',
                        isLive: game.gameStatus === 2,
                        onCourt: player.oncourt === "1"
                    };
                }
            }

            // Player not found in any live game
            return { current: 0, found: false, noGame: true, message: 'Player not in today\'s games' };

        } catch (error) {
            console.error('Error getting live stats:', error);
            return { current: 0, found: false, error: true };
        }
    }
};

window.SportsAPI = SportsAPI;

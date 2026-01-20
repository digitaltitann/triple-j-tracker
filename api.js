// Sports API Integration for Live Stats
// Using NBA's official CDN and ESPN's public API

const SportsAPI = {
    // Using CORS proxy for NBA CDN (ESPN doesn't need it)
    PROXY: 'https://api.codetabs.com/v1/proxy/?quest=',
    NBA_SCOREBOARD: 'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json',
    NBA_BOXSCORE: 'https://cdn.nba.com/static/json/liveData/boxscore/boxscore_',

    // ESPN API endpoints (no CORS issues)
    ESPN_NFL_SCOREBOARD: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    ESPN_NFL_GAME: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=',
    ESPN_NBA_SCOREBOARD: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',

    // Caches
    nbaGamesCache: null,
    nbaGamesCacheTime: null,
    nflGamesCache: null,
    nflGamesCacheTime: null,

    // Get display stat label
    getStatLabel(statType) {
        const labels = {
            // NBA
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
            'fantasy': 'FPTS',
            // NFL
            'pass_yards': 'PASS YDS',
            'rush_yards': 'RUSH YDS',
            'rec_yards': 'REC YDS',
            'receptions': 'REC',
            'pass_td': 'PASS TD',
            'rush_td': 'RUSH TD',
            'rec_td': 'REC TD',
            'any_td': 'TD',
            'interceptions': 'INT',
            'completions': 'COMP'
        };
        return labels[statType] || statType.toUpperCase();
    },

    // ==================== NBA Methods ====================

    // Get today's NBA games
    async getTodaysGames() {
        if (this.nbaGamesCache && this.nbaGamesCacheTime && (Date.now() - this.nbaGamesCacheTime) < 30000) {
            return this.nbaGamesCache;
        }

        try {
            const response = await fetch(this.PROXY + this.NBA_SCOREBOARD);
            if (!response.ok) return [];

            const data = await response.json();
            this.nbaGamesCache = data.scoreboard?.games || [];
            this.nbaGamesCacheTime = Date.now();
            return this.nbaGamesCache;
        } catch (error) {
            console.error('Error fetching NBA games:', error);
            return [];
        }
    },

    // Get boxscore for a specific NBA game
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

    // Find player in NBA boxscore
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

    // Calculate NBA stat from player data
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

    // Get live stats for NBA player
    async getLiveStats(playerName, statType) {
        try {
            const games = await this.getTodaysGames();

            if (games.length === 0) {
                return { current: 0, found: true, noGame: true, message: 'No games today' };
            }

            // First pass: check live/finished games
            for (const game of games) {
                if (game.gameStatus < 2) continue;

                const boxscore = await this.getBoxscore(game.gameId);
                if (!boxscore) continue;

                const player = this.findPlayerInBoxscore(boxscore, playerName);
                if (player && player.statistics) {
                    const current = this.calculateStat(player.statistics, statType);

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

            // Second pass: check if player has a game that hasn't started yet
            for (const game of games) {
                if (game.gameStatus >= 2) continue; // Already checked these

                const homeTeam = game.homeTeam?.teamTricode || '';
                const awayTeam = game.awayTeam?.teamTricode || '';

                // Check if player name might be on either team (we can't check roster without boxscore)
                // Return the game info with start time
                // Note: NBA CDN doesn't give us roster for pre-game, so we show game time for any scheduled game
                return {
                    current: 0,
                    found: true,
                    noGame: false,
                    notStarted: true,
                    gameStatus: game.gameStatusText,
                    gameInfo: `${awayTeam} vs ${homeTeam}`,
                    isLive: false
                };
            }

            return { current: 0, found: false, noGame: true, message: 'Player not in today\'s games' };

        } catch (error) {
            console.error('Error getting NBA live stats:', error);
            return { current: 0, found: false, error: true };
        }
    },

    // ==================== NFL Methods ====================

    // Get today's NFL games from ESPN
    async getNFLGames() {
        if (this.nflGamesCache && this.nflGamesCacheTime && (Date.now() - this.nflGamesCacheTime) < 30000) {
            return this.nflGamesCache;
        }

        try {
            const response = await fetch(this.ESPN_NFL_SCOREBOARD);
            if (!response.ok) return [];

            const data = await response.json();
            this.nflGamesCache = data.events || [];
            this.nflGamesCacheTime = Date.now();
            return this.nflGamesCache;
        } catch (error) {
            console.error('Error fetching NFL games:', error);
            return [];
        }
    },

    // Get detailed NFL game data
    async getNFLGameDetails(gameId) {
        try {
            const response = await fetch(this.ESPN_NFL_GAME + gameId);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('Error fetching NFL game details:', error);
            return null;
        }
    },

    // Find NFL player in game details and extract their stats
    findNFLPlayerStats(gameDetails, playerName, statType) {
        const searchName = playerName.toLowerCase();
        const boxscore = gameDetails?.boxscore;

        if (!boxscore?.players) return null;

        // Determine which stat category to look in
        let categories = [];
        if (['pass_yards', 'pass_td', 'interceptions', 'completions'].includes(statType)) {
            categories = ['passing'];
        } else if (['rush_yards', 'rush_td'].includes(statType)) {
            categories = ['rushing'];
        } else if (['rec_yards', 'rec_td', 'receptions'].includes(statType)) {
            categories = ['receiving'];
        } else if (statType === 'any_td') {
            categories = ['rushing', 'receiving'];
        }

        for (const team of boxscore.players) {
            for (const statCategory of team.statistics || []) {
                const catName = statCategory.name?.toLowerCase();
                if (!categories.includes(catName)) continue;

                for (const athlete of statCategory.athletes || []) {
                    const fullName = athlete.athlete?.displayName?.toLowerCase() || '';
                    const shortName = athlete.athlete?.shortName?.toLowerCase() || '';

                    if (fullName.includes(searchName) || searchName.includes(fullName) ||
                        shortName.includes(searchName)) {
                        return {
                            stats: athlete.stats,
                            labels: statCategory.labels,
                            category: catName,
                            athleteName: athlete.athlete?.displayName
                        };
                    }
                }
            }
        }
        return null;
    },

    // Calculate NFL stat value
    calculateNFLStat(gameDetails, playerName, statType) {
        if (statType === 'any_td') {
            // Sum TDs from rushing and receiving
            let totalTD = 0;

            const rushData = this.findNFLPlayerStats(gameDetails, playerName, 'rush_td');
            if (rushData) {
                const tdIndex = rushData.labels?.indexOf('TD');
                if (tdIndex !== -1 && rushData.stats) {
                    totalTD += parseInt(rushData.stats[tdIndex]) || 0;
                }
            }

            const recData = this.findNFLPlayerStats(gameDetails, playerName, 'rec_td');
            if (recData) {
                const tdIndex = recData.labels?.indexOf('TD');
                if (tdIndex !== -1 && recData.stats) {
                    totalTD += parseInt(recData.stats[tdIndex]) || 0;
                }
            }

            return totalTD;
        }

        const playerData = this.findNFLPlayerStats(gameDetails, playerName, statType);
        if (!playerData) return null;

        const { stats, labels } = playerData;

        // Map stat types to ESPN label names
        const statLabelMap = {
            'pass_yards': 'YDS',
            'rush_yards': 'YDS',
            'rec_yards': 'YDS',
            'receptions': 'REC',
            'pass_td': 'TD',
            'rush_td': 'TD',
            'rec_td': 'TD',
            'interceptions': 'INT',
            'completions': 'C/ATT'
        };

        const labelName = statLabelMap[statType];
        if (!labelName || !labels || !stats) return null;

        const index = labels.indexOf(labelName);
        if (index === -1) return null;

        const value = stats[index];

        // Handle C/ATT format (e.g., "25/38")
        if (statType === 'completions' && typeof value === 'string' && value.includes('/')) {
            return parseInt(value.split('/')[0]) || 0;
        }

        return parseInt(value) || 0;
    },

    // Get NFL player stats
    async getNFLPlayerStats(playerName, statType) {
        try {
            const games = await this.getNFLGames();

            if (games.length === 0) {
                return { current: 0, found: true, noGame: true, message: 'No NFL games today' };
            }

            // First pass: check live/finished games
            for (const game of games) {
                const state = game.status?.type?.state;
                if (state === 'pre') continue;

                const gameDetails = await this.getNFLGameDetails(game.id);
                if (!gameDetails) continue;

                const stat = this.calculateNFLStat(gameDetails, playerName, statType);
                if (stat !== null) {
                    const competition = game.competitions?.[0];
                    const homeTeam = competition?.competitors?.find(c => c.homeAway === 'home');
                    const awayTeam = competition?.competitors?.find(c => c.homeAway === 'away');

                    return {
                        current: stat,
                        found: true,
                        noGame: false,
                        gameStatus: game.status?.type?.shortDetail || game.status?.type?.detail,
                        gameInfo: `${awayTeam?.team?.abbreviation} ${awayTeam?.score || 0} - ${homeTeam?.score || 0} ${homeTeam?.team?.abbreviation}`,
                        isLive: state === 'in',
                        onCourt: null
                    };
                }
            }

            // Second pass: check for pre-game games and return start time
            for (const game of games) {
                const state = game.status?.type?.state;
                if (state !== 'pre') continue;

                const competition = game.competitions?.[0];
                const homeTeam = competition?.competitors?.find(c => c.homeAway === 'home');
                const awayTeam = competition?.competitors?.find(c => c.homeAway === 'away');

                return {
                    current: 0,
                    found: true,
                    noGame: false,
                    notStarted: true,
                    gameStatus: game.status?.type?.shortDetail || game.status?.type?.detail,
                    gameInfo: `${awayTeam?.team?.abbreviation} vs ${homeTeam?.team?.abbreviation}`,
                    isLive: false
                };
            }

            return { current: 0, found: false, noGame: true, message: 'Player not in today\'s NFL games' };

        } catch (error) {
            console.error('Error getting NFL stats:', error);
            return { current: 0, found: false, error: true };
        }
    },

    // ==================== Team Bet Methods ====================

    // Find game by team abbreviation
    findGameByTeam(games, teamAbbrev, sport) {
        teamAbbrev = teamAbbrev.toUpperCase();

        for (const game of games) {
            if (sport === 'nfl') {
                const competition = game.competitions?.[0];
                const homeAbbrev = competition?.competitors?.find(c => c.homeAway === 'home')?.team?.abbreviation;
                const awayAbbrev = competition?.competitors?.find(c => c.homeAway === 'away')?.team?.abbreviation;

                if (homeAbbrev === teamAbbrev || awayAbbrev === teamAbbrev) {
                    return game;
                }
            } else {
                // NBA format
                if (game.homeTeam?.teamTricode === teamAbbrev || game.awayTeam?.teamTricode === teamAbbrev) {
                    return game;
                }
            }
        }
        return null;
    },

    // Parse game data into common format
    parseGameData(game, sport) {
        if (sport === 'nfl') {
            const competition = game.competitions?.[0];
            const homeTeam = competition?.competitors?.find(c => c.homeAway === 'home');
            const awayTeam = competition?.competitors?.find(c => c.homeAway === 'away');

            return {
                homeTeam: homeTeam?.team?.abbreviation,
                awayTeam: awayTeam?.team?.abbreviation,
                homeScore: parseInt(homeTeam?.score) || 0,
                awayScore: parseInt(awayTeam?.score) || 0,
                isLive: game.status?.type?.state === 'in',
                isComplete: game.status?.type?.completed,
                statusText: game.status?.type?.shortDetail || game.status?.type?.detail
            };
        } else {
            // NBA format
            return {
                homeTeam: game.homeTeam?.teamTricode,
                awayTeam: game.awayTeam?.teamTricode,
                homeScore: game.homeTeam?.score || 0,
                awayScore: game.awayTeam?.score || 0,
                isLive: game.gameStatus === 2,
                isComplete: game.gameStatus === 3,
                statusText: game.gameStatusText
            };
        }
    },

    // Evaluate moneyline bet
    evaluateMoneyline(gameData, bet) {
        const isHome = gameData.homeTeam === bet.teamAbbrev;
        const teamScore = isHome ? gameData.homeScore : gameData.awayScore;
        const oppScore = isHome ? gameData.awayScore : gameData.homeScore;
        const oppTeam = isHome ? gameData.awayTeam : gameData.homeTeam;

        return {
            found: true,
            noGame: false,
            isLive: gameData.isLive,
            isComplete: gameData.isComplete,
            gameStatus: gameData.statusText,
            gameInfo: `${gameData.awayTeam} ${gameData.awayScore} - ${gameData.homeScore} ${gameData.homeTeam}`,
            teamScore,
            opponentScore: oppScore,
            opponentName: oppTeam,
            winning: teamScore > oppScore,
            tied: teamScore === oppScore
        };
    },

    // Evaluate spread bet
    evaluateSpread(gameData, bet) {
        const isHome = gameData.homeTeam === bet.teamAbbrev;
        const teamScore = isHome ? gameData.homeScore : gameData.awayScore;
        const oppScore = isHome ? gameData.awayScore : gameData.homeScore;
        const oppTeam = isHome ? gameData.awayTeam : gameData.homeTeam;

        const adjustedScore = teamScore + bet.spread;
        const covering = adjustedScore > oppScore;
        const margin = adjustedScore - oppScore;

        return {
            found: true,
            noGame: false,
            isLive: gameData.isLive,
            isComplete: gameData.isComplete,
            gameStatus: gameData.statusText,
            gameInfo: `${gameData.awayTeam} ${gameData.awayScore} - ${gameData.homeScore} ${gameData.homeTeam}`,
            teamScore,
            opponentScore: oppScore,
            opponentName: oppTeam,
            covering,
            margin: margin.toFixed(1)
        };
    },

    // Evaluate game total bet
    evaluateTotal(gameData, bet) {
        const totalScore = gameData.homeScore + gameData.awayScore;
        const hitting = bet.direction === 'over'
            ? totalScore > bet.target
            : totalScore < bet.target;

        return {
            found: true,
            noGame: false,
            isLive: gameData.isLive,
            isComplete: gameData.isComplete,
            gameStatus: gameData.statusText,
            gameInfo: `${gameData.awayTeam} ${gameData.awayScore} - ${gameData.homeScore} ${gameData.homeTeam}`,
            team1Score: gameData.awayScore,
            team2Score: gameData.homeScore,
            currentTotal: totalScore,
            hitting
        };
    },

    // Get team bet status
    async getTeamBetStatus(bet) {
        try {
            const games = bet.sport === 'nfl'
                ? await this.getNFLGames()
                : await this.getTodaysGames();

            const teamAbbrev = bet.teamAbbrev || bet.team1Abbrev;
            const game = this.findGameByTeam(games, teamAbbrev, bet.sport);

            if (!game) {
                return { found: false, noGame: true, message: 'No game today' };
            }

            const gameData = this.parseGameData(game, bet.sport);

            // Check if game hasn't started yet
            if (bet.sport === 'nfl' && game.status?.type?.state === 'pre') {
                return {
                    found: true,
                    noGame: false,
                    notStarted: true,
                    gameStatus: gameData.statusText,
                    gameInfo: `${gameData.awayTeam} vs ${gameData.homeTeam}`
                };
            }
            if (bet.sport === 'nba' && game.gameStatus < 2) {
                return {
                    found: true,
                    noGame: false,
                    notStarted: true,
                    gameStatus: gameData.statusText,
                    gameInfo: `${gameData.awayTeam} vs ${gameData.homeTeam}`
                };
            }

            switch (bet.betType) {
                case 'team_moneyline':
                    return this.evaluateMoneyline(gameData, bet);
                case 'team_spread':
                    return this.evaluateSpread(gameData, bet);
                case 'team_total':
                    return this.evaluateTotal(gameData, bet);
                default:
                    return { found: false, error: true, message: 'Unknown bet type' };
            }
        } catch (error) {
            console.error('Error getting team bet status:', error);
            return { found: false, error: true };
        }
    },

    // ==================== Unified Entry Point ====================

    // Main entry point for all stat fetching
    async getStats(bet) {
        if (bet.betType === 'player_prop') {
            if (bet.sport === 'nfl') {
                return await this.getNFLPlayerStats(bet.playerName, bet.statType);
            } else {
                return await this.getLiveStats(bet.playerName, bet.statType);
            }
        } else {
            return await this.getTeamBetStatus(bet);
        }
    }
};

window.SportsAPI = SportsAPI;

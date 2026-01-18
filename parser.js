// Natural Language Parser for Player Props and Team Bets
// Understands inputs like:
// - "immanuel quickley 4+ assists" (NBA player prop)
// - "mahomes 300+ passing yards" (NFL player prop)
// - "Chiefs ML" (NFL moneyline)
// - "Lakers -5.5" (NBA spread)
// - "Over 45.5 Chiefs Lions" (NFL game total)

const PropParser = {
    // NBA stat type mappings
    nbaStatMappings: {
        // Points
        'points': 'points',
        'pts': 'points',
        'point': 'points',
        'pt': 'points',

        // Rebounds
        'rebounds': 'rebounds',
        'rebs': 'rebounds',
        'reb': 'rebounds',
        'boards': 'rebounds',

        // Assists
        'assists': 'assists',
        'ast': 'assists',
        'asts': 'assists',
        'assist': 'assists',
        'dimes': 'assists',

        // 3-Pointers
        '3s': 'threes',
        '3pm': 'threes',
        'threes': 'threes',
        'three': 'threes',
        '3-pointers': 'threes',
        '3 pointers': 'threes',
        'triples': 'threes',
        'treys': 'threes',

        // Steals
        'steals': 'steals',
        'stl': 'steals',
        'stls': 'steals',
        'steal': 'steals',

        // Blocks
        'blocks': 'blocks',
        'blk': 'blocks',
        'blks': 'blocks',
        'block': 'blocks',

        // Combos
        'pra': 'pts+reb+ast',
        'p+r+a': 'pts+reb+ast',
        'pts+reb+ast': 'pts+reb+ast',
        'points rebounds assists': 'pts+reb+ast',

        'pr': 'pts+reb',
        'p+r': 'pts+reb',
        'pts+reb': 'pts+reb',
        'points rebounds': 'pts+reb',

        'pa': 'pts+ast',
        'p+a': 'pts+ast',
        'pts+ast': 'pts+ast',
        'points assists': 'pts+ast',

        'ra': 'reb+ast',
        'r+a': 'reb+ast',
        'reb+ast': 'reb+ast',
        'rebounds assists': 'reb+ast',

        // Fantasy
        'fantasy': 'fantasy',
        'fpts': 'fantasy',
        'fp': 'fantasy'
    },

    // NFL stat type mappings
    nflStatMappings: {
        // Passing
        'passing yards': 'pass_yards',
        'pass yards': 'pass_yards',
        'pass yds': 'pass_yards',
        'passing yds': 'pass_yards',
        'passing': 'pass_yards',

        // Rushing
        'rushing yards': 'rush_yards',
        'rush yards': 'rush_yards',
        'rush yds': 'rush_yards',
        'rushing yds': 'rush_yards',
        'rushing': 'rush_yards',

        // Receiving
        'receiving yards': 'rec_yards',
        'rec yards': 'rec_yards',
        'rec yds': 'rec_yards',
        'receiving yds': 'rec_yards',
        'receiving': 'rec_yards',

        // Receptions
        'receptions': 'receptions',
        'catches': 'receptions',
        'recs': 'receptions',

        // Touchdowns
        'passing touchdowns': 'pass_td',
        'pass td': 'pass_td',
        'pass tds': 'pass_td',
        'passing tds': 'pass_td',
        'rushing touchdowns': 'rush_td',
        'rush td': 'rush_td',
        'rush tds': 'rush_td',
        'receiving touchdowns': 'rec_td',
        'rec td': 'rec_td',
        'rec tds': 'rec_td',
        'touchdowns': 'any_td',
        'tds': 'any_td',
        'td': 'any_td',
        'anytime touchdown': 'any_td',
        'anytime td': 'any_td',

        // Interceptions thrown
        'interceptions': 'interceptions',
        'ints': 'interceptions',
        'int': 'interceptions',

        // Completions
        'completions': 'completions',
        'comps': 'completions',
        'comp': 'completions'
    },

    // NFL Teams
    nflTeams: {
        'arizona cardinals': { abbrev: 'ARI', name: 'Cardinals' },
        'cardinals': { abbrev: 'ARI', name: 'Cardinals' },
        'atlanta falcons': { abbrev: 'ATL', name: 'Falcons' },
        'falcons': { abbrev: 'ATL', name: 'Falcons' },
        'baltimore ravens': { abbrev: 'BAL', name: 'Ravens' },
        'ravens': { abbrev: 'BAL', name: 'Ravens' },
        'buffalo bills': { abbrev: 'BUF', name: 'Bills' },
        'bills': { abbrev: 'BUF', name: 'Bills' },
        'carolina panthers': { abbrev: 'CAR', name: 'Panthers' },
        'panthers': { abbrev: 'CAR', name: 'Panthers' },
        'chicago bears': { abbrev: 'CHI', name: 'Bears' },
        'bears': { abbrev: 'CHI', name: 'Bears' },
        'cincinnati bengals': { abbrev: 'CIN', name: 'Bengals' },
        'bengals': { abbrev: 'CIN', name: 'Bengals' },
        'cleveland browns': { abbrev: 'CLE', name: 'Browns' },
        'browns': { abbrev: 'CLE', name: 'Browns' },
        'dallas cowboys': { abbrev: 'DAL', name: 'Cowboys' },
        'cowboys': { abbrev: 'DAL', name: 'Cowboys' },
        'denver broncos': { abbrev: 'DEN', name: 'Broncos' },
        'broncos': { abbrev: 'DEN', name: 'Broncos' },
        'detroit lions': { abbrev: 'DET', name: 'Lions' },
        'lions': { abbrev: 'DET', name: 'Lions' },
        'green bay packers': { abbrev: 'GB', name: 'Packers' },
        'packers': { abbrev: 'GB', name: 'Packers' },
        'houston texans': { abbrev: 'HOU', name: 'Texans' },
        'texans': { abbrev: 'HOU', name: 'Texans' },
        'indianapolis colts': { abbrev: 'IND', name: 'Colts' },
        'colts': { abbrev: 'IND', name: 'Colts' },
        'jacksonville jaguars': { abbrev: 'JAX', name: 'Jaguars' },
        'jaguars': { abbrev: 'JAX', name: 'Jaguars' },
        'jags': { abbrev: 'JAX', name: 'Jaguars' },
        'kansas city chiefs': { abbrev: 'KC', name: 'Chiefs' },
        'chiefs': { abbrev: 'KC', name: 'Chiefs' },
        'las vegas raiders': { abbrev: 'LV', name: 'Raiders' },
        'raiders': { abbrev: 'LV', name: 'Raiders' },
        'los angeles chargers': { abbrev: 'LAC', name: 'Chargers' },
        'chargers': { abbrev: 'LAC', name: 'Chargers' },
        'los angeles rams': { abbrev: 'LAR', name: 'Rams' },
        'rams': { abbrev: 'LAR', name: 'Rams' },
        'miami dolphins': { abbrev: 'MIA', name: 'Dolphins' },
        'dolphins': { abbrev: 'MIA', name: 'Dolphins' },
        'minnesota vikings': { abbrev: 'MIN', name: 'Vikings' },
        'vikings': { abbrev: 'MIN', name: 'Vikings' },
        'new england patriots': { abbrev: 'NE', name: 'Patriots' },
        'patriots': { abbrev: 'NE', name: 'Patriots' },
        'pats': { abbrev: 'NE', name: 'Patriots' },
        'new orleans saints': { abbrev: 'NO', name: 'Saints' },
        'saints': { abbrev: 'NO', name: 'Saints' },
        'new york giants': { abbrev: 'NYG', name: 'Giants' },
        'giants': { abbrev: 'NYG', name: 'Giants' },
        'new york jets': { abbrev: 'NYJ', name: 'Jets' },
        'jets': { abbrev: 'NYJ', name: 'Jets' },
        'philadelphia eagles': { abbrev: 'PHI', name: 'Eagles' },
        'eagles': { abbrev: 'PHI', name: 'Eagles' },
        'pittsburgh steelers': { abbrev: 'PIT', name: 'Steelers' },
        'steelers': { abbrev: 'PIT', name: 'Steelers' },
        'san francisco 49ers': { abbrev: 'SF', name: '49ers' },
        '49ers': { abbrev: 'SF', name: '49ers' },
        'niners': { abbrev: 'SF', name: '49ers' },
        'seattle seahawks': { abbrev: 'SEA', name: 'Seahawks' },
        'seahawks': { abbrev: 'SEA', name: 'Seahawks' },
        'tampa bay buccaneers': { abbrev: 'TB', name: 'Buccaneers' },
        'buccaneers': { abbrev: 'TB', name: 'Buccaneers' },
        'bucs': { abbrev: 'TB', name: 'Buccaneers' },
        'tennessee titans': { abbrev: 'TEN', name: 'Titans' },
        'titans': { abbrev: 'TEN', name: 'Titans' },
        'washington commanders': { abbrev: 'WAS', name: 'Commanders' },
        'commanders': { abbrev: 'WAS', name: 'Commanders' }
    },

    // NBA Teams
    nbaTeams: {
        'atlanta hawks': { abbrev: 'ATL', name: 'Hawks' },
        'hawks': { abbrev: 'ATL', name: 'Hawks' },
        'boston celtics': { abbrev: 'BOS', name: 'Celtics' },
        'celtics': { abbrev: 'BOS', name: 'Celtics' },
        'brooklyn nets': { abbrev: 'BKN', name: 'Nets' },
        'nets': { abbrev: 'BKN', name: 'Nets' },
        'charlotte hornets': { abbrev: 'CHA', name: 'Hornets' },
        'hornets': { abbrev: 'CHA', name: 'Hornets' },
        'chicago bulls': { abbrev: 'CHI', name: 'Bulls' },
        'bulls': { abbrev: 'CHI', name: 'Bulls' },
        'cleveland cavaliers': { abbrev: 'CLE', name: 'Cavaliers' },
        'cavaliers': { abbrev: 'CLE', name: 'Cavaliers' },
        'cavs': { abbrev: 'CLE', name: 'Cavaliers' },
        'dallas mavericks': { abbrev: 'DAL', name: 'Mavericks' },
        'mavericks': { abbrev: 'DAL', name: 'Mavericks' },
        'mavs': { abbrev: 'DAL', name: 'Mavericks' },
        'denver nuggets': { abbrev: 'DEN', name: 'Nuggets' },
        'nuggets': { abbrev: 'DEN', name: 'Nuggets' },
        'detroit pistons': { abbrev: 'DET', name: 'Pistons' },
        'pistons': { abbrev: 'DET', name: 'Pistons' },
        'golden state warriors': { abbrev: 'GSW', name: 'Warriors' },
        'warriors': { abbrev: 'GSW', name: 'Warriors' },
        'houston rockets': { abbrev: 'HOU', name: 'Rockets' },
        'rockets': { abbrev: 'HOU', name: 'Rockets' },
        'indiana pacers': { abbrev: 'IND', name: 'Pacers' },
        'pacers': { abbrev: 'IND', name: 'Pacers' },
        'los angeles clippers': { abbrev: 'LAC', name: 'Clippers' },
        'clippers': { abbrev: 'LAC', name: 'Clippers' },
        'los angeles lakers': { abbrev: 'LAL', name: 'Lakers' },
        'lakers': { abbrev: 'LAL', name: 'Lakers' },
        'memphis grizzlies': { abbrev: 'MEM', name: 'Grizzlies' },
        'grizzlies': { abbrev: 'MEM', name: 'Grizzlies' },
        'miami heat': { abbrev: 'MIA', name: 'Heat' },
        'heat': { abbrev: 'MIA', name: 'Heat' },
        'milwaukee bucks': { abbrev: 'MIL', name: 'Bucks' },
        'bucks': { abbrev: 'MIL', name: 'Bucks' },
        'minnesota timberwolves': { abbrev: 'MIN', name: 'Timberwolves' },
        'timberwolves': { abbrev: 'MIN', name: 'Timberwolves' },
        'wolves': { abbrev: 'MIN', name: 'Timberwolves' },
        'new orleans pelicans': { abbrev: 'NOP', name: 'Pelicans' },
        'pelicans': { abbrev: 'NOP', name: 'Pelicans' },
        'new york knicks': { abbrev: 'NYK', name: 'Knicks' },
        'knicks': { abbrev: 'NYK', name: 'Knicks' },
        'oklahoma city thunder': { abbrev: 'OKC', name: 'Thunder' },
        'thunder': { abbrev: 'OKC', name: 'Thunder' },
        'orlando magic': { abbrev: 'ORL', name: 'Magic' },
        'magic': { abbrev: 'ORL', name: 'Magic' },
        'philadelphia 76ers': { abbrev: 'PHI', name: '76ers' },
        '76ers': { abbrev: 'PHI', name: '76ers' },
        'sixers': { abbrev: 'PHI', name: '76ers' },
        'phoenix suns': { abbrev: 'PHX', name: 'Suns' },
        'suns': { abbrev: 'PHX', name: 'Suns' },
        'portland trail blazers': { abbrev: 'POR', name: 'Trail Blazers' },
        'trail blazers': { abbrev: 'POR', name: 'Trail Blazers' },
        'blazers': { abbrev: 'POR', name: 'Trail Blazers' },
        'sacramento kings': { abbrev: 'SAC', name: 'Kings' },
        'kings': { abbrev: 'SAC', name: 'Kings' },
        'san antonio spurs': { abbrev: 'SAS', name: 'Spurs' },
        'spurs': { abbrev: 'SAS', name: 'Spurs' },
        'toronto raptors': { abbrev: 'TOR', name: 'Raptors' },
        'raptors': { abbrev: 'TOR', name: 'Raptors' },
        'utah jazz': { abbrev: 'UTA', name: 'Jazz' },
        'jazz': { abbrev: 'UTA', name: 'Jazz' },
        'washington wizards': { abbrev: 'WAS', name: 'Wizards' },
        'wizards': { abbrev: 'WAS', name: 'Wizards' }
    },

    // Combined stat mappings (for backward compatibility)
    get statMappings() {
        return { ...this.nbaStatMappings, ...this.nflStatMappings };
    },

    // Find a team by name
    findTeam(name) {
        name = name.toLowerCase().trim();

        // Check NFL teams first (they have more distinctive names)
        if (this.nflTeams[name]) {
            return { ...this.nflTeams[name], sport: 'nfl' };
        }

        // Check NBA teams
        if (this.nbaTeams[name]) {
            return { ...this.nbaTeams[name], sport: 'nba' };
        }

        return null;
    },

    // Detect sport from stat type
    detectSportFromStat(statType) {
        const nflStats = ['pass_yards', 'rush_yards', 'rec_yards', 'receptions',
                          'pass_td', 'rush_td', 'rec_td', 'any_td', 'interceptions',
                          'completions'];

        if (nflStats.includes(statType)) {
            return 'nfl';
        }

        return 'nba';
    },

    // Parse team bet (moneyline, spread, or total)
    parseTeamBet(text) {
        text = text.trim().toLowerCase();

        // Pattern: "Chiefs ML" or "Chiefs moneyline"
        const mlPattern = /^(.+?)\s+(ml|moneyline)$/i;

        // Pattern: "Chiefs -3.5" or "Chiefs +7"
        const spreadPattern = /^(.+?)\s+([+-]\d+\.?\d*)$/;

        // Pattern: "Over 45.5 Chiefs Lions" or "Under 220 Lakers Celtics" or "Chiefs Lions Over 45.5"
        const totalPattern1 = /^(over|under)\s+(\d+\.?\d*)\s+(.+?)\s+(?:vs?\.?\s+)?(.+)$/i;
        const totalPattern2 = /^(.+?)\s+(?:vs?\.?\s+)?(.+?)\s+(over|under)\s+(\d+\.?\d*)$/i;

        let match;

        // Try moneyline
        match = text.match(mlPattern);
        if (match) {
            const team = this.findTeam(match[1].trim());
            if (team) {
                return {
                    betType: 'team_moneyline',
                    sport: team.sport,
                    teamName: team.name,
                    teamAbbrev: team.abbrev,
                    displayText: `${team.name} ML`
                };
            }
        }

        // Try spread
        match = text.match(spreadPattern);
        if (match) {
            const team = this.findTeam(match[1].trim());
            if (team) {
                const spread = parseFloat(match[2]);
                const spreadDisplay = spread > 0 ? `+${spread}` : `${spread}`;
                return {
                    betType: 'team_spread',
                    sport: team.sport,
                    teamName: team.name,
                    teamAbbrev: team.abbrev,
                    spread: spread,
                    displayText: `${team.name} ${spreadDisplay}`
                };
            }
        }

        // Try game total (format 1: "Over 45.5 Chiefs Lions")
        match = text.match(totalPattern1);
        if (match) {
            const team1 = this.findTeam(match[3].trim());
            const team2 = this.findTeam(match[4].trim());
            if (team1 && team2 && team1.sport === team2.sport) {
                return {
                    betType: 'team_total',
                    sport: team1.sport,
                    team1Name: team1.name,
                    team1Abbrev: team1.abbrev,
                    team2Name: team2.name,
                    team2Abbrev: team2.abbrev,
                    target: parseFloat(match[2]),
                    direction: match[1].toLowerCase(),
                    displayText: `${match[1].toUpperCase()} ${match[2]}`
                };
            }
        }

        // Try game total (format 2: "Chiefs Lions Over 45.5")
        match = text.match(totalPattern2);
        if (match) {
            const team1 = this.findTeam(match[1].trim());
            const team2 = this.findTeam(match[2].trim());
            if (team1 && team2 && team1.sport === team2.sport) {
                return {
                    betType: 'team_total',
                    sport: team1.sport,
                    team1Name: team1.name,
                    team1Abbrev: team1.abbrev,
                    team2Name: team2.name,
                    team2Abbrev: team2.abbrev,
                    target: parseFloat(match[4]),
                    direction: match[3].toLowerCase(),
                    displayText: `${match[3].toUpperCase()} ${match[4]}`
                };
            }
        }

        return null;
    },

    // Main entry point - parse any bet type
    parseBet(text) {
        text = text.trim();

        // Check for explicit sport prefix
        let forceSport = null;
        if (text.toLowerCase().startsWith('nfl:') || text.toLowerCase().startsWith('nfl ')) {
            forceSport = 'nfl';
            text = text.replace(/^nfl[:\s]+/i, '');
        } else if (text.toLowerCase().startsWith('nba:') || text.toLowerCase().startsWith('nba ')) {
            forceSport = 'nba';
            text = text.replace(/^nba[:\s]+/i, '');
        }

        // Try team bet first
        const teamBet = this.parseTeamBet(text);
        if (teamBet) {
            if (forceSport) teamBet.sport = forceSport;
            return teamBet;
        }

        // Fall back to player prop
        return this.parseSingleProp(text, forceSport);
    },

    // Parse a single prop string like "karl-anthony towns 15+ points"
    parseSingleProp(text, forceSport = null) {
        text = text.trim().toLowerCase();

        if (!text) return null;

        let playerName = '';
        let target = 0;
        let statType = '';
        let direction = 'over'; // default to over

        // Check for "under" keyword
        if (text.includes(' under ')) {
            direction = 'under';
            text = text.replace(' under ', ' ');
        } else if (text.includes(' over ')) {
            direction = 'over';
            text = text.replace(' over ', ' ');
        }

        // Try to find number with + or - suffix (e.g., "15+", "20-")
        const plusMinusPattern = /(\d+\.?\d*)\s*([+-])/;
        const plusMinusMatch = text.match(plusMinusPattern);

        if (plusMinusMatch) {
            target = parseFloat(plusMinusMatch[1]);
            direction = plusMinusMatch[2] === '+' ? 'over' : 'under';
            text = text.replace(plusMinusPattern, ' ').trim();
        } else {
            // Just find a number
            const numberPattern = /(\d+\.?\d*)/;
            const numberMatch = text.match(numberPattern);
            if (numberMatch) {
                target = parseFloat(numberMatch[1]);
                text = text.replace(numberPattern, ' ').trim();
            }
        }

        // Find the stat type - check NFL stats first (more specific), then NBA
        let sport = forceSport;

        // Check NFL stats first
        for (const [key, value] of Object.entries(this.nflStatMappings)) {
            const regex = new RegExp(`\\b${key}\\b`, 'i');
            if (regex.test(text)) {
                statType = value;
                sport = sport || 'nfl';
                text = text.replace(regex, '').trim();
                break;
            }
        }

        // If no NFL stat found, check NBA stats
        if (!statType) {
            for (const [key, value] of Object.entries(this.nbaStatMappings)) {
                const regex = new RegExp(`\\b${key}\\b`, 'i');
                if (regex.test(text)) {
                    statType = value;
                    sport = sport || 'nba';
                    text = text.replace(regex, '').trim();
                    break;
                }
            }
        }

        // What's left should be the player name
        playerName = text
            .replace(/[,\.\-]+$/, '') // Remove trailing punctuation
            .replace(/\s+/g, ' ')     // Normalize spaces
            .trim();

        // Capitalize player name properly
        playerName = playerName
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        // Validate we have the required fields
        if (!playerName || target === 0 || !statType) {
            return null;
        }

        return {
            betType: 'player_prop',
            sport: sport || 'nba',
            playerName,
            target,
            statType,
            direction,
            displayStat: this.getDisplayStat(statType),
            originalText: text
        };
    },

    // Parse multiple props from a string
    parseMultipleProps(text) {
        // Normalize separators
        let normalized = text
            .replace(/\band\b/gi, ',')  // "and" becomes comma
            .replace(/\n/g, ',')         // newlines become commas
            .replace(/;/g, ',');         // semicolons become commas

        // Split by comma
        const parts = normalized.split(',').map(p => p.trim()).filter(p => p);

        const props = [];
        for (const part of parts) {
            const parsed = this.parseBet(part);
            if (parsed) {
                props.push(parsed);
            }
        }

        return props;
    },

    // Get display-friendly stat name
    getDisplayStat(statType) {
        const displayNames = {
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
        return displayNames[statType] || statType.toUpperCase();
    },

    // Get full stat name
    getFullStatName(statType) {
        const fullNames = {
            // NBA
            'points': 'Points',
            'rebounds': 'Rebounds',
            'assists': 'Assists',
            'threes': '3-Pointers',
            'steals': 'Steals',
            'blocks': 'Blocks',
            'pts+reb': 'Points + Rebounds',
            'pts+ast': 'Points + Assists',
            'reb+ast': 'Rebounds + Assists',
            'pts+reb+ast': 'Pts + Reb + Ast',
            'fantasy': 'Fantasy Points',
            // NFL
            'pass_yards': 'Passing Yards',
            'rush_yards': 'Rushing Yards',
            'rec_yards': 'Receiving Yards',
            'receptions': 'Receptions',
            'pass_td': 'Passing TDs',
            'rush_td': 'Rushing TDs',
            'rec_td': 'Receiving TDs',
            'any_td': 'Touchdowns',
            'interceptions': 'Interceptions',
            'completions': 'Completions'
        };
        return fullNames[statType] || statType;
    }
};

// Export for use
window.PropParser = PropParser;

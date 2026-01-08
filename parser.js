// Natural Language Parser for Player Props
// Understands inputs like:
// - "immanuel quickley 4+ assists"
// - "karl-anthony towns over 15 points"
// - "jalen johnson 18+ points"
// - "lebron under 25 pts"

const PropParser = {
    // Stat type mappings (various ways people might type stats)
    statMappings: {
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

    // Parse a single prop string like "karl-anthony towns 15+ points"
    parseSingleProp(text) {
        text = text.trim().toLowerCase();

        if (!text) return null;

        // Pattern 1: "player name NUMBER+ stat" (e.g., "kat 15+ points")
        // Pattern 2: "player name over/under NUMBER stat"
        // Pattern 3: "player name NUMBER stat" (assume over)

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

        // Find the stat type
        for (const [key, value] of Object.entries(this.statMappings)) {
            const regex = new RegExp(`\\b${key}\\b`, 'i');
            if (regex.test(text)) {
                statType = value;
                text = text.replace(regex, '').trim();
                break;
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
            playerName,
            target,
            statType,
            direction,
            displayStat: this.getDisplayStat(statType),
            originalText: text
        };
    },

    // Parse multiple props from a string
    // Handles comma-separated, "and" separated, or newline separated
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
            const parsed = this.parseSingleProp(part);
            if (parsed) {
                props.push(parsed);
            }
        }

        return props;
    },

    // Get display-friendly stat name
    getDisplayStat(statType) {
        const displayNames = {
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
        return displayNames[statType] || statType.toUpperCase();
    },

    // Get full stat name
    getFullStatName(statType) {
        const fullNames = {
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
            'fantasy': 'Fantasy Points'
        };
        return fullNames[statType] || statType;
    }
};

// Export for use
window.PropParser = PropParser;

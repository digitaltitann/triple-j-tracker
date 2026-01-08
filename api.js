// Sports API Integration for Live Stats
// Note: Free live stats APIs are limited - stats are updated manually

const SportsAPI = {
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

    // For now, just return that we found the player (manual updates)
    async getLiveStats(playerName, statType) {
        // Return as found - user will manually update stats
        return {
            current: 0,
            found: true,
            noGame: false,
            manual: true
        };
    }
};

window.SportsAPI = SportsAPI;

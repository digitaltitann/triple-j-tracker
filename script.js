// Live Stats Tracker - Main Script

// Tracked players stored in localStorage
let trackedPlayers = JSON.parse(localStorage.getItem('trackedPlayers')) || [];

// DOM Elements
const statsInput = document.getElementById('stats-input');
const trackBtn = document.getElementById('track-btn');
const statsContainer = document.getElementById('stats-container');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderCards();

    // Auto-refresh every 30 seconds
    setInterval(refreshAllStats, 30000);
});

// Track button click
trackBtn.addEventListener('click', handleTrack);

// Also handle Enter key (with Ctrl/Cmd for multi-line)
statsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleTrack();
    }
});

// Handle tracking input
function handleTrack() {
    const input = statsInput.value.trim();
    if (!input) return;

    // Parse the input
    const parsed = PropParser.parseMultipleProps(input);

    if (parsed.length === 0) {
        alert('Could not understand the input. Try something like:\n"lebron james 25+ points, anthony davis 10+ rebounds"');
        return;
    }

    // Add each parsed prop
    for (const prop of parsed) {
        const player = {
            id: Date.now() + Math.random(),
            playerName: prop.playerName,
            target: prop.target,
            statType: prop.statType,
            direction: prop.direction,
            displayStat: prop.displayStat,
            current: 0,
            lastUpdated: null
        };

        trackedPlayers.push(player);
    }

    save();
    statsInput.value = '';
    renderCards();

    // Fetch stats for newly added players
    fetchStatsForNew(parsed.length);
}

// Fetch stats for recently added players
async function fetchStatsForNew(count) {
    const newPlayers = trackedPlayers.slice(-count);

    for (const player of newPlayers) {
        await fetchStatsForPlayer(player);
        await delay(300); // Small delay between requests
    }
}

// Fetch stats for a single player
async function fetchStatsForPlayer(player) {
    const result = await SportsAPI.getLiveStats(player.playerName, player.statType);

    player.current = result.current;
    player.lastUpdated = new Date().toISOString();
    player.found = result.found;
    player.noGame = result.noGame;
    player.minutes = result.minutes;
    player.gameStatus = result.gameStatus;

    save();
    renderCards();
}

// Refresh all stats
async function refreshAllStats() {
    if (trackedPlayers.length === 0) return;

    const refreshBtn = document.querySelector('.btn-refresh');
    refreshBtn?.classList.add('loading');

    for (const player of trackedPlayers) {
        await fetchStatsForPlayer(player);
        await delay(300);
    }

    refreshBtn?.classList.remove('loading');
}

// Render all cards
function renderCards() {
    if (trackedPlayers.length === 0) {
        statsContainer.innerHTML = `
            <div class="empty-state">
                <p>No stats being tracked yet.</p>
                <p class="hint">Type some player props above to get started!</p>
            </div>
        `;
        return;
    }

    statsContainer.innerHTML = trackedPlayers.map(player => renderCard(player)).join('');
}

// Render a single stat card
function renderCard(player) {
    const current = player.current || 0;
    const target = player.target || 0;
    const isOver = player.direction === 'over';

    // Calculate progress percentage
    let progress = target > 0 ? (current / target) * 100 : 0;

    // Determine status
    let status, statusText;
    if (isOver) {
        if (current >= target) {
            status = 'hitting';
            statusText = 'HITTING';
        } else if (current >= target * 0.7) {
            status = 'close';
            statusText = 'CLOSE';
        } else {
            status = 'not-hitting';
            statusText = 'NEEDS MORE';
        }
    } else {
        // Under bet
        if (current < target * 0.8) {
            status = 'hitting';
            statusText = 'ON PACE';
        } else if (current < target) {
            status = 'close';
            statusText = 'CLOSE';
        } else {
            status = 'not-hitting';
            statusText = 'OVER';
        }
    }

    // For players not found or no game
    if (player.found === false) {
        status = 'pending';
        statusText = 'NOT FOUND';
    } else if (player.noGame) {
        status = 'pending';
        statusText = 'NO GAME';
    }

    const directionSymbol = isOver ? '+' : '-';
    const targetDisplay = `${player.target}${directionSymbol} ${player.displayStat}`;

    return `
        <div class="stat-card ${status}">
            <button class="card-remove" onclick="removePlayer('${player.id}')">&times;</button>

            <div class="player-name">${player.playerName}</div>
            <div class="target-line">${targetDisplay}</div>

            <div class="stat-display">
                <div class="current-value ${status}">${current}</div>
                <div class="target-value">
                    <div class="target-label">TARGET</div>
                    <div class="target-number">${target}</div>
                </div>
            </div>

            <div class="progress-bar">
                <div class="progress-fill ${status}" style="width: ${Math.min(progress, 100)}%"></div>
            </div>

            <div class="card-footer">
                <span class="status-badge ${status}">${statusText}</span>
                <button class="btn-update" onclick="updateManually('${player.id}')">Update</button>
            </div>
        </div>
    `;
}

// Remove a player from tracking
function removePlayer(id) {
    trackedPlayers = trackedPlayers.filter(p => p.id != id);
    save();
    renderCards();
}

// Manually update a player's stat
function updateManually(id) {
    const player = trackedPlayers.find(p => p.id == id);
    if (!player) return;

    const newValue = prompt(`Enter current ${player.displayStat} for ${player.playerName}:`, player.current);

    if (newValue !== null && !isNaN(parseFloat(newValue))) {
        player.current = parseFloat(newValue);
        player.lastUpdated = new Date().toISOString();
        save();
        renderCards();
    }
}

// Clear all tracked players
function clearAll() {
    if (trackedPlayers.length === 0) return;

    if (confirm('Clear all tracked stats?')) {
        trackedPlayers = [];
        save();
        renderCards();
    }
}

// Save to localStorage
function save() {
    localStorage.setItem('trackedPlayers', JSON.stringify(trackedPlayers));
}

// Utility delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Make functions available globally
window.removePlayer = removePlayer;
window.updateManually = updateManually;
window.clearAll = clearAll;
window.refreshAllStats = refreshAllStats;

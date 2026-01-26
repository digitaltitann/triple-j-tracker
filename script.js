// Live Stats Tracker - Main Script

// Tracked players stored in localStorage
let trackedPlayers = JSON.parse(localStorage.getItem('trackedPlayers')) || [];

// DOM Elements
const statsInput = document.getElementById('stats-input');
const trackBtn = document.getElementById('track-btn');
const statsContainer = document.getElementById('stats-container');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    migrateData();
    renderCards();

    // Auto-refresh every 30 seconds
    setInterval(refreshAllStats, 30000);
});

// Migrate old data format to new format
function migrateData() {
    let needsSave = false;
    for (const bet of trackedPlayers) {
        if (!bet.betType) {
            bet.betType = 'player_prop';
            needsSave = true;
        }
        if (!bet.sport) {
            bet.sport = 'nba';
            needsSave = true;
        }
    }
    if (needsSave) {
        save();
    }
}

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
        alert('Could not understand the input. Try:\n' +
              '- Player props: "lebron 25+ points", "mahomes 300+ passing yards"\n' +
              '- Moneyline: "Chiefs ML", "Lakers moneyline"\n' +
              '- Spread: "Chiefs -3.5", "Celtics +7"\n' +
              '- Game total: "Over 45.5 Chiefs Lions"');
        return;
    }

    // Add each parsed bet
    for (const bet of parsed) {
        const trackedBet = {
            id: Date.now() + Math.random(),
            ...bet,
            current: 0,
            lastUpdated: null
        };

        trackedPlayers.push(trackedBet);
    }

    save();
    statsInput.value = '';
    renderCards();

    // Fetch live stats for newly added bets
    fetchStatsForNew(parsed.length);
}

// Fetch stats for recently added bets
async function fetchStatsForNew(count) {
    const newBets = trackedPlayers.slice(-count);

    for (const bet of newBets) {
        await fetchStatsForPlayer(bet);
        await delay(300); // Small delay between requests
    }
}

// Fetch stats for a single bet
async function fetchStatsForPlayer(bet) {
    const result = await SportsAPI.getStats(bet);

    // Common fields
    bet.lastUpdated = new Date().toISOString();
    bet.found = result.found;
    bet.noGame = result.noGame;
    bet.gameStatus = result.gameStatus;
    bet.gameInfo = result.gameInfo;
    bet.isLive = result.isLive;
    bet.notStarted = result.notStarted;

    // Bet-type specific fields
    if (bet.betType === 'player_prop') {
        bet.current = result.current;
        bet.minutes = result.minutes;
        bet.onCourt = result.onCourt;
    } else if (bet.betType === 'team_moneyline') {
        bet.teamScore = result.teamScore;
        bet.opponentScore = result.opponentScore;
        bet.opponentName = result.opponentName;
        bet.winning = result.winning;
        bet.tied = result.tied;
    } else if (bet.betType === 'team_spread') {
        bet.teamScore = result.teamScore;
        bet.opponentScore = result.opponentScore;
        bet.opponentName = result.opponentName;
        bet.covering = result.covering;
        bet.margin = result.margin;
    } else if (bet.betType === 'team_total') {
        bet.team1Score = result.team1Score;
        bet.team2Score = result.team2Score;
        bet.currentTotal = result.currentTotal;
        bet.hitting = result.hitting;
    }

    save();
    renderCards();
}

// Refresh all stats
async function refreshAllStats() {
    if (trackedPlayers.length === 0) return;

    const refreshBtn = document.querySelector('.btn-refresh');
    refreshBtn?.classList.add('loading');

    for (const bet of trackedPlayers) {
        await fetchStatsForPlayer(bet);
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
                <p class="hint">Type some player props or team bets above to get started!</p>
            </div>
        `;
        return;
    }

    statsContainer.innerHTML = trackedPlayers.map(bet => renderCard(bet)).join('');
}

// Route to correct card renderer
function renderCard(bet) {
    if (bet.betType === 'team_moneyline') {
        return renderMoneylineCard(bet);
    } else if (bet.betType === 'team_spread') {
        return renderSpreadCard(bet);
    } else if (bet.betType === 'team_total') {
        return renderTotalCard(bet);
    }
    // Default to player prop (including legacy data)
    return renderPlayerPropCard(bet);
}

// Render a player prop card
function renderPlayerPropCard(player) {
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

    // Handle different states
    if (player.noGame || player.found === false) {
        status = 'pending';
        statusText = 'NO GAME TODAY';
    } else if (player.notStarted) {
        status = 'pending';
        statusText = player.gameStatus || 'NOT STARTED';
    } else if (player.isLive) {
        statusText = `LIVE - ${statusText}`;
    }

    const directionSymbol = isOver ? '+' : '-';
    const targetDisplay = `${player.target}${directionSymbol} ${player.displayStat}`;

    const fireEmojis = status === 'hitting' ? '<div class="fire-container">🔥🔥🔥</div>' : '';
    const sportBadge = `<span class="sport-badge ${player.sport || 'nba'}">${(player.sport || 'nba').toUpperCase()}</span>`;

    return `
        <div class="stat-card ${status}">
            ${fireEmojis}
            <button class="card-remove" onclick="removePlayer('${player.id}')">&times;</button>

            <div class="player-name">
                ${player.playerName}
                ${sportBadge}
                ${player.isLive ? (player.onCourt ? '<span class="court-status on-court">ON COURT</span>' : (player.onCourt === false ? '<span class="court-status on-bench">BENCH</span>' : '')) : ''}
            </div>
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
                <div class="footer-left">
                    <span class="status-badge ${status}">${statusText}</span>
                    ${player.gameInfo ? `<span class="game-info">${player.gameInfo}</span>` : ''}
                    ${player.gameStatus && !player.notStarted ? `<span class="game-time">${player.gameStatus}</span>` : ''}
                </div>
                <button class="btn-update" onclick="updateManually('${player.id}')">Update</button>
            </div>
        </div>
    `;
}

// Render a moneyline card
function renderMoneylineCard(bet) {
    let status, statusText;

    if (bet.notStarted) {
        status = 'pending';
        statusText = bet.gameStatus || 'NOT STARTED';
    } else if (bet.noGame || bet.found === false) {
        status = 'pending';
        statusText = 'NO GAME TODAY';
    } else if (bet.winning) {
        status = 'hitting';
        statusText = bet.isLive ? 'LIVE - WINNING' : 'WINNING';
    } else if (bet.tied) {
        status = 'close';
        statusText = bet.isLive ? 'LIVE - TIED' : 'TIED';
    } else {
        status = 'not-hitting';
        statusText = bet.isLive ? 'LIVE - LOSING' : 'LOSING';
    }

    const fireEmojis = status === 'hitting' ? '<div class="fire-container">🔥🔥🔥</div>' : '';
    const sportBadge = `<span class="sport-badge ${bet.sport}">${bet.sport.toUpperCase()}</span>`;

    return `
        <div class="stat-card ${status}">
            ${fireEmojis}
            <button class="card-remove" onclick="removePlayer('${bet.id}')">&times;</button>

            <div class="player-name">${bet.teamName} ML ${sportBadge}</div>
            <div class="target-line">Moneyline</div>

            <div class="stat-display team-scores">
                <div class="score-block">
                    <div class="team-abbrev ${bet.winning ? 'winning' : ''}">${bet.teamAbbrev}</div>
                    <div class="current-value ${bet.winning ? 'hitting' : ''}">${bet.teamScore ?? '-'}</div>
                </div>
                <div class="score-separator">vs</div>
                <div class="score-block">
                    <div class="team-abbrev ${!bet.winning && !bet.tied ? 'losing' : ''}">${bet.opponentName || 'OPP'}</div>
                    <div class="current-value">${bet.opponentScore ?? '-'}</div>
                </div>
            </div>

            <div class="card-footer">
                <div class="footer-left">
                    <span class="status-badge ${status}">${statusText}</span>
                    ${bet.notStarted && bet.gameInfo ? `<span class="game-info">${bet.gameInfo}</span>` : ''}
                    ${bet.gameStatus && !bet.notStarted ? `<span class="game-time">${bet.gameStatus}</span>` : ''}
                </div>
                <button class="btn-update" onclick="refreshBet('${bet.id}')">Update</button>
            </div>
        </div>
    `;
}

// Render a spread card
function renderSpreadCard(bet) {
    const spreadDisplay = bet.spread > 0 ? `+${bet.spread}` : `${bet.spread}`;
    let status, statusText;

    if (bet.notStarted) {
        status = 'pending';
        statusText = bet.gameStatus || 'NOT STARTED';
    } else if (bet.noGame || bet.found === false) {
        status = 'pending';
        statusText = 'NO GAME TODAY';
    } else if (bet.covering) {
        status = 'hitting';
        const marginText = bet.margin > 0 ? `+${bet.margin}` : bet.margin;
        statusText = bet.isLive ? `LIVE - COVERING (${marginText})` : `COVERING (${marginText})`;
    } else {
        status = 'not-hitting';
        const marginText = bet.margin > 0 ? `+${bet.margin}` : bet.margin;
        statusText = bet.isLive ? `LIVE - NOT COVERING (${marginText})` : `NOT COVERING (${marginText})`;
    }

    const fireEmojis = status === 'hitting' ? '<div class="fire-container">🔥🔥🔥</div>' : '';
    const sportBadge = `<span class="sport-badge ${bet.sport}">${bet.sport.toUpperCase()}</span>`;

    return `
        <div class="stat-card ${status}">
            ${fireEmojis}
            <button class="card-remove" onclick="removePlayer('${bet.id}')">&times;</button>

            <div class="player-name">${bet.teamName} ${spreadDisplay} ${sportBadge}</div>
            <div class="target-line">Spread</div>

            <div class="stat-display team-scores">
                <div class="score-block">
                    <div class="team-abbrev">${bet.teamAbbrev}</div>
                    <div class="current-value ${bet.covering ? 'hitting' : ''}">${bet.teamScore ?? '-'}</div>
                    <div class="spread-indicator">${spreadDisplay}</div>
                </div>
                <div class="score-separator">vs</div>
                <div class="score-block">
                    <div class="team-abbrev">${bet.opponentName || 'OPP'}</div>
                    <div class="current-value">${bet.opponentScore ?? '-'}</div>
                </div>
            </div>

            <div class="card-footer">
                <div class="footer-left">
                    <span class="status-badge ${status}">${statusText}</span>
                    ${bet.notStarted && bet.gameInfo ? `<span class="game-info">${bet.gameInfo}</span>` : ''}
                    ${bet.gameStatus && !bet.notStarted ? `<span class="game-time">${bet.gameStatus}</span>` : ''}
                </div>
                <button class="btn-update" onclick="refreshBet('${bet.id}')">Update</button>
            </div>
        </div>
    `;
}

// Render a game total card
function renderTotalCard(bet) {
    const currentTotal = bet.currentTotal || 0;
    const target = bet.target || 0;
    const progress = target > 0 ? (currentTotal / target) * 100 : 0;

    let status, statusText;

    if (bet.notStarted) {
        status = 'pending';
        statusText = bet.gameStatus || 'NOT STARTED';
    } else if (bet.noGame || bet.found === false) {
        status = 'pending';
        statusText = 'NO GAME TODAY';
    } else if (bet.hitting) {
        status = 'hitting';
        statusText = bet.isLive ? 'LIVE - ON PACE' : 'ON PACE';
    } else {
        status = 'not-hitting';
        statusText = bet.isLive ? 'LIVE - OFF PACE' : 'OFF PACE';
    }

    const fireEmojis = status === 'hitting' ? '<div class="fire-container">🔥🔥🔥</div>' : '';
    const sportBadge = `<span class="sport-badge ${bet.sport}">${bet.sport.toUpperCase()}</span>`;
    const dirSymbol = bet.direction === 'over' ? 'O' : 'U';

    return `
        <div class="stat-card ${status}">
            ${fireEmojis}
            <button class="card-remove" onclick="removePlayer('${bet.id}')">&times;</button>

            <div class="player-name">${dirSymbol} ${bet.target} ${sportBadge}</div>
            <div class="target-line">${bet.team1Name} vs ${bet.team2Name}</div>

            <div class="stat-display">
                <div class="current-value ${status}">${currentTotal}</div>
                <div class="target-value">
                    <div class="target-label">${bet.direction.toUpperCase()}</div>
                    <div class="target-number">${target}</div>
                </div>
            </div>

            <div class="progress-bar">
                <div class="progress-fill ${status}" style="width: ${Math.min(progress, 100)}%"></div>
            </div>

            <div class="card-footer">
                <div class="footer-left">
                    <span class="status-badge ${status}">${statusText}</span>
                    ${bet.gameInfo ? `<span class="game-info">${bet.gameInfo}</span>` : ''}
                    ${bet.gameStatus && !bet.notStarted ? `<span class="game-time">${bet.gameStatus}</span>` : ''}
                </div>
                <button class="btn-update" onclick="refreshBet('${bet.id}')">Update</button>
            </div>
        </div>
    `;
}

// Refresh a single bet
async function refreshBet(id) {
    const bet = trackedPlayers.find(b => b.id == id);
    if (bet) {
        await fetchStatsForPlayer(bet);
    }
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

// ==================== Image Upload & AI Vision ====================

const imageInput = document.getElementById('image-input');
const ocrStatus = document.getElementById('ocr-status');

// Handle image upload
imageInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    await processImageWithAI(file);
    imageInput.value = ''; // Reset for next upload
});

// Convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Process image with Gemini Vision API (free tier)
async function processImageWithAI(file) {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
        showOCRStatus('Set your Gemini API key first (tap ⚙️ API Key)', 'error');
        return;
    }

    showOCRStatus('Analyzing bet slip...', 'loading');

    try {
        const base64Image = await fileToBase64(file);
        const mediaType = file.type || 'image/jpeg';

        const prompt = `Extract all bets from this sportsbook screenshot. For each bet, output one line in this exact format:

For player props: "PlayerName Target+ StatType"
Examples: "LeBron James 25+ points", "Mahomes 300+ passing yards", "Josh Giddey 15+ points assists"

For combo stats use these formats:
- Points + Assists → "Name 15+ points assists"
- Points + Rebounds → "Name 20+ points rebounds"
- Points + Rebounds + Assists → "Name 30+ points rebounds assists"

For spreads: "TeamName -3.5" or "TeamName +7"
For moneyline: "TeamName ML"
For game totals: "Over 220.5 Team1 Team2"

Use the team's common name (Knicks, Lakers, Chiefs, etc), not abbreviations.
Output ONLY the bet lines, one per line. No other text.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            inlineData: {
                                mimeType: mediaType,
                                data: base64Image
                            }
                        },
                        {
                            text: prompt
                        }
                    ]
                }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Gemini API error:', error);
            if (response.status === 400 && error.error?.message?.includes('API key')) {
                showOCRStatus('Invalid API key - check your key in settings', 'error');
            } else {
                showOCRStatus(`API error: ${error.error?.message || 'Unknown error'}`, 'error');
            }
            return;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('Gemini Vision Result:', text);

        if (!text.trim()) {
            showOCRStatus('Could not extract bets from image', 'error');
            return;
        }

        const lines = text.trim().split('\n').filter(l => l.trim().length > 0);
        statsInput.value = lines.join('\n');
        showOCRStatus(`Found ${lines.length} bet(s) - review and click Track`, 'success');

    } catch (error) {
        console.error('AI Vision Error:', error);
        showOCRStatus('Error connecting to API', 'error');
    }
}

// ==================== API Key Management ====================

function toggleApiKey() {
    const container = document.getElementById('api-key-container');
    container.classList.toggle('hidden');
    if (!container.classList.contains('hidden')) {
        const input = document.getElementById('api-key-input');
        const saved = localStorage.getItem('gemini_api_key');
        if (saved) {
            input.value = saved;
        }
        input.focus();
    }
}

function saveApiKey() {
    const input = document.getElementById('api-key-input');
    const key = input.value.trim();
    if (key) {
        localStorage.setItem('gemini_api_key', key);
        showOCRStatus('API key saved', 'success');
    } else {
        localStorage.removeItem('gemini_api_key');
        showOCRStatus('API key removed', 'warning');
    }
    document.getElementById('api-key-container').classList.add('hidden');
}

// Show status message
function showOCRStatus(message, type) {
    if (!ocrStatus) return;

    ocrStatus.textContent = message;
    ocrStatus.className = `ocr-status ${type}`;
    ocrStatus.classList.remove('hidden');

    if (type === 'success' || type === 'warning' || type === 'error') {
        setTimeout(() => {
            ocrStatus.classList.add('hidden');
        }, 5000);
    }
}

// Make functions available globally
window.removePlayer = removePlayer;
window.updateManually = updateManually;
window.clearAll = clearAll;
window.refreshAllStats = refreshAllStats;
window.refreshBet = refreshBet;
window.toggleApiKey = toggleApiKey;
window.saveApiKey = saveApiKey;

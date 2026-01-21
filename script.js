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

// ==================== Image Upload & OCR ====================

const imageInput = document.getElementById('image-input');
const ocrStatus = document.getElementById('ocr-status');

// Handle image upload
imageInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    await processImageWithOCR(file);
    imageInput.value = ''; // Reset for next upload
});

// Process image with Tesseract OCR
async function processImageWithOCR(file) {
    showOCRStatus('Analyzing image...', 'loading');

    try {
        const result = await Tesseract.recognize(file, 'eng', {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const pct = Math.round(m.progress * 100);
                    showOCRStatus(`Reading text... ${pct}%`, 'loading');
                }
            }
        });

        const text = result.data.text;
        console.log('OCR Result:', text);

        if (!text || text.trim().length < 3) {
            showOCRStatus('Could not read text from image', 'error');
            return;
        }

        // Try to extract bets from the OCR text
        const extractedBets = extractBetsFromOCR(text);

        if (extractedBets.length > 0) {
            // Put extracted text in the input for user review
            statsInput.value = extractedBets.join('\n');
            showOCRStatus(`Found ${extractedBets.length} potential bet(s) - review and click Track`, 'success');
        } else {
            // Put raw text in input for manual editing
            statsInput.value = cleanOCRText(text);
            showOCRStatus('Text extracted - edit as needed and click Track', 'warning');
        }

    } catch (error) {
        console.error('OCR Error:', error);
        showOCRStatus('Error reading image', 'error');
    }
}

// Extract bet-like patterns from OCR text
function extractBetsFromOCR(text) {
    const bets = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // First pass: try DraftKings multi-line format
    // DraftKings shows "10+" on one line, then "Player Name Stat Type" on next
    const dkBets = extractDraftKingsBets(lines);
    if (dkBets.length > 0) {
        return dkBets;
    }

    // Fallback: try single-line parsing
    for (const line of lines) {
        // Try to parse each line as a bet
        const parsed = PropParser.parseMultipleProps(line);
        if (parsed.length > 0) {
            bets.push(line);
            continue;
        }

        // Look for common bet patterns even if parser doesn't recognize them
        const betPatterns = [
            // Player props: "Name Over/Under X.X Stat"
            /([A-Za-z\.\s]+)\s+(over|under|o|u)\s*(\d+\.?\d*)\s*(points?|pts?|rebounds?|reb|assists?|ast|yards?|yds?|tds?|touchdowns?|receptions?|rec)/i,
            // Spreads: "Team +/-X.X"
            /([A-Za-z\s]+)\s*([+-]\d+\.?\d*)/,
            // Moneyline: "Team ML" or "Team Moneyline"
            /([A-Za-z\s]+)\s+(ml|moneyline)/i,
            // Over/Under totals: "Over/Under X.X"
            /(over|under)\s*(\d+\.?\d*)/i
        ];

        for (const pattern of betPatterns) {
            if (pattern.test(line)) {
                bets.push(line);
                break;
            }
        }
    }

    return bets;
}

// Extract bets from DraftKings format where target is on separate line from player/stat
function extractDraftKingsBets(lines) {
    const bets = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLine = lines[i + 1] || '';

        // Pattern 1: "10+" or "2+" followed by "Player Name Stat Type"
        const targetMatch = line.match(/^(\d+\.?\d*)\+?\s*$/);
        if (targetMatch && nextLine) {
            const target = targetMatch[1];
            // Check if next line has player name and stat
            const statPatterns = [
                { regex: /(.+?)\s+(rebounds?|reb)/i, stat: 'rebounds' },
                { regex: /(.+?)\s+(points?|pts)/i, stat: 'points' },
                { regex: /(.+?)\s+(assists?|ast)/i, stat: 'assists' },
                { regex: /(.+?)\s+(three\s*pointers?\s*made|threes|3pm)/i, stat: 'threes' },
                { regex: /(.+?)\s+(steals?|stl)/i, stat: 'steals' },
                { regex: /(.+?)\s+(blocks?|blk)/i, stat: 'blocks' },
                { regex: /(.+?)\s+(passing\s*yards?|pass\s*yds?)/i, stat: 'passing yards' },
                { regex: /(.+?)\s+(rushing\s*yards?|rush\s*yds?)/i, stat: 'rushing yards' },
                { regex: /(.+?)\s+(receiving\s*yards?|rec\s*yds?)/i, stat: 'receiving yards' },
                { regex: /(.+?)\s+(receptions?|rec)$/i, stat: 'receptions' },
            ];

            for (const { regex, stat } of statPatterns) {
                const match = nextLine.match(regex);
                if (match) {
                    const playerName = match[1].trim();
                    bets.push(`${playerName} ${target}+ ${stat}`);
                    i++; // Skip the next line since we consumed it
                    break;
                }
            }
            continue;
        }

        // Pattern 2: "Team -3.5" or "Team +7" spread
        const spreadMatch = line.match(/^([\w\s]+?)\s*([+-]\d+\.?\d*)$/);
        if (spreadMatch) {
            const team = spreadMatch[1].trim();
            const spread = spreadMatch[2];
            // Skip if it looks like a score or odds
            if (!team.match(/^\d/) && team.length > 2) {
                bets.push(`${team} ${spread}`);
                continue;
            }
        }

        // Pattern 3: "Team ML" or moneyline
        const mlMatch = line.match(/^([\w\s]+?)\s+(ml|moneyline)$/i);
        if (mlMatch) {
            bets.push(`${mlMatch[1].trim()} ML`);
            continue;
        }
    }

    return bets;
}

// Clean up OCR text for manual editing
function cleanOCRText(text) {
    return text
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 2)
        .filter(l => !/^[\d\W]+$/.test(l)) // Remove lines that are just numbers/symbols
        .join('\n');
}

// Show OCR status message
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

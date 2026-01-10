# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Triple J Bet Tracker is a static web application for tracking NBA player prop bets in real-time. Users enter natural language prop descriptions (e.g., "lebron james 25+ points") and the app displays live progress toward those targets using NBA's public CDN endpoints.

## Development

This is a vanilla HTML/CSS/JS application with no build process. To develop:

1. Open `index.html` in a browser, or use a local server like `npx serve` or VS Code Live Server
2. The app uses cache-busting query parameters on script/stylesheet tags (e.g., `script.js?v=4`) - increment these when deploying changes to GitHub Pages

## Architecture

### File Structure

- **parser.js** - `PropParser` object that parses natural language input into structured prop data. Handles various stat abbreviations (pts, reb, ast, etc.) and formats ("15+ points", "over 15 points", "under 25 pts")
- **api.js** - `SportsAPI` object that fetches live NBA data. Uses `cdn.nba.com` endpoints proxied through `api.codetabs.com` for CORS. Caches game data for 30 seconds
- **script.js** - Main app logic: DOM handling, localStorage persistence of `trackedPlayers`, card rendering, 30-second auto-refresh

### Data Flow

1. User input → `PropParser.parseMultipleProps()` → array of prop objects
2. Props stored in `trackedPlayers` array and localStorage
3. `SportsAPI.getLiveStats()` fetches today's games, searches boxscores for player, calculates stat value
4. `renderCards()` displays progress with status (HITTING/CLOSE/NEEDS MORE for overs, ON PACE/CLOSE/OVER for unders)

### Supported Stats

Single: points, rebounds, assists, threes, steals, blocks
Combos: pts+reb, pts+ast, reb+ast, pts+reb+ast (PRA), fantasy

### Key Implementation Details

- Player matching in `findPlayerInBoxscore()` uses fuzzy name matching (full name, family name, nameI format)
- Game status 2 = live game, status < 2 = not started
- `onCourt` property comes from NBA's `oncourt === "1"` field
- Cards have three visual states: `hitting` (green with fire effect), `close` (yellow), `not-hitting` (red)

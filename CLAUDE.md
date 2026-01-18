# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Triple J Bet Tracker is a static web application for tracking NBA and NFL bets in real-time. Users enter natural language descriptions for player props (e.g., "lebron 25+ points", "mahomes 300+ passing yards") or team bets (e.g., "Chiefs ML", "Lakers -5.5") and the app displays live progress using NBA's CDN and ESPN's public API.

## Development

This is a vanilla HTML/CSS/JS application with no build process. To develop:

1. Open `index.html` in a browser, or use a local server like `npx serve` or VS Code Live Server
2. The app uses cache-busting query parameters on script/stylesheet tags (e.g., `script.js?v=4`) - increment these when deploying changes to GitHub Pages

## Architecture

### File Structure

- **parser.js** - `PropParser` object that parses natural language input into structured bet data. Handles NBA/NFL player props and team bets. Auto-detects sport from stat type or team name. Supports formats like "25+ points", "Chiefs ML", "Lakers -5.5", "Over 45.5 Chiefs Lions"
- **api.js** - `SportsAPI` object that fetches live data. Uses `cdn.nba.com` (via CORS proxy) for NBA and `site.api.espn.com` for NFL. Handles player props and team bets (moneyline, spread, totals). Caches game data for 30 seconds
- **script.js** - Main app logic: DOM handling, localStorage persistence of `trackedPlayers`, card rendering, 30-second auto-refresh

### Data Flow

1. User input → `PropParser.parseMultipleProps()` → array of bet objects (player props or team bets)
2. Bets stored in `trackedPlayers` array and localStorage with `betType` and `sport` fields
3. `SportsAPI.getStats()` routes to appropriate API (NBA CDN or ESPN) based on sport/betType
4. `renderCard()` routes to appropriate renderer (player prop, moneyline, spread, or total cards)

### Supported Bet Types

**NBA Player Props:** points, rebounds, assists, threes, steals, blocks, combos (PRA, pts+reb, etc.), fantasy

**NFL Player Props:** passing yards, rushing yards, receiving yards, receptions, TDs (pass/rush/rec/any), interceptions, completions

**Team Bets (NBA & NFL):** moneyline ("Chiefs ML"), spread ("Lakers -5.5"), game total ("Over 45.5 Chiefs Lions")

### Key Implementation Details

- Player matching in `findPlayerInBoxscore()` uses fuzzy name matching (full name, family name, nameI format)
- Game status 2 = live game, status < 2 = not started
- `onCourt` property comes from NBA's `oncourt === "1"` field
- Cards have three visual states: `hitting` (green with fire effect), `close` (yellow), `not-hitting` (red)

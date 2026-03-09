# Beat the Market

A lightweight web app that lets you pick 3 stocks or ETFs, compare their daily performance against the S&P 500 (`SPY`), and get a simple, beginner-friendly market summary using live Finnhub data.

## Mini Description
Beat the Market is a browser-based stock game-style analyzer: choose 3 picks, check if they are beating `SPY` today, and review quick insights on volatility, diversification, and recent market headlines.

## Features
- Search stocks and ETFs with Finnhub symbol search
- Save API key in browser local storage
- Pick exactly 3 symbols for analysis
- Compare average daily move vs `SPY`
- Basic risk meter based on average absolute daily change
- Diversification summary using industry profile data
- Market headlines section for context
- Local watchlist (saved in browser)

## Tech Stack
- HTML
- CSS
- Vanilla JavaScript
- Finnhub REST API

## Project Structure
- `index.html` - app layout and sections
- `style.css` - visual design and responsive styles
- `script.js` - app logic, API calls, rendering, and state management

## Setup
1. Clone or download this project.
2. Open `index.html` in your browser.
3. Get a free API key from [finnhub.io](https://finnhub.io).
4. Enter the key in the app and click **Save Key**.

## How to Use
1. Search for stocks/ETFs by name or ticker.
2. Add exactly 3 picks.
3. Click **Analyze My Picks**.
4. Review:
   - your picks' average daily change,
   - `SPY` daily change,
   - risk meter,
   - top mover,
   - diversification check,
   - recent market events.

## Notes
- API key and watchlist are stored only in your browser (`localStorage`).
- This is an educational tool, not investment advice.
- For production, move API requests to a backend proxy instead of exposing client-side tokens.

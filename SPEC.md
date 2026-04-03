# Eretz-Eir — Game Specification

## Overview
A digital version of the classic Israeli word game "ארץ עיר" (Country City). A letter is drawn, and players race to fill in words starting with that letter across multiple categories.

## Game Modes

### Solo Mode
- Single human player vs AI-generated competitors
- AI competitors generate answers in real-time, difficulty adapts automatically to the player's level during the game
- Data stored in LocalStorage (works offline)

### Multiplayer Mode
- Each player on their own device
- Join via room code (4-6 digits) or shareable link (WhatsApp-friendly)
- Round ends when all players press "Done!" or time runs out
- Data stored in cloud (Firebase/Supabase)

## Players
- **Lahav** (age 9) — primary player
- **Noam** (age 9) — sibling
- **Aryeh** (age 46) — father
- **Moran** (age 35) — mother

## Core Gameplay

### Letter Drawing
- Random Hebrew letter drawn each round
- Visual spin animation before reveal

### Categories
Three modes (player chooses in settings):
1. **Fixed** — always the same 8 categories: ארץ, עיר, חי, צומח, ילד, ילדה, מקצוע, זמר/ת
2. **Customizable** — core categories + add/remove before game starts
3. **Random** — each round draws random categories from a large pool

### Timer
- Player chooses before game start: 2 / 3 / 5 / 7 minutes per round

### Rounds
- No fixed limit — play until someone hits "End Game"

## Scoring System
- **Unique answer** (no other player wrote it): 10 points
- **Shared answer** (another player wrote the same): 5 points
- **Empty / invalid**: 0 points
- **Speed bonus**: first player to answer a category gets +3 points

## Answer Validation
- AI validates every answer in real-time
- Checks: is it a real word in the correct category, and does it start with the current letter
- Resolves disputes automatically

## Help System
- Each round: player can use help on **2 different categories**
- **First click**: shows a textual hint
- **Second click**: fills in the answer automatically
- In multiplayer: visible in scoreboard who used help (transparency, no penalty)

## AI Integration
- **Primary**: Claude API (Anthropic)
- **Fallback**: OpenAI (GPT)
- Used for:
  - Validating player answers
  - Generating competitor answers in solo mode (adapted to simulated age)
  - Adaptive difficulty — AI adjusts to player's actual level during the game
  - Generating hints

## End of Game
- Final leaderboard with rankings and total scores
- Fun statistics: fastest answer, most unique answers, strongest category
- Share results via image/link to WhatsApp

## Screens

### 1. Home / Profile
- Player profile (saved): name, avatar, win history, statistics
- "New Game" button
- "Join Game" button (multiplayer)

### 2. Game Setup
- Game mode: Solo / Multiplayer
- If multiplayer: room code / share link
- Category mode: Fixed / Custom / Random
- Timer duration: 2 / 3 / 5 / 7 minutes
- Number of help uses per round

### 3. Game Board (main gameplay)
- Current letter (large, centered)
- Timer bar
- Category cards with input fields
- Help button per category
- Competitor progress indicators (solo mode)
- Player chips with scores
- "Done!" button

### 4. Round Results
- Table: all players × all categories
- Color-coded: unique (green), shared (gold), empty (dim)
- Speed bonus indicators
- Help usage indicators (multiplayer)
- "Next Round" button

### 5. Game Over
- Final rankings
- Statistics highlights
- Share button

## Tech Stack
- **Frontend**: React / Next.js + Tailwind CSS
- **Language**: Hebrew only
- **Local storage**: LocalStorage (solo mode)
- **Cloud**: Firebase or Supabase (multiplayer, profiles)
- **AI**: Claude API (primary) + OpenAI API (fallback)
- **Fonts**: Heebo + Rubik (Google Fonts)

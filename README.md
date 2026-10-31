# After Hours — Parking Lot Drift

Download or clone this repository, then **double-click `index.html`** to play in a desktop browser. Keep its folders together. No installation, build step, server, account, or internet connection is needed. Chrome and Edge are verified; Firefox has not been tested locally.

Click **Start your session** to enable sound and begin. Drive with **WASD** or the **arrow keys**, and hold **Space** to initiate a handbrake slide. Countersteer to straighten out. **Esc** pauses/resumes, **M** toggles sound, and **R** starts a new layout after a crash. Losing browser focus pauses the game; resume explicitly.

Stay inside the dashed parking-lot boundary. The amber entrance lines are also limits. Touching a parked car, the shed, or a boundary ends the run. Drift while moving forward to earn points. Sustained slides build a multiplier up to ×5; link slides within one second to keep it. A full drifting circle earns 500 × the current multiplier. There is no finish line or time limit.

Every run has 8–14 parked cars, including 2–3 randomized cars in the left-side edge bays. Layout checks preserve spawn clearance, a connected route around the lot, and an open circle area on the left. Best score, sound preference, and lighting mode are stored locally when the browser permits it. Private browsing, moving the folder, or changing browsers may reset the record.

Click **Night off / Night on** in the top bar or press **N** to switch between daytime and evening driving at any time, including while paused. Night mode adds a cool dark sky tint, warm lot lights, working headlights that follow the Rio's direction, and red taillights. Changing lighting does not reset your run or score.

## Project layout

```text
index.html                 Double-click to play; UI markup and script order
src/
  config.js                Map geometry and tunable gameplay settings
  core.js                  Physics, collision, layout validation, scoring
  game.js                  Input, menus, camera, drawing, and game loop
  audio.js                 Synthesized engine, skid, and crash sounds
  lighting.js              Night mask, lot lights, and sprite-shaped lamps
  fireworks.js             Secret-ending celebration effects
styles/game.css            Game UI and overlay styles
assets/
  images/                  Cleaned map and Kia sprite used during play
  originals/               Untouched original game_map.png
tests/
  index.html               Offline physics, collision, scoring, layout tests
  browser.html             Integration-test page hosting the real game
  *.test.js                Test code, separate from the game
tools/qa.py                 Optional Windows Chrome/Edge automation runner
docs/
  DEVELOPMENT.md           Architecture, tuning, and verification guide
  ASSETS.md                Image provenance and generation prompts
```

## Run checks

Open **`tests/index.html`** for offline checks, including 1,000 seeded layouts, collision geometry, scoring, physics, and the hidden ending. These need no dependencies.

The optional Windows automation runner uses Python's standard library and an installed Chrome or Edge:

```powershell
python tools/qa.py chrome
python tools/qa.py edge
```

It verifies the core rules, real UI, keyboard drifting, night lighting, secret celebration, and restarts. The integration harness needs permission to inspect its local-file iframe; the runner supplies that flag only for the harness and tests the actual game with normal file security. Browser profiles, logs, and screenshots stay in the ignored `.qa/` folder.

Read [the development guide](docs/DEVELOPMENT.md) before changing gameplay. There is no package installation or formatter required to play or run the test pages.

## Asset provenance

The cleaned map and Kia sprite were created with the built-in imagegen tool. The original map remains unchanged under `assets/originals/`. The final prompts are recorded in [the asset notes](docs/ASSETS.md).

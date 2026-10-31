# Development guide

## Start here

The game uses plain JavaScript, HTML, CSS, and Canvas 2D with no runtime dependencies. Open the root `index.html` directly; a development server is optional.

Scripts use ordinary browser globals rather than ES modules so `file://` launch keeps working. Their explicit load order in `index.html` is:

1. `config.js` publishes `DriftConfig` with geometry and tunable numbers.
2. `core.js` publishes `DriftCore`: pure rules shared by game and tests.
3. `audio.js`, `lighting.js`, and `fireworks.js` publish small subsystem factories.
4. `game.js` creates the subsystems, loads images, attaches controls, and starts the loop.

Keep scripts local and in this order. Asset paths are relative to the root HTML document. Avoid asset fetching or module imports that require a server.

## Responsibilities and data flow

`game.js` owns the car, score, obstacle layout, camera, held keys, preferences, and UI state. It passes data into the other subsystems explicitly.

On a new run, `DriftCore.generateLayout(seed, previousSignature)` selects parked cars and validates their clearance and connectivity. Seeds make failures reproducible. Invalid layouts are retried; validated sparse combinations provide a fallback.

Each animation frame accumulates elapsed time and advances physics at a fixed 1/60 second. `simulate` subdivides motion, updates the car, checks collisions, and scores surviving movement. Rendering does not change physics or scoring. The frame delta is capped to avoid huge jumps after a stalled browser.

The states are `loading`, `ready`, `playing`, `paused`, `over`, `winner`, and an asset/layout failure state `error`. Resume continues a paused run; either restart path creates a fresh run. A special fence collision enters `winner`. Its classification is in `isSecretFenceHit`; the fence polyline is in `config.js`.

`audio.js` accepts mute state and the current car/score. `lighting.js` owns the darkness mask and lamp overlays. `fireworks.js` owns bounded particles and honors reduced motion. These effects do not decide scores or collisions.

## Tuning

- World coordinates use the original **1024 × 1536** map, independent of window size and zoom.
- `src/config.js` holds car size, acceleration, grip, scoring thresholds, spawn, allowed polygon, shed, entrances, and secret fence.
- Parking bays and connectivity validation live in `src/core.js`. Preserve spawn clearance and the protected circle area when adding bays.
- Lamp outlines in `src/lighting.js` trace the Kia PNG. Their crop/scale must match the player sprite crop in `src/game.js`.
- Keep the supplied map in `assets/originals/` untouched. The game uses the cleaned copy in `assets/images/`.
- Storage and audio are optional. Their failure must not stop play.

## Verification

Open `tests/index.html` for standalone checks. `tests/core.test.js` covers 1,000 layouts, deterministic generation, fallbacks, collision, tunneling, scoring exclusions, drift chains, circles, and secret-fence positive/negative cases.

`tests/browser.html` hosts the real game in an iframe and runs `browser.test.js`. Local-file iframe access is restricted by default. Use `python tools/qa.py chrome browser-tests` (or `edge`) for the test-only permission, or serve the repository locally for that harness.

The full `python tools/qa.py chrome` run also opens the actual game with normal file security, uses real keyboard input for a circle at night, and captures the lamps and winner screen. Use `python tools/qa.py edge` for Edge. Python is only a developer convenience. The runner targets Windows and standard Chrome/Edge paths in its `BROWSERS` dictionary.

After changes, verify direct HTML launch, both restart paths, preference storage, and night readability. Profiles/logs/screenshots go under `.qa/` and must not be committed. The formatting packages used during cleanup also stay there and are not dependencies of this project.

## Formatting

JavaScript and CSS use two-space indentation; Python uses four. `.editorconfig` records basic whitespace rules, and `.gitattributes` normalizes text line endings. No package manager or formatter is needed to run the repository.

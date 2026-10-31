(async () => {
  const lines = [],
    frame = document.getElementById('game-frame'),
    out = document.getElementById('output');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
    lines.push('PASS ' + message);
  };
  try {
    await new Promise((resolve, reject) => {
      frame.onload = resolve;
      setTimeout(() => reject(new Error('Frame load timeout')), 12000);
    });
    const win = frame.contentWindow,
      doc = win.document;
    for (let i = 0; i < 150 && doc.documentElement.dataset.ready !== 'true'; i++) await sleep(
      100);
    assert(doc.documentElement.dataset.ready === 'true', 'Local images and game load');
    const snap = () => win.DriftGame.snapshot(),
      key = (type, code) => win.dispatchEvent(new win.KeyboardEvent(type, {
        code,
        bubbles: true
      }));
    assert(snap().state === 'ready', 'Start screen is ready');
    const initialNight = snap().night;
    doc.getElementById('night').click();
    assert(snap().night !== initialNight && doc.getElementById('night').getAttribute(
        'aria-pressed') === String(!initialNight),
      'Night button toggles lighting and pressed state');
    key('keydown', 'KeyN');
    assert(snap().night === initialNight, 'N toggles back to daytime');
    if (!snap().night) key('keydown', 'KeyN');
    doc.getElementById('start').click();
    assert(snap().state === 'playing', 'Start button starts a run');
    assert(snap().night && snap().obstacles.filter(c => c.x < 300).length >= 2,
      'Night mode and left-side cars are active in a new run');
    const first = win.DriftCore.signature(snap().obstacles),
      startY = snap().car.y;
    key('keydown', 'KeyW');
    await sleep(1100);
    key('keyup', 'KeyW');
    assert(snap().car.y < startY - 20, 'Keyboard acceleration moves the Rio');
    key('keydown', 'Escape');
    assert(snap().state === 'paused', 'Escape pauses');
    const position = snap().car.y,
      points = snap().score.points;
    await sleep(250);
    assert(snap().car.y === position && snap().score.points === points,
      'Pause freezes physics and score');
    key('keydown', 'KeyN');
    assert(!snap().night && snap().state === 'paused' && snap().car.y === position,
      'Lighting changes while paused without affecting the run');
    key('keydown', 'KeyN');
    key('keydown', 'Escape');
    assert(snap().state === 'playing', 'Escape resumes');
    win.dispatchEvent(new Event('blur'));
    assert(snap().state === 'paused' && snap().keys === 0, 'Lost focus pauses and clears keys');
    doc.getElementById('start').click();
    assert(snap().state === 'playing', 'Resume button works');
    const muted = snap().muted;
    key('keydown', 'KeyM');
    assert(snap().muted !== muted, 'Mute keyboard toggle works');
    key('keydown', 'KeyM');
    key('keydown', 'KeyW');
    await sleep(6000);
    key('keyup', 'KeyW');
    assert(snap().state === 'over', 'Crossing the upper lot boundary ends the run');
    assert(doc.getElementById('overlay').hidden === false, 'Game-over screen is visible');
    key('keydown', 'KeyR');
    assert(snap().state === 'playing' && snap().score.points === 0, 'R starts a fresh run');
    assert(win.DriftCore.signature(snap().obstacles) !== first,
      'Restart changes the parked-car layout');
    assert(snap().night && snap().obstacles.filter(c => c.x < 300).length >= 2,
      'Restart retains night mode and regenerates left-side cars');
    // Place the next physics step just before the real fence, then let the
    // ordinary collision path select the ending. No test hooks ship in game.js.
    const simulate = win.DriftCore.simulate;
    win.DriftCore.simulate = (car, input, score, cars, dt) => {
      win.DriftCore.simulate = simulate;
      Object.assign(car, {
        x: 290,
        y: 1303.5,
        angle: Math.PI / 2,
        vx: 0,
        vy: 120,
        speed: 120,
        forward: 120,
        yaw: 0
      });
      score.points = 1234;
      return simulate(car, input, score, cars, dt);
    };
    for (let i = 0; i < 60 && snap().state === 'playing'; i++) await sleep(100);
    assert(snap().state === 'winner' && !doc.getElementById('winner').hidden,
      'Bottom-left fence impact opens the secret celebration');
    assert(doc.getElementById('winner-title').textContent === 'Winner!' && doc.querySelector(
      '.winner-message').textContent === 'Misha LOH', 'Secret sign uses the requested text');
    const winningPoints = snap().score.points;
    await sleep(150);
    assert(snap().score.points === winningPoints && snap().best >= 1234,
      'Celebration freezes the run and preserves its score');
    key('keydown', 'KeyR');
    assert(snap().state === 'playing' && doc.getElementById('winner').hidden,
      'R restarts after the secret celebration');
    win.DriftCore.simulate = (car, input, score, cars, dt) => {
      win.DriftCore.simulate = simulate;
      Object.assign(car, {
        x: 290,
        y: 1303.5,
        angle: Math.PI / 2,
        vx: 0,
        vy: 120,
        speed: 120,
        forward: 120,
        yaw: 0
      });
      return simulate(car, input, score, cars, dt);
    };
    for (let i = 0; i < 60 && snap().state === 'playing'; i++) await sleep(100);
    doc.getElementById('winner-restart').click();
    assert(snap().state === 'playing' && doc.getElementById('winner').hidden,
      'Celebration restart button returns to a fresh run');
    win.dispatchEvent(new Event('blur'));
    doc.getElementById('start').focus();
    key('keydown', 'Space');
    assert(snap().keys === 0, 'Menu keys do not remain held');
    assert(!doc.querySelector('script[type="module"]') && !doc.querySelector(
      'script[src^="http"]'), 'Game uses local classic scripts');
    document.title = 'PASS — browser checks';
    document.documentElement.dataset.result = 'pass';
  } catch (e) {
    lines.push('FAIL ' + e.stack);
    document.title = 'FAIL — browser checks';
    document.documentElement.dataset.result = 'fail';
  }
  out.textContent = lines.join('\n');
})();

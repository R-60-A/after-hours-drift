(function() {
  'use strict';
  const C = DriftCore,
    cfg = C.CONFIG,
    $ = id => document.getElementById(id);
  const canvas = $('world'),
    ctx = canvas.getContext('2d', {
      alpha: false
    });
  const map = new Image(),
    rio = new Image();
  let state = 'loading',
    car = C.createCar(),
    score = C.createScore(),
    obstacles = [],
    lastLayout = '',
    best = 0,
    muted = false,
    night = false;
  let w = innerWidth,
    h = innerHeight,
    dpr = 1,
    zoom = 1.35,
    last = 0,
    accumulator = 0,
    toastTimer = 0,
    lastCircle = 0;
  let camera = {
      x: car.x,
      y: car.y
    },
    shake = 0,
    marks = [],
    smoke = [],
    lastTires = null;
  const keys = new Set(),
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sprite = document.createElement('canvas');
  sprite.width = 70;
  sprite.height = 140;
  const celebration = createFireworks($('fireworks'), reducedMotion);
  const nightLighting = createNightLighting(ctx, cfg);
  try {
    best = Number(localStorage.getItem('after-hours-best')) || 0;
    muted = localStorage.getItem('after-hours-muted') === 'true';
    night = localStorage.getItem('after-hours-night') === 'true';
  } catch (_) {}
  const sound = createDriftAudio();
  // PREFERENCES AND RUN LIFECYCLE
  function persist() {
    try {
      localStorage.setItem('after-hours-best', String(Math.floor(best)));
      localStorage.setItem('after-hours-muted', String(muted));
      localStorage.setItem('after-hours-night', String(night));
    } catch (_) {}
  }

  function updateMute() {
    $('mute').textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    $('mute').setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    sound.mute(muted);
  }

  function updateNight() {
    $('night').textContent = night ? 'NIGHT ON' : 'NIGHT OFF';
    $('night').setAttribute('aria-pressed', String(night));
    document.body.classList.toggle('night', night);
  }

  function seed() {
    try {
      return crypto.getRandomValues(new Uint32Array(1))[0];
    } catch (_) {
      return Date.now() ^ Math.floor(Math.random() * 0xffffffff);
    }
  }

  function newRun() {
    try {
      obstacles = C.generateLayout(seed(), lastLayout);
      lastLayout = C.signature(obstacles);
    } catch (e) {
      showError(e.message);
      return;
    }
    car = C.createCar();
    score = C.createScore();
    marks = [];
    smoke = [];
    lastTires = null;
    lastCircle = 0;
    toastTimer = 0;
    $('toast').classList.remove('visible');
    celebration.reset();
    $('winner').hidden = true;
    camera = {
      x: car.x,
      y: car.y
    };
    accumulator = 0;
    keys.clear();
    state = 'playing';
    document.body.classList.remove('menu');
    $('overlay').hidden = true;
    $('pause').disabled = false;
    $('pause').textContent = 'PAUSE Ⅱ';
    sound.init(muted);
    announce('STAY INSIDE. GET SIDEWAYS.', 2.5);
    updateHUD();
  }

  function announce(text, duration = 2) {
    $('toast').textContent = text;
    $('toast').classList.add('visible');
    toastTimer = duration;
  }

  function showError(message) {
    state = 'error';
    $('overlay').hidden = false;
    $('panel-title').textContent = 'LOT CLOSED';
    $('panel-copy').textContent = message;
    $('start').disabled = true;
    $('start').textContent = 'RELOAD TO TRY AGAIN';
  }

  function showPanel(title, copy, button, results) {
    document.body.classList.add('menu');
    $('overlay').hidden = false;
    $('panel-title').innerHTML = title;
    $('panel-copy').textContent = copy;
    $('start').innerHTML = button + ' <span>↗</span>';
    $('start').disabled = false;
    $('results').hidden = !results;
    $('intro-rules').hidden = true;
    $('panel-hint').textContent = state === 'paused' ? 'ESC TO RESUME · YOUR RUN IS SAVED HERE' :
      'R TO RESTART · A NEW LOT EVERY RUN';
  }

  function endRun(reason) {
    if (C.isSecretFenceHit(car, reason)) {
      winRun();
      return;
    }
    state = 'over';
    keys.clear();
    best = Math.max(best, Math.floor(score.points));
    persist();
    shake = reducedMotion ? 0 : 9;
    sound.crash();
    $('final-score').textContent = Math.floor(score.points).toLocaleString();
    $('final-best').textContent = Math.floor(best).toLocaleString();
    $('crash-flash').classList.remove('active');
    void $('crash-flash').offsetWidth;
    $('crash-flash').classList.add('active');
    showPanel('ONE MORE<br><em>RUN?</em>', reason + ' Your points are yours to keep.',
      'BACK TO THE LOT', true);
    updateHUD();
  }

  function winRun() {
    state = 'winner';
    keys.clear();
    accumulator = 0;
    best = Math.max(best, Math.floor(score.points));
    persist();
    $('overlay').hidden = true;
    document.body.classList.remove('menu');
    $('toast').classList.remove('visible');
    toastTimer = 0;
    $('winner-score').textContent = Math.floor(score.points).toLocaleString();
    $('winner').hidden = false;
    $('pause').disabled = true;
    celebration.start(w, h);
    $('winner-restart').focus();
    updateHUD();
    sound.update(state === 'playing', car, score);
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    keys.clear();
    accumulator = 0;
    showPanel('TAKE A<br><em>BREATHER.</em>', 'Your Rio is right where you left it.',
      'KEEP DRIFTING', false);
    $('pause').textContent = 'RESUME ▶';
    sound.update(state === 'playing', car, score);
  }

  function resume() {
    if (state !== 'paused') return;
    sound.init(muted);
    state = 'playing';
    keys.clear();
    accumulator = 0;
    document.body.classList.remove('menu');
    $('overlay').hidden = true;
    $('pause').textContent = 'PAUSE Ⅱ';
  }

  function input() {
    return {
      up: keys.has('KeyW') || keys.has('ArrowUp'),
      down: keys.has('KeyS') || keys.has('ArrowDown'),
      left: keys.has('KeyA') || keys.has('ArrowLeft'),
      right: keys.has('KeyD') || keys.has('ArrowRight'),
      handbrake: keys.has('Space')
    };
  }
  // INPUT — classic keyboard controls and native menu buttons.
  $('start').addEventListener('click', () => state === 'paused' ? resume() : newRun());
  $('winner-restart').addEventListener('click', newRun);
  $('pause').addEventListener('click', () => state === 'paused' ? resume() : pause());
  $('mute').addEventListener('click', () => {
    muted = !muted;
    sound.init(muted);
    updateMute();
    persist();
  });
  $('night').addEventListener('click', () => {
    night = !night;
    updateNight();
    persist();
  });
  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(e.code) || (e
        .code === 'Space' && state === 'playing')) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Escape') {
      state === 'playing' ? pause() : resume();
      return;
    }
    if (e.code === 'KeyM') {
      $('mute').click();
      return;
    }
    if (e.code === 'KeyN') {
      $('night').click();
      return;
    }
    if (e.code === 'KeyR' && (state === 'over' || state === 'winner')) {
      newRun();
      return;
    }
    // Native button keyboard activation handles Enter/Space on focused controls.
    if (e.code === 'Enter' && (state === 'ready' || state === 'over' || state === 'winner') &&
      document.activeElement?.tagName !== 'BUTTON') {
      newRun();
      return;
    }
    if (state === 'playing') keys.add(e.code);
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      keys.clear();
      pause();
    }
  });

  function resize() {
    w = innerWidth;
    h = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    nightLighting.resize(canvas.width, canvas.height);
    celebration.resize(canvas.width, canvas.height);
    zoom = Math.max(.8, Math.min(1.65, Math.min(w / 680, h / 490)));
  }
  window.addEventListener('resize', resize);
  resize();
  // RENDERING — camera, map, cars, skid marks, and smoke.
  function path(poly) {
    ctx.beginPath();
    poly.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
  }

  function drawCar(o, player = false) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.angle);
    ctx.fillStyle = '#07100a65';
    ctx.beginPath();
    ctx.ellipse(3, 4, (o.length || 52) * .53, (o.width || 25) * .61, 0, 0, C.TAU);
    ctx.fill();
    if (player) {
      ctx.shadowColor = '#a6e9ff66';
      ctx.shadowBlur = 4;
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(sprite, -14, -27, 28, 54);
      ctx.shadowBlur = 0;
    } else if (spriteReady) {
      const filters = ['grayscale(1) brightness(1.8)', 'grayscale(1) brightness(2.6)',
        'grayscale(.9) brightness(.55)',
        'hue-rotate(260deg) saturate(.5) brightness(.65)', 'grayscale(.9) brightness(1.4)',
        'grayscale(.8) brightness(.8)', 'hue-rotate(135deg) saturate(.65) brightness(.9)',
        'grayscale(.7) sepia(.5) brightness(1.7)'
      ];
      ctx.rotate(Math.PI / 2);
      ctx.filter = filters[cfg.colors.indexOf(o.color)] || filters[0];
      ctx.drawImage(sprite, -o.width / 2, -o.length / 2, o.width, o.length);
      ctx.filter = 'none';
    }
    ctx.restore();
  }

  function effects(dt) {
    const c = Math.cos(car.angle),
      s = Math.sin(car.angle),
      tires = [-9, 9].map(y => [car.x - 15 * c - y * s, car.y - 15 * s + y * c]);
    if (score.drifting) {
      if (lastTires) {
        for (let i = 0; i < 2; i++) marks.push({
          a: lastTires[i],
          b: tires[i],
          alpha: Math.min(.42, .14 + Math.abs(car.slip) * .3)
        });
      }
      if (!reducedMotion && Math.random() < .55)
        for (const p of tires) smoke.push({
          x: p[0],
          y: p[1],
          vx: (Math.random() - .5) * 15,
          vy: (Math.random() - .5) * 15,
          life: 1,
          r: 3 + Math.random() * 3
        });
      lastTires = tires;
    } else lastTires = null;
    if (marks.length > 5000) marks.splice(0, marks.length - 5000);
    for (const p of smoke) {
      p.life -= dt * .85;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += dt * 10;
    }
    smoke = smoke.filter(p => p.life > 0).slice(-180);
  }

  function updateHUD() {
    $('score').textContent = String(Math.floor(score.points)).padStart(5, '0');
    $('best').textContent = Math.floor(Math.max(best, score.points)).toLocaleString();
    $('multiplier').innerHTML = '×' + score.multiplier + '<span>.0</span>';
    $('combo-fill').style.width = (score.multiplier === 5 ? 100 : (score.chain % 2) / 2 * 100) +
      '%';
    $('drift-label').textContent = score.drifting ? 'KEEP IT SIDEWAYS' : score.chain && score
      .gap < 1 ? 'LINK YOUR NEXT DRIFT' : 'FIND YOUR FLOW';
    $('speed').textContent = Math.round(car.speed * .44);
    $('gear').textContent = car.forward < -2 ? 'R' : car.speed < 3 ? 'N' : String(Math.min(5, 1 +
      Math.floor(car.speed / 48)));
  }

  function draw(dt) {
    const playing = state === 'playing' || state === 'paused' || state === 'over' || state ===
      'winner';
    const target = playing ? {
      x: car.x + car.vx * .28,
      y: car.y + car.vy * .28
    } : {
      x: 460,
      y: 1010
    };
    const k = 1 - Math.exp(-5 * dt);
    camera.x += (target.x - camera.x) * k;
    camera.y += (target.y - camera.y) * k;
    const z = playing ? zoom : Math.max(.9, Math.min(1.35, w / 850));
    const halfW = w / (2 * z),
      halfH = h / (2 * z);
    const cx = halfW > cfg.width / 2 ? cfg.width / 2 : C.clamp(camera.x, halfW, cfg.width -
    halfW);
    const cy = halfH > cfg.height / 2 ? cfg.height / 2 : C.clamp(camera.y, halfH, cfg.height -
      halfH);
    shake *= Math.exp(-9 * dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#152019';
    ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2 + (Math.random() - .5) * shake, h / 2 + (Math.random() - .5) * shake);
    ctx.scale(z, z);
    ctx.translate(-cx, -cy);
    if (map.complete && map.naturalWidth) ctx.drawImage(map, 0, 0, cfg.width, cfg.height);
    // Desaturate the scenery slightly so the blue player and amber limits read clearly.
    ctx.fillStyle = '#14231b12';
    ctx.fillRect(0, 0, cfg.width, cfg.height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cfg.width, cfg.height);
    pathAppend(cfg.zone);
    ctx.fillStyle = '#07100d40';
    ctx.fill('evenodd');
    ctx.restore();
    path(cfg.zone);
    ctx.strokeStyle = '#e1c38199';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [a, b] of cfg.gates) {
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.strokeStyle = '#f4c46b';
      ctx.lineWidth = 4;
      ctx.setLineDash([9, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.save();
    ctx.translate(460, 650);
    ctx.font = 'bold 7px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe0a1';
    ctx.fillText('DRIFT ZONE LIMIT', 0, 0);
    ctx.restore();
    // Light parking-bay markings make randomized obstacles look deliberately parked.
    ctx.strokeStyle = '#dad5b51d';
    ctx.lineWidth = 1;
    for (const o of C.candidates) {
      ctx.strokeRect(o.x - 31, o.y - 20, 62, 40);
    }
    for (const m of marks) {
      ctx.strokeStyle = `rgba(17,20,18,${m.alpha})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(...m.a);
      ctx.lineTo(...m.b);
      ctx.stroke();
    }
    for (const o of obstacles) drawCar(o);
    for (const p of smoke) {
      ctx.fillStyle = `rgba(213,218,203,${p.life*.18})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, C.TAU);
      ctx.fill();
    }
    if (spriteReady) drawCar(car, true);
    if (night) nightLighting.draw(car);
    if (state === 'ready') {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.strokeStyle = '#d7fa7999';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, C.TAU);
      ctx.stroke();
      ctx.fillStyle = '#e6f9b8';
      ctx.font = 'bold 8px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('YOUR BLUE RIO', 0, 52);
      ctx.restore();
    }
  }

  function pathAppend(poly) {
    poly.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
  }
  // FIXED-STEP LOOP — physics at 60 Hz, rendering on animation frames.
  function frame(timestamp) {
    const dt = Math.min(.1, (timestamp - last) / 1000 || 0);
    last = timestamp;
    if (state === 'playing') {
      accumulator += dt;
      while (accumulator >= cfg.step && state === 'playing') {
        const reason = C.simulate(car, input(), score, obstacles, cfg.step);
        accumulator -= cfg.step;
        effects(cfg.step);
        if (score.circles > lastCircle) {
          lastCircle = score.circles;
          announce('360° CIRCLE  +' + (500 * score.multiplier).toLocaleString());
        }
        if (reason) endRun(reason);
      }
    } else accumulator = 0;
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) $('toast').classList.remove('visible');
    }
    sound.update(state === 'playing', car, score);
    updateHUD();
    draw(dt);
    if (state === 'winner') celebration.draw(dt, w, h, dpr);
    requestAnimationFrame(frame);
  }
  // ASSET BOOTSTRAP — image elements keep double-click file:// launch working.
  let spriteReady = false;

  function loadImage(image, src) {
    return new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Cannot load ' + src +
        '. Keep all game files in the same folder.'));
      image.src = src;
    });
  }
  updateMute();
  updateNight();
  $('pause').disabled = true;
  document.body.classList.add('menu');
  $('best').textContent = best.toLocaleString();
  Promise.all([loadImage(map, 'assets/images/game_map_clean.png'), loadImage(rio,
    'assets/images/kia_rio.png')]).then(() => {
    // Source cropping excludes unused transparent margins; no pixel readback is
    // needed, so the sprite works under file:// canvas security restrictions.
    const s = sprite.getContext('2d');
    s.drawImage(rio, 155, 65, 715, 1420, 0, 0, 70, 140);
    nightLighting.prepare(rio);
    spriteReady = true;
    obstacles = C.generateLayout(seed());
    lastLayout = C.signature(obstacles);
    state = 'ready';
    $('start').disabled = false;
    $('start').innerHTML = 'START YOUR SESSION <span>↗</span>';
    document.documentElement.dataset.ready = 'true';
  }).catch(e => showError(e.message));
  // Read-only diagnostics used by offline checks and useful for tuning locally.
  window.DriftGame = {
    snapshot: () => ({
      state,
      car: {
        ...car
      },
      score: {
        ...score
      },
      obstacles: obstacles.map(o => ({
        ...o
      })),
      best,
      muted,
      night,
      marks: marks.length,
      keys: keys.size
    })
  };
  requestAnimationFrame(frame);
})();

/* Pure game rules, shared by the browser game and the offline test harness. */
(function(root) {
  'use strict';
  const TAU = Math.PI * 2;
  const CONFIG = root.DriftConfig;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function pointIn(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i],
        b = poly[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[
        1]) + a[0]) inside = !inside;
    }
    return inside;
  }

  function distanceSegment(p, a, b) {
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
  }

  function edgeDistance(p, poly) {
    let d = Infinity;
    for (let i = 0; i < poly.length; i++) d = Math.min(d, distanceSegment(p, poly[i], poly[(i +
      1) % poly.length]));
    return d;
  }

  function rect(car, padding = 0) {
    const l = (car.length || CONFIG.carLength) / 2 + padding,
      w = (car.width || CONFIG.carWidth) / 2 + padding,
      c = Math.cos(car.angle),
      s = Math.sin(car.angle);
    return [
      [l, w],
      [l, -w],
      [-l, -w],
      [-l, w]
    ].map(([x, y]) => [car.x + x * c - y * s, car.y + x * s + y * c]);
  }

  function cross(a, b, c) {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  }

  function intersects(a, b, c, d) {
    const x = cross(a, b, c),
      y = cross(a, b, d),
      z = cross(c, d, a),
      w = cross(c, d, b);
    const on = (p, q, r) => Math.min(p[0], q[0]) - 1e-8 <= r[0] && r[0] <= Math.max(p[0], q[0]) +
      1e-8 && Math.min(p[1], q[1]) - 1e-8 <= r[1] && r[1] <= Math.max(p[1], q[1]) + 1e-8;
    return (x * y < 0 && z * w < 0) || (Math.abs(x) < 1e-8 && on(a, b, c)) || (Math.abs(y) <
      1e-8 && on(a, b, d)) || (Math.abs(z) < 1e-8 && on(c, d, a)) || (Math.abs(w) < 1e-8 && on(
      c, d, b));
  }

  function edgesIntersect(a, b) {
    for (let i = 0; i < a.length; i++)
      for (let j = 0; j < b.length; j++)
        if (intersects(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
    return false;
  }

  function overlap(a, b) {
    return pointIn(a[0], b) || pointIn(b[0], a) || edgesIntersect(a, b);
  }

  function insideZone(body) {
    return body.every(p => pointIn(p, CONFIG.zone)) && !edgesIntersect(body, CONFIG.zone);
  }

  function collision(car, obstacles) {
    const body = rect(car);
    if (CONFIG.solids.some(p => overlap(body, p))) return 'You hit the shed.';
    if (!insideZone(body)) return 'You left the drifting zone.';
    if (obstacles.some(o => Math.hypot(car.x - o.x, car.y - o.y) < 80 && overlap(body, rect(o))))
      return 'You hit a parked car.';
    return null;
  }

  function isSecretFenceHit(car, reason) {
    if (reason !== 'You left the drifting zone.') return false;
    const body = rect(car),
      fence = CONFIG.secretFence;
    for (let i = 0; i < fence.length - 1; i++)
      for (let j = 0; j < body.length; j++) {
        if (intersects(fence[i], fence[i + 1], body[j], body[(j + 1) % body.length])) return true;
      }
    return false;
  }
  // PARKING LAYOUTS — candidate bays, clearance, connectivity, and generation.
  const candidates = [];
  for (const x of [425, 550, 675])
    for (let y = 805; y <= 1190; y += 55) candidates.push({
      x,
      y,
      angle: 0,
      length: 54,
      width: 26
    });
  // Edge bays add hazards on the left without occupying the protected circle.
  const leftCandidates = [
    [120, 845],
    [135, 1215],
    [135, 1270],
    [220, 1270]
  ].map(([x, y]) => ({
    x,
    y,
    angle: 0,
    length: 54,
    width: 26
  }));
  candidates.push(...leftCandidates);

  function signature(cars) {
    return cars.map(c => `${c.x},${c.y}`).sort().join('|');
  }

  function circleRect(p, radius, car) {
    const c = Math.cos(car.angle),
      s = Math.sin(car.angle),
      dx = p[0] - car.x,
      dy = p[1] - car.y;
    const x = dx * c + dy * s,
      y = -dx * s + dy * c;
    return Math.hypot(Math.max(0, Math.abs(x) - (car.length || 52) / 2), Math.max(0, Math.abs(y) -
      (car.width || 25) / 2)) <= radius;
  }
  // A circular car envelope plus clearance keeps routes usable at any heading.
  const NAV_RADIUS = 34,
    GRID = 22;
  const navPoints = [];
  for (let y = 650; y <= 1320; y += GRID)
    for (let x = 65; x <= 880; x += GRID) {
      const p = [x, y];
      if (pointIn(p, CONFIG.zone) && edgeDistance(p, CONFIG.zone) > NAV_RADIUS && !CONFIG.solids
        .some(s => pointIn(p, s) || edgeDistance(p, s) < NAV_RADIUS)) navPoints.push(p);
    }

  function validateLayout(cars) {
    if (cars.length < 8 || cars.length > 14) return false;
    if (cars.filter(c => c.x < 300).length < 2) return false;
    for (let i = 0; i < cars.length; i++) {
      const o = cars[i];
      if (collision(o, cars.slice(0, i))) return false;
      if (Math.hypot(o.x - CONFIG.spawn.x, o.y - CONFIG.spawn.y) < 105) return false;
      if (circleRect([CONFIG.circle.x, CONFIG.circle.y], CONFIG.circle.radius + 32, o))
      return false;
      if (cars.slice(0, i).some(b => overlap(rect(o, 8), rect(b, 8)))) return false;
    }
    const free = navPoints.filter(p => !cars.some(o => circleRect(p, NAV_RADIUS, o)));
    const key = p => p[0] + ',' + p[1],
      available = new Set(free.map(key));
    if (!free.length) return false;
    let start = free[0];
    for (const p of free)
      if (Math.hypot(p[0] - CONFIG.spawn.x, p[1] - CONFIG.spawn.y) < Math.hypot(start[0] - CONFIG
          .spawn.x, start[1] - CONFIG.spawn.y)) start = p;
    if (Math.hypot(start[0] - CONFIG.spawn.x, start[1] - CONFIG.spawn.y) > GRID * 1.5)
    return false;
    const queue = [start],
      seen = new Set([key(start)]);
    for (let i = 0; i < queue.length; i++)
      for (const [dx, dy] of [
          [GRID, 0],
          [-GRID, 0],
          [0, GRID],
          [0, -GRID]
        ]) {
        const p = [queue[i][0] + dx, queue[i][1] + dy],
          k = key(p);
        if (available.has(k) && !seen.has(k)) {
          seen.add(k);
          queue.push(p);
        }
      }
    return seen.size === available.size;
  }

  function generateLayout(seed, previous = '') {
    const random = rng(seed);
    for (let attempt = 0; attempt < 60; attempt++) {
      const shuffled = candidates.filter(c => c.x >= 300).map(c => ({
        ...c
      }));
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const left = leftCandidates.map(c => ({
        ...c
      }));
      for (let i = left.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [left[i], left[j]] = [left[j], left[i]];
      }
      const total = 8 + Math.floor(random() * 7),
        leftCount = 2 + Math.floor(random() * 2);
      const cars = [...left.slice(0, leftCount), ...shuffled.slice(0, total - leftCount)].map(c =>
        ({
          ...c,
          angle: random() > .5 ? 0 : Math.PI,
          color: CONFIG.colors[Math.floor(random() * CONFIG.colors.length)]
        }));
      if (signature(cars) !== previous && validateLayout(cars)) return cars;
    }
    // Two independently checked sparse layouts also guarantee a fresh fallback.
    for (const x of [425, 675]) {
      for (let i = 0; i < leftCandidates.length; i++)
        for (let j = i + 1; j < leftCandidates.length; j++) {
          const cars = [leftCandidates[i], leftCandidates[j], ...candidates.filter(c => c.x ===
            x)].map(c => ({
            ...c,
            color: CONFIG.colors[Math.floor(random() * CONFIG.colors.length)]
          }));
          if (signature(cars) !== previous && validateLayout(cars)) return cars;
        }
    }
    throw new Error('No safe parking layout could be generated.');
  }
  // DRIVING — world-space velocity, steering, grip, and handbrake handling.
  function createCar() {
    return {
      ...CONFIG.spawn,
      vx: 0,
      vy: 0,
      yaw: 0,
      slip: 0,
      speed: 0,
      forward: 0
    };
  }

  function drive(car, input, dt) {
    const c = Math.cos(car.angle),
      s = Math.sin(car.angle);
    let forward = car.vx * c + car.vy * s,
      lateral = -car.vx * s + car.vy * c;
    const throttle = input.up ? 1 : 0,
      brake = input.down ? 1 : 0;
    if (throttle) forward += CONFIG.acceleration * dt;
    if (brake) forward -= (forward > 8 ? CONFIG.braking : 85) * dt;
    forward *= Math.exp(-(.48 + (input.handbrake ? 1.2 : 0)) * dt);
    forward = clamp(forward, -CONFIG.reverseSpeed, CONFIG.maxSpeed);
    const steering = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const desiredYaw = steering * clamp(forward / 57, -1.2, 2.35) * (input.handbrake ? 1.22 : 1);
    car.yaw += (desiredYaw - car.yaw) * (1 - Math.exp(-8 * dt));
    lateral *= Math.exp(-(input.handbrake ? CONFIG.driftGrip : CONFIG.grip) * dt);
    car.vx = forward * c - lateral * s;
    car.vy = forward * s + lateral * c;
    car.angle += car.yaw * dt;
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    const nc = Math.cos(car.angle),
      ns = Math.sin(car.angle);
    car.forward = car.vx * nc + car.vy * ns;
    car.speed = Math.hypot(car.vx, car.vy);
    car.slip = Math.atan2(-car.vx * ns + car.vy * nc, Math.max(.001, car.forward));
  }
  // SCORING — controlled drifts, chain grace period, and circle bonuses.
  function createScore() {
    return {
      points: 0,
      chain: 0,
      gap: 0,
      multiplier: 1,
      turn: 0,
      direction: 0,
      drifting: false,
      circles: 0
    };
  }

  function scoreStep(score, car, dt) {
    const slip = Math.abs(car.slip);
    score.drifting = car.forward > CONFIG.minDriftSpeed && car.speed > CONFIG.minDriftSpeed &&
      slip > CONFIG.minSlip && slip < CONFIG.maxSlip;
    let bonus = 0;
    if (score.drifting) {
      score.gap = 0;
      score.chain += dt;
      score.multiplier = Math.min(5, 1 + Math.floor(score.chain / 2));
      score.points += car.speed * slip * .65 * score.multiplier * dt;
      const direction = Math.sign(car.yaw);
      if (direction && direction !== score.direction) {
        score.turn = 0;
        score.direction = direction;
      }
      score.turn += Math.abs(car.yaw) * dt;
      if (score.turn >= TAU) {
        score.turn -= TAU;
        score.circles++;
        bonus = 500 * score.multiplier;
        score.points += bonus;
      }
    } else {
      score.gap += dt;
      if (score.gap > CONFIG.comboGrace) {
        score.chain = 0;
        score.multiplier = 1;
        score.turn = 0;
        score.direction = 0;
      }
    }
    return bonus;
  }

  function simulate(car, input, score, cars, dt) {
    // Each substep travels < 2px even at full speed and checks the swept path.
    const steps = Math.max(2, Math.ceil(Math.max(car.speed, CONFIG.maxSpeed) * dt / 2));
    for (let i = 0; i < steps; i++) {
      drive(car, input, dt / steps);
      const reason = collision(car, cars);
      if (reason) return reason;
      scoreStep(score, car, dt / steps);
    }
    return null;
  }
  root.DriftCore = {
    CONFIG,
    TAU,
    clamp,
    rng,
    pointIn,
    edgeDistance,
    rect,
    overlap,
    insideZone,
    collision,
    isSecretFenceHit,
    candidates,
    signature,
    circleRect,
    validateLayout,
    generateLayout,
    createCar,
    drive,
    createScore,
    scoreStep,
    simulate
  };
})(globalThis);

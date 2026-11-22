/*
  "Aperture Drift" — LNB Studios generative hero (algorithmic-art skill)

  Philosophy: light is a slow current. Thousands of thin strokes drift through a
  seeded noise field the way light drifts through a room; near the invisible lens
  the current wraps around the glass and a few strands catch red, like the REC
  light on a camera. A hand passing in front of the lens (the cursor) parts the
  current. Same seed, same artwork: seed 82 is Davao's area code (082).

  Exposes window.LNBFlow.create(canvas, opts) -> { set(opts), still(), destroy() }
*/
(function () {
  "use strict";

  // seeded PRNG (mulberry32)
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // seeded 3D value noise (smooth, cheap)
  function makeNoise(rand) {
    const p = new Uint8Array(512);
    const v = new Float32Array(256);
    for (let i = 0; i < 256; i++) { p[i] = i; v[i] = rand(); }
    for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 256; i++) p[i + 256] = p[i];
    const fade = t => t * t * (3 - 2 * t);
    const lerp = (a, b, t) => a + (b - a) * t;
    const h = (x, y, z) => v[p[p[p[x & 255] + (y & 255)] + (z & 255)]];
    return function (x, y, z) {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
      const a = lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), xf), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf), yf);
      const b = lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf), yf);
      return lerp(a, b, zf);
    };
  }

  const DEFAULTS = {
    seed: 82,
    count: 2200,
    speed: 1,
    ground: "#EEE7DC",
    ink: "21,18,15",
    red: "210,50,31",
    redShare: 0.07,
    inkAlpha: 0.44,
    lensX: 0.7, lensY: 0.44, lensR: 0.2, // fractions of width / height / min side
    fade: 0.06
  };

  function create(canvas, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const ctx = canvas.getContext("2d", { alpha: false });
    let W = 0, H = 0, dpr = 1, raf = 0, running = false, t = 0, frameN = 0;
    let rand, noise, parts = [];
    const mouse = { x: -9999, y: -9999, on: false };

    function size() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, o.count > 1200 ? 1.5 : 1.25);
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = o.ground; ctx.fillRect(0, 0, W, H);
    }

    function seedAll() {
      rand = rng(o.seed);
      noise = makeNoise(rng(o.seed * 7919 + 13));
      parts = [];
      for (let i = 0; i < o.count; i++) parts.push(spawn({}));
      t = 0;
    }

    function spawn(q) {
      q.x = rand() * W; q.y = rand() * H;
      q.life = 60 + rand() * 220;
      q.red = rand() < o.redShare;
      q.w = 0.35 + rand() * 0.6;
      return q;
    }

    function step(dt) {
      const scale = 0.0021, lx = o.lensX * W, ly = o.lensY * H, lr = o.lensR * Math.min(W, H) + 40;
      const sp = 1.15 * o.speed;
      t += 0.0016 * o.speed * dt;
      ctx.fillStyle = o.ground;
      // a soft fade leaves an 8-bit residue that tints the ground; every 40th frame a firmer pass clears it
      // a soft fade leaves an 8-bit residue that tints the ground; every 40th step a firmer pass clears it
      frameN++;
      ctx.globalAlpha = frameN % 40 === 0 ? Math.min(1, o.fade * 3) : o.fade;
      ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;

      const inkPath = new Path2D(), redPath = new Path2D();
      for (let i = 0; i < parts.length; i++) {
        const q = parts[i];
        const a = noise(q.x * scale, q.y * scale, t) * Math.PI * 4;
        let vx = Math.cos(a), vy = Math.sin(a);
        // the lens: the current wraps around the glass and leans toward its rim
        const dx = q.x - lx, dy = q.y - ly, d = Math.hypot(dx, dy) || 1;
        if (d < lr * 1.9) {
          const k = Math.max(0, 1 - Math.abs(d - lr) / (lr * 0.9));
          vx += (-dy / d) * 1.6 * k - (dx / d) * 0.35 * (d < lr ? -1 : 1) * k;
          vy += (dx / d) * 1.6 * k - (dy / d) * 0.35 * (d < lr ? -1 : 1) * k;
        }
        // a hand in front of the lens parts the current
        if (mouse.on) {
          const mx = q.x - mouse.x, my = q.y - mouse.y, md = Math.hypot(mx, my);
          if (md < 150 && md > 0.01) { const f = (1 - md / 150) * 3.2; vx += (mx / md) * f; vy += (my / md) * f; }
        }
        const nx = q.x + vx * sp * dt, ny = q.y + vy * sp * dt;
        const path = q.red && d < lr * 1.6 ? redPath : inkPath;
        path.moveTo(q.x, q.y); path.lineTo(nx, ny);
        q.x = nx; q.y = ny; q.life -= dt;
        if (q.life <= 0 || nx < -10 || ny < -10 || nx > W + 10 || ny > H + 10) spawn(q);
      }
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = `rgba(${o.ink},${o.inkAlpha})`; ctx.stroke(inkPath);
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = `rgba(${o.red},.7)`; ctx.stroke(redPath);
    }

    // fixed 60 steps a second, so 60, 120 and 240 Hz screens draw the same artwork
    let last = 0, acc = 0;
    function loop(now) {
      if (!running) return;
      acc += last ? Math.min(100, now - last) : 16.67;
      last = now;
      let n = 0;
      while (acc >= 16.67 && n < 3) { step(1); acc -= 16.67; n++; }
      if (n === 3) acc = 0;
      raf = requestAnimationFrame(loop);
    }

    function start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    // a finished still: run the field forward without animating (reduced motion)
    function still() {
      stop();
      const f = o.fade; o.fade = 0.03;
      for (let i = 0; i < 180; i++) step(1);
      o.fade = f;
    }

    function onMove(e) {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true;
    }
    function onLeave() { mouse.on = false; }

    size(); seedAll();

    return {
      start, stop, still,
      size() { size(); },
      pointer(target) {
        target.addEventListener("pointermove", onMove, { passive: true });
        target.addEventListener("pointerleave", onLeave);
      },
      set(next) {
        const reseed = "seed" in next || "count" in next;
        Object.assign(o, next);
        if (reseed) { size(); seedAll(); }
      },
      get params() { return Object.assign({}, o); },
      destroy() { stop(); }
    };
  }

  window.LNBFlow = { create };
})();

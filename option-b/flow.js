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
    ground: "#121110",
    ink: "238,233,225",
    red: "227,52,42",
    redShare: 0.07,
    inkAlpha: 0.42,
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
      dpr = Math.min(window.devicePixelRatio || 1, o.maxDpr || (o.count > 1200 ? 1.5 : 1.25));
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

  /*
    page(canvas, opts): ONE continuous field for the whole page.
    A fixed, viewport-sized canvas behind everything. The noise is sampled in page coordinates,
    so the current runs unbroken from section to section and the trails scroll with the page.
    The canvas also paints each section's ground (opts.bands), so a light section keeps its
    colour and gets dark ink lines, and night sections get more red.
      opts.bands()  -> [{ top, bottom, ground, ink, alpha, red }]   (page coordinates)
      opts.lenses(scrollY, W, H) -> [{ x, y, r }]                  (page coordinates)
  */
  function page(canvas, opts) {
    const o = Object.assign({}, DEFAULTS, { fade: 0.06 }, opts || {});
    const ctx = canvas.getContext("2d", { alpha: false });
    let W = 0, H = 0, dpr = 1, raf = 0, running = false, t = 0, frameN = 0, lastSy = 0;
    let rand = rng(o.seed), noise = makeNoise(rng(o.seed * 7919 + 13)), parts = [], bands = [];
    const mouse = { x: -9999, y: -9999, on: false };
    const DEF = { ground: o.ground, ink: o.ink, alpha: o.inkAlpha, red: o.redShare };

    const bandAt = py => { for (let i = 0; i < bands.length; i++) if (py < bands[i].bottom) return bands[i]; return bands[bands.length - 1] || DEF; };
    // paint the grounds of everything between viewport rows y0..y1 at the given opacity
    function paint(y0, y1, a) {
      const sy = lastSy;
      ctx.globalAlpha = a;
      if (a >= 1) { ctx.fillStyle = o.ground; ctx.fillRect(0, y0, W, y1 - y0); }
      for (const b of bands) {
        const top = Math.max(y0, b.top - sy), bot = Math.min(y1, b.bottom - sy);
        if (bot > top) { ctx.fillStyle = b.ground; ctx.fillRect(0, top, W, bot - top); }
      }
      if (!bands.length) { ctx.fillStyle = o.ground; ctx.fillRect(0, y0, W, y1 - y0); }
      ctx.globalAlpha = 1;
    }
    function spawn(q) {
      q.x = rand() * W; q.y = rand() * H;
      q.life = 60 + rand() * 220;
      q.red = rand(); // compared against each band's red share
      return q;
    }
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, o.maxDpr || 1.25);
      W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lastSy = window.scrollY;
      bands = o.bands ? o.bands() : [];
      paint(0, H, 1);
      parts = []; for (let i = 0; i < o.count; i++) parts.push(spawn({}));
    }

    // keep the trails glued to the page while it scrolls
    function follow() {
      const sy = window.scrollY, dy = sy - lastSy;
      if (!dy) return;
      if (Math.abs(dy) >= H * 0.9) { lastSy = sy; paint(0, H, 1); parts.forEach(spawn); return; }
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "copy";
      ctx.drawImage(canvas, 0, Math.round(-dy * dpr));
      ctx.restore();
      lastSy = sy;
      if (dy > 0) paint(H - dy - 1, H, 1); else paint(0, -dy + 1, 1);
      for (const q of parts) { q.y -= dy; if (q.y < -10 || q.y > H + 10) { spawn(q); } }
    }

    function step() {
      const sy = lastSy, scale = 0.0021, sp = 1.15 * o.speed;
      t += 0.0016 * o.speed;
      frameN++;
      paint(0, H, frameN % 40 === 0 ? Math.min(1, o.fade * 3) : o.fade);
      const lenses = o.lenses ? o.lenses(sy, W, H) : [];
      const paths = new Map();
      const pathFor = key => { let p = paths.get(key); if (!p) { p = new Path2D(); paths.set(key, p); } return p; };
      for (let i = 0; i < parts.length; i++) {
        const q = parts[i], py = q.y + sy;
        const a = noise(q.x * scale, py * scale, t) * Math.PI * 4;
        let vx = Math.cos(a), vy = Math.sin(a), near = false;
        for (const L of lenses) {
          const dx = q.x - L.x, dyy = py - L.y, d = Math.hypot(dx, dyy) || 1;
          if (d < L.r * 1.9) {
            const k = Math.max(0, 1 - Math.abs(d - L.r) / (L.r * 0.9)), s = d < L.r ? -1 : 1;
            vx += (-dyy / d) * 1.6 * k - (dx / d) * 0.35 * s * k;
            vy += (dx / d) * 1.6 * k - (dyy / d) * 0.35 * s * k;
            if (d < L.r * 1.6) near = true;
          }
        }
        if (mouse.on) {
          const mx = q.x - mouse.x, my = q.y - mouse.y, md = Math.hypot(mx, my);
          if (md < 150 && md > 0.01) { const f = (1 - md / 150) * 3.2; vx += (mx / md) * f; vy += (my / md) * f; }
        }
        const nx = q.x + vx * sp, ny = q.y + vy * sp;
        const b = bandAt(py);
        const isRed = q.red < (near ? Math.max(b.red, 0.12) : b.red * 0.35);
        const key = isRed ? "r" : b.ink + "|" + b.alpha;
        const p = pathFor(key); p.moveTo(q.x, q.y); p.lineTo(nx, ny);
        q.x = nx; q.y = ny; q.life -= 1;
        if (q.life <= 0 || nx < -10 || ny < -10 || nx > W + 10 || ny > H + 10) spawn(q);
      }
      for (const [key, p] of paths) {
        if (key === "r") { ctx.lineWidth = 1.1; ctx.strokeStyle = `rgba(${o.red},.72)`; }
        else { const [ink, al] = key.split("|"); ctx.lineWidth = 0.7; ctx.strokeStyle = `rgba(${ink},${al})`; }
        ctx.stroke(p);
      }
    }

    let last = 0, acc = 0;
    function loop(now) {
      if (!running) return;
      follow();
      acc += last ? Math.min(100, now - last) : 16.67;
      last = now;
      let n = 0;
      while (acc >= 16.67 && n < 3) { step(); acc -= 16.67; n++; }
      if (n === 3) acc = 0;
      raf = requestAnimationFrame(loop);
    }
    function start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }
    // reduced motion: a finished still of the current view, redrawn after scrolling stops
    function still() {
      lastSy = window.scrollY; paint(0, H, 1); parts.forEach(spawn);
      const f = o.fade; o.fade = 0.03;
      for (let i = 0; i < 150; i++) step();
      o.fade = f;
    }

    addEventListener("pointermove", e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = e.pointerType === "mouse"; }, { passive: true });
    document.addEventListener("pointerleave", () => { mouse.on = false; });
    size();
    return {
      start, stop, still,
      size() { size(); },
      refresh() { bands = o.bands ? o.bands() : []; }
    };
  }

  window.LNBFlow = { create, page };
})();

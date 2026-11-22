// LNB camera: a full-frame mirrorless body (A7 III-style proportions, no Sony branding) built from
// primitives in Three.js. Scroll poses come from a shared state object that GSAP ScrollTrigger tweens.
// Exposes createCamera(canvas, state) -> { setScreen(i) }.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const SCREENS = [
  "../assets/img/yt-1561Nepoggw-s.webp",   // Media: Psyche Clothing commercial
  "../assets/img/films-vere.webp",         // Films: Vere & Rea pre-wedding film
  "../assets/img/studio-flower.webp",      // Studio: portrait session
  "../assets/img/woh-dj-red.webp"          // Nights: behind the decks
];

export const POSES = {
  media:  { ry: -2.45, rx: 0.20, lens: 1.00, rec: 0 },
  films:  { ry: -1.42, rx: 0.06, lens: 1.75, rec: 0 },
  studio: { ry:  0.55, rx: 0.14, lens: 0.72, rec: 0 },
  woh:    { ry:  2.70, rx: 0.22, lens: 1.00, rec: 1 }
};

function badgeTexture() {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64;
  const x = c.getContext("2d");
  x.fillStyle = "#151413"; x.fillRect(0, 0, 256, 64);
  x.fillStyle = "#EEE9E1"; x.font = "700 44px 'Host Grotesk', Arial, sans-serif";
  x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("LNB", 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createCamera(canvas, state) {
  const small = matchMedia("(max-width: 760px)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0, 0.12, 3.7);

  // lights: soft key, cool fill, REC-red rim
  const key = new THREE.DirectionalLight(0xfff3e6, 3.2); key.position.set(-3, 4, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcc6d6, 0.9); fill.position.set(4, 1, 2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xe3342a, 2.6); rim.position.set(2.5, 1.5, -4); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  // materials
  const body = new THREE.MeshPhysicalMaterial({ color: 0x2d2b29, roughness: 0.48, metalness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x191817, roughness: 0.9, metalness: 0 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9a948c, roughness: 0.28, metalness: 1 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.35, metalness: 0.9 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x06070a, roughness: 0.03, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.4 });
  const red = new THREE.MeshStandardMaterial({ color: 0xe3342a, emissive: 0xe3342a, emissiveIntensity: 0.6, roughness: 0.4 });
  const tally = new THREE.MeshStandardMaterial({ color: 0x3a0d0a, emissive: 0xff2a1a, emissiveIntensity: 0 });

  const geos = [];
  const add = (geo, mat, x, y, z, parent) => { geos.push(geo); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (parent || rig).add(m); return m; };
  const rbox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 4, r);

  const model = new THREE.Group();   // rotated by scroll
  const rig = new THREE.Group();     // centred camera body
  model.add(rig); scene.add(model);
  rig.position.set(-0.06, -0.08, -0.18);

  // body, grip, viewfinder hump
  add(rbox(1.27, 0.8, 0.42, 0.07), body, 0, 0, 0);
  add(rbox(0.36, 0.84, 0.64, 0.14), rubber, -0.47, -0.01, 0.1);
  add(rbox(0.5, 0.26, 0.5, 0.06), body, 0.08, 0.5, -0.02);
  add(rbox(0.24, 0.025, 0.22, 0.01), darkMetal, 0.08, 0.64, -0.03);                       // hot shoe
  // badge on the hump
  const badge = add(new THREE.PlaneGeometry(0.26, 0.065), new THREE.MeshBasicMaterial({ map: badgeTexture(), toneMapped: false }), 0.08, 0.53, 0.231);
  // dials and shutter button
  const dial = (r, h, x, y, z) => { const d = add(new THREE.CylinderGeometry(r, r, h, 48), darkMetal, x, y, z); return d; };
  dial(0.13, 0.08, -0.22, 0.44, -0.04);
  dial(0.12, 0.06, -0.5, 0.45, -0.1);
  dial(0.06, 0.035, -0.47, 0.46, 0.22);
  add(new THREE.TorusGeometry(0.07, 0.012, 12, 40), metal, -0.47, 0.44, 0.22).rotation.x = Math.PI / 2;
  // REC tally light, front right
  add(new THREE.SphereGeometry(0.028, 20, 12), tally, 0.5, 0.28, 0.215);
  // rear: eyecup and screen
  add(rbox(0.38, 0.22, 0.08, 0.04), rubber, 0.08, 0.49, -0.29);
  add(rbox(0.78, 0.54, 0.04, 0.02), rubber, 0.1, -0.05, -0.225);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x111111, toneMapped: false });
  const screen = add(new THREE.PlaneGeometry(0.72, 0.48), screenMat, 0.1, -0.05, -0.247);
  screen.rotation.y = Math.PI;

  // lens mount and lens (the zoom section scales with state.lens)
  const mount = new THREE.Group(); mount.position.set(0.08, -0.02, 0.21); rig.add(mount);
  const ring = add(new THREE.TorusGeometry(0.27, 0.02, 16, 64), metal, 0, 0, 0.005, mount);
  const cyl = (r, len, mat, z, parent) => { const m = add(new THREE.CylinderGeometry(r, r, len, 64), mat, 0, 0, z + len / 2, parent); m.rotation.x = Math.PI / 2; return m; };
  cyl(0.275, 0.08, darkMetal, 0, mount);
  const zoom = new THREE.Group(); zoom.position.z = 0.08; mount.add(zoom);
  cyl(0.29, 0.2, body, 0, zoom);
  for (let i = 0; i < 9; i++) add(new THREE.TorusGeometry(0.296, 0.008, 8, 64), rubber, 0, 0, 0.03 + i * 0.018, zoom);
  const front = new THREE.Group(); mount.add(front);
  cyl(0.3, 0.14, body, 0, front);
  add(new THREE.TorusGeometry(0.301, 0.006, 8, 64), red, 0, 0, 0.11, front);
  add(new THREE.TorusGeometry(0.27, 0.025, 16, 64), darkMetal, 0, 0, 0.14, front);
  const capR = 0.5, theta = 0.52;
  const cap = add(new THREE.SphereGeometry(capR, 48, 16, 0, Math.PI * 2, 0, theta), glass, 0, 0, 0, front);
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.14 - capR * Math.cos(theta) + 0.012;

  // screen photos (loaded lazily, small files)
  const loader = new THREE.TextureLoader();
  const tex = [];
  let screenIndex = -1;
  function setScreen(i) {
    if (i === screenIndex) return; screenIndex = i;
    const use = t => { screenMat.map = t; screenMat.color.set(0xffffff); screenMat.needsUpdate = true; };
    if (tex[i]) return use(tex[i]);
    loader.load(SCREENS[i], t => {
      t.colorSpace = THREE.SRGBColorSpace;
      // cover-fit the 3:2 screen
      const a = t.image.width / t.image.height, s = 1.5;
      if (a > s) { t.repeat.set(s / a, 1); t.offset.set((1 - s / a) / 2, 0); } else { t.repeat.set(1, a / s); t.offset.set(0, (1 - a / s) / 2); }
      tex[i] = t; if (screenIndex === i) use(t);
    });
  }
  setScreen(0);

  let raf = 0, running = false, last = 0, visible = true, time = 0;
  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.position.z = w / h < 1.2 ? 3.7 * (1.2 / (w / h)) * 0.95 : 3.7;
    cam.updateProjectionMatrix();
  }
  function pose() {
    model.rotation.y = state.ry + Math.sin(time * 0.35) * 0.06;
    model.rotation.x = state.rx + Math.sin(time * 0.5) * 0.02;
    model.position.y = Math.sin(time * 0.8) * 0.03;
    zoom.scale.z = state.lens;
    front.position.z = 0.08 + 0.2 * state.lens;
    tally.emissiveIntensity = state.rec * (Math.sin(time * 5) > 0 ? 3 : 0.4);
  }
  function frame(now) {
    if (!running) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now; time += dt;
    pose();
    renderer.render(scene, cam);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || !visible || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  // pause when off-screen or the tab is hidden
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(canvas);
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  addEventListener("resize", () => { resize(); if (!running) { pose(); renderer.render(scene, cam); } });

  resize(); pose(); renderer.render(scene, cam); start();
  return { setScreen };
}

// LNB lens: one liquid glass element that changes shape for each crew (Meng To threejs / webgl-3d-object skills)
// Loaded only when the crews section is near and motion is allowed. Exposes window.LNBLens.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";

const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const VERT = NOISE + /* glsl */`
uniform float uTime, uAmp, uFreq, uSpike, uBreath;
uniform vec3 uScale;
varying vec3 vView;
varying vec3 vObj;
void main(){
  vec3 p = position;
  float n = snoise(p*uFreq + vec3(0.0, uTime*0.28, uTime*0.12));
  float s = pow(abs(snoise(p*uFreq*2.6 + uTime*0.9)), 3.0);
  p += normal * (n*uAmp + s*uSpike);
  p *= uScale * (1.0 + uBreath*sin(uTime*0.8));
  vObj = p;
  vec4 mv = modelViewMatrix * vec4(p,1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */`
uniform float uRed, uTime;
varying vec3 vView;
varying vec3 vObj;
void main(){
  vec3 N = normalize(cross(dFdx(vView), dFdy(vView)));
  vec3 V = normalize(-vView);
  float ndv = clamp(dot(N,V),0.0,1.0);
  float fres = pow(1.0-ndv, 2.4);
  vec3 L = normalize(vec3(-0.45,0.75,0.55));
  float spec = pow(max(dot(reflect(-L,N),V),0.0), 48.0);
  float spec2 = pow(max(dot(reflect(-normalize(vec3(0.7,-0.2,0.6)),N),V),0.0), 18.0);
  vec3 glass = vec3(0.05,0.044,0.04);
  vec3 sky = mix(vec3(0.93,0.9,0.86), vec3(0.6,0.52,0.46), 0.5-0.5*N.y);
  vec3 coat = mix(vec3(0.86,0.6,0.42), vec3(0.86,0.2,0.12), uRed);
  vec3 col = glass + sky*0.10*(0.5+0.5*N.y);
  col += coat * fres * 1.35 + sky * pow(1.0-ndv,4.0) * 0.55;
  col += vec3(1.0,0.97,0.92) * spec * 0.95 + coat * spec2 * 0.35;
  gl_FragColor = vec4(col,1.0);
}`;

export const STATES = {
  media:  { sx: 1.42, sy: 0.84, sz: 0.95, amp: 0.05, freq: 1.20, spike: 0.00, red: 0.25, spin: 0.22 },
  films:  { sx: 1.80, sy: 0.74, sz: 0.86, amp: 0.06, freq: 1.00, spike: 0.00, red: 0.12, spin: 0.14 },
  studio: { sx: 0.96, sy: 1.14, sz: 0.98, amp: 0.04, freq: 0.85, spike: 0.00, red: 0.40, spin: 0.10 },
  woh:    { sx: 1.06, sy: 1.06, sz: 1.06, amp: 0.22, freq: 1.45, spike: 0.05, red: 1.00, spin: 0.35 }
};

export function createLens(canvas, shared) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  camera.position.set(0, 0, 6.2);
  const small = matchMedia("(max-width: 760px)").matches;
  const geo = new THREE.IcosahedronGeometry(1.15, small ? 40 : 64);
  const s = STATES.media;
  const uniforms = {
    uTime: { value: 0 }, uAmp: { value: s.amp }, uFreq: { value: s.freq }, uSpike: { value: s.spike },
    uBreath: { value: 0.025 }, uRed: { value: s.red }, uScale: { value: new THREE.Vector3(s.sx, s.sy, s.sz) }
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.set(0.25, -0.4, 0.05);
  scene.add(mesh);

  // the live state that GSAP tweens
  const state = shared || Object.assign({}, s);
  let raf = 0, running = false, last = 0, visible = true;

  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the widest shape (films) inside the frame on narrow canvases
    camera.position.z = w / h < 1.25 ? 6.2 * (1.25 / (w / h)) * 0.92 : 6.2;
    camera.updateProjectionMatrix();
  }
  function apply() {
    uniforms.uAmp.value = state.amp; uniforms.uFreq.value = state.freq; uniforms.uSpike.value = state.spike;
    uniforms.uRed.value = state.red; uniforms.uScale.value.set(state.sx, state.sy, state.sz);
  }
  function frame(now) {
    if (!running) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    uniforms.uTime.value += dt;
    mesh.rotation.y += dt * state.spin;
    mesh.rotation.x = 0.25 + Math.sin(uniforms.uTime.value * 0.3) * 0.08;
    apply();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (running || !visible) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  // pause when the section is off-screen or the tab is hidden
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); });
  io.observe(canvas);
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  addEventListener("resize", () => { resize(); if (!running) { apply(); renderer.render(scene, camera); } });

  resize(); apply(); renderer.render(scene, camera); start();
  return { state, render() { apply(); renderer.render(scene, camera); } };
}

import * as THREE from 'three';

// ══════════════════════════════════════════════
// 配置
// ══════════════════════════════════════════════
enum SceneType { Classroom = 'classroom', Corridor = 'corridor' }
const CFG = {
  moveSpeed: 3.5, stepInterval: 0.45, interactRange: 2.8, interactThrottle: 0.1,
  classroom: { w: 7, d: 8, h: 3.5, bounds: { minX: -3.2, maxX: 3.2, minZ: -3.7, maxZ: 3.7 } },
  corridor: { w: 3, h: 3.5, len: 22, bounds: { minX: -1.3, maxX: 1.3, minZ: -18.5, maxZ: 2.8 }, doorOpenMinZ: -21 },
  candle: { flickerMin: 0.85, flickerRange: 0.3, lerpSpeed: 0.3, updateEvery: 3 },
} as const;

// 复用向量
const _fwd = new THREE.Vector3(), _rgt = new THREE.Vector3(), _camTarget = new THREE.Vector3(), _lookDir = new THREE.Vector3();
const _playerBox = new THREE.Box3(), _colliderBox = new THREE.Box3();
const _testBox = new THREE.Box3(), _testOffset = new THREE.Vector3();

// ══════════════════════════════════════════════
// 场景 & 渲染器
// ══════════════════════════════════════════════
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000011);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.7;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 60);
const sceneRoot = new THREE.Group(); scene.add(sceneRoot);
const hintEl = document.getElementById('hint')!;

// ══════════════════════════════════════════════
// 音效
// ══════════════════════════════════════════════
let audioCtx: AudioContext | null = null;
function getAudio(): AudioContext { if (!audioCtx) audioCtx = new AudioContext(); return audioCtx; }
function playSound(f: number, d: number, t: OscillatorType = 'triangle', v = 0.04): void {
  try { const c = getAudio(); const o = c.createOscillator(); const g = c.createGain();
    o.type = t; o.frequency.value = f; g.gain.setValueAtTime(v, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + d); } catch {}
}
function playStep(): void { playSound(55 + Math.random() * 35, 0.12, 'triangle', 0.025); }

// ══════════════════════════════════════════════
// 纹理
// ══════════════════════════════════════════════
function makeDirtyWallTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8b7d6b'; ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 10 + Math.random() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(60,50,40,0.35)'); g.addColorStop(1, 'rgba(60,50,40,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.strokeStyle = 'rgba(40,30,20,0.15)'; ctx.lineWidth = 1;
  for (let i = 0; i < 25; i++) { ctx.beginPath(); ctx.moveTo(Math.random() * 512, Math.random() * 512); ctx.lineTo(Math.random() * 512, Math.random() * 512); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function makeBrickTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1a1a0f'; ctx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 11; row++) {
    const ox = row % 2 === 0 ? 0 : 32;
    for (let col = -1; col < 9; col++) {
      ctx.fillStyle = '#4a3a2a'; ctx.fillRect(col * 66 + ox + 3, row * 24 + 3, 60, 18);
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(col * 66 + ox + 3, row * 24 + 3, 60, 9);
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function makePlankTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2a1a0a'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(${40+Math.random()*25},${25+Math.random()*20},${10+Math.random()*15},0.4)`; ctx.fillRect(Math.random()*256, Math.random()*256, 70+Math.random()*50, 2); }
  for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(Math.random()*256, Math.random()*256, 25+Math.random()*30, 15+Math.random()*20); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// 材质
const dirtyWallMat = new THREE.MeshStandardMaterial({ map: makeDirtyWallTex(), roughness: 0.95, metalness: 0 });
const brickWallMat = new THREE.MeshStandardMaterial({ map: makeBrickTex(), roughness: 0.85, metalness: 0.05 });
brickWallMat.map!.repeat.set(2, 8);
const plankFloorMat = new THREE.MeshStandardMaterial({ map: makePlankTex(), roughness: 0.9 });
plankFloorMat.map!.repeat.set(4, 4);
const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.4 });
const knobMat = new THREE.MeshStandardMaterial({ color: 0xddaa44, roughness: 0.2, metalness: 0.9 });

// ══════════════════════════════════════════════
// 碰撞系统
// ══════════════════════════════════════════════
const colliders: THREE.Box3[] = [];
function addCollider(obj: THREE.Object3D): void { colliders.push(new THREE.Box3().setFromObject(obj)); }
function checkCollision(playerPos: THREE.Vector3, delta: THREE.Vector3): THREE.Vector3 {
  const result = delta.clone(); const hw = 0.25, hd = 0.2, hh = 0.7;
  _playerBox.min.set(playerPos.x - hw, playerPos.y, playerPos.z - hd);
  _playerBox.max.set(playerPos.x + hw, playerPos.y + hh, playerPos.z + hd);
  // 复用_ testBox + _testOffset 避免 GC
  _testBox.copy(_playerBox); _testOffset.set(delta.x, 0, 0); _testBox.translate(_testOffset);
  for (const c of colliders) { if (c.intersectsBox(_testBox)) { result.x = 0; break; } }
  _testBox.copy(_playerBox); _testOffset.set(0, 0, delta.z); _testBox.translate(_testOffset);
  for (const c of colliders) { if (c.intersectsBox(_testBox)) { result.z = 0; break; } }
  return result;
}

// ══════════════════════════════════════════════
// 输入
// ══════════════════════════════════════════════
const keys: Record<string, boolean> = {};
document.addEventListener('keydown', e => { const k = e.key.toLowerCase(); if ('wasde'.includes(k)) { keys[k] = true; e.preventDefault(); }});
document.addEventListener('keyup', e => { const k = e.key.toLowerCase(); if ('wasde'.includes(k)) { keys[k] = false; e.preventDefault(); }});
let camYaw = 0, camPitch = 0.3, isLocked = false;
renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => { isLocked = document.pointerLockElement === renderer.domElement; });

// ══════════════════════════════════════════════
// 角色
// ══════════════════════════════════════════════
const player = new THREE.Group(); scene.add(player);
let rightArm!: THREE.Group, leftArm!: THREE.Group, flashlightModel!: THREE.Group;

function buildPlayerModel(): void {
  const skin = new THREE.MeshStandardMaterial({ color: 0xf4d4a8, roughness: 0.7 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x3366aa, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.5 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x332211, roughness: 0.8 });
  [[-0.1,0],[0.1,0]].forEach(([lx,lz]) => {
    player.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.16), dark)).position.set(lx, 0.2, lz);
    player.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.2), shoe)).position.set(lx, 0.04, 0.02);
  });
  player.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.25), blue)).position.set(0, 0.65, 0);

  // 左臂
  leftArm = new THREE.Group(); leftArm.name = 'leftArm'; leftArm.position.set(-0.28, 0.65, 0);
  leftArm.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), blue)).position.set(0, -0.1, 0);
  leftArm.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), skin)).position.set(0, -0.35, 0);
  player.add(leftArm);

  // 右臂 (拿手电筒)
  rightArm = new THREE.Group(); rightArm.name = 'rightArm'; rightArm.position.set(0.28, 0.65, 0);
  rightArm.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), blue)).position.set(0, -0.1, 0);
  rightArm.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), skin)).position.set(0, -0.35, 0);
  player.add(rightArm);

  // 手电筒模型（绑在右臂末端）
  flashlightModel = new THREE.Group();
  const flBody = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.15, 8), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 }));
  flBody.rotation.x = Math.PI/2; flashlightModel.add(flBody);
  const flHead = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.2 }));
  flHead.rotation.x = Math.PI/2; flHead.position.set(0, 0.09, 0); flashlightModel.add(flHead);
  flashlightModel.position.set(0, -0.38, 0.08); flashlightModel.rotation.set(0, Math.PI/2, 0);
  rightArm.add(flashlightModel);

  // 头
  player.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.28), skin)).position.set(0, 1.08, 0);
  player.add(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.3), dark)).position.set(0, 1.28, 0);
  player.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.06), dark)).position.set(0, 1.22, 0.14);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  player.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), eyeMat)).position.set(-0.07, 1.13, 0.14);
  player.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), eyeMat)).position.set(0.07, 1.13, 0.14);
  player.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), eyeMat)).position.set(0, 1.04, 0.14);
}
buildPlayerModel();
player.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; }});

// ══════════════════════════════════════════════
// 相机
// ══════════════════════════════════════════════
document.addEventListener('mousemove', e => { if (!isLocked) return; camYaw -= e.movementX * 0.003; camPitch -= e.movementY * 0.003; camPitch = Math.max(-0.3, Math.min(1.2, camPitch)); });
function updateCamera(): void {
  const tx = player.position.x, ty = player.position.y + 1.3, tz = player.position.z;
  const dist = 4.5, h = 2.2, sinY = Math.sin(camYaw), cosY = Math.cos(camYaw), cosP = Math.cos(camPitch);
  camera.position.set(tx - sinY * dist, ty + h * cosP, tz + cosY * dist);
  camera.lookAt(_camTarget.set(tx, ty, tz));
}

const flashlight = new THREE.SpotLight(0xffeedd, 20, 12, Math.PI/7, 0.25, 0.6);
flashlight.castShadow = true; flashlight.shadow.mapSize.set(512, 512);
flashlight.shadow.camera.near = 0.1; flashlight.shadow.camera.far = 20;
flashlight.position.set(0, 0, 0.15);
// 手电筒光源绑定到模型
flashlightModel.add(flashlight); flashlightModel.add(flashlight.target);
flashlight.target.position.set(0, 0, -3);
// 绑到右手手电筒模型上（模型创建后切换绑定）

// ══════════════════════════════════════════════
// 旁白系统
// ══════════════════════════════════════════════
class NarrationSystem {
  private el: HTMLElement; private textEl: HTMLElement; private timer: number | null = null;
  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);max-width:560px;padding:14px 22px;background:rgba(0,0,0,0.78);border:1px solid rgba(255,200,100,0.25);border-radius:8px;color:#e8d5b7;font:15px/1.6 monospace;opacity:0;transition:opacity 0.4s;pointer-events:none;z-index:100';
    this.textEl = document.createElement('span'); this.el.appendChild(this.textEl);
    document.body.appendChild(this.el);
  }
  say(text: string, duration = 4500): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.el.style.opacity = '1'; this.textEl.textContent = ''; let i = 0;
    this.timer = window.setInterval(() => { if (i < text.length) { this.textEl.textContent += text[i]; i++; } else { if (this.timer) clearInterval(this.timer); this.timer = null; }}, 40);
    setTimeout(() => { this.el.style.opacity = '0'; }, duration);
  }
}
const narration = new NarrationSystem();

// ══════════════════════════════════════════════
// 场景管理
// ══════════════════════════════════════════════
let currentScene: SceneType = SceneType.Classroom;
let interactiveObjects: THREE.Object3D[] = [];
const sconces: THREE.Group[] = [];
let dustPoints: THREE.Points | null = null;
let doorGroup: THREE.Group;
let doorClosed = true, doorAnimating = false;
let doorTimeout: number | null = null;
let diarySolved = false, clockSolved = false;
let ambientOsc: OscillatorNode | null = null;
const ambientTexts: Record<string, string> = {};

const activeTimeouts: number[] = [];
function safeSetTimeout(cb: () => void, delay: number): number {
  const id = window.setTimeout(() => { const i = activeTimeouts.indexOf(id); if (i !== -1) activeTimeouts.splice(i, 1); cb(); }, delay);
  activeTimeouts.push(id); return id;
}
function clearAllTimeouts(): void { activeTimeouts.forEach(id => clearTimeout(id)); activeTimeouts.length = 0; }

function clearScene(): void {
  clearAllTimeouts();
  while (sceneRoot.children.length > 0) sceneRoot.remove(sceneRoot.children[0]);
  interactiveObjects = []; sconces.length = 0; colliders.length = 0;
}

// ══════════════════════════════════════════════
// 教室
// ══════════════════════════════════════════════
function buildClassroom(): void {
  const { w: rw, d: rd, h: rh } = CFG.classroom;
  const boardZ = -rd/2;
  scene.background = new THREE.Color(0x111122); scene.fog = new THREE.FogExp2(0x111122, 0.005);

  // 地板
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(rw, rd), plankFloorMat);
  floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; sceneRoot.add(floor);
  addCollider(new THREE.Mesh(new THREE.BoxGeometry(rw, 0.01, rd)));

  // 天花板
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(rw, rd), ceilingMat);
  ceil.rotation.x = Math.PI/2; ceil.position.y = rh; sceneRoot.add(ceil);

  // 墙
  const wGeoXY = new THREE.PlaneGeometry(rw, rh), wGeoZY = new THREE.PlaneGeometry(rd, rh);
  sceneRoot.add(new THREE.Mesh(wGeoXY, dirtyWallMat)).position.set(0, rh/2, boardZ); // 前墙(黑板)
  sceneRoot.add(new THREE.Mesh(wGeoXY, dirtyWallMat)).position.set(0, rh/2, -boardZ); // 后墙(门)
  sceneRoot.add(new THREE.Mesh(wGeoZY, dirtyWallMat)).rotation.y = Math.PI/2; (sceneRoot.children[sceneRoot.children.length-1] as THREE.Mesh).position.set(-rw/2, rh/2, 0);
  sceneRoot.add(new THREE.Mesh(wGeoZY, dirtyWallMat)).rotation.y = -Math.PI/2; (sceneRoot.children[sceneRoot.children.length-1] as THREE.Mesh).position.set(rw/2, rh/2, 0);

  // 黑板 + 粉笔字贴图
  const chalkCanvas = document.createElement('canvas'); chalkCanvas.width = 512; chalkCanvas.height = 200;
  const chalkCtx = chalkCanvas.getContext('2d')!;
  chalkCtx.fillStyle = '#224422'; chalkCtx.fillRect(0, 0, 512, 200);
  chalkCtx.fillStyle = '#aaccaa'; chalkCtx.font = '28px monospace';
  chalkCtx.fillText('值日生：墨多多', 140, 50);
  chalkCtx.fillText('今日作业：第12页 第1-4题', 80, 90);
  chalkCtx.font = 'italic 22px monospace'; chalkCtx.fillStyle = '#ccddaa';
  chalkCtx.fillText('R = 18  H = 8  B = 2', 100, 140);
  const chalkTex = new THREE.CanvasTexture(chalkCanvas);
  const board = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 0.05), new THREE.MeshStandardMaterial({ roughness: 0.6 }));
  board.position.set(0, 2.2, boardZ + 0.03); board.receiveShadow = true; sceneRoot.add(board);
  addCollider(board);
  sceneRoot.add(new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1), new THREE.MeshBasicMaterial({ map: chalkTex }))).position.set(0, 2.2, boardZ + 0.06);

  // 讲台
  const podium = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.6), new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.7 }));
  podium.position.set(0, 0.45, boardZ + 2.2); podium.castShadow = true; sceneRoot.add(podium);
  addCollider(podium);

  // 课桌
  for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
    const dg = new THREE.Group();
    dg.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.5), new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.6 }))).position.y = 0.7;
    for (const [dx, dz] of [[-0.35,-0.2],[0.35,-0.2],[-0.35,0.2],[0.35,0.2]])
      dg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.7,6), new THREE.MeshStandardMaterial({ color:0x555, roughness:0.5, metalness:0.3 }))).position.set(dx, 0.35, dz);
    dg.position.set(-2 + col*2, 0, 0.5 + row*2.2); sceneRoot.add(dg);
    addCollider(dg);
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.35), new THREE.MeshStandardMaterial({ color:0x666, roughness:0.5 }));
    chair.position.set(-2+col*2, 0.45, 0.85 + row*2.2); sceneRoot.add(chair); addCollider(chair);
  }

  // 窗户+月光
  for (let i = 0; i < 2; i++) {
    const winZ = -2 + i * 4;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.06), new THREE.MeshStandardMaterial({ color: 0x444, roughness: 0.4, metalness: 0.3 }));
    frame.position.set(rw/2 - 0.03, 2.2, winZ); sceneRoot.add(frame);
    sceneRoot.add(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.4), new THREE.MeshStandardMaterial({ color: 0x334466, roughness: 0.1, transparent: true, opacity: 0.35 }))).position.set(rw/2 - 0.07, 2.2, winZ);
    const moonLight = new THREE.PointLight(0x334466, 2.5, 6);
    moonLight.position.set(rw/2 - 0.3, 2.2, winZ); sceneRoot.add(moonLight);
  }

  // 体积光
  const beamGeo = new THREE.ConeGeometry(1.2, 5, 8, 1, true);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xaaaaff, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.set(rw/2 - 0.5, 2.2, -2); beam.rotation.x = Math.PI/2; beam.rotation.z = -Math.PI/7; sceneRoot.add(beam);

  // 天花板灯
  const ceilingLight = new THREE.PointLight(0xffffcc, 5, 10);
  ceilingLight.castShadow = true; ceilingLight.shadow.mapSize.set(512, 512);
  ceilingLight.position.set(0, rh - 0.3, 0); ceilingLight.name = 'ceilingLight'; sceneRoot.add(ceilingLight);
  scene.add(new THREE.AmbientLight(0x222233, 0.5));

  // 蛛网（InstancedMesh）
  const webGeo = new THREE.PlaneGeometry(0.6, 0.6);
  const webMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
  const webs = new THREE.InstancedMesh(webGeo, webMat, 6);
  const dummy = new THREE.Object3D();
  const corners = [[-rw/2+0.1,rh-0.1,boardZ+0.1],[rw/2-0.1,rh-0.1,boardZ+0.1],[-rw/2+0.1,rh-0.1,-boardZ-0.1],[rw/2-0.1,rh-0.1,-boardZ-0.1],[-rw/2+0.1,rh-0.8,-2],[rw/2-0.1,rh-0.8,-2]];
  corners.forEach(([cx,cy,cz], i) => { dummy.position.set(cx, cy, cz); dummy.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,0); dummy.updateMatrix(); webs.setMatrixAt(i, dummy.matrix); });
  sceneRoot.add(webs);

  // 挂钟（带指针）
  const clockGroup = new THREE.Group();
  const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 24), new THREE.MeshStandardMaterial({ color: 0xeeeedd, roughness: 0.4 }));
  clockFace.rotation.x = Math.PI/2; clockGroup.add(clockFace);
  for (let h = 1; h <= 12; h++) {
    const ang = (h - 3) * Math.PI / 6;
    clockGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.01), new THREE.MeshBasicMaterial({ color: 0x222222 }))).position.set(Math.cos(ang)*0.22, 0.021, Math.sin(ang)*0.22);
  }
  // 时针 (指向3点的初始位置，静止不动制造诡异感)
  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.02), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  hourHand.position.set(0, 0.11, 0.022); hourHand.rotation.z = 0; clockGroup.add(hourHand);
  // 分针 (指向12)
  const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.02), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  minuteHand.position.set(0, 0.15, 0.025); clockGroup.add(minuteHand);
  clockGroup.position.set(-rw/2 + 0.06, 2.2, -1); clockGroup.rotation.y = Math.PI/2;
  clockGroup.name = 'clock'; sceneRoot.add(clockGroup);
  interactiveObjects.push(clockGroup);

  // 地上的日记本
  const diaryGroup = new THREE.Group();
  diaryGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.35), new THREE.MeshStandardMaterial({ color: 0x886644, roughness: 0.6 })));
  diaryGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.3), new THREE.MeshBasicMaterial({ color: 0xffcc88 }))).rotation.y = Math.PI/2;
  diaryGroup.position.set(1.5, 0.01, -1); diaryGroup.rotation.z = 0.15;
  diaryGroup.name = 'diary'; sceneRoot.add(diaryGroup);
  interactiveObjects.push(diaryGroup);
  const diaryGlow = new THREE.PointLight(0xffcc44, 0.4, 1.5);
  diaryGlow.position.set(1.5, 0.1, -1); diaryGlow.name = 'diary_glow'; sceneRoot.add(diaryGlow);

  // ── 氛围交互点 ──
  const ambients: { x:number; z:number; name:string; text:string; }[] = [
    { x: -2, z: 1, name: 'desk_drawer', text: '抽屉拉开来…里面空空的，只有一张褪色的照片，背面写着"1987级"。' },
    { x: 1.5, z: boardZ + 2.5, name: 'chalk_box', text: '粉笔都断成了一截一截的，像是被什么东西用力捏碎的…' },
    { x: -1, z: 2.5, name: 'old_book', text: '翻开书，第12页被撕掉了。页角有暗红色的污渍…是血吗？' },
    { x: 2.2, z: -1.5, name: 'trash', text: '垃圾桶里有一团皱巴巴的纸条，上面歪歪扭扭写着两个字：别回头。' },
    { x: -2.5, z: -2, name: 'window_look', text: '窗外一片漆黑。玻璃上映出的…好像不是你自己的影子。' },
  ];
  ambients.forEach(a => {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.3), new THREE.MeshStandardMaterial({ color: 0x555533, roughness: 0.9, transparent: true, opacity: 0.5 }));
    marker.position.set(a.x, 0.3, a.z); marker.name = a.name; ambientTexts[a.name] = a.text;
    sceneRoot.add(marker); interactiveObjects.push(marker);
  });

  // 门（后墙 +Z）
  const doorW = 1.1, doorH = 2.3, doorZ = -boardZ;
  doorGroup = new THREE.Group(); doorGroup.position.set(-doorW/2, 0, doorZ);
  const dpGeo = new THREE.BoxGeometry(doorW-0.04, doorH-0.04, 0.06); dpGeo.translate((doorW-0.04)/2, (doorH-0.04)/2, 0);
  doorGroup.add(new THREE.Mesh(dpGeo, new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.6 }))).castShadow = true;
  const kx = doorW-0.15, ky = doorH*0.45;
  doorGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.04,0.02,12), knobMat)).position.set(kx, ky, 0.04);
  doorGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.1,12), knobMat)).rotation.z = Math.PI/2;
  doorGroup.children[doorGroup.children.length-1].position.set(kx+0.05, ky, 0.04);
  doorGroup.name = 'door_group'; sceneRoot.add(doorGroup);
  interactiveObjects.push(doorGroup);

  // 灰尘
  createDustParticles(CFG.classroom.w, CFG.classroom.h, CFG.classroom.d);

  player.position.set(0, 0, 2); camYaw = 0; camPitch = 0.3; updateCamera();
  flashlight.intensity = 5; doorClosed = true; diarySolved = false; clockSolved = false;
  setObjective('探索教室：找到地上的日记本 [E键交互]');
  narration.say('这是……我们的教室？怎么感觉气氛不太对劲……', 5000);
}

// ══════════════════════════════════════════════
// 走廊
// ══════════════════════════════════════════════
function buildHallway(): void {
  const { w, h, len } = CFG.corridor;
  scene.background = new THREE.Color(0x050510); scene.fog = new THREE.FogExp2(0x050510, 0.012);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, len), plankFloorMat);
  floor.rotation.x = -Math.PI/2; floor.position.set(0, 0, -len/2 + 2); floor.receiveShadow = true; sceneRoot.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, len), ceilingMat);
  ceil.rotation.x = Math.PI/2; ceil.position.set(0, h, -len/2 + 2); sceneRoot.add(ceil);

  for (let z = 0; z > -len + 2; z -= 3) { sceneRoot.add(new THREE.Mesh(new THREE.BoxGeometry(w+0.1,0.12,0.18), frameMat)).position.set(0, h-0.06, z); }

  const wallGeo = new THREE.PlaneGeometry(len, h); brickWallMat.map!.repeat.set(3, 8);
  const lw = new THREE.Mesh(wallGeo, brickWallMat); lw.rotation.y = Math.PI/2; lw.position.set(-w/2, h/2, -len/2+2); sceneRoot.add(lw);
  const rw = new THREE.Mesh(wallGeo, brickWallMat); rw.rotation.y = -Math.PI/2; rw.position.set(w/2, h/2, -len/2+2); sceneRoot.add(rw);
  sceneRoot.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), brickWallMat)).position.set(0, h/2, 3);

  // 走廊尽头门
  const DOOR_Z = -19, doorW = 1.2, doorH = 2.3;
  const topH = h - doorH, sideW = (w - doorW)/2;
  sceneRoot.add(new THREE.Mesh(new THREE.PlaneGeometry(doorW, topH), brickWallMat)).position.set(0, doorH+topH/2, DOOR_Z);
  sceneRoot.add(new THREE.Mesh(new THREE.PlaneGeometry(sideW, h), brickWallMat)).position.set(-doorW/2-sideW/2, h/2, DOOR_Z);
  sceneRoot.add(new THREE.Mesh(new THREE.PlaneGeometry(sideW, h), brickWallMat)).position.set(doorW/2+sideW/2, h/2, DOOR_Z);
  const fw = 0.08, _fd = 0.1;
  [[-doorW/2, doorH/2], [doorW/2, doorH/2], [0, doorH]].forEach(([fx, fy]) => {
    sceneRoot.add(new THREE.Mesh(new THREE.BoxGeometry(fy===doorH ? doorW+fw*2 : fw, fy===doorH ? fw : doorH, _fd), frameMat)).position.set(fx, fy, DOOR_Z);
  });

  doorGroup = new THREE.Group(); doorGroup.position.set(-doorW/2, 0, DOOR_Z);
  const dpG = new THREE.BoxGeometry(doorW-0.04, doorH-0.04, 0.06); dpG.translate((doorW-0.04)/2, (doorH-0.04)/2, 0);
  doorGroup.add(new THREE.Mesh(dpG, new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.7 }))).castShadow = true;
  const kx2 = doorW-0.15, ky2 = doorH*0.45;
  doorGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.04,0.02,12), knobMat)).position.set(kx2, ky2, 0.04);
  doorGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.1,12), knobMat)).rotation.z = Math.PI/2;
  doorGroup.children[doorGroup.children.length-1].position.set(kx2+0.05, ky2, 0.04);
  doorGroup.name = 'door_group'; sceneRoot.add(doorGroup);
  interactiveObjects.push(doorGroup); doorClosed = true;

  // 烛台
  const mkSconce = (wallX: number, y: number, z: number): void => {
    const g = new THREE.Group();
    const iron = new THREE.MeshStandardMaterial({ color:0x2a2a2a, roughness:0.4, metalness:0.7 });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12,0.25,0.02), iron));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.25,8), iron)).rotation.z = Math.PI/2; g.children[g.children.length-1].position.set(0.12,0.08,0);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.15,8), iron)).position.set(0.22,0.18,0);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.04,0.06,12), iron)).position.set(0.22,0.27,0);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.028,0.08,8), new THREE.MeshStandardMaterial({ color:0xeeeedd, roughness:0.8 }))).position.set(0.22,0.33,0);
    const fg = new THREE.SphereGeometry(0.025,8,6); fg.scale(0.6,1.6,0.6);
    const fm = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color:0xff8833 })); fm.position.set(0.22,0.39,0); g.add(fm);
    const ig = new THREE.SphereGeometry(0.012,6,4); ig.scale(0.6,1.5,0.6);
    const im = new THREE.Mesh(ig, new THREE.MeshBasicMaterial({ color:0xffdd88 })); im.position.set(0.22,0.383,0); g.add(im);
    const pl = new THREE.PointLight(0xff8833, 1.8, 4, 1.5); pl.position.set(0.22,0.39,0); g.add(pl);
    g.userData = { flameMesh: fm, innerFlame: im, pointLight: pl, baseIntensity: 1.8, targetIntensity: 1.8, flameScale: 1 };
    const side = wallX > 0 ? 1 : -1;
    g.position.set(wallX - side*0.06, y, z); g.rotation.y = side > 0 ? -Math.PI/2 : Math.PI/2;
    sceneRoot.add(g); sconces.push(g);
  };
  mkSconce(-w/2, 1.8, -3); mkSconce(w/2, 1.8, -8); mkSconce(-w/2, 1.8, -14);

  for (let i = 0; i < 10; i++) sceneRoot.add(new THREE.Mesh(new THREE.BoxGeometry(0.1+Math.random()*0.3, 0.02, 0.1+Math.random()*0.3), new THREE.MeshStandardMaterial({ color:0x333322, roughness:1 }))).position.set((Math.random()-0.5)*2.2, 0.002, -Math.random()*len+1);

  createDustParticles(w, h, len);
  scene.add(new THREE.AmbientLight(0x111122, 0.3));
  flashlight.intensity = 25;

  player.position.set(0, 0, 1.5); camYaw = 0; camPitch = 0.3; updateCamera();
  setObjective('探索黑贝街12号走廊...');
}

// ══════════════════════════════════════════════
// 灰尘（Points + Shader）
// ══════════════════════════════════════════════
function createDustParticles(w: number, h: number, d: number): void {
  const count = 60;
  const positions = new Float32Array(count * 3), speeds = new Float32Array(count), phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i*3] = (Math.random()-0.5) * w; positions[i*3+1] = Math.random() * h; positions[i*3+2] = (Math.random()-0.5) * d;
    speeds[i] = 0.4 + Math.random() * 0.6; phases[i] = Math.random() * Math.PI * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aSpeed;attribute float aPhase;uniform float uTime;varying float vOpacity;void main(){vec3 p=position;p.y+=sin(uTime*aSpeed+aPhase)*0.3;vOpacity=0.12+sin(uTime*aSpeed*1.5+aPhase)*0.1;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);gl_PointSize=2.0;}`,
    fragmentShader: `varying float vOpacity;void main(){gl_FragColor=vec4(1.0,1.0,1.0,vOpacity);}`,
    transparent: true, depthWrite: false,
  });
  dustPoints = new THREE.Points(geo, mat); sceneRoot.add(dustPoints);
}

// ══════════════════════════════════════════════
// UI
// ══════════════════════════════════════════════
function setObjective(text: string): void { const el = document.getElementById('objective'); if (el) el.textContent = text; }
let messageCallback: ((input?: string) => any) | null = null;
function showMessage(text: string, cb: (input?: string) => any): void {
  const overlay = document.getElementById('overlay')!, msgText = document.getElementById('msg-text')!, msgInput = document.getElementById('msg-input') as HTMLInputElement;
  overlay.style.display = 'flex'; msgText.textContent = text;
  msgInput.style.display = text.includes('密码') ? 'block' : 'none'; msgInput.value = ''; messageCallback = cb;
  if (text.includes('密码')) msgInput.focus();
}
function closeMessage(confirmed: boolean): void {
  document.getElementById('overlay')!.style.display = 'none';
  const cb = messageCallback; messageCallback = null;
  const inp = (document.getElementById('msg-input') as HTMLInputElement).value.trim();
  if (confirmed && cb) { const r = cb(inp); if (r === false) return; }
  else if (!confirmed && cb) cb();
}
document.addEventListener('keydown', (e) => {
  if (document.getElementById('overlay')!.style.display === 'flex') { if (e.key === 'Enter') { closeMessage(true); } else if (e.key === 'Escape') { closeMessage(false); }}
});

// ══════════════════════════════════════════════
// 场景切换 & 门动画
// ══════════════════════════════════════════════
function switchToHallway(): void { clearScene(); currentScene = SceneType.Corridor; buildHallway(); }
function toggleDoor(): void {
  if (doorAnimating) return; // 动画锁，防止连按
  doorAnimating = true;
  if (doorTimeout) { clearTimeout(doorTimeout); doorTimeout = null; }
  const targetAngle = doorClosed ? -Math.PI/2 : 0, startAngle = doorClosed ? 0 : -Math.PI/2;
  let progress = 0; const startTime = performance.now(); doorClosed = !doorClosed;
  function anim(now: number): void {
    progress = Math.min((now - startTime) / 1000, 1);
    doorGroup.rotation.y = startAngle + (targetAngle - startAngle) * (1 - Math.pow(1 - progress, 3));
    if (progress < 1) requestAnimationFrame(anim);
    else { doorAnimating = false; }
    if (progress >= 1 && currentScene === SceneType.Classroom && !doorClosed) {
      colliders.length = 0; // 门已开，清除碰撞体避免卡空气墙
      narration.say('门缓缓打开…走廊深处一片漆黑。', 3000);
      const overlay = document.getElementById('overlay')!;
      overlay.style.display = 'flex'; overlay.style.background = 'rgba(0,0,0,0.95)';
      const msg = document.getElementById('msg-text')!;
      msg.textContent = ''; document.getElementById('msg-input')!.style.display = 'none';
      safeSetTimeout(() => {
        overlay.style.display = 'none';
        switchToHallway();
        sconces.forEach((s, i) => { s.visible = false; safeSetTimeout(() => { s.visible = true; playSound(100+i*20,0.3,'sine',0.03); }, i * 600); });
      }, 2000);
    }
  }
  requestAnimationFrame(anim); playSound(doorClosed ? 80 : 100, 0.5, 'sawtooth', 0.06);
}

// 环境低频嗡嗡声
function startAmbientHum(): void {
  try {
    const ctx = getAudio();
    ambientOsc = ctx.createOscillator(); const gain = ctx.createGain();
    ambientOsc.type = 'sine'; ambientOsc.frequency.value = 55;
    const lfo = ctx.createOscillator(); const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08; lfoGain.gain.value = 3;
    lfo.connect(lfoGain); lfoGain.connect(ambientOsc.frequency);
    gain.gain.value = 0.015; ambientOsc.connect(gain); gain.connect(ctx.destination);
    ambientOsc.start(); lfo.start();
  } catch {}
}

// ══════════════════════════════════════════════
// 交互检测
// ══════════════════════════════════════════════
const raycaster = new THREE.Raycaster(); raycaster.far = CFG.interactRange;
let interactionTimer = 0.1;

function checkInteraction(): void {
  _lookDir.subVectors(_camTarget.set(player.position.x, player.position.y + 1.3, player.position.z), camera.position).normalize();
  raycaster.set(camera.position, _lookDir);
  const hits = raycaster.intersectObjects(interactiveObjects, true); hintEl.textContent = '';
  if (hits.length === 0) return;

  let root: THREE.Object3D | null = hits[0].object;
  while (root && !interactiveObjects.includes(root)) root = root.parent;
  if (!root) return;

  if (currentScene === SceneType.Classroom) {
    if (root.name === 'diary' && !diarySolved) { hintEl.textContent = '按 E 捡起日记'; if (keys.e) { keys.e = false; solveDiary(); }}
    else if (root.name === 'clock' && !clockSolved) { hintEl.textContent = '按 E 查看挂钟'; if (keys.e) { keys.e = false; solveClock(); }}
    else if (root.name === 'door_group' && diarySolved && clockSolved) { hintEl.textContent = '按 E 打开门'; if (keys.e) { keys.e = false; toggleDoor(); }}
    else if (root.name === 'door_group') { hintEl.textContent = '门锁着…需要解开教室里的谜题'; }
    else if (ambientTexts[root.name]) { hintEl.textContent = '按 E 查看'; if (keys.e) { keys.e = false; narration.say(ambientTexts[root.name], 5000); playSound(200,0.15,'sine',0.03); }}
  } else {
    if (root.name === 'door_group') { hintEl.textContent = doorClosed ? '按 E 打开门' : '门已打开'; if (keys.e && doorClosed) { keys.e = false; toggleDoor(); }}
  }
}

// ══════════════════════════════════════════════
// 谜题
// ══════════════════════════════════════════════
function solveDiary(): void {
  diarySolved = true; const glow = sceneRoot.children.find(c => c.name === 'diary_glow'); if (glow) (glow as THREE.PointLight).intensity = 0;
  playSound(440, 0.1, 'sine', 0.06); setTimeout(() => playSound(660, 0.08, 'sine', 0.04), 100);
  narration.say('日记封面印着一只仙鹤…里面写着奇怪的文字。', 4000);
  showMessage('日记上刻着四个字母：R H B Z\n旁边有数字 1-10\n密码是什么？', (input) => {
    if (input && input === '8') { playSound(523,0.1,'sine',0.07); setTimeout(() => playSound(784,0.15,'sine',0.08),150);
      showMessage('密码正确！日记里夹着一张藏宝图，指向"黑贝街"…', () => setObjective('日记解开了！检查墙上挂钟 [走过去按E]')); return true; }
    playSound(100,0.2,'square',0.03); showMessage('密码错误…（提示：把字母横过来看）', ()=>{});
    return false;
  });
}
function solveClock(): void {
  clockSolved = true; playSound(523,0.1,'sine',0.07); setTimeout(() => playSound(784,0.15,'sine',0.08),150);
  narration.say('挂钟停在12点——"时间的尽头"。黑贝街12号！', 4500);
  showMessage('挂钟停在了12点——"时间的尽头"\n黑贝街12号，就是藏宝图指向的位置！', () => setObjective('谜题都解开了！去开门吧 [走到门前按E]'));
}

// ══════════════════════════════════════════════
// 主循环
// ══════════════════════════════════════════════
const clock3 = new THREE.Clock();
let stepTimer = 0, candleCounter = 0, walkBob = 0, armSwing = 0;

function animate(): void {
  requestAnimationFrame(animate);
  const dt = Math.min(clock3.getDelta(), 0.1);

  if (isLocked && document.getElementById('overlay')!.style.display !== 'flex') {
    _fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw)).normalize();
    _rgt.set(Math.cos(camYaw), 0, -Math.sin(camYaw)).normalize();

    const moveDelta = new THREE.Vector3();
    let moving = false;
    if (keys.w) { moveDelta.addScaledVector(_fwd, CFG.moveSpeed * dt); moving = true; }
    if (keys.s) { moveDelta.addScaledVector(_fwd, -CFG.moveSpeed * dt); moving = true; }
    if (keys.a) { moveDelta.addScaledVector(_rgt, -CFG.moveSpeed * dt); moving = true; }
    if (keys.d) { moveDelta.addScaledVector(_rgt, CFG.moveSpeed * dt); moving = true; }

    const corrected = checkCollision(player.position, moveDelta);
    player.position.add(corrected);
    if (moving) player.rotation.y = Math.atan2(_fwd.x, _fwd.z);
    // 手臂摆动量（逐帧衰减，不混入相机跟随）
    if (moving) { walkBob += dt * 8; player.position.y = Math.abs(Math.sin(walkBob)) * 0.04; armSwing = Math.sin(walkBob) * 0.2; }
    else { player.position.y = 0; walkBob = 0; armSwing *= 0.9; }
    // 右臂方向：相机跟随 + 走路摆动
    const armYaw = camYaw - player.rotation.y;
    const armPitch = -camPitch * 0.6 + armSwing * 0.3;
    rightArm.rotation.order = 'YXZ';
    rightArm.rotation.set(armPitch, armYaw, 0);
    leftArm.rotation.order = 'YXZ';
    leftArm.rotation.set(-armSwing, 0, 0);

    const b = currentScene === SceneType.Classroom ? CFG.classroom.bounds : CFG.corridor.bounds;
    player.position.x = Math.max(b.minX, Math.min(b.maxX, player.position.x));
    const zLim = (currentScene === SceneType.Corridor && doorClosed) ? CFG.corridor.bounds.minZ : (currentScene === SceneType.Corridor ? CFG.corridor.doorOpenMinZ : b.minZ);
    player.position.z = Math.max(zLim, Math.min(b.maxZ, player.position.z));

    if (moving) { stepTimer += dt; if (stepTimer > CFG.stepInterval) { stepTimer = 0; playStep(); } } else { stepTimer = CFG.stepInterval; }

    updateCamera();
  }

  // 烛火平滑闪烁 (每3帧)
  candleCounter++; if (candleCounter % CFG.candle.updateEvery === 0) {
    for (const s of sconces) { if (!s.userData) continue;
      const target = s.userData.baseIntensity * (CFG.candle.flickerMin + Math.random() * CFG.candle.flickerRange);
      s.userData.pointLight.intensity += (target - s.userData.pointLight.intensity) * CFG.candle.lerpSpeed;
      const targetS = 0.9 + Math.random() * 0.2; s.userData.flameScale += (targetS - s.userData.flameScale) * CFG.candle.lerpSpeed;
      s.userData.flameMesh.scale.set(0.6*s.userData.flameScale, 1.6*s.userData.flameScale, 0.6*s.userData.flameScale);
    }
  }

  // 灰尘 (GPU)
  if (dustPoints) (dustPoints.material as THREE.ShaderMaterial).uniforms.uTime.value = performance.now() * 0.001;

  // 交互（降频到0.1s）
  interactionTimer += dt; if (interactionTimer >= CFG.interactThrottle) { interactionTimer = 0; checkInteraction(); }

  renderer.render(scene, camera);
}

// ══════════════════════════════════════════════
// 启动
// ══════════════════════════════════════════════
buildClassroom(); startAmbientHum(); animate();
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

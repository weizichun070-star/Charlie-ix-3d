import * as THREE from 'three';

// ═══════════════════════════════════
// 渲染器
// ═══════════════════════════════════
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 50);
const sceneRoot = new THREE.Group(); scene.add(sceneRoot);

// ═══════════════════════════════════
// 音效
// ═══════════════════════════════════
let audioCtx: AudioContext | null = null;
function actx(): AudioContext { if (!audioCtx) audioCtx = new AudioContext(); return audioCtx; }
function beep(f: number, d: number, t: OscillatorType = 'sine', v = 0.04) {
  try { const c = actx(); const o = c.createOscillator(); const g = c.createGain();
    o.type = t; o.frequency.value = f; g.gain.setValueAtTime(v, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d);
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + d); } catch {}
}
function footstep() { beep(60 + Math.random() * 30, 0.1, 'triangle', 0.02); }

// ═══════════════════════════════════
// 纹理
// ═══════════════════════════════════
function makeWallTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d')!;
  // 上部：老旧的米白墙壁
  ctx.fillStyle = '#e0d8c8'; ctx.fillRect(0, 0, 256, 170);
  // 下部：绿色墙裙（中国小学教室经典设计）
  ctx.fillStyle = '#5a7a5a'; ctx.fillRect(0, 170, 256, 86);
  // 墙裙装饰线
  ctx.fillStyle = '#4a6a4a'; ctx.fillRect(0, 168, 256, 4);
  // 岁月斑驳
  for (let i = 0; i < 25; i++) {
    const x = Math.random() * 256, y = Math.random() * 200, s = 4 + Math.random() * 10;
    const g = ctx.createRadialGradient(x, y, 0, x, y, s);
    g.addColorStop(0, 'rgba(30,20,10,0.12)'); g.addColorStop(1, 'rgba(30,20,10,0)');
    ctx.fillStyle = g; ctx.fillRect(x - s, y - s, s * 2, s * 2);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function makeFloorTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d')!;
  // 旧木地板底色
  ctx.fillStyle = '#4a3428'; ctx.fillRect(0, 0, 256, 256);
  // 木板条
  for (let i = 0; i < 10; i++) {
    const y = i * 26;
    const shade = 35 + Math.random() * 20;
    ctx.fillStyle = `rgb(${shade + 40},${shade + 12},${shade})`;
    ctx.fillRect(0, y, 256, 24);
    // 木纹线
    ctx.strokeStyle = `rgba(${shade + 50},${shade + 22},${shade + 10},0.3)`;
    ctx.lineWidth = 0.5;
    for (let j = 0; j < 4; j++) {
      ctx.beginPath(); ctx.moveTo(Math.random() * 256, y + 2); ctx.lineTo(Math.random() * 256, y + 22); ctx.stroke();
    }
  }
  // 板间缝隙
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = '#1a0a00'; ctx.fillRect(0, i * 26 - 1, 256, 2);
  }
  // 污渍
  for (let i = 0; i < 8; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, s = 10 + Math.random() * 20;
    const g = ctx.createRadialGradient(x, y, 0, x, y, s);
    g.addColorStop(0, 'rgba(10,5,0,0.2)'); g.addColorStop(1, 'rgba(10,5,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - s, y - s, s * 2, s * 2);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

const wallMat = new THREE.MeshStandardMaterial({ map: makeWallTex(), roughness: 0.9, side: THREE.DoubleSide });
const floorMat = new THREE.MeshStandardMaterial({ map: makeFloorTex(), roughness: 0.85 });
floorMat.map!.repeat.set(6, 6);
const ceilMat = new THREE.MeshStandardMaterial({ color: 0x3a3a30, roughness: 0.9 });
const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.6 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.3 });
const chalkMat = new THREE.MeshStandardMaterial({ color: 0x224422, roughness: 0.8 });

// ═══════════════════════════════════
// 玩家状态
// ═══════════════════════════════════
const playerPos = { x: 0, z: 3.0 };
let yaw = 0, pitch = 0;
let diarySolved = false, clockSolved = false, doorOpen = false;

// ═══════════════════════════════════
// 输入 (WASD 直接可用)
// ═══════════════════════════════════
const keys: Record<string, boolean> = {};
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if ('wasde '.includes(k)) e.preventDefault();
});
window.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
  if ('wasde '.includes(e.key.toLowerCase())) e.preventDefault();
});

let isLocked = false;
renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => { isLocked = document.pointerLockElement === renderer.domElement; });
document.addEventListener('mousemove', e => {
  if (!isLocked) return;
  yaw -= e.movementX * 0.002;
  pitch = Math.max(-0.8, Math.min(0.8, pitch - e.movementY * 0.002));
});

// ═══════════════════════════════════
// 手电筒
// ═══════════════════════════════════
const flashlight = new THREE.SpotLight(0xffeedd, 20, 15, Math.PI / 6, 0.3, 0.4);
flashlight.castShadow = true;
flashlight.shadow.mapSize.set(512, 512);
scene.add(flashlight);
scene.add(flashlight.target);

// ═══════════════════════════════════
// 碰撞 (AABB vs 圆)
// ═══════════════════════════════════
const colliders: THREE.Box3[] = [];
function addBox(x: number, y: number, z: number, w: number, h: number, d: number) {
  colliders.push(new THREE.Box3(
    new THREE.Vector3(x - w / 2, y, z - d / 2),
    new THREE.Vector3(x + w / 2, y + h, z + d / 2)
  ));
}
function collide(nx: number, nz: number): [number, number] {
  const r = 0.25;
  for (const c of colliders) {
    if (nx + r > c.min.x && nx - r < c.max.x && playerPos.z + r > c.min.z && playerPos.z - r < c.max.z) {
      if (nx > playerPos.x) nx = c.min.x - r; else nx = c.max.x + r;
    }
    if (nz + r > c.min.z && nz - r < c.max.z && playerPos.x + r > c.min.x && playerPos.x - r < c.max.x) {
      if (nz > playerPos.z) nz = c.min.z - r; else nz = c.max.z + r;
    }
  }
  return [nx, nz];
}

// ═══════════════════════════════════
// 教室场景
// ═══════════════════════════════════
const ROOM_W = 7, ROOM_D = 8, ROOM_H = 3.5;
const frontZ = -ROOM_D / 2, backZ = ROOM_D / 2;

function buildClassroom() {
  scene.background = new THREE.Color(0x080812);
  scene.fog = new THREE.FogExp2(0x080812, 0.008);

  // 地板
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sceneRoot.add(floor);

  // 天花板
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), ceilMat);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = ROOM_H; sceneRoot.add(ceil);

  // 实心墙 (BoxGeometry, 厚度0.15)
  const wallThick = 0.15;
  // 前墙 (黑板墙)
  const fw = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, ROOM_H, wallThick), wallMat);
  fw.position.set(0, ROOM_H / 2, frontZ - wallThick / 2); fw.receiveShadow = true; sceneRoot.add(fw);
  // 左墙
  const lw = new THREE.Mesh(new THREE.BoxGeometry(wallThick, ROOM_H, ROOM_D), wallMat);
  lw.position.set(-ROOM_W / 2 + wallThick / 2, ROOM_H / 2, 0); lw.receiveShadow = true; sceneRoot.add(lw);
  // 右墙
  const rw = new THREE.Mesh(new THREE.BoxGeometry(wallThick, ROOM_H, ROOM_D), wallMat);
  rw.position.set(ROOM_W / 2 - wallThick / 2, ROOM_H / 2, 0); rw.receiveShadow = true; sceneRoot.add(rw);

  // 后墙 — 分为左右两段，中间留门洞
  const doorW = 1.1, doorH = 2.3;
  const leftW = (ROOM_W - doorW) / 2;
  const rightX = doorW / 2 + leftW / 2;
  const leftX = -doorW / 2 - leftW / 2;
  const bwY = ROOM_H / 2;
  const bwZ = backZ - wallThick / 2;
  const bwL = new THREE.Mesh(new THREE.BoxGeometry(leftW, ROOM_H, wallThick), wallMat);
  bwL.position.set(leftX, bwY, bwZ); bwL.receiveShadow = true; sceneRoot.add(bwL);
  const bwR = new THREE.Mesh(new THREE.BoxGeometry(leftW, ROOM_H, wallThick), wallMat);
  bwR.position.set(rightX, bwY, bwZ); bwR.receiveShadow = true; sceneRoot.add(bwR);
  // 门洞上方的墙
  const aboveH = ROOM_H - doorH;
  const bwTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, aboveH, wallThick), wallMat);
  bwTop.position.set(0, ROOM_H - aboveH / 2, bwZ); bwTop.receiveShadow = true; sceneRoot.add(bwTop);

  // 碰撞
  addBox(0, 0, frontZ, ROOM_W, ROOM_H, 0.2);
  addBox(-ROOM_W / 2, 0, 0, 0.15, ROOM_H, ROOM_D);
  addBox(ROOM_W / 2, 0, 0, 0.15, ROOM_H, ROOM_D);
  addBox(leftX, 0, backZ, leftW, ROOM_H, 0.2);
  addBox(rightX, 0, backZ, leftW, ROOM_H, 0.2);
  addBox(0, aboveH / 2 + doorH, backZ, doorW, aboveH, 0.2);

  // 黑板
  const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.3, 0.06), chalkMat);
  board.position.set(0, 2.3, frontZ + 0.04); sceneRoot.add(board);
  addBox(0, 2.3 - 0.65, frontZ, 3.2, 1.3, 0.1);

  const chalkC = document.createElement('canvas'); chalkC.width = 512; chalkC.height = 200;
  const chalkCtx = chalkC.getContext('2d')!;
  chalkCtx.fillStyle = '#224422'; chalkCtx.fillRect(0, 0, 512, 200);
  chalkCtx.fillStyle = '#aaccaa'; chalkCtx.font = '24px monospace';
  chalkCtx.fillText('值日生：墨多多    今日作业', 80, 50);
  chalkCtx.fillText('第12页 第1-4题', 120, 90);
  chalkCtx.font = 'italic 18px monospace'; chalkCtx.fillStyle = '#bbddaa';
  chalkCtx.fillText('"时间是一切的答案"', 120, 140);
  const chalkTex = new THREE.CanvasTexture(chalkC);
  const cp = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.1), new THREE.MeshBasicMaterial({ map: chalkTex, depthWrite: false }));
  cp.position.set(0, 2.3, frontZ + 0.08); sceneRoot.add(cp);

  // 讲台
  const podium = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.85, 0.55), woodMat);
  podium.position.set(0, 0.425, frontZ + 2.5); podium.castShadow = true; sceneRoot.add(podium);
  addBox(0, 0, frontZ + 2.5, 1.0, 0.85, 0.55);

  // 课桌 (6张)
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const dx = -2.2 + col * 2.2, dz = 0.8 + row * 2.4;
      const dg = new THREE.Group();
      dg.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.5), woodMat)).position.y = 0.73;
      for (const [lx, lz] of [[-0.33, -0.18], [0.33, -0.18], [-0.33, 0.18], [0.33, 0.18]]) {
        dg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.73, 8), metalMat)).position.set(lx, 0.365, lz);
      }
      dg.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.38), new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 0.7 }))).position.y = 0.62;
      dg.position.set(dx, 0, dz); sceneRoot.add(dg);
      addBox(dx, 0, dz, 0.8, 0.73, 0.5);

      const cg = new THREE.Group();
      cg.add(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.32), new THREE.MeshStandardMaterial({ color: 0x555, roughness: 0.4 }))).position.y = 0.45;
      cg.add(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.03), new THREE.MeshStandardMaterial({ color: 0x555, roughness: 0.4 }))).position.set(0, 0.58, -0.14);
      for (const [clx, clz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) {
        cg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.45, 6), metalMat)).position.set(clx, 0.22, clz);
      }
      cg.position.set(dx, 0, dz + 0.4); sceneRoot.add(cg);
      addBox(dx, 0, dz + 0.4, 0.32, 0.58, 0.32);
    }
  }

  // 窗户 + 月光
  for (let i = 0; i < 2; i++) {
    const wz = -2 + i * 4;
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), new THREE.MeshStandardMaterial({ color: 0x444, roughness: 0.4, metalness: 0.2 }));
    fr.position.set(ROOM_W / 2, 2.2, wz); sceneRoot.add(fr);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.3), new THREE.MeshStandardMaterial({ color: 0x234, roughness: 0.1, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    gl.position.set(ROOM_W / 2 - 0.05, 2.2, wz); gl.rotation.y = Math.PI / 2; gl.name = "window_look"; sceneRoot.add(gl);
    const moon = new THREE.PointLight(0x334466, 3, 7);
    moon.position.set(ROOM_W / 2 - 1.0, 2.2, wz); sceneRoot.add(moon);
  }

  // 天花板灯 (更柔和)
  const cl = new THREE.PointLight(0xffeedd, 3, 8);
  cl.position.set(0, ROOM_H - 0.3, 0); sceneRoot.add(cl);
  scene.add(new THREE.AmbientLight(0x445566, 0.7));

  // 挂钟
  const clock = new THREE.Group();
  clock.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 24), new THREE.MeshStandardMaterial({ color: 0xeeeedd, roughness: 0.4 }))).rotation.x = Math.PI / 2;
  for (let h = 1; h <= 12; h++) {
    const a = (h - 3) * Math.PI / 6;
    clock.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.01), new THREE.MeshBasicMaterial({ color: 0x222 }))).position.set(Math.cos(a) * 0.2, 0.022, Math.sin(a) * 0.2);
  }
  const hh = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.18, 0.02), new THREE.MeshStandardMaterial({ color: 0x222 }));
  hh.position.set(0, 0.09, 0.022); clock.add(hh);
  const mh = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.24, 0.02), new THREE.MeshStandardMaterial({ color: 0x222 }));
  mh.position.set(0, 0.12, 0.025); mh.rotation.z = Math.PI / 2; clock.add(mh);
  clock.position.set(-ROOM_W / 2 + 0.1, 2.3, -1.5); clock.rotation.y = Math.PI / 2; clock.name = 'clock';
  sceneRoot.add(clock);

  // 日记本
  const diary = new THREE.Group();
  diary.add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.3), new THREE.MeshStandardMaterial({ color: 0x648, roughness: 0.5, emissive: 0x214, emissiveIntensity: 0.3 })));
  diary.position.set(1.8, 0.01, -0.5); diary.rotation.z = 0.15; diary.name = 'diary';
  sceneRoot.add(diary);
  const dl = new THREE.PointLight(0x86c, 0.8, 2);
  dl.position.set(1.8, 0.15, -0.5); dl.name = 'diary_glow'; sceneRoot.add(dl);

  // 氛围线索物品（真实3D模型替代透明方块）
  const ambientMap: Record<string, string> = {};

  // 1. 课桌抽屉 — 小抽屉半开着
  const drawerG = new THREE.Group();
  drawerG.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.25), woodMat)); // 抽屉面板
  drawerG.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.22), new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 }))).position.set(0, 0.02, 0.05); // 抽屉内部
  drawerG.position.set(-2.2, 0.35, 1.5); drawerG.name = 'desk_drawer'; sceneRoot.add(drawerG);
  ambientMap['desk_drawer'] = '抽屉拉开一条缝…里面空空的，只有一张褪色照片，背面写着"1987级"。';

  // 2. 粉笔盒 — 破纸盒+碎粉笔
  const chalkG = new THREE.Group();
  chalkG.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.1), new THREE.MeshStandardMaterial({ color: 0xccbb99, roughness: 0.7 }))); // 纸盒
  for (let ci = 0; ci < 3; ci++) {
    chalkG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.04 + Math.random() * 0.03, 6), new THREE.MeshStandardMaterial({ color: 0xeeeedd, roughness: 0.9 })))
      .position.set((Math.random() - 0.5) * 0.08, 0.04, (Math.random() - 0.5) * 0.05);
  }
  chalkG.position.set(1.5, 0.05, frontZ + 2.8); chalkG.name = 'chalk_box'; sceneRoot.add(chalkG);
  ambientMap['chalk_box'] = '粉笔都断成了一截一截的，像是被什么东西用力捏碎的…';

  // 3. 旧书 — 翻开状态
  const bookG = new THREE.Group();
  bookG.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.28), new THREE.MeshStandardMaterial({ color: 0x664422, roughness: 0.6 }))); // 封面
  bookG.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.12), new THREE.MeshStandardMaterial({ color: 0xeeddcc, roughness: 0.8 }))).position.set(0, 0.02, -0.05); // 左页
  bookG.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.12), new THREE.MeshStandardMaterial({ color: 0xeeddcc, roughness: 0.8 }))).position.set(0, 0.02, 0.05); // 右页
  bookG.rotation.x = -0.1; bookG.position.set(-1.5, 0.35, 2.8); bookG.name = 'old_book'; sceneRoot.add(bookG);
  ambientMap['old_book'] = '翻开书，第12页被撕掉了。页角有暗红色的污渍…是血吗？';

  // 4. 垃圾桶 — 金属篓+纸团
  const trashG = new THREE.Group();
  trashG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.4, metalness: 0.5 })));
  trashG.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), new THREE.MeshStandardMaterial({ color: 0xeeeedd, roughness: 0.9 }))).position.set(0.05, 0.18, 0);
  trashG.position.set(2.5, 0, -1.0); trashG.name = 'trash'; sceneRoot.add(trashG);
  ambientMap['trash'] = '垃圾桶里有一团皱巴巴的纸条，上面歪歪扭扭写着两个字：别回头。';

  // 5. 窗户 — 直接交互窗户本身
  ambientMap['window_look'] = '窗外一片漆黑。玻璃上映出的…好像不是你自己的影子。';

  (window as any).__ambientMap = ambientMap;

  // 门 (利用上面声明的 doorW / doorH)
  const doorG = new THREE.Group();
  // 门在室内侧，与墙面齐平（墙面在 z = backZ - wallThick = 3.85）
  doorG.position.set(0, 0, backZ - wallThick - 0.01);
  doorG.add(new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.08, doorH - 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.6 })));
  doorG.children[0].position.set(0, doorH / 2 - 0.03, 0);
  doorG.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0xda4, roughness: 0.2, metalness: 0.9 }))).position.set(doorW - 0.12, doorH * 0.45, 0.04);
  doorG.name = 'door_group'; sceneRoot.add(doorG);

  // 灰尘
  const dc = 50;
  const dg = new THREE.BufferGeometry();
  const dp = new Float32Array(dc * 3);
  for (let i = 0; i < dc; i++) { dp[i * 3] = (Math.random() - 0.5) * ROOM_W; dp[i * 3 + 1] = Math.random() * ROOM_H; dp[i * 3 + 2] = (Math.random() - 0.5) * ROOM_D; }
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  sceneRoot.add(new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, transparent: true, opacity: 0.12, depthWrite: false })));

  // 蛛网
  for (let i = 0; i < 4; i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.3 + Math.random() * 0.4, 0.3 + Math.random() * 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
    const corners: [number, number, number][] = [[-ROOM_W / 2, ROOM_H - 0.1, frontZ], [ROOM_W / 2, ROOM_H - 0.1, frontZ], [-ROOM_W / 2, ROOM_H - 0.5, -1], [ROOM_W / 2, ROOM_H - 0.5, -1]];
    w.position.set(corners[i][0], corners[i][1], corners[i][2]);
    w.rotation.set(Math.random() * 0.3, Math.random() * 0.3, Math.random() * 0.3);
    sceneRoot.add(w);
  }

  // 初始
  playerPos.x = 0; playerPos.z = 3.2;
  yaw = 0; pitch = 0;
  diarySolved = false; clockSolved = false; doorOpen = false;
  updateCamera();
  updateObjective('探索教室：找到地上的日记本 [E键交互]');
}

// ═══════════════════════════════════
// UI
// ═══════════════════════════════════
const hintEl = document.getElementById('hint')!;
function updateObjective(t: string) { const el = document.getElementById('objective'); if (el) el.textContent = t; }

let __dialogOpen = false; function showMessage(text: string, pw = false): Promise<string | null> {
  return new Promise(resolve => {
    const ov = document.getElementById('overlay')!, mt = document.getElementById('msg-text')!, mi = document.getElementById('msg-input') as HTMLInputElement;
    __dialogOpen = true; ov.style.display = "flex"; mt.textContent = text;
    mi.style.display = pw ? 'block' : 'none'; if (pw) { mi.value = ''; mi.focus(); }
    const onK = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { clean(); resolve(pw ? mi.value.trim() : 'ok'); }
      if (e.key === 'Escape') { clean(); resolve(null); }
    };
    const clean = () => { __dialogOpen = false; ov.style.display = "none"; document.removeEventListener('keydown', onK); };
    document.addEventListener('keydown', onK);
  });
}

// ═══════════════════════════════════
// 相机
// ═══════════════════════════════════
function updateCamera() {
  const ey = 0.9;
  camera.position.set(playerPos.x, ey, playerPos.z);
  const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  camera.lookAt(playerPos.x - sy * cp, ey + sp, playerPos.z + cy * cp);
}

// ═══════════════════════════════════
// 谜题
// ═══════════════════════════════════
async function solveDiary() {
  diarySolved = true;
  const gl = sceneRoot.children.find(c => c.name === 'diary_glow') as THREE.PointLight;
  if (gl) gl.intensity = 0;
  const dy = sceneRoot.children.find(c => c.name === 'diary');
  if (dy) dy.visible = false;
  beep(440, 0.1); setTimeout(() => beep(660, 0.08), 100);
  updateObjective('日记捡起来了！解开密码');
  const r = await showMessage('日记封面刻着：R H B Z\n把字母横过来看，它们像什么数字？\n请输入密码：', true);
  if (r === '8' || r === '08') {
    beep(523, 0.1); setTimeout(() => beep(784, 0.15), 150);
    await showMessage('密码正确！日记里夹着一张藏宝图，\n指向一个叫"黑贝街"的地方…');
    updateObjective('日记解开了！去检查挂钟 [按E]');
  } else {
    beep(100, 0.2, 'square');
    await showMessage('密码错误…（提示：R=12? H=? B=8? Z=2? 试试只取其中一个）');
  }
}
async function solveClock() {
  clockSolved = true;
  beep(523, 0.1); setTimeout(() => beep(784, 0.15), 150);
  updateObjective('谜题都解开了！去开门 [走到门前按E]');
  await showMessage('挂钟针指向12点——"时间的尽头"。\n黑贝街12号——就是藏宝图指向的位置！');
}
async function tryDoor() {
  if (!diarySolved || !clockSolved) {
    updateObjective('门锁着…需要解开教室里的谜题');
    await showMessage('门锁得死死的。\n也许需要先解开日记密码和挂钟谜题…');
    return;
  }
  doorOpen = true; beep(80, 0.5, 'sawtooth');
  updateObjective('门开了！');
  await showMessage('门缓缓打开了……\n走廊深处一片漆黑。\n\n— 第一章完 · Demo结束 —\n感谢游玩！');
}

// ═══════════════════════════════════
// 交互检测
// ═══════════════════════════════════
const raycaster = new THREE.Raycaster();
const interactTargets = ['diary', 'clock', 'door_group'];
const ambientTargets = ['desk_drawer', 'chalk_box', 'old_book', 'trash', 'window_look'];

function checkInteraction() { if (__dialogOpen) return;
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  raycaster.set(camera.position, dir); raycaster.far = 3.5;

  const targets: THREE.Object3D[] = [];
  sceneRoot.traverse(c => { if (interactTargets.includes(c.name) || ambientTargets.includes(c.name) || c.name === 'window_look') targets.push(c); });

  const hits = raycaster.intersectObjects(targets, true);
  hintEl.textContent = '';
  if (hits.length === 0) return;

  let root: THREE.Object3D | null = hits[0].object;
  while (root && !targets.includes(root)) root = root.parent;
  if (!root) return;

  const name = root.name;

  if (!diarySolved && name === 'diary') {
    hintEl.textContent = '按 E 捡起日记本';
    if (keys.e) { keys.e = false; if (!__dialogOpen) solveDiary(); }
  } else if (!clockSolved && name === 'clock') {
    hintEl.textContent = '按 E 查看挂钟';
    if (keys.e) { keys.e = false; if (!__dialogOpen) solveClock(); }
  } else if (name === 'door_group') {
    hintEl.textContent = (diarySolved && clockSolved) ? '按 E 开门离开' : '门锁着…需要解开谜题';
    if (keys.e) { keys.e = false; if (!__dialogOpen) tryDoor(); }
  } else if (ambientTargets.includes(name)) {
    hintEl.textContent = '按 E 查看';
    if (keys.e) {
      keys.e = false;
      const map = (window as any).__ambientMap || {};
      beep(200, 0.15);
      const txt = map[name] || '…';
      hintEl.textContent = txt;
      setTimeout(() => { hintEl.textContent = ''; }, 3500);
    }
  }
}

// ═══════════════════════════════════
// 主循环
// ═══════════════════════════════════
const clk3 = new THREE.Clock();
let stepT = 0, intT = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clk3.getDelta(), 0.1);

  // WASD 移动 (不需要点击锁定)
  if (document.getElementById('overlay')!.style.display !== 'flex') {
    let mx = 0, mz = 0;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    const rgt = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
    if (keys.w) { mx += fwd.x; mz += fwd.z; }
    if (keys.s) { mx -= fwd.x; mz -= fwd.z; }
    if (keys.a) { mx -= rgt.x; mz -= rgt.z; }
    if (keys.d) { mx += rgt.x; mz += rgt.z; }
    if (mx !== 0 || mz !== 0) {
      const spd = 3.5 * dt;
      const len = Math.sqrt(mx * mx + mz * mz);
      const [nx, nz] = collide(playerPos.x + (mx / len) * spd, playerPos.z + (mz / len) * spd);
      playerPos.x = Math.max(-ROOM_W / 2 + 0.3, Math.min(ROOM_W / 2 - 0.3, nx));
      playerPos.z = Math.max(frontZ + 0.3, Math.min(backZ - 0.3, nz));
      stepT += dt; if (stepT > 0.4) { stepT = 0; footstep(); }
    } else { stepT = 0.4; }
  }

  updateCamera();

  // 手电筒
  flashlight.position.copy(camera.position);
  const ldir = new THREE.Vector3(); camera.getWorldDirection(ldir);
  flashlight.target.position.copy(camera.position).addScaledVector(ldir, 8);

  // 交互
  intT += dt; if (intT > 0.1) { intT = 0; checkInteraction(); }

  renderer.render(scene, camera);
}

// ═══════════════════════════════════
// 启动
// ═══════════════════════════════════
buildClassroom();
animate();
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

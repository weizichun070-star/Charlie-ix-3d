import * as THREE from 'three';

// ── 全局 ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000011);
scene.fog = new THREE.FogExp2(0x000011, 0.008);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 60);
camera.position.set(0, 1.6, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.7;
document.body.appendChild(renderer.domElement);

const hintEl = document.getElementById('hint')!;
const sceneRoot = new THREE.Group();
scene.add(sceneRoot);

// ── 音效 ──
let audioCtx: AudioContext | null = null;
function getAudio(): AudioContext {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioCtx;
}
function playSound(freq: number, dur: number, type: OscillatorType = 'triangle', vol: number = 0.04): void {
  try {
    const ctx = getAudio();
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch {}
}
function playStep(): void { playSound(55 + Math.random() * 35, 0.12, 'triangle', 0.025); }

// ── 纹理 ──
function makeBrickTex(brick: string, mortar: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = mortar; ctx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 11; row++) {
    const ox = row % 2 === 0 ? 0 : 32;
    for (let col = -1; col < 9; col++) {
      ctx.fillStyle = brick;
      ctx.fillRect(col * 66 + ox + 3, row * 24 + 3, 60, 18);
    }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function makePlankTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = `rgb(${50+Math.random()*20},${35+Math.random()*15},${20+Math.random()*10})`;
    ctx.fillRect(Math.random()*256, Math.random()*256, 80+Math.random()*60, 2);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ── 共用材质 ──
const brickWallMat = new THREE.MeshStandardMaterial({ map: makeBrickTex('#4a3a2a', '#1a1a0f'), roughness: 0.85, metalness: 0.05 });
brickWallMat.map!.repeat.set(2, 6);
const plankFloorMat = new THREE.MeshStandardMaterial({ map: makePlankTex(), roughness: 0.9 });
plankFloorMat.map!.repeat.set(4, 4);
const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.4 });
const knobMat = new THREE.MeshStandardMaterial({ color: 0xddaa44, roughness: 0.2, metalness: 0.9 });

// ── 控制 ──
const keys: Record<string, boolean> = {};
document.addEventListener('keydown', e => { const k = e.key.toLowerCase(); if ('wasde'.includes(k)) { keys[k] = true; e.preventDefault(); }});
document.addEventListener('keyup', e => { const k = e.key.toLowerCase(); if ('wasde'.includes(k)) { keys[k] = false; e.preventDefault(); }});
// ── 角色（墨多多） ──
const player = new THREE.Group();
player.position.set(0, 0, 2);
scene.add(player);

function buildPlayerModel(): void {
  const skin = new THREE.MeshStandardMaterial({ color: 0xf4d4a8, roughness: 0.7 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x3366aa, roughness: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.5 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x332211, roughness: 0.8 });

  // 左脚
  const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.16), darkMat);
  lLeg.position.set(-0.1, 0.2, 0); player.add(lLeg);
  const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.2), shoeMat);
  lShoe.position.set(-0.1, 0.04, 0.02); player.add(lShoe);

  // 右脚
  const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.16), darkMat);
  rLeg.position.set(0.1, 0.2, 0); player.add(rLeg);
  const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.2), shoeMat);
  rShoe.position.set(0.1, 0.04, 0.02); player.add(rShoe);

  // 身体
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.25), blueMat);
  body.position.set(0, 0.65, 0); player.add(body);

  // 左臂
  const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), blueMat);
  lArm.position.set(-0.28, 0.55, 0); player.add(lArm);
  const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), skin);
  lHand.position.set(-0.28, 0.3, 0); player.add(lHand);

  // 右臂
  const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), blueMat);
  rArm.position.set(0.28, 0.55, 0); player.add(rArm);
  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), skin);
  rHand.position.set(0.28, 0.3, 0); player.add(rHand);

  // 头
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.28), skin);
  head.position.set(0, 1.08, 0); player.add(head);

  // 头发
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.3), darkMat);
  hair.position.set(0, 1.28, 0); player.add(hair);
  const hairFringe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.06), darkMat);
  hairFringe.position.set(0, 1.22, 0.14); player.add(hairFringe);

  // 眼睛
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const lEye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), eyeMat);
  lEye.position.set(-0.07, 1.13, 0.14); player.add(lEye);
  const rEye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), eyeMat);
  rEye.position.set(0.07, 1.13, 0.14); player.add(rEye);

  // 嘴巴
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), eyeMat);
  mouth.position.set(0, 1.04, 0.14); player.add(mouth);
}
buildPlayerModel();

// player cast shadows from its children
player.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; }});

// ── 第三人称相机 ──
const camOffset = new THREE.Vector3(0, 2.2, 4.5); // 相机在角色后方上方
let camYaw = 0, camPitch = 0.3; // 角度
let isLocked = false;

function updateCamera(): void {
  // 相机在角色后方，camYaw=0 时在 +Z（玩家身后）
  const tx = player.position.x;
  const ty = player.position.y + 1.3;
  const tz = player.position.z;

  const dist = 4.5;
  const height = 2.2;
  const cosY = Math.cos(camYaw);
  const sinY = Math.sin(camYaw);

  camera.position.set(
    tx - sinY * dist,
    ty + height * Math.cos(camPitch),
    tz + cosY * dist
  );
  camera.lookAt(tx, ty, tz);
}

renderer.domElement.addEventListener('click', () => { renderer.domElement.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => {
  isLocked = document.pointerLockElement === renderer.domElement;
  const infoEl = document.getElementById('info')!;
  infoEl.textContent = isLocked ? 'WASD 移动 | 鼠标环顾 | E 交互' : '点击画面锁定鼠标';
});
document.addEventListener('mousemove', e => {
  if (!isLocked) return;
  camYaw -= e.movementX * 0.003;
  camPitch -= e.movementY * 0.003;
  camPitch = Math.max(-0.2, Math.min(1.2, camPitch));
});

const flashlight = new THREE.SpotLight(0xffeedd, 20, 12, Math.PI/7, 0.25, 0.6);
flashlight.castShadow = true; flashlight.shadow.mapSize.set(512, 512);
flashlight.shadow.camera.near = 0.1; flashlight.shadow.camera.far = 20;
scene.add(flashlight); scene.add(flashlight.target);

// ── 场景管理 ──
let currentScene: 'classroom' | 'hallway' = 'classroom';
let interactiveObjects: THREE.Object3D[] = [];
const sconces: THREE.Group[] = [];
const dustParticles: THREE.Mesh[] = [];
let doorGroup: THREE.Group;
let doorClosed = true;
let diarySolved = false;
let clockSolved = false;

function clearScene(): void {
  while (sceneRoot.children.length > 0) sceneRoot.remove(sceneRoot.children[0]);
  interactiveObjects = [];
  sconces.length = 0;
  dustParticles.length = 0;
}

// ══════════════════════════════════════════════
// 教室场景
// ══════════════════════════════════════════════
function buildClassroom(): void {
  const roomW = 7, roomD = 8, roomH = 3.5;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.9 });
  const darkWallMat = new THREE.MeshStandardMaterial({ color: 0xc8c0b0, roughness: 0.9 });
  scene.background = new THREE.Color(0x111122);
  scene.fog = new THREE.FogExp2(0x111122, 0.006);

  // 地板
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), plankFloorMat);
  floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; sceneRoot.add(floor);

  // 天花板
  sceneRoot.add(new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), ceilingMat)).rotation.x = Math.PI/2;
  (sceneRoot.children[sceneRoot.children.length-1] as THREE.Mesh).position.set(0, roomH, 0);

  // 四面墙
  const wallGeoXY = new THREE.PlaneGeometry(roomW, roomH);
  const wallGeoZY = new THREE.PlaneGeometry(roomD, roomH);

  // 前墙 (z = -roomD/2, 有黑板，默认视角正对)
  const frontW = new THREE.Mesh(wallGeoXY, darkWallMat);
  frontW.position.set(0, roomH/2, -roomD/2); sceneRoot.add(frontW);

  // 后墙 (z = +roomD/2, 有门通往走廊)
  const backW = new THREE.Mesh(wallGeoXY, wallMat);
  backW.position.set(0, roomH/2, roomD/2); sceneRoot.add(backW);

  // 左墙
  const leftW = new THREE.Mesh(wallGeoZY, wallMat);
  leftW.rotation.y = Math.PI/2; leftW.position.set(-roomW/2, roomH/2, 0); sceneRoot.add(leftW);

  // 右墙（有窗户）
  const rightW = new THREE.Mesh(wallGeoZY, wallMat);
  rightW.rotation.y = -Math.PI/2; rightW.position.set(roomW/2, roomH/2, 0); sceneRoot.add(rightW);

  // 黑板 (在前墙 -Z)
  const boardZ = -roomD/2;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(3, 1.2, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x224422, roughness: 0.6 })
  );
  board.position.set(0, 2.2, boardZ + 0.03);
  board.receiveShadow = true; sceneRoot.add(board);

  const boardText = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.8),
    new THREE.MeshBasicMaterial({ color: 0xaaccaa })
  );
  boardText.position.set(0, 2.2, boardZ + 0.06);
  sceneRoot.add(boardText);

  // 讲台
  const podium = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.9, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.7 })
  );
  podium.position.set(0, 0.45, boardZ + 2.2);
  podium.castShadow = true; podium.receiveShadow = true;
  sceneRoot.add(podium);

  // 课桌 (3列 x 2排)
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const deskGroup = new THREE.Group();
      // 桌面
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.04, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.6 })
      );
      top.position.y = 0.7; top.castShadow = true;
      deskGroup.add(top);
      // 桌腿
      for (const [dx, dz] of [[-0.35, -0.2], [0.35, -0.2], [-0.35, 0.2], [0.35, 0.2]]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6),
          new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.3 })
        );
        leg.position.set(dx, 0.35, dz);
        deskGroup.add(leg);
      }
      deskGroup.position.set(-2 + col * 2, 0, 0.5 + row * 2.2);
      sceneRoot.add(deskGroup);

      // 椅子
      const chair = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.04, 0.35),
        new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5, metalness: 0.2 })
      );
      chair.position.set(-2 + col * 2, 0.45, 0.85 + row * 2.2);
      chair.castShadow = true;
      sceneRoot.add(chair);
    }
  }

  // 窗户 (右侧墙上)
  for (let i = 0; i < 2; i++) {
    const winGroup = new THREE.Group();
    // 窗框
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.5, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.3 })
    );
    frame.position.set(0, 0, 0); winGroup.add(frame);
    const frameH = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.08, 0.08), frame.material
    );
    frameH.position.set(0, 0.75, 0); winGroup.add(frameH);
    frameH.clone().position.set(0, -0.75, 0); winGroup.add(frameH);

    // 玻璃（蓝色半透明）
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x334466, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.4 })
    );
    glass.position.set(0, 0, -0.01); winGroup.add(glass);

    winGroup.position.set(roomW/2 - 0.04, 2.2, -2 + i * 4);
    winGroup.rotation.y = -Math.PI/2;
    sceneRoot.add(winGroup);

    // 月光从窗户照进来
    const moonLight = new THREE.PointLight(0x334466, 2, 6);
    moonLight.position.set(roomW/2 - 0.2, 2.2, -2 + i * 4);
    sceneRoot.add(moonLight);
  }

  // 环境光
  scene.add(new THREE.AmbientLight(0x222233, 0.5));

  // 天花板灯
  const ceilingLight = new THREE.PointLight(0xffffcc, 5, 10);
  ceilingLight.position.set(0, roomH - 0.3, 0);
  sceneRoot.add(ceilingLight);

  // ── 可交互物品 ──

  // 地上的日记本
  const diaryGroup = new THREE.Group();
  const diaryCover = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.02, 0.35),
    new THREE.MeshStandardMaterial({ color: 0x886644, roughness: 0.6 })
  );
  diaryCover.castShadow = true; diaryGroup.add(diaryCover);
  // 书脊标签
  const spine = new THREE.Mesh(
    new THREE.PlaneGeometry(0.02, 0.3),
    new THREE.MeshBasicMaterial({ color: 0xffcc88 })
  );
  spine.rotation.y = Math.PI/2; spine.position.set(0.125, 0.01, 0);
  diaryGroup.add(spine);
  diaryGroup.position.set(1.5, 0.01, -1);
  diaryGroup.rotation.z = 0.15;
  diaryGroup.name = 'diary';
  sceneRoot.add(diaryGroup);
  interactiveObjects.push(diaryGroup);

  // 日记标签光晕
  const diaryGlow = new THREE.PointLight(0xffcc44, 0.4, 1.5);
  diaryGlow.position.copy(diaryGroup.position); diaryGlow.position.y += 0.1;
  diaryGlow.name = 'diary_glow';
  sceneRoot.add(diaryGlow);

  // 挂钟 (在左侧墙上)
  const clockGroup = new THREE.Group();
  const clockFace = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.04, 24),
    new THREE.MeshStandardMaterial({ color: 0xeeeedd, roughness: 0.4 })
  );
  clockFace.rotation.x = Math.PI/2; clockGroup.add(clockFace);
  for (let h = 1; h <= 12; h++) {
    const ang = (h - 3) * Math.PI / 6;
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.06, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x222222 })
    );
    mark.position.set(Math.cos(ang) * 0.22, 0.021, Math.sin(ang) * 0.22);
    mark.rotation.z = ang;
    clockGroup.add(mark);
  }
  clockGroup.position.set(-roomW/2 + 0.06, 2.2, -1);
  clockGroup.rotation.y = Math.PI/2;
  clockGroup.name = 'clock';
  sceneRoot.add(clockGroup);
  interactiveObjects.push(clockGroup);

  // 门（后墙 +Z，通往走廊）
  const doorW = 1.1, doorH = 2.3;
  doorGroup = new THREE.Group();
  doorGroup.position.set(-doorW/2, 0, roomD/2);

  const panelGeo = new THREE.BoxGeometry(doorW - 0.04, doorH - 0.04, 0.06);
  panelGeo.translate((doorW - 0.04)/2, (doorH - 0.04)/2, 0);
  const doorPanel = new THREE.Mesh(panelGeo,
    new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.6 }));
  doorPanel.castShadow = true; doorPanel.name = 'door_panel';
  doorGroup.add(doorPanel);

  // 门把手
  const handleMat = knobMat;
  const kx = doorW - 0.15, ky = doorH * 0.45;
  const knobBase = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.02, 12), handleMat);
  knobBase.position.set(kx, ky, 0.04); doorGroup.add(knobBase);
  const knobHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 12), handleMat);
  knobHandle.rotation.z = Math.PI/2; knobHandle.position.set(kx + 0.05, ky, 0.04);
  doorGroup.add(knobHandle);

  doorGroup.name = 'door_group';
  sceneRoot.add(doorGroup);
  interactiveObjects.push(doorGroup);

  // 灰尘粒子
  for (let i = 0; i < 30; i++) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.004, 3, 2),
      new THREE.MeshBasicMaterial({ color: 0xddccaa, transparent: true, opacity: 0.2 + Math.random()*0.3 })
    );
    dot.position.set((Math.random()-0.5)*roomW, Math.random()*roomH, (Math.random()-0.5)*roomD);
    dot.userData = { baseY: dot.position.y, speed: 0.15 + Math.random()*0.3, phase: Math.random()*Math.PI*2 };
    dustParticles.push(dot);
    sceneRoot.add(dot);
  }

  // 玩家起点
  player.position.set(0, 0, 2);
  camYaw = 0; camPitch = 0.3;
  updateCamera();
  flashlight.intensity = 5;

  setObjective('探索教室：找到地上的日记本 [E键交互]');
}

// ══════════════════════════════════════════════
// 走廊场景
// ══════════════════════════════════════════════
function buildHallway(): void {
  const len = 22, w = 3, h = 3.5;
  scene.background = new THREE.Color(0x050510);
  scene.fog = new THREE.FogExp2(0x050510, 0.012);

  // 地板
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, len), plankFloorMat);
  floor.rotation.x = -Math.PI/2; floor.position.set(0, 0, -len/2 + 2);
  floor.receiveShadow = true; sceneRoot.add(floor);

  // 天花板
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, len), ceilingMat);
  ceil.rotation.x = Math.PI/2; ceil.position.set(0, h, -len/2 + 2);
  sceneRoot.add(ceil);

  // 横梁
  for (let z = 0; z > -len + 2; z -= 3) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.12, 0.18), frameMat);
    beam.position.set(0, h - 0.06, z); beam.castShadow = true;
    sceneRoot.add(beam);
  }

  // 砖墙
  const wallGeo = new THREE.PlaneGeometry(len, h);
  brickWallMat.map!.repeat.set(2, 8);
  const lw = new THREE.Mesh(wallGeo, brickWallMat);
  lw.rotation.y = Math.PI/2; lw.position.set(-w/2, h/2, -len/2 + 2);
  lw.receiveShadow = true; sceneRoot.add(lw);
  const rw = new THREE.Mesh(wallGeo, brickWallMat);
  rw.rotation.y = -Math.PI/2; rw.position.set(w/2, h/2, -len/2 + 2);
  rw.receiveShadow = true; sceneRoot.add(rw);

  // 起点后墙
  const bw = new THREE.Mesh(new THREE.PlaneGeometry(w, h), brickWallMat);
  bw.position.set(0, h/2, 3); sceneRoot.add(bw);

  // ── 走廊尽头的前墙 + 门 ──
  const DOOR_Z = -19;
  const doorW = 1.2, doorH2 = 2.3;
  const topH = h - doorH2;
  const sideW2 = (w - doorW) / 2;

  sceneRoot.add(new THREE.Mesh(new THREE.PlaneGeometry(doorW, topH), brickWallMat))
    .position.set(0, doorH2 + topH/2, DOOR_Z);
  sceneRoot.add(new THREE.Mesh(new THREE.PlaneGeometry(sideW2, h), brickWallMat))
    .position.set(-doorW/2 - sideW2/2, h/2, DOOR_Z);
  sceneRoot.add(new THREE.Mesh(new THREE.PlaneGeometry(sideW2, h), brickWallMat))
    .position.set(doorW/2 + sideW2/2, h/2, DOOR_Z);

  // 门框
  const fw = 0.08, fd = 0.1;
  [[-doorW/2, doorH2/2], [doorW/2, doorH2/2], [0, doorH2]].forEach(([fx, fy]) => {
    const isH = fy === doorH2;
    const fg = new THREE.BoxGeometry(isH ? doorW + fw*2 : fw, isH ? fw : doorH2, fd);
    sceneRoot.add(new THREE.Mesh(fg, frameMat))
      .position.set(fx, fy, DOOR_Z);
  });

  // 门 (铰链在左侧)
  doorGroup = new THREE.Group();
  doorGroup.position.set(-doorW/2, 0, DOOR_Z);
  const dpGeo = new THREE.BoxGeometry(doorW - 0.04, doorH2 - 0.04, 0.06);
  dpGeo.translate((doorW - 0.04)/2, (doorH2 - 0.04)/2, 0);
  const dp = new THREE.Mesh(dpGeo, new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.7 }));
  dp.castShadow = true; dp.name = 'door_panel'; doorGroup.add(dp);

  const kx2 = doorW - 0.15, ky2 = doorH2 * 0.45;
  [new THREE.CylinderGeometry(0.03, 0.04, 0.02, 12),
   new THREE.CylinderGeometry(0.015, 0.015, 0.1, 12)].forEach((g, i) => {
    const m = new THREE.Mesh(g, knobMat);
    if (i === 1) m.rotation.z = Math.PI/2;
    m.position.set(i === 1 ? kx2 + 0.05 : kx2, ky2, 0.04);
    doorGroup.add(m);
  });
  doorGroup.name = 'door_group';
  sceneRoot.add(doorGroup);
  interactiveObjects.push(doorGroup);
  doorClosed = true;

  // 烛台
  const makeSconce = (wallX: number, y: number, z: number): void => {
    const g = new THREE.Group();
    const ironM = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.7 });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.02), ironM)).position.set(0, 0, 0.01);
    const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 8), ironM);
    a1.rotation.z = Math.PI/2; a1.position.set(0.12, 0.08, 0); g.add(a1);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8), ironM))
      .position.set(0.22, 0.18, 0);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.06, 12), ironM))
      .position.set(0.22, 0.27, 0);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.08, 8),
      new THREE.MeshStandardMaterial({ color: 0xeeeedd, roughness: 0.8 })))
      .position.set(0.22, 0.33, 0);
    const fg = new THREE.SphereGeometry(0.025, 8, 6); fg.scale(0.6, 1.6, 0.6);
    const fm = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: 0xff8833 }));
    fm.position.set(0.22, 0.39, 0); g.add(fm);
    const ig = new THREE.SphereGeometry(0.012, 6, 4); ig.scale(0.6, 1.5, 0.6);
    const im = new THREE.Mesh(ig, new THREE.MeshBasicMaterial({ color: 0xffdd88 }));
    im.position.set(0.22, 0.383, 0); g.add(im);
    const pl = new THREE.PointLight(0xff8833, 1.8, 4, 1.5);
    pl.position.set(0.22, 0.39, 0); g.add(pl);
    g.userData = { flameMesh: fm, innerFlame: im, pointLight: pl, baseIntensity: 1.8 };
    const side = wallX > 0 ? 1 : -1;
    g.position.set(wallX - side * 0.06, y, z);
    g.rotation.y = side > 0 ? -Math.PI/2 : Math.PI/2;
    sceneRoot.add(g); sconces.push(g);
  };
  makeSconce(-w/2, 1.8, -3);
  makeSconce(w/2, 1.8, -8);
  makeSconce(-w/2, 1.8, -14);

  // 地上杂物
  for (let i = 0; i < 10; i++) {
    const db = new THREE.Mesh(
      new THREE.BoxGeometry(0.1+Math.random()*0.3, 0.02+Math.random()*0.02, 0.1+Math.random()*0.3),
      new THREE.MeshStandardMaterial({ color: 0x333322, roughness: 1 })
    );
    db.position.set((Math.random()-0.5)*2.2, 0.002, -Math.random()*len+1);
    db.rotation.y = Math.random()*Math.PI; sceneRoot.add(db);
  }

  // 灰尘粒子
  for (let i = 0; i < 30; i++) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.005, 3, 2),
      new THREE.MeshBasicMaterial({ color: 0xccccaa, transparent: true, opacity: 0.2 + Math.random()*0.3 })
    );
    dot.position.set((Math.random()-0.5)*2.5, Math.random()*h, -Math.random()*len+1);
    dot.userData = { baseY: dot.position.y, speed: 0.2 + Math.random()*0.3, phase: Math.random()*Math.PI*2 };
    dustParticles.push(dot); sceneRoot.add(dot);
  }

  // 光源
  scene.add(new THREE.AmbientLight(0x111122, 0.3));
  flashlight.intensity = 25;

  player.position.set(0, 0, 1.5);
  camYaw = 0; camPitch = 0.3;
  updateCamera();
  setObjective('探索黑贝街12号走廊...');
}

// ── 目标提示 ──
function setObjective(text: string): void {
  const el = document.getElementById('objective');
  if (el) el.textContent = text;
}

// ── 场景切换 ──
function switchToHallway(): void {
  clearScene();
  currentScene = 'hallway';
  buildHallway();
}

// ── 门动画 ──
function toggleDoor(): void {
  if (!doorGroup) return;
  const targetAngle = doorClosed ? -Math.PI/2 : 0;
  const startAngle = doorClosed ? 0 : -Math.PI/2;
  let progress = 0;
  const startTime = performance.now();
  doorClosed = !doorClosed;

  function anim(now: number): void {
    progress = Math.min((now - startTime) / 800, 1);
    doorGroup.rotation.y = startAngle + (targetAngle - startAngle) * (1 - Math.pow(1 - progress, 3));
    if (progress < 1) requestAnimationFrame(anim);
    else if (currentScene === 'classroom' && !doorClosed) {
      // 教室门开了 → 进入走廊
      setTimeout(() => switchToHallway(), 400);
    }
  }
  requestAnimationFrame(anim);
  playSound(doorClosed ? 80 : 100, 0.4, 'sawtooth');
}

// ── 交互检测 ──
const raycaster = new THREE.Raycaster();
raycaster.far = 2.8;

function checkInteraction(): void {
  // 从相机发射射线（第三人称相机看哪里，交互就检测哪里）
  const lookDir = new THREE.Vector3().subVectors(
    new THREE.Vector3(player.position.x, player.position.y + 1.3, player.position.z), camera.position
  ).normalize();
  raycaster.set(camera.position, lookDir);
  const hits = raycaster.intersectObjects(interactiveObjects, true);
  hintEl.textContent = '';

  if (hits.length === 0) return;
  const target = hits[0].object;

  // 找到命中的可交互根对象
  let root: THREE.Object3D | null = target;
  while (root && !interactiveObjects.includes(root)) root = root.parent;
  if (!root) return;

  if (currentScene === 'classroom') {
    if (root.name === 'diary' && !diarySolved) {
      hintEl.textContent = '按 E 捡起日记';
      if (keys.e) { keys.e = false; solveDiaryPuzzle(); }
    } else if (root.name === 'clock' && !clockSolved) {
      hintEl.textContent = '按 E 查看挂钟';
      if (keys.e) { keys.e = false; solveClockPuzzle(); }
    } else if (root.name === 'door_group' && diarySolved && clockSolved) {
      hintEl.textContent = '按 E 打开门';
      if (keys.e) { keys.e = false; toggleDoor(); }
    } else if (root.name === 'door_group' && (!diarySolved || !clockSolved)) {
      hintEl.textContent = '门锁着...需要先解开教室里的谜题';
    }
  } else if (currentScene === 'hallway') {
    if (root.name === 'door_group') {
      hintEl.textContent = doorClosed ? '按 E 打开门' : '门已打开';
      if (keys.e && doorClosed) { keys.e = false; toggleDoor(); }
    }
  }
}

// ── 谜题 ──
function solveDiaryPuzzle(): void {
  diarySolved = true;
  // 隐藏日记光晕
  const glow = sceneRoot.children.find(c => c.name === 'diary_glow');
  if (glow) (glow as THREE.PointLight).intensity = 0;
  playSound(440, 0.1, 'sine', 0.06);
  setTimeout(() => playSound(660, 0.08, 'sine', 0.04), 100);
  showMessage('日记上刻着四个字母：R H B Z\n旁边有数字 1-10\n密码是什么？', (input) => {
    if (input && input === '8') {
      playSound(523, 0.1, 'sine', 0.07);
      setTimeout(() => playSound(784, 0.15, 'sine', 0.08), 150);
      showMessage('密码正确！日记里夹着一张藏宝图，\n指向"黑贝街"...', () => {
        setObjective('密码正确！现在检查墙上挂钟的线索 [走过去按E]');
      });
    } else {
      playSound(100, 0.2, 'square', 0.03);
      showMessage('密码错误，再想想...\n（提示：把字母横过来看）', () => {});
      return false;
    }
    return true;
  });
}

function solveClockPuzzle(): void {
  clockSolved = true;
  playSound(523, 0.1, 'sine', 0.07);
  setTimeout(() => playSound(784, 0.15, 'sine', 0.08), 150);
  showMessage('挂钟停在了12点——"时间的尽头"\n黑贝街12号，就是藏宝图指向的位置！', () => {
    setObjective('两个谜题都解开了！去开门吧 [走到门前按E]');
  });
}

// ── 消息弹窗 ──
let messageCallback: ((input?: string) => any) | null = null;
let messageInput = '';

function showMessage(text: string, cb: (input?: string) => any): void {
  const overlay = document.getElementById('overlay')!;
  const msgText = document.getElementById('msg-text')!;
  const msgInput = document.getElementById('msg-input') as HTMLInputElement;
  overlay.style.display = 'flex';
  msgText.textContent = text;
  msgInput.style.display = text.includes('密码') ? 'block' : 'none';
  msgInput.value = '';
  messageInput = '';
  messageCallback = cb;

  if (text.includes('密码')) msgInput.focus();
}

function closeMessage(confirmed: boolean): void {
  const overlay = document.getElementById('overlay')!;
  const msgInput = document.getElementById('msg-input') as HTMLInputElement;
  overlay.style.display = 'none';
  const cb = messageCallback;
  messageCallback = null;

  if (confirmed && cb) {
    const input = msgInput.value.trim();
    const result = cb(input);
    if (result === false) return; // 密码错误，保持打开
  } else if (!confirmed && cb) {
    cb();
  }
}

// ── 全局键盘事件（消息模式） ──
document.addEventListener('keydown', (e) => {
  const overlay = document.getElementById('overlay')!;
  if (overlay.style.display === 'flex') {
    if (e.key === 'Enter') { e.preventDefault(); closeMessage(true); }
    else if (e.key === 'Escape') { e.preventDefault(); closeMessage(false); }
    e.stopPropagation();
  }
});

// ── 主循环 ──
const clock3 = new THREE.Clock();
const moveSpeed = 3.5;
let stepTimer = 0;

function animate(): void {
  requestAnimationFrame(animate);
  const dt = Math.min(clock3.getDelta(), 0.1);

  if (isLocked && document.getElementById('overlay')!.style.display !== 'flex') {
    // 相机方向向量（水平面投影）
    const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw)).normalize();
    const rgt = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw)).normalize();

    let moving = false;
    if (keys.w) { player.position.addScaledVector(fwd, moveSpeed * dt); moving = true; }
    if (keys.s) { player.position.addScaledVector(fwd, -moveSpeed * dt); moving = true; }
    if (keys.a) { player.position.addScaledVector(rgt, -moveSpeed * dt); moving = true; }
    if (keys.d) { player.position.addScaledVector(rgt, moveSpeed * dt); moving = true; }

    // 角色面朝移动方向
    if (moving) {
      const angle = Math.atan2(fwd.x, fwd.z);
      player.rotation.y = angle;
    }

    // 场景边界
    if (currentScene === 'classroom') {
      player.position.x = Math.max(-3.2, Math.min(3.2, player.position.x));
      player.position.z = Math.max(-3.7, Math.min(3.7, player.position.z));
    } else {
      player.position.x = Math.max(-1.3, Math.min(1.3, player.position.x));
      const zLim = doorClosed ? -18.5 : -21;
      player.position.z = Math.max(zLim, Math.min(2.8, player.position.z));
    }
    player.position.y = 0;

    if (moving) { stepTimer += dt; if (stepTimer > 0.45) { stepTimer = 0; playStep(); }}
    else { stepTimer = 0.45; }

    updateCamera();

    // 手电筒跟随相机
    flashlight.position.copy(camera.position);
    flashlight.target.position.copy(player.position).add(new THREE.Vector3(0, 1.3, 0));
  }

  // 烛火闪烁
  for (const s of sconces) {
    if (!s.userData) continue;
    s.userData.pointLight.intensity = s.userData.baseIntensity * (0.85 + Math.random() * 0.3);
    const sc = 0.9 + Math.random() * 0.2;
    s.userData.flameMesh.scale.set(0.6*sc, 1.6*sc, 0.6*sc);
  }

  // 灰尘浮动
  const t = performance.now() * 0.001;
  for (const d of dustParticles) {
    d.position.y = d.userData.baseY + Math.sin(t * d.userData.speed + d.userData.phase) * 0.3;
    (d.material as THREE.MeshBasicMaterial).opacity =
      0.12 + Math.sin(t * d.userData.speed * 1.5 + d.userData.phase) * 0.1;
  }

  checkInteraction();
  renderer.render(scene, camera);
}

// ── 启动 ──
buildClassroom();
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

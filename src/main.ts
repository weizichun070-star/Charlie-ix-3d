import * as THREE from 'three';

// ── 画布纹理：砖墙 ──
function createBrickTexture(color: string, mortarColor: string, w: number = 256, h: number = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = mortarColor;
  ctx.fillRect(0, 0, w, h);
  const brickW = 64, brickH = 24, gap = 3;
  for (let row = 0; row < h / (brickH + gap) + 1; row++) {
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let col = -1; col < w / (brickW + gap) + 1; col++) {
      const x = col * (brickW + gap) + offset;
      const y = row * (brickH + gap);
      ctx.fillStyle = color;
      ctx.fillRect(x + gap, y + gap, brickW - gap, brickH - gap);
      // 砖块表面纹理
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(x + gap, y + gap, brickW - gap, brickH / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(x + gap + 4, y + gap + 2, brickW - gap - 8, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 12);
  return tex;
}

function createFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1a1a0a';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(${30+Math.random()*20},${25+Math.random()*15},${5+Math.random()*10},0.3)`;
    ctx.fillRect(Math.random()*256, Math.random()*256, 60+Math.random()*40, 2);
  }
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(Math.random()*256, Math.random()*256, 30+Math.random()*20, 20+Math.random()*15);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 10);
  return tex;
}

// ── 场景初始化 ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);
scene.fog = new THREE.FogExp2(0x050510, 0.012);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 50);
camera.position.set(0, 1.6, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.7;
document.body.appendChild(renderer.domElement);

// ── 灯光 ──
scene.add(new THREE.AmbientLight(0x111122, 0.4));

const flashlight = new THREE.SpotLight(0xffeedd, 25, 12, Math.PI/7, 0.25, 0.6);
flashlight.position.copy(camera.position);
flashlight.target.position.set(0, 0, -10);
flashlight.castShadow = true;
flashlight.shadow.mapSize.set(512, 512);
flashlight.shadow.camera.near = 0.1;
flashlight.shadow.camera.far = 15;
scene.add(flashlight);
scene.add(flashlight.target);

const pointLight1 = new THREE.PointLight(0x334466, 1.5, 12);
pointLight1.position.set(6, 3.2, -6);
scene.add(pointLight1);

// ── 材质 ──
const brickTex = createBrickTexture('#3a2a1a', '#1a1a0f');
brickTex.repeat.set(2, 8);
const brickWallMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85, metalness: 0.05 });

const floorTex = createFloorTexture();
const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95, metalness: 0 });

const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.95 });
const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.7, metalness: 0.1 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.3 });

// ── 走廊 ──
const DOOR_Z = -17; // 门的位置
const hallW = 3, hallH = 3.5, hallLen = 20;

const doorGroup = new THREE.Group();
doorGroup.name = 'door_group';
let doorClosed = true;

function createHallway(): void {
  // 地板
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(hallW, hallLen), floorMat);
  floor.rotation.x = -Math.PI/2; floor.position.set(0, 0, -hallLen/2 + 2);
  floor.receiveShadow = true; scene.add(floor);

  // 天花板
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(hallW, hallLen), ceilingMat);
  ceiling.rotation.x = Math.PI/2; ceiling.position.set(0, hallH, -hallLen/2 + 2);
  scene.add(ceiling);

  // 天花板横梁
  for (let z = 0; z > -hallLen + 2; z -= 3) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(hallW + 0.1, 0.15, 0.2), frameMat);
    beam.position.set(0, hallH - 0.08, z);
    beam.castShadow = true;
    scene.add(beam);
  }

  // 左右墙（砖纹理）
  const wallGeo = new THREE.PlaneGeometry(hallLen, hallH);
  const leftWall = new THREE.Mesh(wallGeo, brickWallMat);
  leftWall.rotation.y = Math.PI/2; leftWall.position.set(-hallW/2, hallH/2, -hallLen/2 + 2);
  leftWall.receiveShadow = true; scene.add(leftWall);

  const rightWall = new THREE.Mesh(wallGeo, brickWallMat);
  rightWall.rotation.y = -Math.PI/2; rightWall.position.set(hallW/2, hallH/2, -hallLen/2 + 2);
  rightWall.receiveShadow = true; scene.add(rightWall);

  // 后墙
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(hallW, hallH), brickWallMat);
  backWall.position.set(0, hallH/2, 3); scene.add(backWall);

  // 前墙（带门洞）
  createFrontWallWithDoor();

  // 墙壁烛台 (wallX = 墙的x坐标)
  createSconce(-hallW/2, 1.8, -3);
  createSconce(hallW/2, 1.8, -8);
  createSconce(-hallW/2, 1.8, -14);

  // 地上的杂物
  for (let i = 0; i < 8; i++) {
    const w = 0.1 + Math.random() * 0.3;
    const d = 0.1 + Math.random() * 0.3;
    const debris = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.02 + Math.random()*0.02, d),
      new THREE.MeshStandardMaterial({ color: 0x333322, roughness: 1 })
    );
    debris.position.set((Math.random()-0.5)*2.2, 0.002, -Math.random()*hallLen+1);
    debris.rotation.y = Math.random()*Math.PI;
    debris.receiveShadow = true;
    scene.add(debris);
  }
}

function createFrontWallWithDoor(): void {
  const doorW = 1.2, doorH = 2.3;
  const doorThick = 0.06;
  const topH = hallH - doorH;
  const sideW = (hallW - doorW) / 2;
  const frameWidth = 0.08;
  const frameDepth = 0.1;

  // 门上方的墙
  const topWall = new THREE.Mesh(new THREE.PlaneGeometry(doorW, topH), brickWallMat);
  topWall.position.set(0, doorH + topH/2, DOOR_Z);
  scene.add(topWall);

  // 门左侧墙
  const leftSide = new THREE.Mesh(new THREE.PlaneGeometry(sideW, hallH), brickWallMat);
  leftSide.position.set(-doorW/2 - sideW/2, hallH/2, DOOR_Z);
  scene.add(leftSide);

  // 门右侧墙
  const rightSide = new THREE.Mesh(new THREE.PlaneGeometry(sideW, hallH), brickWallMat);
  rightSide.position.set(doorW/2 + sideW/2, hallH/2, DOOR_Z);
  scene.add(rightSide);

  // 门框 - 左右竖条
  const fL = new THREE.Mesh(new THREE.BoxGeometry(frameWidth, doorH, frameDepth), frameMat);
  fL.position.set(-doorW/2, doorH/2, DOOR_Z);
  fL.castShadow = true;
  scene.add(fL);
  const fR = new THREE.Mesh(new THREE.BoxGeometry(frameWidth, doorH, frameDepth), frameMat);
  fR.position.set(doorW/2, doorH/2, DOOR_Z);
  fR.castShadow = true;
  scene.add(fR);
  // 门框 - 上横梁
  const fT = new THREE.Mesh(new THREE.BoxGeometry(doorW + frameWidth, frameWidth, frameDepth), frameMat);
  fT.position.set(0, doorH, DOOR_Z);
  scene.add(fT);

  // ── 门：hinge在左侧(x=-doorW/2)，门板在右侧展开 ──
  doorGroup.position.set(-doorW/2, 0, DOOR_Z);

  // 门板 (offset so left edge is at hinge origin)
  const panelW = doorW - 0.04;
  const panelH = doorH - 0.04;
  const doorGeo = new THREE.BoxGeometry(panelW, panelH, doorThick);
  // 把几何体向右偏移，让 hinge 在 x=0
  doorGeo.translate(panelW/2, panelH/2, 0);
  const doorPanel = new THREE.Mesh(doorGeo, doorMat);
  doorPanel.castShadow = true;
  doorPanel.receiveShadow = true;
  doorPanel.name = 'door_panel';
  doorGroup.add(doorPanel);

  // 门把手 — 在门右侧，把手中心在铰链右侧 (panelW - 0.08)m
  const knobMat = new THREE.MeshStandardMaterial({ color: 0xddaa44, roughness: 0.25, metalness: 0.9 });
  const knobX = panelW - 0.1;
  const knobY = panelH * 0.45;

  // 把手底座
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.02, 12), knobMat);
  base.position.set(knobX, knobY, doorThick/2 + 0.01);
  doorGroup.add(base);

  // 把手柄
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 12), knobMat);
  handle.rotation.z = Math.PI/2;
  handle.position.set(knobX + 0.06, knobY, doorThick/2 + 0.01);
  doorGroup.add(handle);

  // 把手球头
  const knobBall = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), knobMat);
  knobBall.position.set(knobX + 0.12, knobY, doorThick/2 + 0.01);
  doorGroup.add(knobBall);

  // 钥匙孔板
  const keyPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.005, 12),
    knobMat
  );
  keyPlate.position.set(knobX - 0.1, knobY, doorThick/2 + 0.005);
  doorGroup.add(keyPlate);

  // 铰链装饰
  for (let i = 0; i < 3; i++) {
    const hinge = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.08, 0.015),
      new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.8 })
    );
    hinge.position.set(0.02, panelH * (0.15 + i * 0.3), -doorThick/2 - 0.008);
    doorGroup.add(hinge);
  }

  scene.add(doorGroup);
}

function createSconce(wallX: number, y: number, z: number): void {
  const group = new THREE.Group();
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4, metalness: 0.7 });

  // 壁板
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.02), ironMat);
  plate.position.set(0, 0, 0.01);
  group.add(plate);

  // 弯曲臂 - 用多个圆柱体拼接模拟弯曲
  const armMat = ironMat;
  // 水平伸出
  const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 8), armMat);
  arm1.rotation.z = Math.PI/2;
  arm1.position.set(0.12, 0.08, 0);
  group.add(arm1);

  // 竖直向上弯曲
  const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8), armMat);
  arm2.position.set(0.22, 0.18, 0);
  group.add(arm2);

  // 烛台托
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.06, 12), ironMat);
  cup.position.set(0.22, 0.27, 0);
  group.add(cup);

  // 蜡烛
  const candleMat = new THREE.MeshStandardMaterial({ color: 0xeeeedd, roughness: 0.8 });
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.08, 8), candleMat);
  candle.position.set(0.22, 0.33, 0);
  group.add(candle);

  // 火焰 - 拉伸的球体模拟火苗形状
  const flameGeo = new THREE.SphereGeometry(0.025, 8, 6);
  flameGeo.scale(0.6, 1.6, 0.6);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8833 });
  const flameMesh = new THREE.Mesh(flameGeo, flameMat);
  flameMesh.position.set(0.22, 0.39, 0);

  // 火焰内芯（更亮）
  const innerGeo = new THREE.SphereGeometry(0.012, 6, 4);
  innerGeo.scale(0.6, 1.5, 0.6);
  const innerFlame = new THREE.Mesh(innerGeo, new THREE.MeshBasicMaterial({ color: 0xffdd88 }));
  innerFlame.position.set(0.22, 0.383, 0);
  group.add(flameMesh);
  group.add(innerFlame);

  // 烛光
  const pointLight = new THREE.PointLight(0xff8833, 1.8, 4, 1.5);
  pointLight.position.set(0.22, 0.39, 0);
  group.add(pointLight);

  // 存储动画引用
  group.userData = { flameMesh, innerFlame, pointLight, baseIntensity: 1.8 };

  // 确定墙的方向：墙在 hallW/2 处
  const side = wallX > 0 ? 1 : -1;
  group.position.set(wallX - side * 0.06, y, z);
  group.rotation.y = side > 0 ? -Math.PI/2 : Math.PI/2;

  scene.add(group);
  sconces.push(group);
}

const sconces: THREE.Group[] = [];

// ── 门开关动画 ──
function toggleDoor(): void {
  const targetAngle = doorClosed ? -Math.PI/2 : 0;
  const startAngle = doorClosed ? 0 : -Math.PI/2;

  let progress = 0;
  const duration = 800;
  const startTime = performance.now();
  doorClosed = !doorClosed;

  function animateDoor(now: number): void {
    progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    doorGroup.rotation.y = startAngle + (targetAngle - startAngle) * eased;

    if (progress < 1) {
      requestAnimationFrame(animateDoor);
    }
  }
  requestAnimationFrame(animateDoor);

  playSound(doorClosed ? 80 : 100, 0.4, 'sawtooth');
}

// ── 音效 ──
let audioCtx: AudioContext | null = null;
function getAudio(): AudioContext {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioCtx;
}

function playSound(freq: number, dur: number, type: OscillatorType = 'triangle', vol: number = 0.04): void {
  try {
    const ctx = getAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch { /* audio not critical */ }
}

let stepTimer = 0;
function playStep(): void { playSound(55 + Math.random() * 35, 0.12, 'triangle', 0.03); }

// ── 控制 ──
const keys: Record<string, boolean> = { w: false, a: false, s: false, d: false, e: false };
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k in keys) { keys[k] = true; e.preventDefault(); }
});
document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k in keys) { keys[k] = false; e.preventDefault(); }
});

const euler = new THREE.Euler(0, 0, 0, 'YXZ');
let isLocked = false;

renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => { isLocked = document.pointerLockElement === renderer.domElement; });
document.addEventListener('mousemove', e => {
  if (!isLocked) return;
  euler.setFromQuaternion(camera.quaternion);
  euler.y -= e.movementX * 0.002;
  euler.x -= e.movementY * 0.002;
  euler.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, euler.x));
  camera.quaternion.setFromEuler(euler);
});

// ── 交互检测 ──
const raycaster = new THREE.Raycaster();
raycaster.far = 2.5;
const hintEl = document.getElementById('hint')!;

let doorInRange = false;
function checkLookTarget(): void {
  raycaster.set(camera.position, camera.getWorldDirection(new THREE.Vector3()));
  const hits = raycaster.intersectObjects(scene.children, true);
  doorInRange = false;

  for (const hit of hits) {
    let obj: THREE.Object3D | null = hit.object;
    while (obj) {
      if (obj.name === 'door_group' || obj.name === 'door_panel' || obj.name === 'door_knob') {
        doorInRange = true;
        hintEl.textContent = doorClosed ? '按 E 打开门' : '门已打开';
        const dist = hit.distance;
        if (dist < 2 && keys.e) {
          keys.e = false;
          toggleDoor();
        }
        return;
      }
      obj = obj.parent;
    }
  }
  hintEl.textContent = '';
}

// ── 粒子灰尘 ──
const dustParticles: THREE.Mesh[] = [];
for (let i = 0; i < 40; i++) {
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.005, 3, 2),
    new THREE.MeshBasicMaterial({ color: 0xccccaa, transparent: true, opacity: 0.3 + Math.random()*0.3 })
  );
  dot.position.set((Math.random()-0.5)*2.5, Math.random()*hallH, -Math.random()*hallLen+1);
  dot.userData = { baseY: dot.position.y, speed: 0.2 + Math.random()*0.3, phase: Math.random()*Math.PI*2 };
  dustParticles.push(dot);
  scene.add(dot);
}

// ── 主循环 ──
const clock = new THREE.Clock();
const moveSpeed = 3.5;

function animate(): void {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (isLocked) {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0; forward.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0; right.normalize();

    let moving = false;
    if (keys.w) { camera.position.addScaledVector(forward, moveSpeed * dt); moving = true; }
    if (keys.s) { camera.position.addScaledVector(forward, -moveSpeed * dt); moving = true; }
    if (keys.a) { camera.position.addScaledVector(right, -moveSpeed * dt); moving = true; }
    if (keys.d) { camera.position.addScaledVector(right, moveSpeed * dt); moving = true; }

    // 限制在走廊内，门开着可以走过去
    camera.position.x = Math.max(-hallW/2 + 0.3, Math.min(hallW/2 - 0.3, camera.position.x));
    const zLimit = doorClosed ? DOOR_Z + 0.5 : DOOR_Z - 2;
    camera.position.z = Math.max(zLimit, Math.min(3, camera.position.z));
    camera.position.y = 1.6;

    if (moving) {
      stepTimer += dt;
      if (stepTimer > 0.45) { stepTimer = 0; playStep(); }
    } else { stepTimer = 0.45; }

    flashlight.position.copy(camera.position);
    flashlight.target.position.copy(camera.position).addScaledVector(
      camera.getWorldDirection(new THREE.Vector3()), 5
    );
  }

  // 烛火闪烁
  for (const s of sconces) {
    if (!s.userData) continue;
    const flicker = 0.85 + Math.random() * 0.3;
    s.userData.pointLight.intensity = s.userData.baseIntensity * flicker;
    const scl = 0.9 + Math.random() * 0.2;
    s.userData.flameMesh.scale.set(0.6 * scl, 1.6 * scl, 0.6 * scl);
  }

  // 灰尘浮动
  const time = performance.now() * 0.001;
  for (const dot of dustParticles) {
    dot.position.y = (dot.userData.baseY + Math.sin(time * dot.userData.speed + dot.userData.phase) * 0.3);
    (dot.material as THREE.MeshBasicMaterial).opacity = 0.15 + Math.sin(time * dot.userData.speed * 1.5 + dot.userData.phase) * 0.15;
  }

  checkLookTarget();
  renderer.render(scene, camera);
}

createHallway();
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

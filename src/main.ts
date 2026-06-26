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

  // 墙壁烛台
  createSconce(-1.4, 1.8, -3);
  createSconce(1.4, 1.8, -8);
  createSconce(-1.4, 1.8, -13);

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
  const topH = hallH - doorH;
  const sideW = (hallW - doorW) / 2;

  // 门上方的墙
  const topWall = new THREE.Mesh(new THREE.PlaneGeometry(doorW, topH), brickWallMat);
  topWall.position.set(0, doorH + topH/2, DOOR_Z + 0.05);
  scene.add(topWall);

  // 门左侧墙
  const leftSide = new THREE.Mesh(new THREE.PlaneGeometry(sideW, hallH), brickWallMat);
  leftSide.position.set(-doorW/2 - sideW/2, hallH/2, DOOR_Z + 0.05);
  scene.add(leftSide);

  // 门右侧墙
  const rightSide = new THREE.Mesh(new THREE.PlaneGeometry(sideW, hallH), brickWallMat);
  rightSide.position.set(doorW/2 + sideW/2, hallH/2, DOOR_Z + 0.05);
  scene.add(rightSide);

  // 门框
  const fThick = 0.12, fWidth = 0.1;
  const fL = new THREE.Mesh(new THREE.BoxGeometry(fWidth, doorH, fThick), frameMat);
  fL.position.set(-doorW/2, doorH/2, DOOR_Z + 0.05);
  scene.add(fL);
  const fR = new THREE.Mesh(new THREE.BoxGeometry(fWidth, doorH, fThick), frameMat);
  fR.position.set(doorW/2, doorH/2, DOOR_Z + 0.05);
  scene.add(fR);
  const fT = new THREE.Mesh(new THREE.BoxGeometry(doorW + fWidth*2, fWidth, fThick), frameMat);
  fT.position.set(0, doorH, DOOR_Z + 0.05);
  scene.add(fT);

  // 门板
  const door = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.05, doorH - 0.05, 0.06), doorMat);
  door.position.set(0, (doorH - 0.05)/2, DOOR_Z);
  door.castShadow = true;
  door.name = 'door_panel';
  doorGroup.add(door);

  // 门把手（黄铜色，右侧）
  const knobGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8);
  const knobMat = new THREE.MeshStandardMaterial({ color: 0xddaa44, roughness: 0.3, metalness: 0.9 });
  const knob = new THREE.Mesh(knobGeo, knobMat);
  knob.rotation.x = Math.PI/2;
  knob.position.set(0.45, doorH/2 - 0.1, 0.04);
  knob.name = 'door_knob';
  doorGroup.add(knob);

  // 钥匙孔
  const keyhole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.01, 8),
    knobMat
  );
  keyhole.rotation.x = Math.PI/2;
  keyhole.position.set(0.35, doorH/2 - 0.1, 0.035);
  doorGroup.add(keyhole);

  doorGroup.position.set(0, 0, 0);
  scene.add(doorGroup);
}

function createSconce(x: number, y: number, z: number): void {
  const group = new THREE.Group();
  // 支架
  const bracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.2, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.6 })
  );
  bracket.position.set(0, -0.1, 0);
  group.add(bracket);

  // 火焰发光点
  const flame = new THREE.PointLight(0xff8833, 1.5, 3);
  flame.position.set(0, 0.05, 0.15);
  group.add(flame);

  // 火苗
  const fire = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffaa44 })
  );
  fire.position.set(0, 0.05, 0.15);
  group.add(fire);

  group.position.set(x, y, z);
  scene.add(group);
}

// ── 门开关动画 ──
function toggleDoor(): void {
  const doorPanel = doorGroup.children[0] as THREE.Mesh; // 门板是第一个子对象
  if (!doorPanel) return;

  const targetAngle = doorClosed ? -Math.PI/2 : 0;
  const startAngle = doorClosed ? 0 : -Math.PI/2;

  const doorH = 2.25;
  doorPanel.position.set(doorClosed ? -0.6 : 0, doorH/2, 0);
  doorPanel.geometry = new THREE.BoxGeometry(doorClosed ? 1.15 : 1.15, doorH, 0.06);

  // 动画开关
  let progress = 0;
  const duration = 800; // ms
  const startTime = performance.now();
  doorClosed = !doorClosed;

  function animateDoor(now: number): void {
    progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out

    const angle = startAngle + (targetAngle - startAngle) * eased;
    doorPanel.rotation.y = angle;
    doorPanel.position.x = -0.6 * Math.cos(Math.abs(angle));

    if (progress < 1) {
      requestAnimationFrame(animateDoor);
    }
  }
  requestAnimationFrame(animateDoor);

  // 开关门音效
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

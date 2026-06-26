import * as THREE from 'three';

// ── 场景初始化 ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);
scene.fog = new THREE.FogExp2(0x050510, 0.015);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 50);
camera.position.set(0, 1.6, 8); // 眼睛高度1.6米

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
document.body.appendChild(renderer.domElement);

// ── 灯光 ──
// 极暗的环境光
const ambient = new THREE.AmbientLight(0x111122, 0.5);
scene.add(ambient);

// 手电筒（聚光灯跟随相机）
const flashlight = new THREE.SpotLight(0xffeedd, 30, 15, Math.PI/8, 0.2, 0.5);
flashlight.position.copy(camera.position);
flashlight.target.position.set(0, 0, -10);
flashlight.castShadow = true;
flashlight.shadow.mapSize.set(512, 512);
flashlight.shadow.camera.near = 0.1;
flashlight.shadow.camera.far = 20;
scene.add(flashlight);
scene.add(flashlight.target);

// 远处几盏惨淡的点光源
const pointLight1 = new THREE.PointLight(0x334466, 2, 15);
pointLight1.position.set(8, 3, -5);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0x442222, 1.5, 10);
pointLight2.position.set(-5, 4, 2);
scene.add(pointLight2);

// ── 材质工厂 ──
const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3a2a, roughness: 0.9 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2a1a, roughness: 0.95 });
const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a2a1a, roughness: 0.7 });
const brickMat = new THREE.MeshStandardMaterial({ color: 0x553322, roughness: 0.85 });

// ── 走廊 ──
function createHallway(): void {
  const len = 20, w = 3, h = 3.5;

  // 地板
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, len), floorMat);
  floor.rotation.x = -Math.PI/2;
  floor.position.set(0, 0, -len/2 + 2);
  floor.receiveShadow = true;
  scene.add(floor);

  // 天花板
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w, len), ceilingMat);
  ceiling.rotation.x = Math.PI/2;
  ceiling.position.set(0, h, -len/2 + 2);
  scene.add(ceiling);

  // 左墙
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(len, h), wallMat);
  leftWall.rotation.y = Math.PI/2;
  leftWall.position.set(-w/2, h/2, -len/2 + 2);
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  // 右墙
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(len, h), wallMat);
  rightWall.rotation.y = -Math.PI/2;
  rightWall.position.set(w/2, h/2, -len/2 + 2);
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  // 后墙（起点背后）
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
  backWall.position.set(0, h/2, 3);
  scene.add(backWall);

  // 前墙（走廊尽头）
  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
  frontWall.position.set(0, h/2, -len + 1);
  scene.add(frontWall);

  // 走廊尽头的一扇门
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.1), doorMat);
  door.position.set(0, 1.1, -len + 1.05);
  door.castShadow = true;
  door.name = 'door_end';
  scene.add(door);

  // 门框
  const frameGeom = new THREE.BoxGeometry(0.1, 2.4, 0.15);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });
  const frameL = new THREE.Mesh(frameGeom, frameMat);
  frameL.position.set(-0.65, 1.2, -len + 1.05);
  scene.add(frameL);
  const frameR = new THREE.Mesh(frameGeom, frameMat);
  frameR.position.set(0.65, 1.2, -len + 1.05);
  scene.add(frameR);
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.15), frameMat);
  frameTop.position.set(0, 2.3, -len + 1.05);
  scene.add(frameTop);

  // 墙上一些斑驳的痕迹（小方块模拟砖块露出）
  for (let i = 0; i < 15; i++) {
    const patch = new THREE.Mesh(
      new THREE.BoxGeometry(0.3 + Math.random()*0.4, 0.15, 0.02),
      brickMat
    );
    const side = Math.random() > 0.5 ? 1 : -1;
    patch.position.set(side * (w/2 - 0.02), 0.5 + Math.random() * 2.5, -Math.random() * len + 1);
    patch.rotation.z = (Math.random() - 0.5) * 0.3;
    scene.add(patch);
  }

  // 地上的旧纸张
  for (let i = 0; i < 5; i++) {
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xddccaa, roughness: 1, side: THREE.DoubleSide })
    );
    paper.rotation.x = -Math.PI/2;
    paper.position.set((Math.random()-0.5)*2, 0.002, -Math.random()*len + 1);
    paper.rotation.z = Math.random() * Math.PI;
    scene.add(paper);
  }
}

createHallway();

// ── 第一人称控制 ──
const keys = { w: false, a: false, s: false, d: false, e: false };
const moveSpeed = 4;
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
let isLocked = false;

document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k in keys) { (keys as any)[k] = true; e.preventDefault(); }
});
document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k in keys) { (keys as any)[k] = false; e.preventDefault(); }
});

// 鼠标锁定
renderer.domElement.addEventListener('click', () => {
  renderer.domElement.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  isLocked = document.pointerLockElement === renderer.domElement;
});

document.addEventListener('mousemove', e => {
  if (!isLocked) return;
  euler.setFromQuaternion(camera.quaternion);
  euler.y -= e.movementX * 0.002;
  euler.x -= e.movementY * 0.002;
  euler.x = Math.max(-Math.PI/3, Math.min(Math.PI/3, euler.x));
  camera.quaternion.setFromEuler(euler);
});

// ── 交互提示 ──
const hintEl = document.getElementById('hint')!;
const raycaster = new THREE.Raycaster();
raycaster.far = 3;

function checkInteract(): void {
  raycaster.set(camera.position, camera.getWorldDirection(new THREE.Vector3()));
  const hits = raycaster.intersectObjects(scene.children, true);
  hintEl.textContent = '';
  for (const hit of hits) {
    let obj: THREE.Object3D | null = hit.object;
    while (obj) {
      if (obj.name === 'door_end') {
        hintEl.textContent = '按 E 打开门';
        return;
      }
      obj = obj.parent;
    }
  }
}

// ── 脚步声 ──
let stepTimer = 0;
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
function playStep(): void {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 60 + Math.random() * 30;
  gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.15);
}

// ── 主循环 ──
const clock = new THREE.Clock();
function animate(): void {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (isLocked) {
    // 移动
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0; forward.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0; right.normalize();

    let moving = false;
    if (keys.w) { camera.position.addScaledVector(forward, moveSpeed * dt); moving = true; }
    if (keys.s) { camera.position.addScaledVector(forward, -moveSpeed * dt); moving = true; }
    if (keys.a) { camera.position.addScaledVector(right, -moveSpeed * dt); moving = true; }
    if (keys.d) { camera.position.addScaledVector(right, moveSpeed * dt); moving = true; }

    // 限制在走廊范围
    camera.position.x = Math.max(-2.8, Math.min(2.8, camera.position.x));
    camera.position.z = Math.max(-19, Math.min(3, camera.position.z));
    camera.position.y = 1.6;

    // 脚步声
    if (moving) {
      stepTimer += dt;
      if (stepTimer > 0.4) { stepTimer = 0; playStep(); }
    } else {
      stepTimer = 0.4;
    }

    // 手电筒跟随
    flashlight.position.copy(camera.position);
    flashlight.target.position.copy(camera.position).addScaledVector(
      camera.getWorldDirection(new THREE.Vector3()), 5
    );

    // 交互检测
    if (keys.e) {
      keys.e = false;
      checkInteract();
    }
  }

  // 粒子浮动（模拟灰尘）
  checkInteract();
  renderer.render(scene, camera);
}

animate();

// ── 窗口缩放 ──
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
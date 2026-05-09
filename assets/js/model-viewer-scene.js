import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js';

const COL_BG = 0x111111;
const COL_AMBIENT = 0xffffff;
const COL_SPHERE = 0x4c8cc9;

const canvas = document.getElementById('c');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COL_BG);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(2.2, 1.4, 2.2);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 0.35;
controls.maxDistance = 80;
controls.listenToKeyEvents(document.body);
controls.update();
camera.lookAt(controls.target);

const ambient = new THREE.AmbientLight(COL_AMBIENT, 0.72);
const hemi = new THREE.HemisphereLight(0xffffff, 0x2a2a2a, 0.55);
const key = new THREE.DirectionalLight(0xffffff, 1.25);
key.position.set(5, 8, 4);
const fill = new THREE.DirectionalLight(0xffffff, 0.45);
fill.position.set(-4, 2, -3);
scene.add(ambient, hemi, key, fill);

const sphereGeom = new THREE.SphereGeometry(0.5, 48, 32);
const sphereMat = new THREE.MeshStandardMaterial({
  color: COL_SPHERE,
  metalness: 0.25,
  roughness: 0.42
});
const subject = new THREE.Mesh(sphereGeom, sphereMat);
subject.castShadow = true;
subject.receiveShadow = true;
scene.add(subject);

const EXTRA_PALETTE = [
  0xc94c4c, 0x4c8cc9, 0x6bc94c, 0xc9a64c,
  0x9b59b6, 0x1abc9c, 0xe67e22, 0x34495e,
  0xff6b6b, 0x4ecdc4, 0x00b894, 0xa29bfe
];
const extras = new THREE.Group();
for (let i = 0; i < 12; i++) {
  const rad = 0.1 + Math.random() * 0.38;
  const g = new THREE.SphereGeometry(rad, 28, 20);
  const mat = new THREE.MeshStandardMaterial({
    color: EXTRA_PALETTE[Math.floor(Math.random() * EXTRA_PALETTE.length)],
    metalness: 0.12 + Math.random() * 0.4,
    roughness: 0.28 + Math.random() * 0.55
  });
  const m = new THREE.Mesh(g, mat);
  m.position.set(
    (Math.random() - 0.5) * 7,
    Math.random() * 2.8 + 0.1,
    (Math.random() - 0.5) * 7
  );
  if (m.position.length() < 1.15) {
    m.position.normalize().multiplyScalar(1.15 + Math.random() * 1.2);
  }
  extras.add(m);
}
scene.add(extras);

const grid = new THREE.GridHelper(12, 24, 0x444444, 0x2a2a2a);
grid.position.y = -0.5;
scene.add(grid);

const transformControls = new TransformControls(camera, canvas);
transformControls.attach(subject);
transformControls.setMode('translate');
scene.add(transformControls.getHelper());

let transformDragging = false;
transformControls.addEventListener('dragging-changed', (ev) => {
  transformDragging = ev.value;
});

const viewHelper = new ViewHelper(camera, canvas);

let cornerGizmoPointer = false;
canvas.addEventListener(
  'pointerdown',
  (e) => {
    if (e.isPrimary === false) return;
    const rect = canvas.getBoundingClientRect();
    if (
      e.clientX >= rect.right - 128 &&
      e.clientY >= rect.bottom - 128
    ) {
      cornerGizmoPointer = true;
    }
  },
  { capture: true }
);
canvas.addEventListener('pointerup', () => {
  cornerGizmoPointer = false;
});
canvas.addEventListener('pointercancel', () => {
  cornerGizmoPointer = false;
});
canvas.addEventListener('click', (e) => {
  if (viewHelper.handleClick(e)) {
    cornerGizmoPointer = false;
  }
});

const clock = new THREE.Clock();

function onResize() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', onResize);
requestAnimationFrame(() => {
  onResize();
  controls.update();
});

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  viewHelper.center.copy(controls.target);

  if (viewHelper.animating) {
    viewHelper.update(delta);
  }

  controls.enabled =
    !viewHelper.animating && !transformDragging && !cornerGizmoPointer;
  controls.update();

  renderer.render(scene, camera);
  viewHelper.render(renderer);
}

animate();

import * as THREE from 'three';

const container = document.getElementById('three-container');

// ── Scene setup ──────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x02040a, 0.08);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100);
camera.position.set(0, 0, 7);

function updateCameraOffset() {
    camera.position.x = 0;
}
updateCameraOffset();

// ── Colors ───────────────────────────────────────────────────
const TEAL = new THREE.Color(0x00e5c8);
const TEAL_DIM = new THREE.Color(0x00a090);
const GLASS = new THREE.Color(0x9dd8d4);
const DARK_GLASS = new THREE.Color(0x1a4040);

// ── Lights ───────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x061818, 2));

const coreLight = new THREE.PointLight(TEAL, 8, 6);
scene.add(coreLight);

const rimLight = new THREE.DirectionalLight(0x80ffee, 1.2);
rimLight.position.set(-3, 2, 3);
scene.add(rimLight);

const backLight = new THREE.DirectionalLight(0x003333, 0.8);
backLight.position.set(3, -2, -3);
scene.add(backLight);

// ── Helpers ───────────────────────────────────────────────────
function glassMat(opacity = 0.55, roughness = 0.05, color = GLASS) {
    return new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.05,
        roughness,
        transmission: 0.6,
        thickness: 0.6,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        envMapIntensity: 1.5,
        reflectivity: 0.9,
    });
}

// ── Core sphere ───────────────────────────────────────────────
const sceneGroup = new THREE.Group();
scene.add(sceneGroup);

const coreGroup = new THREE.Group();
sceneGroup.add(coreGroup);

// Outer shell (transparent glass globe)
const outerGeo = new THREE.SphereGeometry(1.0, 64, 64);
const outerMat = new THREE.MeshPhysicalMaterial({
    color: 0xaadddd,
    metalness: 0.1,
    roughness: 0.04,
    transmission: 0.85,
    thickness: 0.3,
    transparent: true,
    opacity: 0.35,
    side: THREE.FrontSide,
    envMapIntensity: 2,
});
const outerSphere = new THREE.Mesh(outerGeo, outerMat);
coreGroup.add(outerSphere);

// Inner glow ball
const innerGeo = new THREE.SphereGeometry(0.38, 48, 48);
const innerMat = new THREE.MeshStandardMaterial({
    color: TEAL,
    emissive: TEAL,
    emissiveIntensity: 3.5,
    roughness: 0.2,
    metalness: 0,
});
const innerBall = new THREE.Mesh(innerGeo, innerMat);
coreGroup.add(innerBall);

// Inner ring halo
for (let i = 0; i < 3; i++) {
    const r = 0.42 + i * 0.07;
    const ringGeo = new THREE.TorusGeometry(r, 0.008 - i * 0.001, 16, 120);
    const ringMat = new THREE.MeshStandardMaterial({
        color: TEAL,
        emissive: TEAL,
        emissiveIntensity: 2.5 - i * 0.5,
        transparent: true,
        opacity: 0.9 - i * 0.2,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2 * (i % 2 === 0 ? 1 : 0);
    ring.rotation.y = i * Math.PI / 3;
    coreGroup.add(ring);
}

// ── Circuit pattern on inner sphere ───────────────────────────
const circuitGroup = new THREE.Group();
coreGroup.add(circuitGroup);

function circuitLine(points, emissive = 1.5) {
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
        color: TEAL,
        transparent: true,
        opacity: 0.7,
    });
    return new THREE.Line(geom, mat);
}

// Radial circuit lines on sphere surface
for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const pts = [];
    for (let j = 0; j <= 20; j++) {
        const t = j / 20;
        const r = 0.72 + Math.sin(t * Math.PI) * 0.04;
        const phi = angle + t * 0.3 - 0.15;
        const theta = t * Math.PI;
        pts.push(new THREE.Vector3(
            r * Math.sin(theta) * Math.cos(phi),
            r * Math.cos(theta),
            r * Math.sin(theta) * Math.sin(phi)
        ));
    }
    circuitGroup.add(circuitLine(pts));
}

// Circuit rings at different latitudes
for (let lat = 0; lat < 4; lat++) {
    const theta = (0.3 + lat * 0.2) * Math.PI;
    const r = 0.72 * Math.sin(theta);
    const y = 0.72 * Math.cos(theta);
    const pts = [];
    const segs = 40;
    for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.5 });
    circuitGroup.add(new THREE.Line(geo, mat));
}

// ── Panels (the 6 rotating blades) ────────────────────────────
const panelGroup = new THREE.Group();
coreGroup.add(panelGroup);

const PANEL_COUNT = 6;

// Panel shape: a curved wedge
function createPanelShape() {
    const shape = new THREE.Shape();
    const innerR = 1.08;
    const outerR = 1.72;
    const halfAngle = 0.45; // radians

    shape.moveTo(
        innerR * Math.cos(-halfAngle),
        innerR * Math.sin(-halfAngle)
    );
    // inner arc
    shape.absarc(0, 0, innerR, -halfAngle, halfAngle, false);
    // outer edge sweep
    shape.lineTo(
        outerR * Math.cos(halfAngle) * 0.88,
        outerR * Math.sin(halfAngle)
    );
    // outer arc
    shape.absarc(0, 0, outerR, halfAngle, -halfAngle, true);
    shape.closePath();
    return shape;
}

const panelShape = createPanelShape();
const extrudeSettings = {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 6,
};
const panelGeo = new THREE.ExtrudeGeometry(panelShape, extrudeSettings);
panelGeo.center();

const panelMat = glassMat(0.72, 0.06, new THREE.Color(0x7fc8c0));

const panels = [];
for (let i = 0; i < PANEL_COUNT; i++) {
    const angle = (i / PANEL_COUNT) * Math.PI * 2;
    const tiltAxis = i % 2 === 0 ? 1 : -1;

    const pivot = new THREE.Group();
    pivot.rotation.z = angle;

    const mesh = new THREE.Mesh(panelGeo, panelMat.clone());
    // Position panel around the sphere
    mesh.position.set(1.35, 0, 0);
    mesh.rotation.y = Math.PI / 2;
    // Slight outward tilt like in the image
    mesh.rotation.z = tiltAxis * 0.18;

    pivot.add(mesh);
    panelGroup.add(pivot);
    panels.push({ pivot, mesh, angle, baseAngle: angle, tiltAxis });
}

// ── Halo / bloom ring ─────────────────────────────────────────
const haloGeo = new THREE.RingGeometry(1.05, 1.12, 80);
const haloMat = new THREE.MeshBasicMaterial({
    color: TEAL,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
});
const haloRing = new THREE.Mesh(haloGeo, haloMat);
coreGroup.add(haloRing);

// Secondary outer glow ring
const haloGeo2 = new THREE.RingGeometry(1.5, 1.55, 80);
const haloMat2 = new THREE.MeshBasicMaterial({
    color: TEAL,
    transparent: true,
    opacity: 0.07,
    side: THREE.DoubleSide,
});
coreGroup.add(new THREE.Mesh(haloGeo2, haloMat2));

// ── Sprite glow (soft center bloom) ───────────────────────────
function makeSprite(size, color, opacity) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, `rgba(${color},${opacity})`);
    grad.addColorStop(0.4, `rgba(${color},${opacity * 0.4})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(size);
    return sprite;
}

const coreGlow = makeSprite(2.8, '0,229,200', 1.0);
coreGroup.add(coreGlow);

const outerGlow = makeSprite(5.5, '0,180,160', 0.35);
coreGroup.add(outerGlow);

// ── Particle dust ─────────────────────────────────────────────
const particleCount = 280;
const pPositions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 1.8 + Math.random() * 2.2;
    pPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pPositions[i * 3 + 2] = r * Math.cos(phi);
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
const pMat = new THREE.PointsMaterial({
    color: TEAL,
    size: 0.018,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
});
const particlesMesh = new THREE.Points(pGeo, pMat);
coreGroup.add(particlesMesh);

// ── Mouse / Raycaster interaction ─────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-999, -999);
let targetX = 0;
let targetY = 0;

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

// ── Resize ────────────────────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    updateCameraOffset();
});

// ── Animation loop ───────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Raycasting for panel hover
    raycaster.setFromCamera(mouse, camera);
    const meshes = panels.map(p => p.mesh);
    const hits = raycaster.intersectObjects(meshes);
    const hitMesh = hits.length ? hits[0].object : null;

    panels.forEach(({ mesh }) => {
        const isHit = mesh === hitMesh;
        mesh.material.emissive = isHit ? TEAL : new THREE.Color(0x000000);
        mesh.material.emissiveIntensity = isHit ? 0.6 : 0;
        mesh.material.opacity = isHit ? 0.92 : 0.72;
    });

    // Panel slow orbital drift
    panels.forEach(({ pivot, angle, tiltAxis }, i) => {
        const drift = Math.sin(t * 0.3 + i * 1.05) * 0.04;
        pivot.rotation.z = angle + drift;
    });

    // Core sphere slow self-rotation
    coreGroup.rotation.y += 0.003;
    coreGroup.rotation.x = Math.sin(t * 0.15) * 0.04;

    // Circuit lines spin
    circuitGroup.rotation.y += 0.006;

    // Panel group counter-rotation
    panelGroup.rotation.y -= 0.001;

    // Particles slow float
    particlesMesh.rotation.y = t * 0.02;

    // Pulsing core light
    const pulse = 0.75 + 0.25 * Math.sin(t * 2.1);
    coreLight.intensity = 7 * pulse;
    innerMat.emissiveIntensity = 3.0 + 1.0 * Math.sin(t * 2.1);

    // Halo pulse
    haloMat.opacity = 0.1 + 0.08 * Math.sin(t * 1.8);

    // Sprite glow breathe
    const breathe = 0.9 + 0.12 * Math.sin(t * 1.5);
    coreGlow.scale.setScalar(2.8 * breathe);

    // Parallax effect
    if (mouse.x !== -999) {
        targetX = mouse.x * 0.5;
        targetY = mouse.y * 0.5;
    }

    sceneGroup.rotation.y += 0.05 * (targetX - sceneGroup.rotation.y);
    sceneGroup.rotation.x += 0.05 * (targetY - sceneGroup.rotation.x);

    // Gentle hovering motion
    sceneGroup.position.y = Math.sin(t * 1.5) * 0.15;

    renderer.render(scene, camera);
}

animate();

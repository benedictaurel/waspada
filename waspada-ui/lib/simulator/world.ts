import * as THREE from "three";
import { simulatorConfig } from "./config";
import { ROADS, type Obstacle, type Vehicle } from "./physics";

type TrafficCar = { group: THREE.Group; road: number; progress: number; direction: number; horizontal: boolean; speed: number };
export type CityWorld = ReturnType<typeof createCity>;
export function createCity(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#b9d1d1");
  scene.fog = new THREE.Fog("#b9d1d1", 120, 580);
  const camera = new THREE.PerspectiveCamera(simulatorConfig.fieldOfView, 1, .1, 800);
  const rearCamera = new THREE.PerspectiveCamera(65, 3.8, .1, 420);
  let viewWidth = 1, viewHeight = 1;
  const ambient = new THREE.HemisphereLight(0xe8f7ff, 0x72826c, 2.3);
  const sun = new THREE.DirectionalLight(0xffe2b1, 3.1);
  sun.position.set(-100, 160, 100);
  scene.add(ambient, sun);
  const obstacles: Obstacle[] = [];
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const buckets = new Map<string, THREE.Matrix4[]>();
  const dummy = new THREE.Object3D();
  function material(color: string) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .85 }));
    return materials.get(color)!;
  }
  function box(x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
    dummy.position.set(x, y, z); dummy.scale.set(w, h, d); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    if (!buckets.has(color)) buckets.set(color, []);
    buckets.get(color)!.push(dummy.matrix.clone());
  }
  box(0, -.35, 0, 1600, .5, 1600, "#7d9975");
  box(0, -.06, 0, 606, .2, 606, "#a0aa8a");
  for (const r of ROADS) {
    box(r, .035, 0, 24, .12, 600, "#aeb5a7"); box(0, .035, r, 600, .12, 24, "#aeb5a7");
    box(r, .11, 0, 18, .08, 600, "#505d60"); box(0, .11, r, 600, .08, 18, "#505d60");
    for (let p = -292; p < 298; p += 10) {
      if (ROADS.some(c => Math.abs(p - c) < 13)) continue;
      box(r, .16, p, .14, .025, 4, "#e7dba5"); box(p, .16, r, 4, .025, .14, "#e7dba5");
      box(r - 8, .16, p, .1, .025, 10, "#c6cec4"); box(r + 8, .16, p, .1, .025, 10, "#c6cec4");
      box(p, .16, r - 8, 10, .025, .1, "#c6cec4"); box(p, .16, r + 8, 10, .025, .1, "#c6cec4");
    }
  }
  const signalLights: { mesh: THREE.Mesh; ns: boolean }[] = [];
  for (const x of ROADS) for (const z of ROADS) {
    for (let stripe = -6; stripe <= 6; stripe += 2) for (const side of [-1, 1]) {
      box(x + stripe, .17, z + side * 13, 1.1, .02, 3, "#dfdfcb");
      box(x + side * 13, .17, z + stripe, 3, .02, 1.1, "#dfdfcb");
    }
    for (const side of [-1, 1]) {
      box(x + side * 10, 2.4, z + side * 10, .17, 4.8, .17, "#344a49");
      box(x + side * 10, 4.6, z + side * 10, .5, 1.25, .5, "#263936");
      const light = new THREE.Mesh(new THREE.SphereGeometry(.16, 6, 6), new THREE.MeshBasicMaterial({ color: 0x9ae3ac }));
      light.position.set(x + side * 10, 4.7, z + side * 10 + side * .28); scene.add(light); signalLights.push({ mesh: light, ns: true });
    }
  }
  let seed = simulatorConfig.citySeed;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  function tree(x: number, z: number) {
    box(x, 1.5, z, .5, 3, .5, "#776e51");
    box(x, 4.1, z, 4.6, 4.4, 4.6, "#66886c");
    box(x + .5, 6.2, z, 3.3, 1.8, 3.3, "#789a78");
  }
  function sign(text: string, x: number, y: number, z: number, width: number) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 96;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#244f4c"; ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = "#f3eddb"; ctx.font = "500 35px sans-serif"; ctx.textAlign = "center"; ctx.fillText(text, 256, 61);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 96 / 512), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
    mesh.position.set(x, y, z); scene.add(mesh);
  }
  const palette = ["#ded4bc", "#c8baa6", "#afb9b0", "#bdc7c1", "#d8c4ae", "#a1b5b5"];
  for (let ix = 0; ix < 4; ix++) for (let iz = 0; iz < 4; iz++) {
    const cx = ROADS[ix] + 60, cz = ROADS[iz] + 60;
    if (ix === 2 && iz === 1) {
      box(cx, .15, cz, 90, .2, 90, "#879f76");
      box(cx, .29, cz, 5, .08, 86, "#cecaaf"); box(cx, .29, cz, 86, .08, 5, "#cecaaf");
      box(cx, .36, cz, 24, .25, 24, "#c7c8b7"); box(cx, .52, cz, 20, .12, 20, "#78abad");
      for (let t = 0; t < 22; t++) tree(cx + (random() - .5) * 80, cz + (random() - .5) * 80);
      sign("MERDEKA PARK", cx, 2, cz + 46, 13);
      continue;
    }
    for (let a = -1; a <= 1; a += 2) for (let b = -1; b <= 1; b += 2) {
      const x = cx + a * 24, z = cz + b * 24;
      const w = 24 + random() * 12, d = 23 + random() * 13, h = 9 + Math.floor(random() * 7) * 4;
      box(x, h / 2, z, w, h, d, palette[Math.floor(random() * palette.length)]);
      box(x, h + .25, z, w + .7, .5, d + .7, "#e4ddc9");
      box(x, .5, z, w + 1, 1, d + 1, "#9c9f94");
      obstacles.push({ x, z, halfX: w / 2, halfZ: d / 2 });
      for (let y = 3; y < h - 1; y += 4) for (let wx = -w / 2 + 3; wx < w / 2 - 1; wx += 5) {
        box(x + wx, y, z + d / 2 + .04, 2.1, 2.2, .08, "#68858a"); box(x + wx, y, z - d / 2 - .04, 2.1, 2.2, .08, "#68858a");
      }
      for (let y = 3; y < h - 1; y += 4) for (let wz = -d / 2 + 3; wz < d / 2 - 1; wz += 5) {
        box(x + w / 2 + .04, y, z + wz, .08, 2.2, 2.1, "#68858a"); box(x - w / 2 - .04, y, z + wz, .08, 2.2, 2.1, "#68858a");
      }
      if (b === 1) sign(["SERAMU", "STASIUN UI", "FAKULTAS HUKUM", "FAKULTAS TEKNIK"][ix], x, 3, z + d / 2 + .11, w * .72);
    }
    for (let t = -1; t <= 1; t++) { tree(cx + t * 28, cz + 46); tree(cx - 46, cz + t * 28); }
  }
  // Low outer walls mark the edge of this deliberately small world.
  for (const edge of [-300, 300]) { box(edge, .7, 0, 1, 1.4, 600, "#b7b6a3"); box(0, .7, edge, 600, 1.4, 1, "#b7b6a3"); }
  for (let i = 0; i < 28; i++) {
    const x = (random() - .5) * 1200, z = -360 - random() * 140, h = 20 + random() * 65;
    box(x, h / 2, z, 25 + random() * 30, h, 25, "#9baead");
  }
  for (const [color, matrices] of buckets) {
    const mesh = new THREE.InstancedMesh(boxGeometry, material(color), matrices.length);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.computeBoundingSphere(); scene.add(mesh);
  }
  const traffic: TrafficCar[] = [];
  for (let i = 0; i < simulatorConfig.trafficCount; i++) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, .65, 4), material(["#e6d2a1", "#a65e49", "#c8d3cc", "#47777a"][i % 4])); body.position.y = .7;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, .65, 2.1), material("#405b62")); cabin.position.set(0, 1.3, -.1);
    group.add(body, cabin);
    for (const x of [-.92, .92]) for (const z of [-1.25, 1.25]) { const tire = new THREE.Mesh(new THREE.BoxGeometry(.23, .55, .55), material("#263431")); tire.position.set(x, .35, z); group.add(tire); }
    for (const x of [-.6, .6]) { const lamp = new THREE.Mesh(new THREE.BoxGeometry(.4, .16, .04), new THREE.MeshBasicMaterial({ color: "#ef886b" })); lamp.position.set(x, .8, 2.02); group.add(lamp); }
    scene.add(group); traffic.push({ group, road: ROADS[i % 5], progress: -270 + i * 43, direction: i % 2 ? 1 : -1, horizontal: i >= 6, speed: 7 + i % 3 });
  }
  let trafficObstacles: Obstacle[] = [];
  function updateTraffic(dt: number, elapsed: number, enabled: boolean, car: Vehicle) {
    const nsGreen = Math.floor(elapsed / 18) % 2 === 0;
    signalLights.forEach(({ mesh }) => (mesh.material as THREE.MeshBasicMaterial).color.set(nsGreen ? "#91e4aa" : "#f27658"));
    trafficObstacles = [];
    traffic.forEach(t => {
      t.group.visible = enabled; if (!enabled) return;
      const signalGreen = t.horizontal ? !nsGreen : nsGreen;
      const nearStop = ROADS.some(r => { const ahead = (r - t.progress) * t.direction; return ahead > 13 && ahead < 19; });
      const x = t.horizontal ? t.progress : t.road - t.direction * 4;
      const z = t.horizontal ? t.road + t.direction * 4 : t.progress;
      const aheadOfCar = t.horizontal ? (car.x - x) * t.direction : (car.z - z) * t.direction;
      const lateralToCar = t.horizontal ? Math.abs(car.z - z) : Math.abs(car.x - x);
      if ((signalGreen || !nearStop) && !(aheadOfCar > 0 && aheadOfCar < 11 && lateralToCar < 3)) t.progress += t.direction * t.speed * dt;
      if (Math.abs(t.progress) > 285) { t.progress = Math.sign(t.progress) * 285; t.direction *= -1; }
      t.group.position.set(t.horizontal ? t.progress : t.road - t.direction * 4, 0, t.horizontal ? t.road + t.direction * 4 : t.progress);
      t.group.rotation.y = t.horizontal ? -t.direction * Math.PI / 2 : t.direction === -1 ? 0 : Math.PI;
      trafficObstacles.push({ x: t.group.position.x, z: t.group.position.z, halfX: t.horizontal ? 2 : .9, halfZ: t.horizontal ? .9 : 2 });
    });
  }
  function draw(car: Vehicle, look: number, dusk: boolean, mirror?: { x: number; y: number; width: number; height: number }) {
    const bg = dusk ? "#7e8a9d" : "#b9d1d1";
    (scene.background as THREE.Color).set(bg); (scene.fog as THREE.Fog).color.set(bg);
    ambient.intensity = dusk ? 1.3 : 2.3; sun.intensity = dusk ? 1.8 : 3.1;
    camera.position.set(car.x, simulatorConfig.eyeHeight, car.z);
    camera.rotation.set(-.025, car.heading + look, 0, "YXZ");
    renderer.setViewport(0, 0, viewWidth, viewHeight);
    renderer.render(scene, camera);
    if (mirror) {
      rearCamera.position.copy(camera.position); rearCamera.rotation.set(0, car.heading + Math.PI, 0);
      rearCamera.aspect = mirror.width / mirror.height; rearCamera.updateProjectionMatrix();
      renderer.setScissorTest(true);
      renderer.setScissor(mirror.x, viewHeight - mirror.y - mirror.height, mirror.width, mirror.height);
      renderer.setViewport(mirror.x, viewHeight - mirror.y - mirror.height, mirror.width, mirror.height);
      renderer.render(scene, rearCamera); renderer.setScissorTest(false);
    }
  }
  return {
    renderer, obstacles, updateTraffic, draw,
    getTrafficObstacles: () => trafficObstacles,
    resize(w: number, h: number) { viewWidth = w; viewHeight = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); },
    dispose() {
      renderer.setAnimationLoop(null);
      const geometries = new Set<THREE.BufferGeometry>(), mats = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
      scene.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { mats.add(m); if (m.map) textures.add(m.map); }); } });
      geometries.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); renderer.dispose();
    },
  };
}

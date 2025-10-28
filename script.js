export default async function initScene(THREE, OrbitControls, canvasElement) {
  const CONFIG = {
    count: 0,
    sphereRadius: 120,
    minScale: 0.02,
    maxScale: 1.3,
    focusDistance: 18,
    fadeDistance: 60,
    tumbleSpeed: 0.0005,
  };

  const renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, CONFIG.sphereRadius * 1.4);

  const group = new THREE.Group();
  scene.add(group);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 10;
  controls.maxDistance = 600;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;

  const ambient = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambient);

  let images;
  try {
    const res = await fetch('images.json');
    images = await res.json();
    if (!Array.isArray(images)) throw new Error('images.json debe ser un array');
  } catch (err) {
    console.error('No se pudo cargar images.json:', err);
    images = [];
  }

  CONFIG.count = images.length;
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = '';

  const createPlaneForImage = (tex) => {
    const aspect = (tex.image && tex.image.width) ? tex.image.width / tex.image.height : 1;
    const baseSize = 10;
    const geometry = new THREE.PlaneGeometry(baseSize * aspect, baseSize);
    const material = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = 2 * Math.PI * Math.random();
    const r = CONFIG.sphereRadius * (0.6 + 0.8 * Math.random());
    mesh.position.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );
    mesh.rotation.set(Math.random() * 0.6 - 0.3, Math.random() * Math.PI, Math.random() * 0.2 - 0.1);
    mesh.userData = { baseSize: baseSize, aspect };
    mesh.scale.setScalar(CONFIG.minScale);
    group.add(mesh);
    return mesh;
  };

  const meshes = [];
  if (images.length === 0) {
    for (let i = 0; i < 40; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff'; ctx.font = '28px sans-serif';
      ctx.fillText('mensaje de prueba ' + (i+1), 20, 120);
      const tex = new THREE.CanvasTexture(canvas);
      meshes.push(createPlaneForImage(tex));
    }
  } else {
    for (let i = 0; i < images.length; i++) {
      const url = 'images/' + images[i];
      try {
        const tex = await new Promise((resolve, reject) => {
          loader.load(url, resolve, undefined, reject);
        });
        meshes.push(createPlaneForImage(tex));
      } catch (err) {
        console.warn('Error cargando', url, err);
      }
    }
  }

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    group.rotation.y += CONFIG.tumbleSpeed;
    for (const m of meshes) {
      const d = camera.position.distanceTo(m.position);
      const proximity = Math.max(0, (CONFIG.fadeDistance - d) / CONFIG.fadeDistance);
      const targetScale = CONFIG.minScale + (CONFIG.maxScale - CONFIG.minScale) * Math.pow(proximity, 1.6);
      const ns = THREE.MathUtils.lerp(m.scale.x, targetScale, 0.08);
      m.scale.setScalar(ns);

      const mat = m.material;
      const nearFactor = d < CONFIG.focusDistance ? 1 : THREE.MathUtils.clamp(1 - (d - CONFIG.focusDistance) / (CONFIG.fadeDistance - CONFIG.focusDistance), 0, 1);
      mat.opacity = THREE.MathUtils.lerp(mat.opacity ?? 0, nearFactor, 0.08);

      m.lookAt(camera.position);
    }
    controls.update();
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }, { passive: true });

  window.addEventListener('wheel', (e) => {
    const zoomAmount = e.deltaY * 0.02;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    camera.position.addScaledVector(dir, zoomAmount);
  }, { passive: true });

  animate();
}

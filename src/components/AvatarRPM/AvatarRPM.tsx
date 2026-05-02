'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

interface Props {
  avatarUrl: string;
  width?: number;
  height?: number;
}

export default function AvatarRPM({ avatarUrl, width = 260, height = 360 }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const modelRef     = useRef<THREE.Group | null>(null);
  const headBoneRef  = useRef<THREE.Object3D | null>(null);
  const mixerRef     = useRef<THREE.AnimationMixer | null>(null);
  const controlsRef  = useRef<OrbitControls | null>(null);
  const rafRef       = useRef<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setLoading(true);
    setError(false);

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    // ── Scene + camera ───────────────────────────────────────────────────────
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.01, 100);
    camera.position.set(0, 1.5, 2.8);
    camera.lookAt(0, 1.0, 0);

    // ── Lighting ─────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xfff4e8, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 5, 3);
    key.castShadow = true;
    key.shadow.mapSize.setScalar(1024);
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far  = 20;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8bb8f8, 0.42);
    fill.position.set(-3, 1, -2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffe5cc, 0.24);
    rim.position.set(0, -1, -3);
    scene.add(rim);

    // ── OrbitControls ────────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.1;
    controls.enableZoom     = true;
    controls.minDistance    = 1.2;
    controls.maxDistance    = 5.0;
    controls.target.set(0, 1.0, 0);
    controls.minPolarAngle  = Math.PI * 0.05;
    controls.maxPolarAngle  = Math.PI * 0.88;
    controls.update();
    controlsRef.current = controls;

    // ── GLB loader ───────────────────────────────────────────────────────────
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    // Append quality params to RPM URL for faster loads
    const url = avatarUrl.includes('?')
      ? avatarUrl
      : `${avatarUrl}?quality=medium&meshLod=1&textureSizeLimit=512`;

    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow    = true;
            child.receiveShadow = true;
            // Correct color space on all textures
            if (child.material instanceof THREE.MeshStandardMaterial) {
              if (child.material.map) child.material.map.colorSpace = THREE.SRGBColorSpace;
            }
          }
          // Grab head bone for idle head movement
          const n = child.name.toLowerCase();
          if (n === 'head' || n === 'head_01' || n === 'mixamorig:head' || n === 'mixamorig9:head') {
            headBoneRef.current = child;
          }
        });

        // Fit camera to loaded model
        const box    = new THREE.Box3().setFromObject(model);
        const size   = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const halfH  = size.y * 0.5;
        const dist   = size.y * 1.2;

        camera.position.set(center.x, center.y + halfH * 0.1, dist);
        camera.lookAt(center.x, center.y + halfH * 0.1, center.z);
        controls.target.set(center.x, center.y + halfH * 0.1, center.z);
        controls.minDistance = dist * 0.35;
        controls.maxDistance = dist * 2.4;
        controls.update();

        scene.add(model);
        modelRef.current = model;

        // Use built-in animations if present (e.g. RPM idle)
        if (gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(gltf.animations[0]).play();
          mixerRef.current = mixer;
        }

        setLoading(false);
      },
      undefined,
      () => {
        setLoading(false);
        setError(true);
      },
    );

    // ── RAF loop ──────────────────────────────────────────────────────────────
    let lastT = 0;
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      const now = performance.now() / 1000;
      const dt  = lastT > 0 ? Math.min(now - lastT, 0.05) : 0.016;
      lastT = now;

      controls.update();
      if (mixerRef.current) mixerRef.current.update(dt);

      // Procedural idle: gentle body sway + head look-around
      if (modelRef.current) {
        modelRef.current.position.y = Math.sin(now * 0.82) * 0.003;
      }
      if (headBoneRef.current) {
        headBoneRef.current.rotation.y = Math.sin(now * 0.38) * 0.055;
        headBoneRef.current.rotation.z = Math.sin(now * 0.27) * 0.016;
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      controls.dispose();
      dracoLoader.dispose();
      renderer.dispose();
      modelRef.current    = null;
      headBoneRef.current = null;
      mixerRef.current    = null;
      controlsRef.current = null;
    };
  }, [avatarUrl, width, height]);

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: 'block', borderRadius: 16, touchAction: 'none' }}
      />
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', borderRadius: 16,
          background: 'linear-gradient(135deg, #f0f4ff 0%, #fce4f0 100%)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 10, animation: 'spin 1.2s linear infinite' }}>⟳</div>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Зареждане на герой…</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', borderRadius: 16,
          background: '#fff1f2',
        }}>
          <span style={{ fontSize: 32 }}>😕</span>
          <span style={{ fontSize: 12, color: '#9f1239', marginTop: 6 }}>Грешка при зареждане</span>
        </div>
      )}
    </div>
  );
}

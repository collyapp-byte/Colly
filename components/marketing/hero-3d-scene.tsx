"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Billboard } from "@react-three/drei";
import Image from "next/image";
import { Suspense, useRef } from "react";
import * as THREE from "three";

function OrbitingIcon({ url, radius, speed, offset, tilt }: { url: string, radius: number, speed: number, offset: number, tilt: [number, number, number] }) {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ref.current) {
      // Move in a 2D circle within the tilted parent group
      ref.current.position.x = Math.cos(t * speed + offset) * radius;
      ref.current.position.y = Math.sin(t * speed + offset) * radius;
    }
  });

  return (
    // The outer group applies the unique 3D tilt to the orbit path
    <group rotation={tilt}>
      <group ref={ref}>
        <Billboard>
          {/* Ensure scale=0.4 for uniform size */}
          <primitive object={scene} scale={0.4} />
        </Billboard>
      </group>
    </group>
  );
}

export function Hero3DScene() {
  return (
    <div className="relative flex h-[350px] w-full max-w-md items-center justify-center lg:h-[450px]">

      <Canvas camera={{ position: [0, 0, 6], fov: 50 }} gl={{ alpha: true }} style={{ background: 'transparent' }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 10, 5]} intensity={2} />
        <Suspense fallback={null}>
          {/* 7 Icons, each with a completely different tilt to create a 3D atom effect */}
          <OrbitingIcon url="/i1.glb" radius={2.0} speed={0.6} offset={0} tilt={[0, 0, 0]} />
          <OrbitingIcon url="/i2.glb" radius={2.2} speed={-0.5} offset={0.8} tilt={[Math.PI / 3, Math.PI / 4, 0]} />
          <OrbitingIcon url="/i3.glb" radius={1.8} speed={0.7} offset={1.6} tilt={[-Math.PI / 4, 0, Math.PI / 3]} />
          <OrbitingIcon url="/i4.glb" radius={2.5} speed={-0.4} offset={2.4} tilt={[0, Math.PI / 2, Math.PI / 4]} />
          <OrbitingIcon url="/i5.glb" radius={2.1} speed={0.5} offset={3.2} tilt={[Math.PI / 6, -Math.PI / 3, 0]} />
          <OrbitingIcon url="/i6.glb" radius={2.3} speed={-0.6} offset={4.0} tilt={[-Math.PI / 2, 0, -Math.PI / 6]} />
          <OrbitingIcon url="/i7.glb" radius={1.9} speed={0.4} offset={4.8} tilt={[Math.PI / 4, Math.PI / 4, Math.PI / 4]} />
        </Suspense>
      </Canvas>

      {/* Center Logo - Huge and naked */}
      <div className="absolute z-10 flex items-center justify-center pointer-events-none">
        <Image
          src="/logo.png"
          alt="Colly Logo"
          width={160}
          height={160}
          className="object-contain drop-shadow-[0_0_30px_rgba(255,102,0,0.6)]"
        />
      </div>
    </div>
  );
}

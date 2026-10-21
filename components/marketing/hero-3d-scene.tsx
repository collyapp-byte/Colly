"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Billboard } from "@react-three/drei";
import Image from "next/image";
import { Suspense, useRef } from "react";
import * as THREE from "three";

function OrbitingIcon({ url, radius, speed, offset }: { url: string, radius: number, speed: number, offset: number }) {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ref.current) {
      // Move in an independent circle
      ref.current.position.x = Math.cos(t * speed + offset) * radius;
      ref.current.position.y = Math.sin(t * speed + offset) * radius;
      // A tiny bit of Z-wiggle to give it 3D depth
      ref.current.position.z = Math.sin(t * 2 + offset) * 0.3;
    }
  });

  return (
    <group ref={ref}>
      {/* Billboard ensures the icon always faces the camera */}
      <Billboard>
        <primitive object={scene} scale={0.4} />
      </Billboard>
    </group>
  );
}

export function Hero3DScene() {
  return (
    <div className="relative flex h-[350px] w-full max-w-md items-center justify-center lg:h-[450px]">

      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} gl={{ alpha: true }} style={{ background: 'transparent' }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 10, 5]} intensity={2} />
        <Suspense fallback={null}>
          {/* 4 Independent Icons orbiting at different speeds and distances */}
          <OrbitingIcon url="/icon1.glb" radius={2.0} speed={0.6} offset={0} />
          <OrbitingIcon url="/icon2.glb" radius={2.2} speed={-0.5} offset={1.5} />
          <OrbitingIcon url="/icon3.glb" radius={1.8} speed={0.7} offset={3.0} />
          <OrbitingIcon url="/icon4.glb" radius={2.1} speed={-0.4} offset={4.5} />
          {/* Removed icon5.glb as requested (likely the TikTok icon) */}
        </Suspense>
      </Canvas>

      {/* Center Logo - Larger, naked, glowing */}
      <div className="absolute z-10 flex items-center justify-center pointer-events-none">
        <Image
          src="/logo.png"
          alt="Colly Logo"
          width={180}
          height={180}
          className="object-contain drop-shadow-[0_0_30px_rgba(255,102,0,0.6)]"
        />
      </div>
    </div>
  );
}

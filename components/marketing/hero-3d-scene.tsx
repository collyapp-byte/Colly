"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, useGLTF } from "@react-three/drei";
import Image from "next/image";
import { Suspense, useRef } from "react";
import * as THREE from "three";

// 1. Load individual GLB model
function IconModel({ url, position }: { url: string, position: [number, number, number] }) {
  const { scene } = useGLTF(url);
  return (
    <Float speed={3} rotationIntensity={2} floatIntensity={2}>
      <primitive object={scene} scale={0.25} position={position} />
    </Float>
  );
}

// 2. Create the Orbiting Ring
function OrbitRing() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Rotate the entire group to create the orbit effect
      groupRef.current.rotation.y += delta * 0.3;
      groupRef.current.rotation.x += delta * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Positions array to space them in a circle */}
      <IconModel url="/icon1.glb" position={[1.5, 0, 0]} />
      <IconModel url="/icon2.glb" position={[-1.5, 0, 0]} />
      <IconModel url="/icon3.glb" position={[0, 1.5, 0]} />
      <IconModel url="/icon4.glb" position={[0, -1.5, 0]} />
      <IconModel url="/icon5.glb" position={[0, 0, 1.5]} />
    </group>
  );
}

export function Hero3DScene() {
  return (
    <div className="relative flex h-[300px] w-full max-w-md items-center justify-center lg:h-[400px]">

      {/* Real 3D Canvas */}
      <Canvas camera={{ position: [0, 0, 4.5], fov: 50 }} gl={{ alpha: true }} style={{ background: 'transparent' }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 10, 5]} intensity={2} />
        <Suspense fallback={null}>
          <OrbitRing />
        </Suspense>
      </Canvas>

      {/* Center Logo - HUGE, no white circle */}
      <div className="absolute z-10 flex items-center justify-center pointer-events-none">
        <Image
          src="/logo.png"
          alt="Colly Logo"
          width={120}
          height={120}
          className="object-contain drop-shadow-[0_0_30px_rgba(255,102,0,0.6)]"
        />
      </div>
    </div>
  );
}

"use client";
import { Canvas } from "@react-three/fiber";
import Image from "next/image";
import { Suspense } from "react";

export function Hero3DScene() {
  return (
    <div className="relative flex h-[350px] w-full max-w-md items-center justify-center lg:h-[450px]">

      <Canvas camera={{ position: [0, 0, 6], fov: 50 }} gl={{ alpha: true }} style={{ background: 'transparent' }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 10, 5]} intensity={2} />
        <Suspense fallback={null}>
          {/* Orbiting icons removed — the canvas stays as the 3D backdrop. */}
        </Suspense>
      </Canvas>

      {/* Center Logo - Huge and naked */}
      <div className="absolute z-10 flex items-center justify-center pointer-events-none">
        <Image
          src="/logo.png"
          alt="Colly Logo"
          width={300}
          height={300}
          className="object-contain drop-shadow-[0_0_30px_rgba(255,102,0,0.6)]"
        />
      </div>
    </div>
  );
}

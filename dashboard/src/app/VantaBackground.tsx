"use client";

import { useEffect, useRef } from "react";
import type { VantaEffect } from "vanta/dist/vanta.net.min";

export default function VantaBackground() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const effectRef = useRef<VantaEffect | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!containerRef.current || effectRef.current) return;
      const [{ default: CLOUDS }, THREE] = await Promise.all([
        import("vanta/dist/vanta.clouds.min"),
        import("three")
      ]);

      if (!isMounted || !containerRef.current) return;

      effectRef.current = CLOUDS({
        el: containerRef.current,
        THREE,
        skyColor: 0xfdf5fc,
        cloudColor: 0xf3cdde,
        cloudShadowColor: 0xc890c4,
        sunColor: 0xe3a9d6,
        sunGlareColor: 0xf6d6ea,
        sunlightColor: 0xf6d6ea,
        speed: 0.7
      });
    }

    init();

    return () => {
      isMounted = false;
      if (effectRef.current) {
        effectRef.current.destroy();
        effectRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      aria-hidden="true"
    />
  );
}

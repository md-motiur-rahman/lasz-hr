"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Crossfade transition between routes using opacity transition.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Start fade-out immediately on path change
    el.style.opacity = "0";
    el.style.transition = "opacity 220ms ease";

    // Next frame, fade-in
    const id = requestAnimationFrame(() => {
      el.style.opacity = "1";
    });

    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <div ref={containerRef} className="transition-opacity">
      {children}
    </div>
  );
}

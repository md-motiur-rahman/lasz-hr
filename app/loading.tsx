"use client";

import Logo from "@/components/Logo";

export default function Loading() {
  return (
    <div className="min-h-dvh grid place-items-center bg-white">
      <div
        className="flex flex-col items-center gap-5"
        role="status"
        aria-live="polite"
        aria-label="Loading LASZ HR"
      >
        <Logo width={172} height={40} className="lasz-loader-float drop-shadow-sm" />

        <div className="lasz-loader-bar relative w-56 h-1.5 rounded-full bg-neutral-200">
          <span className="bar h-full rounded-full" />
        </div>

        <p className="text-xs text-neutral-500 tracking-wide">Preparing your workspace…</p>
      </div>

      <style jsx global>{`
        .lasz-loader-float {
          animation: lasz-float 2.4s ease-in-out infinite;
          will-change: transform;
        }
        @keyframes lasz-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        .lasz-loader-bar { position: relative; overflow: hidden; }
        .lasz-loader-bar .bar {
          position: absolute;
          top: 0;
          left: -30%;
          width: 30%;
          background: #4F46E5; /* brand indigo */
          animation: lasz-indeterminate 1.2s ease-in-out infinite;
        }
        @keyframes lasz-indeterminate {
          0% { left: -30%; width: 30%; }
          50% { left: 25%; width: 50%; }
          100% { left: 100%; width: 30%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .lasz-loader-float,
          .lasz-loader-bar .bar { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

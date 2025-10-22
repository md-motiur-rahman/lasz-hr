"use client";

import React from "react";

export type LogoProps = {
  width?: number;
  height?: number;
  showWordmark?: boolean; // set to false for icon-only
  className?: string;
};

export default function Logo({ width = 172, height = 40, showWordmark = true, className }: LogoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 172 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="LASZ HR Logo"
      className={className}
    >
      {/* Emblem */}
      <rect x="0" y="6" width="30" height="30" rx="8" fill="#4F46E5" />
      {/* Stylized L */}
      <rect x="8" y="14" width="4" height="16" rx="2" fill="white" />
      <rect x="8" y="26" width="14" height="4" rx="2" fill="white" />
      {/* Accent dot */}
      <circle cx="26" cy="10" r="6" fill="#10B981" stroke="white" strokeWidth="2" />

      {showWordmark && (
        <text
          x="40"
          y="27"
          fill="#0F172A"
          fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial"
          fontWeight="700"
          fontSize="18"
          letterSpacing="0.5"
        >
          LASZ HR
        </text>
      )}
    </svg>
  );
}

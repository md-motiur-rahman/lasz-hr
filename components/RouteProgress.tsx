"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Lightweight route progress indicator driven by path changes
export default function RouteProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // When pathname changes, briefly show progress bar
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!loading) return null;
  return <div className="route-progress" />;
}

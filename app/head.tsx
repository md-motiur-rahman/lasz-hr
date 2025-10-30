export default function Head() {
  return (
    <>
      {/* Explicit favicon links (cache-busted) */}
      <link rel="icon" href="/favicon.ico?v=4" sizes="any" type="image/x-icon" />
      <link rel="shortcut icon" href="/favicon.ico?v=4" type="image/x-icon" />
      {/* SVG fallback if supported */}
      <link rel="icon" href="/favicon.svg?v=4" type="image/svg+xml" />
      {/* Apple touch icon placeholder if you add one later */}
      {/* <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" /> */}
      {/* Optional: Safari pinned tab (supply a monochrome SVG if desired) */}
      {/* <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#4f46e5" /> */}
    </>
  );
}

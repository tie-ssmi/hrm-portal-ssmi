// components/snowfall-effect.tsx
"use client";

import Snowfall from "react-snowfall";

export function SnowfallEffect() {
  return (
    <Snowfall
      color="#ffffff"
      snowflakeCount={40}
      style={{
        position: "fixed",

        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 50,
        pointerEvents: "none",
      }}
    />
  );
}

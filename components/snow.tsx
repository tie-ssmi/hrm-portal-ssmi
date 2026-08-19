// components/snowfall-effect.tsx
"use client";

import { useTheme } from "next-themes";
import Snowfall from "react-snowfall";

export function SnowfallEffect() {
  const { resolvedTheme } = useTheme();
  // #fffafa (snow white) is invisible against a light-mode white background —
  // use a darker, still icy-looking blue for light mode instead.
  const color = resolvedTheme === "dark" ? "#fffafa" : "#60a5fa";

  return (
    <Snowfall
      color={color}
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

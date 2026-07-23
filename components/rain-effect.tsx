"use client";

import { useEffect, useState } from "react";
import Snowfall from "react-snowfall";

// ຝົນ
export function RainEffect() {
  const [images, setImages] = useState<HTMLImageElement[]>([]);

  useEffect(() => {
    // ວາດເສັ້ນຍາວບາງໆ ແທນເມັດຫິມະ ໃຫ້ຄືເມັດຝົນ
    const canvas = document.createElement("canvas");
    canvas.width = 3;
    canvas.height = 20;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = "rgba(174, 210, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(1.5, 0);
      ctx.lineTo(1.5, 20);
      ctx.stroke();
    }

    const img = new Image();
    img.src = canvas.toDataURL();
    img.onload = () => setImages([img]);
  }, []);

  if (images.length === 0) return null;

  return (
    <Snowfall
      images={images}
      snowflakeCount={150}
      radius={[1, 5]} // ຂະໜາດຂອງເມັດຝົນ (px) - radius ຄວບຄຸມຂະໜາດແທ້ຈິງທີ່ແຕ້ມ
      speed={[8, 15]} // ໄວ, ຄືຝົນຕົກ
      wind={[-0.5, 1]} // ປັດເລັກນ້ອຍຕາມລົມ
      rotationSpeed={[0, 0]} // ບໍ່ໝູນ
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 1,
        pointerEvents: "none",
      }}
    />
  );
}

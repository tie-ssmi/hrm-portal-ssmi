"use client";

import { useEffect, useState } from "react";
import Snowfall from "react-snowfall";

// ຝົນ
export function RainEffect() {
  const [images, setImages] = useState<HTMLImageElement[]>([]);

  useEffect(() => {
    // ວາດເສັ້ນຍາວບາງໆ ໂຄ້ງໄປທາງດຽວກັບລົມ ພ້ອມ gradient ໃຫ້ຄືຮອຍເມັດຝົນຕົກແຮງ
    // (ເສັ້ນຊື່ໆ ບໍ່ມີ gradient/ມຸມແມ່ນເບິ່ງຄືເມັດຫິມະ ບໍ່ຄືຝົນ — rotationSpeed:[0,0]
    // ໝາຍວາມວ່າ sprite ບໍ່ໝູນຕາມທິດທາງ, ສະນັ້ນຕ້ອງແຕ້ມມຸມນັ້ນເຂົ້າໃນ sprite ເອງ
    // ໃຫ້ກົງກັບທິດ wind ທີ່ໃຊ້ຢູ່ລຸ່ມນີ້)
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 6, 40);
      gradient.addColorStop(0, "rgba(174, 210, 255, 0)");
      gradient.addColorStop(0.6, "rgba(174, 210, 255, 0.65)");
      gradient.addColorStop(1, "rgba(224, 238, 255, 0.9)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(1, 0);
      ctx.lineTo(6, 40);
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
      radius={[4, 9]} // ຂະໜາດຂອງເມັດຝົນ (px) - radius ຄວບຄຸມຂະໜາດແທ້ຈິງທີ່ແຕ້ມ
      speed={[12, 22]} // ໄວ, ຄືຝົນຕົກແຮງ
      wind={[0.6, 1.6]} // ປັດທາງດຽວກັນ ໃຫ້ກົງກັບມຸມທີ່ແຕ້ມໄວ້ໃນ sprite
      rotationSpeed={[0, 0]} // ບໍ່ໝູນ — ມຸມແມ່ນຢູ່ໃນ sprite ແລ້ວ
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

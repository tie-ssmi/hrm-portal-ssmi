// components/WeatherWidget.tsx
// Widget ສະແດງສະພາບອາກາດເທິງ dashboard HRM
// ເອີ້ນ Open-Meteo ຈາກ client ໂດຍກົງ — ໃຊ້ໄດ້ກັບ output: 'export' (ບໍ່ຕ້ອງມີ API route)
"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHRM } from "@/lib/hrm-context";

// Fallback ເມື່ອຫ້ອງການຂອງຜູ້ໃຊ້ຍັງບໍ່ໄດ້ຕັ້ງຄ່າພິກັດ GPS (ພິກັດຫຼວງພະບາງ) —
// ຕາມປົກກະຕິຈະໃຊ້ພິກັດຫ້ອງການຈິງຈາກ HRMContext.geoFence ແທນ, ອັນນີ້ຄືແຄ່ default.
const FALLBACK_LAT = 19.8845;
const FALLBACK_LNG = 102.1348;

// ອຸນຫະພູມ (°C) ຕ່ຳກວ່ານີ້ຈະສະແດງຄຳເຕືອນອາກາດໜາວ
const COLD_THRESHOLD = 15;

function buildWeatherUrl(lat: number, lng: number): string {
  return (
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}&longitude=${lng}` +
    "&current=temperature_2m,rain,precipitation,weather_code" +
    "&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min" +
    "&timezone=Asia/Vientiane&forecast_days=1"
  );
}

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    rain: number;
    precipitation: number;
    weather_code: number;
  };
  daily: {
    precipitation_probability_max: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

interface WeatherData {
  temperature: number;
  isRaining: boolean;
  rainChance: number;
  high: number;
  low: number;
  weatherCode: number;
}

// WMO weather codes → icon + ຄຳອະທິບາຍ
// ອ້າງອີງ: https://open-meteo.com/en/docs (WMO Weather interpretation codes)
function describeWeather(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: "☀️", label: "ແດດແຈ້ງ" };
  if (code <= 2) return { icon: "🌤️", label: "ມີເມກບາງສ່ວນ" };
  if (code === 3) return { icon: "☁️", label: "ເມກຫຼາຍ" };
  if (code <= 48) return { icon: "🌫️", label: "ໝອກລົງ" };
  if (code <= 57) return { icon: "🌦️", label: "ຝົນຄ່ອຍໆ" };
  if (code <= 67) return { icon: "🌧️", label: "ຝົນຕົກ" };
  if (code <= 77) return { icon: "🌨️", label: "ຫິມະຕົກ" };
  if (code <= 82) return { icon: "🌧️", label: "ຝົນຊູ່" };
  if (code <= 86) return { icon: "🌨️", label: "ຫິມະຊູ່" };
  return { icon: "⛈️", label: "ຝົນຟ້າຮ້ອງ" }; // 95–99
}

export default function WeatherWidget() {
  const { geoFence } = useHRM();
  const lat = geoFence?.lat ?? FALLBACK_LAT;
  const lng = geoFence?.lng ?? FALLBACK_LNG;

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch(buildWeatherUrl(lat, lng));
        if (!res.ok) throw new Error("ດຶງຂໍ້ມູນອາກາດບໍ່ສຳເລັດ");
        const data: OpenMeteoResponse = await res.json();

        if (active) {
          setWeather({
            temperature: data.current.temperature_2m,
            isRaining: data.current.rain > 0,
            rainChance: data.daily.precipitation_probability_max[0],
            high: data.daily.temperature_2m_max[0],
            low: data.daily.temperature_2m_min[0],
            weatherCode: data.current.weather_code,
          });
          setError(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        if (active) setError(message);
      }
    }

    load();
    // ໂຫຼດໃໝ່ທຸກ 10 ນາທີ
    const timer = setInterval(load, 10 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [lat, lng]);

  if (error) {
    return (
      <Card className="hidden border-destructive/30 bg-destructive/5 md:block">
        <CardContent className="flex items-center gap-2 py-4 text-sm">
          <AlertTriangle className="text-destructive h-4 w-4 shrink-0" />
          <span className="text-destructive">{error}</span>
        </CardContent>
      </Card>
    );
  }

  if (!weather) {
    return (
      <Card className="hidden md:block">
        <CardContent className="flex items-center gap-4 py-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const { icon, label } = describeWeather(weather.weatherCode);
  const isCold = weather.temperature < COLD_THRESHOLD;

  return (
    <Card className="hidden md:block">
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl leading-none">{icon}</span>
          <div>
            <p className="text-foreground text-2xl font-bold">
              {Math.round(weather.temperature)}°C
            </p>
            <p className="text-muted-foreground text-xs">
              {label}
              {weather.isRaining && " — ຢ່າລືມຄັນຮົ່ມ ☔"}
            </p>
            {isCold && (
              <p className="text-muted-foreground text-xs">
                🧥 ອາກາດໜາວ — ໃສ່ເສື້ອກັນໜາວເດີ
              </p>
            )}
          </div>
        </div>
        <div className="text-muted-foreground shrink-0 text-right text-xs">
          <p>ໂອກາດຝົນ {weather.rainChance}%</p>
          <p>
            ສູງສຸດ {Math.round(weather.high)}° / ຕ່ຳສຸດ{" "}
            {Math.round(weather.low)}°
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

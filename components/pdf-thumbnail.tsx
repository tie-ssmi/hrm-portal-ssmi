"use client";

import { useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function PdfThumbnail({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    if (!url) {
      setStatus("error");
      return;
    }

    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null =
      null;
    setStatus("loading");

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const pdf = await pdfjsLib.getDocument({ url }).promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = 300 / baseViewport.width;
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) setStatus("ready");
      } catch (err) {
        console.error(err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [url]);

  if (status === "error") {
    return (
      <div
        className={cn(
          "text-muted-foreground flex flex-col items-center justify-center gap-2 text-xs",
          className,
        )}
      >
        <FileText className="h-8 w-8" />
        ບໍ່ສາມາດສະແດງຕົວຢ່າງໄດ້
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {status === "loading" && (
        <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-xs">
          ກຳລັງໂຫຼດ...
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="h-full w-full object-cover object-top"
      />
    </div>
  );
}

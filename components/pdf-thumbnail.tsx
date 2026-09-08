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
  // surfaced in the error state on purpose: this renders on phones where the
  // console is out of reach, and a bare "preview failed" hid a real bug for a
  // long time.
  const [errorDetail, setErrorDetail] = useState("");

  useEffect(() => {
    if (!url) {
      setErrorDetail("no url");
      setStatus("error");
      return;
    }

    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null =
      null;
    setErrorDetail("");
    setStatus("loading");

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        // pdfjs-dist v6 fetches its decoders and font data at runtime instead
        // of bundling them. Leaving these unset makes every scanned PDF
        // (CCITTFax/JBIG2/JPX images) fail to render, so point them at the
        // copies scripts/copy-pdfjs-assets.js mirrors into public/pdfjs/.
        const pdf = await pdfjsLib.getDocument({
          url,
          wasmUrl: "/pdfjs/wasm/",
          standardFontDataUrl: "/pdfjs/standard_fonts/",
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          iccUrl: "/pdfjs/iccs/",
        }).promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) {
          setErrorDetail("canvas unavailable");
          setStatus("error");
          return;
        }

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = 300 / baseViewport.width;
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
        if (!cancelled) setStatus("ready");
      } catch (err) {
        console.error("[PdfThumbnail]", url, err);
        if (!cancelled) {
          setErrorDetail(
            err instanceof Error
              ? `${err.name}: ${err.message}`
              : String(err),
          );
          setStatus("error");
        }
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
        {errorDetail && (
          <span className="line-clamp-3 px-2 text-center text-[10px] break-all opacity-70">
            {errorDetail}
          </span>
        )}
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

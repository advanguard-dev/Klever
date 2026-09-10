import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

interface NoiseProps {
  patternSize?: number;
  patternScaleX?: number;
  patternScaleY?: number;
  patternRefreshInterval?: number;
  patternAlpha?: number;
}

/** React Bits Noise — TS + Tailwind. Paper grain overlay. */
export default function Noise({
  patternRefreshInterval = 8,
  patternAlpha = 10,
}: NoiseProps) {
  const grainRef = useRef<HTMLCanvasElement>(null);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = grainRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const canvasSize = 256;
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const drawGrain = () => {
      const imageData = ctx.createImageData(canvasSize, canvasSize);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const value = Math.random() * 255;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        data[i + 3] = patternAlpha;
      }
      ctx.putImageData(imageData, 0, 0);
    };

    drawGrain();
    if (reduce) return;

    let frame = 0;
    let animationId = 0;
    const loop = () => {
      if (frame % patternRefreshInterval === 0) drawGrain();
      frame += 1;
      animationId = window.requestAnimationFrame(loop);
    };
    animationId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(animationId);
  }, [patternRefreshInterval, patternAlpha, reduce]);

  return (
    <canvas
      ref={grainRef}
      aria-hidden="true"
      className="paper-grain pointer-events-none fixed inset-0 z-[2] h-full w-full mix-blend-multiply"
      style={{ imageRendering: "pixelated", opacity: 0.45 }}
    />
  );
}

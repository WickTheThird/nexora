import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

interface Props {
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}

// Plain-canvas signature pad with mouse + touch + stylus support. No external lib.
export function SignaturePad({ onChange, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const dirtyRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  // Resize the canvas to its DOM size on mount and when the window resizes.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const fit = () => {
      const rect = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      // Preserve existing drawing on resize: copy to a temp canvas first
      const snap = document.createElement("canvas");
      snap.width = c.width;
      snap.height = c.height;
      snap.getContext("2d")?.drawImage(c, 0, 0);
      c.width = Math.round(rect.width * dpr);
      c.height = Math.round(rect.height * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0F1722";
      // Paint white background (so exported PNG isn't transparent)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      if (hasInk) {
        ctx.drawImage(snap, 0, 0, rect.width, rect.height);
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const posOf = (e: PointerEvent | React.PointerEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = posOf(e);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    e.preventDefault();
    const c = canvasRef.current!;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const p = posOf(e);
    const last = lastRef.current!;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setHasInk(true);
    }
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
    if (dirtyRef.current) exportPng();
  };

  const exportPng = () => {
    const c = canvasRef.current;
    if (!c) return;
    // Crop to a reasonable size to keep under 200KB
    const off = document.createElement("canvas");
    const dpr = window.devicePixelRatio || 1;
    off.width = Math.round(c.width / dpr);
    off.height = Math.round(c.height / dpr);
    const octx = off.getContext("2d");
    if (!octx) return;
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, off.width, off.height);
    octx.drawImage(c, 0, 0, off.width, off.height);
    onChange(off.toDataURL("image/png"));
  };

  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    dirtyRef.current = false;
    setHasInk(false);
    onChange(null);
  };

  return (
    <div>
      <div className={`relative rounded-lg border-2 bg-white overflow-hidden ${
        disabled ? "border-ink-100" : "border-dashed border-ink-300"
      }`}>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          className={`block w-full h-40 ${disabled ? "cursor-not-allowed" : "cursor-crosshair"} touch-none`}
          style={{ touchAction: "none" }}
        />
        {!hasInk && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-ink-400">
            Sign here
          </div>
        )}
      </div>
      <div className="flex justify-between items-center mt-2">
        <div className="text-xs text-ink-500">
          Draw your signature with mouse, stylus, or finger.
        </div>
        <button
          type="button"
          className="btn-ghost !py-1 !px-2 !text-xs"
          onClick={clear}
          disabled={!hasInk || disabled}
        >
          <Eraser className="h-3.5 w-3.5" /> Clear
        </button>
      </div>
    </div>
  );
}

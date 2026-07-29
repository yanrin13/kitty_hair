import { useState, useRef, useEffect, useCallback } from "react";
import BlackBox from "./BlackBox.jsx";

const THRESHOLD = 1.0;

export default function App() {
  const [balls, setBalls] = useState([]);
  const [radius, setRadius] = useState(16);
  const [pet, setPet] = useState(1);
  const [isMobile, setIsMobile] = useState(false);

  const canvasRef = useRef(null);
  const squareRef = useRef(null);
  const ballsRef = useRef([]);
  const radiusRef = useRef(16);
  const draggingId = useRef(null);
  const offset = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const needsRedraw = useRef(true);

  useEffect(() => {
    ballsRef.current = balls;
    needsRedraw.current = true;
  }, [balls]);

  useEffect(() => {
    radiusRef.current = radius;
    needsRedraw.current = true;
  }, [radius]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const changePet = () => {
    setPet((prev) => (prev === 4 ? 1 : prev + 1));
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext("2d");

    const bg = new Image();
    bg.crossOrigin = "anonymous";
    bg.src = `/${pet}.png`;

    bg.onload = () => {
      const imgRatio = bg.width / bg.height;
      const canvasRatio = width / height;

      let sx, sy, sWidth, sHeight;
      if (imgRatio > canvasRatio) {
        sHeight = bg.height;
        sWidth = bg.height * canvasRatio;
        sx = (bg.width - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = bg.width;
        sHeight = bg.width / canvasRatio;
        sx = 0;
        sy = (bg.height - sHeight) / 2;
      }

      ctx.drawImage(bg, sx, sy, sWidth, sHeight, 0, 0, width, height);
      ctx.drawImage(canvas, 0, 0);

      exportCanvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cat-haircut-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    };
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!needsRedraw.current) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }
    needsRedraw.current = false;

    const ctx = canvas.getContext("2d", { alpha: true });
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const list = ballsRef.current;
    const R = radiusRef.current;

    if (list.length === 0) {
      rafRef.current = requestAnimationFrame(draw);
      return;
    }

    const step = isMobile ? 3 : 2;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        let sum = 0;
        for (const b of list) {
          const dx = x - b.x;
          const dy = y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            sum += 100;
            continue;
          }
          sum += (R * R) / d2;
        }

        if (sum >= THRESHOLD) {
          for (let sy = 0; sy < step && y + sy < height; sy++) {
            for (let sx = 0; sx < step && x + sx < width; sx++) {
              const i = ((y + sy) * width + (x + sx)) * 4;
              data[i] = 17;
              data[i + 1] = 17;
              data[i + 2] = 17;
              data[i + 3] = 255;
            }
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    rafRef.current = requestAnimationFrame(draw);
  }, [isMobile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const square = squareRef.current;
    if (!canvas || !square) return;

    const resize = () => {
      const rect = square.getBoundingClientRect();
      const dpr = isMobile
        ? Math.min(window.devicePixelRatio || 1, 1.5)
        : window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";

      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      needsRedraw.current = true;
    };

    resize();
    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [draw, isMobile]);

  const getLocalPos = (e) => {
    const rect = squareRef.current.getBoundingClientRect();

    const clientX = e.clientX;
    const clientY = e.clientY;

    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleMove = useCallback((e) => {
    if (draggingId.current == null) return;
    e.preventDefault();
    const { x, y } = getLocalPos(e);
    setBalls((prev) =>
      prev.map((b) =>
        b.id === draggingId.current
          ? { ...b, x: x - offset.current.x, y: y - offset.current.y }
          : b,
      ),
    );
  }, []);

  const endDrag = useCallback(() => {
    draggingId.current = null;
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  }, [handleMove]);

  const startDrag = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    draggingId.current = id;
    const ball = ballsRef.current.find((b) => b.id === id);
    if (!ball) return;
    const { x, y } = getLocalPos(e);
    offset.current = { x: x - ball.x, y: y - ball.y };

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  };

  const onPointerDown = (e, allowCreate) => {
    e.preventDefault();
    const { x, y } = getLocalPos(e);
    const list = ballsRef.current;
    const R = radiusRef.current;

    const hit = list.find((b) => {
      const dx = x - b.x;
      const dy = y - b.y;
      return dx * dx + dy * dy <= R * R * 1.8;
    });

    if (hit) {
      startDrag(hit.id, e);
      return;
    }

    if (!allowCreate) return;

    const id = Date.now() + Math.random();
    setBalls((prev) => [...prev, { id, x, y }]);
    draggingId.current = id;
    offset.current = { x: 0, y: 0 };

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "#f5f5f5",
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
        touchAction: "none",
      }}
    >
      <header
        style={{
          padding: isMobile ? "14px 16px 10px" : "24px 32px 16px",
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: isMobile ? "1.35rem" : "1.75rem",
            fontWeight: 600,
          }}
        >
          cat haircut
        </h1>
      </header>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 12 : 24,
          padding: isMobile ? "0 12px 12px" : "0 32px 32px",
          minHeight: 0,
          overflowY: isMobile ? "auto" : "hidden",
        }}
      >
        <div
          style={{
            flex: isMobile ? "0 0 auto" : "0 0 28%",
            borderRadius: 12,
            overflow: "hidden",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: isMobile ? "140px" : "100%",
            minHeight: isMobile ? "140px" : 0,
          }}
        >
          <img
            src="/5.png"
            alt="left"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>

        <div
          ref={squareRef}
          style={{
            flex: isMobile ? "0 0 auto" : "0 0 40%",
            width: isMobile ? "100%" : undefined,
            aspectRatio: "1 / 1",
            position: "relative",
            borderRadius: 12,
            overflow: "hidden",
            border: "5px solid #9A3B6D",
            maxWidth: isMobile ? "100%" : undefined,
            alignSelf: isMobile ? "center" : undefined,
            touchAction: "none",
          }}
        >
          <img
            src={`/${pet}.png`}
            alt="bg"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
          <canvas
            ref={canvasRef}
            onPointerDown={(e) => onPointerDown(e, false)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              zIndex: 1,
              cursor: "crosshair",
              touchAction: "none",
            }}
          />

          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              right: 16,
              zIndex: 2,
              width: "auto",
            }}
            onPointerDown={(e) => onPointerDown(e, true)}
          >
            <div style={{ width: "100%" }}>
              <BlackBox />
            </div>
          </div>
        </div>

        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: isMobile ? "row" : "column",
            gap: 12,
            justifyContent: isMobile ? "center" : "flex-start",
            alignItems: isMobile ? "center" : "stretch",
            paddingTop: isMobile ? 4 : 8,
            flexWrap: "wrap",
          }}
        >
          <button
            style={{
              padding: 12,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
            onClick={changePet}
          >
            <img src="/paw-icon.svg" style={{ minWidth: 35 }} alt="change" />
          </button>

          <button
            style={{
              padding: 12,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
            onClick={handleSave}
          >
            <img src="/save-icon.svg" style={{ minWidth: 35 }} alt="save" />
          </button>

          <div
            style={{
              marginTop: isMobile ? 0 : 16,
              width: isMobile ? "100%" : "auto",
              minWidth: isMobile ? 150 : undefined,
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "0.85rem",
                color: "#555",
                marginBottom: 6,
                textAlign: isMobile ? "center" : "left",
              }}
            >
              Radius: {radius}
            </label>
            <input
              type="range"
              min={6}
              max={isMobile ? 28 : 48}
              step={1}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              style={{
                width: "100%",
                cursor: "pointer",
                accentColor: "#9A3B6D",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

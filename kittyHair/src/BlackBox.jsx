import React, { useEffect, useRef } from "react";

function BlackBox({ pixelSize = 2 }) {
  const buttonRef = useRef(null);
  const canvasRef = useRef(null);

  // https://codepen.io/waaark/pen/VbgwEM

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const pointsA = [];
    const pointsB = [];
    let canvas = null;
    let context = null;
    let offscreen = null;
    let offCtx = null;
    let rafID = null;

    const points = 8;
    const viscosity = 20;
    const mouseDist = 70;
    const damping = 0.05;
    const showIndicators = false;

    let mouseX = 0;
    let mouseY = 0;
    let relMouseX = 0;
    let relMouseY = 0;
    let mouseLastX = 0;
    let mouseLastY = 0;
    let mouseDirectionX = 0;
    let mouseDirectionY = 0;
    let mouseSpeedX = 0;
    let mouseSpeedY = 0;

    function mouseDirection(e) {
      if (mouseX < e.pageX) mouseDirectionX = 1;
      else if (mouseX > e.pageX) mouseDirectionX = -1;
      else mouseDirectionX = 0;

      if (mouseY < e.pageY) mouseDirectionY = 1;
      else if (mouseY > e.pageY) mouseDirectionY = -1;
      else mouseDirectionY = 0;

      mouseX = e.pageX;
      mouseY = e.pageY;

      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      relMouseX = mouseX - (rect.left + window.scrollX);
      relMouseY = mouseY - (rect.top + window.scrollY);
    }

    function mouseSpeed() {
      mouseSpeedX = mouseX - mouseLastX;
      mouseSpeedY = mouseY - mouseLastY;
      mouseLastX = mouseX;
      mouseLastY = mouseY;
      speedTimeout = setTimeout(mouseSpeed, 50);
    }
    let speedTimeout = setTimeout(mouseSpeed, 50);

    function Point(x, y, level) {
      this.x = this.ix = 50 + x;
      this.y = this.iy = 50 + y;
      this.vx = 0;
      this.vy = 0;
      this.cx1 = 0;
      this.cy1 = 0;
      this.cx2 = 0;
      this.cy2 = 0;
      this.level = level;
    }

    Point.prototype.move = function () {
      this.vx += (this.ix - this.x) / (viscosity * this.level);
      this.vy += (this.iy - this.y) / (viscosity * this.level);

      const dx = this.ix - relMouseX;
      const dy = this.iy - relMouseY;
      const relDist = 1 - Math.sqrt(dx * dx + dy * dy) / mouseDist;

      if (
        (mouseDirectionX > 0 && relMouseX > this.x) ||
        (mouseDirectionX < 0 && relMouseX < this.x)
      ) {
        if (relDist > 0 && relDist < 1) {
          this.vx = (mouseSpeedX / 4) * relDist;
        }
      }
      this.vx *= 1 - damping;
      this.x += this.vx;

      if (
        (mouseDirectionY > 0 && relMouseY > this.y) ||
        (mouseDirectionY < 0 && relMouseY < this.y)
      ) {
        if (relDist > 0 && relDist < 1) {
          this.vy = (mouseSpeedY / 4) * relDist;
        }
      }
      this.vy *= 1 - damping;
      this.y += this.vy;
    };

    function addPoints(x, y) {
      pointsA.push(new Point(x, y, 1));
      pointsB.push(new Point(x, y, 2));
    }

    function initButton() {
      const buttonWidth = button.offsetWidth;
      const buttonHeight = button.offsetHeight;

      canvas = document.createElement("canvas");
      canvas.width = buttonWidth + 100;
      canvas.height = buttonHeight + 100;
      canvas.style.cssText =
        "position:absolute;top:-50px;left:-50px;right:-50px;bottom:-50px;z-index:1;pointer-events:none;";
      button.appendChild(canvas);
      canvasRef.current = canvas;
      context = canvas.getContext("2d");

      offscreen = document.createElement("canvas");
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      offCtx = offscreen.getContext("2d");

      const x = buttonHeight / 2;
      for (let j = 1; j < points; j++) {
        addPoints(x + ((buttonWidth - buttonHeight) / points) * j, 0);
      }
      addPoints(buttonWidth - buttonHeight / 5, 0);
      addPoints(buttonWidth + buttonHeight / 10, buttonHeight / 2);
      addPoints(buttonWidth - buttonHeight / 5, buttonHeight);
      for (let j = points - 1; j > 0; j--) {
        addPoints(
          x + ((buttonWidth - buttonHeight) / points) * j,
          buttonHeight,
        );
      }
      addPoints(buttonHeight / 5, buttonHeight);
      addPoints(-buttonHeight / 10, buttonHeight / 2);
      addPoints(buttonHeight / 5, 0);

      renderCanvas();
    }

    function renderCanvas() {
      rafID = requestAnimationFrame(renderCanvas);

      const w = offscreen.width;
      const h = offscreen.height;

      offCtx.clearRect(0, 0, w, h);

      for (let i = 0; i < pointsA.length; i++) {
        pointsA[i].move();
        pointsB[i].move();
      }

      const rect = canvas.getBoundingClientRect();
      const gradientX = Math.min(
        Math.max(mouseX - (rect.left + window.scrollX), 0),
        w,
      );
      const gradientY = Math.min(
        Math.max(mouseY - (rect.top + window.scrollY), 0),
        h,
      );
      const distance =
        Math.sqrt(
          Math.pow(gradientX - w / 2, 2) + Math.pow(gradientY - h / 2, 2),
        ) / Math.sqrt(Math.pow(w / 2, 2) + Math.pow(h / 2, 2));

      const gradient = offCtx.createRadialGradient(
        gradientX,
        gradientY,
        300 + 300 * distance,
        gradientX,
        gradientY,
        0,
      );
      gradient.addColorStop(0, "#242424");
      gradient.addColorStop(1, "#000000");

      const groups = [pointsA, pointsB];

      for (let j = 0; j <= 1; j++) {
        const pts = groups[j];
        offCtx.fillStyle = j === 0 ? "#000000" : gradient;

        offCtx.beginPath();
        offCtx.moveTo(pts[0].x, pts[0].y);

        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          let nextP = pts[i + 1];

          if (nextP !== undefined) {
            p.cx1 = (p.x + nextP.x) / 2;
            p.cy1 = (p.y + nextP.y) / 2;
            p.cx2 = (p.x + nextP.x) / 2;
            p.cy2 = (p.y + nextP.y) / 2;
            offCtx.bezierCurveTo(p.x, p.y, p.cx1, p.cy1, p.cx1, p.cy1);
          } else {
            nextP = pts[0];
            p.cx1 = (p.x + nextP.x) / 2;
            p.cy1 = (p.y + nextP.y) / 2;
            offCtx.bezierCurveTo(p.x, p.y, p.cx1, p.cy1, p.cx1, p.cy1);
          }
        }
        offCtx.fill();
      }

      if (showIndicators) {
        offCtx.fillStyle = "#000";
        offCtx.beginPath();
        for (let i = 0; i < pointsA.length; i++) {
          const p = pointsA[i];
          offCtx.rect(p.x - 1, p.y - 1, 2, 2);
        }
        offCtx.fill();
      }

      const ps = Math.max(1, pixelSize | 0);

      if (ps <= 1) {
        context.clearRect(0, 0, w, h);
        context.drawImage(offscreen, 0, 0);
      } else {
        const sw = Math.ceil(w / ps);
        const sh = Math.ceil(h / ps);

        const tiny = document.createElement("canvas");
        tiny.width = sw;
        tiny.height = sh;
        const tinyCtx = tiny.getContext("2d");

        tinyCtx.imageSmoothingEnabled = false;
        tinyCtx.drawImage(offscreen, 0, 0, sw, sh);

        context.clearRect(0, 0, w, h);
        context.imageSmoothingEnabled = false;
        context.mozImageSmoothingEnabled = false;
        context.webkitImageSmoothingEnabled = false;
        context.msImageSmoothingEnabled = false;

        context.drawImage(tiny, 0, 0, sw, sh, 0, 0, w, h);
      }
    }

    document.addEventListener("mousemove", mouseDirection);
    initButton();

    return () => {
      document.removeEventListener("mousemove", mouseDirection);
      clearTimeout(speedTimeout);
      if (rafID) cancelAnimationFrame(rafID);
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }, [pixelSize]);

  return (
    <div
      ref={buttonRef}
      className="btn-liquid"
      style={{
        display: "block",
        position: "relative",
        width: "100%",
        height: 40,
        background: "transparent",
      }}
    >
      <span style={{ position: "relative", zIndex: 2 }} />
    </div>
  );
}

export default BlackBox;

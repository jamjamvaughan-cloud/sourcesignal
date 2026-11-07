"use client";

import * as React from "react";

interface MousePos {
  x: number;
  y: number;
}

export function SpatialHeroCanvas({
  className = "",
}: {
  className?: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animationRef = React.useRef<number>(null);
  const mouse = React.useRef<MousePos>({ x: 0, y: 0 });
  const width = React.useRef(0);
  const height = React.useRef(0);

  const nodes = React.useMemo(() => {
    const count = 46;
    const arr: Array<{
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      radius: number;
      opacity: number;
      angle: number;
      speed: number;
    }> = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: Math.random(),
        y: Math.random(),
        z: Math.random(),
        vx: (Math.random() - 0.5) * 0.0004,
        vy: (Math.random() - 0.5) * 0.0004,
        radius: 0.6 + Math.random() * 1.4,
        opacity: 0.15 + Math.random() * 0.35,
        angle: Math.random() * Math.PI * 2,
        speed: 0.0002 + Math.random() * 0.0006,
      });
    }
    return arr;
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      width.current = canvas.clientWidth;
      height.current = canvas.clientHeight;
      canvas.width = width.current * dpr;
      canvas.height = height.current * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const onMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current.x = (event.clientX - rect.left) / width.current;
      mouse.current.y = (event.clientY - rect.top) / height.current;
    };
    window.addEventListener("mousemove", onMouseMove);

    let time = 0;
    const draw = (t: number) => {
      const dt = t - time;
      time = t;

      ctx.clearRect(0, 0, width.current, height.current);

      // Ambient grid — white, subtle
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 0.5;
      const gridSize = 64;
      const offsetX = (time * 0.05) % gridSize;
      const offsetY = (time * 0.03) % gridSize;

      ctx.beginPath();
      for (let x = -gridSize; x < width.current; x += gridSize) {
        ctx.moveTo(x + offsetX, 0);
        ctx.lineTo(x + offsetX, height.current);
      }
      for (let y = -gridSize; y < height.current; y += gridSize) {
        ctx.moveTo(0, y + offsetY);
        ctx.lineTo(width.current, y + offsetY);
      }
      ctx.stroke();

      // Scanning laser sweep lines — white, react to mouse
      const sweepCount = 3;
      for (let s = 0; s < sweepCount; s++) {
        const phase = (time * 0.0008 + s * 2) % 1;
        const angle = phase * Math.PI * 2;
        const originX = width.current * mouse.current.x;
        const originY = height.current * mouse.current.y;
        const endX =
          originX + Math.cos(angle) * Math.max(width.current, height.current);
        const endY =
          originY + Math.sin(angle) * Math.max(width.current, height.current);

        const grad = ctx.createLinearGradient(originX, originY, endX, endY);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(0.3, "rgba(255,255,255,0.18)");
        grad.addColorStop(0.6, "rgba(255,255,255,0.05)");
        grad.addColorStop(1, "rgba(255,255,255,0)");

        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(originX, originY, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Floating coordinate nodes — white
      nodes.forEach((node) => {
        const parallaxStrength = 1 - node.z;
        const nx =
          node.x * width.current +
          mouse.current.x * 40 * parallaxStrength +
          Math.sin(time * node.speed + node.angle) * 12;
        const ny =
          node.y * height.current +
          mouse.current.y * 30 * parallaxStrength +
          Math.cos(time * node.speed * 0.7 + node.angle) * 8;

        node.x += node.vx * dt;
        node.y += node.vy * dt;
        if (node.x < 0) node.x = 1;
        if (node.x > 1) node.x = 0;
        if (node.y < 0) node.y = 1;
        if (node.y > 1) node.y = 0;

        const pulse = 0.5 + 0.5 * Math.sin(time * 0.002 + node.angle);
        const opacity = node.opacity * (0.5 + pulse * 0.5);

        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(nx, ny, node.radius, 0, Math.PI * 2);
        ctx.fill();

        nodes.forEach((other) => {
          const dx =
            nx -
            (other.x * width.current +
              mouse.current.x * 40 * (1 - other.z));
          const dy =
            ny -
            (other.y * height.current +
              mouse.current.y * 30 * (1 - other.z));
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 * (1 - dist / 140)})`;
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.moveTo(nx, ny);
            ctx.lineTo(
              other.x * width.current +
                mouse.current.x * 40 * (1 - other.z),
              other.y * height.current +
                mouse.current.y * 30 * (1 - other.z)
            );
            ctx.stroke();
          }
        });
      });

      // Crosshair reticle at mouse — white
      const rx = width.current * mouse.current.x;
      const ry = height.current * mouse.current.y;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx - 12, ry);
      ctx.lineTo(rx + 12, ry);
      ctx.moveTo(rx, ry - 12);
      ctx.lineTo(rx, ry + 12);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [nodes]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      aria-hidden="true"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

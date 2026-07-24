import { useEffect, useRef } from "react";

type RGB = { r: number; g: number; b: number };

type Letter = {
  char: string;
  color: RGB;
  startColor: RGB;
  targetColor: RGB;
  progress: number;
};

type Props = {
  glitchColors?: string[];
  glitchSpeed?: number;
  centerVignette?: boolean;
  outerVignette?: boolean;
  smooth?: boolean;
};

const symbols = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789";
const fontSize = 16;
const charWidth = 10;
const charHeight = 20;

function parseColor(value: string): RGB | null {
  const hex = value.trim().replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(hex)) {
    return {
      r: Number.parseInt(hex[0] + hex[0], 16),
      g: Number.parseInt(hex[1] + hex[1], 16),
      b: Number.parseInt(hex[2] + hex[2], 16),
    };
  }
  if (/^[\da-f]{6}$/i.test(hex)) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
}

function interpolate(start: RGB, end: RGB, factor: number): RGB {
  return {
    r: Math.round(start.r + (end.r - start.r) * factor),
    g: Math.round(start.g + (end.g - start.g) * factor),
    b: Math.round(start.b + (end.b - start.b) * factor),
  };
}

function asCss(color: RGB) {
  return `rgb(${color.r} ${color.g} ${color.b})`;
}

export default function LetterGlitch({
  glitchColors = ["#446e91", "#76a4ff", "#1a2338"],
  glitchSpeed = 45,
  centerVignette = false,
  outerVignette = true,
  smooth = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const palette = glitchColors.map(parseColor).filter((color): color is RGB => Boolean(color));
    if (palette.length === 0) palette.push({ r: 118, g: 164, b: 255 });

    let letters: Letter[] = [];
    let columns = 0;
    let animationFrame = 0;
    let lastUpdate = performance.now();
    let isVisible = !document.hidden;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const randomCharacter = () => symbols[Math.floor(Math.random() * symbols.length)];
    const randomColor = () => palette[Math.floor(Math.random() * palette.length)];

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      context.clearRect(0, 0, rect.width, rect.height);
      context.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      context.textBaseline = "top";

      letters.forEach((letter, index) => {
        const x = (index % columns) * charWidth;
        const y = Math.floor(index / columns) * charHeight;
        context.fillStyle = asCss(letter.color);
        context.fillText(letter.char, x, y);
      });
    };

    const initialise = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      columns = Math.max(1, Math.ceil(rect.width / charWidth));
      const rows = Math.max(1, Math.ceil(rect.height / charHeight));
      letters = Array.from({ length: columns * rows }, () => {
        const color = randomColor();
        return {
          char: randomCharacter(),
          color: { ...color },
          startColor: { ...color },
          targetColor: { ...randomColor() },
          progress: 1,
        };
      });
      draw();
    };

    const mutate = () => {
      const updates = Math.max(1, Math.floor(letters.length * 0.045));
      for (let index = 0; index < updates; index += 1) {
        const letter = letters[Math.floor(Math.random() * letters.length)];
        if (!letter) continue;
        letter.char = randomCharacter();
        letter.startColor = { ...letter.color };
        letter.targetColor = { ...randomColor() };
        letter.progress = smooth ? 0 : 1;
        if (!smooth) letter.color = { ...letter.targetColor };
      }
    };

    const animate = (timestamp: number) => {
      if (!isVisible) return;

      if (timestamp - lastUpdate >= Math.max(16, glitchSpeed)) {
        mutate();
        lastUpdate = timestamp;
      }

      if (smooth) {
        for (const letter of letters) {
          if (letter.progress >= 1) continue;
          letter.progress = Math.min(1, letter.progress + 0.08);
          letter.color = interpolate(letter.startColor, letter.targetColor, letter.progress);
        }
      }

      draw();
      animationFrame = requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(initialise);
    resizeObserver.observe(parent);
    initialise();

    if (!reduceMotion) {
      animationFrame = requestAnimationFrame(animate);
    }

    const handleVisibility = () => {
      isVisible = !document.hidden;
      if (isVisible && !reduceMotion) {
        cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(animate);
      } else {
        cancelAnimationFrame(animationFrame);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [glitchColors, glitchSpeed, smooth]);

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "var(--background)" }}>
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
      {outerVignette && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle, rgba(var(--background-rgb), 0) 50%, rgba(var(--background-rgb), 1) 100%)",
          }}
        />
      )}
      {centerVignette && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,_rgba(0,0,0,0.75)_0%,_rgba(0,0,0,0)_62%)]"
        />
      )}
    </div>
  );
}

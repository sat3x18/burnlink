import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
}

interface EmberParticlesProps {
  className?: string;
  intensity?: "low" | "medium" | "high";
  active?: boolean;
}

export function EmberParticles({ 
  className, 
  intensity = "medium",
  active = true 
}: EmberParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();

  const intensityConfig = {
    low: { count: 15, spawnRate: 0.02 },
    medium: { count: 30, spawnRate: 0.05 },
    high: { count: 50, spawnRate: 0.1 },
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resize();
    window.addEventListener("resize", resize);

    const config = intensityConfig[intensity];

    const createParticle = (): Particle => ({
      x: Math.random() * canvas.offsetWidth,
      y: canvas.offsetHeight + 10,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -Math.random() * 2 - 1,
      size: Math.random() * 3 + 1,
      alpha: Math.random() * 0.5 + 0.5,
      decay: Math.random() * 0.01 + 0.005,
    });

    const animate = () => {
      if (!active) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Spawn new particles
      if (Math.random() < config.spawnRate && particlesRef.current.length < config.count) {
        particlesRef.current.push(createParticle());
      }

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.alpha -= particle.decay;
        particle.vx += (Math.random() - 0.5) * 0.1;

        if (particle.alpha <= 0) return false;

        // Draw ember
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size
        );
        gradient.addColorStop(0, `hsla(25, 95%, 60%, ${particle.alpha})`);
        gradient.addColorStop(0.5, `hsla(25, 95%, 53%, ${particle.alpha * 0.6})`);
        gradient.addColorStop(1, `hsla(15, 90%, 45%, 0)`);

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        return true;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [intensity, active]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

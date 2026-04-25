"use client";

export default function EarthGlobe({ size = 120 }: { size?: number }) {
  return (
    <div
      className="float-globe relative select-none pointer-events-none shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Outer atmospheric glow */}
      <div
        className="earth-glow absolute rounded-full"
        style={{
          inset: -size * 0.15,
          background: "radial-gradient(circle, rgba(88,129,87,0.3) 0%, transparent 70%)",
          filter: `blur(${size * 0.14}px)`,
        }}
      />

      {/* The sphere — border-radius:50% + overflow:hidden clips everything inside to a circle */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          overflow: "hidden",
          boxShadow: `
            inset -${size * 0.14}px -${size * 0.07}px ${size * 0.22}px rgba(0,0,0,0.5),
            inset ${size * 0.05}px ${size * 0.05}px ${size * 0.14}px rgba(255,255,255,0.1)
          `,
        }}
      >
        {/* Scrolling texture — width:200% so one full copy is always visible while it scrolls */}
        <div
          className="earth-spin"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "200%",
            height: "100%",
            backgroundImage:
              "url('https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1280px-Blue_Marble_2002.png')",
            backgroundSize: "50% 100%",   /* each tile = half the div = exactly 100% of the sphere */
            backgroundRepeat: "repeat-x",
          }}
        />

        {/* Atmosphere tint */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: `
              radial-gradient(circle at 35% 35%, rgba(163,177,138,0.15) 0%, transparent 60%),
              radial-gradient(circle at 70% 70%, rgba(52,78,65,0.2) 0%, transparent 50%)
            `,
          }}
        />

        {/* Specular highlight */}
        <div
          style={{
            position: "absolute",
            top: "8%",
            left: "10%",
            width: "38%",
            height: "32%",
            background: "radial-gradient(ellipse, rgba(255,255,255,0.25) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Orbit ring */}
      <div
        className="orbit-ring absolute"
        style={{
          width: size * 1.6,
          height: size * 1.6,
          top: "50%",
          left: "50%",
          marginTop: -(size * 1.6) / 2,
          marginLeft: -(size * 1.6) / 2,
          border: "1.5px solid rgba(88,129,87,0.4)",
          borderRadius: "50%",
        }}
      />

      {/* Orbit dot */}
      <div
        className="orbit-dot absolute"
        style={{
          width: 7,
          height: 7,
          top: "50%",
          left: "50%",
          marginTop: -3.5,
          marginLeft: -3.5,
          background: "#A3B18A",
          borderRadius: "50%",
          boxShadow: "0 0 6px 2px rgba(163,177,138,0.7)",
        }}
      />
    </div>
  );
}

/**
 * Blueprint-style category artwork rendered as inline SVG —
 * no external image dependencies, crisp at any size.
 */
const STYLES: Record<string, { stroke: string; label: string }> = {
  Rifles: { stroke: "#f59e0b", label: "RFL" },
  Pistols: { stroke: "#a9b97c", label: "PST" },
  Shotguns: { stroke: "#f59e0b", label: "SHT" },
  Optics: { stroke: "#a9b97c", label: "OPT" },
  Ammunition: { stroke: "#f59e0b", label: "AMO" },
  Blades: { stroke: "#a9b97c", label: "BLD" },
  Gear: { stroke: "#f59e0b", label: "GEAR" },
};

function Shapes({ category }: { category: string }) {
  const s = { stroke: "currentColor", strokeWidth: 3, fill: "none", strokeLinejoin: "round" as const };
  switch (category) {
    case "Rifles":
      return (
        <g {...s}>
          <path d="M40 105 H250" />
          <path d="M95 95 H250 V115 H95 Z" />
          <path d="M250 90 H310 V120 H250 Z" />
          <path d="M310 96 L365 88 V124 L310 114" />
          <path d="M262 120 L282 120 L274 158 L254 158 Z" />
          <path d="M214 115 L236 115 L230 152 L208 152 Z" />
          <path d="M258 78 H300 V90 H258 Z" />
          <circle cx="279" cy="84" r="0" />
        </g>
      );
    case "Pistols":
      return (
        <g {...s}>
          <path d="M95 78 H305 V112 H95 Z" />
          <path d="M115 78 V70 H135 V78" />
          <path d="M270 78 V70 H286 V78" />
          <path d="M140 112 H210 L196 176 H120 Z" />
          <path d="M212 112 H262 V134 H212" />
          <path d="M150 132 H185" />
        </g>
      );
    case "Shotguns":
      return (
        <g {...s}>
          <path d="M45 92 H300" />
          <path d="M45 104 H290" />
          <path d="M110 104 H180 V128 H110 Z" />
          <path d="M290 86 H330 V116 H290 Z" />
          <path d="M330 92 L370 86 V122 L330 114" />
          <path d="M300 116 L322 116 L314 150 L292 150 Z" />
        </g>
      );
    case "Optics":
      return (
        <g {...s}>
          <path d="M95 84 H300 Q318 84 318 102 V118 Q318 136 300 136 H95 Q77 136 77 118 V102 Q77 84 95 84 Z" />
          <path d="M55 74 H88 V146 H55 Q44 146 44 134 V86 Q44 74 55 74 Z" />
          <path d="M170 84 V66 H214 V84" />
          <circle cx="192" cy="58" r="12" />
          <path d="M150 136 V160 H176 V136" />
          <path d="M244 136 V160 H270 V136" />
        </g>
      );
    case "Ammunition":
      return (
        <g {...s}>
          <path d="M110 96 H290 V176 H110 Z" />
          <path d="M110 96 L134 68 H266 L290 96" />
          <path d="M136 68 V44 H158 V68" />
          <path d="M180 68 V36 H202 V68" />
          <path d="M224 68 V44 H246 V68" />
          <path d="M136 44 L147 30 L158 44" />
          <path d="M180 36 L191 22 L202 36" />
          <path d="M224 44 L235 30 L246 44" />
          <path d="M132 126 H268" />
        </g>
      );
    case "Blades":
      return (
        <g {...s}>
          <path d="M60 156 L250 60 Q276 48 284 74 L120 172 Z" />
          <path d="M118 172 L86 188 L60 156" />
          <path d="M120 172 L284 74" />
          <path d="M132 160 L154 184 L182 168" />
        </g>
      );
    case "Gear":
      return (
        <g {...s}>
          <path d="M140 60 L200 44 L260 60 L280 96 L264 176 H136 L120 96 Z" />
          <path d="M140 60 L170 104 L200 44 L230 104 L260 60" />
          <path d="M156 120 H244 V166 H156 Z" />
          <path d="M172 136 H228" />
        </g>
      );
    default:
      return (
        <g {...s}>
          <rect x="90" y="70" width="220" height="100" />
          <path d="M90 110 H310" />
        </g>
      );
  }
}

export default function ProductArt({
  category,
  seed = 0,
  className = "",
}: {
  category: string;
  seed?: number;
  className?: string;
}) {
  const style = STYLES[category] ?? { stroke: "#a9b97c", label: "ART" };
  const rotate = ((seed * 37) % 9) - 4; // deterministic slight tilt

  return (
    <svg
      viewBox="0 0 400 220"
      role="img"
      aria-label={`${category} illustration`}
      className={`h-full w-full ${className}`}
    >
      <defs>
        <linearGradient id={`bg-${category}-${seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#101512" />
          <stop offset="100%" stopColor="#0a0d0b" />
        </linearGradient>
        <pattern id={`grid-${category}-${seed}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0 H0 V20" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="400" height="220" fill={`url(#bg-${category}-${seed})`} />
      <rect width="400" height="220" fill={`url(#grid-${category}-${seed})`} />
      <circle
        cx="330"
        cy="40"
        r="70"
        fill={style.stroke}
        opacity="0.05"
      />
      <text
        x="24"
        y="196"
        fontFamily="var(--font-display), sans-serif"
        fontSize="64"
        fontWeight="800"
        fill={style.stroke}
        opacity="0.08"
        letterSpacing="4"
      >
        {style.label}
      </text>
      <g style={{ color: style.stroke }} transform={`rotate(${rotate} 200 110)`}>
        <Shapes category={category} />
      </g>
      <rect
        x="0.5"
        y="0.5"
        width="399"
        height="219"
        fill="none"
        stroke="rgba(255,255,255,0.06)"
      />
    </svg>
  );
}

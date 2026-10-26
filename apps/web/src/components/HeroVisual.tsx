/** Full-bleed hero visual: marketplace listing inspection scene. */
export function HeroVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#1a2a33]" aria-hidden="true">
      <svg
        className="hero-pan absolute inset-0 h-full w-full object-cover"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2c4452" />
            <stop offset="55%" stopColor="#1b2f3a" />
            <stop offset="100%" stopColor="#121f27" />
          </linearGradient>
          <linearGradient id="asphalt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#314652" />
            <stop offset="100%" stopColor="#1a2730" />
          </linearGradient>
          <linearGradient id="carBody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8fa4b0" />
            <stop offset="40%" stopColor="#5d7280" />
            <stop offset="100%" stopColor="#3a4d59" />
          </linearGradient>
          <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d7e8ef" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#6f8794" stopOpacity="0.35" />
          </linearGradient>
          <filter id="soft">
            <feGaussianBlur stdDeviation="18" />
          </filter>
        </defs>

        <rect width="1600" height="900" fill="url(#sky)" />
        <ellipse cx="1180" cy="220" rx="320" ry="120" fill="#0d6e6e" opacity="0.18" filter="url(#soft)" />
        <ellipse cx="420" cy="160" rx="260" ry="100" fill="#b86a1c" opacity="0.1" filter="url(#soft)" />

        <path d="M0 560 C 280 500, 520 620, 820 560 C 1100 505, 1320 590, 1600 540 L 1600 900 L 0 900 Z" fill="url(#asphalt)" />
        <path d="M0 620 H 1600" stroke="#9eb0bb" strokeOpacity="0.18" strokeWidth="3" strokeDasharray="28 22" />

        {/* Sedan silhouette */}
        <g transform="translate(280 360)">
          <ellipse cx="520" cy="290" rx="460" ry="28" fill="#0b151c" opacity="0.35" />
          <path
            d="M120 250 C 160 170, 250 120, 360 110 L 620 100 C 760 105, 880 150, 940 210 L 980 250 C 990 262, 985 280, 960 285 L 140 290 C 110 286, 105 265, 120 250 Z"
            fill="url(#carBody)"
          />
          <path
            d="M300 120 L 390 55 L 610 48 L 740 110 L 720 118 L 600 70 L 410 76 L 330 125 Z"
            fill="url(#glass)"
          />
          <path d="M430 118 L 560 112 L 700 155 L 690 210 L 450 215 Z" fill="#1c2d37" opacity="0.35" />
          <circle cx="280" cy="275" r="58" fill="#1a242c" />
          <circle cx="280" cy="275" r="28" fill="#6d7d88" />
          <circle cx="820" cy="275" r="58" fill="#1a242c" />
          <circle cx="820" cy="275" r="28" fill="#6d7d88" />
          <rect x="150" y="210" width="70" height="18" rx="4" fill="#d7ecec" opacity="0.75" />
          <rect x="860" y="205" width="55" height="14" rx="3" fill="#f0c27a" opacity="0.7" />
        </g>

        {/* Listing photo frames being inspected */}
        <g transform="translate(980 120)">
          <rect x="0" y="40" width="220" height="160" rx="10" fill="#f4f7f9" opacity="0.92" />
          <rect x="14" y="54" width="192" height="110" rx="6" fill="#5d7280" />
          <rect x="14" y="172" width="110" height="10" rx="3" fill="#c5d0d8" />
          <rect x="40" y="0" width="200" height="150" rx="10" fill="#fff" opacity="0.95" transform="rotate(8 140 75)" />
          <rect x="54" y="16" width="172" height="100" rx="6" fill="#3a4d59" transform="rotate(8 140 75)" />
          <rect x="54" y="128" width="96" height="8" rx="3" fill="#c5d0d8" transform="rotate(8 140 75)" />
        </g>

        {/* VIN strip */}
        <g transform="translate(120 740)">
          <rect width="420" height="54" rx="8" fill="#0f1a22" opacity="0.72" />
          <text x="24" y="34" fill="#9db8b8" fontFamily="ui-monospace, monospace" fontSize="18" letterSpacing="2">
            VIN · 1HGCM82633A004352
          </text>
        </g>

        {/* Scan cue */}
        <g className="scan-line">
          <rect x="360" y="430" width="560" height="2" fill="#7fd4d0" opacity="0.7" />
          <circle cx="360" cy="431" r="5" fill="#7fd4d0" />
          <circle cx="920" cy="431" r="5" fill="#7fd4d0" />
        </g>
      </svg>
      <div className="absolute inset-0 bg-gradient-to-r from-[rgba(15,26,34,0.82)] via-[rgba(15,26,34,0.55)] to-[rgba(15,26,34,0.28)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--background)] to-transparent" />
    </div>
  );
}

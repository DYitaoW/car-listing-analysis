/** Full-bleed hero visual: marketplace listing inspection scene. */
export function HeroVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#15232c]" aria-hidden="true">
      <svg
        className="hero-pan absolute inset-0 h-full w-full"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stopColor="#3a5361" />
            <stop offset="45%" stopColor="#243843" />
            <stop offset="100%" stopColor="#15232c" />
          </linearGradient>
          <linearGradient id="asphalt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d515c" />
            <stop offset="100%" stopColor="#1b2a33" />
          </linearGradient>
          <linearGradient id="carBody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#b7c6cf" />
            <stop offset="35%" stopColor="#7e93a0" />
            <stop offset="100%" stopColor="#445864" />
          </linearGradient>
          <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8f4f8" stopOpacity="0.62" />
            <stop offset="100%" stopColor="#6f8794" stopOpacity="0.28" />
          </linearGradient>
          <linearGradient id="frame" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e6eef2" />
          </linearGradient>
          <radialGradient id="lamp" cx="70%" cy="18%" r="35%">
            <stop offset="0%" stopColor="#d7ecec" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#d7ecec" stopOpacity="0" />
          </radialGradient>
          <filter id="soft">
            <feGaussianBlur stdDeviation="22" />
          </filter>
        </defs>

        <rect width="1600" height="900" fill="url(#sky)" />
        <rect width="1600" height="900" fill="url(#lamp)" />
        <ellipse cx="1260" cy="180" rx="360" ry="140" fill="#0d6e6e" opacity="0.16" filter="url(#soft)" />
        <ellipse cx="340" cy="140" rx="280" ry="110" fill="#b86a1c" opacity="0.08" filter="url(#soft)" />

        {/* Distant buildings / lot edge */}
        <g opacity="0.22" fill="#0f1a22">
          <rect x="40" y="390" width="70" height="170" />
          <rect x="120" y="330" width="90" height="230" />
          <rect x="220" y="360" width="60" height="200" />
          <rect x="1380" y="350" width="80" height="210" />
          <rect x="1470" y="300" width="100" height="260" />
        </g>

        <path
          d="M0 560 C 260 505, 520 615, 840 555 C 1120 500, 1340 585, 1600 535 L 1600 900 L 0 900 Z"
          fill="url(#asphalt)"
        />
        <path
          d="M0 640 H 1600"
          stroke="#a9bbc5"
          strokeOpacity="0.22"
          strokeWidth="4"
          strokeDasharray="34 26"
        />

        {/* Sedan */}
        <g transform="translate(250 340)">
          <ellipse cx="540" cy="310" rx="500" ry="34" fill="#0b151c" opacity="0.4" />
          <path
            d="M90 265 C 140 175, 250 118, 370 108 L 650 96 C 810 100, 940 148, 1010 215 L 1060 265 C 1072 280, 1065 300, 1035 306 L 110 312 C 75 306, 68 282, 90 265 Z"
            fill="url(#carBody)"
          />
          <path
            d="M310 125 L 405 48 L 640 40 L 790 108 L 765 118 L 630 68 L 430 74 L 345 130 Z"
            fill="url(#glass)"
          />
          <path d="M450 120 L 600 112 L 760 168 L 745 228 L 470 234 Z" fill="#15232c" opacity="0.32" />
          <path d="M180 220 L 250 168 L 310 160 L 290 220 Z" fill="url(#glass)" opacity="0.8" />
          <circle cx="290" cy="295" r="64" fill="#141d24" />
          <circle cx="290" cy="295" r="34" fill="#7d8d97" />
          <circle cx="290" cy="295" r="12" fill="#1c282f" />
          <circle cx="880" cy="295" r="64" fill="#141d24" />
          <circle cx="880" cy="295" r="34" fill="#7d8d97" />
          <circle cx="880" cy="295" r="12" fill="#1c282f" />
          <rect x="140" y="228" width="86" height="20" rx="4" fill="#e7f4f3" opacity="0.85" />
          <rect x="920" y="222" width="62" height="16" rx="3" fill="#efc27b" opacity="0.78" />
          <path d="M430 300 H 720" stroke="#d7e4ea" strokeOpacity="0.28" strokeWidth="3" />
        </g>

        {/* Listing photo stack */}
        <g transform="translate(1040 95)">
          <g transform="rotate(-7 120 90)">
            <rect x="0" y="30" width="240" height="180" rx="12" fill="url(#frame)" />
            <rect x="16" y="46" width="208" height="118" rx="7" fill="#5f7481" />
            <path d="M16 130 L 80 92 L 130 118 L 170 88 L 224 130 L 224 164 L 16 164 Z" fill="#445864" />
            <rect x="16" y="176" width="120" height="12" rx="3" fill="#c2ced6" />
          </g>
          <g transform="rotate(8 150 110)">
            <rect x="55" y="0" width="230" height="170" rx="12" fill="url(#frame)" />
            <rect x="71" y="16" width="198" height="108" rx="7" fill="#3f5360" />
            <path d="M71 90 L 120 58 L 165 82 L 200 54 L 269 90 L 269 124 L 71 124 Z" fill="#2b3c47" />
            <rect x="71" y="138" width="104" height="10" rx="3" fill="#c2ced6" />
            <rect x="71" y="154" width="72" height="8" rx="3" fill="#d5dee4" />
          </g>
        </g>

        {/* VIN strip */}
        <g transform="translate(96 742)">
          <rect width="460" height="58" rx="10" fill="#0f1a22" opacity="0.78" />
          <text
            x="26"
            y="36"
            fill="#9db8b8"
            fontFamily="ui-monospace, SFMono-Regular, monospace"
            fontSize="18"
            letterSpacing="1.5"
          >
            VIN · 1HGCM82633A004352
          </text>
        </g>

        {/* Inspection scan */}
        <g className="scan-line">
          <rect x="320" y="445" width="620" height="2.5" fill="#8fe0db" opacity="0.75" />
          <circle cx="320" cy="446" r="5.5" fill="#8fe0db" />
          <circle cx="940" cy="446" r="5.5" fill="#8fe0db" />
        </g>
      </svg>
      <div className="absolute inset-0 bg-gradient-to-r from-[rgba(15,26,34,0.88)] via-[rgba(15,26,34,0.58)] to-[rgba(15,26,34,0.22)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--background)] to-transparent" />
    </div>
  );
}

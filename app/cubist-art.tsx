'use client';

export function CubistHeroArtwork() {
  return (
    <svg
      className="cubist-hero-art"
      viewBox="0 0 1200 220"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cb-sky" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#094A60" />
          <stop offset="45%" stopColor="#145B6E" />
          <stop offset="72%" stopColor="#B83B1E" />
          <stop offset="100%" stopColor="#D69828" />
        </linearGradient>
        <linearGradient id="cb-scrim" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0A2530" stopOpacity="0.88" />
          <stop offset="46%" stopColor="#0C313E" stopOpacity="0.74" />
          <stop offset="78%" stopColor="#133845" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#1A2B33" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id="cb-ochre" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E6B64B" />
          <stop offset="100%" stopColor="#C46B1E" />
        </linearGradient>
        <linearGradient id="cb-vermilion" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C94621" />
          <stop offset="100%" stopColor="#8F2614" />
        </linearGradient>
        <linearGradient id="cb-teal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1B7184" />
          <stop offset="100%" stopColor="#0D4353" />
        </linearGradient>
        <linearGradient id="cb-pine" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1E4A39" />
          <stop offset="100%" stopColor="#3B7157" />
        </linearGradient>
      </defs>

      {/* Base cubist sky & warm-cool split */}
      <rect width="1200" height="220" fill="url(#cb-sky)" />

      {/* Upper cool teal & pine planes */}
      <polygon points="0,0 440,0 290,78 0,58" fill="#0B526B" />
      <polygon points="0,58 290,78 190,180 0,150" fill="url(#cb-pine)" opacity="0.92" />
      <polygon points="220,38 560,12 465,126 175,112" fill="url(#cb-teal)" opacity="0.88" />

      {/* Center diagonal shards bridging cool to warm */}
      <polygon points="440,0 740,0 595,95 360,55" fill="url(#cb-vermilion)" opacity="0.9" />
      <polygon points="465,126 705,42 790,182 520,194" fill="#7D968A" opacity="0.72" />
      <polygon points="560,12 870,0 780,124 610,88" fill="#D4741D" opacity="0.88" />

      {/* Right fiery ochre & sunlit gold planes */}
      <polygon points="870,0 1200,0 1200,115 915,96" fill="url(#cb-ochre)" />
      <polygon points="915,96 1200,115 1200,202 840,192" fill="#C7471C" opacity="0.88" />
      <polygon points="755,105 975,68 910,196 710,188" fill="#E8CA89" opacity="0.82" />

      {/* Left cool faceted vortex + luminous moon disc */}
      <g transform="translate(340 112)">
        <polygon points="-108,-36 18,-62 96,-12 72,56 -58,64 -116,18" fill="#3C5E6B" opacity="0.86" />
        <polygon points="-78,-26 12,-44 68,-6 50,40 -42,46 -84,12" fill="#6D8C93" opacity="0.84" />
        <polygon points="-46,-18 14,-28 42,2 28,32 -28,34 -50,8" fill="#D9B174" opacity="0.9" />
        <polygon points="-28,-16 20,-20 26,18 -20,24" fill="#D5DDD6" opacity="0.92" />
        <circle cx="0" cy="2" r="19" fill="#F7F1E3" stroke="#7A8E8E" strokeWidth="1.2" />
      </g>

      {/* Right warm solar vortex + radiant sun disc */}
      <g transform="translate(830 74)">
        <polygon points="-72,-44 48,-52 84,16 32,64 -58,50 -86,-4" fill="#9E3B16" opacity="0.72" />
        <polygon points="-48,-30 34,-36 56,12 20,44 -38,34 -58,-2" fill="#B97F2A" opacity="0.86" />
        <polygon points="-28,-22 24,-24 30,22 -22,26" fill="#E5C689" opacity="0.95" />
        <circle cx="2" cy="2" r="14" fill="#FFF9EC" stroke="#B68B4C" strokeWidth="1.2" />
      </g>

      {/* Crisp sweeping sail-like prism wedges */}
      <polygon points="92,196 168,86 248,200" fill="#176171" opacity="0.78" />
      <polygon points="565,196 675,78 708,196" fill="#466875" opacity="0.76" />
      <polygon points="945,196 1085,62 1045,196" fill="#0F5F6F" opacity="0.86" />
      <polygon points="1038,196 1120,76 1142,196" fill="#215B3E" opacity="0.82" />
      <polygon points="1090,196 1175,92 1185,196" fill="#102C42" opacity="0.84" />

      {/* Warm sunlit sandstone horizon strip along bottom */}
      <rect x="0" y="192" width="1200" height="12" fill="#E6CB90" opacity="0.92" />
      <polygon points="0,204 420,204 340,220 0,220" fill="#2A5844" />
      <polygon points="340,220 420,204 790,204 680,220" fill="#A63B1E" opacity="0.88" />
      <polygon points="680,220 790,204 1200,204 1200,220" fill="#1D323A" />

      {/* Crisp geometric facet lines */}
      <g stroke="#FFF6E2" strokeOpacity="0.22" strokeWidth="1">
        <line x1="0" y1="58" x2="560" y2="12" />
        <line x1="290" y1="78" x2="740" y2="0" />
        <line x1="465" y1="126" x2="915" y2="96" />
        <line x1="705" y1="42" x2="1085" y2="62" />
      </g>

      {/* Left readability scrim so title & subtitle stay crystal-clear */}
      <rect width="1200" height="220" fill="url(#cb-scrim)" />
    </svg>
  );
}

export function CubistSidebarArtwork() {
  return (
    <svg
      className="cubist-sidebar-art"
      viewBox="0 0 260 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <polygon points="0,0 260,0 260,210 0,145" fill="#134859" opacity="0.65" />
      <polygon points="0,145 260,210 170,420 0,340" fill="#195247" opacity="0.34" />
      <polygon points="110,280 260,190 260,520 70,460" fill="#0B3B4B" opacity="0.55" />
      <polygon points="0,560 210,490 260,720 0,760" fill="#1C505E" opacity="0.38" />
      <polygon points="0,740 260,680 260,900 0,900" fill="#B83B1E" opacity="0.16" />
      <polygon points="120,760 260,650 260,900 60,900" fill="#D69828" opacity="0.14" />
      <line x1="0" y1="145" x2="260" y2="210" stroke="#E8C684" strokeOpacity="0.16" strokeWidth="1" />
      <line x1="0" y1="740" x2="260" y2="680" stroke="#E8C684" strokeOpacity="0.2" strokeWidth="1" />
    </svg>
  );
}

export function CubistCanvasBackdrop() {
  return (
    <svg
      className="cubist-canvas-bg"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* Bold layered diagonal cubist planes across the outer workspace canvas */}
      <polygon points="0,0 560,0 290,370 0,250" fill="#0E5E72" opacity="0.13" />
      <polygon points="0,250 290,370 140,690 0,600" fill="#2E604A" opacity="0.11" />
      <polygon points="880,0 1440,0 1440,390 1080,270" fill="#D69828" opacity="0.17" />
      <polygon points="1080,270 1440,390 1440,780 940,620" fill="#B83B1E" opacity="0.11" />
      <polygon points="440,670 1080,560 1440,900 280,900" fill="#D69828" opacity="0.13" />
      <polygon points="0,660 440,590 580,900 0,900" fill="#0E5E72" opacity="0.11" />
      {/* Bold diagonal sail shards & facet hairlines */}
      <polygon points="1180,900 1380,520 1440,900" fill="#0E5E72" opacity="0.12" />
      <polygon points="0,900 180,580 310,900" fill="#2E604A" opacity="0.1" />
      <g stroke="#0E5E72" strokeOpacity="0.14" strokeWidth="1.2">
        <line x1="0" y1="250" x2="560" y2="0" />
        <line x1="290" y1="370" x2="1080" y2="270" />
        <line x1="880" y1="0" x2="1440" y2="390" />
        <line x1="140" y1="690" x2="940" y2="620" />
      </g>
    </svg>
  );
}

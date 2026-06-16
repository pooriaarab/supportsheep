export function AnimeSheepHero() {
  return (
    <div className="relative w-full max-w-lg mx-auto aspect-square overflow-hidden rounded-full shadow-xl ring-1 ring-border bg-gradient-to-br from-primary/10 to-background dark:from-primary/20 dark:to-background">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 400 400"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c7d2fe" />
            <stop offset="100%" stopColor="#fef08a" />
          </linearGradient>
          <linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#86efac" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Sky Background */}
        <rect width="400" height="400" fill="url(#skyGrad)" />
        
        {/* Sun */}
        <circle cx="320" cy="80" r="40" fill="#fde047" opacity="0.8" filter="url(#glow)" />
        
        {/* Clouds */}
        <path d="M50 120 Q60 100 80 110 Q90 90 110 100 Q120 110 110 120 Z" fill="#ffffff" opacity="0.9" />
        <path d="M250 150 Q260 130 280 140 Q290 120 310 130 Q320 140 310 150 Z" fill="#ffffff" opacity="0.7" />

        {/* Grass/Hills */}
        <path d="M0 250 Q100 200 200 250 T400 250 L400 400 L0 400 Z" fill="url(#grassGrad)" />
        <path d="M0 280 Q150 240 300 290 T400 280 L400 400 L0 400 Z" fill="#16a34a" />

        {/* The Anime Sheep */}
        <g transform="translate(140, 200)">
          {/* Back Legs */}
          <rect x="25" y="60" width="8" height="25" rx="4" fill="#cbd5e1" />
          <rect x="65" y="60" width="8" height="25" rx="4" fill="#cbd5e1" />
          
          {/* Fluffy Body */}
          <path d="M10 40 C-5 40 -5 10 15 10 C15 -5 45 -5 50 10 C65 -5 95 -5 95 10 C115 10 115 40 100 40 C115 70 85 70 80 60 C80 80 40 80 40 60 C30 80 -5 70 10 40 Z" fill="#ffffff" stroke="#e2e8f0" strokeWidth="4" />
          
          {/* Front Legs */}
          <rect x="35" y="65" width="8" height="25" rx="4" fill="#f8fafc" />
          <rect x="75" y="65" width="8" height="25" rx="4" fill="#f8fafc" />
          
          {/* Head */}
          <rect x="60" y="15" width="45" height="40" rx="20" fill="#6c4cef" />
          
          {/* Anime Eyes */}
          <circle cx="75" cy="30" r="6" fill="#ffffff" />
          <circle cx="77" cy="28" r="2" fill="#000000" />
          <circle cx="95" cy="30" r="6" fill="#ffffff" />
          <circle cx="97" cy="28" r="2" fill="#000000" />
          
          {/* Blush */}
          <ellipse cx="70" cy="40" rx="4" ry="2" fill="#f43f5e" opacity="0.6" />
          <ellipse cx="100" cy="40" rx="4" ry="2" fill="#f43f5e" opacity="0.6" />
          
          {/* Mouth */}
          <path d="M80 42 Q85 46 90 42" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          
          {/* Ears */}
          <ellipse cx="55" cy="25" rx="12" ry="6" fill="#6c4cef" transform="rotate(-30 55 25)" />
          <ellipse cx="110" cy="25" rx="12" ry="6" fill="#6c4cef" transform="rotate(30 110 25)" />
        </g>
        
        {/* Floating AI Data Nodes */}
        <g className="animate-pulse">
          <circle cx="120" cy="180" r="4" fill="#6c4cef" />
          <path d="M120 180 L160 210" stroke="#6c4cef" strokeWidth="2" strokeDasharray="4 4" opacity="0.5" />
          
          <circle cx="280" cy="160" r="5" fill="#e879f9" />
          <path d="M280 160 L240 220" stroke="#e879f9" strokeWidth="2" strokeDasharray="4 4" opacity="0.5" />
        </g>
      </svg>
    </div>
  );
}

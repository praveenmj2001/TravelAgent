export default function TravelAILogo({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer compass ring */}
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.2" opacity="0.25" />

      {/* Neural mesh lines — intercardinal */}
      <line x1="7.2" y1="7.2" x2="16.8" y2="16.8" stroke="currentColor" strokeWidth="0.75" opacity="0.22" />
      <line x1="16.8" y1="7.2" x2="7.2" y2="16.8" stroke="currentColor" strokeWidth="0.75" opacity="0.22" />

      {/* Neural lines — cardinal (cross) */}
      <line x1="12" y1="2.5" x2="12" y2="21.5" stroke="currentColor" strokeWidth="0.75" opacity="0.18" />
      <line x1="2.5" y1="12" x2="21.5" y2="12" stroke="currentColor" strokeWidth="0.75" opacity="0.18" />

      {/* Neural nodes at intercardinal corners */}
      <circle cx="7.2" cy="7.2" r="1.4" fill="currentColor" opacity="0.55" />
      <circle cx="16.8" cy="7.2" r="1.4" fill="currentColor" opacity="0.55" />
      <circle cx="16.8" cy="16.8" r="1.4" fill="currentColor" opacity="0.55" />
      <circle cx="7.2" cy="16.8" r="1.4" fill="currentColor" opacity="0.55" />

      {/* Compass needle — North (solid, pointing up) */}
      <path d="M12 2.5L13.8 11.5L12 10.5L10.2 11.5Z" fill="currentColor" />
      {/* Compass needle — South (faded) */}
      <path d="M12 21.5L10.2 12.5L12 13.5L13.8 12.5Z" fill="currentColor" opacity="0.28" />

      {/* Centre hub */}
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

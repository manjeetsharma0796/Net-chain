/**
 * NetChain logo mark (from the brand kit). Monochrome and drawn in
 * `currentColor`, so it renders white on the dark app and black on light
 * surfaces automatically. Size it with `className` (e.g. `h-6 w-6`).
 */
export default function NetChainMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" aria-hidden="true">
      <path d="M100,30 L160.6,65 L160.6,135 L100,170 L39.4,135 L39.4,65 Z" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M100,30 L160.6,135 L39.4,135 Z" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
      <path d="M160.6,65 L100,170 L39.4,65 Z" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
      <circle cx="100" cy="30" r="9" fill="currentColor" />
      <circle cx="160.6" cy="65" r="9" fill="currentColor" />
      <circle cx="160.6" cy="135" r="9" fill="currentColor" />
      <circle cx="100" cy="170" r="9" fill="currentColor" />
      <circle cx="39.4" cy="135" r="9" fill="currentColor" />
      <circle cx="39.4" cy="65" r="9" fill="currentColor" />
      <circle cx="130.3" cy="47.5" r="5.5" fill="currentColor" />
      <circle cx="160.6" cy="100" r="5.5" fill="currentColor" />
      <circle cx="130.3" cy="152.5" r="5.5" fill="currentColor" />
      <circle cx="69.7" cy="152.5" r="5.5" fill="currentColor" />
      <circle cx="39.4" cy="100" r="5.5" fill="currentColor" />
      <circle cx="69.7" cy="47.5" r="5.5" fill="currentColor" />
      <path d="M100,77 L118,85 L118,104 C118,122 100,131 100,131 C100,131 82,122 82,104 L82,85 Z" fill="currentColor" />
    </svg>
  );
}

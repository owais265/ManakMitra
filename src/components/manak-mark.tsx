/** Circular gazette seal — not the BIS / GoI emblem, not a rounded-app icon. */
export default function ManakMark({
  className,
  title = 'ManakMitra',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="32" cy="32" r="32" fill="#172554" />
      <circle cx="32" cy="32" r="30.2" fill="#1e3a8a" />
      <circle cx="32" cy="32" r="28.4" fill="none" stroke="#c9a227" strokeWidth="2.1" />
      <circle cx="32" cy="32" r="25.2" fill="none" stroke="#f8fafc" strokeWidth="0.7" opacity="0.45" />
      <g stroke="#c9a227" strokeWidth="1.35" strokeLinecap="round">
        <path d="M32 3.6v3.4" />
        <path d="M32 57v3.4" />
        <path d="M3.6 32h3.4" />
        <path d="M57 32h3.4" />
        <path d="M17.1 7.9l1.7 2.95" />
        <path d="M45.2 53.15l1.7 2.95" />
        <path d="M7.9 17.1l2.95 1.7" />
        <path d="M53.15 45.2l2.95 1.7" />
        <path d="M7.9 46.9l2.95-1.7" />
        <path d="M53.15 18.8l2.95-1.7" />
        <path d="M17.1 56.1l1.7-2.95" />
        <path d="M45.2 10.85l1.7-2.95" />
      </g>
      <path
        fill="#f8fafc"
        d="M32 14.2c4.6 1.7 10.8 3.6 12.8 4.1v14.6c0 8.1-5.7 12.7-12.8 16.1C25 45.6 19.2 41 19.2 32.9V18.3c2.1-.6 8.1-2.4 12.8-4.1z"
      />
      <path
        fill="none"
        stroke="#c2410c"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M24.4 32.6l4.9 4.9 10.6-11.2"
      />
    </svg>
  );
}

export default function MaterialSymbols({ children, className = '' }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`.trim()}
      style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
    >
      {children}
    </span>
  );
}

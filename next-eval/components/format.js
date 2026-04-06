export function fmt(cents = 0, signed = false) {
  const value = Math.abs(cents || 0) / 100;
  const out = value.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 });
  return signed && cents < 0 ? `-${out}` : out;
}

export function fmtShort(cents = 0) {
  const abs = Math.abs(cents || 0) / 100;
  if (abs >= 1000) return `$${(abs / 1000).toFixed(1)}k`;
  return `$${abs.toFixed(0)}`;
}

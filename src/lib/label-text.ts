/** Pull a licence or IS number out of text a label reader actually returned. */
export function marksFromLabel(raw: string): { licence: string | null; isNumber: string | null } {
  const flat = raw.replace(/\s+/g, " ").slice(0, 800);
  const cm = /CM\s*\/\s*L\s*-?\s*(\d{6,8})/i.exec(flat);
  const cml = /\bCML\s*-?\s*(\d{6,8})/i.exec(flat);
  const reg = /\bR\s*-\s*(\d{6,12})\b/i.exec(flat);
  const isn = /\bIS[\s.:/-]*(\d{3,6})\b/i.exec(flat);
  let licence: string | null = null;
  if (cm) licence = `CM/L-${cm[1]}`;
  else if (cml) licence = `CM/L-${cml[1]}`;
  else if (reg) licence = `R-${reg[1]}`;
  return { licence, isNumber: isn ? isn[1] : null };
}

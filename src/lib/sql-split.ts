/** Split a SQL script on semicolons that are not inside dollar quotes or line comments. */
export function splitSql(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let i = 0;
  let dollar: string | null = null;
  while (i < sql.length) {
    if (!dollar && sql.startsWith("--", i)) {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? sql.length : nl + 1;
      continue;
    }
    if (sql[i] === "$") {
      const tag = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (tag) {
        if (!dollar) dollar = tag[0];
        else if (dollar === tag[0]) dollar = null;
        buf += tag[0];
        i += tag[0].length;
        continue;
      }
    }
    if (!dollar && sql[i] === ";") {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = "";
      i += 1;
      continue;
    }
    buf += sql[i];
    i += 1;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

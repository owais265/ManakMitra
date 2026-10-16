import { appendFileSync } from "node:fs";

export function chatLog(row: {
  id: string;
  desk: string;
  path: string;
  cache: string;
  limited: "yes" | "no";
  refuse: string;
  ms: number;
}): void {
  const line = `[chat] id=${row.id} desk=${row.desk} path=${row.path} cache=${row.cache} limited=${row.limited} refuse=${row.refuse} ms=${row.ms}`;
  console.info(line);
  try {
    appendFileSync("/tmp/manakmitra-chat.log", line + "\n");
  } catch {
    /* logging must not change the answer */
  }
}
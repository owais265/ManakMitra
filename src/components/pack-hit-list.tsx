export type PackHit = { title: string; url: string };

export async function fetchPackHits(kind: string, q: string): Promise<PackHit[]> {
  const response = await fetch("/api/labs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, q }),
  });
  if (!response.ok) return [];
  const json = (await response.json()) as { hits?: PackHit[] };
  return json.hits || [];
}

export function PackHitList({ hits, label }: { hits: PackHit[]; label: string }) {
  if (!hits.length) return null;
  return (
    <section className="mt-6">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</h3>
      <ul className="mt-2 grid gap-2">
        {hits.map((hit) => (
          <li key={hit.title} className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {hit.url ? (
              <a href={hit.url} target="_blank" rel="noopener noreferrer" className="font-medium text-bis-navy underline dark:text-blue-300">
                {hit.title}
              </a>
            ) : (
              hit.title
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

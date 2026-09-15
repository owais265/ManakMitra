const OFFICIAL_HOSTS = [
  "bis.gov.in",
  "manakonline.in",
  "crsbis.in",
  "standardsbis.bsbedge.com",
  "india.gov.in",
] as const;

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function isOfficialHost(url: string): boolean {
  const h = hostnameOf(url);
  if (!h) return false;
  return OFFICIAL_HOSTS.some((root) => h === root || h.endsWith(`.${root}`));
}

export function officialHostOrNull(url: string): string | null {
  const h = hostnameOf(url);
  if (!h) return null;
  return isOfficialHost(url) ? h : null;
}

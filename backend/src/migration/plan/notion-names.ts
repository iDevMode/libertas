/** Notion option names cannot contain commas and must be unique regardless of case. */
export function sanitizeOptionName(name: string): string {
  const cleaned = name.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  return (cleaned.length > 0 ? cleaned : 'Untitled').slice(0, 100);
}

export function uniqueOptions(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names.map(sanitizeOptionName)) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result.slice(0, 100);
}

/**
 * Hands out property names that are unique (case-insensitively) within one data source,
 * suffixing clashes: "Status", "Status (2)".
 */
export class PropertyNamer {
  private readonly used = new Set<string>();

  take(name: string): string {
    const base = name.trim().length > 0 ? name.trim() : 'Untitled';
    let candidate = base;
    for (let n = 2; this.used.has(candidate.toLowerCase()); n++) {
      candidate = `${base} (${n})`;
    }
    this.used.add(candidate.toLowerCase());
    return candidate;
  }
}

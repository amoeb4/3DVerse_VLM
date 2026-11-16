import { parseMpf, type MpfProgram } from "./mpf";

/**
 * The part programs that ship with the app: every `.mpf` in `mpf_files/`, by name. They build one
 * part between them, laid in the order of their names (PB_1, PB_2, then PH_3): Preview shows the
 * ones before the program it plays as laid already.
 *
 * Served as files, fetched when picked: some are tens of megabytes.
 */
const URLS = import.meta.glob("/mpf_files/*.mpf", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type ProgramSource =
  | { kind: "bundled"; name: string; url: string }
  | { kind: "file"; name: string; file: File };

export const BUNDLED_PROGRAMS: ProgramSource[] = Object.entries(URLS)
  .map(([path, url]) => ({
    kind: "bundled" as const,
    name: path.split("/").pop() ?? path,
    url,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

/** A bundled program's name without its extension: PB_1. */
export const programLabel = (name: string) => name.replace(/\.mpf$/i, "");

const cache = new Map<string, Promise<MpfProgram>>();

/** A program, fetched (or read) and parsed; a bundled one once only. */
export function loadProgram(source: ProgramSource): Promise<MpfProgram> {
  if (source.kind === "file") {
    return source.file.text().then((text) => parseMpf(text, source.name));
  }
  let pending = cache.get(source.url);
  if (!pending) {
    pending = fetch(source.url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `${source.name}: ${response.status} ${response.statusText}`,
          );
        }
        return response.text();
      })
      .then((text) => parseMpf(text, source.name));
    // A failed load is tried again next time.
    pending.catch(() => cache.delete(source.url));
    cache.set(source.url, pending);
  }
  return pending;
}

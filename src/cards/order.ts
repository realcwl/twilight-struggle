import catalog from './catalog.json';

const ops = new Map(catalog.map(c => [c.id, c.ops]));

/** Browsing order: higher printed Ops first, scoring cards last, ties by card number. */
export function compareCardOps(a: string, b: string): number {
  const aId = Number(a), bId = Number(b);
  return (ops.get(bId) ?? 0) - (ops.get(aId) ?? 0) || aId - bId;
}

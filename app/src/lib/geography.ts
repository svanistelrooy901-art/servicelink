import data from '../data/malaysia.json' with { type: 'json' };
import type { Coverage } from './types.ts';
export const geography = data;
export const GEOGRAPHY_VERSION = 'dosm-census-2020-v1';
export const stateById = (id: string) => geography.find((s) => s.id === id);
export function coverageErrors(coverage: Coverage[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const entry of coverage) {
    const state = stateById(entry.stateId);
    if (!state || seen.has(entry.stateId)) {
      errors.push('Choose each valid state once.');
      continue;
    }
    seen.add(entry.stateId);
    if (entry.wholeState && entry.subdivisionIds.length)
      errors.push('Whole-state coverage must not include selected districts.');
    if (!entry.wholeState && !entry.subdivisionIds.length)
      errors.push(`Choose at least one district in ${state.name}.`);
    if (
      new Set(entry.subdivisionIds).size !== entry.subdivisionIds.length ||
      entry.subdivisionIds.some((id) => !state.subdivisions.some((d) => d.id === id))
    )
      errors.push(`Check the selected districts in ${state.name}.`);
  }
  return errors;
}
export function matchesCoverage(
  coverage: Coverage[],
  stateId: string,
  subdivisionId = '',
): boolean {
  const state = stateById(stateId);
  if (!state || (subdivisionId && !state.subdivisions.some((d) => d.id === subdivisionId)))
    return false;
  return coverage.some(
    (c) =>
      c.stateId === stateId &&
      (c.wholeState ||
        (subdivisionId ? c.subdivisionIds.includes(subdivisionId) : c.subdivisionIds.length > 0)),
  );
}
export function coverageLabels(coverage: Coverage[]): string[] {
  return coverage.flatMap((c) => {
    const state = stateById(c.stateId);
    if (!state) return [];
    return [
      c.wholeState
        ? `All of ${state.name}`
        : `${state.name}: ${state.subdivisions
            .filter((d) => c.subdivisionIds.includes(d.id))
            .map((d) => d.name)
            .join(', ')}`,
    ];
  });
}

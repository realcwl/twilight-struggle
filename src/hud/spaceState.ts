import type { SideIndex, SpaceStep } from './types';

/** Track positions are monotonic during play. A milestone's privilege ends at the second arrival. */
export function spaceAbilityOwner(positions: readonly [number, number], milestone: number): SideIndex | null {
  const a = positions[0] >= milestone;
  const b = positions[1] >= milestone;
  return a === b ? null : a ? 0 : 1;
}

/** Derive display state; this does not award points or execute the ability's game action. */
export function activeSpaceAbilities(steps: readonly SpaceStep[], positions: readonly [number, number]) {
  return steps.flatMap((step, index) => {
    const owner = spaceAbilityOwner(positions, index + 1);
    return step.ability && owner !== null ? [{ step: index + 1, owner, ability: step.ability }] : [];
  });
}

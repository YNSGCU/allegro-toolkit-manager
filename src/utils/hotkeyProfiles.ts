import type { HotkeyBinding, HotkeyProfile } from '../types/hotkey';

export function materializeProfileBindings(profile?: HotkeyProfile | null): HotkeyBinding[] {
  if (!profile) {
    return [];
  }

  return profile.bindings.map((binding) => ({
    id: `profile:${profile.id}:${binding.id}`,
    key: binding.key,
    command: binding.command,
    type: binding.type,
    bindingSource: 'active_profile',
    source: 'atm_managed',
    status: binding.enabled === false ? 'disabled' : 'normal',
    chineseName: binding.chineseName,
    commandSource: binding.commandSource,
    profileId: profile.id,
    profileName: profile.name,
    editable: true,
    enabled: binding.enabled !== false,
    notes: binding.note ? [binding.note] : [],
  }));
}

export function mergeBindingsWithActiveProfile(
  bindings: HotkeyBinding[],
  profile?: HotkeyProfile | null,
): HotkeyBinding[] {
  const withoutProfileBindings = bindings.filter((binding) => binding.bindingSource !== 'active_profile');
  const profileBindings = materializeProfileBindings(profile);
  return [...withoutProfileBindings, ...profileBindings];
}

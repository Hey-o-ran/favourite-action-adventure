import { describe, expect, it } from 'vitest';
import { defaultsOf, sanitize } from '../gameSettings';
import { DEFAULT_RULES, PAYOUT_BY_DIFFICULTY } from './ginRules';
import { GIN_SETTINGS, ginChoices } from './ginSettings';

describe('Gin Rummy settings', () => {
  it('default to the standard game against the normal bot', () => {
    expect(ginChoices(defaultsOf(GIN_SETTINGS))).toEqual({ difficulty: 'normal', rules: DEFAULT_RULES });
  });

  it('turn what was chosen into the rules a match is played by', () => {
    const choices = ginChoices(sanitize(GIN_SETTINGS, { difficulty: 'hard', target: '150', knockRule: 'oklahoma', doubleBonuses: true }));
    expect(choices).toEqual({ difficulty: 'hard', rules: { target: 150, knockRule: 'oklahoma', ginBonus: 50, undercutBonus: 50 } });
  });

  it('only double the bonuses when that is switched on', () => {
    expect(ginChoices(sanitize(GIN_SETTINGS, { doubleBonuses: false })).rules).toMatchObject({ ginBonus: 25, undercutBonus: 25 });
    expect(ginChoices(sanitize(GIN_SETTINGS, { doubleBonuses: true })).rules).toMatchObject({ ginBonus: 50, undercutBonus: 50 });
  });

  it('can only produce rules the game understands, whatever was saved', () => {
    const choices = ginChoices(sanitize(GIN_SETTINGS, { difficulty: 'godlike', target: '1', knockRule: 'never', doubleBonuses: 'yes' }));
    expect(choices).toEqual({ difficulty: 'normal', rules: DEFAULT_RULES });
  });

  it('offer every strength, match length and knock rule the game supports', () => {
    const options = (id: string) => GIN_SETTINGS.groups.flatMap((g) => g.settings).flatMap((s) => (s.id === id && s.kind === 'choice' ? s.options.map((o) => o.value) : []));
    expect(options('difficulty')).toEqual(Object.keys(PAYOUT_BY_DIFFICULTY));
    expect(options('target')).toEqual(['50', '100', '150']);
    expect(options('knockRule')).toEqual(['standard', 'oklahoma', 'gin']);
  });
});

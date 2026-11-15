import type { SettingsSchema, SettingValues } from '../gameSettings';
import { GIN_BONUS, MATCH_TARGET, UNDERCUT_BONUS, type Difficulty, type GinRules, type KnockRule } from './ginRules';

/** What Gin Rummy lets you change. The Settings panel, saving and checking all work from this description. */
export const GIN_SETTINGS: SettingsSchema = {
  gameId: 'gin-rummy',
  groups: [
    {
      title: 'settings.gin.group.bot',
      settings: [
        {
          kind: 'choice',
          id: 'difficulty',
          label: 'settings.gin.difficulty',
          help: 'settings.gin.difficulty.help',
          default: 'normal',
          options: [
            { value: 'easy', label: 'settings.gin.difficulty.easy', help: 'settings.gin.difficulty.easy.help' },
            { value: 'normal', label: 'settings.gin.difficulty.normal', help: 'settings.gin.difficulty.normal.help' },
            { value: 'hard', label: 'settings.gin.difficulty.hard', help: 'settings.gin.difficulty.hard.help' },
          ],
        },
      ],
    },
    {
      title: 'settings.gin.group.rules',
      settings: [
        {
          kind: 'choice',
          id: 'target',
          label: 'settings.gin.target',
          default: String(MATCH_TARGET),
          options: [
            { value: '50', label: 'settings.gin.target.50' },
            { value: '100', label: 'settings.gin.target.100' },
            { value: '150', label: 'settings.gin.target.150' },
          ],
        },
        {
          kind: 'choice',
          id: 'knockRule',
          label: 'settings.gin.knock',
          default: 'standard',
          options: [
            { value: 'standard', label: 'settings.gin.knock.standard' },
            { value: 'oklahoma', label: 'settings.gin.knock.oklahoma', help: 'settings.gin.knock.oklahoma.help' },
            { value: 'gin', label: 'settings.gin.knock.gin', help: 'settings.gin.knock.gin.help' },
          ],
        },
      ],
    },
    {
      title: 'settings.gin.group.modifiers',
      settings: [{ kind: 'toggle', id: 'doubleBonuses', label: 'settings.gin.double', help: 'settings.gin.double.help', default: false }],
    },
  ],
};

export interface GinChoices {
  difficulty: Difficulty;
  rules: GinRules;
}

/** Turns the saved settings values into what a match is started with. The values are already checked against the schema. */
export function ginChoices(values: SettingValues): GinChoices {
  const bonusFactor = values.doubleBonuses === true ? 2 : 1;
  return {
    difficulty: values.difficulty as Difficulty,
    rules: {
      target: Number(values.target),
      knockRule: values.knockRule as KnockRule,
      ginBonus: GIN_BONUS * bonusFactor,
      undercutBonus: UNDERCUT_BONUS * bonusFactor,
    },
  };
}

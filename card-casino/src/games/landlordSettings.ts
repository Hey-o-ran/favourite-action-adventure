import type { SettingsSchema, SettingValues } from '../gameSettings';
import { DEFAULT_OPTIONS, type RuleOptions } from './landlordRules';

/** What Landlord lets you change: the four rules that can be switched on or off. Everything else is always on. */
export const LANDLORD_SETTINGS: SettingsSchema = {
  gameId: 'landlord',
  groups: [
    {
      title: 'settings.landlord.group.rules',
      settings: [
        { kind: 'toggle', id: 'planes', label: 'settings.landlord.planes', help: 'settings.landlord.planes.help', default: DEFAULT_OPTIONS.planes },
        { kind: 'toggle', id: 'fourWithTwo', label: 'settings.landlord.fourWithTwo', help: 'settings.landlord.fourWithTwo.help', default: DEFAULT_OPTIONS.fourWithTwo },
        { kind: 'toggle', id: 'pairRuns', label: 'settings.landlord.pairRuns', help: 'settings.landlord.pairRuns.help', default: DEFAULT_OPTIONS.pairRuns },
        { kind: 'toggle', id: 'straightFlush', label: 'settings.landlord.straightFlush', help: 'settings.landlord.straightFlush.help', default: DEFAULT_OPTIONS.straightFlush },
      ],
    },
  ],
};

/** Turns the saved settings values into the rules a round is played with. The values are already checked against the schema. */
export const landlordOptions = (values: SettingValues): RuleOptions => ({
  planes: values.planes === true,
  fourWithTwo: values.fourWithTwo === true,
  pairRuns: values.pairRuns === true,
  straightFlush: values.straightFlush === true,
});

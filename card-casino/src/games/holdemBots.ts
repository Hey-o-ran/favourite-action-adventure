import { legalActions, type Action, type HoldemState } from './holdemRules';

/**
 * What a bot does when it's its turn. For now bots simply check when they can and call otherwise:
 * they never fold or raise. The next stage swaps this for hand-strength thresholds.
 */
export function botAction(s: HoldemState): Action {
  return legalActions(s).check ? 'check' : 'call';
}

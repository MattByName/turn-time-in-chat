const MODULE_ID = 'turn-time-in-chat' as const;

type SettingKey =
  | 'compactMessages'
  | 'minimumTurnLength'
  | 'postInChat'
  | 'messagesGMOnly'
  | 'playersSeeTimerButton'
  | 'autoShowEncounterTimer'
  | 'hideNonPlayerTurns'
  | 'hideNonPlayerNames'
  | 'trackDeadCreatures'
  | 'postTurnLength'
  | 'postRoundLength'
  | 'postCombatLength'
  | 'postTotalTurns';

type SettingValueMap = {
  compactMessages: boolean;
  minimumTurnLength: number;
  postInChat: boolean;
  messagesGMOnly: boolean;
  playersSeeTimerButton: boolean;
  autoShowEncounterTimer: boolean;
  hideNonPlayerTurns: boolean;
  hideNonPlayerNames: boolean;
  trackDeadCreatures: boolean;
  postTurnLength: boolean;
  postRoundLength: boolean;
  postCombatLength: boolean;
  postTotalTurns: boolean;
};

export function getSetting<K extends SettingKey>(key: K): SettingValueMap[K] {
  return (game.settings as any).get(MODULE_ID as any, key as any) as SettingValueMap[K];
}

export { MODULE_ID };

import { formatTime, getAuthoritativeNow } from "./util.ts";

const V2Api = (globalThis as any).foundry?.applications?.api;
const BaseApplication = V2Api?.ApplicationV2 && V2Api?.HandlebarsApplicationMixin
  ? V2Api.HandlebarsApplicationMixin(V2Api.ApplicationV2)
  : Application;

export class CombatTimerApp extends BaseApplication {
  private _updateInterval: number | null = null;
  private _options: any;
  private _combatId: string | null = null;

  constructor(options = {}) {
    super(options);
    this._options = options;
  }

  static get defaultOptions() {
    return {
      ...super.defaultOptions,
      id: 'combat-timer-app',
      title: 'Encounter Timer',
      template: 'modules/turn-time-in-chat/templates/combat-timer.html',
      width: 400,
      height: 'auto' as const,
      resizable: true,
      closeOnSubmit: false,
      popOut: true,
    };
  }

  static DEFAULT_OPTIONS = {
    id: 'combat-timer-app',
    tag: 'section',
    classes: ['turn-time-in-chat'],
    window: {
      title: 'Encounter Timer',
      resizable: true,
    },
    position: {
      width: 400,
      height: 'auto',
    },
  };

  static PARTS = {
    main: {
      template: 'modules/turn-time-in-chat/templates/combat-timer.html',
    },
  };

  getData() {
    const combatId = this._options.combatId;
    const combat = game.combats?.get(combatId) as Combat || game.combat;
    if (!combat) return { hasActiveCombat: false };

    this._combatId = combat.id;

    const fallbackNow = getAuthoritativeNow();
    const lastTurn = Number(combat.getFlag('turn-time-in-chat', 'lastTurnTime') ?? fallbackNow);
    const roundStartTime = Number(combat.getFlag('turn-time-in-chat', 'roundStartTime') ?? fallbackNow);
    const combatStartTime = Number(combat.getFlag('turn-time-in-chat', 'combatStartTime') ?? fallbackNow);
    const chatMessagesDisabled = combat.getFlag('turn-time-in-chat', 'timerDisabled') ?? false;
    const now = getAuthoritativeNow();

    return {
      hasActiveCombat: true,
      combat,
      currentRound: combat.round,
      currentTurn: combat.turn,
      currentCombatant: combat.combatant,
      turnElapsed: formatTime(now - lastTurn),
      roundElapsed: formatTime(now - roundStartTime),
      combatElapsed: formatTime(now - combatStartTime),
      turns: this._getTurnData(combat),
      messagesDisabled: chatMessagesDisabled,
      isGM: game.user?.isGM,
    };
  }

  async _prepareContext() {
    return this.getData();
  }

  _getTurnData(combat: Combat) {
    const turns = combat.getFlag('turn-time-in-chat', 'turnLengths') || {};
    const fallbackNow = getAuthoritativeNow();
    const lastTurn = Number(combat.getFlag('turn-time-in-chat', 'lastTurnTime') ?? fallbackNow);
    const now = fallbackNow;
    const currentTurnElapsed = now - lastTurn;

    const currentCombatant = combat.combatant;
    let actorId = currentCombatant?.actor?.id ?? '0';
    let actorName = currentCombatant?.actor?.name ?? 'Gamemaster';

    if (currentCombatant?.isNPC) {
      actorId = '0';
      actorName = 'Gamemaster';
    }

    const displayTurns = { ...turns } as Record<string, { name: string; turnLengthMS: number }>;
    displayTurns[actorId] = {
      name: actorName,
      turnLengthMS: currentTurnElapsed + (turns[actorId]?.turnLengthMS || 0),
    };

    const turnsArray = Object.values(displayTurns).map((data) => ({
      name: data.name,
      turnLengthMS: data.turnLengthMS,
      turnLength: formatTime(data.turnLengthMS),
    }));

    return turnsArray.sort((a, b) => b.turnLengthMS - a.turnLengthMS);
  }

  activateListeners(html: JQuery) {
    super.activateListeners(html);
    this._wireListeners(html[0] as HTMLElement | undefined);
    this._startAutoRefresh();
  }

  _onRender(_context: unknown, _options: unknown) {
    const root = this.element?.querySelector?.('.window-content') as HTMLElement | null;
    this._wireListeners(root ?? (this.element as HTMLElement | undefined));
    this._startAutoRefresh();
  }

  private _wireListeners(root: HTMLElement | undefined) {
    const wireFlagToggle = (selector: string, enabled: boolean, successMessage: string) => {
      const button = root?.querySelector(selector) as HTMLElement | null;
      if (!button || button.dataset.tticBound === 'true') return;
      button.dataset.tticBound = 'true';

      button.addEventListener('click', async () => {
        const combat = this._combatId ? game.combats?.get(this._combatId) as Combat : game.combat;
        if (!combat) {
          ui.notifications?.error('Failed to find the combat');
          this.render();
          return;
        }

        await combat.setFlag('turn-time-in-chat', 'timerDisabled', !enabled);
        ui.notifications?.info(successMessage);
        this.render();
      });
    };

    wireFlagToggle('.enable-messages', true, 'Timer Messages Enabled');
    wireFlagToggle('.disable-messages', false, 'Timer Messages Disabled');
  }

  _startAutoRefresh() {
    this._clearAutoRefresh();
    this._updateInterval = window.setInterval(() => {
      if (!game.combat?.started && (this._combatId && !game.combats?.get(this._combatId))) {
        this._clearAutoRefresh();
        return;
      }
      this.render(false);
    }, 1000);
  }

  _clearAutoRefresh() {
    if (this._updateInterval) {
      window.clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
  }

  close(options = {}) {
    this._clearAutoRefresh();
    return super.close(options);
  }
}

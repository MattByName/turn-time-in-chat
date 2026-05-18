// Turn Time In Chat - A FoundryVTT module to track combat round duration

import { postTurnMessage, postCombatRoundMessage, postEndCombatMessage } from "./modules/combatMessages.ts";
import { CombatTimerApp } from "./modules/combatTimerApp.ts";
import { sendChatMessage, updateCombatFlag } from "./modules/util.ts";
import { getSetting, MODULE_ID } from "./modules/settings.ts";


interface CombatTurnUpdateData {
  turn?: number;
}

interface CombatRoundUpdateData {
  round?: number;
}

interface CombatUpdateOptions {
  direction?: 1 | -1;
  advanceTime?: number;
}

type SettingConfig = {
  name: string;
  hint: string;
  scope: 'world';
  config: true;
  type: BooleanConstructor | NumberConstructor;
  default: boolean | number;
  onChange?: (value: boolean | number) => void;
};

function registerSetting(key: string, config: SettingConfig) {
  (game.settings as any).register(MODULE_ID as any, key as any, config as any);
}

let encounterTimerApp: CombatTimerApp | null = null;

function getActiveCombat(combatId?: string | null) {
  return (combatId ? game.combats?.get(combatId) : null) as Combat | null || game.combat;
}

function openEncounterTimer(combatId?: string | null) {
  const combat = getActiveCombat(combatId);
  if (!combat?.started) return;

  encounterTimerApp ??= new CombatTimerApp({combatId: combat.id});
  encounterTimerApp.render(true);
}

function closeEncounterTimer() {
  encounterTimerApp?.close();
  encounterTimerApp = null;
}

function autoShowEncounterTimer(combatId?: string | null) {
  if (getSetting('autoShowEncounterTimer')) {
    openEncounterTimer(combatId);
  }
}

function getRenderRoot(html: JQuery | HTMLElement | HTMLElement[] | undefined, app?: Application) {
  if (html instanceof HTMLElement) return html;
  if (Array.isArray(html)) return html[0];

  const appElement = (app as any)?.element;
  if (appElement instanceof HTMLElement) return appElement;

  return html?.[0] as HTMLElement | undefined || appElement?.[0] as HTMLElement | undefined;
}

function toggleCombatTimerMessages(combatId: string | undefined, disabled: boolean, button: HTMLButtonElement) {
  if (!combatId || !game.combats) {
    ui.notifications?.error("Failed to find the combat");
    return;
  }

  const combat = game.combats.get(combatId);
  if (!combat) {
    ui.notifications?.error("Failed to find the combat");
    return;
  }

  updateCombatFlag(combat as Combat, 'timerDisabled', disabled);
  ui.notifications?.info(disabled ? "Timer Messages Disabled" : "Timer Messages Enabled");
  button.disabled = true;
  button.textContent = disabled ? 'Timer Messages Disabled' : 'Timer Messages Enabled';
}

function styleCompactChatMessage(root: HTMLElement) {
  const message = root.querySelector('.turn-time-message-compact') as HTMLElement | null;
  if (!message || message.dataset.tticStyled === 'true') return;
  message.dataset.tticStyled = 'true';

  root.style.textAlign = 'center';
  root.style.margin = '2px';
  root.style.padding = '2px';

  const sender = root.querySelector('.message-sender');
  if (sender) sender.textContent = '';

  const metadata = root.querySelector('.message-metadata') as HTMLElement | null;
  if (metadata) metadata.style.display = 'none';

  const whisperTo = root.querySelector('.whisper-to') as HTMLElement | null;
  if (whisperTo) whisperTo.style.display = 'none';

  if (game.user?.isGM) {
    message.style.position = 'relative';

    const content = message.innerHTML;
    message.innerHTML = `<div class="centered-content">${content}</div>`;

    const wrapper = document.createElement('span');
    wrapper.style.position = 'absolute';
    wrapper.style.right = '4px';
    wrapper.style.top = '0px';
    wrapper.style.fontSize = 'var(--font-size-12)';

    const anchor = document.createElement('a');
    anchor.className = 'button message-header message-delete';
    anchor.innerHTML = '<i class="fas fa-trash"></i>';

    wrapper.appendChild(anchor);
    message.appendChild(wrapper);

    const centered = message.querySelector('.centered-content') as HTMLElement | null;
    if (centered) {
      centered.style.display = 'inline-block';
      centered.style.maxWidth = 'calc(100% - 20px)';
      centered.style.textAlign = 'center';
    }
  }
}

Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Initializing Turn Time In Chat`);
  if (!game.settings) return;

  // Register module settings

  registerSetting("compactMessages", {
    name: "Compact Messages",
    hint: "When enabled, the messages in chat are made far more compact.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  registerSetting("minimumTurnLength", {
      name: "Minimum Time To Track (seconds)",
      hint: "Doesn't track turns shorter than this. Set to 0 to track all turns.",
      scope: "world",
      config: true,
      type: Number,
      default: 5,
  });

  registerSetting("postInChat", {
    name: "Post Messages In Chat",
    hint: "When enabled, posts messages in chat. If disabled, you can still enable it per-encounter.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  registerSetting("messagesGMOnly", {
    name: "Make all messages GM only",
    hint: "When enabled, all messages will be sent to the DM alone, and players won't be able to see any chat messages.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  registerSetting("playersSeeTimerButton", {
    name: "Let players see the Encounter Timer Button",
    hint: "When disabled, players can't see the encounter timer button (in the encounter tab, to the left of the rounds display, when an encounter is active).",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  registerSetting("autoShowEncounterTimer", {
    name: "Automatically Show Encounter Timer Window",
    hint: "When enabled, the encounter timer window opens automatically for each user when an encounter is active.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => autoShowEncounterTimer(),
  });

  registerSetting("hideNonPlayerTurns", {
      name: "Hide Non-Player Turn Lengths",
      hint: "When enabled, doesn't post turn lengths for non-player characters.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false
  });
  
  registerSetting("hideNonPlayerNames", {
      name: "Hide Non-Player Names",
      hint: "When enabled, doesn't post the names of non-player characters.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false
  });

  registerSetting("trackDeadCreatures", {
      name: "Track Dead Creatures",
      hint: "When enabled, dead creature turns are tracked.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
  });

  registerSetting("postTurnLength", {
      name: "Post Turn Length",
      hint: "When enabled, posts the length of turns.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
  });

  registerSetting("postRoundLength", {
      name: "Post Round Length",
      hint: "When enabled, posts the length of rounds.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
  });

  registerSetting("postCombatLength", {
      name: "Post Encounter Length",
      hint: "When enabled, posts the length of encounters.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
  });

  registerSetting("postTotalTurns", {
    name: "Post Total Character Turns",
    hint: "When enabled, posts the total length of character's turns throughout the entire encounter at the end of encounter.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
} as any);
  document.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    const button = target?.closest('.disable-combat-timer, .enable-combat-timer') as HTMLButtonElement | null;
    if (!button) return;

    event.preventDefault();
    toggleCombatTimerMessages(
      button.dataset.combatId,
      button.classList.contains('disable-combat-timer'),
      button,
    );
  });
});

// When Foundry is ready, check for existing combats and initialize them
Hooks.once('ready', () => {
  // Get all active combats and initialize their timers
  game.combats?.forEach((combat: Combat | any) => {
    const now = Date.now();
    
    // Check and set roundStartTime if needed
    if (combat.started && !combat.getFlag(MODULE_ID, 'roundStartTime')) {
      updateCombatFlag(combat as Combat, 'roundStartTime', now);
    }
    
    // Check and set lastTurnTime if needed
    if (combat.started && !combat.getFlag(MODULE_ID, 'lastTurnTime')) {
      updateCombatFlag(combat as Combat, 'lastTurnTime', now);
    }
    
    // Check and set combatStartTime if needed
    if (combat.started && !combat.getFlag(MODULE_ID, 'combatStartTime')) {
      updateCombatFlag(combat as Combat, 'combatStartTime', now);
    }

    // Check and set turnLengths if needed
    if (combat.started && !combat.getFlag(MODULE_ID, 'turnLengths')) {
      updateCombatFlag(combat as Combat, 'turnLengths', {});
    }
    
  });
  game.socket?.on(`module.${MODULE_ID}`, async (data) => {
    if (!game.users?.activeGM?.isSelf) return;

    if (data.action === 'updateCombatFlag') {
      const combat = game.combats?.get(data.combatId);
      if (combat) {
        try {
          await (combat as any).setFlag(MODULE_ID, data.flag, data.value);
        } catch (error) {
          console.warn('turn-time-in-chat | Socket flag update failed', { combatId: data.combatId, flag: data.flag, error });
        }
      }
    } 
    
    else if (data.action === 'sendPrivateMessage') {
      sendChatMessage(JSON.parse(data.message))
    }
  })

  autoShowEncounterTimer();
});

// When combat starts, begin tracking
Hooks.on('combatStart', (combat: Combat) => {
  const now = Date.now();
  
  const chatEnabled = getSetting('postInChat');
  updateCombatFlag(combat as Combat, 'roundStartTime', now);
  updateCombatFlag(combat as Combat, 'lastTurnTime', now);
  updateCombatFlag(combat as Combat, 'combatStartTime', now);
  updateCombatFlag(combat as Combat, 'timerDisabled', !chatEnabled);
  updateCombatFlag(combat as Combat, 'turnLengths', {});
  
  // Announce combat start - whispered to GM only with confirmation button
  if (chatEnabled) {
    sendChatMessage({message: 
      `<h3>Combat Started</h3>
        <p>Sending messages for this encounter.</p>
        <button type="button" class="disable-combat-timer" data-combat-id="${combat.id}">Disable Timer Messages For This Encounter</button>`
      , options: {
          speaker: {alias: 'Turn Length'},
          type: CONST.CHAT_MESSAGE_STYLES.OTHER,
      }, isPrivate: true})
  } else {
    sendChatMessage({message: 
      `<h3>Combat Started</h3>
        <p>Not sending messages for this encounter.</p>
        <button type="button" class="enable-combat-timer" data-combat-id="${combat.id}">Enable Timer Messages For This Encounter</button>`
      , options: {
          speaker: {alias: 'Turn Length'},
          type: CONST.CHAT_MESSAGE_STYLES.OTHER,
      }, isPrivate: true})
  }

  autoShowEncounterTimer(combat.id);
});

// When a combat turn changes, post time elapsed
Hooks.on('combatTurn', (combat: Combat, _updateData: CombatTurnUpdateData, _updateOptions: CombatUpdateOptions) => {
  postTurnMessage(combat)
});

// When a combat round changes, post round time
Hooks.on('combatRound', (combat: Combat, _updateData: CombatRoundUpdateData, _updateOptions: CombatUpdateOptions) => {
  postTurnMessage(combat)
  postCombatRoundMessage(combat)
});

// When combat ends, post total time and clean up
Hooks.on('deleteCombat', (combat: Combat) => {
  closeEncounterTimer();

  if (!game.users?.activeGM?.isSelf) return;
  postTurnMessage(combat)
  postCombatRoundMessage(combat)
  postEndCombatMessage(combat)
});

Hooks.on('renderCombatTracker', (app: Application, html: JQuery | HTMLElement | HTMLElement[], data: any) => {
  // Only show button if there's an active combat
  const combat = getActiveCombat(data?.combat?.id ?? (app as any).viewed?.id);
  if (!combat?.started) return;

  // don't show to players if it's disabled
  const timerEnabled = getSetting('playersSeeTimerButton');
  if (!timerEnabled && !game.user?.isGM) return;

  const root = getRenderRoot(html, app);
  if (!root) return;

  // Prevent duplicate insertion on re-render
  if (root.querySelector('.turn-time-combat-button')) return;

  const encountersNav = root.querySelector('nav.encounters') as HTMLElement | null;
  const trackerSettingsButton = encountersNav?.querySelector('[data-action="trackerSettings"]') as HTMLElement | null;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'inline-control icon fa-solid fa-clock turn-time-combat-button';
  button.setAttribute('aria-label', 'Encounter Timer');
  button.setAttribute('data-tooltip', 'Encounter Timer');

  if (encountersNav) {
    encountersNav.insertBefore(button, trackerSettingsButton);
  } else {
    const fallbackTarget = root.querySelector('.encounter-title, .combat-tracker-header, .combat-controls, .directory-header, header') as HTMLElement | null;
    const fallbackParent = fallbackTarget?.parentElement || root.querySelector('.window-content') as HTMLElement | null || root;
    button.style.margin = '4px';
    fallbackParent.prepend(button);
  }

  button.addEventListener('click', (ev) => {
    ev.preventDefault();
    openEncounterTimer(combat.id);
  });
});

// Portions of the code below based on health-monitor 
// Copyright (c) 2021 jessev14
// https://github.com/jessev14/health-monitor
// Licensed under the MIT License
// Open source is the best!

function applyCompactChatMessageStyles(_message: unknown, html: JQuery | HTMLElement, _data: any) {
  const root = html instanceof HTMLElement ? html : html[0] as HTMLElement | undefined;
  if (!root) return;

  styleCompactChatMessage(root);
}

// Apply custom CSS to chat messages.
Hooks.on("renderChatMessage", applyCompactChatMessageStyles);
Hooks.on("renderChatMessageHTML", applyCompactChatMessageStyles);

import { getSetting } from "./settings.ts";

let authoritativeTimeOffsetMS = 0;
let nextTimeSyncRequestId = 0;
const pendingTimeSyncRequests = new Map<string, number>();

// Helper function to format milliseconds into a readable time string
export function formatTime(ms: number): string {
  // Time constants in milliseconds
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY; // Approximation
  const YEAR = 365 * DAY; // Approximation

  // Calculate time units
  const years = Math.floor(ms / YEAR);
  ms %= YEAR;
  
  const months = Math.floor(ms / MONTH);
  ms %= MONTH;
  
  const weeks = Math.floor(ms / WEEK);
  ms %= WEEK;
  
  const days = Math.floor(ms / DAY);
  ms %= DAY;
  
  const hours = Math.floor(ms / HOUR);
  ms %= HOUR;
  
  const minutes = Math.floor(ms / MINUTE);
  ms %= MINUTE;
  
  const seconds = Math.floor(ms / SECOND);

  // Format the string
  const parts: string[] = [];
  
  if (years > 0) {
    parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  }
  
  if (months > 0) {
    parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  }
  
  if (weeks > 0) {
    parts.push(`${weeks} ${weeks === 1 ? 'week' : 'weeks'}`);
  }
  
  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  }
  
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }
  
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }
  
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
  }
  
  if (parts.length > 1) {
    const lastPart = parts.pop();
    return parts.join(', ') + ' and ' + lastPart;
  } else {
    return parts.join(', ');
  }
}

export function formatTimeCompact(ms: number): string {
  // Time constants in milliseconds
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY; // Approximation
  const YEAR = 365 * DAY; // Approximation

  // Calculate time units
  const years = Math.floor(ms / YEAR);
  ms %= YEAR;
  
  const months = Math.floor(ms / MONTH);
  ms %= MONTH;
  
  const weeks = Math.floor(ms / WEEK);
  ms %= WEEK;
  
  const days = Math.floor(ms / DAY);
  ms %= DAY;
  
  const hours = Math.floor(ms / HOUR);
  ms %= HOUR;
  
  const minutes = Math.floor(ms / MINUTE);
  ms %= MINUTE;
  
  const seconds = Math.floor(ms / SECOND);

  // Format the string
  const parts: string[] = [];
  
  if (years > 0) {
    parts.push(`${years}y`);
  }
  
  if (months > 0) {
    parts.push(`${months}m`);
  }
  
  if (weeks > 0) {
    parts.push(`${weeks}w`);
  }
  
  if (days > 0) {
    parts.push(`${days}d`);
  }
  
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds}s`);
  }
  
  return parts.join(', ');
}

export function getAuthoritativeNow(): number {
  if (game.user?.isGM) return Date.now();
  return Date.now() + authoritativeTimeOffsetMS;
}

export function createTimeSyncRequest() {
  const requestId = `${game.user?.id ?? 'user'}-${++nextTimeSyncRequestId}`;
  const clientSentAt = Date.now();
  pendingTimeSyncRequests.set(requestId, clientSentAt);
  return { requestId, clientSentAt };
}

export function applyTimeSyncResponse(requestId: string, authoritativeNow: number) {
  const clientSentAt = pendingTimeSyncRequests.get(requestId);
  if (clientSentAt === undefined) return;

  pendingTimeSyncRequests.delete(requestId);

  const clientReceivedAt = Date.now();
  const estimatedClientNowAtSample = clientSentAt + ((clientReceivedAt - clientSentAt) / 2);
  authoritativeTimeOffsetMS = authoritativeNow - estimatedClientNowAtSample;
}

export function updateCombatFlag(combat: Combat, flag: string, update: unknown) {
  if (game.user?.isGM) {
    //this does leave me open to a minor race condition, but whatever
    //this can error out if the combat is over (this is async)
    combat.setFlag("turn-time-in-chat", flag as any, update).catch((error) => {
      console.warn('turn-time-in-chat | Failed to set combat flag', { combatId: combat.id, flag, error });
    })
  } else {
    game.socket?.emit('module.turn-time-in-chat', {
      action: 'updateCombatFlag',
      combatId: combat.id,
      flag: flag,
      value: update
    });
  }
}

export function sendChatMessage(chatMessage: {options?: Object, message: string, isPrivate?: boolean, compact?: boolean}) {
  let div = "turn-time-message"
  if (chatMessage.compact)
    div = "turn-time-message-compact"

  const privatMessageConfig = getSetting('messagesGMOnly');
  if (privatMessageConfig === true) {
    chatMessage.isPrivate = true
  }

  if (chatMessage.isPrivate) {
    if (game.user?.isGM) {
      ChatMessage.create({
        content: `
          <div class="${div}">
            ${chatMessage.message}
          </div>
        `,
        whisper: ChatMessage.getWhisperRecipients("GM") as Array<any>,
        ...chatMessage.options
      });
    }
    else {
      game.socket?.emit('module.turn-time-in-chat', {
        action: 'sendPrivateMessage',
        message: JSON.stringify(chatMessage)
      });
    }
  } else {
    ChatMessage.create({
      content: `
        <div class="${div}">
          ${chatMessage.message}
        </div>
      `,
      ...chatMessage.options
    });
  }
}

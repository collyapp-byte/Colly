/**
 * The tenant facts the Channels hub renders.
 *
 * A subset of `Business` on purpose: the hub only needs to know which channels
 * have a stored credential and the two public identities those credentials
 * produce (the bot username and the Discord server id). Everything else a card
 * shows comes from `lib/channels.ts`.
 */
export type ChannelBusinessView = {
  id: string;
  name: string;
  telegramConnected: boolean;
  telegramBotUsername: string | null;
  discordConnected: boolean;
  discordGuildId: string | null;
  /** The owner's personal Telegram chat, set by sending `/startowner`. */
  ownerTelegramChatId: string | null;
};

/** A partial update a channel panel pushes back into the hub. */
export type ChannelBusinessPatch = Partial<
  Pick<
    ChannelBusinessView,
    | "telegramConnected"
    | "telegramBotUsername"
    | "discordConnected"
    | "discordGuildId"
    | "ownerTelegramChatId"
  >
>;

"use client";

import { useState, type FormEvent } from "react";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { saveDiscordBotToken } from "@/app/api/discord/actions";
import type { ChannelBusinessPatch, ChannelBusinessView } from "./types";

/**
 * Discord setup inside a Channels card.
 *
 * Reuses the same Server Action the AI Line settings page calls, so the token
 * and server id are validated and written by one owner-only code path.
 */

const INPUT_CLASS =
  "w-full rounded-lg border border-card-border bg-card-surface px-3 py-2 text-sm text-main outline-none transition-all duration-250 focus:border-colly focus:ring-2 focus:ring-colly/20";

export function DiscordPanel({
  business,
  isOwner,
  onChange,
}: {
  business: ChannelBusinessView;
  isOwner: boolean;
  onChange: (patch: ChannelBusinessPatch) => void;
}) {
  const [token, setToken] = useState("");
  const [guildId, setGuildId] = useState(business.discordGuildId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);

    try {
      const result = await saveDiscordBotToken({
        botToken: token.trim(),
        guildId,
      });

      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      setToken("");
      setNotice(
        "Discord bot connected. Messages in your server are now answered by your AI assistant.",
      );
      toast.success("Discord bot connected!");
      onChange({
        discordConnected: true,
        discordGuildId: result.discordGuildId,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (!isOwner) {
    return (
      <div className="text-sm text-muted">
        <p className="inline-flex items-center gap-2 font-medium text-main">
          <MessageSquare className="h-4 w-4 text-colly" aria-hidden />
          Discord is managed by the business owner.
        </p>
        <p className="mt-2 text-xs leading-relaxed">
          Ask the owner to connect the bot. You can reply to every Discord
          conversation from the inbox.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs leading-relaxed text-muted">
        Paste the bot token from the Discord Developer Portal. Add the bot to
        your server first, then paste the server id so Colly knows where to
        answer.
      </p>

      <div>
        <label
          htmlFor="channels-discord-token"
          className="mb-1 block text-xs font-medium text-main"
        >
          Discord bot token
        </label>
        <input
          id="channels-discord-token"
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder={business.discordConnected ? "Leave blank to keep the saved token" : "Bot token"}
          autoComplete="off"
          required={!business.discordConnected}
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label
          htmlFor="channels-discord-guild"
          className="mb-1 block text-xs font-medium text-main"
        >
          Server id (optional)
        </label>
        <input
          id="channels-discord-guild"
          type="text"
          inputMode="numeric"
          value={guildId}
          onChange={(event) => setGuildId(event.target.value)}
          placeholder="e.g. 123456789012345678"
          autoComplete="off"
          className={INPUT_CLASS}
        />
        <p className="mt-1 text-xs text-muted">
          Enable Developer Mode in Discord, right-click your server, then copy
          the server id.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-success">
          {notice}
        </p>
      )}

      <Button type="submit" size="sm" isLoading={saving}>
        <MessageSquare className="mr-2 h-4 w-4" aria-hidden />
        {business.discordConnected ? "Update Discord token" : "Connect Discord"}
      </Button>

      {business.discordConnected && business.discordGuildId && (
        <p className="text-xs text-muted">
          Answering in server {business.discordGuildId}.
        </p>
      )}
    </form>
  );
}

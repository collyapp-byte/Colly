import { formatMessageTime } from "@/lib/format";

type ChatBubbleProps = {
  sender: string;
  content: string;
  createdAt: string;
};

/**
 * A single chat message, styled like a native messaging app (WhatsApp/iMessage).
 *
 * - "customer" -> inbound: left aligned, light grey bubble, dark text, the
 *   rounded corner points at the avatar side (top left).
 * - "ai" / "agent" -> outbound: right aligned, brand orange bubble, white
 *   text, the rounded corner points at the sender side (top right).
 *
 * Both outbound senders share the same colour, so the author (Colly AI or you)
 * and the timestamp sit inside the bubble, bottom right, in small
 * semi-transparent text — the same place a native chat app puts its clock.
 */
export function ChatBubble({ sender, content, createdAt }: ChatBubbleProps) {
  const isCustomer = sender === "customer";
  const isAgent = sender === "agent";

  const label = isCustomer ? "Customer" : isAgent ? "You" : "Colly AI";

  return (
    <div className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
          isCustomer
            ? "rounded-tl-sm bg-gray-100 text-gray-900"
            : "rounded-tr-sm bg-[#FF6600] text-white"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{content}</p>
        <p
          className={`mt-1 text-right text-[10px] leading-none ${
            isCustomer ? "text-gray-900/60" : "text-white/75"
          }`}
        >
          <span className="sr-only">Sent by </span>
          {label} · {formatMessageTime(createdAt)}
        </p>
      </div>
    </div>
  );
}

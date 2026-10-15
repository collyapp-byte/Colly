import { formatMessageTime } from "@/lib/format";

type ChatBubbleProps = {
  sender: string;
  content: string;
  createdAt: string;
};

/**
 * A single chat message.
 * - "customer" -> left aligned, white bubble
 * - "ai"       -> right aligned, soft orange (colly-light) bubble
 * - "agent"    -> right aligned, solid orange bubble (human takeover)
 */
export function ChatBubble({ sender, content, createdAt }: ChatBubbleProps) {
  const isCustomer = sender === "customer";
  const isAgent = sender === "agent";

  const bubbleStyles = isCustomer
    ? "border border-gray-200 bg-surface text-gray-700"
    : isAgent
      ? "bg-colly text-white"
      : "bg-colly-light text-gray-900";

  const label = isCustomer ? "Customer" : isAgent ? "You" : "Colly AI";

  return (
    <div className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
      <div className="max-w-[85%] sm:max-w-[70%]">
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${bubbleStyles}`}
        >
          {content}
        </div>
        <p
          className={`mt-1 text-[11px] text-gray-400 ${
            isCustomer ? "text-left" : "text-right"
          }`}
        >
          {label} · {formatMessageTime(createdAt)}
        </p>
      </div>
    </div>
  );
}

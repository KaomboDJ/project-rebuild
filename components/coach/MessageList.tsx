import { Loader2 } from "lucide-react";
import type { ChatMessage } from "@/lib/coach/types";
import { MarkdownMessage } from "./MarkdownMessage";
import { ToolCallCard } from "./ToolCallCard";

export function MessageList({
  messages,
  sending,
  error,
  emptyHint,
  onResolveToolCall,
}: {
  messages: ChatMessage[];
  sending: boolean;
  error: string | null;
  emptyHint: string;
  onResolveToolCall: (messageId: string, toolCallId: string, decision: "confirm" | "decline") => void;
}) {
  return (
    <>
      {messages.length === 0 && <p className="text-sm text-neutral-500">{emptyHint}</p>}
      {messages.map((message) => (
        <div key={message.id} className={message.role === "user" ? "ml-auto max-w-[90%]" : "max-w-[90%] space-y-2"}>
          {(message.role === "user" || message.content.trim().length > 0) && (
            <div
              className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                message.role === "user" ? "bg-emerald-600 text-white" : "bg-white/[0.05] text-neutral-200"
              }`}
            >
              {message.role === "assistant" ? <MarkdownMessage content={message.content} /> : message.content}
            </div>
          )}
          {message.toolCalls.length > 0 && (
            <div className="space-y-1.5">
              {message.toolCalls.map((call) => (
                <ToolCallCard
                  key={call.id}
                  toolCall={call}
                  onConfirm={() => onResolveToolCall(message.id, call.id, "confirm")}
                  onDecline={() => onResolveToolCall(message.id, call.id, "decline")}
                />
              ))}
            </div>
          )}
        </div>
      ))}
      {sending && (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Loader2 size={13} className="animate-spin" />
          A pensar...
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </>
  );
}

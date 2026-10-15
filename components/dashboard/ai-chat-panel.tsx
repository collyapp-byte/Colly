"use client";

import { ChevronDown, Edit3, Mic, Send } from "lucide-react";

export function AiChatPanel() {
  return (
    <div className="fixed top-14 bottom-0 right-0 z-30 flex w-[320px] flex-col border-l border-[#E5E7EB] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <button
          type="button"
          className="flex items-center gap-1 text-[13px] font-medium text-gray-700"
        >
          New conversation
          <ChevronDown className="h-3.5 w-3.5 text-gray-500" aria-hidden />
        </button>
        <button type="button" className="rounded-md p-1 hover:bg-gray-50">
          <Edit3 className="h-3.5 w-3.5 text-gray-500" aria-hidden />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <p className="text-center text-lg font-semibold leading-snug text-gray-900">
          What would you like to understand about your business today?
        </p>
      </div>

      {/* Input */}
      <div className="mx-4 mb-3 relative rounded-xl border border-[#2563EB] bg-white p-3">
        <textarea
          rows={2}
          placeholder="Ask and learn anything about your business."
          className="w-full resize-none border-none bg-transparent text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
        <button
          type="button"
          className="absolute bottom-2 left-2 rounded-md p-1 hover:bg-gray-50"
        >
          <Mic className="h-3.5 w-3.5 text-gray-400" aria-hidden />
        </button>
        <button
          type="button"
          className="absolute bottom-2 right-2 rounded-md p-1 hover:bg-gray-50"
        >
          <Send className="h-3.5 w-3.5 text-gray-400" aria-hidden />
        </button>
      </div>

      {/* Suggestions */}
      <div className="flex gap-2 px-4 pb-4">
        <button
          type="button"
          className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
        >
          What can you do?
        </button>
        <button
          type="button"
          className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
        >
          This week's average transaction
        </button>
      </div>
    </div>
  );
}

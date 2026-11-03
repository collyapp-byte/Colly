"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

interface SetupChecklistProps {
  hasProducts: boolean;
  hasAiReply: boolean;
}

export function SetupChecklist({ hasProducts, hasAiReply }: SetupChecklistProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  const [message, setMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (hasProducts && hasAiReply) return null;

  if (!hasProducts) {
    const handleAddProduct = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmittingProduct(true);
      setError(null);

      try {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, price: Number(price), description }),
        });

        if (!res.ok) throw new Error("Failed to add product");
        
        router.refresh(); 
      } catch (err) {
        setError("Could not save product. Please try again.");
      } finally {
        setIsSubmittingProduct(false);
      }
    };

    return (
      <div className="mb-8 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-2">Step 1: Add your first product</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Your AI needs at least one product to sell. Let&apos;s add one to get started.
        </p>
        <form onSubmit={handleAddProduct} className="flex flex-col gap-3 max-w-md">
          <input
            required
            placeholder="Product name (e.g., Samsung TV 42')"
            className="border p-2 rounded-md bg-background"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            required
            type="number"
            placeholder="Price in Naira (e.g., 150000)"
            className="border p-2 rounded-md bg-background"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <textarea
            required
            placeholder="Short description"
            className="border p-2 rounded-md bg-background"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={isSubmittingProduct}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium flex items-center justify-center gap-2"
          >
            {isSubmittingProduct && <Loader2 className="w-4 h-4 animate-spin" />}
            Save product
          </button>
        </form>
      </div>
    );
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSendingMessage(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding/test-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          setError("You don't have enough credits to test the AI. Please top up.");
        } else {
          setError(data.error || "Failed to get a reply");
        }
        return;
      }

      setAiReply(data.reply);
      setMessage("");
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <div className="mb-8 rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        Step 2: Hear your shop bot
      </h2>
      <p className="text-muted-foreground mb-4 text-sm">
        Ask the AI a question about the product you just added.
      </p>

      {!aiReply ? (
        <form onSubmit={handleSendMessage} className="flex flex-col gap-3 max-w-md">
          <div className="flex gap-2">
            <input
              required
              placeholder="e.g., How much is the Samsung TV?"
              className="border p-2 rounded-md bg-background flex-1"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSendingMessage}
            />
            <button
              type="submit"
              disabled={isSendingMessage || !message.trim()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium flex items-center justify-center gap-2"
            >
              {isSendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </form>
      ) : (
        <div className="flex flex-col gap-4 max-w-md">
          <div className="bg-muted p-4 rounded-md">
            <p className="text-sm text-muted-foreground mb-1">Customer:</p>
            <p className="mb-3">{message || "How much is the Samsung TV?"}</p>
            <p className="text-sm text-muted-foreground mb-1">Colly AI:</p>
            <p className="font-medium">{aiReply}</p>
          </div>
          <button
            onClick={() => router.refresh()}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium"
          >
            Looks good, take me to my dashboard
          </button>
        </div>
      )}
    </div>
  );
}
"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Check, Loader2, Zap, MessageSquare, Package, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type OnboardingStep = "catalogue" | "telegram" | "test-chat" | "complete";

interface Product {
  id?: string;
  name: string;
  price: number;
}

interface WizardState {
  currentStep: OnboardingStep;
  product: Product;
  telegramConnected: boolean;
  testMessage: string;
  testResponse: string;
  isLoading: boolean;
  stepCompleted: Record<OnboardingStep, boolean>;
}

const STEPS: { id: OnboardingStep; label: string; icon: React.ReactNode }[] = [
  { id: "catalogue", label: "Add Product", icon: <Package className="h-4 w-4" /> },
  { id: "telegram", label: "Connect Telegram", icon: <Bot className="h-4 w-4" /> },
  { id: "test-chat", label: "Test AI", icon: <MessageSquare className="h-4 w-4" /> },
  { id: "complete", label: "Done", icon: <Check className="h-4 w-4" /> },
];

export function OnboardingWizard({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [state, setState] = useState<WizardState>({
    currentStep: "catalogue",
    product: { name: "", price: 0 },
    telegramConnected: false,
    testMessage: "",
    testResponse: "",
    isLoading: false,
    stepCompleted: { catalogue: false, telegram: false, "test-chat": false, complete: false },
  });

  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    async function checkOnboardingStatus() {
      try {
        const res = await fetch("/api/onboarding/status");
        if (res.ok) {
          const data = await res.json();
          if (data.completed) {
            onClose();
            return;
          }
          if (data.product) {
            setState((s) => ({
              ...s,
              product: data.product,
              stepCompleted: { ...s.stepCompleted, catalogue: true },
              currentStep: data.telegramConnected ? "test-chat" : "telegram",
            }));
          }
          if (data.telegramConnected) {
            setState((s) => ({ ...s, telegramConnected: true, stepCompleted: { ...s.stepCompleted, telegram: true } }));
          }
        }
      } catch (e) {
        console.warn("Onboarding status check failed", e);
      }
    }
    checkOnboardingStatus();
  }, [onClose]);

  const updateProduct = useCallback((field: keyof Product, value: string | number) => {
    setState((s) => ({ ...s, product: { ...s.product, [field]: value } }));
  }, []);

  const saveProduct = async () => {
    if (!state.product.name.trim() || state.product.price <= 0) {
      toast.error("Please enter a product name and valid price");
      return;
    }
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const res = await fetch("/api/onboarding/catalogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.product),
      });
      if (!res.ok) throw new Error("Failed to save product");
      setState((s) => ({
        ...s,
        stepCompleted: { ...s.stepCompleted, catalogue: true },
        currentStep: "telegram",
        isLoading: false,
      }));
      toast.success("Product saved!");
    } catch (e) {
      setState((s) => ({ ...s, isLoading: false }));
      toast.error("Failed to save product");
    }
  };

  const connectTelegram = async () => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const res = await fetch("/api/onboarding/telegram", { method: "POST" });
      if (!res.ok) throw new Error("Failed to connect Telegram");
      setState((s) => ({
        ...s,
        telegramConnected: true,
        stepCompleted: { ...s.stepCompleted, telegram: true },
        currentStep: "test-chat",
        isLoading: false,
      }));
      toast.success("Telegram connected!");
    } catch (e) {
      setState((s) => ({ ...s, isLoading: false }));
      toast.error("Failed to connect Telegram");
    }
  };

  const sendTestMessage = async () => {
    if (!state.testMessage.trim()) return;
    setState((s) => ({ ...s, isLoading: true, testResponse: "" }));
    try {
      const res = await fetch("/api/onboarding/test-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: state.testMessage, product: state.product }),
      });
      if (!res.ok) throw new Error("AI response failed");
      const data = await res.json();
      setState((s) => ({
        ...s,
        testResponse: data.response,
        stepCompleted: { ...s.stepCompleted, "test-chat": true },
        currentStep: "complete",
        isLoading: false,
      }));
      setTimeout(() => setShowCelebration(true), 300);
      toast.success("AI responded! You're live!");
    } catch (e) {
      setState((s) => ({ ...s, isLoading: false }));
      toast.error("Failed to get AI response");
    }
  };

  const completeOnboarding = async () => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
      setState((s) => ({ ...s, stepCompleted: { ...s.stepCompleted, complete: true }, isLoading: false }));
      onComplete();
      onClose();
    } catch (e) {
      setState((s) => ({ ...s, isLoading: false }));
      toast.error("Failed to complete onboarding");
    }
  };

  const progress = Object.values(state.stepCompleted).filter(Boolean).length / 4 * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="border-b border-gray-200 bg-gradient-to-r from-colly to-colly/80 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 id="wizard-title" className="font-display text-xl sm:text-2xl font-bold text-white">
              Welcome to Colly! Let's get you selling in 3 steps.
            </h1>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close onboarding"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Onboarding progress"
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-white/80">
            {STEPS.map((step) => (
              <div key={step.id} className="flex flex-col items-center gap-1 relative">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                    state.stepCompleted[step.id]
                      ? "bg-white border-white text-colly"
                      : state.currentStep === step.id
                      ? "border-white text-white bg-white/10"
                      : "border-white/30 text-white/50 bg-transparent"
                  }`}
                >
                  {state.stepCompleted[step.id] ? <Check className="h-4 w-4" /> : step.icon}
                </div>
                <span
                  className={`font-medium transition-colors ${
                    state.stepCompleted[step.id] || state.currentStep === step.id ? "text-white" : "text-white/60"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {state.currentStep === "catalogue" && (
            <div className="animate-in slide-in-from-right-2 fade-in duration-300" role="region" aria-label="Add your first product">
              <div className="flex items-center gap-2 text-colly mb-4">
                <Zap className="h-5 w-5" />
                <h2 className="font-display text-lg font-semibold text-gray-900">Step 1: Add your first product</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Tell us what you're selling. This helps your AI assistant answer customer questions instantly.
              </p>
              <div className="space-y-4">
                <div>
                  <label htmlFor="product-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Product / Service Name
                  </label>
                  <input
                    id="product-name"
                    type="text"
                    value={state.product.name}
                    onChange={(e) => updateProduct("name", e.target.value)}
                    placeholder="e.g., Ankara Dresses, Web Design, Catering"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-colly focus:ring-2 focus:ring-colly/20 outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="product-price" className="block text-sm font-medium text-gray-700 mb-1">
                    Price (₦)
                  </label>
                  <input
                    id="product-price"
                    type="number"
                    value={state.product.price}
                    onChange={(e) => updateProduct("price", parseFloat(e.target.value) || 0)}
                    placeholder="e.g., 15000"
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-colly focus:ring-2 focus:ring-colly/20 outline-none"
                    min="0"
                    step="100"
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  onClick={saveProduct}
                  loading={state.isLoading}
                >
                  Save & Continue
                </Button>
                <Button variant="secondary" size="md" onClick={onClose}>
                  Skip for now
                </Button>
              </div>
            </div>
          )}

          {state.currentStep === "telegram" && (
            <div className="animate-in slide-in-from-right-2 fade-in duration-300" role="region" aria-label="Connect Telegram">
              <div className="flex items-center gap-2 text-colly mb-4">
                <Bot className="h-5 w-5" />
                <h2 className="font-display text-lg font-semibold text-gray-900">Step 2: Connect Telegram</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Link your Telegram bot so Colly can reply to customers automatically 24/7.
              </p>
              {!state.telegramConnected ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-colly/10 text-colly">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">@YourBusinessBot</h3>
                        <p className="text-sm text-gray-500">Not connected yet</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Click below to authorize Colly to manage your bot. You'll be redirected to Telegram.
                    </p>
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      onClick={connectTelegram}
                      loading={state.isLoading}
                    >
                      <Bot className="mr-2 h-4 w-4" />
                      Connect Telegram Bot
                    </Button>
                  </div>
                  <details className="text-sm text-gray-500">
                    <summary className="cursor-pointer font-medium text-colly hover:underline">Already have a bot token?</summary>
                    <div className="mt-2 p-3 rounded-lg bg-gray-50">
                      <p className="text-xs">Paste your bot token from @BotFather here (optional)</p>
                      <input
                        type="password"
                        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-colly focus:ring-2 focus:ring-colly/20 outline-none"
                      />
                    </div>
                  </details>
                </div>
              ) : (
                <div className="rounded-lg border border-green-200 bg-green-50 p-5 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 mx-auto mb-3">
                    <Check className="h-6 w-6" />
                  </div>
                  <h3 className="font-medium text-green-800">Telegram Connected!</h3>
                  <p className="text-sm text-green-600 mt-1">@YourBusinessBot is now linked to Colly.</p>
                  <Button
                    variant="primary"
                    size="md"
                    className="mt-4 w-full sm:w-auto"
                    onClick={() => setState((s) => ({ ...s, currentStep: "test-chat" }))}
                  >
                    Test Your AI →
                  </Button>
                </div>
              )}
            </div>
          )}

          {state.currentStep === "test-chat" && (
            <div className="animate-in slide-in-from-right-2 fade-in duration-300" role="region" aria-label="Test your AI">
              <div className="flex items-center gap-2 text-colly mb-4">
                <MessageSquare className="h-5 w-5" />
                <h2 className="font-display text-lg font-semibold text-gray-900">Step 3: Test your AI</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Send a message as if you were a customer. See your AI respond using your product info!
              </p>
              <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 h-64 overflow-y-auto space-y-4">
                <div className="flex gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-colly/10 text-colly shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl bg-white p-3 shadow-sm border border-gray-100 max-w-[80%]">
                    <p className="text-sm text-gray-700">
                      Hi! I'm your AI assistant. Ask me about <strong>{state.product.name || "your product"}</strong> — I know it costs <strong>₦{state.product.price.toLocaleString()}</strong>!
                    </p>
                  </div>
                </div>
                {state.testMessage && (
                  <div className="flex gap-2 justify-end">
                    <div className="rounded-2xl bg-colly p-3 max-w-[80%]">
                      <p className="text-sm text-white">{state.testMessage}</p>
                    </div>
                  </div>
                )}
                {state.testResponse && (
                  <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-colly/10 text-colly shrink-0">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="rounded-2xl bg-white p-3 shadow-sm border border-gray-100 max-w-[80%]">
                      <p className="text-sm text-gray-700">{state.testResponse}</p>
                    </div>
                  </div>
                )}
              </div>
              {!state.testResponse ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={state.testMessage}
                    onChange={(e) => setState((s) => ({ ...s, testMessage: e.target.value }))}
                    placeholder="Try: 'How much is the Ankara dress?'"
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-colly focus:ring-2 focus:ring-colly/20 outline-none"
                    onKeyDown={(e) => e.key === "Enter" && sendTestMessage()}
                    disabled={state.isLoading}
                  />
                  <Button
                    variant="primary"
                    size="md"
                    onClick={sendTestMessage}
                    loading={state.isLoading}
                    disabled={!state.testMessage.trim()}
                  >
                    Send
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full sm:w-auto"
                    onClick={completeOnboarding}
                    loading={state.isLoading}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Complete Setup
                  </Button>
                </div>
              )}
            </div>
          )}

          {state.currentStep === "complete" && (
            <div className="animate-in fade-in duration-500 text-center py-8" role="region" aria-label="Onboarding complete">
              {showCelebration && (
                <div className="mb-6 animate-in zoom-in duration-500">
                  <div className="relative inline-flex h-24 w-24 items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-colly/30 animate-ping" />
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-colly/10">
                      <Check className="h-10 w-10 text-colly" />
                    </div>
                  </div>
                </div>
              )}
              <h2 className="font-display text-2xl font-bold text-gray-900">You're all set! 🎉</h2>
              <p className="mt-2 text-gray-500">
                Your AI assistant is now live and ready to sell <strong>{state.product.name}</strong> for <strong>₦{state.product.price.toLocaleString()}</strong> on Telegram.
              </p>
              <div className="mt-6 flex gap-3 justify-center">
                <Button variant="primary" size="md" onClick={completeOnboarding} loading={state.isLoading}>
                  Go to Dashboard
                </Button>
                <Button variant="secondary" size="md" onClick={onClose}>
                  Maybe later
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

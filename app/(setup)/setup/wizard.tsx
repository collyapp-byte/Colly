"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { ArrowRight, CheckCircle2, Loader2, Package, Sparkles, UserCheck, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const FAQ_SUGGESTIONS = [
  { q: "Where are you located?", a: "We are located in Lagos, Nigeria." },
  { q: "Do you sell wholesale?", a: "Yes, we offer wholesale pricing for bulk orders." },
  { q: "What are your opening hours?", a: "We are open Monday to Saturday, 9am to 6pm." },
  { q: "Do your products come with a warranty?", a: "Yes, all products come with a 1-year warranty." }
];

export function Wizard({ ownerName }: { ownerName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  
  // Product State
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
  
  // FAQ State
  const [selectedFaqs, setSelectedFaqs] = useState<number[]>([]);
  const [isSubmittingFaqs, setIsSubmittingFaqs] = useState(false);

  // Test Chat State
  const [message, setMessage] = useState("");
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const handleSkip = () => {
    router.push("/dashboard");
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingProduct(true);
    try {
      await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: productName, price: Number(productPrice) }),
      });
      setStep(3);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  const handleAddFaqs = async () => {
    setIsSubmittingFaqs(true);
    try {
      const promises = selectedFaqs.map(index => {
        const faq = FAQ_SUGGESTIONS[index];
        return fetch("/api/faqs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: faq.q, answer: faq.a }),
        });
      });
      await Promise.all(promises);
      setStep(4);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingFaqs(false);
    }
  };

  const handleTestAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setIsSendingMessage(true);
    try {
      const res = await fetch("/api/onboarding/test-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiReply(data.reply);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleFinish = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FF6600', '#FFB380', '#ffffff']
    });
    setTimeout(() => {
      router.push("/dashboard");
    }, 800);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 sm:p-10 shadow-sm relative">
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 h-1 bg-colly transition-all duration-500 ease-in-out rounded-tl-2xl" style={{ width: `${(step / 4) * 100}%` }} />
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-display text-gray-900">
          Welcome, {ownerName} 👋
        </h1>
        <button onClick={handleSkip} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
          Skip for now
        </button>
      </div>

      {/* STEP 1: FIND AN AGENT */}
      {step === 1 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-[#FFF4EC] rounded-full flex items-center justify-center mb-4">
              <UserCheck className="w-8 h-8 text-colly" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Need help setting up?</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Certified Colly Agents can set up your catalogue, connect your channels, and train your AI for you.
            </p>
          </div>
          <div className="flex flex-col gap-3 max-w-sm mx-auto mt-8">
            <Button onClick={() => router.push("/find-an-agent")} variant="primary" className="w-full h-12 text-base">
              Find an Agent
            </Button>
            <Button onClick={() => setStep(2)} variant="secondary" className="w-full h-12 text-base">
              Setup on my own <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: ADD PRODUCT */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Add your first product</h2>
            <p className="text-gray-500 text-sm">Your AI needs something to sell. Let's add one quickly.</p>
          </div>
          <form onSubmit={handleAddProduct} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
              <input required value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Samsung TV 42'" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (₦)</label>
              <input required type="number" value={productPrice} onChange={e => setProductPrice(e.target.value)} placeholder="e.g. 150000" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>
            <Button type="submit" variant="primary" disabled={isSubmittingProduct} className="w-full h-12 mt-4">
              {isSubmittingProduct ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save & Continue"}
            </Button>
          </form>
        </div>
      )}

      {/* STEP 3: ADD FAQS (CHIPS) */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Teach your AI common answers</h2>
            <p className="text-gray-500 text-sm">Click the questions that apply to your business. We'll write the answers for you.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FAQ_SUGGESTIONS.map((faq, i) => {
              const isSelected = selectedFaqs.includes(i);
              return (
                <div key={i} className={`p-4 rounded-xl border transition-all cursor-pointer ${isSelected ? 'border-colly bg-[#FFF4EC]' : 'border-gray-200 hover:border-gray-300'}`} onClick={() => {
                  if (isSelected) setSelectedFaqs(prev => prev.filter(idx => idx !== i));
                  else setSelectedFaqs(prev => [...prev, i]);
                }}>
                  <p className="font-medium text-gray-900 text-sm mb-3">{faq.q}</p>
                  <div className="flex gap-2">
                    <span className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${isSelected ? 'bg-colly text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {isSelected ? "✓ Added" : "Add to my FAQs"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <Button onClick={handleAddFaqs} variant="primary" disabled={isSubmittingFaqs} className="w-full h-12 mt-4">
            {isSubmittingFaqs ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save FAQs & Continue"}
          </Button>
        </div>
      )}

      {/* STEP 4: TEST AI */}
      {step === 4 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Test your shop bot</h2>
            <p className="text-gray-500 text-sm">Ask a question about the product you just added.</p>
          </div>
          
          {!aiReply ? (
            <form onSubmit={handleTestAi} className="flex gap-2">
              <input required value={message} onChange={e => setMessage(e.target.value)} placeholder="e.g. How much is the TV?" className="flex-1 rounded-lg border border-gray-300 px-3 py-2" />
              <Button type="submit" variant="primary" disabled={isSendingMessage}>
                {isSendingMessage ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 max-w-md">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">You:</p>
                <p className="mb-3 font-medium text-gray-900">{message}</p>
                <p className="text-sm text-gray-500 mb-1">Colly AI:</p>
                <p className="font-medium text-colly">{aiReply}</p>
              </div>
              <Button onClick={handleFinish} variant="primary" className="w-full h-12 text-base">
                Looks good, take me to my dashboard! 🎉
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
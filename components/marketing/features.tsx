import {
  AudioLines,
  BellRing,
  ImageIcon,
  ShieldAlert,
  Tag,
} from "lucide-react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const WAVEFORM_HEIGHTS = [
  14, 28, 20, 40, 24, 52, 34, 60, 30, 44, 18, 36, 22, 48, 26, 16,
];

export function Features() {
  return (
    <section className="bg-white py-24">
      <ScrollReveal className="mx-auto max-w-7xl px-4">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Built for the Nigerian market
          </h2>
          <p className="mt-4 text-gray-600">
            Not a generic chatbot. A sales assistant that understands how we
            talk, how we sell, and how we close.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Card 1 — spans two columns */}
          <div className="rounded-3xl bg-[#1E3A8A] p-8 text-white md:col-span-2">
            <div className="flex h-full flex-col justify-between gap-8 sm:flex-row sm:items-end">
              <div className="max-w-sm">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                  <AudioLines className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-6 text-2xl font-bold">
                  Pidgin &amp; Voice Notes
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-blue-100">
                  Customer sends a voice note saying &quot;Wagwan, how much be
                  this iPhone 12?&quot; Colly understands, translates, and
                  replies perfectly — in their language.
                </p>
              </div>

              <div className="w-full max-w-[16rem] rounded-2xl bg-white/10 p-4">
                <div className="flex items-center justify-between text-blue-100">
                  <span className="text-[11px] font-medium uppercase tracking-wider">
                    Voice note
                  </span>
                  <span className="text-[11px]">0:08</span>
                </div>
                <div className="mt-4 flex h-16 items-end gap-1.5">
                  {WAVEFORM_HEIGHTS.map((height, index) => (
                    <span
                      key={index}
                      className="w-1.5 rounded-full bg-white/80"
                      style={{ height }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2 */}
          <div className="rounded-3xl bg-orange-50 p-8">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#FF6600] shadow-sm">
              <ShieldAlert className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-6 text-xl font-bold text-gray-900">
              Smart Escalation
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Colly never guesses a waybill price. If a customer asks for
              delivery to Abuja, it instantly pings your personal Telegram to
              take over.
            </p>
            <div className="mt-6 flex items-center gap-2 rounded-xl border border-orange-200 bg-white px-3 py-2.5">
              <BellRing className="h-4 w-4 shrink-0 text-[#FF6600]" aria-hidden />
              <span className="text-xs font-medium text-gray-700">
                Escalated to you
              </span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="rounded-3xl bg-gray-50 p-8">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#FF6600] shadow-sm">
              <ImageIcon className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-6 text-xl font-bold text-gray-900">
              Image Sending
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Ask for a photo and Colly sends the real product image straight
              from your catalogue. No more digging through your gallery.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="flex aspect-square items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-300"
                >
                  <ImageIcon className="h-5 w-5" aria-hidden />
                </div>
              ))}
            </div>
          </div>

          {/* Card 4 — spans two columns */}
          <div className="rounded-3xl border border-gray-200 bg-white p-8 md:col-span-2">
            <div className="flex h-full flex-col justify-between gap-8 sm:flex-row sm:items-center">
              <div className="max-w-sm">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6600]">
                  <Tag className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-6 text-2xl font-bold text-gray-900">
                  Never quotes below your floor
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  You set the limits. Colly can negotiate within your rules, but
                  it will never sell at a loss or embarrass you on price.
                </p>
              </div>

              <div className="shrink-0 rounded-2xl border-2 border-dashed border-[#FF6600]/40 bg-orange-50 px-6 py-5 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#C2410C]">
                  List price
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  ₦185,000
                </p>
                <p className="mt-1 text-xs font-medium text-gray-500">
                  Floor: ₦170,000
                </p>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}

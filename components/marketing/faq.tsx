import { JsonLd } from "@/components/seo/json-ld";
import { MARKETING_FAQS } from "@/lib/marketing-faq";
import { faqJsonLd } from "@/lib/seo";

/**
 * The FAQ block, written for answer engines (AEO) rather than for accordions.
 *
 * Three deliberate choices:
 *
 * 1. Stacked, always-open Q&A. Every question is an `<h2>` and every answer is
 *    visible text in the first HTML paint — a crawler does not click, and a
 *    collapsed `<details>` body is exactly the text a RAG pipeline skips.
 * 2. The direct answer sits immediately under the question, before any
 *    elaboration, and is 40–60 self-contained words (`lib/marketing-faq.ts`).
 * 3. The FAQPage JSON-LD is built from the same `MARKETING_FAQS` array that is
 *    rendered below it, so the schema and the visible copy cannot go out of
 *    sync — there is only one list.
 */
export function FAQ() {
  return (
    <section id="faq" className="bg-white py-20 sm:py-28">
      <JsonLd data={faqJsonLd()} />
      <div className="mx-auto max-w-3xl px-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF6600]">
          Questions owners ask
        </p>
        <div className="mt-8 divide-y divide-gray-200">
          {MARKETING_FAQS.map((faq) => (
            <div key={faq.q} className="py-8 first:pt-6">
              <h2 className="font-display text-xl font-bold text-gray-900 sm:text-2xl">
                {faq.q}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-gray-700">
                {faq.a}
              </p>
              {faq.detail ? (
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {faq.detail}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


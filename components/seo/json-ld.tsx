import { homepageJsonLd, type JsonLdNode } from "@/lib/seo";

/**
 * Renders a JSON-LD document. Server Component on purpose: structured data is
 * not executable code, so `next/script` (which loads and runs JavaScript) is the
 * wrong tool here.
 *
 * `JSON.stringify` does not escape `<`, so a string containing `</script>`
 * would close the tag early. Escaping it keeps catalogue and FAQ text inert.
 */
export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

/**
 * The marketing homepage's structured data: one SoftwareApplication node, with
 * an Offer per paid tier inside its AggregateOffer.
 *
 * The FAQPage is NOT part of this document — `components/marketing/faq.tsx`
 * emits it from the same `MARKETING_FAQS` array it renders, which keeps the
 * schema beside the visible copy and stops `/` shipping the node twice.
 *
 * Server Component with no props on purpose: the page cannot pass a price in,
 * so the schema can never drift from `lib/plans.ts` (what checkout charges).
 */
export function HomepageJsonLd() {
  return <JsonLd data={homepageJsonLd()} />;
}

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
 * The marketing homepage's structured data: one SoftwareApplication node (with
 * an Offer per paid tier) plus the FAQPage that mirrors the accordion rendered
 * by `components/marketing/faq.tsx`.
 *
 * Server Component with no props on purpose: the page cannot pass a price or a
 * question in, so the schema can never drift from `lib/plans.ts` (what checkout
 * charges) or `lib/marketing-faq.ts` (what the visitor reads).
 */
export function HomepageJsonLd() {
  return <JsonLd data={homepageJsonLd()} />;
}

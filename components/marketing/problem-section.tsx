import Image from "next/image";

export function ProblemSection() {
  return (
    <section className="bg-[#f5f5f5] pt-10 pb-24 lg:pt-24">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 lg:grid-cols-2 lg:gap-12">
        <div>
          <span className="inline-flex items-center rounded-full border border-[#FF6600]/30 bg-[#FFF4EC] px-4 py-1.5 text-[13px] font-semibold text-[#FF6600]">
            The 24/7 Reality
          </span>
          <h2 className="mt-6 font-display text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            While you sleep, your customers are buying.
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-600">
            It&apos;s 11 PM. A customer asks for a price. You&apos;re asleep. By
            morning, they&apos;ve bought from a shop that answered instantly.
            Colly fixes this.
          </p>
        </div>

        {/* Same rule as the hero: the box is sized by CSS (4:5, then a fixed
            600px band from `lg`), not by the decoded image, so this section
            cannot grow after the photo arrives. */}
        <div className="aspect-[4/5] w-full overflow-hidden rounded-3xl shadow-xl lg:aspect-auto lg:h-[600px]">
          <Image
            src="/a man chatting night time v.jpg"
            alt="Customer chatting with a business late at night"
            width={900}
            height={1100}
            /* Half of the two-column grid from `lg` (1024px) up, full bleed
               below it — same breakpoint as the hero. Without this the browser
               assumes 100vw and pulls a far larger candidate than the box. */
            sizes="(max-width: 1023px) 100vw, 50vw"
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}

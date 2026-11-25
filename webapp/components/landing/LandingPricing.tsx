import React from 'react';
import Link from 'next/link';

const FREE = ['Every zone and operator', 'Live rates and free hours', 'Rush-hour tow warnings', 'One saved favourite'];
const PRO = ['Cheapest spot finder', 'Meter and tow alarms', 'Unlimited synced favourites', 'Expense tracker with CSV export'];

const focusRing = 'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#E2B158]';

export default function LandingPricing() {
  return (
    <section id="pricing" className="scroll-mt-4 bg-[#1E2838] px-5 py-24 text-white sm:px-8">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="m-0 mb-4 max-w-[20ch] text-[clamp(30px,3.4vw,46px)] font-medium leading-[1.08] tracking-[-0.02em]">
          Free to look. Pro to plan ahead.
        </h2>
        <p className="m-0 mb-14 max-w-[56ch] text-lg leading-relaxed text-[#B9C4D4]">
          Pro costs $29.99 a year. One avoided tow pays for more than three.
        </p>

        <div className="grid max-w-[820px] grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-[22px] border border-[#3B4860] p-8">
            <h3 className="m-0 text-xl font-bold">Free</h3>
            <div className="mt-3.5 mb-1 text-[64px] font-light leading-none tracking-[-0.03em]">$0</div>
            <ul className="mt-5 mb-7 list-disc space-y-1 pl-5 text-[#D4DCE8]">
              {FREE.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link
              href="/app"
              className={`inline-block rounded-full border-[1.5px] border-white/80 px-6.5 py-3.5 text-[17px] font-bold transition-colors hover:bg-white/10 ${focusRing}`}
            >
              Open the map
            </Link>
          </div>

          <div className="rounded-[22px] bg-[linear-gradient(180deg,#2B3E5C,#3F5F86)] p-8">
            <h3 className="m-0 text-xl font-bold">Pro</h3>
            <div className="mt-3.5 mb-1 text-[64px] font-light leading-none tracking-[-0.03em]">$3.99</div>
            <div className="text-[#D4DCE8]">a month, or $29.99 a year</div>
            <ul className="mt-5 mb-7 list-disc space-y-1 pl-5 text-[#D4DCE8]">
              {PRO.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link
              href="/pricing"
              className={`inline-block rounded-full bg-[#F3F6FA] px-6.5 py-3.5 text-[17px] font-bold text-[#1E2838] transition-colors hover:bg-white ${focusRing}`}
            >
              Start Pro
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

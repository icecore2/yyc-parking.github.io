import React from 'react';

const MOMENTS = [
  {
    time: '7:45 AM',
    text: '5 Ave is a tow zone until 9. Park one block south.',
    sky: 'bg-[linear-gradient(180deg,#3D4D6E,#C98C6C)]',
  },
  {
    time: '12:30 PM',
    text: 'Stephen Ave stalls are paid until 6. The parkade on 9 Ave may be cheaper.',
    sky: 'bg-[linear-gradient(180deg,#36618F,#8DB7DB)]',
  },
  {
    time: '4:10 PM',
    text: '4 Ave has been a tow zone since 3:30. The map warns you before you stop.',
    sky: 'bg-[linear-gradient(180deg,#2C2E57,#C77E58)]',
  },
  {
    time: '8:00 PM',
    text: 'Most of the core is free. Stay as long as dinner lasts.',
    sky: 'bg-[linear-gradient(180deg,#0E1A30,#2D4A70)]',
  },
];

const TOOLS = [
  { title: 'Rates through the day', text: "Every zone's stepped rate across 24 hours, with free windows marked." },
  { title: 'Tow warnings', text: 'Rush-hour no-stopping windows flagged before you leave the car.' },
  { title: 'Every operator', text: 'ParkPlus, City parkades, Park & Ride, Impark, Indigo and Precise ParkLink.' },
  { title: 'Cheapest spot finder', text: "Every stall within a five-minute walk of where you're going, ranked by cost.", pro: true },
  { title: 'Meter and tow alarms', text: 'A reminder 15 minutes before time runs out or a tow window starts.', pro: true },
  { title: 'Expense export', text: 'Log business parking and export a CSV for claims or taxes.', pro: true },
];

export default function DayMoments() {
  return (
    <section className="bg-[#F3F6FA] px-5 py-24 text-[#1E2838] sm:px-8">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="m-0 mb-4 max-w-[20ch] text-[clamp(30px,3.4vw,46px)] font-medium leading-[1.08] tracking-[-0.02em]">
          The price of a curb changes four times before dinner.
        </h2>
        <p className="m-0 mb-14 max-w-[56ch] text-lg leading-relaxed text-[#4A5669]">
          Morning rush, the paid day, the evening tow window and the free night all apply to the same stall. The map
          shows whichever one applies now, and what comes next.
        </p>

        <ol className="m-0 grid list-none grid-cols-2 gap-0.5 overflow-hidden rounded-[18px] p-0 lg:grid-cols-4">
          {MOMENTS.map((m) => (
            <li key={m.time} className={`flex min-h-[220px] flex-col justify-between p-6 pb-7 text-white ${m.sky}`}>
              <span className="text-[clamp(32px,3.2vw,44px)] font-light leading-none tracking-[-0.03em]">{m.time}</span>
              <p className="m-0 mt-6 max-w-[26ch] text-base">{m.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-18 grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <div key={tool.title}>
              <h3 className="m-0 mb-1.5 flex items-center gap-2 text-[19px] font-bold">
                {tool.title}
                {tool.pro && (
                  <span className="rounded-full bg-[#E2B158] px-2 py-0.5 text-[13px] font-bold text-[#3A2A08]">Pro</span>
                )}
              </h3>
              <p className="m-0 text-base leading-relaxed text-[#4A5669]">{tool.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

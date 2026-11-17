'use client';

import React from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';

const FAQS = [
  {
    id: 'item-1',
    q: 'How accurate and up-to-date is the parking rate data?',
    a: 'The app connects directly to the City of Calgary / Calgary Parking Authority ArcGIS Open Data FeatureServer. Rate schedules, price tier adjustments, and stall capacities are updated whenever the city publishes adjustments.',
  },
  {
    id: 'item-2',
    q: 'When is parking free in downtown Calgary?',
    a: 'On-street ParkPlus parking is free across the entire City of Calgary on Sundays and official statutory holidays. On Saturdays, many zones feature reduced rates (starting around $1.50–$2.00/hr). Outside enforceable hours (typically after 6:00 PM or 8:00 PM depending on the zone), on-street parking is generally free unless designated as a residential permit or rush-hour tow zone.',
  },
  {
    id: 'item-3',
    q: 'Can I pay for parking directly inside this app?',
    a: 'This app is an independent rate finder and navigation optimizer. When you select a zone or lot, we provide direct one-tap links to the official payment operator (such as MyParking / ParkPlus for city on-street spots, hangTag for Impark lots, or onsite payment instructions).',
  },
  {
    id: 'item-4',
    q: 'What is the "Cheapest Spot Finder" and how does it work?',
    a: 'Our Pro optimizer takes any destination in Calgary (like the Saddledome, Core Mall, or Stephen Ave) and computes the exact walking distance and total cost for all nearby zones. It reveals hidden cheaper stalls just 2 blocks away that could save you $10–$20 per evening.',
  },
  {
    id: 'item-5',
    q: 'Can I cancel my Pro subscription at any time?',
    a: 'Yes, absolutely. You can manage or cancel your subscription at any time with a single click in your Account settings. Your Pro benefits remain active until the end of your billing cycle with zero cancellation fees.',
  },
];

export default function FAQ() {
  return (
    <section className="py-16 md:py-24 border-t border-border bg-card">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">
            Got Questions?
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground mt-2">
            Frequently Asked Questions
          </h2>
        </div>

        <Card className="p-2 sm:p-4">
          <CardContent className="p-0">
            <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
              {FAQS.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id} className="border-border px-3 last:border-b-0">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

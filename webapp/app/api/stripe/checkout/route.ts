import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_PLANS } from '@/lib/stripe/stripe';

export async function POST(req: NextRequest) {
  try {
    const { userId, plan } = await req.json();

    const selectedPlan = plan === 'annual' ? STRIPE_PLANS.annual : STRIPE_PLANS.monthly;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // If Stripe secret key isn't configured, return simulated success URL
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_demo')) {
      return NextResponse.json({
        url: `${appUrl}/account?status=demo_success&plan=${plan}`,
      });
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: selectedPlan.name,
              description: 'Calgary Parking Map Pro Subscription: Cheapest Spot Finder, Tow Alarms & Cloud Favorites',
            },
            unit_amount: selectedPlan.amountCents,
            recurring: {
              interval: plan === 'annual' ? 'year' : 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${appUrl}/account?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`,
      metadata: {
        userId: userId || 'anonymous',
        plan: plan || 'monthly',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error('Stripe checkout error:', error);
    const message = error instanceof Error ? error.message : 'Checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

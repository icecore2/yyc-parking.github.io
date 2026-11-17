import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_demo', {
  appInfo: {
    name: 'Calgary Parking Map',
    version: '1.0.0',
  },
});

export const STRIPE_PLANS = {
  monthly: {
    priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
    amountCents: 399,
    name: 'Calgary Commuter Pro (Monthly)',
  },
  annual: {
    priceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || 'price_pro_annual',
    amountCents: 2999,
    name: 'Calgary Commuter Pro (Annual)',
  },
};

import { NextRequest } from "next/server";
import Stripe from "stripe";
import { getSupabase } from "@/lib/server/supabase";
import { config } from "@/lib/server/config";
import { json, error, withAuth } from "@/lib/server/api-helpers";

export async function POST(request: NextRequest) {
  return withAuth(request, async (userId) => {
    if (!config.stripeSecretKey) return error("Billing not configured", 503);
    const stripe = new Stripe(config.stripeSecretKey);
    const sb = getSupabase();

    const { data: profiles } = await sb.from("user_profiles").select("*").eq("id", userId);
    if (!profiles?.length || !profiles[0].stripe_customer_id)
      return error("No active subscription", 400);

    const body = await request.json();
    const session = await stripe.billingPortal.sessions.create({
      customer: profiles[0].stripe_customer_id,
      return_url: body.return_url ?? config.stripePortalReturnUrl,
    });

    return json({ url: session.url });
  });
}

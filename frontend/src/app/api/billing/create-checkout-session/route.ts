import { NextRequest } from "next/server";
import Stripe from "stripe";
import { getSupabase } from "@/lib/server/supabase";
import { config } from "@/lib/server/config";
import { json, error, withAuth } from "@/lib/server/api-helpers";

function getStripe() {
  if (!config.stripeSecretKey) throw new Error("Billing not configured");
  return new Stripe(config.stripeSecretKey);
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (userId) => {
    try {
      const stripe = getStripe();
      const sb = getSupabase();

      const { data: userData } = await sb.auth.admin.getUserById(userId);
      const email = userData.user?.email ?? "";

      let { data: profiles } = await sb.from("user_profiles").select("*").eq("id", userId);
      if (!profiles?.length) {
        await sb.from("user_profiles").insert({ id: userId });
        const r = await sb.from("user_profiles").select("*").eq("id", userId);
        profiles = r.data;
      }
      let customerId = profiles![0].stripe_customer_id;

      if (!customerId) {
        const customer = await stripe.customers.create({ email, metadata: { user_id: userId } });
        customerId = customer.id;
        await sb.from("user_profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
      }

      const body = await request.json();
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: config.stripeProPriceId, quantity: 1 }],
        success_url: body.success_url ?? config.stripePortalReturnUrl,
        cancel_url: body.cancel_url ?? config.stripePortalReturnUrl,
        metadata: { user_id: userId },
      });

      return json({ url: session.url });
    } catch (e) {
      if (e instanceof Error && e.message === "Billing not configured")
        return error("Billing not configured", 503);
      throw e;
    }
  });
}

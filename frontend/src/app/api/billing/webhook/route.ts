import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabase } from "@/lib/server/supabase";
import { config } from "@/lib/server/config";

export async function POST(request: NextRequest) {
  if (!config.stripeSecretKey || !config.stripeWebhookSecret) {
    return NextResponse.json({ detail: "Billing not configured" }, { status: 503 });
  }

  const stripe = new Stripe(config.stripeSecretKey);
  const payload = await request.text();
  const sig = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, config.stripeWebhookSecret);
  } catch {
    return NextResponse.json({ detail: "Invalid webhook signature" }, { status: 400 });
  }

  const sb = getSupabase();
  const data = event.data.object as unknown as Record<string, unknown>;

  if (event.type === "checkout.session.completed") {
    const userId = (data.metadata as Record<string, string>)?.user_id;
    if (userId) {
      await sb.from("user_profiles").update({ subscription_status: "active", plan: "pro" }).eq("id", userId);
    }
  } else if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const customerId = data.customer as string;
    const status = (data.status as string) ?? "canceled";
    const plan = ["active", "trialing"].includes(status) ? "pro" : "free";
    const subStatus = ["active", "past_due", "canceled", "trialing"].includes(status) ? status : "canceled";

    const { data: profiles } = await sb.from("user_profiles").select("id").eq("stripe_customer_id", customerId);
    if (profiles?.length) {
      await sb.from("user_profiles").update({
        subscription_status: subStatus,
        plan,
        current_period_end: data.current_period_end ?? null,
      }).eq("stripe_customer_id", customerId);
    }
  } else if (event.type === "invoice.payment_failed") {
    const customerId = data.customer as string;
    const { data: profiles } = await sb.from("user_profiles").select("id").eq("stripe_customer_id", customerId);
    if (profiles?.length) {
      await sb.from("user_profiles").update({ subscription_status: "past_due" }).eq("stripe_customer_id", customerId);
    }
  }

  return NextResponse.json({ received: true });
}

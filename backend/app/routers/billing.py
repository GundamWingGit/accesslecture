"""
Stripe billing endpoints: checkout session creation, webhook handler,
and customer portal session.
"""
from __future__ import annotations

import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from app.auth import get_current_user_id
from app.config import get_settings
from app.services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_stripe():
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Billing not configured")
    stripe.api_key = settings.stripe_secret_key
    return stripe


def _ensure_profile(user_id: str) -> dict:
    """Get or create user_profiles row."""
    sb = get_supabase()
    result = sb.table("user_profiles").select("*").eq("id", user_id).execute()
    if result.data:
        return result.data[0]
    sb.table("user_profiles").insert({"id": user_id}).execute()
    result = sb.table("user_profiles").select("*").eq("id", user_id).execute()
    return result.data[0]


def _ensure_stripe_customer(user_id: str, email: str) -> str:
    """Get or create Stripe customer for user."""
    sb = get_supabase()
    profile = _ensure_profile(user_id)
    if profile.get("stripe_customer_id"):
        return profile["stripe_customer_id"]

    s = _get_stripe()
    customer = s.Customer.create(email=email, metadata={"user_id": user_id})
    sb.table("user_profiles").update(
        {"stripe_customer_id": customer.id}
    ).eq("id", user_id).execute()
    return customer.id


@router.post("/create-checkout-session")
async def create_checkout_session(
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    settings = get_settings()
    s = _get_stripe()

    sb = get_supabase()
    user_resp = sb.auth.admin.get_user_by_id(user_id)
    email = user_resp.user.email if user_resp.user else ""

    customer_id = _ensure_stripe_customer(user_id, email)

    body = await request.json()
    success_url = body.get("success_url", settings.stripe_portal_return_url)
    cancel_url = body.get("cancel_url", settings.stripe_portal_return_url)

    session = s.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": settings.stripe_pro_price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": user_id},
    )
    return {"url": session.url}


@router.post("/create-portal-session")
async def create_portal_session(
    request: Request,
    user_id: str = Depends(get_current_user_id),
):
    settings = get_settings()
    s = _get_stripe()
    profile = _ensure_profile(user_id)
    if not profile.get("stripe_customer_id"):
        raise HTTPException(status_code=400, detail="No active subscription")

    body = await request.json()
    return_url = body.get("return_url", settings.stripe_portal_return_url)

    session = s.billing_portal.Session.create(
        customer=profile["stripe_customer_id"],
        return_url=return_url,
    )
    return {"url": session.url}


@router.get("/status")
async def billing_status(user_id: str = Depends(get_current_user_id)):
    profile = _ensure_profile(user_id)
    return {
        "plan": profile.get("plan", "free"),
        "subscription_status": profile.get("subscription_status", "free"),
        "current_period_end": profile.get("current_period_end"),
        "lectures_this_month": profile.get("lectures_this_month", 0),
    }


@router.post("/webhook")
async def stripe_webhook(request: Request):
    settings = get_settings()
    s = _get_stripe()
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = s.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except (ValueError, s.error.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    sb = get_supabase()
    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        user_id = data.get("metadata", {}).get("user_id")
        if user_id:
            sb.table("user_profiles").update({
                "subscription_status": "active",
                "plan": "pro",
            }).eq("id", user_id).execute()
            logger.info("User %s upgraded to pro via checkout", user_id)

    elif event_type in ("customer.subscription.updated", "customer.subscription.deleted"):
        customer_id = data.get("customer")
        status = data.get("status", "canceled")
        period_end = data.get("current_period_end")

        plan = "pro" if status in ("active", "trialing") else "free"
        sub_status = status if status in ("active", "past_due", "canceled", "trialing") else "canceled"

        result = sb.table("user_profiles").select("id").eq(
            "stripe_customer_id", customer_id
        ).execute()
        if result.data:
            sb.table("user_profiles").update({
                "subscription_status": sub_status,
                "plan": plan,
                "current_period_end": period_end,
            }).eq("stripe_customer_id", customer_id).execute()
            logger.info("Subscription %s for customer %s", sub_status, customer_id)

    elif event_type == "invoice.payment_failed":
        customer_id = data.get("customer")
        result = sb.table("user_profiles").select("id").eq(
            "stripe_customer_id", customer_id
        ).execute()
        if result.data:
            sb.table("user_profiles").update({
                "subscription_status": "past_due",
            }).eq("stripe_customer_id", customer_id).execute()
            logger.warning("Payment failed for customer %s", customer_id)

    return JSONResponse({"received": True})

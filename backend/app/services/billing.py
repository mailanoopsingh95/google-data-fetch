import logging
from typing import Dict, Any, Optional
import stripe
from app.config import settings

logger = logging.getLogger("business_intel_api")

PLAN_LIMITS = {
    "free": 100,
    "starter": 5000,
    "pro": 50000,
    "enterprise": 999999999
}

class BillingService:
    def __init__(self):
        if settings.STRIPE_API_KEY:
            stripe.api_key = settings.STRIPE_API_KEY

    def is_quota_exceeded(self, plan: str, quota_used: int) -> bool:
        """Checks if the user has exceeded their current monthly search quota."""
        limit = PLAN_LIMITS.get(plan.lower(), 100)
        return quota_used >= limit

    def get_limit(self, plan: str) -> int:
        return PLAN_LIMITS.get(plan.lower(), 100)

    async def create_checkout_session(self, user_id: str, plan_name: str, success_url: str, cancel_url: str) -> Dict[str, Any]:
        """
        Creates a payment checkout session.
        If MOCK_BILLING is enabled, immediately returns a mock checkout payload.
        """
        plan_name = plan_name.lower()
        if settings.MOCK_BILLING:
            logger.info(f"[billing] Mock checkout session created for user {user_id} and plan {plan_name}")
            return {
                "id": f"mock_session_{user_id}_{plan_name}",
                "url": f"{success_url}?session_id=mock_session_{user_id}_{plan_name}&plan={plan_name}",
                "mock": True
            }

        # Real Stripe checkout
        if not settings.STRIPE_API_KEY:
            raise Exception("Stripe is not configured and MOCK_BILLING is False")
            
        prices = {
            "starter": "price_starter_id",  # Define price ids here
            "pro": "price_pro_id",
        }
        
        price_id = prices.get(plan_name)
        if not price_id:
            raise Exception(f"Invalid plan name for Stripe subscription: {plan_name}")

        try:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[{"price": price_id, "quantity": 1}],
                mode="subscription",
                success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}&plan=" + plan_name,
                cancel_url=cancel_url,
                client_reference_id=user_id,
            )
            return {
                "id": session.id,
                "url": session.url,
                "mock": False
            }
        except Exception as e:
            logger.error(f"[billing] Stripe error creating checkout session: {e}")
            raise e

    async def handle_stripe_webhook(self, payload: bytes, sig_header: str) -> Optional[Dict[str, Any]]:
        """Handles Stripe webhooks and extracts billing events."""
        if settings.MOCK_BILLING or not settings.STRIPE_WEBHOOK_SECRET:
            return None
            
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except Exception as e:
            logger.error(f"[billing] Webhook signature verification failed: {e}")
            raise e

        event_type = event["type"]
        data_object = event["data"]["object"]

        if event_type == "checkout.session.completed":
            user_id = data_object.get("client_reference_id")
            subscription_id = data_object.get("subscription")
            customer_id = data_object.get("customer")
            
            # Retrieve session details to extract plan
            session = stripe.checkout.Session.retrieve(data_object["id"])
            # In production, look up the price/plan mapping from the session items
            
            return {
                "type": "subscribed",
                "user_id": user_id,
                "customer_id": customer_id,
                "subscription_id": subscription_id,
                # Default upgrade on payment
                "plan": "pro" 
            }
            
        elif event_type == "customer.subscription.deleted":
            subscription_id = data_object["id"]
            return {
                "type": "canceled",
                "subscription_id": subscription_id
            }
            
        return None

billing_service = BillingService()

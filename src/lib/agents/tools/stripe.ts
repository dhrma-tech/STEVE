import { getOrgCredential } from "@/lib/security/vault";

import type { AgentTool, ToolContext } from "./types";

async function getKey(orgId: string): Promise<string | null> {
  return getOrgCredential(orgId, "stripe", "secretKey", "STRIPE_SECRET_KEY");
}

function noKey() {
  return "Stripe not configured. Add a secret key to the Stripe integration or set STRIPE_SECRET_KEY.";
}

async function stripeFetch(path: string, key: string, opts?: RequestInit): Promise<unknown> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(opts?.headers as Record<string, string> | undefined ?? {})
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Stripe ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function toFormBody(params: Record<string, string | number | boolean | undefined>) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

export const stripeListProductsTool: AgentTool = {
  definition: {
    name: "stripe_list_products",
    description: "List products in your Stripe account.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "number", description: "Number of products to return (default 10)" } }
    }
  },
  async execute(input, ctx: ToolContext) {
    const key = await getKey(ctx.orgId);
    if (!key) return noKey();
    const limit = typeof input.limit === "number" ? Math.min(100, Math.max(1, input.limit)) : 10;
    try {
      const data = await stripeFetch(`/products?limit=${limit}&active=true`, key) as {
        data?: Array<{ id: string; name: string; description: string | null; active: boolean }>
      };
      const products = data.data ?? [];
      if (!products.length) return "No active products found.";
      return products.map(p => `${p.id} — ${p.name}${p.description ? ` (${p.description.slice(0, 60)})` : ""}`).join("\n");
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const stripeCreateProductTool: AgentTool = {
  definition: {
    name: "stripe_create_product",
    description: "Create a new product in Stripe.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Product name" },
        description: { type: "string", description: "Optional product description" }
      },
      required: ["name"]
    }
  },
  async execute(input, ctx: ToolContext) {
    const key = await getKey(ctx.orgId);
    if (!key) return noKey();
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name) return "Error: name is required";
    const description = typeof input.description === "string" ? input.description.trim() : undefined;
    try {
      const data = await stripeFetch("/products", key, {
        method: "POST",
        body: toFormBody({ name, ...(description ? { description } : {}) })
      }) as { id: string; name: string };
      return `Product created: ${data.name} (ID: ${data.id})`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const stripeCreatePriceTool: AgentTool = {
  definition: {
    name: "stripe_create_price",
    description: "Create a price for a Stripe product.",
    input_schema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Stripe product ID (prod_...)" },
        unitAmountCents: { type: "number", description: "Price in cents (e.g. 2900 for $29.00)" },
        currency: { type: "string", description: "ISO currency code (default: usd)" },
        interval: { type: "string", description: "Billing interval: month, year, or omit for one-time" }
      },
      required: ["productId", "unitAmountCents"]
    }
  },
  async execute(input, ctx: ToolContext) {
    const key = await getKey(ctx.orgId);
    if (!key) return noKey();
    const productId = typeof input.productId === "string" ? input.productId.trim() : "";
    const unitAmount = typeof input.unitAmountCents === "number" ? Math.round(input.unitAmountCents) : 0;
    if (!productId || unitAmount <= 0) return "Error: productId and a positive unitAmountCents are required";
    const currency = typeof input.currency === "string" ? input.currency.trim().toLowerCase() : "usd";
    const interval = typeof input.interval === "string" && ["month", "year", "week", "day"].includes(input.interval)
      ? input.interval : null;
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        product: productId,
        unit_amount: unitAmount,
        currency,
        ...(interval ? { "recurring[interval]": interval } : {})
      };
      const data = await stripeFetch("/prices", key, { method: "POST", body: toFormBody(params) }) as {
        id: string; unit_amount: number; currency: string; recurring?: { interval: string }
      };
      const display = `$${((data.unit_amount ?? 0) / 100).toFixed(2)} ${data.currency.toUpperCase()}${data.recurring ? `/${data.recurring.interval}` : " one-time"}`;
      return `Price created: ${display} (ID: ${data.id})`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const stripeCreatePaymentLinkTool: AgentTool = {
  definition: {
    name: "stripe_create_payment_link",
    description: "Create a Stripe payment link for a price.",
    input_schema: {
      type: "object",
      properties: {
        priceId: { type: "string", description: "Stripe price ID (price_...)" },
        quantity: { type: "number", description: "Quantity (default 1)" }
      },
      required: ["priceId"]
    }
  },
  async execute(input, ctx: ToolContext) {
    const key = await getKey(ctx.orgId);
    if (!key) return noKey();
    const priceId = typeof input.priceId === "string" ? input.priceId.trim() : "";
    if (!priceId) return "Error: priceId is required";
    const quantity = typeof input.quantity === "number" ? Math.max(1, Math.round(input.quantity)) : 1;
    try {
      const data = await stripeFetch("/payment_links", key, {
        method: "POST",
        body: toFormBody({ "line_items[0][price]": priceId, "line_items[0][quantity]": quantity })
      }) as { id: string; url: string };
      return `Payment link created: ${data.url} (ID: ${data.id})`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

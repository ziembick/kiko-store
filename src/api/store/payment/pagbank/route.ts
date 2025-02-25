import {
  Cart,
  CartService,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/medusa";
import crypto from "crypto";

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    

  // Enable signature verification after talking to pagbank support
	// signature is not sent in the web hook currently
	// const rawBody = JSON.stringify(req.body);
	// const signature = req.headers["x-authenticity-token"] as string;
    // if (!signature) {
    //   console.log("signature", signature);
    //   res.status(401).json({ error: "Missing signature header" });
    //   return;
    // }

    // const isValid = verifyPagBankSignature(
    //   rawBody,
    //   signature,
    //   process.env.PAGBANK_TOKEN || ""
    // );

    // console.log("isValid", isValid);

    // if (!isValid) {
    //   res.status(401).json({ error: "Invalid signature" });
    //   return;
    // }

    const payload = req.body as PagBankWebhookPayload;

    // Validate payload

    if (!payload.charges || !payload.charges.length) {
      res.status(400).json({ error: "Invalid payload: no charges found" });
      return;
    }

    const charge = payload.charges[0];
    const { id: chargeId, status, reference_id } = charge;

    const cartService: CartService = req.scope.resolve("cartService");

    // Update payment status
    await cartService.updatePaymentSession(reference_id, {
      status,
      chargeId,
    });

    res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("PagBank webhook error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}

interface PagBankCharge {
  id: string;
  status: string;
  reference_id: string;
  amount: {
    value: number;
    currency: string;
    summary: {
      total: number;
      paid: number;
      refunded: number;
    };
  };
  payment_method: {
    type: string;
    installments?: number;
  };
}

interface PagBankWebhookPayload {
  id: string;
  reference_id: string;
  charges: PagBankCharge[];
  created_at: string;
}

function verifyPagBankSignature(
  payload: string,
  signature: string,
  token: string
): boolean {
  const expectedSignature = crypto
    .createHash("sha256")
    .update(`${token}-${payload}`)
    .digest("hex");

  return expectedSignature === signature;
}

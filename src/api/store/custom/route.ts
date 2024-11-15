import { MedusaRequest, MedusaResponse } from "@medusajs/medusa";
import { handleAsaasWebhook } from "./asaas-webhook";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  res.sendStatus(200);
}


export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  return handleAsaasWebhook(req, res);
}
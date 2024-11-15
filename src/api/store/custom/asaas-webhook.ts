// src/api/store/custom/asaas-webhook.ts
import { MedusaRequest, MedusaResponse } from "@medusajs/medusa";

export async function handleAsaasWebhook(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const payload = req.body;

    // Verificar se o payload possui as propriedades esperadas
    if (typeof payload === "object" && payload && "id" in payload && "status" in payload) {
      const { id: paymentId, status } = payload as { id: string; status: string };

      // Processar o status do pagamento
      console.log("Asaas Webhook recebido:", paymentId, status);

      // Adicione a lógica para atualizar o pedido com base no status do pagamento
      res.status(200).send("Webhook processado com sucesso");
    } else {
      res.status(400).send("Payload inválido");
    }
  } catch (error) {
    console.error("Erro ao processar o webhook do Asaas:", error);
    res.status(500).send("Erro ao processar o webhook");
  }
}

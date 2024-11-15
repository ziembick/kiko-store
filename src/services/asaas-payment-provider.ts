import {
    AbstractPaymentProcessor,
    PaymentProcessorContext,
    PaymentProcessorSessionResponse,
    PaymentProcessorError,
    PaymentSessionStatus,
  } from "@medusajs/medusa";
  import axios from "axios";
  
  class AsaasPaymentProcessor extends AbstractPaymentProcessor {
    static identifier = "asaas";
  
    private asaasBaseUrl: string;
    private apiKey: string;
  
    constructor(_, options) {
      super(_);
      this.asaasBaseUrl = options.api_url || "https://sandbox.asaas.com/api/v3";
      this.apiKey = options.api_key || process.env.ASAAS_API_KEY;
    }
  
    /**
     * Inicia o pagamento criando uma cobrança no Asaas.
     */
    async initiatePayment(
      context: PaymentProcessorContext
    ): Promise<PaymentProcessorSessionResponse | PaymentProcessorError> {
      const { customer, amount } = context;
  
      try {
        const response = await axios.post(
          `${this.asaasBaseUrl}/payments`,
          {
            customer: customer.id,
            value: amount / 100, // Valor no Asaas é em reais
            description: "Compra realizada na loja Medusa",
            dueDate: new Date().toISOString().split("T")[0], // Data de vencimento
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
          }
        );
  
        return {
          session_data: {
            asaas_payment_id: response.data.id,
          },
          update_requests: {
            customer_metadata: customer?.metadata,
          },
        };
      } catch (error) {
        console.error("Erro ao iniciar o pagamento no Asaas:", error);
        return { error };
      }
    }
  
    /**
     * Autoriza o pagamento.
     */
    async authorizePayment(
      paymentSessionData: Record<string, unknown>,
      context: Record<string, unknown>
    ): Promise<
      | {
          status: PaymentSessionStatus;
          data: Record<string, unknown>;
        }
      | PaymentProcessorError
    > {
      const status = await this.getPaymentStatus(paymentSessionData);
      return {
        status,
        data: {
          ...paymentSessionData,
          idempotency_key: context.idempotency_key,
        },
      };
    }
  
    /**
     * Atualiza informações do pagamento no Asaas.
     */
    async updatePayment(
      context: PaymentProcessorContext
    ): Promise<void | PaymentProcessorError | PaymentProcessorSessionResponse> {
      try {
        const response = await axios.get(
          `${this.asaasBaseUrl}/payments/${context.paymentSessionData?.asaas_payment_id}`,
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
          }
        );
  
        return {
          session_data: {
            ...context.paymentSessionData,
            status: response.data.status,
          },
          update_requests: {
            customer_metadata: context.customer?.metadata,
          },
        };
      } catch (error) {
        console.error("Erro ao atualizar pagamento no Asaas:", error);
        return { error };
      }
    }
  
    /**
     * Atualiza dados específicos de uma sessão de pagamento.
     */
    async updatePaymentData(
      sessionId: string,
      data: Record<string, unknown>
    ): Promise<Record<string, unknown> | PaymentProcessorError> {
      return {
        session_id: sessionId,
        ...data,
      };
    }
  
    /**
     * Obtém o status do pagamento.
     */
    async getPaymentStatus(
      paymentSessionData: Record<string, unknown>
    ): Promise<PaymentSessionStatus> {
      try {
        const response = await axios.get(
          `${this.asaasBaseUrl}/payments/${paymentSessionData.asaas_payment_id}`,
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
          }
        );
  
        const status = response.data.status;
        switch (status) {
          case "PENDING":
            return PaymentSessionStatus.PENDING;
          case "CONFIRMED":
          case "RECEIVED":
            return PaymentSessionStatus.AUTHORIZED;
          case "REFUNDED":
            return PaymentSessionStatus.CANCELED;
          case "CANCELLED":
            return PaymentSessionStatus.CANCELED;
          default:
            return PaymentSessionStatus.PENDING;
        }
      } catch (error) {
        console.error("Erro ao obter status do pagamento no Asaas:", error);
        return PaymentSessionStatus.ERROR;
      }
    }
  
    /**
     * Cancela o pagamento no Asaas.
     */
    async cancelPayment(
      paymentSessionData: Record<string, unknown>
    ): Promise<Record<string, unknown> | PaymentProcessorError> {
      try {
        await axios.post(
          `${this.asaasBaseUrl}/payments/${paymentSessionData.asaas_payment_id}/cancel`,
          {},
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
          }
        );
  
        return { status: "cancelled" };
      } catch (error) {
        console.error("Erro ao cancelar o pagamento no Asaas:", error);
        return { error };
      }
    }
  
    /**
     * Exclui um pagamento (equivale a cancelar no Asaas).
     */
    async deletePayment(
      paymentSessionData: Record<string, unknown>
    ): Promise<Record<string, unknown> | PaymentProcessorError> {
      return await this.cancelPayment(paymentSessionData);
    }
  
    /**
     * Solicita reembolso do pagamento no Asaas.
     */
    async refundPayment(
      paymentSessionData: Record<string, unknown>,
      refundAmount?: number
    ): Promise<Record<string, unknown> | PaymentProcessorError> {
      try {
        await axios.post(
          `${this.asaasBaseUrl}/payments/${paymentSessionData.asaas_payment_id}/refund`,
          {
            value: refundAmount || undefined,
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
          }
        );
  
        return { status: "refunded" };
      } catch (error) {
        console.error("Erro ao solicitar reembolso no Asaas:", error);
        return { error };
      }
    }
  
    /**
     * Recupera informações sobre o pagamento no Asaas.
     */
    async retrievePayment(
      paymentSessionData: Record<string, unknown>
    ): Promise<Record<string, unknown> | PaymentProcessorError> {
      try {
        const response = await axios.get(
          `${this.asaasBaseUrl}/payments/${paymentSessionData.asaas_payment_id}`,
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
          }
        );
  
        return response.data;
      } catch (error) {
        console.error("Erro ao recuperar pagamento no Asaas:", error);
        return { error };
      }
    }
  
    /**
     * Captura o pagamento (não aplicável no Asaas para PIX).
     */
    async capturePayment(paymentSessionData: Record<string, unknown>) {
      return { ...paymentSessionData };
    }
  }
  
  export default AsaasPaymentProcessor;
  
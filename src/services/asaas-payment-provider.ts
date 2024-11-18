import {
  AbstractPaymentProcessor,
  PaymentProcessorContext,
  PaymentProcessorSessionResponse,
  PaymentProcessorError,
  PaymentSessionStatus,
} from "@medusajs/medusa";
import axios from "axios";

// Constantes diretamente declaradas
const ASAAS_API_KEY =
  "$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDAwOTQ4NTk6OiRhYWNoXzNhNWM1Nzg2LWYwMWEtNDc0Ny1hYmQ1LWYwN2JiMjY1NjY4Nw==";
const ASAAS_API_URL = "https://sandbox.asaas.com/api/v3";

class AsaasPaymentProcessor extends AbstractPaymentProcessor {
  static identifier = "asaas";

  constructor(_, options) {
    super(_);
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
        `${ASAAS_API_URL}/payments`,
        {
          customer: customer.id,
          value: amount / 100,
          description: "Compra realizada na loja Medusa",
          dueDate: new Date().toISOString().split("T")[0],
        },
        {
          headers: {
            Authorization: `Bearer ${ASAAS_API_KEY}`,
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
   * Captura o pagamento.
   */
  async capturePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    try {
      const response = await axios.post(
        `${ASAAS_API_URL}/payments/${paymentSessionData.asaas_payment_id}/capture`,
        {},
        {
          headers: {
            Authorization: `Bearer ${ASAAS_API_KEY}`,
          },
        }
      );

      return { ...response.data };
    } catch (error) {
      console.error("Erro ao capturar o pagamento no Asaas:", error);
      return { error };
    }
  }

  /**
   * Atualiza informações do pagamento no Asaas.
   */
  async updatePayment(
    context: PaymentProcessorContext
  ): Promise<PaymentProcessorSessionResponse | PaymentProcessorError> {
    try {
      const response = await axios.get(
        `${ASAAS_API_URL}/payments/${context.paymentSessionData?.asaas_payment_id}`,
        {
          headers: {
            Authorization: `Bearer ${ASAAS_API_KEY}`,
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
   * Recupera informações sobre o pagamento no Asaas.
   */
  async retrievePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    try {
      const response = await axios.get(
        `${ASAAS_API_URL}/payments/${paymentSessionData.asaas_payment_id}`,
        {
          headers: {
            Authorization: `Bearer ${ASAAS_API_KEY}`,
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
   * Cancela o pagamento no Asaas.
   */
  async cancelPayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    try {
      await axios.post(
        `${ASAAS_API_URL}/payments/${paymentSessionData.asaas_payment_id}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${ASAAS_API_KEY}`,
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
        `${ASAAS_API_URL}/payments/${paymentSessionData.asaas_payment_id}/refund`,
        {
          value: refundAmount || undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${ASAAS_API_KEY}`,
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
   * Obtém o status do pagamento.
   */
  async getPaymentStatus(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentSessionStatus> {
    try {
      const response = await axios.get(
        `${ASAAS_API_URL}/payments/${paymentSessionData.asaas_payment_id}`,
        {
          headers: {
            Authorization: `Bearer ${ASAAS_API_KEY}`,
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
}

export default AsaasPaymentProcessor;

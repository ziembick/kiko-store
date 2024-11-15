import {
  AbstractPaymentProcessor,
  PaymentProcessorContext,
  PaymentProcessorError,
  PaymentProcessorSessionResponse,
  PaymentSessionStatus,
} from "@medusajs/medusa";
import {
  MercadoPagoConfig,
  Payment,
  PaymentRefund,
  Preference,
} from "mercadopago";
import { PaymentResponse as MPPaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";
import {
  PaymentCreateData,
  PaymentCreateRequest,
} from "mercadopago/dist/clients/payment/create/types";

enum MercadoPagoPaymentStatus {
  // The user has not concluded the payment process (for example, by generating a payment by boleto, it will be concluded at the moment in which the user makes the payment in the selected place).
  pending = "pending",
  // The payment has been approved and credited.
  approved = "approved",
  //The payment has been authorized but not captured yet.
  authorized = "authorized",
  // The payment is in analysis.
  in_process = "in_process",
  // The user started a dispute.
  in_mediation = "in_mediation",
  // The payment was rejected (the user can try to pay again).
  rejected = "rejected",
  // Either the payment was canceled by one of the parties or expired.
  cancelled = "cancelled",
  // The payment was returned to the user.
  refunded = "refunded",
  // A chargeback was placed on the buyer's credit card.
  charged_back = "charged_back",
}

const mpResponseToObject = (response: MPPaymentResponse) => ({
  status: response.status,
  id: response.id,
  installments: response.installments,
  payment_method: response.payment_method,
  mercadopago_payment_id: response.id,
  card: response.card,
  order: response.order,
  payer: response.payer,
  payment_method_id: response.payment_method_id,
  transaction_details: response.transaction_details,
  merchant_account_id: response.merchant_account_id,
  payment_type_id: response.payment_type_id,
  status_detail: response.status_detail,
  transaction_amount: response.transaction_amount,
  transaction_amount_refunded: response.transaction_amount_refunded,
  date_approved: response.date_approved,
  date_created: response.date_created,
  date_last_updated: response.date_last_updated,
  date_of_expiration: response.date_of_expiration,
  money_release_date: response.money_release_date,
  money_release_schema: response.money_release_schema,
  money_release_status: response.money_release_status,
  operation_type: response.operation_type,
  issuer_id: response.issuer_id,
  live_mode: response.live_mode,
  sponsor_id: response.sponsor_id,
  authorization_code: response.authorization_code,
  integrator_id: response.integrator_id,
  taxes_amount: response.taxes_amount,
  counter_currency: response.counter_currency,
  shipping_amount: response.shipping_amount,
  build_version: response.build_version,
  pos_id: response.pos_id,
  store_id: response.store_id,
  platform_id: response.platform_id,
  corporation_id: response.corporation_id,
  metadata: response.metadata,
  additional_info: response.additional_info,
  external_reference: response.external_reference,
});

class MercadoPagoPaymentProcessor extends AbstractPaymentProcessor {
  static identifier = "mercadopago";

  private mercadopago_client: MercadoPagoConfig;
  private payment: Payment;

  constructor(container, options) {
    super(container);
    this.mercadopago_client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
      options: { timeout: 5000 },
    });
    this.payment = new Payment(this.mercadopago_client);
  }

  async capturePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    return { ...paymentSessionData };
  }

  /** This method intends to prepare any data that the payment service will need afterwards */
  async initiatePayment(
    context: PaymentProcessorContext
  ): Promise<PaymentProcessorError | PaymentProcessorSessionResponse> {
    const { customer, amount } = context;
    let preference = {
      body: {
        purpose: "wallet_purchase",
        items: [
          {
            id: "item-ID-1234",
            title: "Bloom Reuse",
            quantity: 1,
            unit_price: amount,
          },
        ],
      },
    };

    try {
      const preferences = new Preference(this.mercadopago_client);
      const response = await preferences.create(preference);
      const preferenceId = response.id;
      return {
        session_data: { ...context.paymentSessionData, preferenceId },
        update_requests: { customer_metadata: customer?.metadata },
      };
    } catch (error) {
      return {
        session_data: { ...context.paymentSessionData },
        update_requests: { customer_metadata: customer?.metadata },
      };
    }
  }

  async authorizePayment(
    paymentSessionData: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<
    | PaymentProcessorError
    | {
        status: PaymentSessionStatus;
        data: Record<string, unknown>;
      }
  > {
    const { formData } = paymentSessionData as any;

    if (formData) {
      const {
        payer,
        token,
        issuer_id,
        payment_method_id,
        transaction_amount,
        installments,
      } = formData as PaymentCreateRequest;
      try {
        const paymentCreateData: PaymentCreateData = {
          body: {
            payer,
            token,
            issuer_id,
            installments,
            payment_method_id,
            transaction_amount,
            description: "Compra por Bloom Reuse",
            statement_descriptor: "Bloom Reuse",
          },
        };

        const mp = await this.payment.create(paymentCreateData);

        const status = await this.getPaymentStatus({
          mercadopago_payment_id: mp.id,
        });
        return {
          data: {
            ...mpResponseToObject(mp),
            idempotency_key: context.idempotency_key,
          },
          status,
        };
      } catch (error) {
        return { error };
      }
    }
    const status = await this.getPaymentStatus(paymentSessionData);

    return {
      status,
      data: {
        ...paymentSessionData,
        idempotency_key: context.idempotency_key,
      },
    };
  }
  async cancelPayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    const paymentInfo = await this.retrievePayment(paymentSessionData);
    try {
      // @ts-ignore
      const mercadoPagoId = paymentInfo.mercadopago_payment_id;
      await this.payment.cancel({
        id: mercadoPagoId,
      });
      return await this.retrievePayment(paymentSessionData);
    } catch {
      return await this.refundPayment(paymentSessionData);
    }
  }

  async deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    return await this.cancelPayment(paymentSessionData);
  }
  async getPaymentStatus(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentSessionStatus> {
    try {
      const paymentInfo = await this.retrievePayment(paymentSessionData);
      if (!paymentInfo) return PaymentSessionStatus.PENDING;
      // @ts-ignore TODO: arreglar este tipo
      const { status } = paymentInfo || {};
      if (status) {
        switch (status) {
          case MercadoPagoPaymentStatus.approved:
            return PaymentSessionStatus.AUTHORIZED;
          case MercadoPagoPaymentStatus.cancelled:
            return PaymentSessionStatus.CANCELED;
          case MercadoPagoPaymentStatus.charged_back:
            return PaymentSessionStatus.CANCELED;
          case MercadoPagoPaymentStatus.in_mediation:
            return PaymentSessionStatus.REQUIRES_MORE;
          case MercadoPagoPaymentStatus.in_process:
            return PaymentSessionStatus.PENDING;
          case MercadoPagoPaymentStatus.pending:
            return PaymentSessionStatus.PENDING;
          case MercadoPagoPaymentStatus.refunded:
            return PaymentSessionStatus.CANCELED;
          case MercadoPagoPaymentStatus.rejected:
            return PaymentSessionStatus.ERROR;
          default:
            return PaymentSessionStatus.PENDING;
        }
      }
      return PaymentSessionStatus.PENDING;
    } catch (error) {
      return PaymentSessionStatus.ERROR;
    }
  }
  async refundPayment(
    paymentSessionData: Record<string, unknown>,
    refundAmount?: number
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    const refund = new PaymentRefund(this.mercadopago_client);
    const paymentInfo = await this.retrievePayment(paymentSessionData);

    if (Object.keys(paymentInfo).length === 0)
      return { ...paymentSessionData, status: PaymentSessionStatus.CANCELED };

    // @ts-ignore
    const mercadoPagoId = paymentInfo.mercadopago_payment_id;
    if (!mercadoPagoId) {
      throw new Error("Payment of Mercado Pago not found.");
    }

    const body = refundAmount
      ? {
          amount: refundAmount,
        }
      : {};
    await refund.create({
      payment_id: mercadoPagoId,
      body,
    });

    return this.retrievePayment(paymentSessionData);
  }
  async retrievePayment(
    paymentSessionData: Record<string, any>
  ): Promise<Record<string, any> | PaymentProcessorError> {
    const paymentId =
      paymentSessionData.mercadopago_payment_id || paymentSessionData.id;
    if (!paymentId) return {};
    const paymentInfo = await this.payment.get({ id: paymentId as string });
    return { ...mpResponseToObject(paymentInfo) };
  }
  async updatePayment(
    context: PaymentProcessorContext
  ): Promise<void | PaymentProcessorError | PaymentProcessorSessionResponse> {
    return {
      update_requests: {
        customer_metadata: context.customer?.metadata,
      },
      session_data: context.paymentSessionData,
    };
  }
  async updatePaymentData(
    sessionId: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    return {
      session_id: sessionId,
      sessionId,
      ...data,
    };
  }
}

export default MercadoPagoPaymentProcessor;

import {
  AbstractPaymentProcessor,
  CartService,
  LineItem,
  PaymentProcessorContext,
  PaymentProcessorSessionResponse,
  PaymentSessionStatus,
} from "@medusajs/medusa";
import axios, { AxiosInstance } from "axios";

interface PaymentProcessorError {
  error: string;
  code?: string;
  detail?: any;
}

type InjectedDependencies = {
  cartService: CartService;
};

class PagBankPaymentProcessor extends AbstractPaymentProcessor {
  static identifier = "pag-bank-payment";

  protected readonly cartService_: CartService;

  private client: AxiosInstance;
  private apiUrl: string;
  private token: string;

  constructor({ cartService }: InjectedDependencies) {
    super(arguments[0]);

    this.cartService_ = cartService;

    this.apiUrl =
      process.env.PAGBANK_URL || "https://sandbox.api.pagseguro.com";
    this.token = process.env.PAGBANK_TOKEN || "";

    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });
  }

  async initiatePayment(
    context: PaymentProcessorContext
  ): Promise<PaymentProcessorError | PaymentProcessorSessionResponse> {
    try {
      const {
        email,
        amount,
        resource_id,
        customer,
        context: cartContext,
      } = context;
      const cart = await this.cartService_.retrieve(resource_id, {
        relations: ["items"],
        select: ["items", "shipping_total", "tax_total"],
      });
      // Create expiration date (2 hours from now)
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + 2);

      const customerName = customer.first_name
        ? `${customer.first_name} ${customer.last_name}`
        : `${cart.shipping_address.first_name} ${cart.shipping_address.last_name}`;

      // const phoneToUse = cart.shipping_address?.phone ?? customer.phone;

      const payload = {
        reference_id: resource_id,
        customer_modifiable: true,
        customer: {
          name: customerName,
          email,
        },
        items: cart.items.map((item) => ({
          reference_id: item.id,
          name: item.title,
          description: item.description,
          quantity: item.quantity,
          unit_amount: item.unit_price,
          image_url: item.thumbnail,
        })),
        additional_amount: cart.shipping_total + cart.tax_total || 0,
        payment_methods: [
          { type: "CREDIT_CARD" },
          { type: "DEBIT_CARD" },
          { type: "BOLETO" },
          { type: "PIX" },
        ],
        expiration_date: expirationDate.toISOString(),
        redirect_url: process.env.STORE_URL + `/payment/handler/${resource_id}`,
        payment_notification_urls: [
          process.env.WEBHOOK_URL + "/store/payment/pagbank",
        ],
      };

      const { data } = await this.client.post("/checkouts", payload);

      // Find payment URL from response links
      const paymentUrl = data.links?.find((link) => link.rel === "PAY")?.href;

      if (!paymentUrl) {
        return {
          error: "Could not generate payment URL",
          code: "payment_url_error",
        };
      }

      return {
        session_data: {
          id: data.id,
          payment_url: paymentUrl,
          amount,
          reference_id: resource_id,
        },
      };
    } catch (error) {
      console.error("PagBank payment initiation error:", error.response.data);
      return {
        error: "An error occurred while initiating payment",
        code: "payment_initiation_error",
        detail:
          error.response?.data?.error_messages?.[0]?.description ||
          error.message,
      };
    }
  }

  async getPaymentStatus(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentSessionStatus> {
    try {
      const pagBankStatus = paymentSessionData.status as PagBankStatus;

      return mapPagBankStatusToMedusa(pagBankStatus);
    } catch (error) {
      return PaymentSessionStatus.ERROR;
    }
  }

  // Other required methods with basic implementation
  async authorizePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<{ status: PaymentSessionStatus; data: Record<string, unknown> }> {
    const status = await this.getPaymentStatus(paymentSessionData);
    return {
      status,
      data: paymentSessionData,
    };
  }

  async capturePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return paymentSessionData; // PagBank captures automatically
  }

  async refundPayment(
    paymentSessionData: Record<string, unknown>,
    refundAmount: number
  ): Promise<Record<string, unknown>> {
    return paymentSessionData;
  }

  async cancelPayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      await this.client.post(`/checkouts/${paymentSessionData.id}/inactivate`);
      return {
        id: paymentSessionData.id,
        status: PaymentSessionStatus.CANCELED,
      };
    } catch (error) {
      console.error("PagBank payment initiation error:", error.response.data);
      const error_messages: Record<string, string>[] =
        error.response?.data?.error_messages;
      if (
        error_messages.some((message) => message.error === "checkout_expired")
      ) {
        return {
          id: paymentSessionData.id,
          status: PaymentSessionStatus.CANCELED,
        };
      } else {
        throw error;
      }
    }
  }

  async deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.cancelPayment(paymentSessionData);
  }

  async retrievePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    try {
      return paymentSessionData;
    } catch (error) {
      return {
        error: "An error occurred during retrieve",
        code: "retrieve_error",
      };
    }
  }

  async updatePayment(
    context: PaymentProcessorContext
  ): Promise<void | PaymentProcessorError | PaymentProcessorSessionResponse> {
    return {
      session_data: context.paymentSessionData,
    };
  }

  async updatePaymentData(
    sessionId: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    return data;
  }
}

export default PagBankPaymentProcessor;

const getNormalizedAmount = (amount: number): string => {
  const normalizedAmount = amount / 100;
  return normalizedAmount.toFixed(2);
};

export const mapPagBankStatusToMedusa = (
  status: string
): PaymentSessionStatus => {
  switch (status.toUpperCase()) {
    case "PAID":
      return PaymentSessionStatus.AUTHORIZED;
    case "DECLINED":
    case "CANCELED":
      return PaymentSessionStatus.CANCELED;
    case "WAITING":
    case "IN_ANALYSIS":
      return PaymentSessionStatus.PENDING;
    default:
      return PaymentSessionStatus.PENDING;
  }
};

export enum PagBankStatus {
  PAID = "PAID",
  DECLINED = "DECLINED",
  CANCELED = "CANCELED",
  WAITING = "WAITING",
  IN_ANALYSIS = "IN_ANALYSIS",
}

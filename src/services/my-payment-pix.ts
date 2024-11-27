import {
  PaymentProcessorContext,
  PaymentProcessorError,
  PaymentProcessorSessionResponse,
} from "@medusajs/medusa";

import MyPaymentBaseService from "../core/my-payment-base";

class MyPaymentPixService extends MyPaymentBaseService {
  static identifier = "pagbank-pix";

  constructor(container: Record<string, any>, options: any) {
    super(container, options);
  }

  async initiatePayment(
    context: PaymentProcessorContext
  ): Promise<PaymentProcessorError | PaymentProcessorSessionResponse> {
    console.debug("initiatePayment called with context:", context);
    try {
      const { email, amount, currency_code, resource_id } = context;
      console.debug("Extracted context data:", {
        email,
        amount,
        currency_code,
        resource_id,
      });

      const initialBody = await this.createInitiateData(context);

      const body = {
        ...initialBody,
        qr_codes: [
          {
            amount: {
              value: amount,
            },
            expiration_date: this.generateExpirationDate(1440),
          },
        ],
      };

      console.log("body for pix payment");
      console.dir(body, { depth: null });

      const response = await this.client.post("/orders", body);

      console.log("PIX response from pagbank");
      console.dir(response.data, { depth: null });

      return {
        session_data: {
          ...response.data,
          order_id: response.data.id,
        },
      };
    } catch (error) {
      console.error("Error in initiatePayment:", error);
      return {
        error:
          "An error occurred while initiating the payment via PIX." +
          error?.response?.data?.error_messages
            ?.map((message) => message?.description)
            .join(", "),
      };
    }
  }

  protected generateExpirationDate(minutes: number) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);

    // Get the timezone offset in ±hh:mm format
    const offset = -now.getTimezoneOffset(); // in minutes
    const sign = offset >= 0 ? "+" : "-";
    const hours = Math.floor(Math.abs(offset) / 60)
      .toString()
      .padStart(2, "0");
    const mins = (Math.abs(offset) % 60).toString().padStart(2, "0");

    // Format the date as `YYYY-MM-DDTHH:mm:ss±hh:mm`
    const isoString = now.toISOString().split(".")[0];
    return `${isoString}${sign}${hours}:${mins}`;
  }
}

export default MyPaymentPixService;

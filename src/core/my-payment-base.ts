import {
	AbstractPaymentProcessor,
	CartService,
	isPaymentProcessorError,
	PaymentProcessorContext,
	PaymentProcessorError,
	PaymentProcessorSessionResponse,
	PaymentSessionStatus,
} from "@medusajs/medusa";
import { MedusaError } from "@medusajs/utils";
import axios, { AxiosInstance } from "axios";
import { EOL } from "os";

interface PagbankRawError {
	response: {
		data: {
			error_messages: {
				description: string;
			}[];
		};
	};
}

interface InitiatePaymentBody {
	reference_id: string;
	customer: {
		name: string;
		email: string;
		tax_id: string;
	};
	items: {
		reference_id: string;
		name: string;
		quantity: number;
		unit_amount: number;
	}[];
	notification_urls: string[];
}

abstract class MyPaymentBaseService extends AbstractPaymentProcessor {
	static identifier = "";

	protected client: AxiosInstance;
	protected cartService_: CartService;

	protected constructor(container: Record<string, any>, options: any) {
		super(container);

		this.cartService_ = container.cartService;

		this.client = axios.create({
			baseURL: process.env.PAGBANK_URL,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${process.env.PAGBANK_TOKEN}`,
			},
		});
		console.debug("PagBankPaymentProcessor initialized with options:", options);
	}

	protected buildError(
		message: string,
		e: PaymentProcessorError | Error | PagbankRawError | any
	): PaymentProcessorError {
		return {
			error: message,
			code: "code" in e ? e.code : "",
			detail: isPaymentProcessorError(e)
				? `${e.error}${EOL}${e.detail ?? ""}`
				: "detail" in e
				? e.detail
				: e?.response?.data?.error_messages
						?.map((item) => item.description)
						.join("") ?? "",
		};
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

			const body = await this.createInitiateData(context);

			console.log("body", body);

			const response = await this.client.post("/orders", body);

			console.log("initiatePayment response from PagBank:");
			console.dir(response.data, {
				depth: null,
			});

			return {
				session_data: {
					id: response.data.id,
					order_id: response.data.id,
				},
			};
		} catch (error) {
			console.error("Error in initiatePayment:", error);
			console.dir(error?.response?.data?.error_messages, { depth: null });
			return this.buildError(
				"An error occurred while initiating the payment. ",
				error
			);
		}
	}

	async capturePayment(
		paymentSessionData: Record<string, unknown>
	): Promise<Record<string, unknown> | PaymentProcessorError> {
		console.debug(
			"capturePayment called with paymentSessionData:",
			paymentSessionData
		);
		try {
			const orderId = paymentSessionData.id as string;

			const data: any = await this.retrievePayment(paymentSessionData);

			console.debug(
				"Received response from PagBank for capture:"
				// response.data
			);

			return {
				...paymentSessionData,
				...data,
				id: data?.id,
				captured_amount: data?.charges?.[0]?.amount.value,
			};
		} catch (error) {
			console.error(
				"An error occurred while capturePayment" +
					error?.response?.data?.error_messages
						?.map((message) => message?.description)
						.join(", ")
			);

			return this.buildError(
				"An error occurred while capturing the payment. ",
				error
			);
		}
	}

	async authorizePayment(
		paymentSessionData: Record<string, unknown>,
		context: Record<string, unknown>
	): Promise<
		| PaymentProcessorError
		| { status: PaymentSessionStatus; data: Record<string, unknown> }
	> {
		console.debug(
			"authorizePayment called with paymentSessionData and context:",
			{ paymentSessionData, context }
		);
		try {
			const orderId = paymentSessionData.id as string;
			console.log("orderId", orderId);

			const response = await this.client.get(`/orders/${orderId}`);
			console.debug(
				"Received response from PagBank for authorization:",
				response.data
			);

			console.log("response.data", response.data);
			const status = response?.data?.charges?.[0]?.status;
			console.log({ status });

			// if (response.data?.status === "AUTHORIZED") {
			if (status === "PAID") {
				console.log("inside status");
				return {
					status: PaymentSessionStatus.AUTHORIZED,
					data: {
						...paymentSessionData,
						...response.data,
						id: paymentSessionData.id,
					},
				};
			} else {
				// return {
				// 	status: PaymentSessionStatus.PENDING,
				// 	data: {
				// 		...paymentSessionData,
				// 		id: response.data.id,
				// 	},
				// };
				return {
					error: "An error occurred while authorizing the payment.",
				};
			}
		} catch (error) {
			console.error(
				"An error occurred while authorizePayment the payment." +
					error?.response?.data?.error_messages
						?.map((message) => message?.description)
						.join(", ")
			);
			return this.buildError(
				"An error occurred while authorizing the payment. ",
				error
			);
		}
	}

	// ! need to discuss
	// before a Payment Session is deleted, Payment Processor is no longer available.
	async deletePayment(
		paymentSessionData: Record<string, unknown>
	): Promise<Record<string, unknown> | PaymentProcessorError> {
		console.debug("deletePayment called with paymentSessionData:");
		console.dir({ paymentSessionData }, { depth: null });

		return paymentSessionData;
		// try {
		// 	if (
		// 		paymentSessionData?.charges &&
		// 		(paymentSessionData?.charges as Array<any>).length
		// 	) {
		// 		const data = await this.cancelCharge(
		// 			paymentSessionData?.charges[0].id,
		// 			paymentSessionData?.charges[0].amount.value
		// 		);

		// 		console.log("deletePayment data");
		// 		console.dir({ data }, { depth: null });

		// 		const new_order_data = await this.retrievePayment(paymentSessionData);

		// 		// PagBank doesn't have a specific delete operation, so we'll just return success
		// 		return {
		// 			...new_order_data,
		// 		};
		// 	} else {
		// 		throw new Error("No charges attached to the payment session.");
		// 	}
		// } catch (error) {
		// 	console.error(
		// 		"An error occurred while deletePayment" +
		// 			error?.response?.data?.error_messages
		// 				?.map((message) => message?.description)
		// 				.join(", ")
		// 	);

		// 	throw new MedusaError(
		// 		MedusaError.Types.NOT_ALLOWED,
		// 		error?.response?.data
		// 			? error?.response?.data?.error_messages
		// 					?.map((message) => message?.description)
		// 					.join(", ")
		// 			: error.message
		// 			? error.message
		// 			: "An error occurred while deleting the payment."
		// 	);
		// }
	}

	// operator cancels the order, order's swap is canceled
	async cancelPayment(
		paymentSessionData: Record<string, unknown>
	): Promise<Record<string, unknown> | PaymentProcessorError> {
		console.log("cancelPayment called with paymentSessionData:");
		console.dir({ paymentSessionData }, { depth: null });

		try {
			const orderId = paymentSessionData.id as string;

			const chargeIds = (paymentSessionData?.charges as any)?.map(
				(charge: any) => [charge.id, charge.amount.value]
			);

			console.log("chargeIds", chargeIds);

			const data = await this.cancelCharge(
				paymentSessionData?.charges?.[0]?.id,
				paymentSessionData?.charges?.[0]?.amount.value
			);

			console.log("cancel payment data");
			console.dir({ data }, { depth: null });

			if (data?.error) {
				throw new Error(data?.error);
			}

			const new_order_data = await this.retrievePayment(paymentSessionData);
			return {
				...new_order_data,
				chargeIds: chargeIds,
				refunded: true,
			};
		} catch (error) {
			console.log({
				error: error?.response?.data
					? error?.response?.data?.error_messages
							?.map((message) => message?.description)
							.join(", ")
					: error
					? error.message
					: "An error occurred while canceling the payment.",
			});

			throw new MedusaError(
				MedusaError.Types.NOT_ALLOWED,
				error?.response?.data
					? error?.response?.data?.error_messages
							?.map((message) => message?.description)
							.join(", ")
					: error.message
					? error.message
					: "An error occurred while canceling the payment."
			);
		}
	}

	// refund an order’s payment.
	async refundPayment(
		paymentSessionData: Record<string, unknown>,
		refundAmount: number
	): Promise<Record<string, unknown> | PaymentProcessorError> {
		console.debug(
			"refundPayment called with paymentSessionData and refundAmount:"
		);
		console.dir({ paymentSessionData, refundAmount }, { depth: null });

		try {
			if (
				paymentSessionData?.charges &&
				(paymentSessionData?.charges as Array<any>).length
			) {
				const data = await this.cancelCharge(
					paymentSessionData?.charges?.[0]?.id,
					refundAmount
				);

				console.log("refundPayment data");
				console.dir({ data }, { depth: null });

				if (data.error) {
					throw new Error(data.error);
				}

				const new_order_data = await this.retrievePayment(paymentSessionData);

				// PagBank doesn't have a specific delete operation, so we'll just return success
				return {
					...new_order_data,
				};
			} else {
				throw new Error("No charges attached to the payment session.");
			}
		} catch (error) {
			console.error("An error occurred while refundPayment");

			// ! need to throw error

			throw new MedusaError(
				MedusaError.Types.NOT_ALLOWED,
				error?.response?.data
					? error?.response?.data?.error_messages
							?.map((message) => message?.description)
							.join(", ")
					: error.message
					? error.message
					: "An error occurred while refund the payment."
			);
		}
	}

	async getPaymentStatus(
		paymentSessionData: Record<string, unknown>
	): Promise<PaymentSessionStatus> {
		console.debug(
			"getPaymentStatus called with paymentSessionData:",
			paymentSessionData
		);
		try {
			const orderId = paymentSessionData.id as string;
			const response = await this.client.get(`/orders/${orderId}`);
			console.debug(
				"Received response from PagBank for getPaymentStatus:",
				response.data
			);

			switch (response.data?.charges?.[0]?.status ?? "PENDING") {
				case "AUTHORIZED":
					return PaymentSessionStatus.PENDING;
				case "PAID":
					return PaymentSessionStatus.AUTHORIZED;
				case "CANCELED":
					return PaymentSessionStatus.CANCELED;
				default:
					return PaymentSessionStatus.PENDING;
			}
		} catch (error) {
			console.error(
				"An error occurred while getPaymentStatus" +
					error?.response?.data?.error_messages
						?.map((message) => message?.description)
						.join(", ")
			);
			return PaymentSessionStatus.ERROR;
		}
	}

	async retrievePayment(
		paymentSessionData: Record<string, unknown>
	): Promise<Record<string, unknown> | PaymentProcessorError> {
		console.debug(
			"retrievePayment called with paymentSessionData:",
			paymentSessionData
		);
		try {
			const orderId = paymentSessionData.id as string;
			const response = await this.client.get(`/orders/${orderId}`);
			console.debug(
				"Received response from PagBank for retrievePayment:",
				response.data
			);

			return response.data;
		} catch (error) {
			console.error(
				"An error occurred while retrievePayment" +
					error?.response?.data?.error_messages
						?.map((message) => message?.description)
						.join(", ")
			);

			return this.buildError(
				"An error occurred while retrieving the payment. ",
				error
			);
		}
	}

	async updatePayment(
		context: PaymentProcessorContext
	): Promise<void | PaymentProcessorError | PaymentProcessorSessionResponse> {
		console.debug("updatePayment called with context:", context);
		// PagBank doesn't support updating an existing order, so we'll just return the current session data
		return {
			session_data: context.paymentSessionData,
		};
	}

	async updatePaymentData(
		sessionId: string,
		data: Record<string, unknown>
	): Promise<
		PaymentProcessorError | PaymentProcessorSessionResponse["session_data"]
	> {
		console.debug("updatePaymentData called with sessionId and data:", {
			sessionId,
			data,
		});
		// PagBank doesn't support updating payment data, so we'll just return the input data
		return data;
	}

	// Other Methods

	async createInitiateData(
		context: PaymentProcessorContext
	): Promise<InitiatePaymentBody> {
		console.debug("initiatePayment called with context:", context);
		try {
			const { email, amount, currency_code, resource_id } = context;
			console.debug("Extracted context data:", {
				email,
				amount,
				currency_code,
				resource_id,
			});

			const cart = await this.cartService_.retrieve(resource_id, {
				relations: ["items", "billing_address"],
			});

			console.log("cart", cart);

			const body = {
				reference_id: resource_id,
				customer: {
					name: `${cart.billing_address?.first_name} ${cart.billing_address?.last_name}`,
					email: email,
					tax_id:
						cart?.billing_address?.metadata?.cpf
							?.toString()
							.replace(/[^0-9]/g, "") ?? "12345678909",
				},
				items: [
					{
						reference_id: "item1",
						name: "Order Payment",
						quantity: 1,
						unit_amount: amount,
					},
				],
				notification_urls: [
					...(process.env.PAGBANK_HOOK_URL
						? [`${process.env.PAGBANK_HOOK_URL}/store/payment/pagbank/hook`]
						: []),
				],
			};

			return body;
		} catch (error) {
			console.error("Error in initiatePayment:", error);
			console.dir(error?.response?.data?.error_messages, { depth: null });

			throw new MedusaError(MedusaError.Types.NOT_FOUND, error.message);
		}
	}

	async cancelCharge(charge_id: string, amount: number) {
		try {
			const body = { amount: { value: amount } };

			console.log("cancelCharge for id: ", charge_id, "with amount: ", amount);

			const response = await this.client.post(
				`/charges/${charge_id}/cancel`,
				body
			);
			console.debug(
				"Received response from PagBank for cancel:",
				response.data
			);
			return response.data;
		} catch (error) {
			console.error("Error in cancelCharge:", error);

			const error_message = [
				"An error occurred while canceling the charge",
				...error?.response?.data?.error_messages?.map(
					(item) => item.description
				),
			].join(", ");

			console.log({ error_message });

			throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error_message);
		}
	}
}

export default MyPaymentBaseService;

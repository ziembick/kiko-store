import MyPaymentBaseService from "../core/my-payment-base";

class MyPaymentBoletoService extends MyPaymentBaseService {
	static identifier = "pagbank-boleto";

	constructor(container: Record<string, any>, options: any) {
		super(container, options);
	}

	// Other Methods
	async payPaymentOrder({
		order_id,
		data,
	}: {
		order_id: string;
		data: Record<string, unknown>;
	}) {
		console.log("payPaymentOrder called with order_id and data:", {
			order_id,
		});
		console.dir(data, { depth: null });

		try {
			const response = await this.client.post(`/orders/${order_id}/pay`, data);
			console.log("Received response from PagBank for payPaymentOrder:");
			console.dir(response.data, { depth: null });

			return response.data;
		} catch (error) {
			console.error("Error in payPaymentOrder:", error);

			// Check if the error has response data
			if (error.response && error.response.data.error_messages) {
				// Handle error case
				console.error("Payment failed:", error.response.data.error_messages);
				throw new Error(
					`An error occurred while processing the payment order, ${error.response.data.error_messages
						?.map((item) => item.description)
						.join(", ")}`
				);
			} else {
				// Handle other errors (e.g., network errors, etc.)
				console.error("An unexpected error occurred:", error);
				throw new Error(
					"An error occurred while processing the payment order."
				);
			}
		}
	}
}

export default MyPaymentBoletoService;

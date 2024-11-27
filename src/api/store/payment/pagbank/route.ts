import {
	CartService,
	MedusaRequest,
	MedusaResponse,
	PaymentSessionStatus,
} from "@medusajs/medusa";
import MyPaymentService from "../../../../services/my-payment";
import MyPaymentBoletoService from "../../../../services/my-payment-boleto";

function generateDueDate(minutes: number) {
	const now = new Date();
	now.setMinutes(now.getMinutes() + minutes);

	// Extract year, month, and day in the desired format
	const year = now.getFullYear();
	const month = (now.getMonth() + 1).toString().padStart(2, "0"); // Month is 0-indexed, so add 1
	const day = now.getDate().toString().padStart(2, "0");

	// Return formatted string `YYYY-MM-DD`
	return `${year}-${month}-${day}`;
}

export async function POST(
	req: MedusaRequest,
	res: MedusaResponse
): Promise<void> {
	try {
		const cartService_: CartService = req.scope.resolve("cartService");
		const paymentService_ =
			req.scope.resolve<MyPaymentService>("myPaymentService");

		const boletoPaymentService_ = req.scope.resolve<MyPaymentBoletoService>(
			"myPaymentBoletoService"
		);

		const { cart_id, payment_info, type } = req.body as any;

		console.log({ body: req.body, cart_id, type });

		if (!cart_id) {
			res.status(400).json({ error: "Cart ID is required" });
			return;
		}

		const cart = await cartService_.retrieve(cart_id, {
			relations: [
				"customer",
				"shipping_address",
				"billing_address",
				"region",
				"payment_sessions",
			],
		});
		console.log("got cart");

		// TODO: payment service getPayment
		console.log("payment_session", cart?.payment_session);

		const payment_order_id = cart?.payment_session?.data?.id;
		if (!payment_order_id) {
			res.status(400).json({ error: "Payment order ID is required" });
			return;
		}
		console.log("got payment order id");

		const status = await paymentService_.getPaymentStatus(
			cart.payment_session.data
		);

		console.log("got payment status", status);

		if (status == PaymentSessionStatus.AUTHORIZED) {
			res.status(400).json({ error: "Payment is already authorized" });
			return;
		}

		let default_payment_info;

		if (type === "CREDIT_CARD") {
			default_payment_info = {
				type: "CREDIT_CARD",
				card: {
					holder: {
						name: payment_info?.card?.holder?.name,
					},
					...(payment_info?.card?.encrypted
						? { encrypted: payment_info?.card?.encrypted }
						: {
								number: payment_info?.card?.number,
								exp_month: payment_info?.card?.exp_month,
								exp_year: payment_info?.card?.exp_year,
								security_code: payment_info?.card?.security_code,
						  }),
				},
				capture: true,
			};
		}

		if (type === "BOLETO") {
			default_payment_info = {
				type: "BOLETO",
				boleto: {
					due_date: generateDueDate(2880),
					instruction_lines: {
						line_1: process.env.PAGBANK_INSTRUCTION_LINES?.split(",").at(0),
						line_2: process.env.PAGBANK_INSTRUCTION_LINES?.split(",").at(1),
					},
					holder: {
						name: `${cart?.billing_address?.first_name} ${cart?.billing_address?.last_name}`,
						tax_id:
							payment_info?.tax_id?.toString().replace(/[^0-9]/g, "") ??
							cart?.billing_address?.metadata?.cpf
								?.toString()
								.replace(/[^0-9]/g, ""),
						email: cart?.email,
						address: {
							street: `${cart?.billing_address?.address_1} ${cart?.billing_address?.address_2}`,
							number: cart?.billing_address?.metadata?.number,
							locality: cart?.billing_address?.province,
							city: cart?.billing_address?.city.split("/").at(-1).trim(),
							region: cart?.billing_address?.city.split("/").at(-1).trim(),
							region_code: cart?.billing_address?.city.split("/").at(0).trim(),
							country: cart?.billing_address?.country_code,
							postal_code: cart?.billing_address?.postal_code
								?.toString()
								.replace(/[^0-9]/g, "")
								.trim(),
						},
					},
				},
			};
		}

		const paymentOrderPayload = {
			charges: [
				{
					amount: {
						value: cart?.payment_session?.amount,
						currency: cart?.region?.currency_code,
					},
					payment_method: {
						...default_payment_info,
						installments: 1,
					},
					reference_id: cart.id,
				},
			],
		};

		console.log("pagbank pay api body");
		console.dir(paymentOrderPayload, { depth: null });

		let response;
		if (type === "CREDIT_CARD") {
			response = await paymentService_.payPaymentOrder({
				order_id: payment_order_id as string,
				data: paymentOrderPayload,
			});
		}

		if (type === "BOLETO") {
			response = await boletoPaymentService_.payPaymentOrder({
				order_id: payment_order_id as string,
				data: paymentOrderPayload,
			});
		}

		console.dir(response, { depth: null });

		if (!response) {
			res.status(500).json({ error: "Payment order not found" });
			return;
		}

		const updated_cart = await cartService_.updatePaymentSession(cart.id, {
			...response,
			order_id: payment_order_id as string,
		});

		if (response?.charges?.[0]?.status === "PAID") {
			console.log("payment is paid", {
				cartAmount: updated_cart.total,
				paidAmount:
					updated_cart.payment_session?.data?.charges?.[0]?.amount?.value,
				status: updated_cart.payment_session?.data?.charges?.[0]?.status,
			});
			res.status(200).json({ cart: updated_cart, status: "PAID" });
			return;
		}

		res.status(200).json({ cart: updated_cart });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
}

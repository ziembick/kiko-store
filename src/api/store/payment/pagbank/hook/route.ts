import {
	CartService,
	CartType,
	MedusaRequest,
	MedusaResponse,
} from "@medusajs/medusa";
import crypto from "crypto";

export async function POST(
	req: MedusaRequest,
	res: MedusaResponse
): Promise<void> {
	try {
		console.debug("hook called from pagbank", {
			ref_id: (req.body as any)?.reference_id,
			body: req.body,
			header: req.headers,
		});

		const cartService_: CartService = req.scope.resolve("cartService");

		const cart = await cartService_.retrieve((req.body as any)?.reference_id, {
			relations: ["payment_sessions"],
		});

		if (!cart) {
			console.log("cart not found from hook");
		}
		console.log("cart found from hook", { cart });

		if (cart?.payment?.order_id) {
			console.log("order is already created");
			res.sendStatus(200);
		}

		// check paid amount
		const paidCharges =
			(req.body as any)?.charges
				?.filter((item: any) => item.status === "PAID")
				.reduce((p, c) => {
					p = p + c?.amount?.summary?.paid;
				}, 0) ?? 0;

		console.log("paid charges", paidCharges);

		let response;

		if (paidCharges >= cart?.payment_session?.amount) {
			console.log("updating cart to capture payment");

			const data = await fetch(`/store/carts/${cart?.id}/complete`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
			});

			response = await data.json();

			// now send order confirm mail

			console.log("sending mail to user");

			await req.scope
				.resolve("notificationService")
				.send("order.placed", response, "mailer");

			console.log("mail send to user");
		}

		console.log("paidCharges is less then amount");

		console.debug({ response });

		res.sendStatus(200);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
}

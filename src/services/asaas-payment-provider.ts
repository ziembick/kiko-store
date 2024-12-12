// import {
//   AbstractPaymentProcessor,
//   PaymentProcessorContext,
//   PaymentProcessorError,
//   PaymentProcessorSessionResponse,
//   PaymentProviderService,
//   PaymentSessionStatus,
// } from "@medusajs/medusa";
// import axios from "axios";

// class AsaasPaymentProcessor extends AbstractPaymentProcessor {
//   static identifier = "asaas"
//   protected paymentProviderService: PaymentProviderService;
//   client: any;

//   constructor(container) {
//     super(container);

//     const { api_key_asaas, api_url_asaas } =
//       container.resolve("configModule").projectConfig;

//     if (!api_key_asaas || !api_url_asaas) {
//       throw new Error(
//         "Asaas API Key ou URL não configurados no medusa-config.js"
//       );
//     }
 
//     this.client = axios.create({
//       baseURL: api_url_asaas,
//       headers: {
//         Authorization: `Bearer ${api_key_asaas}`,
//         "Content-Type": "application/json",
//       },
//     });
//   }

//   async updatePaymentData(
//     sessionId: string,
//     data: Record<string, unknown>
//   ): Promise<Record<string, unknown> | PaymentProcessorError> {
//     try {
//       // Atualize informações locais ou salve metadados
//       const paymentSession = await this.paymentProviderService.retrieveSession(
//         sessionId
//       );
  
//       const updatedData = {
//         ...paymentSession.data,
//         ...data,
//       };
  
//       return {
//         id: paymentSession.id,
//         ...updatedData,
//       };
//     } catch (error) {
//       console.error("Erro ao atualizar dados do pagamento:", error);
//       return { error };
//     }
//   }
  


//   async capturePayment(
//     paymentSessionData: Record<string, unknown>
//   ): Promise<Record<string, unknown> | PaymentProcessorError> {
//     try {
//       const paymentId = paymentSessionData.asaas_payment_id;

//       const response = await this.client.post(`/payments/${paymentId}/capture`);

//       return { status: "captured", ...response.data };
//     } catch (error) {
//       console.error("Erro ao capturar o pagamento:", error);
//       return { error: new Error("Falha ao capturar o pagamento.") };
//     }
//   }

//   async authorizePayment(
//     paymentSessionData: Record<string, unknown>
//   ): Promise<{
//     status: PaymentSessionStatus;
//     data: Record<string, unknown>;
//   } | PaymentProcessorError> {
//     try {
//       const paymentId = paymentSessionData.asaas_payment_id;

//       const response = await this.client.get(`/payments/${paymentId}`);

//       const status = response.data.status === "CONFIRMED"
//         ? PaymentSessionStatus.AUTHORIZED
//         : PaymentSessionStatus.PENDING;

//       return {
//         status,
//         data: {
//           id: paymentId,
//         },
//       };
//     } catch (error) {
//       console.error("Erro ao autorizar pagamento:", error);
//       return { error };
//     }
//   }

//   async cancelPayment(
//     paymentSessionData: Record<string, unknown>
//   ): Promise<Record<string, unknown> | PaymentProcessorError> {
//     try {
//       const paymentId = paymentSessionData.asaas_payment_id;

//       const response = await this.client.post(
//         `/payments/${paymentId}/cancel`
//       );

//       return { status: "cancelled", ...response.data };
//     } catch (error) {
//       console.error("Erro ao cancelar pagamento:", error);
//       return { error };
//     }
//   }

//   async initiatePayment(
//     context: PaymentProcessorContext
//   ): Promise<PaymentProcessorSessionResponse | PaymentProcessorError> {
//     const { customer, amount } = context;
    
//     try {
//       const response = await this.client.post(`/payments`, {
//         customer: customer?.metadata?.asaas_id, // ID do cliente no Asaas
//         billingType: "CREDIT_CARD", // Alterar dinamicamente, se necessário
//         value: amount / 100, // Valor em reais
//         description: "Compra realizada na loja Medusa",
//         dueDate: new Date().toISOString().split("T")[0], // Data de vencimento
//       });

//       return {
//         session_data: {
//           asaas_payment_id: response.data.id,
//         },
//       };
//     } catch (error) {
//       console.error("Erro ao iniciar o pagamento:", error);
//       return { error };
//     }
//   }

//   async deletePayment(
//     paymentSessionData: Record<string, unknown>
//   ): Promise<Record<string, unknown> | PaymentProcessorError> {
//     try {
//       const paymentId = paymentSessionData.asaas_payment_id;
  
//       const response = await this.client.post(`/payments/${paymentId}/cancel`);
  
//       return { status: "cancelled", ...response.data };
//     } catch (error) {
//       console.error("Erro ao excluir pagamento no Asaas:", error);
//       return { error };
//     }
//   }
  

//   async getPaymentStatus(
//     paymentSessionData: Record<string, unknown>
//   ): Promise<PaymentSessionStatus> {
//     try {
//       const paymentId = paymentSessionData.asaas_payment_id;
  
//       const response = await this.client.get(`/payments/${paymentId}`);
  
//       const status = response.data.status;
  
//       switch (status) {
//         case "PENDING":
//           return PaymentSessionStatus.PENDING;
//         case "CONFIRMED":
//         case "RECEIVED":
//           return PaymentSessionStatus.AUTHORIZED;
//         case "REFUNDED":
//           return PaymentSessionStatus.CANCELED;
//         case "CANCELLED":
//           return PaymentSessionStatus.CANCELED;
//         default:
//           return PaymentSessionStatus.PENDING;
//       }
//     } catch (error) {
//       console.error("Erro ao obter status do pagamento no Asaas:", error);
//       return PaymentSessionStatus.ERROR;
//     }
//   }
  

//   async refundPayment(
//     paymentSessionData: Record<string, unknown>,
//     refundAmount?: number
//   ): Promise<Record<string, unknown> | PaymentProcessorError> {
//     try {
//       const paymentId = paymentSessionData.asaas_payment_id;

//       const response = await this.client.post(
//         `/payments/${paymentId}/refund`,
//         { value: refundAmount || undefined }
//       );

//       return { status: "refunded", ...response.data };
//     } catch (error) {
//       console.error("Erro ao solicitar reembolso:", error);
//       return { error };
//     }
//   }


//   async retrievePayment(
//     paymentSessionData: Record<string, unknown>
//   ): Promise<Record<string, unknown> | PaymentProcessorError> {
//     try {
//       const paymentId = paymentSessionData.asaas_payment_id;

//       const response = await this.client.get(`/payments/${paymentId}`);

//       return response.data;
//     } catch (error) {
//       console.error("Erro ao recuperar pagamento:", error);
//       return { error };
//     }
//   }

//   async updatePayment(
//     context: PaymentProcessorContext
//   ): Promise<void | PaymentProcessorError | PaymentProcessorSessionResponse> {
//     try {
//       const paymentId = context.paymentSessionData.asaas_payment_id;
  
//       const response = await this.client.get(`/payments/${paymentId}`);
  
//       return {
//         session_data: {
//           ...context.paymentSessionData,
//           status: response.data.status,
//         },
//       };
//     } catch (error) {
//       console.error("Erro ao atualizar pagamento no Asaas:", error);
//       return { error };
//     }
//   }
  
// }

// export default AsaasPaymentProcessor

// // import {
// //   AbstractPaymentProcessor,
// //   PaymentProcessorContext,
// //   PaymentProcessorSessionResponse,
// //   PaymentProcessorError,
// //   PaymentSessionStatus,
// // } from "@medusajs/medusa";
// // import axios from "axios";

// // // Constantes diretamente declaradas
// // const ASAAS_API_KEY =
// //   "$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDAwOTQ4NTk6OiRhYWNoXzNhNWM1Nzg2LWYwMWEtNDc0Ny1hYmQ1LWYwN2JiMjY1NjY4Nw==";
// // const ASAAS_API_URL = "https://sandbox.asaas.com/api/v3";

// // class AsaasPaymentProcessor extends AbstractPaymentProcessor {
// //   static identifier = "asaas";

// //   constructor(_, options) {
// //     super(_);
// //   }

// //   /**
// //    * Inicia o pagamento criando uma cobrança no Asaas.
// //    */
// //   async initiatePayment(
// //     context: PaymentProcessorContext
// //   ): Promise<PaymentProcessorSessionResponse | PaymentProcessorError> {
// //     const { customer, amount } = context;

// //     try {
// //       const response = await axios.post(
// //         `${ASAAS_API_URL}/payments`,
// //         {
// //           customer: customer.id, // Substitua pelo ID do cliente no Asaas
// //           billingType: "CREDIT_CARD", // Pode ser alterado para PIX, CARTÃO, etc.
// //           value: amount / 100, // Valor em reais (o Asaas trabalha com valores decimais)
// //           description: "Compra realizada na loja Medusa",
// //           dueDate: new Date().toISOString().split("T")[0], // Data de vencimento
// //         },
// //         {
// //           headers: {
// //             Authorization: `Bearer ${ASAAS_API_KEY}`, // Autenticação com API Key
// //             "Content-Type": "application/json",
// //           },
// //         }
// //       );

// //       // Retorna o ID do pagamento criado para o session_data
// //       return {
// //         session_data: {
// //           asaas_payment_id: response.data.id,
// //         },
// //       };
// //     } catch (error) {
// //       console.error("Erro ao iniciar o pagamento no Asaas:", error);

// //     }
// //   }

// //   /**
// //    * Autoriza o pagamento.
// //    */
// //   async authorizePayment(
// //     paymentSessionData: Record<string, unknown>,
// //     context: Record<string, unknown>
// //   ): Promise<
// //     | {
// //         status: PaymentSessionStatus;
// //         data: Record<string, unknown>;
// //       }
// //     | PaymentProcessorError
// //   > {
// //     const status = await this.getPaymentStatus(paymentSessionData);
// //     return {
// //       status,
// //       data: {
// //         ...paymentSessionData,
// //         idempotency_key: context.idempotency_key,
// //       },
// //     };
// //   }

// //   /**
// //    * Captura o pagamento.
// //    */
// //   async capturePayment(
// //     paymentSessionData: Record<string, unknown>
// //   ): Promise<Record<string, unknown> | PaymentProcessorError> {
// //     try {
// //       const paymentId = paymentSessionData.asaas_payment_id;

// //       if (!paymentId) {
// //         throw new Error("ID do pagamento não encontrado na sessão.");
// //       }

// //       const response = await axios.post(
// //         `${ASAAS_API_URL}/payments/${paymentId}/capture`,
// //         {}, // Corpo vazio para capturar pagamento
// //         {
// //           headers: {
// //             Authorization: `Bearer ${ASAAS_API_KEY}`,
// //             "Content-Type": "application/json",
// //           },
// //         }
// //       );

// //       return { status: "captured", ...response.data };
// //     } catch (error) {
// //       console.error("Erro ao capturar o pagamento no Asaas:", error);
// //       return { error: new Error("Falha ao capturar o pagamento.") };
// //     }
// //   }

// //   /**
// //    * Atualiza informações do pagamento no Asaas.
// //    */
// //   async updatePayment(
// //     context: PaymentProcessorContext
// //   ): Promise<PaymentProcessorSessionResponse | PaymentProcessorError> {
// //     try {
// //       const response = await axios.get(
// //         `${ASAAS_API_URL}/payments/${context.paymentSessionData?.asaas_payment_id}`,
// //         {
// //           headers: {
// //             Authorization: `Bearer ${ASAAS_API_KEY}`,
// //           },
// //         }
// //       );

// //       return {
// //         session_data: {
// //           ...context.paymentSessionData,
// //           status: response.data.status,
// //         },
// //         update_requests: {
// //           customer_metadata: context.customer?.metadata,
// //         },
// //       };
// //     } catch (error) {
// //       console.error("Erro ao atualizar pagamento no Asaas:", error);
// //       return { error };
// //     }
// //   }

// //   /**
// //    * Atualiza dados específicos de uma sessão de pagamento.
// //    */
// //   async updatePaymentData(
// //     sessionId: string,
// //     data: Record<string, unknown>
// //   ): Promise<Record<string, unknown> | PaymentProcessorError> {
// //     return {
// //       session_id: sessionId,
// //       ...data,
// //     };
// //   }

// //   /**
// //    * Recupera informações sobre o pagamento no Asaas.
// //    */
// //   async retrievePayment(
// //     paymentSessionData: Record<string, unknown>
// //   ): Promise<Record<string, unknown> | PaymentProcessorError> {
// //     try {
// //       const response = await axios.get(
// //         `${ASAAS_API_URL}/payments/${paymentSessionData.asaas_payment_id}`,
// //         {
// //           headers: {
// //             Authorization: `Bearer ${ASAAS_API_KEY}`,
// //           },
// //         }
// //       );

// //       return response.data;
// //     } catch (error) {
// //       console.error("Erro ao recuperar pagamento no Asaas:", error);
// //       return { error };
// //     }
// //   }

// //   /**
// //    * Cancela o pagamento no Asaas.
// //    */
// //   async cancelPayment(
// //     paymentSessionData: Record<string, unknown>
// //   ): Promise<Record<string, unknown> | PaymentProcessorError> {
// //     try {
// //       await axios.post(
// //         `${ASAAS_API_URL}/payments/${paymentSessionData.asaas_payment_id}/cancel`,
// //         {},
// //         {
// //           headers: {
// //             Authorization: `Bearer ${ASAAS_API_KEY}`,
// //           },
// //         }
// //       );

// //       return { status: "cancelled" };
// //     } catch (error) {
// //       console.error("Erro ao cancelar o pagamento no Asaas:", error);
// //       return { error };
// //     }
// //   }

// //   /**
// //    * Exclui um pagamento (equivale a cancelar no Asaas).
// //    */
// //   async deletePayment(
// //     paymentSessionData: Record<string, unknown>
// //   ): Promise<Record<string, unknown> | PaymentProcessorError> {
// //     return await this.cancelPayment(paymentSessionData);
// //   }

// //   /**
// //    * Solicita reembolso do pagamento no Asaas.
// //    */
// //   async refundPayment(
// //     paymentSessionData: Record<string, unknown>,
// //     refundAmount?: number
// //   ): Promise<Record<string, unknown> | PaymentProcessorError> {
// //     try {
// //       await axios.post(
// //         `${ASAAS_API_URL}/payments/${paymentSessionData.asaas_payment_id}/refund`,
// //         {
// //           value: refundAmount || undefined,
// //         },
// //         {
// //           headers: {
// //             Authorization: `Bearer ${ASAAS_API_KEY}`,
// //           },
// //         }
// //       );

// //       return { status: "refunded" };
// //     } catch (error) {
// //       console.error("Erro ao solicitar reembolso no Asaas:", error);
// //       return { error };
// //     }
// //   }

// //   /**
// //    * Obtém o status do pagamento.
// //    */
// //   async getPaymentStatus(
// //     paymentSessionData: Record<string, unknown>
// //   ): Promise<PaymentSessionStatus> {
// //     try {
// //       const response = await axios.get(
// //         `${ASAAS_API_URL}/payments/${paymentSessionData.asaas_payment_id}`,
// //         {
// //           headers: {
// //             Authorization: `Bearer ${ASAAS_API_KEY}`,
// //           },
// //         }
// //       );

// //       const status = response.data.status;
// //       switch (status) {
// //         case "PENDING":
// //           return PaymentSessionStatus.PENDING;
// //         case "CONFIRMED":
// //         case "RECEIVED":
// //           return PaymentSessionStatus.AUTHORIZED;
// //         case "REFUNDED":
// //           return PaymentSessionStatus.CANCELED;
// //         case "CANCELLED":
// //           return PaymentSessionStatus.CANCELED;
// //         default:
// //           return PaymentSessionStatus.PENDING;
// //       }
// //     } catch (error) {
// //       console.error("Erro ao obter status do pagamento no Asaas:", error);
// //       return PaymentSessionStatus.ERROR;
// //     }
// //   }
// // }

// // export default AsaasPaymentProcessor;

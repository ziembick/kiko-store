const express = require('express');
const router = express.Router();
const axios = require('axios'); // Para chamadas à API do Mercado Pago, se necessário

// Endpoint para receber notificações do Mercado Pago
router.post('/mercadopago', (req, res) => {
  const { type, data } = req.body;

  // Verifique o tipo da notificação
  if (type === 'payment') {
    const paymentId = data.id;

    // Chama uma função para processar o pagamento usando o paymentId
    processPaymentUpdate(paymentId)
      .then(() => res.status(200).send('OK'))
      .catch((error) => {
        console.error('Erro ao processar pagamento:', error);
        res.status(500).send('Erro interno');
      });
  } else {
    res.status(400).send('Tipo de notificação não suportado');
  }
});

// Função para processar o pagamento (exemplo, você pode adaptar)
async function processPaymentUpdate(paymentId) {
  console.log(`Processando atualização do pagamento para o ID: ${paymentId}`);
  
  try {
    // Exemplo de chamada para verificar o status do pagamento no Mercado Pago
    const response = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`
      }
    });
    
    const paymentStatus = response.data.status;
    console.log(`Status do pagamento: ${paymentStatus}`);
    
    // Aqui você poderia atualizar o status do pedido na sua aplicação Medusa, conforme necessário
  } catch (error) {
    console.error("Erro ao buscar informações de pagamento do Mercado Pago:", error);
    throw error;
  }
}

module.exports = router;

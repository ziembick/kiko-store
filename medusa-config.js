const dotenv = require("dotenv");
const { resolve } = require("path");

let ENV_FILE_NAME = "";
switch (process.env.NODE_ENV) {
  case "production":
    ENV_FILE_NAME = ".env.production";
    break;
  case "staging":
    ENV_FILE_NAME = ".env.staging";
    break;
  case "test":
    ENV_FILE_NAME = ".env.test";
    break;
  case "development":
  default:
    ENV_FILE_NAME = ".env";
    break;
}

try {
  dotenv.config({ path: process.cwd() + "/" + ENV_FILE_NAME });
} catch (e) {}

// CORS when consuming Medusa from admin
const ADMIN_CORS =
  process.env.ADMIN_CORS || "http://localhost:7000,http://localhost:7001";

// CORS to avoid issues when consuming Medusa from a client
const STORE_CORS = process.env.STORE_CORS || "http://localhost:8000";

const DATABASE_URL =
  process.env.DATABASE_URL || "postgres://localhost/medusa-starter-default";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const plugins = [
  `medusa-fulfillment-manual`,
  `medusa-payment-manual`,
  {
    resolve: `@medusajs/file-local`,
    options: {
      upload_dir: "uploads",
    },
  },
  {
    resolve: `medusa-plugin-sendgrid`,
    options: {
      api_key: process.env.SENDGRID_API_KEY,
      from: process.env.SENDGRID_FROM,
      order_placed_template: 
        process.env.SENDGRID_ORDER_PLACED_ID,
      localization: {
        "de-DE": { // locale key
          order_placed_template:
            process.env.SENDGRID_ORDER_PLACED_ID_LOCALIZED,
        },
      },
    },
  },
  {
    resolve: `medusa-payment-stripe`,
    options: {
      api_key: process.env.STRIPE_API_KEY,
      webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
    },
  },
  {
    resolve: `medusa-plugin-algolia`,
    options: {
      applicationId: process.env.ALGOLIA_APP_ID,
      adminApiKey: process.env.ALGOLIA_ADMIN_API_KEY,
      settings: {
        products: {
          indexSettings: {
            searchableAttributes: ["title", "description", "variant_sku"],
            attributesToRetrieve: [
              "id",
              "title",
              "description",
              "handle",
              "thumbnail",
              "variants",
              "variant_sku",
              "options",
              "collection_title",
              "collection_handle",
              "images",
            ],
          },
          // O transformer irá alterar os dados do produto antes de enviá-los ao Algolia
          transformer: (product) => ({
            objectID: product.id, // O Algolia usa objectID como identificador único
            title: product.title,
            description: product.description,
            handle: product.handle,
            thumbnail: product.thumbnail,
            variant_sku: product.variants.map(v => v.sku), // Mapeia SKUs das variantes
            options: product.options.map(o => ({
              title: o.title,
              values: o.values
            })),
            collection_title: product.collection ? product.collection.title : null,
            collection_handle: product.collection ? product.collection.handle : null,
            images: product.images
          }),
        },
      },
    },
  },
  {
    resolve: `@rsc-labs/medusa-store-analytics`,
    options: {
      enableUI: true
    }
  },
  {
    resolve: `medusa-payment-paypal`,
    options: {
      sandbox: process.env.PAYPAL_SANDBOX,
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      authWebhookId: process.env.PAYPAL_AUTH_WEBHOOK_ID,
    },
  },
  {
    resolve: `medusa-plugin-custom-dashboard`,
    options: {
        enableUI: true,
    },
},
  // {
  //   resolve: `./src/services/mercado-pago-provider`,
  //   options: {
  //     access_token: process.env.MERCADOPAGO_ACCESS_TOKEN,
  //     success_backurl: process.env.MERCADOPAGO_SUCCESS_BACKURL,
  //     webhook_url: process.env.MERCADOPAGO_WEBHOOK_URL
  //   }, //hook do mercado pago
  // },
  // {
  //   resolve:`/src/services/asaas-payment-provider`,
  //   options: { 
  //     api_url: process.env.ASAAS_API_URL,
  //     api_key: process.env.ASAAS_API_KEY,
  //     webhook_url: process.env.ASAAS_WEBHOOK 
  //   },
  // },
  
  {
    resolve: "@medusajs/admin",
    /** @type {import('@medusajs/admin').PluginOptions} */
    options: {
      autoRebuild: true,
      develop: {
        open: process.env.OPEN_BROWSER !== "false",
      },
    },
  },
];

const modules = {
  eventBus: {
    resolve: "@medusajs/event-bus-redis",
    options: {
      redisUrl: REDIS_URL
    }
  },
  cacheService: {
    resolve: "@medusajs/cache-redis",
    options: {
      redisUrl: REDIS_URL
    }
  },
};

/** @type {import('@medusajs/medusa').ConfigModule["projectConfig"]} */
const projectConfig = {
  jwt_secret: process.env.JWT_SECRET || "supersecret",
  cookie_secret: process.env.COOKIE_SECRET || "supersecret",
  store_cors: STORE_CORS,
  database_url: DATABASE_URL,
  worker_mode: process.env.MEDUSA_WORKER_MODE,
  admin_cors: ADMIN_CORS,
  // Uncomment the following lines to enable REDIS
  redis_url: REDIS_URL,
  api_key_asaas: process.env.ASAAS_API_KEY,
  api_url_asaas: process.env.ASAAS_API_URL,
};

/** @type {import('@medusajs/medusa').ConfigModule} */
module.exports = {
  projectConfig,
  plugins,
  modules,
};

const envVars = {
  PORT: process.env.PORT || "3000",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
  DB_HOST: process.env.DB_HOST || "127.0.0.1",
  DB_PORT: parseInt(process.env.DB_PORT || "3306"),
  DB_USER: process.env.DB_USER || "root",
  DB_PASSWORD: process.env.DB_PASSWORD || "",
  DB_NAME: process.env.DB_NAME || "domain_dashboard",
  JWT_SECRET: process.env.JWT_SECRET as string,
  JWT_EXPIRY: process.env.JWT_EXPIRY || "24h",
  DEFAULT_RESELLER_ID: process.env.DEFAULT_RESELLER_ID || "",
  SUMOPOD_API_KEY: process.env.SUMOPOD_API_KEY || "",
  SUMOPOD_PAYMENT_URL: process.env.SUMOPOD_PAYMENT_URL || "https://api-pay-sandbox.sumopod.com/api/v1",
  SUMOPOD_WEBHOOK_TOKEN: process.env.SUMOPOD_WEBHOOK_TOKEN || "",
  SUMOPOD_WEBHOOK_SECRET: process.env.SUMOPOD_WEBHOOK_SECRET || "",
  LIQUID_BASE_URL: process.env.LIQUID_BASE_URL || "https://api.domainsas.com:443/v1/",
  APP_URL: process.env.APP_URL || "http://localhost:5173",
} as const;

if (!envVars.JWT_SECRET || envVars.JWT_SECRET.length < 16) {
  throw new Error("JWT_SECRET must be set in .env and at least 16 characters");
}

export const env = envVars;

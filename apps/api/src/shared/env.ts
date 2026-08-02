function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: required("NODE_ENV", "development"),
  port: Number(required("PORT", "4000")),
  corsOrigin: required("CORS_ORIGIN", "http://localhost:5173"),
  mongodbUri: required("MONGODB_URI", "mongodb://localhost:27017/stockc?replicaSet=rs0"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev-only-insecure-secret-change-me"),
};

import "dotenv/config";
import { createApp } from "./app.js";

const PORT = process.env.PORT || 3400;
const HOST = process.env.HOST || "0.0.0.0";

async function startServer() {
  const app = await createApp();
  const server = app.listen(PORT, HOST, () => {
    console.log(`[${new Date().toISOString()}] Personal Trainer rodando em ${HOST}:${PORT}`);
  });
  return server;
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}

export { startServer };

import "dotenv/config";
import { createApp } from "./app.js";

const PORT = process.env.PORT || 3400;

async function startServer() {
  const app = await createApp();
  const server = app.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Personal Trainer rodando na porta ${PORT}`);
  });
  return server;
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}

export { startServer };

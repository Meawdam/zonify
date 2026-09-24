import "dotenv/config";

import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

const startServer = async () => {
  try {
    await connectDatabase();

    app.listen(env.PORT, () => {
      console.log(`Server running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

startServer();

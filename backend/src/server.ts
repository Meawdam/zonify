import "dotenv/config";

import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { startBookingExpiry } from "./modules/bookings/booking.worker.js";

const startServer = async () => {
  try {
    await connectDatabase();
    await new Promise<void>((resolve, reject) => {
      const server = app.listen(env.PORT);
      server.once("listening", resolve);
      server.once("error", reject);
    });
    startBookingExpiry();
    console.log(`Server running on port ${env.PORT}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

startServer();

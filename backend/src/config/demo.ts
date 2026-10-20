// Demo is restricted to its own database and loopback HTTP origin.
export function assertDemoEnvironment(uri: string, origin: string, host: string) {
  const database = new URL(uri);
  const app = new URL(origin);
  if (database.protocol !== "mongodb:" || database.hostname !== "127.0.0.1" || database.pathname !== "/zonify_demo" || database.search || database.username || database.password ||
      app.protocol !== "http:" || app.hostname !== "127.0.0.1" || host !== "127.0.0.1") {
    throw new Error("Demo requires loopback HTTP, loopback MongoDB and the zonify_demo database");
  }
}

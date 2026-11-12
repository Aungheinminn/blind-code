// Bun loads .env before tests run, and its DATABASE_URL points at a real
// database. Tests only ever get TEST_DATABASE_URL, so they can't write to it.
if (process.env.TEST_DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  delete process.env.DATABASE_URL;
}

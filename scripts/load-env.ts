// Import first in scripts: load .env (if present) before anything reads process.env.
try {
  process.loadEnvFile();
} catch {
  /* no .env file: use the environment as is */
}

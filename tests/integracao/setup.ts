try {
  process.loadEnvFile(".env.local");
} catch {
  // sem .env.local: testes de integração ficam pulados
}

import 'dotenv/config';
import { app } from './app';
import { getJwtSecret } from './services/token.service';
import * as emailService from './services/email.service';

// Fail fast: in production this throws if JWT_SECRET is missing or too short.
getJwtSecret();

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => {
  console.log(`VisualStack API server running at http://localhost:${PORT}`);
  // Logs "SMTP ready" or a clear Gmail error (e.g. bad app password) right at startup.
  const verifyEmailTransport = (emailService as {
    verifyEmailTransport?: () => Promise<void> | void;
  }).verifyEmailTransport;

  if (typeof verifyEmailTransport === 'function') {
    void verifyEmailTransport();
  }
});

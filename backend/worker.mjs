import { env } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import api from './api.js';
import neon from './neon.js';
import security from './online-security.js';

const handler = httpServerHandler({ port: 3000 });
if (env.DATABASE_URL) {
  const database = neon.openNeon(env.DATABASE_URL);
  const app = api.createApi({
    database,
    origins: env.CORS_ORIGINS || 'https://weizhiqq0-glitch.github.io',
    passwords: security.createOnlinePasswords(database),
    authLimit: security.createOnlineAuthLimit(database),
    emailConfig: env,
    trustCloudflare: true,
  });
  app.listen(3000);
}

export default {
  fetch(request, bindings, context) {
    if (!env.DATABASE_URL) return Response.json({ error: '后端尚未配置数据库' }, { status: 503 });
    return handler.fetch(request, bindings, context);
  },
};

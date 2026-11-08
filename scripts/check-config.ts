import { appOrigin } from '../lib/server/config.ts';
const errors:string[]=[];
try { if(new URL(appOrigin()).protocol!=='https:') errors.push('APP_URL must use HTTPS in production.'); } catch { errors.push('APP_URL is required.'); }
if(!/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL||''))errors.push('DATABASE_URL must point to PostgreSQL.');
if(Buffer.from(process.env.TOKEN_ENCRYPTION_KEY||'','base64').length!==32)errors.push('TOKEN_ENCRYPTION_KEY must contain 32 random bytes encoded as base64.');
for(const provider of ['GOOGLE','MICROSOFT'])if(Boolean(process.env[`${provider}_CLIENT_ID`])!==Boolean(process.env[`${provider}_CLIENT_SECRET`]))errors.push(`${provider}_CLIENT_ID and ${provider}_CLIENT_SECRET must be configured together.`);
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log('Production configuration is valid.');

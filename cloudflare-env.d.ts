declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    STUDIO_OWNER_EMAIL?: string;
    APP_ORIGIN?: string;
    STUDIO_RUNTIME?: string;
    STUDIO_CLIENT_IP_HEADER?: string;
  }
}

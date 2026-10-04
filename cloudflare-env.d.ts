declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    STUDIO_OWNER_EMAIL?: string;
    STUDIO_SETUP_KEY_HASH?: string;
    STUDIO_SETUP_EXPIRES?: string;
  }
}

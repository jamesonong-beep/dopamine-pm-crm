declare namespace Cloudflare {
  interface Env {
    PILOT_OWNER_EMAIL?: string;
    PILOT_COOWNER_EMAIL?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}

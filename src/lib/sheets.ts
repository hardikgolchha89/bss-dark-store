// Google Sheets access via a service-account JWT (signed with Node crypto) + the
// Sheets REST API. No googleapis dependency (keeps the bundle light + Turbopack-safe).
// Creds from env; target spreadsheet id from env or the `sheets_spreadsheet_id` setting.
import crypto from "node:crypto";
import { prisma } from "./prisma";

export class SheetsConfigError extends Error {}

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

let cachedToken: { token: string; exp: number } | null = null;

function creds() {
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim();
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new SheetsConfigError(
      "Missing service-account creds (GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY).",
    );
  }
  return { email, key };
}

async function getSpreadsheetId(): Promise<string> {
  const fromEnv = process.env.GOOGLE_SHEETS_ID?.trim();
  if (fromEnv) return fromEnv;
  const s = await prisma.setting.findUnique({ where: { key: "sheets_spreadsheet_id" } });
  const id = s?.value?.trim();
  if (!id) throw new SheetsConfigError("No spreadsheet ID set (Admin → Sheets settings, or GOOGLE_SHEETS_ID).");
  return id;
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const { email, key } = creds();
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(
    JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
  ).toString("base64url");
  const signingInput = `${header}.${claim}`;
  const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(key).toString("base64url");
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new SheetsConfigError(`Auth failed: ${json.error_description || json.error || res.status}`);
  }
  cachedToken = { token: json.access_token, exp: now + 3600 };
  return json.access_token;
}

async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${SHEETS_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new SheetsConfigError(`Sheets API ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function sheetsConfigured(): Promise<{ ok: boolean; message: string; email?: string }> {
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim();
  try {
    const id = await getSpreadsheetId();
    const meta = await api<{ properties?: { title?: string } }>("GET", `/${id}?fields=properties.title`);
    return { ok: true, message: `Connected to "${meta.properties?.title}"`, email };
  } catch (e) {
    const msg = e instanceof SheetsConfigError ? e.message : (e as Error).message;
    return { ok: false, message: msg, email };
  }
}

async function ensureTab(title: string) {
  const id = await getSpreadsheetId();
  const meta = await api<{ sheets?: { properties?: { title?: string } }[] }>(
    "GET",
    `/${id}?fields=sheets.properties.title`,
  );
  const exists = meta.sheets?.some((s) => s.properties?.title === title);
  if (!exists) {
    await api("POST", `/${id}:batchUpdate`, { requests: [{ addSheet: { properties: { title } } }] });
  }
}

const enc = (s: string) => encodeURIComponent(s);

// Overwrite a tab with rows (clears existing content first).
export async function writeTab(title: string, rows: (string | number)[][]): Promise<void> {
  await ensureTab(title);
  const id = await getSpreadsheetId();
  await api("POST", `/${id}/values/${enc(title)}:clear`, {});
  await api("PUT", `/${id}/values/${enc(`${title}!A1`)}?valueInputOption=RAW`, { values: rows });
}

// Read a tab as an array-of-arrays (empty if the tab doesn't exist / is empty).
export async function readTab(title: string): Promise<string[][]> {
  const id = await getSpreadsheetId();
  try {
    const res = await api<{ values?: string[][] }>("GET", `/${id}/values/${enc(title)}`);
    return res.values ?? [];
  } catch {
    return [];
  }
}

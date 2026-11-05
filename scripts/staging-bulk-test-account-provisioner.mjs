#!/usr/bin/env node
import { readFile, writeFile, mkdir, chmod, open, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const STAGING_PROVISIONER_ORIGIN = "https://thornie-dungeons-api-staging.ekqtjl.workers.dev";
const STAGING_HOST = "thornie-dungeons-api-staging.ekqtjl.workers.dev";
const MAX_BATCH = 100;
const MAX_CHARACTER_SLOTS = 3;
const TEST_ID_PATTERN = /^STG_[A-Z0-9_]{1,16}$/;

export function validateTarget(value = STAGING_PROVISIONER_ORIGIN) {
  let url;
  try { url = new URL(value); } catch { throw new Error("invalid_target_url"); }
  if (url.protocol !== "https:") throw new Error("https_required");
  if (url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) {
    throw new Error("target_url_not_allowed");
  }
  if (url.hostname !== STAGING_HOST || url.origin !== STAGING_PROVISIONER_ORIGIN) {
    throw new Error("staging_host_not_allowlisted");
  }
  return url.origin;
}

export function validateProvisionerInput(value, batchId) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(String(batchId || ""))) throw new Error("invalid_batch_id");
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.accounts)) {
    throw new Error("accounts_array_required");
  }
  if (value.accounts.length < 1) throw new Error("accounts_required");
  if (value.accounts.length > MAX_BATCH) throw new Error("batch_limit_exceeded");

  const ids = new Set();
  const accounts = value.accounts.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("invalid_account_entry");
    const testId = String(item.testId || "").trim();
    if (!TEST_ID_PATTERN.test(testId)) throw new Error("invalid_test_id");
    const normalizedId = testId.toLowerCase();
    if (ids.has(normalizedId)) throw new Error("duplicate_test_id");
    ids.add(normalizedId);

    const rawNames = item.characterNames === undefined ? [] : item.characterNames;
    if (!Array.isArray(rawNames) || rawNames.length > MAX_CHARACTER_SLOTS) throw new Error("character_count_out_of_range");
    const names = new Set();
    const characterNames = rawNames.map(rawName => {
      if (typeof rawName !== "string") throw new Error("invalid_character_name");
      const name = rawName.trim();
      if (!name || name.length > 16) throw new Error("invalid_character_name");
      const normalizedName = name.toLowerCase();
      if (names.has(normalizedName)) throw new Error("duplicate_character_name");
      names.add(normalizedName);
      return name;
    });
    return { testId, characterNames };
  });
  return { batchId, accounts };
}

function parseArgs(args) {
  const parsed = { input: "", batchId: "", out: "", execute: false, confirm: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--input") parsed.input = args[++index] || "";
    else if (arg === "--batch-id") parsed.batchId = args[++index] || "";
    else if (arg === "--out") parsed.out = args[++index] || "";
    else if (arg === "--execute") parsed.execute = true;
    else if (arg === "--confirm-staging-provisioning") parsed.confirm = true;
    else if (arg === "--help") parsed.help = true;
    else throw new Error("unknown_argument");
  }
  return parsed;
}

function repoRootFromModule() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function safeManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.accounts)) throw new Error("credential_manifest_missing");
  return {
    schemaVersion: Number(manifest.schemaVersion) || 1,
    generatedAt: String(manifest.generatedAt || new Date().toISOString()),
    target: String(manifest.target || STAGING_HOST),
    batchId: String(manifest.batchId || ""),
    accounts: manifest.accounts.map(account => ({
      testId: String(account.testId || ""),
      password: String(account.password || ""),
      status: String(account.status || "unknown"),
      characters: Array.isArray(account.characters) ? account.characters.map(character => ({
        characterId: String(character.characterId || ""),
        name: String(character.name || "")
      })) : []
    }))
  };
}

async function reserveCredentialManifestPath(requestedPath, batchId, repoRoot) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultPath = path.join(
    os.homedir(), ".thorniedungeons", "staging", "credentials",
    `${batchId}-${timestamp}.json`
  );
  const outputPath = path.resolve(requestedPath || defaultPath);
  if (isInside(repoRoot, outputPath)) throw new Error("manifest_must_be_outside_repository");

  const directory = path.dirname(outputPath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const handle = await open(outputPath, "wx", 0o600);
  await handle.close();
  await chmod(outputPath, 0o600);
  return outputPath;
}

async function writeCredentialManifestAt(manifest, outputPath) {
  const protectedManifest = safeManifest(manifest);
  await writeFile(outputPath, JSON.stringify(protectedManifest, null, 2) + "\n", {
    encoding: "utf8",
    flag: "w",
    mode: 0o600
  });
  await chmod(outputPath, 0o600);
  return outputPath;
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const parsed = parseArgs(args);
  if (parsed.help) {
    return {
      help: "Use --input <json> --batch-id <id> [--out <path>] [--execute --confirm-staging-provisioning]. The secret is read from STAGING_PROVISIONER_SECRET."
    };
  }
  if (!parsed.input) throw new Error("input_file_required");
  const target = validateTarget(env.STAGING_API_URL || STAGING_PROVISIONER_ORIGIN);
  const repoRoot = repoRootFromModule();
  const inputPath = path.resolve(parsed.input);
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const batch = validateProvisionerInput(input, parsed.batchId);
  const characterCount = batch.accounts.reduce((sum, account) => sum + account.characterNames.length, 0);

  if (!parsed.execute) {
    return {
      mode: "dry-run",
      target,
      batchId: batch.batchId,
      accounts: batch.accounts.length,
      characters: characterCount,
      networkRequests: 0
    };
  }
  if (!parsed.confirm) throw new Error("explicit_staging_confirmation_required");
  const secret = String(env.STAGING_PROVISIONER_SECRET || "");
  if (secret.length < 32) throw new Error("staging_provisioner_secret_required");

  // Reserve the destination before making the provisioning request. This prevents an
  // unsafe/in-repository or already-existing output path from failing after accounts exist.
  const manifestPath = await reserveCredentialManifestPath(parsed.out, batch.batchId, repoRoot);
  let manifestSaved = false;
  try {
    const response = await fetch(target, {
      method: "POST",
      redirect: "error",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
        "x-confirm-staging-provisioning": "YES"
      },
      body: JSON.stringify({
        action: "stagingProvisionTestAccounts",
        batchId: batch.batchId,
        accounts: batch.accounts
      }),
      signal: AbortSignal.timeout(30000)
    });
    let payload;
    try { payload = await response.json(); } catch { throw new Error("provisioner_response_invalid"); }

    if (payload?.credentialManifest) {
      await writeCredentialManifestAt(payload.credentialManifest, manifestPath);
      manifestSaved = true;
    }
    if (!response.ok && !payload?.credentialManifest) {
      throw new Error(String(payload?.error || `provisioner_request_failed_${response.status}`));
    }
    return {
      mode: "execute",
      ok: payload?.ok === true,
      partial: payload?.partial === true,
      batchId: batch.batchId,
      requested: Number(payload?.requested) || batch.accounts.length,
      attempted: Number(payload?.attempted) || 0,
      created: Number(payload?.created) || 0,
      error: payload?.error || null,
      manifestPath: manifestSaved ? manifestPath : ""
    };
  } finally {
    if (!manifestSaved) await rm(manifestPath, { force: true }).catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(result => {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.ok === false) process.exitCode = 1;
  }).catch(error => {
    process.stderr.write("staging-bulk-provisioner: " + String(error?.message || "failed") + "\n");
    process.exitCode = 1;
  });
}

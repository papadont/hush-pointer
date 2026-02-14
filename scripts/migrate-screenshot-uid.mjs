#!/usr/bin/env node
import process from "node:process";
import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const argv = process.argv.slice(2);
const options = {
  from: "",
  to: "",
  project: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "",
  dryRun: false,
  force: false
};

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === "--from") {
    options.from = argv[++i] ?? "";
  } else if (arg === "--to") {
    options.to = argv[++i] ?? "";
  } else if (arg === "--project") {
    options.project = argv[++i] ?? "";
  } else if (arg === "--dry-run") {
    options.dryRun = true;
  } else if (arg === "--force") {
    options.force = true;
  } else if (arg === "--help" || arg === "-h") {
    printHelp(0);
  } else {
    console.error(`Unknown option: ${arg}`);
    printHelp(1);
  }
}

if (!options.from || !options.to) {
  console.error("Missing required options: --from and --to");
  printHelp(1);
}

if (options.from === options.to) {
  console.error("--from and --to must be different values.");
  process.exit(1);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !options.project) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS or pass --project for ADC.");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId: options.project || undefined
  });
}

const db = getFirestore();

async function main() {
  const querySnapshot = await db.collection("screenshots").where("uid", "==", options.from).get();

  console.log(`Matched documents: ${querySnapshot.size}`);

  if (querySnapshot.empty) {
    return;
  }

  if (options.dryRun) {
    console.log("Dry-run mode. No writes executed.");
    for (const docSnap of querySnapshot.docs.slice(0, 20)) {
      console.log(`- ${docSnap.id}`);
    }
    if (querySnapshot.size > 20) {
      console.log(`...and ${querySnapshot.size - 20} more`);
    }
    return;
  }

  if (!options.force) {
    console.error("Refusing to write without --force. Re-run with --force to execute.");
    process.exit(1);
  }

  const batchSize = 400;
  let updated = 0;

  for (let start = 0; start < querySnapshot.docs.length; start += batchSize) {
    const chunk = querySnapshot.docs.slice(start, start + batchSize);
    const batch = db.batch();

    for (const docSnap of chunk) {
      batch.update(docSnap.ref, {
        uid: options.to,
        migratedAt: FieldValue.serverTimestamp()
      });
    }

    await batch.commit();
    updated += chunk.length;
    console.log(`Committed ${updated}/${querySnapshot.size}`);
  }

  console.log("Migration completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function printHelp(exitCode) {
  console.log(`\nUsage:\n  node scripts/migrate-screenshot-uid.mjs --from <oldUid> --to <newUid> [--dry-run] [--force] [--project <projectId>]\n\nNotes:\n  - Requires admin credentials via GOOGLE_APPLICATION_CREDENTIALS (service account JSON)\n    or application default credentials with --project.\n  - --dry-run prints matched count and sample doc IDs only.\n  - --force is required for actual writes.\n`);
  process.exit(exitCode);
}

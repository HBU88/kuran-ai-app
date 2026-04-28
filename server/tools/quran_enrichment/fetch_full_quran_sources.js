const fs = require("fs");
const path = require("path");

const workspaceRoot = path.join(__dirname, "..", "..", "..");
const fullQuranDir = path.join(workspaceRoot, "assets", "data", "full_quran");
const arabicPath = path.join(fullQuranDir, "source_ar.json");
const turkishPath = path.join(fullQuranDir, "source_tr.json");

function main() {
  const arabicExists = fs.existsSync(arabicPath);
  const turkishExists = fs.existsSync(turkishPath);

  console.log("FULL QURAN SOURCE CHECK");
  console.log(`Arabic source exists: ${arabicExists}`);
  console.log(`Turkish source exists: ${turkishExists}`);

  if (arabicExists && turkishExists) {
    console.log("Both source files are present. You can run build_full_quran_source.js next.");
    process.exit(0);
  }

  console.log("");
  console.log("Missing source files. Manual preparation is required before build.");
  console.log("");
  console.log("Required files:");
  if (!arabicExists) {
    console.log(`- Missing Arabic source: ${arabicPath}`);
    console.log("  Expected content: JSON array or object containing Quran Arabic ayah records.");
    console.log("  Recommended source: Tanzil-compatible export.");
  }
  if (!turkishExists) {
    console.log(`- Missing Turkish source: ${turkishPath}`);
    console.log("  Expected content: JSON array or object containing Turkish translation ayah records.");
    console.log("  Recommended source: Diyanet-compatible export.");
  }
  console.log("");
  console.log("Schema notes:");
  console.log("- Arabic side should include surah/chapter number, ayah/verse number, and Arabic text.");
  console.log("- Turkish side should include surah/chapter number, ayah/verse number, and Turkish translation text.");
  console.log("- Runtime is not switched yet. Current runtime dataset remains assets/data/ayahs.json.");

  process.exit(0);
}

main();

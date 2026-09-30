import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetFile = path.resolve(
  __dirname,
  "../node_modules/@ai-sdk/google/dist/index.mjs"
);

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, "utf-8");
  if (!content.includes("skip_thought_signature_validator")) {
    content = content.replace(
      'name: part.toolName,\n                    args: part.args\n                  }',
      'name: part.toolName,\n                    args: part.args\n                  },\n                  thoughtSignature: "skip_thought_signature_validator",\n                  thought_signature: "skip_thought_signature_validator"'
    );
    fs.writeFileSync(targetFile, content, "utf-8");
    console.log(">>> [ai-service] Successfully patched @ai-sdk/google for Gemini 3 thoughtSignature support.");
  }
}

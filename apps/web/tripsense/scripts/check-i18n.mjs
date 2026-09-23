import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, parse } from 'node:path';
import { collectSchema, compareSchemas, sortObject } from './i18n-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const localesDir = join(__dirname, '../src/locales');

const shouldFix = process.argv.includes('--fix');

// Dynamically discover all JSON files in src/locales/
const entries = await readdir(localesDir);
const jsonFiles = entries.filter((f) => f.endsWith('.json')).sort();

if (jsonFiles.length === 0) {
  console.error('Không tìm thấy file ngôn ngữ (.json) trong src/locales');
  process.exit(1);
}

const localeFiles = jsonFiles.map((file) => ({
  locale: parse(file).name,
  filename: file,
  path: join(localesDir, file),
}));

const translations = {};
const errors = [];

for (const file of localeFiles) {
  const raw = await readFile(file.path, 'utf8');
  try {
    translations[file.locale] = JSON.parse(raw);
  } catch (error) {
    errors.push(`${file.filename} không phải JSON hợp lệ: ${error.message}`);
    continue;
  }

  const formatted = `${JSON.stringify(sortObject(translations[file.locale]), null, 2)}\n`;
  if (shouldFix) {
    await writeFile(file.path, formatted, 'utf8');
    console.log(`Đã sắp xếp ${file.filename}.`);
  } else if (raw !== formatted) {
    errors.push(`${file.filename} chưa được sắp xếp A → Z. Chạy: npm run i18n:sort`);
  }
}

// Compare each locale against reference locale (en or the first one)
const referenceLocale = translations.en ? 'en' : localeFiles[0].locale;

if (!errors.length && Object.keys(translations).length > 1) {
  const refSchema = collectSchema(translations[referenceLocale]);

  for (const file of localeFiles) {
    if (file.locale === referenceLocale) continue;
    const targetSchema = collectSchema(translations[file.locale]);
    errors.push(...compareSchemas(refSchema, targetSchema, referenceLocale, file.locale));
    errors.push(...compareSchemas(targetSchema, refSchema, file.locale, referenceLocale));
  }
}

if (errors.length) {
  console.error('\nI18n validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`I18n validation passed: Tất cả ${localeFiles.map((f) => f.filename).join(', ')} có cùng schema và đúng thứ tự A → Z.`);

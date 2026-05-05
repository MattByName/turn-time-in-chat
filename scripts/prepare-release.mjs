#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const buildDir = path.join(root, "build");
const distDir = path.join(root, "dist");
const packageDir = path.join(distDir, "package");
const sourceManifestPath = path.join(root, "module.json");
const textEncoder = new TextEncoder();

if (!existsSync(buildDir)) {
  throw new Error("build/ does not exist. Run npm run build before preparing a release.");
}

const manifest = JSON.parse(readFileSync(sourceManifestPath, "utf8"));
const releaseTag =
  process.env.RELEASE_TAG?.trim() ||
  (process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME?.trim() : "") ||
  "";
const releaseVersion = process.env.RELEASE_VERSION?.trim() || releaseTag.replace(/^v/, "") || manifest.version;
const tagName = releaseTag || `v${releaseVersion}`;
const repository =
  process.env.GITHUB_REPOSITORY?.trim() ||
  manifest.url?.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/?$/)?.[1];

if (!releaseVersion) {
  throw new Error("Could not determine release version from RELEASE_VERSION, RELEASE_TAG, or module.json.");
}

manifest.version = releaseVersion;

if (repository) {
  manifest.url = `https://github.com/${repository}`;
  manifest.manifest = `https://github.com/${repository}/releases/latest/download/module.json`;
  manifest.download = `https://github.com/${repository}/releases/download/${tagName}/module.zip`;
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(packageDir, { recursive: true });
cpSync(buildDir, packageDir, { recursive: true });

const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync(path.join(distDir, "module.json"), manifestJson);
writeFileSync(path.join(packageDir, "module.json"), manifestJson);
writeFileSync(path.join(distDir, "module.zip"), createZip(packageDir));

console.log(`Prepared ${manifest.id} ${manifest.version} for ${tagName}`);

function createZip(sourceDir) {
  const files = listFiles(sourceDir);
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const absolutePath = path.join(sourceDir, file);
    const data = readFileSync(absolutePath);
    const name = textEncoder.encode(file.split(path.sep).join("/"));
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

function listFiles(directory, base = directory) {
  return readdirSync(directory)
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry);
      const relativePath = path.relative(base, absolutePath);
      return statSync(absolutePath).isDirectory() ? listFiles(absolutePath, base) : relativePath;
    })
    .sort();
}

function crc32(data) {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

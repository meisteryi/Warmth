#!/usr/bin/env node
/**
 * 수동 전용 GitHub Release 스크립트 (iOS .ipa + Android .apk)
 * - 사용자가 명시적으로 릴리스를 요청할 때만 실행합니다 (자동 실행 안 함).
 * - 사용법:
 *   node scripts/release.mjs --version 1.0.0   (지정 버전으로 릴리스)
 *   node scripts/release.mjs --bump            (패치 버전 +1 자동 증가 후 릴리스)
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, execSync } from 'node:child_process';

const ROOT = process.cwd();
const PKG_PATH = path.join(ROOT, 'package.json');
const PBXPROJ_PATH = path.join(ROOT, 'ios/App/App.xcodeproj/project.pbxproj');
const GRADLE_PATH = path.join(ROOT, 'android/app/build.gradle');
const RELEASE_DIR = path.join(ROOT, 'build_output/release');
const IOS_DERIVED = path.join(ROOT, 'build_output/ios_release');

const REPO_OWNER = 'meisteryi';
const REPO_NAME = 'Warmth';

const JBR_HOME = '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
const ANDROID_SDK = path.join(os.homedir(), 'Library/Android/sdk');

function parseArgs(argv) {
  const args = argv.slice(2);
  let targetVersion = null;
  let bump = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version' && args[i + 1]) {
      targetVersion = args[++i].replace(/^v/, '');
    } else if (args[i] === '--bump') {
      bump = true;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }
  return { targetVersion, bump, dryRun };
}

function bumpPatch(ver) {
  const parts = ver.split('.').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Invalid semver version: ${ver}`);
  }
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

function run(cmd, opts = {}) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}

function updateVersions(nextVersion, shouldIncrementBuild) {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  pkg.version = nextVersion;
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  // iOS pbxproj: MARKETING_VERSION & CURRENT_PROJECT_VERSION
  let pbx = fs.readFileSync(PBXPROJ_PATH, 'utf8');
  const currentBuildMatch = pbx.match(/CURRENT_PROJECT_VERSION = (\d+);/);
  const currentBuild = currentBuildMatch ? parseInt(currentBuildMatch[1], 10) : 1;
  const nextBuild = shouldIncrementBuild ? currentBuild + 1 : currentBuild;

  pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${nextVersion};`);
  pbx = pbx.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${nextBuild};`);
  fs.writeFileSync(PBXPROJ_PATH, pbx, 'utf8');

  // Android build.gradle: versionCode & versionName
  let gradle = fs.readFileSync(GRADLE_PATH, 'utf8');
  gradle = gradle.replace(/versionCode \d+/, `versionCode ${nextBuild}`);
  gradle = gradle.replace(/versionName "[^"]+"/, `versionName "${nextVersion}"`);
  fs.writeFileSync(GRADLE_PATH, gradle, 'utf8');

  return { nextVersion, nextBuild };
}

function buildIosIpa(version) {
  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  const payloadDir = path.join(RELEASE_DIR, 'Payload');
  fs.rmSync(payloadDir, { recursive: true, force: true });
  fs.mkdirSync(payloadDir, { recursive: true });

  run('npx cap sync ios');
  run(
    `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -sdk iphoneos -derivedDataPath "${IOS_DERIVED}" CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" build`
  );

  const builtApp = path.join(IOS_DERIVED, 'Build/Products/Release-iphoneos/App.app');
  if (!fs.existsSync(builtApp)) {
    throw new Error(`Built iOS App.app not found at ${builtApp}`);
  }

  const destApp = path.join(payloadDir, 'App.app');
  execFileSync('cp', ['-R', builtApp, destApp], { stdio: 'inherit' });
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', destApp], { stdio: 'inherit' });

  const ipaName = `Warmth-v${version}.ipa`;
  const ipaPath = path.join(RELEASE_DIR, ipaName);
  fs.rmSync(ipaPath, { force: true });
  execFileSync('zip', ['-qr', ipaPath, 'Payload'], { cwd: RELEASE_DIR, stdio: 'inherit' });
  fs.rmSync(payloadDir, { recursive: true, force: true });

  console.log(`✅ iOS IPA ready: ${ipaPath}`);
  return ipaPath;
}

function buildAndroidApk(version) {
  fs.mkdirSync(RELEASE_DIR, { recursive: true });
  const env = {
    ...process.env,
    JAVA_HOME: fs.existsSync(JBR_HOME) ? JBR_HOME : process.env.JAVA_HOME,
    ANDROID_HOME: fs.existsSync(ANDROID_SDK) ? ANDROID_SDK : process.env.ANDROID_HOME,
    ANDROID_SDK_ROOT: fs.existsSync(ANDROID_SDK) ? ANDROID_SDK : process.env.ANDROID_SDK_ROOT,
  };
  if (env.JAVA_HOME) {
    env.PATH = `${path.join(env.JAVA_HOME, 'bin')}:${env.PATH || ''}`;
  }

  // cap copy/update만 수행 (cap sync의 내장 gradle sync는 시스템 기본 Java 26과 충돌할 수 있어 아래에서 JBR 21로 직접 빌드)
  run('npx cap copy android && npx cap update android', { env });
  run('./gradlew assembleRelease', { cwd: path.join(ROOT, 'android'), env });

  const signedApk = path.join(ROOT, 'android/app/build/outputs/apk/release/app-release.apk');
  const unsignedApk = path.join(
    ROOT,
    'android/app/build/outputs/apk/release/app-release-unsigned.apk'
  );
  const srcApk = fs.existsSync(signedApk) ? signedApk : unsignedApk;
  if (!fs.existsSync(srcApk)) {
    throw new Error('Built Android APK not found');
  }

  const apkName = `Warmth-v${version}.apk`;
  const apkPath = path.join(RELEASE_DIR, apkName);
  fs.copyFileSync(srcApk, apkPath);
  console.log(`✅ Android APK ready: ${apkPath}`);
  return apkPath;
}

function getGithubToken() {
  const filled = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
    cwd: ROOT,
  });
  const match = filled.match(/^password=(.+)$/m);
  if (!match) {
    throw new Error('GitHub credential token not found via git credential fill');
  }
  return match[1].trim();
}

async function publishGithubRelease(version, ipaPath, apkPath) {
  const token = getGithubToken();
  const tag = `v${version}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Warmth-Release-Script',
  };

  // 기존 릴리스가 있으면 조회, 없으면 생성
  let releaseRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags/${tag}`,
    { headers }
  );

  let releaseData;
  if (releaseRes.ok) {
    releaseData = await releaseRes.json();
  } else {
    releaseRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_name: tag,
          name: `Warmth ${tag}`,
          body: `온기 (Warmth) ${tag} 릴리스\n\n- **iOS**: \`${path.basename(ipaPath)}\` (ad-hoc signed)\n- **Android**: \`${path.basename(apkPath)}\``,
          draft: false,
          prerelease: false,
        }),
      }
    );
    if (!releaseRes.ok) {
      const errBody = await releaseRes.text();
      throw new Error(`Failed to create GitHub Release (${releaseRes.status}): ${errBody}`);
    }
    releaseData = await releaseRes.json();
  }

  const uploadUrlBase = releaseData.upload_url.replace(/\{\?name,label\}$/, '');
  const existingAssets = Array.isArray(releaseData.assets) ? releaseData.assets : [];

  for (const filePath of [ipaPath, apkPath]) {
    const fileName = path.basename(filePath);
    const existing = existingAssets.find((a) => a.name === fileName);
    if (existing) {
      await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/assets/${existing.id}`,
        { method: 'DELETE', headers }
      );
    }

    const bytes = fs.readFileSync(filePath);
    const uploadRes = await fetch(
      `${uploadUrlBase}?name=${encodeURIComponent(fileName)}`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(bytes.length),
        },
        body: bytes,
      }
    );
    if (!uploadRes.ok) {
      const errBody = await uploadRes.text();
      throw new Error(`Failed to upload ${fileName} (${uploadRes.status}): ${errBody}`);
    }
    console.log(`🚀 Uploaded asset: ${fileName}`);
  }

  return releaseData.html_url;
}

async function main() {
  const { targetVersion, bump, dryRun } = parseArgs(process.argv);
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));

  const nextVersion = targetVersion || (bump ? bumpPatch(pkg.version) : pkg.version);
  const shouldIncrementBuild = bump && !targetVersion;

  console.log(`📦 Preparing Warmth release v${nextVersion} (bump=${bump}, dryRun=${dryRun})`);
  const { nextBuild } = updateVersions(nextVersion, shouldIncrementBuild);
  console.log(`🔢 Version set to ${nextVersion} (build ${nextBuild})`);

  const ipaPath = buildIosIpa(nextVersion);
  const apkPath = buildAndroidApk(nextVersion);

  if (dryRun) {
    console.log('🧪 Dry run complete — skipped git push and GitHub Release.');
    return;
  }

  const tag = `v${nextVersion}`;
  // 변경된 파일 커밋 및 태그 푸시
  const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim();
  if (status) {
    run('git add -A');
    run(`git commit -m "chore(release): ${tag}"`);
  }
  run(`git tag -f ${tag}`);
  run('git push origin main');
  run(`git push -f origin ${tag}`);

  const releaseUrl = await publishGithubRelease(nextVersion, ipaPath, apkPath);
  console.log(`\n🎉 GitHub Release published: ${releaseUrl}`);
}

main().catch((err) => {
  console.error('❌ Release failed:', err);
  process.exit(1);
});

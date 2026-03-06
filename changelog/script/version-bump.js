#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const packageJsonPath = path.join(__dirname, '..', 'package.json');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgBlue: '\x1b[44m',
  bgYellow: '\x1b[43m',
};

const c = {
  success: (text) => `${colors.green}${text}${colors.reset}`,
  error: (text) => `${colors.red}${text}${colors.reset}`,
  warn: (text) => `${colors.yellow}${text}${colors.reset}`,
  info: (text) => `${colors.cyan}${text}${colors.reset}`,
  bold: (text) => `${colors.bold}${text}${colors.reset}`,
  dim: (text) => `${colors.dim}${text}${colors.reset}`,
  version: (text) => `${colors.bold}${colors.magenta}${text}${colors.reset}`,
  label: (text) => `${colors.bold}${colors.blue}${text}${colors.reset}`,
};

function readPackageJson() {
  const content = fs.readFileSync(packageJsonPath, 'utf-8');
  return JSON.parse(content);
}

function writePackageJson(data) {
  fs.writeFileSync(packageJsonPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function parseVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major, minor, patch };
}

function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(version, type) {
  const parsed = parseVersion(version);
  
  switch (type) {
    case 'major':
      parsed.major += 1;
      parsed.minor = 0;
      parsed.patch = 0;
      break;
    case 'minor':
      parsed.minor += 1;
      parsed.patch = 0;
      break;
    case 'patch':
      parsed.patch += 1;
      break;
    default:
      throw new Error(`Invalid bump type: ${type}. Use 'major', 'minor', or 'patch'.`);
  }
  
  return formatVersion(parsed);
}

function gitCommit(version) {
  try {
    execSync('git add package.json', { stdio: 'inherit' });
    execSync(`git commit -m "chore: bump version to changelog-v${version}"`, { stdio: 'inherit' });
    console.log(`\n${c.success('✓')} Successfully committed version ${c.version('changelog-v' + version)}`);
  } catch (error) {
    console.error(`\n${c.error('✗')} Git commit failed:`, error.message);
    process.exit(1);
  }
}

function gitTag(version) {
  try {
    execSync(`git tag -a changelog-v${version} -m "Release changelog-v${version}"`, { stdio: 'inherit' });
    console.log(`${c.success('✓')} Created tag ${c.version('changelog-v' + version)}`);
    execSync('git push --tags', { stdio: 'inherit' });
    console.log(`${c.success('✓')} Pushed tag ${c.version('changelog-v' + version)}`);
  } catch (error) {
    console.error(`\n${c.error('✗')} Git tag failed:`, error.message);
  }
}

async function promptBumpType() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log(`\n${c.label('Select version bump type:')}`);
    console.log(`  ${c.info('1)')} ${c.bold('patch')}  ${c.dim('- Bug fixes (0.0.x)')}`);
    console.log(`  ${c.info('2)')} ${c.bold('minor')}  ${c.dim('- New features (0.x.0)')}`);
    console.log(`  ${c.info('3)')} ${c.bold('major')}  ${c.dim('- Breaking changes (x.0.0)')}`);
    console.log('');
    
    rl.question(`${c.info('Enter choice')} (1/2/3 or patch/minor/major): `, (answer) => {
      rl.close();
      
      const choice = answer.trim().toLowerCase();
      
      if (choice === '1' || choice === 'patch') resolve('patch');
      else if (choice === '2' || choice === 'minor') resolve('minor');
      else if (choice === '3' || choice === 'major') resolve('major');
      else {
        console.error(`${c.error('Invalid choice.')} Please enter 1, 2, 3, patch, minor, or major.`);
        process.exit(1);
      }
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const noTag = args.includes('--no-tag');
  const bumpTypeArg = args.find(arg => ['patch', 'minor', 'major'].includes(arg));
  
  const packageJson = readPackageJson();
  const currentVersion = packageJson.version;
  
  console.log(`\n${c.label('Current version:')} ${c.version('changelog-v' + currentVersion)}`);
  
  // Get bump type from argument or prompt user
  const bumpType = bumpTypeArg || await promptBumpType();
  
  // Calculate new version
  const newVersion = bumpVersion(currentVersion, bumpType);
  
  console.log(`\n${c.warn('Bumping')} ${c.bold(bumpType)}: ${c.dim('changelog-v' + currentVersion)} ${c.info('→')} ${c.version('changelog-v' + newVersion)}`);
  
  // Update package.json
  packageJson.version = newVersion;
  writePackageJson(packageJson);
  console.log(`${c.success('✓')} Updated ${c.info('package.json')}`);
  
  // Git commit
  gitCommit(newVersion);
  
  // Create git tag (unless --no-tag is specified)
  if (!noTag) {
    gitTag(newVersion);
  }
  
  console.log(`\n${c.success('Done!')} 🎉\n`);
}

main().catch((error) => {
  console.error(`${c.error('Error:')}`, error.message);
  process.exit(1);
});

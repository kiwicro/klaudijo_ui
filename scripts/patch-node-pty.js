// Patches node-pty for building on Windows without Spectre-mitigated libraries
// Run before electron-rebuild
const fs = require('fs')
const path = require('path')

const nodePtyDir = path.join(__dirname, '..', 'node_modules', 'node-pty')

// 1. Fix binding.gyp - disable Spectre mitigation
const bindingGyp = path.join(nodePtyDir, 'binding.gyp')
if (fs.existsSync(bindingGyp)) {
  let content = fs.readFileSync(bindingGyp, 'utf8')
  content = content.replace("'SpectreMitigation': 'Spectre'", "'SpectreMitigation': 'false'")
  fs.writeFileSync(bindingGyp, content)
  console.log('Patched binding.gyp')
}

// 2. Fix winpty.gyp - disable Spectre + fix batch file calls
const winptyGyp = path.join(nodePtyDir, 'deps', 'winpty', 'src', 'winpty.gyp')
if (fs.existsSync(winptyGyp)) {
  let content = fs.readFileSync(winptyGyp, 'utf8')
  content = content.replace(/'SpectreMitigation': 'Spectre'/g, "'SpectreMitigation': 'false'")
  content = content.replace(
    /'WINPTY_COMMIT_HASH%': '<!\(cmd \/c "cd shared && GetCommitHash\.bat"\)'/,
    "'WINPTY_COMMIT_HASH%': 'none'"
  )
  content = content.replace(
    /'<!\(cmd \/c "cd shared && UpdateGenVersion\.bat <\(WINPTY_COMMIT_HASH\)"\)'/,
    "'gen'"
  )
  fs.writeFileSync(winptyGyp, content)
  console.log('Patched winpty.gyp')
}

// 3. Create GenVersion.h
const genDir = path.join(nodePtyDir, 'deps', 'winpty', 'src', 'gen')
if (!fs.existsSync(genDir)) {
  fs.mkdirSync(genDir, { recursive: true })
}
fs.writeFileSync(path.join(genDir, 'GenVersion.h'), `#ifndef GEN_VERSION_H
#define GEN_VERSION_H
const char GenVersion_Version[] = "0.4.3";
const char GenVersion_Commit[] = "none";
#endif
`)
console.log('Created GenVersion.h')
console.log('node-pty patched successfully')

#!/usr/bin/env node

import process from 'process'
import path, { resolve } from 'path'
import cp from 'child_process'
import util from 'util'
import readline from 'readline/promises'
import fs from 'fs/promises'
import ora from 'ora'

const exec = util.promisify(cp.exec)
const spawn = util.promisify(cp.spawn)

function escapeFileArg(arg) {
    if (process.platform === 'win32')
        return `"${arg}"`

    return arg
}

async function ask(question) {
    const rl = readline.createInterface(process.stdin, process.stdout)
    const res = await rl.question(question + ' ')
    rl.close()
    return res
}

async function checkTargetNotExisting(file) {
    try {
        const resolvedPath = path.resolve(file + ".webm")
        await fs.access(resolvedPath)
        const kill = await ask(`File "${path.basename(resolvedPath)}" exists. Overwrite? (y/n [n])`)
        if (kill.toLowerCase() === 'y') {
            await fs.unlink(resolvedPath)
        } else {
            return false
        }
        
        return true
    } catch (e) {
        return true
    }
}

async function processFile(file, index, size) {
    function makeSuffix(suffix) {
        return `(${index + 1}/${size}): ${suffix}`
    }

    const resovledPath = path.resolve(file)
    const fileName = path.basename(resovledPath)
    const targetDir = path.dirname(resovledPath)
    
    const targetPath = resovledPath + ".webm"
    
    const tempPath = path.join(targetDir, `clean.${fileName}.webm`)
    
    const spinner = ora(`${fileName}`).start()
    spinner.suffixText = makeSuffix('Encoding')
    await exec(`ffmpeg -i ${escapeFileArg(resovledPath)} -c:v libvpx-vp9 -b:v 25M -pix_fmt yuva420p -metadata:s:v:0 alpha_mode="1" -auto-alt-ref 0 ${escapeFileArg(targetPath)}`)

    spinner.suffixText = makeSuffix('Cleaning')
    await exec(`mkclean --doctype 4 --keep-cues --optimize ${escapeFileArg(targetPath)}`)
    spinner.suffixText = makeSuffix('Renaming')

    await fs.unlink(targetPath)
    await fs.rename(tempPath, targetPath)

    spinner.suffixText = ''
    spinner.stopAndPersist({
        symbol: '✅'
    })
}

const inputFiles = process.argv.slice(2)

for (let i = 0; i < inputFiles.length; i++) {
    const input = inputFiles[i]
    const ok = await checkTargetNotExisting(input)
    if (!ok) {
        console.log("Aborting")
        process.exit(1)
    }
}

console.log('')

for (let i = 0; i < inputFiles.length; i++) {
    const input = inputFiles[i]
    await processFile(input, i, inputFiles.length)
}

console.log('')

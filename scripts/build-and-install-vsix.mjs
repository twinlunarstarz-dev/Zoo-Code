#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, realpathSync } from "node:fs"
import { dirname, join, posix, resolve, win32 } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const defaultRootDirectory = resolve(scriptDirectory, "..")

export function parsePackageManager(packageManager) {
	const match = /^(pnpm)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(packageManager ?? "")

	if (!match) {
		throw new Error(
			`Expected package.json packageManager to contain a pinned pnpm version, received: ${packageManager}`,
		)
	}

	return { name: match[1], version: match[2], spec: packageManager }
}

export function parseArguments(args) {
	let editorCommand

	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]

		if (argument === "--editor") {
			editorCommand = args[index + 1]
			index += 1
		} else if (argument.startsWith("--editor=")) {
			editorCommand = argument.slice("--editor=".length)
		} else {
			throw new Error(`Unknown argument: ${argument}`)
		}
	}

	return { editorCommand }
}

function commandIsAvailable(command, shell, spawnSyncImpl) {
	const result = spawnSyncImpl(command, ["--version"], { stdio: "ignore", shell })
	return !result.error && result.status === 0
}

export function resolvePnpmInvocation({ packageManager, platform = process.platform, spawnSyncImpl = spawnSync }) {
	const pnpmCommand = "pnpm"
	const shell = platform === "win32"

	if (commandIsAvailable(pnpmCommand, shell, spawnSyncImpl)) {
		return { command: pnpmCommand, prefixArguments: [], shell }
	}

	const npmCommand = "npm"
	if (!commandIsAvailable(npmCommand, shell, spawnSyncImpl)) {
		throw new Error(
			"pnpm is not installed and npm is unavailable. Install the Node.js version specified by this repository, then retry.",
		)
	}

	console.log(`📦 pnpm is missing; npm will install and run ${packageManager} from its cache.`)
	return {
		command: npmCommand,
		prefixArguments: ["exec", "--yes", `--package=${packageManager}`, "--", "pnpm"],
		shell,
	}
}

export function resolveEditorCommand({
	editorCommand,
	platform = process.platform,
	environment = process.env,
	spawnSyncImpl = spawnSync,
}) {
	if (editorCommand) {
		return { command: editorCommand, shell: false }
	}

	const candidates =
		environment.TERM_PROGRAM === "vscode-insiders" ? ["code-insiders", "code"] : ["code", "code-insiders"]
	const shell = platform === "win32"
	const command = candidates.find((candidate) => commandIsAvailable(candidate, shell, spawnSyncImpl))

	if (!command) {
		throw new Error(
			`Unable to find a VS Code CLI (${candidates.join(" or ")}) in PATH. Add it to PATH or rerun with --editor=<command>.`,
		)
	}

	return { command, shell: false }
}

export function quoteWindowsCommandArgument(argument) {
	return `"${argument.replaceAll('"', '""')}"`
}

function run(command, args, { cwd, shell = false, spawnSyncImpl }) {
	console.log(`\n> ${command} ${args.join(" ")}`)
	const result = spawnSyncImpl(command, args, {
		cwd,
		stdio: "inherit",
		shell,
	})

	if (result.error) {
		throw new Error(`Unable to run ${command}: ${result.error.message}`)
	}

	if (result.status !== 0) {
		throw new Error(`${command} exited with status ${result.status}`)
	}
}

export function runBuildAndInstall({
	rootDirectory = defaultRootDirectory,
	editorCommand,
	platform = process.platform,
	pathApi = platform === "win32" ? win32 : posix,
	spawnSyncImpl = spawnSync,
	existsSyncImpl = existsSync,
	readFileSyncImpl = readFileSync,
}) {
	const rootPackage = JSON.parse(readFileSyncImpl(pathApi.join(rootDirectory, "package.json"), "utf8"))
	const extensionPackage = JSON.parse(readFileSyncImpl(pathApi.join(rootDirectory, "src", "package.json"), "utf8"))
	const { spec: packageManager } = parsePackageManager(rootPackage.packageManager)
	const pnpm = resolvePnpmInvocation({ packageManager, platform, spawnSyncImpl })
	const editor = resolveEditorCommand({ editorCommand, platform, spawnSyncImpl })

	run(pnpm.command, [...pnpm.prefixArguments, "install", "--frozen-lockfile"], {
		cwd: rootDirectory,
		shell: pnpm.shell,
		spawnSyncImpl,
	})
	run(pnpm.command, [...pnpm.prefixArguments, "vsix"], {
		cwd: rootDirectory,
		shell: pnpm.shell,
		spawnSyncImpl,
	})

	const vsixPath = pathApi.join(rootDirectory, "bin", `${extensionPackage.name}-${extensionPackage.version}.vsix`)
	if (!existsSyncImpl(vsixPath)) {
		throw new Error(`The VSIX build completed without producing the expected file: ${vsixPath}`)
	}

	runEditor(editor, ["--install-extension", vsixPath, "--force"], {
		cwd: rootDirectory,
		platform,
		spawnSyncImpl,
	})

	console.log(`\n✅ Built and installed ${vsixPath}`)
	return vsixPath
}

export function main(args = process.argv.slice(2)) {
	try {
		const { editorCommand } = parseArguments(args)
		runBuildAndInstall({ editorCommand })
	} catch (error) {
		console.error(`\n❌ Failed to build and install the VSIX: ${error.message}`)
		process.exitCode = 1
	}
}

function runEditor(editor, args, { cwd, platform, spawnSyncImpl }) {
	if (platform === "win32") {
		const commandLine = [editor.command, ...args.map(quoteWindowsCommandArgument)].join(" ")
		run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", commandLine], { cwd, spawnSyncImpl })
		return
	}

	run(editor.command, args, { cwd, shell: editor.shell, spawnSyncImpl })
}

export function isMainModule(
	argvPath = process.argv[1],
	modulePath = fileURLToPath(import.meta.url),
	realpathSyncImpl = realpathSync,
) {
	if (!argvPath) {
		return false
	}

	return realpathSyncImpl(resolve(argvPath)) === realpathSyncImpl(modulePath)
}

if (isMainModule()) {
	main()
}

import assert from "node:assert/strict"
import { posix } from "node:path"
import test from "node:test"

import { isMainModule, runBuildAndInstall } from "./build-and-install-vsix.mjs"

test("recognizes the entrypoint when the workspace path resolves through a junction", () => {
	const paths = new Map([
		[
			"C:\\workspace\\scripts\\build-and-install-vsix.mjs",
			"D:\\real-workspace\\scripts\\build-and-install-vsix.mjs",
		],
		[
			"D:\\real-workspace\\scripts\\build-and-install-vsix.mjs",
			"D:\\real-workspace\\scripts\\build-and-install-vsix.mjs",
		],
	])

	assert.equal(
		isMainModule(
			"C:\\workspace\\scripts\\build-and-install-vsix.mjs",
			"D:\\real-workspace\\scripts\\build-and-install-vsix.mjs",
			(path) => paths.get(path) ?? path,
		),
		true,
	)
})

test("forces installation of the freshly built VSIX", () => {
	const calls = []
	const files = new Map([
		["C:\\workspace\\package.json", JSON.stringify({ packageManager: "pnpm@10.8.1" })],
		["C:\\workspace\\src\\package.json", JSON.stringify({ name: "zoo-code", version: "3.68.0" })],
	])
	const spawnSyncImpl = (command, args, options) => {
		calls.push({ command, args, options })
		return { status: 0 }
	}

	runBuildAndInstall({
		rootDirectory: "C:\\workspace",
		editorCommand: "code",
		platform: "win32",
		spawnSyncImpl,
		existsSyncImpl: () => true,
		readFileSyncImpl: (path) => files.get(path),
	})

	assert.deepEqual(calls.at(-1).args.slice(0, 3), ["/d", "/s", "/c"])
	assert.equal(
		calls.at(-1).args[3],
		'code "--install-extension" "C:\\workspace\\bin\\zoo-code-3.68.0.vsix" "--force"',
	)
	assert.equal(calls.at(-1).options.shell, false)
})

test("runs the WSL editor CLI directly and still forces installation", () => {
	const calls = []
	const files = new Map([
		["/workspace/package.json", JSON.stringify({ packageManager: "pnpm@10.8.1" })],
		["/workspace/src/package.json", JSON.stringify({ name: "zoo-code", version: "3.68.0" })],
	])
	const spawnSyncImpl = (command, args, options) => {
		calls.push({ command, args, options })
		return { status: 0 }
	}

	runBuildAndInstall({
		rootDirectory: "/workspace",
		editorCommand: "code",
		platform: "linux",
		pathApi: posix,
		spawnSyncImpl,
		existsSyncImpl: () => true,
		readFileSyncImpl: (path) => files.get(path),
	})

	assert.equal(calls.at(-1).command, "code")
	assert.deepEqual(calls.at(-1).args, ["--install-extension", "/workspace/bin/zoo-code-3.68.0.vsix", "--force"])
	assert.equal(calls.at(-1).options.shell, false)
})

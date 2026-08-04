import { describe, expect, test, vi } from "vitest"

import {
	parseArguments,
	parsePackageManager,
	resolveEditorCommand,
	resolvePnpmInvocation,
	runBuildAndInstall,
} from "../../../scripts/build-and-install-vsix.mjs"

describe("build-and-install-vsix", () => {
	test("parses the repository's pinned pnpm version", () => {
		expect(parsePackageManager("pnpm@10.8.1")).toEqual({
			name: "pnpm",
			version: "10.8.1",
			spec: "pnpm@10.8.1",
		})
		expect(() => parsePackageManager("pnpm@latest")).toThrow("pinned pnpm version")
	})

	test("accepts editor paths containing spaces", () => {
		expect(parseArguments(["--editor", "C:\\Program Files\\Microsoft VS Code\\Code.exe"])).toEqual({
			editorCommand: "C:\\Program Files\\Microsoft VS Code\\Code.exe",
		})
	})

	test("defaults to the editor CLI available in the task execution environment", () => {
		const spawnSyncImpl = vi.fn((command) => ({ status: command === "code" ? 0 : 1 }))

		expect(resolveEditorCommand({ platform: "linux", environment: {}, spawnSyncImpl })).toEqual({
			command: "code",
			shell: false,
		})
		expect(spawnSyncImpl).toHaveBeenCalledWith("code", ["--version"], {
			stdio: "ignore",
			shell: false,
		})
	})

	test("prefers the insiders CLI when the task runs from VS Code Insiders", () => {
		const spawnSyncImpl = vi.fn(() => ({ status: 0 }))

		expect(
			resolveEditorCommand({
				platform: "win32",
				environment: { TERM_PROGRAM: "vscode-insiders" },
				spawnSyncImpl,
			}),
		).toEqual({ command: "code-insiders", shell: true })
		expect(spawnSyncImpl).toHaveBeenCalledWith("code-insiders", ["--version"], {
			stdio: "ignore",
			shell: true,
		})
	})

	test("uses an installed pnpm executable directly", () => {
		const spawnSyncImpl = vi.fn(() => ({ status: 0 }))

		expect(resolvePnpmInvocation({ packageManager: "pnpm@10.8.1", platform: "linux", spawnSyncImpl })).toEqual({
			command: "pnpm",
			prefixArguments: [],
			shell: false,
		})
		expect(spawnSyncImpl).toHaveBeenCalledWith("pnpm", ["--version"], {
			stdio: "ignore",
			shell: false,
		})
	})

	test("bootstraps the pinned pnpm version through npm when pnpm is missing", () => {
		const spawnSyncImpl = vi.fn().mockReturnValueOnce({ status: 1 }).mockReturnValueOnce({ status: 0 })

		expect(resolvePnpmInvocation({ packageManager: "pnpm@10.8.1", platform: "win32", spawnSyncImpl })).toEqual({
			command: "npm",
			prefixArguments: ["exec", "--yes", "--package=pnpm@10.8.1", "--", "pnpm"],
			shell: true,
		})
		expect(spawnSyncImpl).toHaveBeenNthCalledWith(1, "pnpm", ["--version"], {
			stdio: "ignore",
			shell: true,
		})
		expect(spawnSyncImpl).toHaveBeenNthCalledWith(2, "npm", ["--version"], {
			stdio: "ignore",
			shell: true,
		})
	})

	test("installs dependencies, builds the expected VSIX, and installs it without a shell", () => {
		const calls = []
		const spawnSyncImpl = vi.fn((command, args, options) => {
			calls.push({ command, args, options })
			return { status: command === "pnpm" && args[0] === "--version" ? 1 : 0 }
		})
		const readFileSyncImpl = vi.fn((path) => {
			if (path.endsWith("src/package.json")) {
				return JSON.stringify({ name: "zoo-code", version: "1.2.3" })
			}
			return JSON.stringify({ packageManager: "pnpm@10.8.1" })
		})

		const result = runBuildAndInstall({
			rootDirectory: "/workspace",
			platform: "linux",
			spawnSyncImpl,
			existsSyncImpl: () => true,
			readFileSyncImpl,
		})

		expect(result).toBe("/workspace/bin/zoo-code-1.2.3.vsix")
		expect(calls.slice(3).map(({ command, args, options }) => ({ command, args, shell: options.shell }))).toEqual([
			{
				command: "npm",
				args: ["exec", "--yes", "--package=pnpm@10.8.1", "--", "pnpm", "install", "--frozen-lockfile"],
				shell: false,
			},
			{
				command: "npm",
				args: ["exec", "--yes", "--package=pnpm@10.8.1", "--", "pnpm", "vsix"],
				shell: false,
			},
			{
				command: "code",
				args: ["--install-extension", "/workspace/bin/zoo-code-1.2.3.vsix", "--force"],
				shell: false,
			},
		])
	})
})

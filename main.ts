import { App, Notice, Plugin, WorkspaceLeaf, TFile, Platform } from 'obsidian';
import { ZolaPublishSettings, DEFAULT_SETTINGS } from './src/settings';
import { ZolaPublishSettingTab } from './src/settingTab';
import { ZolaPublishView, VIEW_TYPE_ZOLAPUBLISH } from './src/view';
import { SyncManager } from './src/syncManager';
import { LogManager } from './src/logManager';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default class ZolaPublishPlugin extends Plugin {
	settings: ZolaPublishSettings;
	syncManager: SyncManager;
	logManager: LogManager;
	private zolaPreviewRunning: boolean = false;

	async onload() {
		await this.loadSettings();

		// Initialize managers
		this.syncManager = new SyncManager(this.app, this);
		this.logManager = new LogManager(this.app, this);

		// Register view
		this.registerView(
			VIEW_TYPE_ZOLAPUBLISH,
			(leaf) => new ZolaPublishView(leaf, this)
		);

		// Add ribbon icon
		this.addRibbonIcon('pencil', 'Zolapublish', (evt: MouseEvent) => {
			this.activateView();
		});

		// Add settings page
		this.addSettingTab(new ZolaPublishSettingTab(this.app, this));

		// Register commands
		this.registerCommands();

		// Automatically open view when layout is ready
		this.app.workspace.onLayoutReady(() => {
			this.activateView();
		});
	}

	/**
	 * Register plugin commands
	 */
	registerCommands() {
		// Command 1: Create new article
		this.addCommand({
			id: 'create-new-article',
			name: 'Create new article',
			callback: async () => {
				await this.createNewArticle();
			}
		});

		// Command 2: Synchronize to Zola
		this.addCommand({
			id: 'sync-to-zola',
			name: 'Synchronize to Zola',
			callback: async () => {
				await this.syncArticles('push');
			}
		});

		// Command 3: Pull from Zola
		this.addCommand({
			id: 'pull-from-zola',
			name: 'Pull from Zola',
			callback: async () => {
				await this.syncArticles('pull');
			}
		});

		// Command 4: Launch preview
		this.addCommand({
			id: 'launch-preview',
			name: 'Launch Zola preview',
			callback: async () => {
				await this.launchPreview();
			}
		});

		// Command 5: Publish to GitHub
		this.addCommand({
			id: 'publish-to-github',
			name: 'Publish to GitHub',
			callback: async () => {
				await this.publishToGitHub();
			}
		});
	}

	onunload() {
		// Cleanup work (Obsidian handles view cleanup automatically)
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_ZOLAPUBLISH);

		if (leaves.length > 0) {
			// If view already exists, activate it
			leaf = leaves[0];
		} else {
			// Otherwise create new view in right sidebar
			const rightLeaf = workspace.getRightLeaf(false);
			if (rightLeaf) {
				leaf = rightLeaf;
				await leaf.setViewState({
					type: VIEW_TYPE_ZOLAPUBLISH,
					active: true,
				});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	// ============ Core functionality methods ============

	/**
	 * Create new article
	 */
	async createNewArticle() {
		try {
			// Check path configuration
			if (!this.settings.obsidianPostsPath) {
				new Notice('Please configure Obsidian posts path in settings first');
				return;
			}

			// Generate article filename
			const now = new Date();
			const dateStr = now.toISOString().split('T')[0];
			const fileName = `${dateStr}-new-article.md`;

			// Get full path
			const vault = this.app.vault;
			const adapter = vault.adapter;
			const basePath = this.settings.obsidianPostsPath.replace(/^\//, '');
			const fullPath = `${basePath}/${fileName}`;

			// Generate Zola Frontmatter
			const frontmatter = `+++
title = "New Article"
date = ${dateStr}
description = "Brief description for SEO"
authors = ["Your Name"]
draft = true

[taxonomies]
tags = []

[extra]
toc = true
+++

# New Article

Start writing here...
`;

			// Create file
			await vault.create(fullPath, frontmatter);

			// Open file
			const file = vault.getAbstractFileByPath(fullPath);
			if (file instanceof TFile) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(file);
			}

			new Notice(`Article created: ${fileName}`);
		} catch (error) {
			console.error('Failed to create article:', error);
			new Notice('Failed to create article, please check console');
		}
	}

	/**
	 * Synchronize articles
	 */
	async syncArticles(direction: 'push' | 'pull') {
		if (direction === 'push') {
			await this.syncManager.pushToZola();
		} else {
			await this.syncManager.pullFromZola();
		}
	}

	/**
	 * Launch preview
	 */
	async launchPreview() {
		try {
			// Platform compatibility check
			if (!Platform.isMacOS) {
				new Notice('Preview launch is currently only supported on macOS.\nWindows/Linux support coming soon.\n\nPlease run "zola serve" manually in your terminal.');
				return;
			}

			// Check path configuration
			if (!this.settings.zolaProjectPath) {
				new Notice('Please configure Zola project path in settings first');
				return;
			}

			// Check if Zola is already running
			try {
				const { stdout } = await execAsync('lsof -ti:1111');
				if (stdout.trim()) {
					// Port 1111 is occupied, Zola might already be running
					new Notice('Zola preview is already running\nOpening browser...');

					// Open browser directly
					const { exec } = require('child_process');
					exec('open http://127.0.0.1:1111');

					return;
				}
			} catch (error) {
				// Port not occupied, continue startup
			}

			new Notice('Starting Zola preview service...');

			// Get Zola project root directory (remove /content/posts part)
			const zolaRootPath = this.settings.zolaProjectPath.replace(/\/content\/posts\/?$/, '');

			// Start zola serve in a new terminal window
			const command = `cd "${zolaRootPath}" && zola serve`;

			// macOS: Launch in new window using osascript
			await execAsync(`osascript -e 'tell application "Terminal" to do script "cd \\"${zolaRootPath}\\" && zola serve"'`);

			this.zolaPreviewRunning = true;
			new Notice('Preview service started!');

			// Wait 3 seconds for service to fully start
			setTimeout(() => {
				// Use macOS open command to open browser
				const { exec } = require('child_process');
				exec('open http://127.0.0.1:1111', (error: Error | null) => {
					if (error) {
						console.error('Failed to open browser:', error);
						new Notice('Please visit manually: http://127.0.0.1:1111');
					} else {
						new Notice('Browser opened: http://127.0.0.1:1111');
					}
				});
			}, 3000);

			// Log the action
			await this.logManager.addLog({
				action: 'preview',
				summary: 'Launched Zola preview service',
				details: [`Run in terminal: ${command}`, 'Browser address: http://127.0.0.1:1111']
			});
		} catch (error) {
			console.error('Failed to launch preview:', error);
			new Notice('Failed to launch preview. Please ensure Zola is installed and project path is configured correctly');
			this.zolaPreviewRunning = false;
		}
	}

	/**
	 * Publish to GitHub
	 */
	async publishToGitHub() {
		try {
			// Platform compatibility note
			if (!Platform.isMacOS) {
				new Notice('Auto-publish is currently optimized for macOS.\n\nFor Windows/Linux, please use git commands manually:\ngit add .\ngit commit -m "Update"\ngit push');
				return;
			}

			// Check configuration
			if (!this.settings.githubRepoUrl) {
				new Notice('Please configure GitHub repository URL in settings first');
				return;
			}

			if (!this.settings.zolaProjectPath) {
				new Notice('Please configure Zola project path in settings first');
				return;
			}

			new Notice('Publishing to GitHub...');

			// Get Zola project root directory
			const zolaRootPath = this.settings.zolaProjectPath.replace(/\/content\/posts\/?$/, '');

			// Execute git commands
			const commands = [
				`cd "${zolaRootPath}"`,
				'git add .',
				`git commit -m "Update blog posts - ${new Date().toISOString().split('T')[0]}"`,
				`git push origin ${this.settings.defaultBranch}`
			];

			const fullCommand = commands.join(' && ');

			try {
				const { stdout, stderr } = await execAsync(fullCommand);

				new Notice('Published successfully! Code pushed to GitHub');

				// Log the action
				await this.logManager.addLog({
					action: 'publish',
					summary: 'Published to GitHub',
					details: [
						`Repository: ${this.settings.githubRepoUrl}`,
						`Branch: ${this.settings.defaultBranch}`,
						`Time: ${new Date().toLocaleString()}`
					]
				});

				// If Cloudflare deployment URL is configured, notify user
				if (this.settings.cloudflareDeployUrl) {
					new Notice('You can check deployment status on Cloudflare Pages');
				}
			} catch (gitError) {
				console.error('Git command execution failed:', gitError);

				// Check if error is due to no changes
				if (gitError instanceof Error && gitError.message.includes('nothing to commit')) {
					new Notice('No new changes to commit');
				} else {
					throw gitError;
				}
			}
		} catch (error) {
			console.error('Publishing failed:', error);
			new Notice('Publishing failed, please check console or verify Git configuration');
		}
	}
}

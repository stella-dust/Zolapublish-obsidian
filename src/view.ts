import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import ZolaPublishPlugin from '../main';
import { ArticleManager } from './articleManager';
import * as fs from 'fs';
import * as path from 'path';

export const VIEW_TYPE_ZOLAPUBLISH = 'zolapublish-view';

export class ZolaPublishView extends ItemView {
	plugin: ZolaPublishPlugin;
	private articleManager: ArticleManager;
	private expandedTags: Set<string> = new Set();
	private expandedLogs: Set<number> = new Set();
	private currentTab: 'tags' | 'logs' = 'tags';

	constructor(leaf: WorkspaceLeaf, plugin: ZolaPublishPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.articleManager = new ArticleManager(this.app, plugin);

		// Register file change events for real-time refresh
		this.registerEvent(
			this.app.vault.on('modify', () => this.refresh())
		);
		this.registerEvent(
			this.app.vault.on('create', () => this.refresh())
		);
		this.registerEvent(
			this.app.vault.on('delete', () => this.refresh())
		);
	}

	getViewType(): string {
		return VIEW_TYPE_ZOLAPUBLISH;
	}

	getDisplayText(): string {
		return 'Zolapublish';
	}

	getIcon(): string {
		return 'pencil';
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	async onClose(): Promise<void> {
		// Cleanup work
	}

	private async render(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('zolapublish-view');

		// Create header with "Zolapublish" title and log icon
		const topHeader = container.createDiv({ cls: 'zolapublish-top-header' });

		const manageTitle = topHeader.createEl('h3', {
			text: 'Zolapublish',
			cls: 'zolapublish-manage-title'
		});

		// Log icon - clickable to show logs
		const logIcon = topHeader.createEl('span', { cls: 'zolapublish-log-icon' });
		setIcon(logIcon, 'scroll-text');
		logIcon.onclick = () => {
			this.currentTab = this.currentTab === 'logs' ? 'tags' : 'logs';
			this.render();
		};

		// Create top icon button bar (5 buttons)
		this.createActionBar(container);

		// Create sync status indicator
		await this.createSyncStatus(container);

		// Create section title
		this.createSectionTitle(container);

		// Render content based on current tab
		if (this.currentTab === 'logs') {
			this.renderLogsSection(container);
		} else {
			await this.renderTagsSection(container);
		}
	}

	private createActionBar(container: Element): void {
		const actionBar = container.createDiv({ cls: 'zolapublish-action-bar' });

		const actions = [
			{
				icon: 'file-plus',
				title: 'New Article',
				action: async () => {
					await this.plugin.createNewArticle();
					this.refresh();
				}
			},
			{
				icon: 'refresh-cw',
				title: 'Synchronize',
				action: async () => {
					await this.plugin.syncArticles('push');
				}
			},
			{
				icon: 'download-cloud',
				title: 'Pull from Zola',
				action: async () => {
					await this.plugin.syncArticles('pull');
				}
			},
			{
				icon: 'eye',
				title: 'Launch Preview',
				action: async () => {
					await this.plugin.launchPreview();
				}
			},
			{
				icon: 'upload-cloud',
				title: 'Publish to GitHub',
				action: async () => {
					await this.plugin.publishToGitHub();
				}
			}
		];

		actions.forEach(({ icon: iconName, title, action }) => {
			const btn = actionBar.createEl('button', {
				cls: 'zolapublish-icon-btn',
				attr: { 'aria-label': title }
			});

			// Use Obsidian's setIcon utility function
			setIcon(btn, iconName);

			btn.onclick = action;
		});
	}

	private async createSyncStatus(container: Element): Promise<void> {
		const statusDiv = container.createDiv({ cls: 'zolapublish-sync-status' });

		try {
			const { obsidianPostsPath, zolaProjectPath, obsidianImagesPath, zolaImagesPath } = this.plugin.settings;

			if (!zolaProjectPath) {
				statusDiv.createSpan({ text: 'Configure Zola path in settings', cls: 'zolapublish-status-warning' });
				return;
			}

			// Count articles in vault
			const adapter = this.app.vault.adapter;
			const vaultBasePath = (adapter as any).getBasePath();

			let basePath: string;
			if (obsidianPostsPath.startsWith(vaultBasePath)) {
				basePath = obsidianPostsPath.substring(vaultBasePath.length + 1);
			} else if (obsidianPostsPath.startsWith('/')) {
				basePath = obsidianPostsPath.replace(/^\//, '');
			} else {
				basePath = obsidianPostsPath;
			}
			basePath = basePath.replace(/\\/g, '/');

			const vaultArticles = this.app.vault.getMarkdownFiles().filter(file => {
				if (!file.path.startsWith(basePath)) return false;
				if (file.name === '_index.md' || file.name === 'index.md') return false;
				return true;
			});

			// Count articles in Zola
			let zolaArticles = 0;
			if (fs.existsSync(zolaProjectPath)) {
				const zolaFiles = fs.readdirSync(zolaProjectPath);
				zolaArticles = zolaFiles.filter(f => {
					if (!f.endsWith('.md')) return false;
					if (f === '_index.md' || f === 'index.md') return false;
					return true;
				}).length;
			}

			// Count images
			let vaultImages = 0;
			let zolaImages = 0;

			if (obsidianImagesPath && zolaImagesPath) {
				const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'];

				// Vault images
				const obsidianImageDir = obsidianImagesPath.replace(/^\//, '');
				const allFiles = this.app.vault.getFiles();
				vaultImages = allFiles.filter(file =>
					file.path.startsWith(obsidianImageDir) &&
					imageExtensions.some(ext => file.path.toLowerCase().endsWith(ext))
				).length;

				// Zola images
				if (fs.existsSync(zolaImagesPath)) {
					const zolaImageFiles = fs.readdirSync(zolaImagesPath);
					zolaImages = zolaImageFiles.filter(f =>
						imageExtensions.some(ext => f.toLowerCase().endsWith(ext))
					).length;
				}
			}

			// Calculate differences
			const articleDiff = vaultArticles.length - zolaArticles;
			const imageDiff = vaultImages - zolaImages;

			// Build status message
			const parts: string[] = [];

			if (articleDiff > 0) {
				parts.push(`${articleDiff} article${articleDiff > 1 ? 's' : ''}`);
			}
			if (imageDiff > 0) {
				parts.push(`${imageDiff} image${imageDiff > 1 ? 's' : ''}`);
			}

			if (parts.length > 0) {
				const statusText = parts.join(', ') + ' waiting to sync';
				statusDiv.createSpan({ text: statusText, cls: 'zolapublish-status-pending' });

				// Add sync icon
				const syncIcon = statusDiv.createSpan({ cls: 'zolapublish-status-icon' });
				setIcon(syncIcon, 'alert-circle');
			} else {
				statusDiv.createSpan({ text: 'All synced', cls: 'zolapublish-status-synced' });

				// Add check icon
				const checkIcon = statusDiv.createSpan({ cls: 'zolapublish-status-icon' });
				setIcon(checkIcon, 'check-circle');
			}
		} catch (error) {
			console.error('Failed to calculate sync status:', error);
			statusDiv.createSpan({ text: 'Status unavailable', cls: 'zolapublish-status-error' });
		}
	}

	private createSectionTitle(container: Element): void {
		// Title - clickable to show tags
		const title = container.createEl('h3', {
			text: 'Tags List',
			cls: 'zolapublish-section-title'
		});
		title.onclick = () => {
			this.currentTab = 'tags';
			this.render();
		};
	}

	private renderLogsSection(container: Element): void {
		const logsSection = container.createDiv({ cls: 'zolapublish-logs-section' });

		const logsList = logsSection.createDiv({ cls: 'zolapublish-logs-list' });

		// Get logs
		const logs = this.plugin.logManager.getFormattedLogs();

		if (logs.length === 0) {
			logsList.createEl('div', {
				text: 'No logs yet.',
				cls: 'zolapublish-empty-state'
			});
			return;
		}

		logs.forEach((log, index) => {
			const logItem = logsList.createDiv({ cls: 'zolapublish-log-item' });

			// Log header (time and title on separate lines, clickable to expand)
			const logHeader = logItem.createDiv({ cls: 'zolapublish-log-header' });

			const logTimeRow = logHeader.createDiv({ cls: 'zolapublish-log-time-row' });
			logTimeRow.createSpan({ text: log.timestamp, cls: 'zolapublish-log-timestamp' });

			// Expand/collapse icon
			const expandIcon = logTimeRow.createSpan({ cls: 'zolapublish-log-expand-icon' });
			expandIcon.textContent = this.expandedLogs.has(index) ? '−' : '+';

			logHeader.createDiv({ text: log.summary, cls: 'zolapublish-log-summary' });

			// Click to expand/collapse
			logHeader.onclick = () => {
				if (this.expandedLogs.has(index)) {
					this.expandedLogs.delete(index);
				} else {
					this.expandedLogs.add(index);
				}
				this.render();
			};

			// If expanded, show details
			if (this.expandedLogs.has(index) && log.details && log.details.length > 0) {
				const logDetails = logItem.createDiv({ cls: 'zolapublish-log-details' });
				log.details.forEach(detail => {
					logDetails.createDiv({ text: `• ${detail}` });
				});
			}
		});
	}

	private async renderTagsSection(container: Element): Promise<void> {
		const tagsSection = container.createDiv({ cls: 'zolapublish-tags-section' });

		const tagsList = tagsSection.createDiv({ cls: 'zolapublish-tags-list' });

		try {
			const tagsMap = await this.articleManager.getAllTags();

			if (tagsMap.size === 0) {
				tagsList.createEl('div', {
					text: 'No tags found.',
					cls: 'zolapublish-empty-state'
				});
				return;
			}

			// Convert to array and sort by count descending
			const sortedTags = Array.from(tagsMap.entries())
				.sort((a, b) => b[1] - a[1]);

			for (const [tagName, count] of sortedTags) {
				const tagItem = tagsList.createDiv({ cls: 'zolapublish-tag-item' });

				// Tag header (click to expand/collapse)
				const tagHeader = tagItem.createDiv({ cls: 'zolapublish-tag-header' });

				const tagNameEl = tagHeader.createDiv({ cls: 'zolapublish-tag-name-wrapper' });
				tagNameEl.createSpan({ text: `# ${tagName}`, cls: 'zolapublish-tag-name' });

				tagHeader.createSpan({ text: `${count}`, cls: 'zolapublish-tag-count' });

				// Expand/collapse icon
				const expandIcon = tagHeader.createSpan({ cls: 'zolapublish-tag-expand-icon' });
				expandIcon.textContent = this.expandedTags.has(tagName) ? '−' : '+';

				// Click to expand/collapse
				tagHeader.onclick = () => {
					if (this.expandedTags.has(tagName)) {
						this.expandedTags.delete(tagName);
					} else {
						this.expandedTags.add(tagName);
					}
					this.render();
				};

				// If expanded, show article list for this tag
				if (this.expandedTags.has(tagName)) {
					const articlesContainer = tagItem.createDiv({ cls: 'zolapublish-tag-articles' });
					await this.renderTagArticles(articlesContainer, tagName);
				}
			}
		} catch (error) {
			console.error('Failed to load tags:', error);
			tagsList.createEl('div', {
				text: 'Failed to load tags.',
				cls: 'zolapublish-error-state'
			});
		}
	}

	private async renderTagArticles(container: Element, tagName: string): Promise<void> {
		try {
			const articles = await this.articleManager.getArticlesByTag(tagName);

			if (articles.length === 0) {
				container.createEl('div', {
					text: 'No articles found.',
					cls: 'zolapublish-empty-state'
				});
				return;
			}

			articles.forEach(article => {
				const articleItem = container.createDiv({ cls: 'zolapublish-tag-article-item' });

				articleItem.createSpan({ text: article.title, cls: 'zolapublish-tag-article-title' });
				articleItem.createSpan({ text: article.date, cls: 'zolapublish-tag-article-date' });

				if (article.draft) {
					articleItem.createSpan({ text: 'Draft', cls: 'zolapublish-draft-badge-small' });
				}

				// Click to open article
				articleItem.onclick = async () => {
					const leaf = this.app.workspace.getLeaf(false);
					await leaf.openFile(article.file);
				};
			});
		} catch (error) {
			console.error('Failed to load tag articles:', error);
		}
	}

	public refresh(): void {
		this.render();
	}
}

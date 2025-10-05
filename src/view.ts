import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import ZolaPublishPlugin from '../main';
import { ArticleManager } from './articleManager';

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

	private render(): void {
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

		// Create section title
		this.createSectionTitle(container);

		// Render content based on current tab
		if (this.currentTab === 'logs') {
			this.renderLogsSection(container);
		} else {
			this.renderTagsSection(container);
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

	private createSectionTitle(container: Element): void {
		// Title - clickable to show tags
		const title = container.createEl('h3', {
			text: 'Tags List',
			cls: 'zolapublish-section-title'
		});
		title.style.cursor = 'pointer';
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
			expandIcon.innerHTML = this.expandedLogs.has(index) ? '−' : '+';

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
				expandIcon.innerHTML = this.expandedTags.has(tagName) ? '−' : '+';

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

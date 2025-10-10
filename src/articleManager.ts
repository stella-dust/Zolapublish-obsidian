import { App, TFile, TFolder, Notice } from 'obsidian';
import ZolaPublishPlugin from '../main';

export interface ArticleInfo {
	file: TFile;
	title: string;
	date: string;
	tags: string[];
	draft: boolean;
}

export class ArticleManager {
	app: App;
	plugin: ZolaPublishPlugin;

	constructor(app: App, plugin: ZolaPublishPlugin) {
		this.app = app;
		this.plugin = plugin;
	}

	/**
	 * Get all articles list
	 */
	async getArticles(): Promise<ArticleInfo[]> {
		const articles: ArticleInfo[] = [];
		const obsidianPostsPath = this.plugin.settings.obsidianPostsPath;

		// Convert absolute path to relative path using vault adapter
		const adapter = this.app.vault.adapter;
		const vaultBasePath = (adapter as any).getBasePath();

		let basePath: string;
		if (obsidianPostsPath.startsWith(vaultBasePath)) {
			// Absolute path starting with vault base - convert to relative
			basePath = obsidianPostsPath.substring(vaultBasePath.length + 1);
		} else if (obsidianPostsPath.startsWith('/')) {
			// Absolute path but not in vault - try to strip leading slash
			basePath = obsidianPostsPath.replace(/^\//, '');
		} else {
			// Already relative path
			basePath = obsidianPostsPath;
		}

		// Normalize path separators
		basePath = basePath.replace(/\\/g, '/');

		const folder = this.app.vault.getAbstractFileByPath(basePath);
		if (!folder || !(folder instanceof TFolder)) {
			return articles;
		}

		const files = this.app.vault.getMarkdownFiles().filter(file =>
			file.path.startsWith(basePath)
		);

		for (const file of files) {
			const info = await this.parseArticle(file);
			if (info) {
				articles.push(info);
			}
		}

		// Sort by date descending
		articles.sort((a, b) => b.date.localeCompare(a.date));

		return articles;
	}

	/**
	 * Parse article metadata
	 */
	async parseArticle(file: TFile): Promise<ArticleInfo | null> {
		try {
			const content = await this.app.vault.read(file);
			const frontmatter = this.parseFrontmatter(content);

			if (!frontmatter) {
				return null;
			}

			return {
				file,
				title: frontmatter.title || file.basename,
				date: frontmatter.date || '',
				tags: frontmatter.tags || [],
				draft: frontmatter.draft === true
			};
		} catch (error) {
			console.error('Failed to parse article:', file.path, error);
			return null;
		}
	}

	/**
	 * Parse TOML Frontmatter
	 */
	private parseFrontmatter(content: string): any {
		const match = content.match(/^\+\+\+\n([\s\S]*?)\n\+\+\+/);
		if (!match) {
			return null;
		}

		const toml = match[1];
		const result: any = {};

		// Simple TOML parser (handles basic fields only)
		const lines = toml.split('\n');
		let currentSection = '';

		for (const line of lines) {
			const trimmed = line.trim();

			// Skip empty lines and comments
			if (!trimmed || trimmed.startsWith('#')) {
				continue;
			}

			// Handle sections
			if (trimmed.startsWith('[')) {
				const sectionMatch = trimmed.match(/\[(\w+)\]/);
				if (sectionMatch) {
					currentSection = sectionMatch[1];
					if (!result[currentSection]) {
						result[currentSection] = {};
					}
				}
				continue;
			}

			// Handle key-value pairs
			const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
			if (kvMatch) {
				const key = kvMatch[1];
				let value: any = kvMatch[2].trim();

				// Parse value types
				if (value === 'true') {
					value = true;
				} else if (value === 'false') {
					value = false;
				} else if (value.startsWith('"') && value.endsWith('"')) {
					value = value.slice(1, -1);
				} else if (value.startsWith('[') && value.endsWith(']')) {
					// Parse arrays
					const arrayContent = value.slice(1, -1);
					value = arrayContent
						.split(',')
						.map((item: string) => item.trim().replace(/^"(.*)"$/, '$1'))
						.filter((item: string) => item);
				}

				if (currentSection) {
					result[currentSection][key] = value;
				} else {
					result[key] = value;
				}
			}
		}

		// Promote taxonomies.tags to top level
		if (result.taxonomies && result.taxonomies.tags) {
			result.tags = result.taxonomies.tags;
		}

		return result;
	}

	/**
	 * Get all tags and their article counts
	 */
	async getAllTags(): Promise<Map<string, number>> {
		const articles = await this.getArticles();
		const tagMap = new Map<string, number>();

		for (const article of articles) {
			for (const tag of article.tags) {
				tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
			}
		}

		return tagMap;
	}

	/**
	 * Filter articles by tag
	 */
	async getArticlesByTag(tag: string): Promise<ArticleInfo[]> {
		const articles = await this.getArticles();
		return articles.filter(article => article.tags.includes(tag));
	}
}

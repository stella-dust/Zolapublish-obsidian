import { App, Notice, TFile } from 'obsidian';
import ZolaPublishPlugin from '../main';
import * as fs from 'fs';
import * as path from 'path';

export class SyncManager {
	app: App;
	plugin: ZolaPublishPlugin;

	constructor(app: App, plugin: ZolaPublishPlugin) {
		this.app = app;
		this.plugin = plugin;
	}

	/**
	 * Sync articles to Zola project
	 */
	async pushToZola(): Promise<void> {
		const { obsidianPostsPath, zolaProjectPath } = this.plugin.settings;

		if (!zolaProjectPath) {
			new Notice('Please configure Zola project path in settings first');
			return;
		}

		try {
			new Notice('Pushing articles to Zola project...');

			// Get all articles from Obsidian
			// Convert absolute path to relative path
			let basePath: string;
			if (obsidianPostsPath.startsWith('/')) {
				// Absolute path - extract the relative part after the vault root
				const pathParts = obsidianPostsPath.split('/');
				
				// Try to find a reasonable vault root by looking for common patterns
				let vaultRootIndex = -1;
				for (let i = 0; i < pathParts.length - 1; i++) {
					const part = pathParts[i];
					// Check if this could be a vault name (contains spaces, common patterns)
					if (part.includes(' ') || part.includes('Brain') || part.includes('Vault') || part.includes('Obsidian')) {
						vaultRootIndex = i;
						break;
					}
				}
				
				if (vaultRootIndex !== -1 && vaultRootIndex < pathParts.length - 1) {
					// Get everything after the vault name
					const relativeParts = pathParts.slice(vaultRootIndex + 1);
					basePath = relativeParts.join('/');
				} else {
					// Fallback: use the original logic
					basePath = obsidianPostsPath.replace(/^\//, '');
				}
			} else {
				// Already relative path
				basePath = obsidianPostsPath;
			}
			
			const systemFiles = ['_index.md', 'index.md'];

			const files = this.app.vault.getMarkdownFiles().filter(file => {
				// File must be in specified directory
				if (!file.path.startsWith(basePath)) {
					return false;
				}

				// Exclude system files
				if (systemFiles.includes(file.name)) {
					return false;
				}

				return true;
			});

			let syncCount = 0;
			let errorCount = 0;

			for (const file of files) {
				try {
					await this.syncFileToZola(file);
					syncCount++;
				} catch (error) {
					console.error(`Failed to sync file: ${file.path}`, error);
					errorCount++;
				}
			}

			// Sync images
			await this.syncImages();

			new Notice(`Push complete! Success: ${syncCount}, Failed: ${errorCount}`);

			// Log the action
			await this.plugin.logManager?.addLog({
				action: 'sync-push',
				summary: `Pushed ${syncCount} articles to Zola`,
				details: files.map(f => `Pushed: ${f.basename}`)
			});
		} catch (error) {
			console.error('Push failed:', error);
			new Notice('Push failed, please check console');
		}
	}

	/**
	 * Pull articles from Zola project
	 */
	async pullFromZola(): Promise<void> {
		const { obsidianPostsPath, zolaProjectPath, syncStrategy } = this.plugin.settings;

		if (!zolaProjectPath) {
			new Notice('Please configure Zola project path in settings first');
			return;
		}

		if (syncStrategy !== 'two-way') {
			new Notice('Current setting is one-way sync, cannot pull');
			return;
		}

		try {
			new Notice('Pulling articles from Zola project...');

			// Check if Zola directory exists
			const adapter = this.app.vault.adapter;
			if (!fs.existsSync(zolaProjectPath)) {
				new Notice('Zola project path does not exist');
				return;
			}

			// Read all markdown files in Zola directory
			const zolaFiles = this.getZolaFiles(zolaProjectPath);

			let syncCount = 0;
			let errorCount = 0;

			for (const zolaFile of zolaFiles) {
				try {
					await this.syncFileFromZola(zolaFile);
					syncCount++;
				} catch (error) {
					console.error(`Failed to pull file: ${zolaFile}`, error);
					errorCount++;
				}
			}

			// Sync images
			await this.syncImages();

			new Notice(`Pull complete! Success: ${syncCount}, Failed: ${errorCount}`);

			// Log the action
			await this.plugin.logManager?.addLog({
				action: 'sync-pull',
				summary: `Pulled ${syncCount} articles from Zola`,
				details: zolaFiles.map(f => `Pulled: ${path.basename(f)}`)
			});
		} catch (error) {
			console.error('Pull failed:', error);
			new Notice('Pull failed, please check console');
		}
	}

	/**
	 * Sync single file to Zola
	 */
	private async syncFileToZola(file: TFile): Promise<void> {
		const zolaProjectPath = this.plugin.settings.zolaProjectPath;
		let content = await this.app.vault.read(file);

		// TFile.name already includes extension, e.g., "article.md"
		// Use file.name directly
		const fileName = file.name;

		// Convert image links
		content = this.convertImageLinks(content);

		// Build target path
		const targetPath = path.join(zolaProjectPath, fileName);

		// Check if file already exists to avoid duplicate writes
		if (fs.existsSync(targetPath)) {
			// Read existing file content, skip if content is the same
			const existingContent = fs.readFileSync(targetPath, 'utf-8');
			if (existingContent === content) {
				return;
			}
		}

		// Write file
		fs.writeFileSync(targetPath, content, 'utf-8');
	}

	/**
	 * Convert image links: Obsidian format -> Zola format
	 * ![[../post_imgs/Mapper.png]] -> ![](/post_imgs/Mapper.png)
	 */
	private convertImageLinks(content: string): string {
		// Match Obsidian image link format: ![[...]]
		const obsidianImageRegex = /!\[\[([^\]]+)\]\]/g;

		const converted = content.replace(obsidianImageRegex, (match, imagePath) => {
			// Remove possible leading paths (like ../ or ./)
			let cleanPath = imagePath.replace(/^\.\.\//, '').replace(/^\.\//, '');

			// Ensure path starts with / (Zola's absolute path)
			if (!cleanPath.startsWith('/')) {
				cleanPath = '/' + cleanPath;
			}

			// Convert to Markdown standard format
			return `![](${cleanPath})`;
		});

		return converted;
	}

	/**
	 * Sync single file from Zola
	 */
	private async syncFileFromZola(zolaFilePath: string): Promise<void> {
		const obsidianPostsPath = this.plugin.settings.obsidianPostsPath;
		let content = fs.readFileSync(zolaFilePath, 'utf-8');

		// Convert image links back to Obsidian format
		content = this.convertImageLinksToObsidian(content);

		// Build target path
		const fileName = path.basename(zolaFilePath);
		const adapter = this.app.vault.adapter;

		// Get vault base path (absolute path to vault root)
		const vaultBasePath = (adapter as any).getBasePath();

		// Build full absolute path for the target file
		const fullTargetPath = path.join(obsidianPostsPath, fileName);

		// Convert absolute path to relative path (relative to vault root)
		let relativePath = fullTargetPath;
		if (fullTargetPath.startsWith(vaultBasePath)) {
			relativePath = path.relative(vaultBasePath, fullTargetPath);
		} else if (obsidianPostsPath.startsWith('/')) {
			// If obsidianPostsPath is absolute but doesn't start with vault base,
			// try to extract relative path
			relativePath = obsidianPostsPath.replace(/^\//, '') + '/' + fileName;
		} else {
			// Already relative
			relativePath = obsidianPostsPath + '/' + fileName;
		}

		// Normalize path separators for cross-platform compatibility
		const targetPath = relativePath.replace(/\\/g, '/');

		// Check if file already exists
		const existingFile = this.app.vault.getAbstractFileByPath(targetPath);

		if (existingFile instanceof TFile) {
			// File exists, update content
			await this.app.vault.modify(existingFile, content);
		} else {
			// File doesn't exist, create new file
			await this.app.vault.create(targetPath, content);
		}
	}

	/**
	 * Convert image links: Zola format -> Obsidian format
	 * ![](/post_imgs/Mapper.png) -> ![[../post_imgs/Mapper.png]]
	 */
	private convertImageLinksToObsidian(content: string): string {
		// Match Markdown standard image format: ![...](...) or ![](...)
		const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

		const converted = content.replace(markdownImageRegex, (match, altText, imagePath) => {
			// Only convert absolute paths starting with / (Zola format)
			if (imagePath.startsWith('/')) {
				// Remove leading /, add ../
				const obsidianPath = '../' + imagePath.substring(1);
				return `![[${obsidianPath}]]`;
			}

			// Keep other formats unchanged
			return match;
		});

		return converted;
	}

	/**
	 * Get all markdown files in Zola directory
	 */
	private getZolaFiles(zolaPath: string): string[] {
		const files: string[] = [];

		if (!fs.existsSync(zolaPath)) {
			return files;
		}

		const entries = fs.readdirSync(zolaPath);

		// System files to filter (case-insensitive)
		const systemFiles = ['_index.md', 'index.md', '_index', 'index'];

		for (const entry of entries) {
			const entryLower = entry.toLowerCase();

			// Skip hidden files
			if (entry.startsWith('.')) {
				continue;
			}

			// Skip system files
			if (systemFiles.some(sf => entryLower === sf || entryLower === sf + '.md')) {
				continue;
			}

			const fullPath = path.join(zolaPath, entry);
			const stat = fs.statSync(fullPath);

			if (stat.isFile() && entry.endsWith('.md')) {
				files.push(fullPath);
			}
		}

		return files;
	}

	/**
	 * Sync image files (only push images that exist in Obsidian but not in Zola)
	 */
	private async syncImages(): Promise<void> {
		const { obsidianImagesPath, zolaImagesPath } = this.plugin.settings;

		if (!zolaImagesPath || !obsidianImagesPath) {
			return;
		}

		try {
			const adapter = this.app.vault.adapter;
			// Convert absolute path to relative path
			let obsidianImageDir: string;
			if (obsidianImagesPath.startsWith('/')) {
				// Absolute path - extract the relative part after the vault root
				const pathParts = obsidianImagesPath.split('/');
				
				// Try to find a reasonable vault root by looking for common patterns
				let vaultRootIndex = -1;
				for (let i = 0; i < pathParts.length - 1; i++) {
					const part = pathParts[i];
					// Check if this could be a vault name (contains spaces, common patterns)
					if (part.includes(' ') || part.includes('Brain') || part.includes('Vault') || part.includes('Obsidian')) {
						vaultRootIndex = i;
						break;
					}
				}
				
				if (vaultRootIndex !== -1 && vaultRootIndex < pathParts.length - 1) {
					// Get everything after the vault name
					const relativeParts = pathParts.slice(vaultRootIndex + 1);
					obsidianImageDir = relativeParts.join('/');
				} else {
					// Fallback: use the original logic
					obsidianImageDir = obsidianImagesPath.replace(/^\//, '');
				}
			} else {
				// Already relative path
				obsidianImageDir = obsidianImagesPath;
			}

			// Get all image files
			const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'];
			const allFiles = this.app.vault.getFiles();
			const imageFiles = allFiles.filter(file =>
				file.path.startsWith(obsidianImageDir) &&
				imageExtensions.some(ext => file.path.toLowerCase().endsWith(ext))
			);

			if (imageFiles.length === 0) {
				return;
			}

			// Ensure Zola image directory exists
			if (!fs.existsSync(zolaImagesPath)) {
				fs.mkdirSync(zolaImagesPath, { recursive: true });
			}

			let syncedCount = 0;
			let skippedCount = 0;

			// Copy image files
			for (const imageFile of imageFiles) {
				try {
					const fileName = imageFile.name;
					const targetPath = path.join(zolaImagesPath, fileName);

					// Check if file already exists in Zola
					if (fs.existsSync(targetPath)) {
						skippedCount++;
						continue;
					}

					// Read and copy file (new file)
					const content = await adapter.readBinary(imageFile.path);
					fs.writeFileSync(targetPath, Buffer.from(content));
					syncedCount++;
				} catch (error) {
					console.error(`Failed to sync image: ${imageFile.name}`, error);
				}
			}

			if (syncedCount > 0) {
				new Notice(`Synced ${syncedCount} new images`);
			}
		} catch (error) {
			console.error('Image sync failed:', error);
			new Notice('Error syncing images, please check console');
		}
	}
}

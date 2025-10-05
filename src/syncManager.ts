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
			const basePath = obsidianPostsPath.replace(/^\//, '');
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

		console.log(`Preparing to sync file: ${fileName} -> ${targetPath}`);

		// Check if file already exists to avoid duplicate writes
		if (fs.existsSync(targetPath)) {
			// Read existing file content, skip if content is the same
			const existingContent = fs.readFileSync(targetPath, 'utf-8');
			if (existingContent === content) {
				console.log(`File unchanged, skipping: ${fileName}`);
				return;
			}
			console.log(`File changed, updating: ${fileName}`);
		} else {
			console.log(`New file, creating: ${fileName}`);
		}

		// Write file
		fs.writeFileSync(targetPath, content, 'utf-8');
		console.log(`✓ Synced: ${fileName}`);
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
			const zolaFormat = `![](${cleanPath})`;

			console.log(`Converting image link: ${match} -> ${zolaFormat}`);

			return zolaFormat;
		});

		return converted;
	}

	/**
	 * Sync single file from Zola
	 */
	private async syncFileFromZola(zolaFilePath: string): Promise<void> {
		const obsidianPostsPath = this.plugin.settings.obsidianPostsPath.replace(/^\//, '');
		let content = fs.readFileSync(zolaFilePath, 'utf-8');

		// Convert image links back to Obsidian format
		content = this.convertImageLinksToObsidian(content);

		// Build target path
		const fileName = path.basename(zolaFilePath);
		const targetPath = `${obsidianPostsPath}/${fileName}`;

		// Check if file already exists
		const existingFile = this.app.vault.getAbstractFileByPath(targetPath);

		if (existingFile) {
			// File exists, update content
			await this.app.vault.modify(existingFile as TFile, content);
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
				const obsidianFormat = `![[${obsidianPath}]]`;

				console.log(`Converting image link: ${match} -> ${obsidianFormat}`);

				return obsidianFormat;
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
			console.log(`Zola path does not exist: ${zolaPath}`);
			return files;
		}

		const entries = fs.readdirSync(zolaPath);

		// System files to filter (case-insensitive)
		const systemFiles = ['_index.md', 'index.md', '_index', 'index'];

		for (const entry of entries) {
			const entryLower = entry.toLowerCase();

			// Skip hidden files
			if (entry.startsWith('.')) {
				console.log(`Skipping hidden file: ${entry}`);
				continue;
			}

			// Skip system files
			if (systemFiles.some(sf => entryLower === sf || entryLower === sf + '.md')) {
				console.log(`Skipping system file: ${entry}`);
				continue;
			}

			const fullPath = path.join(zolaPath, entry);
			const stat = fs.statSync(fullPath);

			if (stat.isFile() && entry.endsWith('.md')) {
				console.log(`Found article: ${entry}`);
				files.push(fullPath);
			}
		}

		console.log(`Total articles found: ${files.length}`);
		return files;
	}

	/**
	 * Sync image files (only push images that exist in Obsidian but not in Zola)
	 */
	private async syncImages(): Promise<void> {
		const { obsidianImagesPath, zolaImagesPath } = this.plugin.settings;

		if (!zolaImagesPath || !obsidianImagesPath) {
			console.log('Image paths not configured, skipping image sync');
			return;
		}

		try {
			const adapter = this.app.vault.adapter;
			const obsidianImageDir = obsidianImagesPath.replace(/^\//, '');

			console.log(`Starting image sync: ${obsidianImageDir} -> ${zolaImagesPath}`);

			// Get all image files
			const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'];
			const allFiles = this.app.vault.getFiles();
			const imageFiles = allFiles.filter(file =>
				file.path.startsWith(obsidianImageDir) &&
				imageExtensions.some(ext => file.path.toLowerCase().endsWith(ext))
			);

			console.log(`Found ${imageFiles.length} images in Obsidian`);

			if (imageFiles.length === 0) {
				console.log('No images found to sync');
				return;
			}

			// Ensure Zola image directory exists
			if (!fs.existsSync(zolaImagesPath)) {
				fs.mkdirSync(zolaImagesPath, { recursive: true });
				console.log(`✓ Created directory: ${zolaImagesPath}`);
			}

			// Get existing images in Zola directory
			let existingZolaImages: string[] = [];
			if (fs.existsSync(zolaImagesPath)) {
				existingZolaImages = fs.readdirSync(zolaImagesPath);
			}

			console.log(`Zola already has ${existingZolaImages.length} images`);

			let syncedCount = 0;
			let skippedCount = 0;

			// Copy image files
			for (const imageFile of imageFiles) {
				try {
					const fileName = imageFile.name;
					const targetPath = path.join(zolaImagesPath, fileName);

					// Check if file already exists in Zola
					if (fs.existsSync(targetPath)) {
						console.log(`Image already exists, skipping: ${fileName}`);
						skippedCount++;
						continue;
					}

					// Read and copy file (new file)
					console.log(`Preparing to sync new image: ${fileName}`);
					const content = await adapter.readBinary(imageFile.path);
					fs.writeFileSync(targetPath, Buffer.from(content));
					console.log(`✓ Synced image: ${fileName}`);
					syncedCount++;
				} catch (error) {
					console.error(`✗ Failed to sync image: ${imageFile.name}`, error);
				}
			}

			if (syncedCount > 0) {
				new Notice(`Synced ${syncedCount} new images`);
			} else {
				console.log('No new images to sync');
			}

			console.log(`Image sync complete: added ${syncedCount}, skipped ${skippedCount}, total ${imageFiles.length}`);
		} catch (error) {
			console.error('Image sync failed:', error);
			new Notice('Error syncing images, please check console');
		}
	}
}

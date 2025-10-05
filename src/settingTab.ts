import { App, PluginSettingTab, Setting } from 'obsidian';
import ZolaPublishPlugin from '../main';

export class ZolaPublishSettingTab extends PluginSettingTab {
	plugin: ZolaPublishPlugin;

	constructor(app: App, plugin: ZolaPublishPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Basic Settings
		containerEl.createEl('h2', { text: 'Basic Settings' });

		// Obsidian Posts Path
		new Setting(containerEl)
			.setName('Obsidian Posts Path')
			.setDesc('Path to posts directory in your vault (e.g., /posts)')
			.addText(text => text
				.setPlaceholder('/posts')
				.setValue(this.plugin.settings.obsidianPostsPath)
				.onChange(async (value) => {
					this.plugin.settings.obsidianPostsPath = value;
					await this.plugin.saveSettings();
				}));

		// Zola Project Path
		new Setting(containerEl)
			.setName('Zola Project Path')
			.setDesc('Path to Zola posts directory (/content/posts/)')
			.addText(text => text
				.setPlaceholder('/Users/username/zola-blog/content/posts')
				.setValue(this.plugin.settings.zolaProjectPath)
				.onChange(async (value) => {
					this.plugin.settings.zolaProjectPath = value;
					await this.plugin.saveSettings();
				}));

		// Sync Strategy
		new Setting(containerEl)
			.setName('Sync Strategy')
			.setDesc('Choose one-way or two-way sync')
			.addDropdown(dropdown => dropdown
				.addOption('one-way', 'One-way (Obsidian → Zola)')
				.addOption('two-way', 'Two-way (Obsidian ↔ Zola)')
				.setValue(this.plugin.settings.syncStrategy)
				.onChange(async (value: 'one-way' | 'two-way') => {
					this.plugin.settings.syncStrategy = value;
					await this.plugin.saveSettings();
				}));

		// GitHub Repository URL
		new Setting(containerEl)
			.setName('GitHub Repository URL')
			.setDesc('Your Zola blog repository (e.g., github.com:username/blog)')
			.addText(text => text
				.setPlaceholder('github.com:username/zolablog')
				.setValue(this.plugin.settings.githubRepoUrl)
				.onChange(async (value) => {
					this.plugin.settings.githubRepoUrl = value;
					await this.plugin.saveSettings();
				}));

		// Default Branch
		new Setting(containerEl)
			.setName('Default Branch')
			.setDesc('Git branch name (e.g., main)')
			.addText(text => text
				.setPlaceholder('main')
				.setValue(this.plugin.settings.defaultBranch)
				.onChange(async (value) => {
					this.plugin.settings.defaultBranch = value;
					await this.plugin.saveSettings();
				}));

		// Cloudflare Deploy URL
		new Setting(containerEl)
			.setName('Cloudflare Deploy URL (Optional)')
			.setDesc('Link to deployment dashboard for quick access')
			.addText(text => text
				.setPlaceholder('https://dash.cloudflare.com/...')
				.setValue(this.plugin.settings.cloudflareDeployUrl)
				.onChange(async (value) => {
					this.plugin.settings.cloudflareDeployUrl = value;
					await this.plugin.saveSettings();
				}));

		// Image Management Settings
		containerEl.createEl('h2', { text: 'Image Management' });

		// Obsidian Images Path
		new Setting(containerEl)
			.setName('Obsidian Images Path')
			.setDesc('Local image directory in your vault (default: /images/posts/)')
			.addText(text => text
				.setPlaceholder('/images/posts/')
				.setValue(this.plugin.settings.obsidianImagesPath)
				.onChange(async (value) => {
					this.plugin.settings.obsidianImagesPath = value;
					await this.plugin.saveSettings();
				}));

		// Zola Images Path
		new Setting(containerEl)
			.setName('Zola Images Path')
			.setDesc('Zola static images directory (default: /static/images/)')
			.addText(text => text
				.setPlaceholder('/Users/username/zola-blog/static/images')
				.setValue(this.plugin.settings.zolaImagesPath)
				.onChange(async (value) => {
					this.plugin.settings.zolaImagesPath = value;
					await this.plugin.saveSettings();
				}));

		// Feature Description
		containerEl.createEl('p', {
			text: 'Local sync only (Vault ↔ Zola). The plugin ensures images referenced in articles are consistent between both directories.',
			cls: 'setting-item-description'
		});
	}
}

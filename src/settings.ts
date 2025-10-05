export interface ZolaPublishSettings {
	// Basic settings
	obsidianPostsPath: string;
	zolaProjectPath: string;
	syncStrategy: 'one-way' | 'two-way';
	githubRepoUrl: string;
	defaultBranch: string;
	cloudflareDeployUrl: string;

	// Image management settings
	obsidianImagesPath: string;
	zolaImagesPath: string;
}

export const DEFAULT_SETTINGS: ZolaPublishSettings = {
	obsidianPostsPath: '/posts',
	zolaProjectPath: '',
	syncStrategy: 'two-way',
	githubRepoUrl: '',
	defaultBranch: 'main',
	cloudflareDeployUrl: '',
	obsidianImagesPath: '/images/posts/',
	zolaImagesPath: '/static/images/'
};

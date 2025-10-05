import { App } from 'obsidian';
import ZolaPublishPlugin from '../main';

export interface LogEntry {
	timestamp: string;
	action: string;
	summary: string;
	details: string[];
}

export class LogManager {
	app: App;
	plugin: ZolaPublishPlugin;
	private logs: LogEntry[] = [];

	constructor(app: App, plugin: ZolaPublishPlugin) {
		this.app = app;
		this.plugin = plugin;
		this.loadLogs();
	}

	/**
	 * Add log entry
	 */
	async addLog(log: Omit<LogEntry, 'timestamp'>): Promise<void> {
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			...log
		};

		this.logs.unshift(entry);

		// Limit log count (keep most recent 100 entries)
		if (this.logs.length > 100) {
			this.logs = this.logs.slice(0, 100);
		}

		await this.saveLogs();
	}

	/**
	 * Get all logs
	 */
	getLogs(): LogEntry[] {
		return this.logs;
	}

	/**
	 * Get formatted logs (for display)
	 */
	getFormattedLogs(): Array<{
		timestamp: string;
		summary: string;
		details: string[];
	}> {
		return this.logs.map(log => ({
			timestamp: this.formatTimestamp(log.timestamp),
			summary: log.summary,
			details: log.details
		}));
	}

	/**
	 * Clear all logs
	 */
	async clearLogs(): Promise<void> {
		this.logs = [];
		await this.saveLogs();
	}

	/**
	 * Format timestamp
	 */
	private formatTimestamp(timestamp: string): string {
		const date = new Date(timestamp);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');

		return `${year}-${month}-${day} ${hours}:${minutes}`;
	}

	/**
	 * Save logs to data file
	 */
	private async saveLogs(): Promise<void> {
		try {
			await this.plugin.saveData({
				...this.plugin.settings,
				logs: this.logs
			});
		} catch (error) {
			console.error('Failed to save logs:', error);
		}
	}

	/**
	 * Load logs
	 */
	private async loadLogs(): Promise<void> {
		try {
			const data = await this.plugin.loadData();
			this.logs = data?.logs || [];
		} catch (error) {
			console.error('Failed to load logs:', error);
			this.logs = [];
		}
	}
}

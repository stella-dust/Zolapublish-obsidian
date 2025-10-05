# Zolapublish

<p align="center">
  <img src="https://img.shields.io/badge/Obsidian-7C3AED?style=for-the-badge&logo=obsidian&logoColor=white" alt="Obsidian">
  <img src="https://img.shields.io/badge/Zola-0EA5E9?style=for-the-badge&logo=zola&logoColor=white" alt="Zola">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
</p>

A powerful Obsidian plugin that seamlessly integrates with Zola static site generator. Manage, edit, sync, and publish your Zola blog posts directly from Obsidian.

## Features

### Command Palette Integration
- **5 Core Commands**: Access all major functions via Command Palette (`Cmd/Ctrl + P`)
- **Customizable Hotkeys**: Assign keyboard shortcuts to any command
- **Quick Actions**: Execute operations without touching the mouse

### Article Management
- Create new articles with Zola frontmatter template
- Browse all articles with title, date, tags, and draft status
- Click to open articles directly in the editor
- Smart filtering excludes system files like `_index.md`

### Bi-directional Sync
- Push articles from Obsidian to Zola project
- Pull articles from Zola to Obsidian (two-way sync mode)
- Automatic image synchronization
- Smart deduplication - only syncs changed or new files
- **Auto-converts image links** between Obsidian and Zola formats:
  - Obsidian: `![[../post_imgs/image.png]]`
  - Zola: `![](/post_imgs/image.png)`

### Tag Management
- Auto-extract tags from article frontmatter
- Display article count for each tag
- Expandable tag groups to view articles
- Sort tags by article count

### Activity Logs
- Track all sync, preview, and publish operations
- Detailed operation history
- Expandable log entries with details

### Live Preview
- One-click Zola preview server launch (macOS only)
- Opens in new Terminal window running `zola serve`
- Auto-detect running instance
- Auto-open browser at `http://127.0.0.1:1111`

### Git Publishing
- Auto-commit changes to Git repository (macOS only)
- Push to GitHub with one click
- Custom branch support
- Cloudflare Pages integration support

## Requirements

- **Platform**: macOS (Windows/Linux support coming soon)
  - Preview launch and auto-publish features currently only work on macOS
  - All other features (sync, article management, tags) work on all platforms
  - Windows/Linux users can sync and manage articles, but need to run `zola serve` and git commands manually
- **Obsidian**: v0.15.0 or higher
- **Zola**: Installed and accessible via command line
- **Git**: For publishing functionality

## Installation

### From Obsidian Community Plugins (Recommended)
1. Open Obsidian Settings
2. Go to Community Plugins → Browse
3. Search for "Zolapublish"
4. Click Install, then Enable

### Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/stella-dust/Zolapublish-obsidian/releases)
2. Extract the files to your vault's plugin folder: `.obsidian/plugins/zolapublish/`
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

## Configuration

Navigate to **Settings → Zolapublish** to configure:

### Basic Settings
- **Obsidian Posts Path**: Path to posts in your vault (e.g., `/posts`)
- **Zola Project Path**: Path to Zola posts directory (e.g., `/Users/username/blog/content/posts`)
- **Sync Strategy**: Choose one-way (Obsidian → Zola) or two-way (Obsidian ↔ Zola) sync
- **GitHub Repository URL**: Your Zola blog repository (e.g., `github.com:username/blog`)
- **Default Branch**: Git branch name (e.g., `main`)
- **Cloudflare Deploy URL**: (Optional) Link to deployment dashboard

### Image Management
- **Obsidian Images Path**: Local image directory (default: `/images/posts/`)
- **Zola Images Path**: Zola static images directory (default: `/static/images/`)

## Usage

### Commands

Access via Command Palette (`Cmd/Ctrl + P`):

1. **Zolapublish: Create new article** - Create a new blog post with Zola frontmatter
2. **Zolapublish: Synchronize to Zola** - Push articles and images to Zola project
3. **Zolapublish: Pull from Zola** - Pull articles from Zola (two-way sync mode)
4. **Zolapublish: Launch Zola preview** - Start preview server and open browser (macOS)
5. **Zolapublish: Publish to GitHub** - Commit and push to GitHub (macOS)

**To assign hotkeys:**
1. Go to Settings → Hotkeys
2. Search for "Zolapublish"
3. Click + next to any command
4. Press your desired key combination

### Creating Articles

**Method 1: Command Palette**
- Press `Cmd/Ctrl + P`
- Type "Zolapublish: Create new article"

**Method 2: Sidebar Panel**
- Click the pencil icon in the left ribbon
- Click "New Article" button in the panel

**Method 3: Hotkey** (if configured)

### Syncing Articles

**Push to Zola:**
- Click "Synchronize" button in the panel, or
- Use Command Palette → "Zolapublish: Synchronize to Zola"

**Pull from Zola** (two-way sync mode):
- Click "Pull from Zola" button, or
- Use Command Palette → "Zolapublish: Pull from Zola"

### Image Link Conversion

The plugin automatically converts image links during sync:

**Obsidian → Zola:**
```markdown
![[../post_imgs/image.png]]  →  ![](/post_imgs/image.png)
```

**Zola → Obsidian:**
```markdown
![](/post_imgs/image.png)  →  ![[../post_imgs/image.png]]
```

## Development

```bash
# Clone the repository
git clone https://github.com/stella-dust/Zolapublish-obsidian.git
cd Zolapublish-obsidian

# Install dependencies
npm install

# Development mode (watch for changes)
npm run dev

# Production build
npm run build
```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - see [LICENSE](LICENSE) file for details

## Author

**Junyi Yan**
- Website: [https://junyiyan.xyz](https://junyiyan.xyz)
- GitHub: [@stella-dust](https://github.com/stella-dust)

## Acknowledgments

- Built with [Obsidian API](https://github.com/obsidianmd/obsidian-api)
- Designed for [Zola](https://www.getzola.org/) static site generator

---

**Happy Writing & Publishing!** ✍️

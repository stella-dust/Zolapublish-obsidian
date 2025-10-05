#!/bin/bash

# 开发部署脚本 - 将插件文件复制到测试 vault

VAULT_PATH="/Users/charon/Documents/Obsidian/vault_dev"
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/zolapublish"

# 创建插件目录（如果不存在）
mkdir -p "$PLUGIN_DIR"

# 复制文件
echo "📦 复制插件文件到测试 vault..."
cp main.js "$PLUGIN_DIR/"
cp manifest.json "$PLUGIN_DIR/"
cp styles.css "$PLUGIN_DIR/"

echo "✅ 部署完成！"
echo "请在 Obsidian 中重新加载插件或重启 Obsidian"

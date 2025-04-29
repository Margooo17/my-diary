#!/bin/bash

# 部署脚本：将网站部署到GitHub Pages

echo "开始部署到GitHub Pages..."

# 确保我们在main分支
git checkout main || { echo "切换到main分支失败"; exit 1; }

# 创建临时目录用于构建
mkdir -p _site
cp -R css _site/
cp -R js _site/
cp index.html _site/
cp favicon.ico _site/ 2>/dev/null || echo "未找到favicon.ico，跳过"

# 切换到gh-pages分支，如果不存在则创建
if git show-ref --verify --quiet refs/heads/gh-pages; then
    git checkout gh-pages || { echo "切换到gh-pages分支失败"; exit 1; }
else
    git checkout -b gh-pages || { echo "创建gh-pages分支失败"; exit 1; }
fi

# 清理旧文件（保留.git目录和_site目录）
find . -maxdepth 1 ! -path . ! -path ./.git ! -path ./_site -exec rm -rf {} \;

# 复制新文件
cp -R _site/* .
rm -rf _site

# 添加所有文件到Git
git add . || { echo "git add操作失败"; exit 1; }

# 提交更改
git commit -m "更新GitHub Pages网站：添加数据安全说明" || { echo "git commit操作失败"; exit 1; }

# 推送到GitHub
git push origin gh-pages || { echo "推送到gh-pages分支失败"; exit 1; }

# 切回main分支
git checkout main || { echo "切回main分支失败"; exit 1; }

echo "部署完成！请等待几分钟后访问 https://margooo17.github.io/my-diary/ 查看更新" 
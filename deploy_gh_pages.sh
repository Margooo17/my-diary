#!/bin/bash

# 部署脚本：将网站部署到GitHub Pages

echo "开始部署到GitHub Pages..."

# 确保我们在main分支
git checkout main

# 创建临时目录用于构建
mkdir -p _site
cp -R css _site/
cp -R js _site/
cp index.html _site/

# 切换到gh-pages分支
git checkout gh-pages

# 清理旧文件（保留.git目录和_site目录）
find . -maxdepth 1 ! -path . ! -path ./.git ! -path ./_site -exec rm -rf {} \;

# 复制新文件
cp -R _site/* .
rm -rf _site

# 添加所有文件到Git
git add .

# 提交更改
git commit -m "更新GitHub Pages网站：实现自动同步功能"

# 推送到GitHub
git push origin gh-pages

# 切回main分支
git checkout main

echo "部署完成！请等待几分钟后访问 https://margooo17.github.io/my-diary/ 查看更新" 
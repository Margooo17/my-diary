#!/bin/bash

# 设置颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 获取当前分支名
CURRENT_BRANCH=$(git branch --show-current)

# 检查是否有更改
if git diff --quiet; then
    echo -e "${YELLOW}没有检测到任何更改，无需同步${NC}"
    exit 0
fi

# 自动生成提交信息
echo -e "${YELLOW}检测到文件更改，开始自动同步...${NC}"

# 获取更改的文件列表
CHANGED_FILES=$(git diff --name-only)

# 根据更改的文件类型生成提交信息
if [[ $CHANGED_FILES == *"js/"* ]]; then
    COMMIT_MSG="feat: 更新JavaScript功能"
elif [[ $CHANGED_FILES == *"css/"* ]]; then
    COMMIT_MSG="style: 更新样式"
elif [[ $CHANGED_FILES == *".html"* ]]; then
    COMMIT_MSG="feat: 更新页面结构"
elif [[ $CHANGED_FILES == *"README"* ]]; then
    COMMIT_MSG="docs: 更新文档"
else
    COMMIT_MSG="update: 自动同步更新"
fi

# 添加所有更改
echo -e "${YELLOW}添加更改...${NC}"
git add .

# 提交更改
echo -e "${YELLOW}提交更改: $COMMIT_MSG${NC}"
git commit -m "$COMMIT_MSG"

# 推送到远程
echo -e "${YELLOW}推送到GitHub...${NC}"
if git push origin $CURRENT_BRANCH; then
    echo -e "${GREEN}同步完成！${NC}"
    echo -e "${GREEN}当前分支: $CURRENT_BRANCH${NC}"
    echo -e "${GREEN}提交信息: $COMMIT_MSG${NC}"
else
    echo -e "${RED}推送失败，请检查网络连接或GitHub权限${NC}"
    exit 1
fi 
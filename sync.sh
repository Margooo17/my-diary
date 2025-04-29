#!/bin/bash

# 设置颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}开始同步代码...${NC}"

# 获取当前分支名
CURRENT_BRANCH=$(git branch --show-current)

# 添加所有更改
echo -e "${YELLOW}添加更改...${NC}"
git add .

# 获取提交信息
echo -e "${YELLOW}请输入提交说明 (直接回车使用默认说明):${NC}"
read commit_message

# 如果没有输入提交信息，使用默认说明
if [ -z "$commit_message" ]; then
    commit_message="update: 自动同步更新"
fi

# 提交更改
echo -e "${YELLOW}提交更改...${NC}"
git commit -m "$commit_message"

# 推送到远程
echo -e "${YELLOW}推送到GitHub...${NC}"
git push origin $CURRENT_BRANCH

echo -e "${GREEN}同步完成！${NC}"
echo -e "${GREEN}当前分支: $CURRENT_BRANCH${NC}" 
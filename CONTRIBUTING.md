# 开发工作流程指南

## 日常开发流程

### 1. 开始工作前
```bash
# 切换到开发分支
git checkout dev

# 拉取最新代码
git pull origin dev
```

### 2. 开发新功能
```bash
# 创建功能分支（建议使用feature/功能名）
git checkout -b feature/新功能名

# 开发完成后，添加更改
git add .

# 提交更改（写清楚做了什么）
git commit -m "添加了xxx功能"
```

### 3. 完成功能开发
```bash
# 切换回开发分支
git checkout dev

# 合并功能分支
git merge feature/新功能名

# 推送到GitHub
git push origin dev
```

### 4. 发布正式版本
```bash
# 切换到主分支
git checkout main

# 合并开发分支
git merge dev

# 推送到GitHub
git push origin main
```

## 提交说明规范

提交说明应该清晰描述做了什么改动，建议使用以下格式：

- feat: 添加了新功能
- fix: 修复了bug
- docs: 更新了文档
- style: 代码格式修改
- refactor: 代码重构
- test: 添加测试
- chore: 构建过程或辅助工具的变动

例如：
```bash
git commit -m "feat: 添加云同步功能"
git commit -m "fix: 修复夜间模式切换bug"
```

## 分支命名规范

- main：主分支，用于发布
- dev：开发分支，日常开发在这个分支进行
- feature/xxx：新功能分支
- fix/xxx：修复bug的分支

## 代码审查

每次合并到main分支前，建议：
1. 自我检查代码
2. 测试所有功能
3. 确保没有遗留debug代码
4. 确保代码格式统一

## 备份提醒

- 每天工作结束前必须推送到GitHub
- 重要功能完成后立即推送
- 定期导出本地数据备份 
#!/bin/bash

# 创建博客式日记本发布版本
echo "开始创建博客式日记本正式版..."

# 创建发布目录
RELEASE_DIR="release-博客式日记本"
mkdir -p "$RELEASE_DIR"

# 复制所有必要文件
echo "复制文件..."
cp -r index.html css js README.md "$RELEASE_DIR"

# 清除本地存储，确保没有个人数据
echo "正在创建一个清洁的localStorage重置脚本..."
cat > "$RELEASE_DIR/js/reset_local_storage.js" << 'EOL'
// 重置脚本 - 仅首次运行时执行
(function() {
    // 检查是否已运行过初始化
    if (!localStorage.getItem('app_initialized')) {
        console.log('首次运行初始化...');
        
        // 清除所有localStorage数据
        localStorage.clear();
        
        // 设置默认标题
        localStorage.setItem('diaryTitle', '博客式日记本');
        
        // 设置默认鼓励语
        localStorage.setItem('diary_encouragements', JSON.stringify(['太棒啦🥳', '今天也很棒呢！', '坚持写日记的你最棒！']));
        
        // 设置默认主题
        localStorage.setItem('theme', 'light');
        
        // 标记为已初始化
        localStorage.setItem('app_initialized', 'true');
        
        console.log('初始化完成！');
    }
})();
EOL

# 修改index.html，引入重置脚本
echo "更新HTML文件..."
sed -i '' 's/<\/head>/<script src="js\/reset_local_storage.js"><\/script>\n<\/head>/' "$RELEASE_DIR/index.html"

# 创建zip文件
echo "创建ZIP文件..."
zip -r "${RELEASE_DIR}.zip" "$RELEASE_DIR"

# 完成
echo "正式版创建完成！"
echo "文件位置: ${RELEASE_DIR}.zip" 
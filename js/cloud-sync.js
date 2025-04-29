/*
 * 云同步模块 - 基于Dropbox API实现
 * 
 * 使用说明:
 * 1. 访问 https://www.dropbox.com/developers/apps 创建一个新的应用
 * 2. 选择"Scoped access" API
 * 3. 选择"App folder"访问类型（只需要访问应用专属文件夹）
 * 4. 为应用取一个名称，如"DiarySync"
 * 5. 创建应用后，在"OAuth 2"部分，添加以下重定向URI:
 *    - 确保添加您网站的根域名作为重定向URI: https://example.com 或 http://localhost
 *    - 注意: 不要在URI末尾添加斜杠或路径
 *    - 重定向URI必须与代码中的完全匹配，包括协议(http/https)和是否有www
 * 6. 复制"App key"，替换下面的APP_KEY值
 * 7. 在Dropbox开发者平台上允许隐式授权流程:
 *    - 在「Permissions」标签页中启用"Allow implicit grant"
 *    - 确保允许的范围包括"files.content.read"和"files.content.write"
 */
// 云同步模块
const CloudSync = {
    // Dropbox应用密钥 - 每个用户需要设置自己的密钥
    // 我们将使用localStorage保存用户提供的APP_KEY
    APP_KEY: '',
    
    // 从localStorage加载APP_KEY
    loadAppKey() {
        const savedKey = localStorage.getItem('dropbox_app_key');
        if (savedKey) {
            this.APP_KEY = savedKey;
            return true;
        }
        return false;
    },
    
    // 保存APP_KEY到localStorage
    saveAppKey(key) {
        if (key && key.trim() !== '') {
            this.APP_KEY = key.trim();
            localStorage.setItem('dropbox_app_key', this.APP_KEY);
            return true;
        }
        return false;
    },
    
    // 加密密钥，使用本地存储的密钥或生成新密钥
    encryptionKey: null,
    
    // Dropbox客户端实例
    dropboxClient: null,
    
    // 同步文件路径
    SYNC_FILE_PATH: '/diary-data.enc',
    
    // 本地备份密钥
    LOCAL_BACKUP_KEY: 'diary_backup_data',
    
    // 同步锁
    isSyncing: false,
    
    // 自动同步相关配置
    autoSyncConfig: {
        enabled: true,           // 是否启用自动同步
        interval: 30000,         // 同步间隔（毫秒）
        lastSyncTime: null,      // 上次同步时间
        syncInProgress: false,   // 是否正在同步
        changeDetected: false,   // 是否检测到变化
        retryCount: 0,           // 重试次数
        maxRetries: 3            // 最大重试次数
    },
    
    // 初始化
    init() {
        console.log('初始化云同步服务...');
        try {
            // 加载App Key
            this.loadAppKey();
            
            // 检查是否加载了Dropbox SDK
            if (typeof Dropbox === 'undefined') {
                throw new Error('Dropbox SDK未加载');
            }
            
            // 获取访问令牌
            const accessToken = localStorage.getItem('dropbox_access_token');
            
            // 初始化Dropbox客户端
            try {
                // 尝试初始化不带授权的基本客户端
                // 注意：v10.34.0版本使用不同的构造函数签名
                if (typeof Dropbox.Dropbox === 'function') {
                    // 新版本SDK (v10+)
                    if (this.APP_KEY) {
                    this.dropboxClient = new Dropbox.Dropbox({
                        clientId: this.APP_KEY
                    });
                    } else {
                        // 如果没有APP_KEY，仅初始化客户端但不设置clientId
                        this.dropboxClient = new Dropbox.Dropbox({});
                    }
                    
                    // 如果有访问令牌，设置它
                    if (accessToken) {
                        this.dropboxClient.setAccessToken(accessToken);
                    }
                } else {
                    // 旧版本SDK
                    if (this.APP_KEY) {
                    this.dropboxClient = new Dropbox({
                        clientId: this.APP_KEY
                    });
                    } else {
                        // 如果没有APP_KEY，仅初始化客户端但不设置clientId
                        this.dropboxClient = new Dropbox({});
                    }
                    
                    // 如果有访问令牌，设置它
                    if (accessToken) {
                        this.dropboxClient.setAccessToken(accessToken);
                    }
                }
                
                console.log('Dropbox客户端初始化成功');
            } catch (error) {
                console.error('初始化Dropbox客户端失败:', error);
                throw error;
            }
            
            // 检查本地数据是否存在，如果不存在但有备份，尝试恢复
            this.checkAndRecoverLocalData();
            
            // 处理可能的授权回调
            this.handleRedirect();
            
            // 添加同步按钮，无论是否有访问令牌
            this.addSyncButton();
            
            // 初始化自动同步
            if (accessToken) {
                console.log('检测到有效的访问令牌，启动自动同步');
                this.initAutoSync();
            } else {
                console.log('未检测到访问令牌，自动同步功能未启动');
            }
            
            return true;
        } catch (error) {
            console.error('初始化云同步服务失败:', error);
            return false;
        }
    },
    
    // 检查并恢复本地数据
    checkAndRecoverLocalData() {
        try {
            const diaries = localStorage.getItem('diaries');
            
            // 如果没有日记数据但有备份，则尝试恢复
            if ((!diaries || diaries === '[]') && localStorage.getItem(this.LOCAL_BACKUP_KEY)) {
                console.log('检测到本地数据为空，但存在备份，尝试恢复数据...');
                
                const backupData = localStorage.getItem(this.LOCAL_BACKUP_KEY);
                if (backupData) {
                    localStorage.setItem('diaries', backupData);
                    console.log('成功从备份恢复了本地数据');
                    
                    // 添加消息通知
                    this.showSyncNotification('已从本地备份恢复数据', 'success');
                    
                    // 触发页面刷新以显示恢复的数据
                    this.triggerPageRefresh();
                    return true;
                }
            } else if (diaries && diaries !== '[]') {
                // 如果有数据，创建备份
                console.log('发现本地数据，创建备份...');
                localStorage.setItem(this.LOCAL_BACKUP_KEY, diaries);
            }
        } catch (error) {
            console.error('检查或恢复本地数据时出错:', error);
        }
        return false;
    },

    // 恢复本地数据的方法（用户可以手动调用）
    recoverFromBackup() {
        if (this.checkAndRecoverLocalData()) {
            alert('数据恢复成功！页面将刷新以显示恢复的数据。');
            window.location.reload();
            return true;
        } else {
            const backupExists = localStorage.getItem(this.LOCAL_BACKUP_KEY);
            if (!backupExists) {
                alert('未找到数据备份，无法恢复数据。');
            } else {
                alert('恢复数据失败，请尝试刷新页面后再试。');
            }
            return false;
        }
    },
    
    // 初始化或获取加密密钥
    initEncryptionKey() {
        let key = localStorage.getItem('encryption_key');
        if (!key) {
            // 生成一个随机的32位密钥
            key = CryptoJS.lib.WordArray.random(16).toString();
            localStorage.setItem('encryption_key', key);
        }
        this.encryptionKey = key;
        console.log('加密密钥已初始化');
    },
    
    // 添加同步按钮
    addSyncButton() {
        console.log('正在添加云同步按钮...');
        
        // 尝试查找.data-actions元素
        const dataActions = document.querySelector('.data-actions');
        if (!dataActions) {
            console.error('未找到.data-actions元素，无法添加云同步按钮');
            setTimeout(() => this.addSyncButton(), 500);
            return;
        }
        
        // 检查是否已存在同步按钮
        let syncBtn = document.querySelector('.sync-btn');
        if (syncBtn) {
            console.log('云同步按钮已存在，更新状态');
            this.updateSyncButtonState(syncBtn);
            return;
        }
        
        // 创建按钮
        console.log('创建云同步按钮...');
        syncBtn = document.createElement('button');
        syncBtn.className = 'sync-btn';
        
        // 创建图标
        const icon = document.createElement('span');
        icon.className = 'sync-icon';
        icon.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
            </svg>
        `;
        
        // 创建文本
        const text = document.createElement('span');
        text.className = 'sync-text';
        
        // 添加状态指示器
        const statusDot = document.createElement('span');
        statusDot.className = 'sync-status-dot';
        
        // 组装按钮
        syncBtn.appendChild(icon);
        syncBtn.appendChild(text);
        syncBtn.appendChild(statusDot);
        
        // 更新按钮状态
        this.updateSyncButtonState(syncBtn);
        
        // 添加点击事件
        syncBtn.addEventListener('click', () => {
            console.log('云同步按钮被点击');
            this.syncButtonClicked();
        });
        
        // 添加到DOM
        dataActions.appendChild(syncBtn);
        console.log('云同步按钮已添加到DOM');
    },
    
    // 更新同步按钮状态
    updateSyncButtonState(button) {
        const accessToken = localStorage.getItem('dropbox_access_token');
        const text = button.querySelector('.sync-text');
        
        if (!accessToken) {
            button.setAttribute('data-status', 'not-synced');
            button.title = '点击设置云同步';
            text.textContent = '未同步';
        } else {
            if (this.autoSyncConfig.syncInProgress) {
                button.setAttribute('data-status', 'syncing');
                button.title = '正在同步...';
                text.textContent = '同步中';
            } else {
                button.setAttribute('data-status', 'synced');
                button.title = '已启用云同步';
                text.textContent = '已同步';
            }
        }
    },
    
    // 同步按钮点击事件
    async syncButtonClicked() {
        console.log('同步按钮被点击');
        
        // 检查APP_KEY是否已设置
        if (!this.APP_KEY) {
            this.promptForAppKey();
            return;
        }
        
        // 检查环境状态
        const envStatus = this.checkEnvironment();
        if (!envStatus.ready) {
            this.showSyncProgress(`无法同步: ${envStatus.issues.join(', ')}`, true, true);
            return;
        }
        
        // 检查是否已授权
        if (!localStorage.getItem('dropbox_access_token')) {
            console.log('未授权，开始授权流程');
            await this.authorize();
        } else {
            // 验证令牌状态
            const tokenStatus = await this.verifyTokenStatus();
            
            if (tokenStatus.valid) {
                console.log('令牌有效，开始同步');
                await this.sync();
            } else {
                console.log('令牌状态检查失败:', tokenStatus.reason);
                localStorage.removeItem('dropbox_access_token');
                localStorage.removeItem('dropbox_token_expires');
                await this.authorize();
            }
        }
    },
    
    // 提示用户输入APP_KEY
    promptForAppKey() {
        const appKeyPrompt = document.createElement('div');
        appKeyPrompt.className = 'app-key-prompt';
        appKeyPrompt.style.position = 'fixed';
        appKeyPrompt.style.top = '50%';
        appKeyPrompt.style.left = '50%';
        appKeyPrompt.style.transform = 'translate(-50%, -50%)';
        appKeyPrompt.style.backgroundColor = 'white';
        appKeyPrompt.style.padding = '20px';
        appKeyPrompt.style.borderRadius = '8px';
        appKeyPrompt.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        appKeyPrompt.style.zIndex = '10000';
        appKeyPrompt.style.maxWidth = '500px';
        appKeyPrompt.style.textAlign = 'center';
        appKeyPrompt.style.color = '#333';
        
        appKeyPrompt.innerHTML = `
            <h3 style="margin-top:0;color:#1a73e8;">设置Dropbox应用密钥</h3>
            <p>您需要创建自己的Dropbox应用并设置应用密钥(App Key)。</p>
            <ol style="text-align:left;line-height:1.6;">
                <li>访问 <a href="https://www.dropbox.com/developers/apps" target="_blank" style="color:#1a73e8;font-weight:bold;">Dropbox开发者平台</a></li>
                <li>登录您的Dropbox账号</li>
                <li>点击"创建应用"按钮</li>
                <li>选择"Scoped access" API</li>
                <li>选择"App folder"（应用文件夹）选项</li>
                <li>为您的应用取一个名称，如"我的日记本"</li>
                <li>点击"创建应用"</li>
                <li>在应用详情页面找到"App key"并复制</li>
            </ol>
            <p>请输入您的Dropbox应用密钥：</p>
            <input type="text" id="app-key-input" style="width:100%;padding:10px;margin:10px 0;border:1px solid #ddd;border-radius:4px;font-size:14px;" placeholder="粘贴App Key...">
            <div style="display:flex;justify-content:space-between;margin-top:15px;">
                <button id="cancel-app-key" style="padding:8px 16px;background:#f0f0f0;border:none;border-radius:4px;cursor:pointer;">取消</button>
                <button id="submit-app-key" style="padding:8px 16px;background:#4CAF50;color:white;border:none;border-radius:4px;cursor:pointer;">保存并继续</button>
            </div>
        `;
        
        document.body.appendChild(appKeyPrompt);
        
        // 设置事件监听
        document.getElementById('cancel-app-key').addEventListener('click', () => {
            document.body.removeChild(appKeyPrompt);
        });
        
        document.getElementById('submit-app-key').addEventListener('click', async () => {
            const appKeyInput = document.getElementById('app-key-input');
            const appKey = appKeyInput.value.trim();
            
            if (!appKey) {
                alert('请输入有效的App Key');
                return;
            }
            
            // 保存App Key
            this.saveAppKey(appKey);
            document.body.removeChild(appKeyPrompt);
            
            // 重新初始化客户端
            this.initClient();
            
            // 继续授权流程
            await this.authorize();
        });
    },
    
    // 授权Dropbox - 使用弹出窗口方式（通过手动生成令牌）
    async authorize() {
        try {
            console.log('开始Dropbox授权流程...');
            
            // 创建授权弹窗提示
            const authInfo = document.createElement('div');
            authInfo.className = 'auth-info';
            authInfo.style.position = 'fixed';
            authInfo.style.top = '50%';
            authInfo.style.left = '50%';
            authInfo.style.transform = 'translate(-50%, -50%)';
            authInfo.style.backgroundColor = 'white';
            authInfo.style.padding = '20px';
            authInfo.style.borderRadius = '8px';
            authInfo.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
            authInfo.style.zIndex = '10000';
            authInfo.style.maxWidth = '500px';
            authInfo.style.textAlign = 'center';
            authInfo.style.color = '#333';
            
            authInfo.innerHTML = `
                <h3 style="margin-top:0;color:#1a73e8;">Dropbox授权</h3>
                <p>请按照以下步骤获取您的Dropbox访问令牌：</p>
                <ol style="text-align:left;line-height:1.6;">
                    <li>访问 <a href="https://www.dropbox.com/developers/apps" target="_blank" style="color:#1a73e8;font-weight:bold;">Dropbox开发者平台</a></li>
                    <li>登录您的Dropbox账号</li>
                    <li>点击"创建应用"按钮</li>
                    <li>选择"Scoped access" API</li>
                    <li>选择"App folder"（应用文件夹）选项</li>
                    <li>为您的应用取一个名称，如"我的日记本"</li>
                    <li>点击"创建应用"</li>
                    <li>在"权限"标签页中，勾选以下权限：
                        <ul style="margin-top:5px;margin-bottom:5px;">
                            <li>files.metadata.read</li>
                            <li>files.metadata.write</li>
                            <li>files.content.read</li>
                            <li>files.content.write</li>
                        </ul>
                    </li>
                    <li>点击"提交"保存权限</li>
                    <li>在"设置"标签页中，找到"访问令牌"部分</li>
                    <li>点击"生成"按钮创建一个访问令牌</li>
                    <li>复制生成的访问令牌</li>
                </ol>
                <p>将访问令牌粘贴到下方：</p>
                <input type="text" id="access-token-input" style="width:100%;padding:10px;margin:10px 0;border:1px solid #ddd;border-radius:4px;font-size:14px;" placeholder="粘贴访问令牌...">
                <div style="display:flex;justify-content:space-between;margin-top:15px;">
                    <button id="cancel-auth" style="padding:8px 16px;background:#f0f0f0;border:none;border-radius:4px;cursor:pointer;">取消</button>
                    <button id="submit-token" style="padding:8px 16px;background:#4CAF50;color:white;border:none;border-radius:4px;cursor:pointer;">提交</button>
                </div>
            `;
            
            document.body.appendChild(authInfo);
            
            // 设置事件监听
            document.getElementById('cancel-auth').addEventListener('click', () => {
                document.body.removeChild(authInfo);
                console.log('用户取消了授权');
            });
            
            document.getElementById('submit-token').addEventListener('click', async () => {
                const tokenInput = document.getElementById('access-token-input');
                const token = tokenInput.value.trim();
                
                if (!token) {
                    alert('请输入有效的访问令牌');
                    return;
                }
                
                // 存储访问令牌
                localStorage.setItem('dropbox_access_token', token);
                document.body.removeChild(authInfo);
                
                // 初始化客户端
                this.initClient();
                
                // 显示成功消息
                this.showAuthSuccess();
                
                // 执行同步
                await this.sync();
            });
            
            return true;
        } catch (error) {
            console.error('Dropbox授权失败:', error);
            alert('连接云存储失败: ' + error.message);
            return false;
        }
    },
    
    // 处理重定向回调
    async handleRedirect() {
        console.log('检查授权状态...');
        
        // 检查URL是否包含访问令牌
        if (window.location.hash.includes('access_token=')) {
            console.log('检测到授权回调(hash中)');
            try {
                // 解析URL中的访问令牌
                const accessToken = this.parseAccessTokenFromUrl();
                if (accessToken) {
                    console.log('成功从URL提取访问令牌');
                    // 存储访问令牌
                    localStorage.setItem('dropbox_access_token', accessToken);
                    
                    // 清除URL中的hash以避免令牌泄露
                    window.history.replaceState({}, document.title, window.location.pathname);
                    
                    // 显示授权成功消息
                    this.showAuthSuccess();
                    
                    // 检查是否有待处理的同步操作
                    const pendingSync = localStorage.getItem('pending_sync');
                    
                    if (pendingSync === 'true') {
                        console.log('执行待处理的同步操作');
                        localStorage.removeItem('pending_sync');
                        
                        // 初始化客户端
                        this.initClient();
                        
                        // 执行同步
                        await this.sync();
                        return true;
                    }
                }
            } catch (error) {
                console.error('处理授权回调时出错:', error);
                alert('连接云存储失败，请稍后再试。');
            }
        } 
        // 检查是否Dropbox重定向接收器页面中包含了token
        else if (document.title === "Dropbox - 授权完成" || document.title.includes("Dropbox - ")) {
            console.log('检测到Dropbox重定向接收器页面');
            
            try {
                // 尝试从页面内容中提取令牌
                const pageContent = document.body.textContent || "";
                const tokenMatch = pageContent.match(/access_token=([\w-]+)/);
                
                if (tokenMatch && tokenMatch[1]) {
                    const accessToken = tokenMatch[1];
                    console.log('从页面内容提取到访问令牌');
                    
                    // 存储访问令牌
                    localStorage.setItem('dropbox_access_token', accessToken);
                    
                    // 检查是否有待处理的同步操作
                    const pendingSync = localStorage.getItem('pending_sync');
                    
                    if (pendingSync === 'true') {
                        console.log('执行待处理的同步操作');
                        localStorage.removeItem('pending_sync');
                        
                        // 初始化客户端
                        this.initClient();
                        
                        // 执行同步
                        await this.sync();
                        
                        // 提示用户关闭此页面并返回原页面
                        alert('授权成功！请关闭此页面，返回日记本应用。');
                        
                        return true;
                    }
                }
            } catch (error) {
                console.error('解析授权页面时出错:', error);
            }
        }
        
        // 检查本地存储中是否有pendingAuth标志和令牌
        const pendingAuth = localStorage.getItem('cloudSync_pendingAuth');
        const accessToken = localStorage.getItem('dropbox_access_token');
        
        if (pendingAuth === 'true' && accessToken) {
            console.log('检测到授权已完成(通过本地存储)');
            localStorage.removeItem('cloudSync_pendingAuth');
            
            // 检查是否有待处理的同步操作
            const pendingSync = localStorage.getItem('pending_sync');
            
            if (pendingSync === 'true') {
                console.log('执行待处理的同步操作');
                localStorage.removeItem('pending_sync');
                
                // 初始化客户端
                this.initClient();
                
                // 执行同步
                await this.sync();
                return true;
            }
        }
        
        return false;
    },
    
    // 从URL解析访问令牌
    parseAccessTokenFromUrl() {
        try {
            // 首先尝试从URL hash中获取令牌
            if (window.location.hash && window.location.hash.includes('access_token=')) {
                console.log('在URL hash中检测到访问令牌');
            const hash = window.location.hash.substring(1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
                if (accessToken) {
                    return accessToken;
                }
            }
            
            // 然后尝试从URL查询参数中获取
            const urlParams = new URLSearchParams(window.location.search);
            const accessToken = urlParams.get('access_token');
            
            return accessToken;
        } catch (error) {
            console.error('解析URL中的访问令牌失败:', error);
            return null;
        }
    },
    
    // 加密数据 - 使用AES加密算法
    async encryptData(data) {
        console.log('开始加密数据...');
        
        try {
            // 如果没有加密密钥，则生成一个新的
            if (!this.encryptionKey) {
                const storedKey = localStorage.getItem('encryption_key');
                if (storedKey) {
                    this.encryptionKey = storedKey;
                } else {
                    // 生成随机密钥并保存
                    this.encryptionKey = this.generateRandomKey(32);
                    localStorage.setItem('encryption_key', this.encryptionKey);
                }
            }
            
            // 使用CryptoJS进行AES加密
            const encrypted = CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
            console.log('数据加密完成');
            return encrypted;
            
        } catch (error) {
            console.error('数据加密失败:', error);
            throw new Error('数据加密失败: ' + (error.message || '未知错误'));
        }
    },
    
    // 解密数据 - 使用AES解密算法
    async decryptData(encryptedData) {
        console.log('开始解密数据...');
        
        try {
            // 获取加密密钥
            if (!this.encryptionKey) {
                const storedKey = localStorage.getItem('encryption_key');
                if (!storedKey) {
                    throw new Error('未找到加密密钥，无法解密数据');
                }
                this.encryptionKey = storedKey;
            }
            
            // 使用CryptoJS进行AES解密
            const decrypted = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey).toString(CryptoJS.enc.Utf8);
            
            // 验证解密结果
            if (!decrypted) {
                throw new Error('解密失败，可能是密钥不正确');
            }
            
            console.log('数据解密完成');
            return decrypted;
            
        } catch (error) {
            console.error('数据解密失败:', error);
            throw new Error('数据解密失败: ' + (error.message || '未知错误'));
        }
    },
    
    // 生成随机密钥
    generateRandomKey(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const charactersLength = chars.length;
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    },
    
    // 同步数据
    async sync() {
        if (this.autoSyncConfig.syncInProgress) {
            console.log('同步正在进行中，跳过本次同步');
            return;
        }
        
        try {
            this.autoSyncConfig.syncInProgress = true;
            this.showSyncProgress('正在同步数据...', true);
            
            // 执行原有的同步逻辑
            await this._performSync();
            
            // 更新同步状态
            this.autoSyncConfig.lastSyncTime = Date.now();
            this.autoSyncConfig.changeDetected = false;
            this.autoSyncConfig.retryCount = 0;
            
            // 保存配置
            localStorage.setItem('autoSyncConfig', JSON.stringify(this.autoSyncConfig));
            
            this.showSyncNotification('同步成功！', 'success');
        } catch (error) {
            console.error('同步失败:', error);
            this.autoSyncConfig.retryCount++;
            
            if (this.autoSyncConfig.retryCount < this.autoSyncConfig.maxRetries) {
                console.log(`同步失败，将在30秒后重试（${this.autoSyncConfig.retryCount}/${this.autoSyncConfig.maxRetries}）`);
                setTimeout(() => this.sync(), 30000);
            } else {
                this.showSyncNotification('同步失败，请检查网络连接', 'error');
            }
        } finally {
            this.autoSyncConfig.syncInProgress = false;
            this.showSyncProgress('同步完成', false);
        }
    },
    
    // 原有的同步逻辑
    async _performSync() {
        // 获取本地数据
        const localData = await this.getLocalData();
        
        try {
            // 从云端下载数据
            const cloudData = await this.downloadFromCloud();
            
            // 合并数据
            const mergedData = this.mergeData(localData, cloudData);
            
            // 保存到本地
            localStorage.setItem('diaries', JSON.stringify(mergedData));
            await this.saveLocalData(mergedData);
            
            // 上传到云端
            await this.uploadToCloud(mergedData);
            
            // 刷新页面显示
            this.triggerPageRefresh();
        } catch (error) {
            if (error.message === '文件不存在') {
                // 如果是首次同步，直接上传本地数据
                await this.uploadToCloud(localData);
            } else {
                throw error;
            }
        }
    },
    
    // 从本地数据库获取数据
    async getLocalData() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('DiaryDB', 1);
            
            request.onerror = event => {
                console.error('打开数据库失败:', event);
                reject(new Error('无法访问本地数据库'));
            };
            
            request.onsuccess = event => {
                const db = event.target.result;
                const transaction = db.transaction(['diaries'], 'readonly');
                const store = transaction.objectStore('diaries');
                const getAllRequest = store.getAll();
                
                getAllRequest.onsuccess = () => {
                    const diaries = getAllRequest.result;
                    console.log(`从本地数据库获取了${diaries.length}条日记`);
                    resolve(diaries);
                };
                
                getAllRequest.onerror = event => {
                    console.error('获取日记失败:', event);
                    reject(new Error('无法从本地数据库获取数据'));
                };
            };
        });
    },
    
    // 将数据保存到本地数据库
    async saveLocalData(data) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('DiaryDB', 1);
            
            request.onerror = event => {
                console.error('打开数据库失败:', event);
                reject(new Error('无法访问本地数据库'));
            };
            
            request.onsuccess = event => {
                const db = event.target.result;
                const transaction = db.transaction(['diaries'], 'readwrite');
                const store = transaction.objectStore('diaries');
                
                // 清空现有数据
                const clearRequest = store.clear();
                
                clearRequest.onsuccess = () => {
                    console.log('本地数据库已清空，准备写入新数据');
                    
                    // 添加所有日记
                    let addCounter = 0;
                    
                    for (const diary of data) {
                        const addRequest = store.add(diary);
                        
                        addRequest.onsuccess = () => {
                            addCounter++;
                            if (addCounter === data.length) {
                                console.log(`成功保存了${addCounter}条日记到本地数据库`);
                                resolve();
                            }
                        };
                        
                        addRequest.onerror = event => {
                            console.error('保存日记失败:', event);
                            reject(new Error('保存数据到本地数据库失败'));
                        };
                    }
                    
                    // 如果没有数据要添加
                    if (data.length === 0) {
                        console.log('没有数据需要写入本地数据库');
                        resolve();
                    }
                };
                
                clearRequest.onerror = event => {
                    console.error('清空数据库失败:', event);
                    reject(new Error('清空本地数据库失败'));
                };
            };
        });
    },
    
    // 合并本地数据和云端数据
    mergeData(localData, cloudData) {
        console.log('开始合并本地和云端数据');
        
        // 创建一个以ID为键的映射
        const mergedMap = new Map();
        
        // 首先添加所有云端数据
        if (Array.isArray(cloudData)) {
            cloudData.forEach(item => {
                if (item && item.id) {
                    mergedMap.set(item.id, item);
                }
            });
        }
        
        // 添加或更新本地数据（基于最后修改时间）
        if (Array.isArray(localData)) {
            localData.forEach(item => {
                if (item && item.id) {
                    const cloudItem = mergedMap.get(item.id);
                    if (!cloudItem || new Date(item.lastModified) > new Date(cloudItem.lastModified)) {
                        mergedMap.set(item.id, item);
                    }
                }
            });
        }
        
        // 转换回数组并按日期排序
        const mergedData = Array.from(mergedMap.values());
        mergedData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        console.log(`合并完成，共有${mergedData.length}条日记`);
        return mergedData;
    },
    
    // 显示同步通知
    showSyncNotification(message, type = 'info') {
        const notificationArea = document.getElementById('syncNotification');
        if (!notificationArea) {
            console.log('未找到通知区域，创建一个');
            const notificationDiv = document.createElement('div');
            notificationDiv.id = 'syncNotification';
            notificationDiv.style.position = 'fixed';
            notificationDiv.style.bottom = '20px';
            notificationDiv.style.right = '20px';
            notificationDiv.style.padding = '10px 15px';
            notificationDiv.style.borderRadius = '5px';
            notificationDiv.style.zIndex = '1000';
            document.body.appendChild(notificationDiv);
        }
        
        const notification = document.getElementById('syncNotification');
        notification.textContent = message;
        
        // 设置不同类型通知的样式
        if (type === 'error') {
            notification.style.backgroundColor = '#f44336';
            notification.style.color = 'white';
        } else if (type === 'success') {
            notification.style.backgroundColor = '#4CAF50';
            notification.style.color = 'white';
        } else {
            notification.style.backgroundColor = '#2196F3';
            notification.style.color = 'white';
        }
        
        notification.style.display = 'block';
        
        // 成功和错误通知5秒后自动消失
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                notification.style.display = 'none';
            }, 5000);
        }
    },
    
    // 触发页面刷新
    triggerPageRefresh() {
        // 触发自定义事件通知应用需要刷新数据
        const refreshEvent = new CustomEvent('diaryDataRefreshed');
        document.dispatchEvent(refreshEvent);
        
        // 如果有回调函数可以调用
        if (typeof updateDiaryList === 'function') {
            updateDiaryList();
        }
    },
    
    // 从云端下载数据
    async downloadFromCloud() {
        console.log('开始从云端下载数据...');
        
        if (!this.dropboxClient) {
            console.error('Dropbox客户端未初始化');
            throw new Error('云存储连接失败');
        }
        
        try {
            // 首先尝试获取文件链接
            const response = await this.dropboxClient.filesDownload({
                path: this.SYNC_FILE_PATH
            });
            
            console.log('文件下载响应:', response);
            
            // 获取文件内容
            const fileBlob = response.result.fileBlob || response.fileBlob;
            if (!fileBlob) {
                throw new Error('文件格式不正确');
            }
            
            // 从Blob读取文本内容
            const encryptedText = await this.readBlobAsText(fileBlob);
            console.log('获取到加密数据，准备解密');
            
            // 解密数据
            const decryptedData = await this.decryptData(encryptedText);
            return decryptedData;
        } catch (error) {
            console.error('从云端下载失败:', error);
            
            // 检查是否是文件不存在的错误
            if (error.status === 409 || (error.error && error.error.error_summary && error.error.error_summary.includes('path/not_found'))) {
                throw new Error('文件不存在');
            }
            
            throw new Error('从云端下载失败: ' + (error.message || '未知错误'));
        }
    },
    
    // 将Blob读取为文本
    readBlobAsText(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function() {
                resolve(reader.result);
            };
            reader.onerror = function() {
                reject(new Error('读取文件内容失败'));
            };
            reader.readAsText(blob);
        });
    },
    
    // 上传数据到云端
    async uploadToCloud(data) {
        console.log('开始上传数据到云端...');
        
        if (!this.dropboxClient) {
            console.error('Dropbox客户端未初始化');
            throw new Error('云存储连接失败');
        }
        
        try {
            // 加密数据
            const encryptedData = await this.encryptData(data);
            console.log('数据加密完成，准备上传');
            
            // 使用Dropbox API上传文件
            const response = await this.dropboxClient.filesUpload({
                path: this.SYNC_FILE_PATH,
                contents: encryptedData,
                mode: 'overwrite'
            });
            
            console.log('数据上传成功:', response);
            return response;
        } catch (error) {
            console.error('上传到云端失败:', error);
            throw new Error('上传到云端失败: ' + (error.message || '未知错误'));
        }
    },
    
    // 显示同步进度
    showSyncProgress(message, autoHide = false, isError = false) {
        // 检查是否已存在进度条
        let progressBar = document.querySelector('.sync-progress');
        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.className = 'sync-progress';
            document.body.appendChild(progressBar);
        }
        
        // 设置消息和样式
        progressBar.textContent = message;
        progressBar.style.display = 'block';
        
        if (isError) {
            progressBar.classList.add('error');
        } else {
            progressBar.classList.remove('error');
        }
        
        // 自动隐藏
        if (autoHide) {
            setTimeout(() => {
                progressBar.style.display = 'none';
            }, 3000);
        }
    },
    
    // 检查环境状态
    checkEnvironment() {
        const issues = [];
        
        // 检查网络连接
        if (!navigator.onLine) {
            issues.push('网络连接不可用');
        }
        
        // 检查Dropbox SDK是否加载
        if (typeof Dropbox === 'undefined' || typeof Dropbox.Dropbox !== 'function') {
            issues.push('Dropbox SDK未正确加载');
        }
        
        // 检查CryptoJS是否加载
        if (typeof CryptoJS === 'undefined' || typeof CryptoJS.AES === 'undefined') {
            issues.push('加密库未正确加载');
        }
        
        return {
            ready: issues.length === 0,
            issues
        };
    },
    
    // 验证当前令牌状态
    async verifyTokenStatus() {
        const token = localStorage.getItem('dropbox_access_token');
        
        if (!token) {
            return { valid: false, reason: '未授权' };
        }
        
        // 检查本地存储的过期时间
        const expiresAt = localStorage.getItem('dropbox_token_expires');
        if (expiresAt) {
            const expireTime = parseInt(expiresAt);
            if (Date.now() > expireTime) {
                return { valid: false, reason: '令牌已过期' };
            }
        }
        
        // 尝试向Dropbox发送一个请求来验证令牌
        try {
            console.log('开始验证Dropbox令牌...');
            this.dropboxClient.setAccessToken(token);
            
            // 尝试API调用来验证令牌是否有效
            try {
                // 先尝试新版本API调用格式
                console.log('尝试使用新版API验证令牌');
                try {
                    await this.dropboxClient.usersGetCurrentAccount();
                    console.log('令牌验证成功');
                    return { valid: true };
                } catch (innerError) {
                    if (innerError.status === 401) {
                        console.error('令牌无效:', innerError);
                        return { valid: false, reason: '令牌无效或已过期' };
                    }
                    
                    // 如果这不是授权错误，可能是API调用方式不对，尝试另一种方式
                    console.log('尝试使用备用API格式验证令牌');
                    await this.dropboxClient.users.getCurrentAccount();
                    console.log('令牌验证成功(备用API)');
                    return { valid: true };
                }
            } catch (apiError) {
                console.error('所有API调用验证方法均失败:', apiError);
                
                // 检查是否是授权错误
                if (apiError.status === 401) {
                    return { valid: false, reason: '令牌无效或已过期' };
                }
                
                // 如果不是401错误，可能是API结构问题，但令牌可能仍然有效
                // 我们尝试一个不同的简单API调用
                try {
                    await this.dropboxClient.checkUser({ query: 'test' });
                    console.log('令牌可能有效(简单API调用成功)');
                    return { valid: true };
                } catch (finalError) {
                    if (finalError.status === 401) {
                        return { valid: false, reason: '令牌无效或已过期' };
                    }
                    // 如果有其他错误，我们假设令牌仍然有效，因为这可能是API结构问题
                    console.warn('无法确认令牌状态，假定有效', finalError);
                    return { valid: true };
                }
            }
        } catch (error) {
            console.error('验证令牌状态时发生错误:', error);
            
            // 如果是授权错误，明确标记为无效
            if (error.status === 401) {
                return { valid: false, reason: '令牌无效或已过期' };
            }
            
            // 对于其他错误，我们返回可能无效，但提供详细错误
            return { 
                valid: false, 
                reason: '验证过程中发生错误', 
                error: error.message || '未知错误' 
            };
        }
    },
    
    // 初始化Dropbox客户端
    initClient() {
        try {
            console.log('初始化Dropbox客户端...');
            
            // 检查APP_KEY是否已设置
            if (!this.APP_KEY) {
                console.warn('未设置APP_KEY，无法完成Dropbox客户端初始化');
                return false;
            }
            
            // 获取访问令牌
            const accessToken = localStorage.getItem('dropbox_access_token');
            
            if (!accessToken) {
                console.warn('未找到访问令牌，Dropbox客户端初始化无法完成');
                return false;
            }
            
            // 尝试初始化客户端
            try {
                // 检查新版本SDK
                if (typeof Dropbox.Dropbox === 'function') {
                    // 新版本SDK (v10+)
                    this.dropboxClient = new Dropbox.Dropbox({
                        clientId: this.APP_KEY,
                        accessToken: accessToken
                    });
                    console.log('使用新版本SDK初始化Dropbox客户端成功');
                } else {
                    // 旧版本SDK
                    this.dropboxClient = new Dropbox({
                        clientId: this.APP_KEY,
                        accessToken: accessToken
                    });
                    console.log('使用旧版本SDK初始化Dropbox客户端成功');
                }
                
                this.initialized = true;
                return true;
            } catch (error) {
                console.error('初始化Dropbox客户端实例失败:', error);
                return false;
            }
        } catch (error) {
            console.error('初始化Dropbox客户端时出错:', error);
            return false;
        }
    },
    
    // 显示授权成功消息
    showAuthSuccess() {
        // 创建一个美观的成功消息
        const successMsg = document.createElement('div');
        successMsg.style.position = 'fixed';
        successMsg.style.top = '20px';
        successMsg.style.left = '50%';
        successMsg.style.transform = 'translateX(-50%)';
        successMsg.style.backgroundColor = '#4CAF50';
        successMsg.style.color = 'white';
        successMsg.style.padding = '15px 20px';
        successMsg.style.borderRadius = '5px';
        successMsg.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        successMsg.style.zIndex = '10000';
        successMsg.textContent = 'Dropbox授权成功！即将开始同步...';
        
        document.body.appendChild(successMsg);
        
        // 3秒后自动消失
        setTimeout(() => {
            successMsg.style.opacity = '0';
            successMsg.style.transition = 'opacity 0.5s ease';
            setTimeout(() => {
                if (document.body.contains(successMsg)) {
                    document.body.removeChild(successMsg);
                }
            }, 500);
        }, 3000);
    },
    
    // 辅助方法：显示如何获取访问令牌的说明
    showTokenHelpModal() {
        const helpModal = document.createElement('div');
        helpModal.className = 'token-help-modal';
        helpModal.style.position = 'fixed';
        helpModal.style.top = '50%';
        helpModal.style.left = '50%';
        helpModal.style.transform = 'translate(-50%, -50%)';
        helpModal.style.backgroundColor = 'white';
        helpModal.style.padding = '20px';
        helpModal.style.borderRadius = '8px';
        helpModal.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        helpModal.style.zIndex = '10001';
        helpModal.style.maxWidth = '500px';
        helpModal.style.width = '90%';
        
        helpModal.innerHTML = `
            <h3 style="margin-top:0;color:#1a73e8;">如何获取Dropbox访问令牌</h3>
            <ol style="text-align:left;line-height:1.5;">
                <li>在Dropbox授权页面中，点击"<strong>允许</strong>"按钮授权应用访问</li>
                <li>授权成功后，页面会显示"<strong>授权完成</strong>"字样</li>
                <li>查看页面地址栏或内容，找到类似下面的文本:
                    <div style="background:#f5f5f5;padding:8px;margin:8px 0;border-radius:4px;word-break:break-all;font-family:monospace;">
                        access_token=<strong style="color:#e91e63;">sl.Bk7aBcD...</strong>&token_type=bearer&...
                    </div>
                </li>
                <li>复制 <strong style="color:#e91e63;">sl.Bk7aBcD...</strong> 部分（不包含access_token=和后面的&符号）</li>
                <li>将复制的令牌粘贴到输入框中</li>
            </ol>
            <div style="text-align:center;margin-top:15px;">
                <button id="close-token-help" style="padding:8px 16px;background:#1a73e8;color:white;border:none;border-radius:4px;cursor:pointer;">了解了</button>
            </div>
        `;
        
        document.body.appendChild(helpModal);
        
        document.getElementById('close-token-help').addEventListener('click', () => {
            document.body.removeChild(helpModal);
        });
    },
    
    // 初始化自动同步
    initAutoSync() {
        console.log('初始化自动同步...');
        
        // 从localStorage加载配置
        const savedConfig = localStorage.getItem('autoSyncConfig');
        if (savedConfig) {
            this.autoSyncConfig = { ...this.autoSyncConfig, ...JSON.parse(savedConfig) };
            console.log('已加载自动同步配置:', this.autoSyncConfig);
        } else {
            console.log('使用默认自动同步配置:', this.autoSyncConfig);
            // 保存默认配置
            localStorage.setItem('autoSyncConfig', JSON.stringify(this.autoSyncConfig));
        }
        
        // 检查Dropbox授权状态
        const accessToken = localStorage.getItem('dropbox_access_token');
        if (!accessToken) {
            console.warn('未找到Dropbox访问令牌，自动同步可能无法工作');
            return;
        }
        
        // 启动自动同步
        this.startAutoSync();
        
        // 监听数据变化
        this.setupChangeDetection();
        
        // 监听网络状态
        this.setupNetworkListener();
        
        // 监听页面可见性
        this.setupVisibilityListener();
        
        // 立即执行一次同步检查
        this.checkAndSync();
        
        console.log('自动同步初始化完成');
    },
    
    // 检查并执行同步
    async checkAndSync() {
        console.log('执行同步检查...');
        
        if (this.autoSyncConfig.syncInProgress) {
            console.log('同步正在进行中，跳过本次检查');
            return;
        }
        
        if (!navigator.onLine) {
            console.log('网络离线，跳过本次检查');
            return;
        }
        
        // 获取本地数据
        const localData = await this.getLocalData();
        console.log('当前本地数据条数:', localData.length);
        
        try {
            // 尝试从云端获取数据
            const cloudData = await this.downloadFromCloud();
            console.log('云端数据条数:', cloudData.length);
            
            // 比较数据
            if (JSON.stringify(localData) !== JSON.stringify(cloudData)) {
                console.log('检测到数据不一致，开始同步');
                await this.sync();
            } else {
                console.log('数据已是最新，无需同步');
            }
        } catch (error) {
            console.error('同步检查失败:', error);
            if (error.message === '文件不存在') {
                console.log('云端文件不存在，上传本地数据');
                await this.uploadToCloud(localData);
            }
        }
    },
    
    // 启动自动同步
    startAutoSync() {
        if (!this.autoSyncConfig.enabled) {
            console.log('自动同步已禁用');
            return;
        }
        
        console.log('启动自动同步，间隔:', this.autoSyncConfig.interval, 'ms');
        
        // 清除可能存在的旧定时器
        if (this.autoSyncTimer) {
            clearInterval(this.autoSyncTimer);
            console.log('清除旧的同步定时器');
        }
        
        // 设置新的定时器
        this.autoSyncTimer = setInterval(async () => {
            console.log('定时器触发，检查是否需要同步');
            
            if (this.autoSyncConfig.syncInProgress) {
                console.log('同步正在进行中，跳过本次自动同步');
                return;
            }
            
            if (!navigator.onLine) {
                console.log('网络离线，跳过本次自动同步');
                return;
            }
            
            if (document.hidden) {
                console.log('页面不可见，跳过本次自动同步');
                return;
            }
            
            // 检查是否有数据变化
            if (this.autoSyncConfig.changeDetected) {
                console.log('检测到数据变化，开始自动同步');
                await this.sync();
                this.autoSyncConfig.changeDetected = false;
            }
            
            // 定期全量同步（每5分钟）
            const now = Date.now();
            if (!this.autoSyncConfig.lastSyncTime || 
                (now - this.autoSyncConfig.lastSyncTime) > 300000) {
                console.log('执行定期全量同步');
                await this.checkAndSync();
            }
        }, this.autoSyncConfig.interval);
        
        // 立即执行一次同步检查
        this.checkAndSync();
    },
    
    // 设置数据变化检测
    setupChangeDetection() {
        console.log('设置数据变化检测...');
        
        // 监听localStorage变化
        window.addEventListener('storage', (e) => {
            if (e.key === 'diaries') {
                this.autoSyncConfig.changeDetected = true;
                console.log('检测到数据变化（通过storage事件）');
                // 立即触发同步
                this.sync();
            }
        });
        
        // 监听IndexedDB变化
        const db = indexedDB.open('DiaryDB', 1);
        db.onsuccess = (event) => {
            const database = event.target.result;
            database.addEventListener('versionchange', () => {
                this.autoSyncConfig.changeDetected = true;
                console.log('检测到数据变化（通过IndexedDB事件）');
                // 立即触发同步
                this.sync();
            });
        };
        
        // 重写数据保存方法以添加变化检测
        const originalSaveLocalData = this.saveLocalData;
        this.saveLocalData = async (data) => {
            await originalSaveLocalData.call(this, data);
            this.autoSyncConfig.changeDetected = true;
            console.log('检测到数据变化（通过保存操作）');
            // 立即触发同步
            this.sync();
        };
        
        console.log('数据变化检测设置完成');
    },
    
    // 设置网络状态监听
    setupNetworkListener() {
        window.addEventListener('online', () => {
            console.log('网络已连接，检查是否需要同步');
            if (this.autoSyncConfig.changeDetected) {
                this.sync();
            }
        });
        
        window.addEventListener('offline', () => {
            console.log('网络已断开，暂停自动同步');
        });
    },
    
    // 设置页面可见性监听
    setupVisibilityListener() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('页面变为可见，检查是否需要同步');
                if (this.autoSyncConfig.changeDetected) {
                    this.sync();
                }
            }
        });
    }
};

// 在页面加载时初始化
// 自动同步与定时同步增强 by Apple风格AI

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('开始初始化云同步模块...');
        
        // 检查是否已设置Dropbox App Key
        if (!CloudSync.loadAppKey()) {
            console.log('未设置Dropbox App Key，显示设置提示');
            // 显示设置提示
            const setupHtml = `
                <div class="sync-setup-prompt" style="
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #fff;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    z-index: 1000;
                    max-width: 400px;
                ">
                    <h3 style="margin: 0 0 10px 0; color: #333;">设置云同步</h3>
                    <p style="margin: 0 0 15px 0; color: #666;">
                        要使用云同步功能，需要先设置Dropbox App Key。
                        <a href="https://www.dropbox.com/developers/apps" target="_blank" style="color: #0061fe;">点击这里</a> 创建应用并获取App Key。
                    </p>
                    <input type="text" id="dropboxAppKey" placeholder="输入你的Dropbox App Key" style="
                        width: 100%;
                        padding: 8px;
                        margin-bottom: 10px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                    ">
                    <button onclick="CloudSync.saveAppKey(document.getElementById('dropboxAppKey').value)" style="
                        background: #0061fe;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                    ">保存</button>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', setupHtml);
        }
        
        // 检查URL是否包含访问令牌 - 优先处理授权回调
        if (window.location.hash.includes('access_token=')) {
            console.log('检测到页面加载时有授权回调');
            // 立即尝试处理重定向
            await CloudSync.handleRedirect();
        }
        // 检查是否有网络连接
        if (!navigator.onLine) {
            console.warn('无网络连接，云同步功能可能不可用');
        }
        // 检查必要的脚本是否加载
        if (typeof Dropbox === 'undefined' || typeof CryptoJS === 'undefined') {
            console.error('云同步依赖的库未正确加载，请检查网络或刷新页面');
            return;
        }
        // 初始化云同步模块
        const initResult = CloudSync.init();
        // 提供明确的用户反馈
        if (CloudSync.initialized) {
            console.log('云同步模块初始化成功');
        }
        // 检查本地存储的令牌是否接近过期
        const tokenExpires = localStorage.getItem('dropbox_token_expires');
        if (tokenExpires) {
            const expireTime = parseInt(tokenExpires);
            const now = Date.now();
            const timeLeftHours = (expireTime - now) / (1000 * 60 * 60);
            // 如果令牌剩余时间不足24小时，提醒用户
            if (timeLeftHours > 0 && timeLeftHours < 24) {
                console.warn(`Dropbox授权将在约${Math.floor(timeLeftHours)}小时后过期`);
                // 但我们不自动更新，等用户下次点击同步按钮时会检查并更新
            }
        }
        // 如果用户离线且之前已授权，添加提示
        if (!navigator.onLine && localStorage.getItem('dropbox_access_token')) {
            const lastSyncTime = localStorage.getItem('last_sync_time');
            if (lastSyncTime) {
                const syncDate = new Date(lastSyncTime);
                console.log(`上次同步时间: ${syncDate.toLocaleString()}`);
            }
        }
        // ------------------- Apple风格自动同步增强 -------------------
        // 1. 页面加载时自动同步
        if (window.CloudSync && localStorage.getItem('dropbox_access_token')) {
            try {
                CloudSync.showSyncProgress('正在自动同步...', false, false);
                await CloudSync.sync();
            } catch (e) {
                CloudSync.showSyncProgress('自动同步失败', true, true);
                console.error('自动同步失败:', e);
            }
        }
        // 2. 定时自动同步（每60秒）
        setInterval(async () => {
            if (window.CloudSync && localStorage.getItem('dropbox_access_token')) {
                try {
                    CloudSync.showSyncProgress('正在自动同步...', false, false);
                    await CloudSync.sync();
                } catch (e) {
                    CloudSync.showSyncProgress('自动同步失败', true, true);
                    console.error('定时自动同步失败:', e);
                }
            }
        }, 60000); // 60秒
        // ----------------------------------------------------------
    } catch (error) {
        console.error('初始化云同步模块时出错:', error);
    }
}); 
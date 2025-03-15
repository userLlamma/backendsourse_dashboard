# 课程监控系统

这是一个用于监控学生API开发课程进度的系统，教师可以实时查看学生的API实现状态、测试结果、待办事项和活动情况。

## 系统概述

课程监控系统是一个全栈应用，分为前端和后端两部分：

- **前端**：基于React的管理界面，提供给教师和学生使用
- **后端**：基于Express的RESTful API服务

系统支持教师端和学生端两种角色，具有完善的认证机制和实时监控功能。

### 主要功能

- **教师端**：
  - 实时监控所有学生的在线状态和活动情况
  - 查看学生API测试结果和待办事项
  - 学生账号管理（创建、重置密码、删除）
  - 成绩导出（支持Excel和CSV格式）
  - 学生设备认证管理
  - 硬件环境监控（检测潜在的代替完成情况）

- **学生端**：
  - 查看个人API测试结果和详情
  - 管理待办事项
  - 查看班级排行榜

## 系统架构

### 技术栈

- **前端**：React + Bootstrap 5 + Axios
- **后端**：Node.js + Express + MongoDB
- **认证**：JWT (JSON Web Token)
- **安全**：bcryptjs密码加密 + 公钥/私钥签名认证

### 目录结构

```
/
├── backend/                # 后端代码
│   ├── middleware/         # 中间件（认证等）
│   ├── models/             # 数据模型
│   ├── routes/             # API路由
│   ├── scripts/            # 管理脚本
│   ├── utils/              # 工具函数
│   └── server.js           # 服务器入口
├── frontend/               # 前端代码
│   ├── public/             # 静态资源
│   └── src/                # 源代码
│       ├── components/     # 组件
│       ├── contexts/       # 上下文（认证等）
│       └── pages/          # 页面组件
└── package.json            # 项目配置
```

## 安装与配置

### 系统要求

- Node.js v14+
- MongoDB 4.0+
- NPM 6+

### 环境变量配置

在根目录创建`.env`文件，配置以下环境变量：

```
# 数据库配置
MONGODB_URI=mongodb://localhost:27017/course_monitor

# JWT密钥（用于认证）
JWT_SECRET=your_jwt_secret_key

# 学生API通信密钥
STUDENT_API_KEY=your_api_key

# 管理员账号（首次运行时创建）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_admin_password
ADMIN_NAME=系统管理员

# 备份配置（可选）
ENABLE_AUTO_BACKUP=true
BACKUP_INTERVAL=86400000  # 以毫秒为单位，默认24小时
```

### 安装步骤

1. 克隆仓库：
   ```bash
   git clone <repository-url>
   cd course-monitor
   ```

2. 安装依赖：
   ```bash
   npm run setup
   ```
   
   此命令会自动安装后端和前端依赖，并构建前端项目。

3. 创建管理员账号：
   ```bash
   npm run create-admin
   ```

4. 启动服务：
   ```bash
   npm start
   ```

## 使用指南

### 教师登录

1. 访问系统首页 `/login`
2. 使用管理员账号或教师账号登录
3. 登录后可以查看仪表板、学生列表等功能

### 学生账号管理

1. 在"学生管理"页面可以创建新学生账号
2. 支持批量导入学生（格式：学号,姓名）
3. 可以重置学生密码和公钥认证

### 学生登录

1. 访问 `/student-login` 页面
2. 输入学号和密码（初始密码为学号）
3. 登录后可以查看个人信息和排行榜

## 系统安全

### 认证机制

1. **教师认证**：使用JWT令牌认证，有效期12小时
2. **学生认证**：支持两种认证方式
   - JWT令牌认证（网页登录）
   - 公钥/私钥签名认证（reporter客户端）

### 设备认证与防作弊

系统具有硬件环境检测功能，可以：
1. 记录学生每次连接的硬件环境指纹
2. 检测异常的环境变化（可能表示代替完成）
3. 支持设备认证密钥管理，防止未授权访问

## 系统维护

### 数据备份

系统支持自动数据备份，可在`.env`文件中配置：
- `ENABLE_AUTO_BACKUP=true`：启用自动备份
- `BACKUP_INTERVAL=86400000`：备份间隔（毫秒）

### 排障指南

- **登录失败**：检查JWT_SECRET配置是否正确
- **学生上报失败**：检查STUDENT_API_KEY是否正确设置
- **数据库连接问题**：检查MONGODB_URI配置

## 学生上报接入

学生需要开发一个reporter客户端与系统集成，主要步骤：

1. 初始化：使用学号和密码注册
2. 生成密钥对：创建公钥/私钥对进行签名认证
3. 定期上报：发送API测试结果和待办事项状态

详细的reporter开发文档请参考[学生开发指南](./student-guide.md)。

## 开发者文档

### API接口

系统提供多个API接口，主要包括：

- 认证相关：`/api/auth/*`和`/api/student-auth/*`
- 学生管理：`/api/student-management/*`
- 数据展示：`/api/dashboard/*`
- 学生数据：`/api/students/*`
- 数据导出：`/api/export/*`

完整API文档请参考[API文档](./api-docs.md)。

### 扩展开发

如需扩展系统功能，请参考以下步骤：

1. 后端扩展：
   - 在`models/`中定义新的数据模型
   - 在`routes/`中创建新的API路由
   - 在`server.js`中注册路由

2. 前端扩展：
   - 在`src/pages/`中创建新页面组件
   - 在`src/components/`中创建新组件
   - 在`App.js`中添加路由

## 许可证

请查看LICENSE文件了解详细的许可信息。

## 联系方式

如有问题或建议，请联系课程管理员。
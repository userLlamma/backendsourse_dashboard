# 课程监控系统 API 文档

本文档详细列出了课程监控系统的所有API接口，包括请求方法、URL、参数、认证要求和返回值等信息。

## 目录

- [认证相关](#认证相关)
  - [教师登录](#教师登录)
  - [获取当前教师信息](#获取当前教师信息)
  - [教师注册新用户](#教师注册新用户)
  - [学生登录](#学生登录)
  - [获取当前学生信息](#获取当前学生信息)
  - [学生修改密码](#学生修改密码)
- [学生数据](#学生数据)
  - [获取所有学生列表](#获取所有学生列表)
  - [获取单个学生详情](#获取单个学生详情)
  - [获取学生待办事项](#获取学生待办事项)
  - [学生状态上报](#学生状态上报)
  - [发送命令到学生](#发送命令到学生)
  - [获取认证挑战码](#获取认证挑战码)
  - [注册公钥](#注册公钥)
  - [提交签名验证](#提交签名验证)
  - [获取学生密钥列表](#获取学生密钥列表)
  - [吊销公钥](#吊销公钥)
  - [获取学生硬件历史](#获取学生硬件历史)
  - [标记硬件签名状态](#标记硬件签名状态)
- [仪表板数据](#仪表板数据)
  - [获取仪表板统计数据](#获取仪表板统计数据)
  - [获取学生排行榜](#获取学生排行榜)
- [学生管理](#学生管理)
  - [创建新学生](#创建新学生)
  - [重置学生密码](#重置学生密码)
  - [删除学生](#删除学生)
  - [批量创建学生](#批量创建学生)
  - [重置学生密钥](#重置学生密钥)
- [数据导出](#数据导出)
  - [导出成绩](#导出成绩)
- [数据备份](#数据备份)
  - [获取数据备份](#获取数据备份)

## 认证相关

所有API请求（除登录外）都需要在请求头中包含以下认证信息：

```
Authorization: Bearer <token>
```

其中，`<token>` 是登录后获取的JWT令牌。

### 教师登录

- **URL**: `/api/auth/login`
- **方法**: `POST`
- **认证要求**: 无
- **请求体**:
  ```json
  {
    "username": "教师用户名",
    "password": "密码"
  }
  ```
- **返回示例**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "60d5ec9c82b3d43b2c7e6b5a",
      "username": "teacher",
      "name": "教师名",
      "role": "teacher"
    }
  }
  ```
- **状态码**:
  - `200 OK`: 登录成功
  - `400 Bad Request`: 缺少用户名或密码
  - `401 Unauthorized`: 用户名或密码无效
  - `500 Internal Server Error`: 服务器错误

### 获取当前教师信息

- **URL**: `/api/auth/me`
- **方法**: `GET`
- **认证要求**: 是
- **返回示例**:
  ```json
  {
    "id": "60d5ec9c82b3d43b2c7e6b5a",
    "username": "teacher",
    "name": "教师名",
    "role": "teacher",
    "email": "teacher@example.com"
  }
  ```
- **状态码**:
  - `200 OK`: 成功获取信息
  - `401 Unauthorized`: 未认证或令牌无效
  - `404 Not Found`: 用户未找到
  - `500 Internal Server Error`: 服务器错误

### 教师注册新用户

注意：这个接口仅限管理员使用

- **URL**: `/api/auth/register`
- **方法**: `POST`
- **认证要求**: 是（需要管理员权限）
- **请求体**:
  ```json
  {
    "username": "新用户名",
    "password": "密码",
    "name": "用户全名",
    "email": "email@example.com",
    "role": "teacher"  // 可选，默认为 "teacher"
  }
  ```
- **返回示例**:
  ```json
  {
    "message": "用户创建成功",
    "user": {
      "id": "60d5ec9c82b3d43b2c7e6b5a",
      "username": "newteacher",
      "name": "新教师",
      "role": "teacher"
    }
  }
  ```
- **状态码**:
  - `201 Created`: 创建成功
  - `400 Bad Request`: 缺少必填字段或用户名已存在
  - `401 Unauthorized`: 未认证或令牌无效
  - `403 Forbidden`: 权限不足（非管理员）
  - `500 Internal Server Error`: 服务器错误

### 学生登录

- **URL**: `/api/student-auth/login`
- **方法**: `POST`
- **认证要求**: 无
- **请求体**:
  ```json
  {
    "studentId": "学生学号",
    "password": "密码"
  }
  ```
- **返回示例**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "60d5ec9c82b3d43b2c7e6b5b",
      "studentId": "201901",
      "name": "学生名",
      "role": "student"
    }
  }
  ```
- **状态码**:
  - `200 OK`: 登录成功
  - `400 Bad Request`: 缺少学号或密码
  - `401 Unauthorized`: 学号或密码无效，或账号未完成注册
  - `500 Internal Server Error`: 服务器错误

### 获取当前学生信息

- **URL**: `/api/student-auth/me`
- **方法**: `GET`
- **认证要求**: 是（学生令牌）
- **返回示例**:
  ```json
  {
    "id": "60d5ec9c82b3d43b2c7e6b5b",
    "studentId": "201901",
    "name": "学生名",
    "role": "student"
  }
  ```
- **状态码**:
  - `200 OK`: 成功获取信息
  - `401 Unauthorized`: 未认证或令牌无效
  - `403 Forbidden`: 不是学生令牌
  - `404 Not Found`: 学生未找到
  - `500 Internal Server Error`: 服务器错误

### 学生修改密码

- **URL**: `/api/student-auth/change-password`
- **方法**: `POST`
- **认证要求**: 是（学生令牌）
- **请求体**:
  ```json
  {
    "currentPassword": "当前密码",
    "newPassword": "新密码"
  }
  ```
- **返回示例**:
  ```json
  {
    "message": "密码修改成功"
  }
  ```
- **状态码**:
  - `200 OK`: 密码修改成功
  - `400 Bad Request`: 缺少当前密码或新密码
  - `401 Unauthorized`: 当前密码不正确
  - `403 Forbidden`: 不是学生令牌
  - `500 Internal Server Error`: 服务器错误

## 学生数据

### 获取所有学生列表

- **URL**: `/api/students`
- **方法**: `GET`
- **认证要求**: 是
- **返回示例**:
  ```json
  [
    {
      "_id": "60d5ec9c82b3d43b2c7e6b5b",
      "studentId": "201901",
      "name": "学生1",
      "ipAddress": "192.168.1.1",
      "port": 3000,
      "status": "online",
      "lastReportTime": "2023-04-01T12:00:00Z",
      "todoCount": 5,
      "lastTestResults": {
        "score": 80,
        "totalPassed": 8,
        "totalFailed": 2
      }
    },
    // 更多学生...
  ]
  ```
- **状态码**:
  - `200 OK`: 成功获取学生列表
  - `401 Unauthorized`: 未认证或令牌无效
  - `500 Internal Server Error`: 服务器错误

### 获取单个学生详情

- **URL**: `/api/students/:studentId`
- **方法**: `GET`
- **认证要求**: 是
- **参数**: `:studentId` - 学生学号
- **返回示例**:
  ```json
  {
    "_id": "60d5ec9c82b3d43b2c7e6b5b",
    "studentId": "201901",
    "name": "学生1",
    "ipAddress": "192.168.1.1",
    "port": 3000,
    "status": "online",
    "lastReportTime": "2023-04-01T12:00:00Z",
    "todoCount": 5,
    "todos": [
      {
        "id": 1,
        "title": "实现TODO API",
        "completed": true,
        "created_at": "2023-03-01T10:00:00Z"
      },
      // 更多待办事项...
    ],
    "lastTestResults": {
      "score": 80,
      "totalPassed": 8,
      "totalFailed": 2,
      "tests": [
        {
          "name": "GET /todos",
          "passed": true
        },
        // 更多测试结果...
      ]
    }
  }
  ```
- **状态码**:
  - `200 OK`: 成功获取学生详情
  - `401 Unauthorized`: 未认证或令牌无效
  - `404 Not Found`: 学生未找到
  - `500 Internal Server Error`: 服务器错误

### 获取学生待办事项

- **URL**: `/api/students/:studentId/todos`
- **方法**: `GET`
- **认证要求**: 是
- **参数**: `:studentId` - 学生学号
- **返回示例**:
  ```json
  [
    {
      "id": 1,
      "title": "实现TODO API",
      "completed": true,
      "created_at": "2023-03-01T10:00:00Z"
    },
    // 更多待办事项...
  ]
  ```
- **状态码**:
  - `200 OK`: 成功获取待办事项
  - `401 Unauthorized`: 未认证或令牌无效
  - `404 Not Found`: 学生未找到
  - `500 Internal Server Error`: 服务器错误

### 学生状态上报

- **URL**: `/api/students/report`
- **方法**: `POST`
- **认证要求**: 
  - 头部需要包含 `x-api-key` 和 `x-student-id`
  - 可能需要签名验证
- **请求头**:
  ```
  x-api-key: <STUDENT_API_KEY>
  x-student-id: <学生学号>
  ```
- **请求体**:
  ```json
  {
    "studentId": "201901",
    "name": "学生1",
    "ipAddress": "192.168.1.1",
    "port": 3000,
    "timestamp": "2023-04-01T12:00:00Z",
    "signature": "签名字符串", // 如果学生已注册则必需
    "hardwareInfo": {
      // 硬件环境信息...
      "cpuModel": "Intel Core i7",
      "cpuCores": 8,
      "totalMemory": 16384,
      "platform": "win32",
      "hostname": "LAPTOP-ABC123",
      "username": "student",
      "macAddresses": ["00:11:22:33:44:55"],
      "publicKey": "SSH-RSA AAAA..." // 首次报告时的公钥
    },
    "data": {
      "todoCount": 5,
      "todos": [
        {
          "id": 1,
          "title": "实现TODO API",
          "completed": true,
          "created_at": "2023-03-01T10:00:00Z"
        },
        // 更多待办事项...
      ],
      "testsPassed": 8,
      "testsTotal": 10,
      "testResults": [
        {
          "name": "GET /todos",
          "passed": true
        },
        // 更多测试结果...
      ]
    }
  }
  ```
- **返回示例**:
  ```json
  {
    "message": "报告接收成功",
    "timestamp": "2023-04-01T12:01:00Z",
    "command": "RUN_TEST", // 可选，如果有待执行命令
    "params": {} // 命令参数
  }
  ```
  
  或需要认证时：
  ```json
  {
    "error": "需要签名验证",
    "requiresAuth": true,
    "challenge": "随机挑战码"
  }
  ```
- **状态码**:
  - `200 OK`: 报告接收成功
  - `400 Bad Request`: 请求体格式错误或学号不匹配
  - `401 Unauthorized`: API密钥无效、签名验证失败或需要重新注册
  - `500 Internal Server Error`: 服务器错误

### 发送命令到学生

- **URL**: `/api/students/:studentId/command`
- **方法**: `POST`
- **认证要求**: 是
- **参数**: `:studentId` - 学生学号
- **请求体**:
  ```json
  {
    "command": "RUN_TEST",
    "params": {
      // 命令参数...
    }
  }
  ```
- **返回示例**:
  ```json
  {
    "message": "命令 RUN_TEST 已排队等待学生下次报告时执行"
  }
  ```
- **状态码**:
  - `200 OK`: 命令已排队
  - `400 Bad Request`: 缺少命令
  - `401 Unauthorized`: 未认证或令牌无效
  - `404 Not Found`: 学生未找到
  - `500 Internal Server Error`: 服务器错误

### 获取认证挑战码

- **URL**: `/api/students/auth/challenge/:studentId`
- **方法**: `GET`
- **认证要求**: 无
- **参数**: `:studentId` - 学生学号
- **返回示例**:
  ```json
  {
    "challenge": "random_challenge_string",
    "expiresAt": "2023-04-01T12:05:00Z",
    "message": "请使用你的私钥对挑战码进行签名，并在5分钟内提交响应"
  }
  ```
- **状态码**:
  - `200 OK`: 成功生成挑战码
  - `404 Not Found`: 学生未找到
  - `500 Internal Server Error`: 服务器错误

### 注册公钥

- **URL**: `/api/students/auth/register-key/:studentId`
- **方法**: `POST`
- **认证要求**: 无（首次注册）
- **参数**: `:studentId` - 学生学号
- **请求体**:
  ```json
  {
    "publicKey": "SSH-RSA AAAA...",
    "keyName": "我的笔记本",
    "signature": "签名字符串",
    "challenge": "挑战码"
  }
  ```
- **返回示例**:
  ```json
  {
    "success": true,
    "keyId": "60d5ec9c82b3d43b2c7e6b5c",
    "message": "公钥注册成功"
  }
  ```
- **状态码**:
  - `201 Created`: 公钥注册成功
  - `400 Bad Request`: 缺少必要参数或公钥格式错误
  - `404 Not Found`: 学生未找到
  - `500 Internal Server Error`: 服务器错误

### 提交签名验证

- **URL**: `/api/students/auth/verify/:studentId`
- **方法**: `POST`
- **认证要求**: 无（使用签名验证）
- **参数**: `:studentId` - 学生学号
- **请求体**:
  ```json
  {
    "signature": "签名字符串"
  }
  ```
- **返回示例**:
  ```json
  {
    "success": true,
    "message": "认证成功",
    "keyName": "我的笔记本"
  }
  ```
- **状态码**:
  - `200 OK`: 验证成功
  - `400 Bad Request`: 缺少签名
  - `401 Unauthorized`: 验证失败
  - `500 Internal Server Error`: 服务器错误

### 获取学生密钥列表

- **URL**: `/api/students/:studentId/keys`
- **方法**: `GET`
- **认证要求**: 是（教师或学生本人）
- **参数**: `:studentId` - 学生学号
- **返回示例**:
  ```json
  [
    {
      "_id": "60d5ec9c82b3d43b2c7e6b5c",
      "studentId": "201901",
      "name": "我的笔记本",
      "createdAt": "2023-03-01T10:00:00Z",
      "lastUsed": "2023-04-01T12:00:00Z",
      "revoked": {
        "isRevoked": false
      }
    },
    // 更多密钥...
  ]
  ```
- **状态码**:
  - `200 OK`: 成功获取密钥列表
  - `401 Unauthorized`: 未认证或令牌无效
  - `403 Forbidden`: 权限不足
  - `500 Internal Server Error`: 服务器错误

### 吊销公钥

- **URL**: `/api/students/:studentId/keys/:keyId/revoke`
- **方法**: `POST`
- **认证要求**: 是（教师或学生本人）
- **参数**: 
  - `:studentId` - 学生学号
  - `:keyId` - 密钥ID
- **请求体**:
  ```json
  {
    "reason": "密钥泄露"
  }
  ```
- **返回示例**:
  ```json
  {
    "success": true,
    "message": "公钥已吊销"
  }
  ```
- **状态码**:
  - `200 OK`: 成功吊销公钥
  - `401 Unauthorized`: 未认证或令牌无效
  - `403 Forbidden`: 权限不足
  - `500 Internal Server Error`: 服务器错误

### 获取学生硬件历史

- **URL**: `/api/students/:studentId/hardware-history`
- **方法**: `GET`
- **认证要求**: 是（教师）
- **参数**: `:studentId` - 学生学号
- **返回示例**:
  ```json
  [
    {
      "_id": "60d5ec9c82b3d43b2c7e6b5d",
      "student": "60d5ec9c82b3d43b2c7e6b5b",
      "signature": {
        "cpuModel": "Intel Core i7",
        "cpuCores": 8,
        "totalMemory": 16384,
        "platform": "win32",
        "hostname": "LAPTOP-ABC123",
        "username": "student",
        "macAddresses": ["00:11:22:33:44:55"]
      },
      "ipAddress": "192.168.1.1",
      "timestamp": "2023-04-01T12:00:00Z",
      "suspicious": false
    },
    // 更多硬件历史...
  ]
  ```
- **状态码**:
  - `200 OK`: 成功获取硬件历史
  - `401 Unauthorized`: 未认证或令牌无效
  - `403 Forbidden`: 权限不足
  - `404 Not Found`: 学生未找到
  - `500 Internal Server Error`: 服务器错误

### 标记硬件签名状态

- **URL**: `/api/students/:studentId/hardware/:signatureId/flag`
- **方法**: `POST`
- **认证要求**: 是（教师）
- **参数**: 
  - `:studentId` - 学生学号
  - `:signatureId` - 硬件签名ID
- **请求体**:
  ```json
  {
    "suspicious": true,
    "reason": "异常的硬件环境变化"
  }
  ```
- **返回示例**:
  ```json
  {
    "success": true,
    "message": "硬件签名已标记为可疑"
  }
  ```
- **状态码**:
  - `200 OK`: 成功标记硬件签名状态
  - `401 Unauthorized`: 未认证或令牌无效
  - `403 Forbidden`: 权限不足
  - `404 Not Found`: 硬件签名记录未找到
  - `500 Internal Server Error`: 服务器错误

## 仪表板数据

### 获取仪表板统计数据

- **URL**: `/api/dashboard/stats`
- **方法**: `GET`
- **认证要求**: 是
- **返回示例**:
  ```json
  {
    "totalStudents": 30,
    "onlineStudents": 15,
    "todoItems": 150,
    "testStats": {
      "avgScore": 75.5,
      "passRate": 80.2,
      "totalTests": 300,
      "passedTests": 240
    },
    "lastUpdate": "2023-04-01T12:01:00Z"
  }
  ```
- **状态码**:
  - `200 OK`: 成功获取统计数据
  - `401 Unauthorized`: 未认证或令牌无效
  - `500 Internal Server Error`: 服务器错误

### 获取学生排行榜

- **URL**: `/api/dashboard/leaderboard`
- **方法**: `GET`
- **认证要求**: 是
- **返回示例**:
  ```json
  [
    {
      "studentId": "201901",
      "name": "学生1",
      "score": 90,
      "passRate": 95.0,
      "todoCount": 8,
      "status": "online",
      "lastSeen": "2023-04-01T12:00:00Z"
    },
    // 更多学生...
  ]
  ```
- **状态码**:
  - `200 OK`: 成功获取排行榜
  - `401 Unauthorized`: 未认证或令牌无效
  - `500 Internal Server Error`: 服务器错误

## 学生管理

### 创建新学生

- **URL**: `/api/student-management/create`
- **方法**: `POST`
- **认证要求**: 是（教师或管理员）
- **请求体**:
  ```json
  {
    "studentId": "201901",
    "name": "学生1",
    "initialPassword": "初始密码" // 可选，默认与学号相同
  }
  ```
- **返回示例**:
  ```json
  {
    "message": "学生创建成功",
    "student": {
      "id": "60d5ec9c82b3d43b2c7e6b5b",
      "studentId": "201901",
      "name": "学生1"
    }
  }
  ```
- **状态码**:
  - `201 Created`: 创建成功
  - `400 Bad Request`: 缺少学号或姓名，或学号已存在
  - `401 Unauthorized`: 未认证或令牌无效
  - `403 Forbidden`: 权限不足
  - `500 Internal Server Error`: 服务器错误

### 重置学生密码

- **URL**: `/api/student-management/:studentId/reset-password`
- **方法**: `POST`
- **认证要求**: 是（教师或管理员）
- **参数**: `:studentId` - 学生学号
- **请求体**:
  ```json
  {
    "newPassword": "新密码" // 可选，默认与学号相同
  }
  ```
- **返回示例**:
  ```json
  {
    "message": "学生 201901 的密码已重置"
  }
  ```
- **状态码**:
  - `200 OK`: 重置成功
  - `401 Unauthorized`: 未认证或令牌无效
  - `403 Forbidden`: 权限不足
  - `404 Not Found`: 学生未找到
  - `500 Internal Server Error`: 服务器错误

### 删除学生

- **URL**: `/api/student-management/:studentId`
- **方法**: `DELETE`
- **认证要求**: 是（仅管理员）
- **参数**: `:studentId` - 学生学号
- **返回示例**:
  ```json
  {
    "message": "学生 201901 已删除"
  }
  ```
- **状态码**:
  - `200 OK`: 删除成功
  - `401 Unauthorized`: 未认证或令牌无效
  - `403 Forbidden`: 权限不足（非管理员）
  - `404 Not Found`: 学生未找到
  - `500 Internal Server Error`: 服务器错误

### 批量创建学生

- **URL**: `/api/student-management/batch`
- **方法**: `POST`
- **认证要求**: 是（仅管理员）
- **请求体**:
  ```json
  {
    "students": [
      {
        "studentId": "201901",
        "name": "学生1"
      },
      {
        "studentId": "201902",
        "name": "学生2"
      }
      // 更多学生...
    ]
  }
  ```
- **返回示例**:
  ```json
  {
    "message": "成功创建 2 名学生，失败 0 名",
    "results": {
      "success": [
        {
          "studentId": "201901",
          "name": "学生1"
        },
        {
          "studentId": "201902",
          "name": "学生2"
        }
      ],
      "failed": []
    }
  }
  ```
- **状态码**:
  - `200 OK`: 批量处理完成（可能包含部分失败）
  - `400 Bad Request`: 请求格式错误
  - `401 Unauthorized`: 未认证或令牌无效
  - `403 Forbidden`: 权限不足（非管理员）
  - `500 Internal Server Error`: 服务器错误

### 重置学生密钥

- **URL**: `/api/student-management/:studentId/reset-keys`
- **方法**: `POST`
- **认证要求**: 是（教师或管理员）
- **参数**: `:studentId` - 学生学号
- **返回示例**:
  ```json
  {
    "success": true,
    "message": "已成功重置学生 201901 的密钥验证状态",
    "keysRevoked": 2
  }
  ```
- **状态码**:
  - `200 OK`: 重置成功
  - `401 Unauthorized`: 未认证或令牌无效
  - `403 Forbidden`: 权限不足
  - `404 Not Found`: 学生未找到
  - `500 Internal Server Error`: 服务器错误

## 数据导出

### 导出成绩

- **URL**: `/api/export/grades`
- **方法**: `GET`
- **认证要求**: 是（教师或管理员）
- **查询参数**:
  - `format`: 导出格式，可选值为 `excel` 或 `csv`，默认为 `csv`
  - `testWeight`: API测试权重，默认为 `0.8`
  - `participationWeight`: 参与度权重，默认为 `0.2`
- **返回**: 根据指定格式返回文件下载
- **状态码**:
  - `200 OK`: 导出成功
  - `401 Unauthorized`: 未认证或令牌无效
  - `403 Forbidden`: 权限不足
  - `500 Internal Server Error`: 服务器错误

## 数据备份

### 获取数据备份

- **URL**: `/api/backup`
- **方法**: `GET`
- **认证要求**: 是（仅管理员）
- **返回示例**:
  ```json
  {
    "timestamp": "2023-04-01T12:00:00Z",
    "students": [
      // 学生数据...
    ],
    "users": [
      // 用户数据...
    ]
  }
  ```
- **状态码**:
  - `200 OK`: 备份成功
  - `401 Unauthorized`: 未认证或令牌无效
  - `403 Forbidden`: 权限不足（非管理员）
  - `500 Internal Server Error`: 服务器错误

## 错误处理

所有API可能返回以下错误响应格式：

```json
{
  "error": "错误描述信息"
}
```

## 客户端集成指南

### 学生客户端（Reporter）集成流程

1. **初始设置**:
   - 学生账号由教师预先创建
   - 初始密码通常与学号相同

2. **公钥认证流程**:
   - 首次连接：生成公私钥对，提交公钥进行注册
   - 获取挑战码：`GET /api/students/auth/challenge/:studentId`
   - 提交注册：`POST /api/students/auth/register-key/:studentId`
   - 后续认证：使用私钥对挑战码签名，进行验证

3. **定期上报**:
   - 定期调用 `POST /api/students/report` 上报状态
   - 包含待办事项、测试结果等数据
   - 接收并执行服务器下发的命令

### 硬件环境信息格式

为了准确记录硬件环境，上报的`hardwareInfo`应包含以下字段：

```json
{
  "cpuModel": "CPU型号",
  "cpuCores": 8,
  "totalMemory": 16384,
  "platform": "操作系统平台",
  "hostname": "计算机名",
  "username": "用户名",
  "macAddresses": ["MAC地址1", "MAC地址2"],
  "biosSerial": "BIOS序列号",
  "displayResolution": "显示分辨率"
}
```

### 签名验证

签名验证过程使用RSA-SHA256算法：

1. 客户端获取挑战码
2. 使用私钥对挑战码进行签名
3. 将签名提交服务器进行验证

示例代码（Node.js）:
```javascript
const crypto = require('crypto');
const fs = require('fs');

// 从文件读取私钥
const privateKey = fs.readFileSync('private.key');

// 对挑战码进行签名
function signChallenge(challenge) {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(challenge);
  return sign.sign(privateKey, 'base64');
}
```

## 授权验证

本API使用JWT令牌进行授权，令牌携带在请求头的`Authorization`字段中：

```
Authorization: Bearer <token>
```

不同用户角色具有不同权限：
- `admin`: 所有操作
- `teacher`: 大部分管理操作，不包括删除学生和批量导入
- `student`: 仅可访问自己的数据和公共数据
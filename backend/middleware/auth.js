// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

// 身份验证中间件
const authenticate = (req, res, next) => {
  // 获取token
  const token = req.header('x-auth-token') || req.header('authorization')?.split(' ')[1];
  
  // 检查token是否存在
  if (!token) {
    return res.status(401).json({ error: '无访问权限，需要认证' });
  }
  
  try {
    // 验证token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 将用户ID添加到请求对象
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token无效' });
  }
};

module.exports = { authenticate };
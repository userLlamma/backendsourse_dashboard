// backend/routes/exportData.js
const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const { authenticate } = require('../middleware/auth');
const Excel = require('exceljs');

// 导出成绩 (仅教师/管理员)
router.get('/grades', authenticate, async (req, res) => {
  try {
    // 验证用户是否有权限
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    // 获取查询参数
    const format = req.query.format || 'csv'; // 支持csv和excel
    const weights = {
      testScore: parseFloat(req.query.testWeight || 0.8),
      participation: parseFloat(req.query.participationWeight || 0.2)
    };
    
    // 获取所有学生数据
    const students = await Student.find();
    
    // 处理成绩数据
    const gradesData = students.map(student => {
      // API测试得分 (默认为0)
      const testScore = student.lastTestResults ? student.lastTestResults.score : 0;
      const passRate = student.lastTestResults ? 
        (student.lastTestResults.totalPassed / 
          (student.lastTestResults.totalPassed + student.lastTestResults.totalFailed)) * 100 : 0;
      
      // 参与度得分 (基于最后活动时间和报告频率)
      const lastActivity = new Date(student.lastReportTime);
      const now = new Date();
      const daysSinceLastActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));
      const participationScore = Math.max(0, 100 - (daysSinceLastActivity * 10)); // 每天减10分，最低0分
      
      // 计算加权最终成绩
      const finalGrade = (
        (testScore * weights.testScore) + 
        (participationScore * weights.participation)
      );
      
      return {
        studentId: student.studentId,
        name: student.name,
        testScore,
        passedTests: student.lastTestResults ? student.lastTestResults.totalPassed : 0,
        totalTests: student.lastTestResults ? 
          (student.lastTestResults.totalPassed + student.lastTestResults.totalFailed) : 0,
        passRate: Math.round(passRate * 10) / 10,
        participationScore,
        lastActive: student.lastReportTime,
        apiVersion: student.apiVersion || '未知',
        todos: (student.todos || []).length,
        finalGrade: Math.round(finalGrade * 10) / 10, // 保留一位小数
      };
    });
    
    // 按最终成绩降序排序
    gradesData.sort((a, b) => b.finalGrade - a.finalGrade);
    
    // 根据请求的格式返回数据
    if (format === 'excel') {
      // 创建Excel工作簿和工作表
      const workbook = new Excel.Workbook();
      const worksheet = workbook.addWorksheet('API测试成绩');
      
      // 添加表头
      worksheet.columns = [
        { header: '学号', key: 'studentId', width: 15 },
        { header: '姓名', key: 'name', width: 15 },
        { header: 'API测试得分', key: 'testScore', width: 15 },
        { header: '测试通过率(%)', key: 'passRate', width: 15 },
        { header: '通过测试数', key: 'passedTests', width: 15 },
        { header: '测试总数', key: 'totalTests', width: 12 },
        { header: '参与度得分', key: 'participationScore', width: 12 },
        { header: '最终成绩', key: 'finalGrade', width: 12 },
        { header: 'API版本', key: 'apiVersion', width: 15 },
        { header: '待办项数量', key: 'todos', width: 12 },
        { header: '最后活动时间', key: 'lastActive', width: 20 }
      ];
      
      // 添加数据行
      gradesData.forEach((student, index) => {
        const row = worksheet.addRow(student);
        
        // 添加排名
        row.getCell(1).value = `${index + 1}. ${student.studentId}`;
        
        // 根据通过率设置颜色
        if (student.passRate >= 80) {
          row.getCell(4).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF92D050' } // 绿色
          };
        } else if (student.passRate >= 60) {
          row.getCell(4).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFCC00' } // 黄色
          };
        } else if (student.passRate > 0) {
          row.getCell(4).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFF7B7B' } // 红色
          };
        }
      });
      
      // 设置表头样式
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
      
      // 添加统计信息工作表
      const statsSheet = workbook.addWorksheet('统计信息');
      
      // 计算统计数据
      const avgTestScore = gradesData.reduce((sum, student) => sum + student.testScore, 0) / gradesData.length || 0;
      const avgPassRate = gradesData.reduce((sum, student) => sum + student.passRate, 0) / gradesData.length || 0;
      const totalStudents = gradesData.length;
      const activeStudents = gradesData.filter(s => s.participationScore > 0).length;
      const excellentStudents = gradesData.filter(s => s.finalGrade >= 80).length;
      
      // 添加统计数据
      statsSheet.columns = [
        { header: '统计项', key: 'stat', width: 25 },
        { header: '值', key: 'value', width: 15 }
      ];
      
      statsSheet.addRow({ stat: '学生总数', value: totalStudents });
      statsSheet.addRow({ stat: '活跃学生数', value: activeStudents });
      statsSheet.addRow({ stat: '优秀学生数 (80分以上)', value: excellentStudents });
      statsSheet.addRow({ stat: '平均API测试得分', value: Math.round(avgTestScore * 10) / 10 });
      statsSheet.addRow({ stat: '平均测试通过率', value: `${Math.round(avgPassRate * 10) / 10}%` });
      statsSheet.addRow({ stat: '导出时间', value: new Date().toLocaleString() });
      
      // 设置表头样式
      statsSheet.getRow(1).font = { bold: true };
      
      // 设置响应头
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=API_course_grades.xlsx');
      
      // 写入响应
      await workbook.xlsx.write(res);
      res.end();
    } else {
      // 默认返回CSV
      // 创建CSV表头
      let csv = '排名,学号,姓名,API测试得分,测试通过率(%),通过测试数,测试总数,参与度得分,最终成绩,API版本,最后活动时间\n';
      
      // 添加数据行
      gradesData.forEach((student, index) => {
        csv += `${index + 1},${student.studentId},${student.name},${student.testScore},${student.passRate.toFixed(1)},${student.passedTests},${student.totalTests},${student.participationScore},${student.finalGrade},${student.apiVersion},${new Date(student.lastActive).toLocaleString()}\n`;
      });
      
      // 设置响应头
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=API_course_grades.csv');
      
      // 返回CSV数据
      res.send(csv);
    }
  } catch (error) {
    console.error('导出成绩失败:', error);
    res.status(500).json({ error: '导出成绩失败' });
  }
});

module.exports = router;
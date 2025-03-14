// frontend/src/components/StudentHardwareHistory.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const StudentHardwareHistory = () => {
  const { studentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hardwareHistory, setHardwareHistory] = useState([]);
  const [selectedSignature, setSelectedSignature] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  
  useEffect(() => {
    fetchHardwareHistory();
  }, [studentId]);
  
  const fetchHardwareHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/students/${studentId}/hardware-history`);
      setHardwareHistory(response.data);
      setError(null);
    } catch (err) {
      setError('获取硬件历史记录失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const viewSignatureDetails = (signature) => {
    setSelectedSignature(signature);
    setShowDetails(true);
  };
  
  const flagAsSuspicious = async (signatureId, suspicious, reason) => {
    try {
      await axios.post(`/api/students/${studentId}/hardware/${signatureId}/flag`, {
        suspicious,
        reason: reason || "手动标记"
      });
      
      // 刷新数据
      fetchHardwareHistory();
      alert(suspicious ? "已标记为可疑" : "已取消可疑标记");
    } catch (err) {
      setError('操作失败');
      console.error(err);
    }
  };
  
  const compareSignatures = (signature1, signature2) => {
    // 列出硬件信息差异
    const differences = [];
    
    // 比较 CPU 信息
    if (signature1.signature.cpuModel !== signature2.signature.cpuModel) {
      differences.push({
        field: 'CPU 型号',
        value1: signature1.signature.cpuModel,
        value2: signature2.signature.cpuModel
      });
    }
    
    if (signature1.signature.cpuCores !== signature2.signature.cpuCores) {
      differences.push({
        field: 'CPU 核心数',
        value1: signature1.signature.cpuCores,
        value2: signature2.signature.cpuCores
      });
    }
    
    // 比较内存
    if (Math.abs(signature1.signature.totalMemory - signature2.signature.totalMemory) > 100) {
      differences.push({
        field: '内存大小',
        value1: `${Math.round(signature1.signature.totalMemory / 1024)} MB`,
        value2: `${Math.round(signature2.signature.totalMemory / 1024)} MB`
      });
    }
    
    // 比较主机名
    if (signature1.signature.hostname !== signature2.signature.hostname) {
      differences.push({
        field: '主机名',
        value1: signature1.signature.hostname,
        value2: signature2.signature.hostname
      });
    }
    
    // 比较用户名
    if (signature1.signature.username !== signature2.signature.username) {
      differences.push({
        field: '用户名',
        value1: signature1.signature.username,
        value2: signature2.signature.username
      });
    }
    
    // 比较网络接口和MAC地址
    const mac1 = signature1.signature.macAddresses || [];
    const mac2 = signature2.signature.macAddresses || [];
    
    if (JSON.stringify(mac1.sort()) !== JSON.stringify(mac2.sort())) {
      differences.push({
        field: 'MAC地址',
        value1: mac1.join(', '),
        value2: mac2.join(', ')
      });
    }
    
    return differences;
  };
  
  if (loading && hardwareHistory.length === 0) {
    return (
      <div className="d-flex justify-content-center my-3">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="ms-2">加载硬件历史记录中...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }
  
  if (hardwareHistory.length === 0) {
    return (
      <div className="alert alert-info" role="alert">
        该学生尚无硬件报告记录
      </div>
    );
  }
  
  return (
    <div className="card mb-4">
      <div className="card-header bg-primary text-white">
        <h5 className="mb-0">硬件环境历史</h5>
      </div>
      <div className="card-body">
        <p className="mb-3">
          系统记录了该学生每次认证时的硬件环境指纹，可用于检测潜在的代替完成情况。
        </p>
        
        {/* 硬件变更概览卡片 */}
        <div className="alert alert-info mb-4">
          <h6>硬件变更分析</h6>
          <div className="d-flex align-items-center">
            <div className="me-3">
              <strong>总报告次数:</strong> {hardwareHistory.length}
            </div>
            <div className="me-3">
              <strong>不同环境数:</strong> {new Set(hardwareHistory.map(h => h.signature.hostname)).size}
            </div>
            <div>
              <strong>可疑标记:</strong> {hardwareHistory.filter(h => h.suspicious).length}
            </div>
          </div>
        </div>
        
        {/* 硬件历史列表 */}
        <div className="table-responsive">
          <table className="table table-striped table-hover">
            <thead>
              <tr>
                <th>时间</th>
                <th>计算机名</th>
                <th>CPU</th>
                <th>内存</th>
                <th>MAC地址</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {hardwareHistory.map((item, index) => (
                <tr key={item._id} className={item.suspicious ? 'table-danger' : ''}>
                  <td>{new Date(item.timestamp).toLocaleString()}</td>
                  <td>{item.signature.hostname || '未知'}</td>
                  <td>{item.signature.cpuModel ? `${item.signature.cpuModel} (${item.signature.cpuCores}核)` : '未知'}</td>
                  <td>{item.signature.totalMemory ? `${Math.round(item.signature.totalMemory / 1024)} MB` : '未知'}</td>
                  <td>
                    {item.signature.macAddresses && item.signature.macAddresses.length > 0
                      ? `${item.signature.macAddresses[0]}${item.signature.macAddresses.length > 1 ? ' +' + (item.signature.macAddresses.length - 1) : ''}`
                      : '未知'}
                  </td>
                  <td>
                    {item.suspicious ? (
                      <span className="badge bg-danger">可疑</span>
                    ) : (
                      <span className="badge bg-success">正常</span>
                    )}
                  </td>
                  <td>
                    <button 
                      className="btn btn-sm btn-outline-primary me-1"
                      onClick={() => viewSignatureDetails(item)}
                    >
                      详情
                    </button>
                    
                    {index > 0 && (
                      <button 
                        className="btn btn-sm btn-outline-info me-1"
                        onClick={() => {
                          const diffs = compareSignatures(hardwareHistory[index-1], item);
                          setSelectedSignature({
                            ...item,
                            comparedWith: hardwareHistory[index-1],
                            differences: diffs
                          });
                          setShowDetails(true);
                        }}
                      >
                        与上次比较
                      </button>
                    )}
                    
                    <button 
                      className={`btn btn-sm ${item.suspicious ? 'btn-warning' : 'btn-danger'}`}
                      onClick={() => flagAsSuspicious(item._id, !item.suspicious)}
                    >
                      {item.suspicious ? '取消标记' : '标记可疑'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* 详情模态框 */}
        {showDetails && selectedSignature && (
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">硬件环境详情</h5>
                  <button type="button" className="btn-close" onClick={() => setShowDetails(false)}></button>
                </div>
                <div className="modal-body">
                  {selectedSignature.differences ? (
                    <div>
                      <h6>环境变更对比</h6>
                      <p>比较时间: {new Date(selectedSignature.comparedWith.timestamp).toLocaleString()} → {new Date(selectedSignature.timestamp).toLocaleString()}</p>
                      
                      {selectedSignature.differences.length === 0 ? (
                        <div className="alert alert-success">
                          未检测到显著变化
                        </div>
                      ) : (
                        <table className="table table-bordered">
                          <thead>
                            <tr>
                              <th>项目</th>
                              <th>上次值</th>
                              <th>本次值</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedSignature.differences.map((diff, idx) => (
                              <tr key={idx}>
                                <td><strong>{diff.field}</strong></td>
                                <td>{diff.value1 || '未知'}</td>
                                <td>{diff.value2 || '未知'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ) : (
                    <div>
                      <h6>基本信息</h6>
                      <table className="table table-bordered">
                        <tbody>
                          <tr>
                            <th>报告时间</th>
                            <td>{new Date(selectedSignature.timestamp).toLocaleString()}</td>
                          </tr>
                          <tr>
                            <th>IP地址</th>
                            <td>{selectedSignature.ipAddress || '未知'}</td>
                          </tr>
                          <tr>
                            <th>状态</th>
                            <td>
                              <span className={`badge bg-${selectedSignature.suspicious ? 'danger' : 'success'}`}>
                                {selectedSignature.suspicious ? '可疑' : '正常'}</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      
                      <h6 className="mt-4">硬件详情</h6>
                      <table className="table table-bordered">
                        <tbody>
                          <tr>
                            <th>平台</th>
                            <td>{selectedSignature.signature.platform || '未知'}</td>
                          </tr>
                          <tr>
                            <th>主机名</th>
                            <td>{selectedSignature.signature.hostname || '未知'}</td>
                          </tr>
                          <tr>
                            <th>用户名</th>
                            <td>{selectedSignature.signature.username || '未知'}</td>
                          </tr>
                          <tr>
                            <th>CPU型号</th>
                            <td>{selectedSignature.signature.cpuModel || '未知'}</td>
                          </tr>
                          <tr>
                            <th>CPU核心数</th>
                            <td>{selectedSignature.signature.cpuCores || '未知'}</td>
                          </tr>
                          <tr>
                            <th>内存大小</th>
                            <td>{selectedSignature.signature.totalMemory ? `${Math.round(selectedSignature.signature.totalMemory / 1024)} MB` : '未知'}</td>
                          </tr>
                          <tr>
                            <th>显示分辨率</th>
                            <td>{selectedSignature.signature.displayResolution || '未知'}</td>
                          </tr>
                          <tr>
                            <th>BIOS序列号</th>
                            <td>{selectedSignature.signature.biosSerial || '无数据'}</td>
                          </tr>
                          <tr>
                            <th>MAC地址</th>
                            <td>
                              {selectedSignature.signature.macAddresses && selectedSignature.signature.macAddresses.length > 0 ? (
                                <ul className="mb-0">
                                  {selectedSignature.signature.macAddresses.map((mac, idx) => (
                                    <li key={idx}>{mac}</li>
                                  ))}
                                </ul>
                              ) : '未知'}
                            </td>
                          </tr>
                          <tr>
                            <th>硬盘信息</th>
                            <td>
                              {selectedSignature.signature.diskLayout && selectedSignature.signature.diskLayout.length > 0 ? (
                                <ul className="mb-0">
                                  {selectedSignature.signature.diskLayout.map((disk, idx) => (
                                    <li key={idx}>
                                      {disk.type} {disk.size ? `(${Math.round(disk.size / 1024 / 1024 / 1024)} GB)` : ''} {disk.serialNum ? `S/N: ${disk.serialNum}` : ''}
                                    </li>
                                  ))}
                                </ul>
                              ) : '未知'}
                            </td>
                          </tr>
                          <tr>
                            <th>用户代理</th>
                            <td style={{ wordBreak: 'break-all' }}>{selectedSignature.signature.userAgent || '未知'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                  
                  {/* 添加可疑标记表单 */}
                  <div className="mt-4">
                    <h6>状态设置</h6>
                    <div className="d-flex">
                      <button 
                        className={`btn ${selectedSignature.suspicious ? 'btn-outline-success' : 'btn-success'} me-2`}
                        onClick={() => flagAsSuspicious(selectedSignature._id, false, "手动验证通过")}
                      >
                        标记为正常
                      </button>
                      <button 
                        className={`btn ${selectedSignature.suspicious ? 'btn-danger' : 'btn-outline-danger'}`}
                        onClick={() => flagAsSuspicious(selectedSignature._id, true, "手动标记可疑")}
                      >
                        标记为可疑
                      </button>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDetails(false)}>关闭</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentHardwareHistory;
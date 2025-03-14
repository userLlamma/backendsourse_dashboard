// frontend/src/components/StudentKeysManagement.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const StudentKeysManagement = () => {
  const { studentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [keys, setKeys] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  
  useEffect(() => {
    fetchKeys();
  }, [studentId]);
  
  const fetchKeys = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/students/${studentId}/keys`);
      setKeys(response.data);
      setError(null);
    } catch (err) {
      setError('获取公钥列表失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const revokeKey = async (keyId) => {
    try {
      setLoading(true);
      await axios.post(`/api/students/${studentId}/keys/${keyId}/revoke`, {
        reason: revokeReason || '教师手动吊销'
      });
      
      // 刷新数据
      fetchKeys();
      setShowRevokeModal(false);
      setRevokeReason('');
      alert("密钥已成功吊销");
    } catch (err) {
      setError('吊销密钥失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading && keys.length === 0) {
    return (
      <div className="d-flex justify-content-center my-3">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="ms-2">加载公钥列表中...</span>
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
  
  if (keys.length === 0) {
    return (
      <div className="alert alert-info" role="alert">
        该学生尚未注册任何公钥
      </div>
    );
  }
  
  return (
    <div className="card mb-4">
      <div className="card-header bg-primary text-white">
        <h5 className="mb-0">设备认证密钥</h5>
      </div>
      <div className="card-body">
        <p className="mb-3">
          系统记录了该学生注册的所有设备认证密钥，可用于身份验证。每个密钥通常对应一个设备环境。
        </p>
        
        {/* 密钥统计信息 */}
        <div className="alert alert-info mb-4">
          <h6>密钥统计</h6>
          <div className="d-flex align-items-center">
            <div className="me-3">
              <strong>总密钥数:</strong> {keys.length}
            </div>
            <div className="me-3">
              <strong>有效密钥:</strong> {keys.filter(k => !k.revoked?.isRevoked).length}
            </div>
            <div>
              <strong>已吊销:</strong> {keys.filter(k => k.revoked?.isRevoked).length}
            </div>
          </div>
        </div>
        
        {/* 密钥列表 */}
        <div className="table-responsive">
          <table className="table table-striped table-hover">
            <thead>
              <tr>
                <th>设备名称</th>
                <th>创建时间</th>
                <th>最后使用</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key._id} className={key.revoked?.isRevoked ? 'table-danger' : ''}>
                  <td>{key.name || '未命名设备'}</td>
                  <td>{new Date(key.createdAt).toLocaleString()}</td>
                  <td>{key.lastUsed ? new Date(key.lastUsed).toLocaleString() : '从未使用'}</td>
                  <td>
                    {key.revoked?.isRevoked ? (
                      <span className="badge bg-danger">已吊销</span>
                    ) : (
                      <span className="badge bg-success">有效</span>
                    )}
                  </td>
                  <td>
                    <button 
                      className="btn btn-sm btn-outline-primary me-1"
                      onClick={() => {
                        setSelectedKey(key);
                        setShowDetails(true);
                      }}
                    >
                      详情
                    </button>
                    
                    {!key.revoked?.isRevoked && (
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => {
                          setSelectedKey(key);
                          setShowRevokeModal(true);
                        }}
                      >
                        吊销
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* 密钥详情模态框 */}
        {showDetails && selectedKey && (
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">密钥详情</h5>
                  <button type="button" className="btn-close" onClick={() => setShowDetails(false)}></button>
                </div>
                <div className="modal-body">
                  <table className="table table-bordered">
                    <tbody>
                      <tr>
                        <th>设备名称</th>
                        <td>{selectedKey.name || '未命名设备'}</td>
                      </tr>
                      <tr>
                        <th>密钥ID</th>
                        <td>{selectedKey._id}</td>
                      </tr>
                      <tr>
                        <th>创建时间</th>
                        <td>{new Date(selectedKey.createdAt).toLocaleString()}</td>
                      </tr>
                      <tr>
                        <th>最后使用</th>
                        <td>{selectedKey.lastUsed ? new Date(selectedKey.lastUsed).toLocaleString() : '从未使用'}</td>
                      </tr>
                      <tr>
                        <th>状态</th>
                        <td>
                          {selectedKey.revoked?.isRevoked ? (
                            <span className="badge bg-danger">已吊销</span>
                          ) : (
                            <span className="badge bg-success">有效</span>
                          )}
                        </td>
                      </tr>
                      {selectedKey.revoked?.isRevoked && (
                        <>
                          <tr>
                            <th>吊销时间</th>
                            <td>{new Date(selectedKey.revoked.revokedAt).toLocaleString()}</td>
                          </tr>
                          <tr>
                            <th>吊销原因</th>
                            <td>{selectedKey.revoked.reason || '未提供原因'}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="modal-footer">
                  {!selectedKey.revoked?.isRevoked && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => {
                        setShowDetails(false);
                        setShowRevokeModal(true);
                      }}
                    >
                      吊销此密钥
                    </button>
                  )}
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDetails(false)}>关闭</button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 吊销密钥模态框 */}
        {showRevokeModal && selectedKey && (
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">吊销密钥</h5>
                  <button type="button" className="btn-close" onClick={() => setShowRevokeModal(false)}></button>
                </div>
                <div className="modal-body">
                  <div className="alert alert-warning">
                    <strong>警告:</strong> 吊销密钥后，该设备将无法再进行认证。学生需要重新生成新的密钥对才能继续使用。
                  </div>
                  
                  <p>确定要吊销以下密钥吗?</p>
                  <ul>
                    <li><strong>设备名称:</strong> {selectedKey.name || '未命名设备'}</li>
                    <li><strong>创建时间:</strong> {new Date(selectedKey.createdAt).toLocaleString()}</li>
                  </ul>
                  
                  <div className="mb-3">
                    <label htmlFor="revokeReason" className="form-label">吊销原因</label>
                    <textarea
                      className="form-control"
                      id="revokeReason"
                      rows="3"
                      value={revokeReason}
                      onChange={(e) => setRevokeReason(e.target.value)}
                      placeholder="请输入吊销该密钥的原因（可选）"
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowRevokeModal(false)}>取消</button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => revokeKey(selectedKey._id)}
                    disabled={loading}
                  >
                    {loading ? '处理中...' : '确认吊销'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentKeysManagement;
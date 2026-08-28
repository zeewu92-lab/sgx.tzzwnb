import { useState, useEffect } from 'react';

const CURRENT_VERSION = "1.0.24-cn"; 

export default function UpdateChecker() {
  const [showModal, setShowModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('updateDismissed');
    if (dismissed) return;

    fetch('/version.json', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.version !== CURRENT_VERSION) {
          setUpdateInfo(data);
          setShowModal(true);
        }
      })
      .catch(err => console.log('版本檢查失敗：', err));
  }, []);

  const handleUpdateNow = () => {
    window.open(updateInfo.apkUrl, '_blank');
  };

  const handleRemindLater = () => {
    sessionStorage.setItem('updateDismissed', 'true');
    setShowModal(false);
  };

  if (!showModal || !updateInfo) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>發現新版本</h3>
        <p style={{ margin: '0 0 8px', color: '#555', fontSize: '14px' }}>
          最新版本：{updateInfo.version}
        </p>
        {updateInfo.releaseNotes && (
          <p style={{ margin: '0 0 20px', color: '#777', fontSize: '13px' }}>
            {updateInfo.releaseNotes}
          </p>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleRemindLater} style={secondaryBtnStyle}>
            稍後提醒
          </button>
          <button onClick={handleUpdateNow} style={primaryBtnStyle}>
            立即更新
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const modalStyle = {
  background: '#fff',
  borderRadius: '12px',
  padding: '24px',
  width: '85%',
  maxWidth: '360px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
};

const primaryBtnStyle = {
  flex: 1,
  padding: '10px',
  borderRadius: '8px',
  border: 'none',
  background: '#111A2D',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryBtnStyle = {
  flex: 1,
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid #ddd',
  background: '#fff',
  color: '#333',
  cursor: 'pointer',
};

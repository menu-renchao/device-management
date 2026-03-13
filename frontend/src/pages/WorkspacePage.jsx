import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MyRequestsTab from '../components/workspace/MyRequestsTab';
import MyBorrowsTab from '../components/workspace/MyBorrowsTab';
import MyDevicesTab from '../components/workspace/MyDevicesTab';
import NotificationsTab from '../components/workspace/NotificationsTab';
import PendingApprovalsTab from '../components/workspace/PendingApprovalsTab';
import { AVAILABLE_WORKSPACE_TABS, getWorkspaceTab } from './workspacePageState';

const WorkspacePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const initialTab = getWorkspaceTab(tabFromUrl);
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const nextTab = getWorkspaceTab(tabFromUrl);
    if (tabFromUrl !== nextTab) {
      setSearchParams({ tab: nextTab }, { replace: true });
    }
    if (AVAILABLE_WORKSPACE_TABS.includes(nextTab)) {
      setActiveTab(nextTab);
      return;
    }
  }, [tabFromUrl, setSearchParams]);

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  const tabs = [
    { key: 'approvals', label: '待我审批', icon: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' },
    { key: 'requests', label: '我的申请', icon: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z' },
    { key: 'borrows', label: '我的借用', icon: 'M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z' },
    { key: 'devices', label: '我的设备', icon: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z' },
    { key: 'notifications', label: '系统通知', icon: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'approvals':
        return <PendingApprovalsTab />;
      case 'requests':
        return <MyRequestsTab />;
      case 'borrows':
        return <MyBorrowsTab />;
      case 'devices':
        return <MyDevicesTab />;
      case 'notifications':
        return <NotificationsTab />;
      default:
        return <PendingApprovalsTab />;
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>工作台</h2>
      <div style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.key ? styles.activeTab : {}),
            }}
          >
            <svg style={styles.tabIcon} viewBox="0 0 24 24" fill="none">
              <path d={tab.icon} fill="currentColor" />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>
      <div style={styles.content}>{renderContent()}</div>
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1D1D1F',
    margin: '0 0 24px 0',
  },
  tabsContainer: {
    display: 'flex',
    gap: '4px',
    marginBottom: '24px',
    backgroundColor: '#F2F2F7',
    padding: '4px',
    borderRadius: '10px',
    width: 'fit-content',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#86868B',
    transition: 'all 0.2s ease',
  },
  activeTab: {
    backgroundColor: 'white',
    color: '#007AFF',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
  },
  tabIcon: {
    width: '16px',
    height: '16px',
  },
  content: {
    minHeight: '400px',
  },
};

export default WorkspacePage;

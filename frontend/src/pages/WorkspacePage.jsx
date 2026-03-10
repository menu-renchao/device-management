import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MyBorrowsTab from '../components/workspace/MyBorrowsTab';
import MyDevicesTab from '../components/workspace/MyDevicesTab';
import MyRequestsTab from '../components/workspace/MyRequestsTab';
import NotificationsTab from '../components/workspace/NotificationsTab';
import PendingApprovalsTab from '../components/workspace/PendingApprovalsTab';
import PageShell from '../components/ui/PageShell';
import SectionGroup from '../components/ui/SectionGroup';
import SegmentedControl from '../components/ui/SegmentedControl';
import StatusBadge from '../components/ui/StatusBadge';

const TABS = [
  { key: 'approvals', label: '待我审核', tone: 'warning' },
  { key: 'requests', label: '我的申请', tone: 'info' },
  { key: 'borrows', label: '我的借用', tone: 'success' },
  { key: 'devices', label: '我的设备', tone: 'neutral' },
  { key: 'notifications', label: '系统通知', tone: 'info' },
];

const WorkspacePage = () => {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'approvals');

  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const currentTab = TABS.find((tab) => tab.key === activeTab) || TABS[0];

  return (
    <PageShell
      eyebrow="Workspace"
      title="工作台"
      subtitle="在一个入口里快速处理审批、借用、设备和通知。"
      actions={<StatusBadge tone={currentTab.tone}>{currentTab.label}</StatusBadge>}
    >
      <SectionGroup
        title="工作视图"
        description="保持高密度信息展示，同时统一为更安静的系统设置风格。"
        extra={<StatusBadge tone="neutral" dot={false}>{`5 ${'个分类'}`}</StatusBadge>}
      >
        <div style={styles.segmentWrap}>
          <SegmentedControl
            options={TABS.map((tab) => ({ value: tab.key, label: tab.label }))}
            value={activeTab}
            onChange={setActiveTab}
          />
        </div>
      </SectionGroup>

      <div style={styles.tabPanel}>{renderContent(activeTab)}</div>
    </PageShell>
  );
};

const renderContent = (activeTab) => {
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

const styles = {
  segmentWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 'var(--space-2)',
  },
  tabPanel: {
    minHeight: '400px',
  },
};

export default WorkspacePage;


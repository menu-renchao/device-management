import React from 'react';

const StatusBadge = ({ tone = 'neutral', dot = true, children, className = '' }) => {
  const classes = ['ui-status-badge', `ui-status-badge--${tone}`, className].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      {dot ? <span className="ui-status-badge__dot" aria-hidden="true" /> : null}
      <span>{children}</span>
    </span>
  );
};

export default StatusBadge;

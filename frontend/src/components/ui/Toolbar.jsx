import React from 'react';

const Toolbar = ({ left, right, className = '' }) => {
  const classes = ['ui-toolbar', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="ui-toolbar__group">{left}</div>
      <div className="ui-toolbar__group">{right}</div>
    </div>
  );
};

export default Toolbar;

import React from 'react';

const SectionGroup = ({ title, description, extra, children, className = '' }) => {
  const classes = ['ui-section-group', className].filter(Boolean).join(' ');

  return (
    <section className={classes}>
      {(title || description || extra) && (
        <header className="ui-section-group__header">
          <div className="ui-section-group__heading">
            {title ? <h2 className="ui-section-group__title">{title}</h2> : null}
            {description ? <p className="ui-section-group__description">{description}</p> : null}
          </div>
          {extra ? <div className="ui-section-group__extra">{extra}</div> : null}
        </header>
      )}
      <div className="ui-section-group__body">{children}</div>
    </section>
  );
};

export default SectionGroup;

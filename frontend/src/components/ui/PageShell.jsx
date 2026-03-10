import React from 'react';

const PageShell = ({ eyebrow, title, subtitle, actions, children, className = '' }) => {
  const classes = ['ui-page-shell', className].filter(Boolean).join(' ');

  return (
    <section className={classes}>
      {(eyebrow || title || subtitle || actions) && (
        <header className="ui-page-shell__header">
          <div className="ui-page-shell__heading">
            {eyebrow ? <span className="ui-page-shell__eyebrow">{eyebrow}</span> : null}
            {title ? <h1 className="ui-page-shell__title">{title}</h1> : null}
            {subtitle ? <p className="ui-page-shell__subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="ui-page-shell__actions">{actions}</div> : null}
        </header>
      )}
      <div className="ui-page-shell__content">{children}</div>
    </section>
  );
};

export default PageShell;

import React from 'react';

const Field = ({ label, helpText, error, htmlFor, children, className = '' }) => {
  const classes = ['ui-field', className].filter(Boolean).join(' ');

  const control = React.isValidElement(children)
    ? React.cloneElement(children, {
        id: children.props.id || htmlFor,
        className: ['ui-field__control', children.props.className].filter(Boolean).join(' '),
      })
    : children;

  return (
    <div className={classes}>
      {label ? (
        <label className="ui-field__label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {control}
      {error ? <div className="ui-field__error">{error}</div> : null}
      {!error && helpText ? <div className="ui-field__help">{helpText}</div> : null}
    </div>
  );
};

export default Field;

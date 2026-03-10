import React from 'react';

const SegmentedControl = ({ options, value, onChange, className = '' }) => {
  const classes = ['ui-segmented-control', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {options.map((option) => {
        const optionValue = option.value;
        const active = optionValue === value;

        return (
          <button
            key={optionValue}
            type="button"
            className={[
              'ui-segmented-control__item',
              active ? 'ui-segmented-control__item--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onChange(optionValue)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;

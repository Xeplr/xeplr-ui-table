import { currencySymbol, formatNumber } from './_helpers.js';

/**
 * config: { currency?: 'INR'|'USD'|..., position?: 'before'|'after', decimals?: number, bold?: boolean }
 */
export default function currency(config) {
  var code = (config && config.currency) || 'INR';
  var position = (config && config.position) || 'before';
  var decimals = config && typeof config.decimals === 'number' ? config.decimals : 0;
  var bold = config && config.bold !== false;
  var symbol = currencySymbol(code);
  return function cell(ctx) {
    var v = ctx.getValue();
    if (v === null || v === undefined || v === '') return null;
    var formatted = formatNumber(v, decimals);
    var className = 'xeplr-r-currency' + (bold ? ' xeplr-r-currency-bold' : '');
    return (
      <span className={className}>
        {position === 'before' && <span className="xeplr-r-currency-sym">{symbol}</span>}
        <span className="xeplr-r-currency-value">{formatted}</span>
        {position === 'after' && <span className="xeplr-r-currency-sym xeplr-r-currency-sym-after">{symbol}</span>}
      </span>
    );
  };
}

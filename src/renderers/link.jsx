/**
 * config: { onClick?: (row) => void, hrefKey?: string, target?: string }
 *
 * If `hrefKey` is set, renders an <a>. Otherwise a clickable span that calls onClick(row).
 */
export default function link(config) {
  var onClick = config && config.onClick;
  var hrefKey = config && config.hrefKey;
  var target = config && config.target;
  return function cell(ctx) {
    var label = ctx.getValue();
    if (label === null || label === undefined || label === '') return null;
    if (hrefKey) {
      var href = ctx.row.original[hrefKey];
      return <a className="xeplr-r-link" href={href} target={target}>{label}</a>;
    }
    return (
      <span
        className="xeplr-r-link"
        onClick={function() { if (onClick) onClick(ctx.row.original); }}
      >{label}</span>
    );
  };
}

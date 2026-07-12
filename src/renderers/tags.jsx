/**
 * config: { variant?: 'gold'|'muted'|'blue', max?: number }
 * Value: string[] (or string — split by comma)
 */
export default function tags(config) {
  var variant = (config && config.variant) || 'gold';
  var max = config && config.max;
  return function cell(ctx) {
    var value = ctx.getValue();
    if (!value) return null;
    var list = Array.isArray(value) ? value : String(value).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    var visible = max ? list.slice(0, max) : list;
    var overflow = max ? Math.max(list.length - max, 0) : 0;
    return (
      <div className="xeplr-r-tags">
        {visible.map(function(t, i) {
          return <span key={i} className={'xeplr-r-tag xeplr-r-tag-' + variant}>{t}</span>;
        })}
        {overflow > 0 && <span className="xeplr-r-tag-more">+{overflow}</span>}
      </div>
    );
  };
}

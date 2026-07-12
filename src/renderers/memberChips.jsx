import { initials, avatarTint } from './_helpers.js';

/**
 * config: { max?: number, nameKey?: string, imgKey?: string, imgPrefix?: string }
 * Value: Array<{ [nameKey]: string, [imgKey]?: string, ... }>
 */
export default function memberChips(config) {
  var max = (config && config.max) || 3;
  var nameKey = (config && config.nameKey) || 'name';
  var imgKey = config && config.imgKey;
  var imgPrefix = (config && config.imgPrefix) || '';
  return function cell(ctx) {
    var value = ctx.getValue();
    if (!Array.isArray(value) || value.length === 0) return null;
    var visible = value.slice(0, max);
    var overflow = Math.max(value.length - max, 0);
    return (
      <div className="xeplr-r-chips">
        {visible.map(function(item, i) {
          var name = item && item[nameKey] ? item[nameKey] : '';
          var img = imgKey && item ? item[imgKey] : null;
          return (
            <span key={i} className="xeplr-r-chip">
              {img
                ? <img className="xeplr-r-chip-avatar xeplr-r-chip-avatar-img" src={imgPrefix + img} alt="" />
                : <span className="xeplr-r-chip-avatar" style={{ background: avatarTint(name) }}>{initials(name)}</span>}
              <span className="xeplr-r-chip-name">{name}</span>
            </span>
          );
        })}
        {overflow > 0 && <span className="xeplr-r-chip-more">+{overflow}</span>}
      </div>
    );
  };
}

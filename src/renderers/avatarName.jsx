import { initials, avatarTint } from './_helpers.js';

/**
 * config: { subKey?: string, size?: 'sm'|'md', imgKey?: string, imgPrefix?: string }
 *
 * If `imgKey` is set and the row has a value for that key, render an <img>;
 * otherwise fall back to colored initials. `imgPrefix` is prepended to the
 * value so callers can pass relative filenames and a base URL once.
 */
export default function avatarName(config) {
  var subKey = config && config.subKey;
  var size = (config && config.size) || 'md';
  var imgKey = config && config.imgKey;
  var imgPrefix = (config && config.imgPrefix) || '';
  return function cell(ctx) {
    var name = ctx.getValue();
    var sub = subKey ? ctx.row.original[subKey] : null;
    var img = imgKey ? ctx.row.original[imgKey] : null;
    return (
      <div className={'xeplr-r-avatarname xeplr-r-avatarname-' + size}>
        {img
          ? <img className="xeplr-r-avatar xeplr-r-avatar-img" src={imgPrefix + img} alt="" />
          : <div className="xeplr-r-avatar" style={{ background: avatarTint(name) }}>{initials(name)}</div>}
        <div className="xeplr-r-avatarname-text">
          <div className="xeplr-r-avatarname-name">{name}</div>
          {sub && <div className="xeplr-r-avatarname-sub">{sub}</div>}
        </div>
      </div>
    );
  };
}

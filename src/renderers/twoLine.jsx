/**
 * config: { subKey?: string, primaryClass?: string }
 */
export default function twoLine(config) {
  var subKey = config && config.subKey;
  return function cell(ctx) {
    var primary = ctx.getValue();
    var sub = subKey ? ctx.row.original[subKey] : null;
    return (
      <div className="xeplr-r-twoline">
        <div className="xeplr-r-twoline-primary">{primary}</div>
        {sub && <div className="xeplr-r-twoline-sub">{sub}</div>}
      </div>
    );
  };
}

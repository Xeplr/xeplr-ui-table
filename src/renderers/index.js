import avatarName from './avatarName.jsx';
import tags from './tags.jsx';
import currency from './currency.jsx';
import memberChips from './memberChips.jsx';
import twoLine from './twoLine.jsx';
import statusBadge from './statusBadge.jsx';
import dateDisplay from './dateDisplay.jsx';
import link from './link.jsx';

var renderers = {
  avatarName: avatarName,
  tags: tags,
  currency: currency,
  memberChips: memberChips,
  twoLine: twoLine,
  statusBadge: statusBadge,
  dateDisplay: dateDisplay,
  link: link
};

export default renderers;
export { avatarName, tags, currency, memberChips, twoLine, statusBadge, dateDisplay, link };

// A string filter's ticks, as the boxes read — the Order number filter showed
// "No data" after Clear All then ticking one, and unticking one of all showed
// only that one.
import { toggleSelection, passesString, NONE } from '../src/filters/stringSelection.js';

var results = [];
function check(name, cond, detail) { results.push(cond); console.log((cond ? '  ok   ' : '  FAIL ') + name + (!cond && detail ? ' — ' + detail : '')); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
var ALL = ['GA2930', 'GA2931', 'GA2933'];

check('all ticked, untick one: the others stay', same(toggleSelection([], 'GA2931', ALL), ['GA2930', 'GA2933']));
check('after Clear All, tick one: that one', same(toggleSelection([NONE], 'GA2930', ALL), ['GA2930']));
check('…and it passes; others do not', passesString('GA2930', { selected: ['GA2930'], isNull: null }) && !passesString('GA2931', { selected: ['GA2930'], isNull: null }));
check('an old saved value with the marker still filters to what is ticked', passesString('GA2930', { selected: [NONE, 'GA2930'], isNull: null }));
check('untick the last: none', same(toggleSelection(['GA2930'], 'GA2930', ALL), [NONE]));
check('tick the last one back: all again', same(toggleSelection(['GA2930', 'GA2931'], 'GA2933', ALL), []));
check('no selection: everything passes', passesString('x', { selected: [], isNull: null }) && passesString('x', undefined));
check('Clear All: nothing passes', !passesString('GA2930', { selected: [NONE], isNull: null }));
check('Is Null / Is Not Null', passesString('', { selected: [], isNull: true }) && !passesString('A', { selected: [], isNull: true }) && !passesString(null, { selected: [], isNull: false }));

var failed = results.filter(function(r) { return !r; }).length;
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
if (failed) process.exit(1);

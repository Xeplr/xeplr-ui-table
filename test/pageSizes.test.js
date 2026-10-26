import assert from 'node:assert/strict';
import { pageSizeOptions } from '../src/pageSizes.js';

assert.deepEqual(pageSizeOptions(100), [100, 200, 500, 1000], 'a listed size leaves the menu alone');
assert.deepEqual(pageSizeOptions(10), [10, 100, 200, 500, 1000], 'the size in use is always offered');
assert.deepEqual(pageSizeOptions(250), [100, 200, 250, 500, 1000], 'in order');
assert.deepEqual(pageSizeOptions(undefined), [100, 200, 500, 1000]);
console.log('pageSizes: ok');

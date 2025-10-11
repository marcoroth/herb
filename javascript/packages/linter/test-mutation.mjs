import { Herb } from '@herb-tools/node-wasm';

await Herb.load();

const source = '<DIV>Hello</DIV>';
const result = Herb.parse(source, { track_whitespace: true });

const openTag = result.value.children[0].open_tag;
const tagName = openTag.tag_name;

console.log('Original value:', tagName.value);
console.log('Is frozen?:', Object.isFrozen(tagName));
console.log('Is sealed?:', Object.isSealed(tagName));
console.log('Property descriptor:', Object.getOwnPropertyDescriptor(tagName, 'value'));

try {
  tagName.value = 'span';
  console.log('After mutation:', tagName.value);
  console.log('Mutation worked:', tagName.value === 'span');
} catch (e) {
  console.log('Mutation failed:', e.message);
}

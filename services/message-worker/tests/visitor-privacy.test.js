import assert from 'node:assert/strict';
import {test} from 'node:test';
import {redactNames} from '../src/visitor-privacy.js';
test('redaction escapes name punctuation, preserves ordinary words, and never replaces inside generated aliases',()=>{
 assert.equal(redactNames('A+B met A+B.',[{name:'A+B',alias:'Titan-000002'}]),'Titan-000002 met Titan-000002.');
 assert.equal(redactNames('Alice met Bob.',[{name:'Alice',alias:'Titan-000002'},{name:'Bob',alias:'Dione-000003'},{name:'T',alias:'Rhea-000004'}]),'Titan-000002 met Dione-000003.');
 assert.equal(redactNames('小明喜欢蘑菇。',[{name:'小明',alias:'Mimas-000006'}]),'Mimas-000006喜欢蘑菇。');
});

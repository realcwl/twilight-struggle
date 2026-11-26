import assert from 'node:assert/strict';
import {test} from 'node:test';
import {highlight} from '../cards/terms.js';
import catalog from '../cards/catalog.json';

test('card references stay intact and country aliases link to canonical map nodes',()=>{
  const html=highlight('在伊朗和老挝/柬埔寨增加影响力。《古巴导弹危机》取消本事件。');
  assert.match(html,/data-country-ref="irn"/);
  assert.match(html,/data-country-ref="lao"/);
  assert.match(html,/data-card-ref="040"[^>]*>《古巴导弹危机》<\/span>/);
  assert.equal((html.match(/data-country-ref=/g)??[]).length,2);
  assert.match(html,/data-term="influence"/);
});
test('all referenced titles in the catalog resolve; preview copy has no nested controls',()=>{
  for(const c of catalog){
    const text=[c.prerequisiteZh,...c.effectsZh,c.noteZh].join(' ');
    const html=highlight(text);
    assert.equal((html.match(/data-card-ref=/g)??[]).length,(text.match(/《[^》]*》/g)??[]).length,c.titleZh);
    assert.doesNotMatch(highlight(text,{interactive:false}),/data-(?:term|country-ref|card-ref)=/);
    assert.equal(html.replace(/<[^>]*>/g,''),text);
  }
});
test('reference and glossary markup escapes untrusted text',()=>{
  const html=highlight('<img src=x onerror="x">伊朗 & 《泥潭》');
  assert.doesNotMatch(html,/<img/);
  assert.match(html,/&lt;img/);
  assert.match(html,/&amp;/);
});

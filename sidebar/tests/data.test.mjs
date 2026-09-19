import assert from 'node:assert/strict';
import {test} from 'node:test';
import {demo,validate,progress} from '../src/data.js';
test('validate import and calculate recorded progress',()=>{
 assert.equal(validate(demo),demo);assert.deepEqual(progress(demo.tasks),{done:3,total:5,unknown:0});
 assert.deepEqual(progress([{status:'cancelled'},{status:'unknown'},{status:'done'}]),{done:1,total:1,unknown:1});
 assert.throws(()=>validate({...demo,tasks:[{...demo.tasks[0],status:'invented'}]}));
 assert.throws(()=>validate({...demo,notes:[demo.notes[0],demo.notes[0]]}));
 assert.throws(()=>validate({...demo,exported_at:'bad'}));
});

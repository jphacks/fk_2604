/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const ts=require('typescript');

function styles(text){
  const source=ts.createSourceFile('page.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const result=[];
  function visit(node){
    if(ts.isJsxAttribute(node)&&node.name.getText(source)==='className')result.push(node.initializer.getText(source));
    ts.forEachChild(node,visit);
  }
  visit(source);return result;
}

test('UI: both existing TOTP pages retain every original style and shared form unchanged',()=>{
  for(const page of ['src/app/(auth)/signup/totp/page.tsx','src/app/(auth)/login/verify/page.tsx']){
    const original=execFileSync('git',['show','HEAD:'+page],{encoding:'utf8'});
    const current=fs.readFileSync(page,'utf8');
    assert.deepEqual(styles(current),styles(original),page);
    for(const component of ['Card','CardDescription','CardHeader','CardTitle','TotpCodeForm']){
      const pattern=new RegExp('<'+component+'(?:\\s|>)','g');
      assert.equal((current.match(pattern)||[]).length,(original.match(pattern)||[]).length,page+' '+component);
    }
  }
  const shared='src/app/(auth)/_components/totp-code-form.tsx';
  assert.equal(fs.readFileSync(shared,'utf8').replaceAll('\r\n','\n'),execFileSync('git',['show','HEAD:'+shared],{encoding:'utf8'}).replaceAll('\r\n','\n'));
  const changed=execFileSync('git',['diff','--name-only','HEAD','--','src/components','src/hooks','*.css','*tailwind*'],{encoding:'utf8'}).trim();
  assert.equal(changed,'');
});

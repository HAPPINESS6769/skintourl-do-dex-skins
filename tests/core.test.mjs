import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {configFromLocation,inspectPNG,sha256,urlsFor,githubRequest,connectAccount,uploadPNG,verifyPNG} from '../core.js';
const png=new Uint8Array(await fs.readFile(new URL('../skins/2258fe98de19ee34ec6c001e8e41fdcad939d73c07f4b99b2a090d84acef9e62.png',import.meta.url)));
const config=configFromLocation({hostname:'happiness6769.github.io',pathname:'/skintourl-do-dex-skins/'});
const hash=await sha256(png),filename=hash.slice(0,24)+'.png';
const response=(body,status=200,headers={})=>new Response(typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body),{status,headers});
test('usa o proprietário atual do endereço e produz URLs PNG curtas',()=>{
 assert.equal(config.owner,'happiness6769');assert.equal(config.repo,'skintourl-do-dex-skins');
 const links=urlsFor(config,filename);assert.ok(links.pages.length<128);assert.ok(links.raw.length<255);assert.ok(links.pages.endsWith('.png'));
 assert.throws(()=>urlsFor(config,'../data.png'));
});
test('PNG válido é preservado, arquivos inválidos são rejeitados',()=>{
 assert.equal(inspectPNG(png).width,64);assert.equal(inspectPNG(png).height,64);
 assert.throws(()=>inspectPNG(new TextEncoder().encode('<html>page</html>')));
 assert.throws(()=>inspectPNG(png.slice(0,-1)));const corrupted=png.slice();corrupted[50]^=1;assert.throws(()=>inspectPNG(corrupted));
 assert.throws(()=>inspectPNG(new Uint8Array(2*1024*1024+1)));
});
test('conexão exige repositório público e escrita',async()=>{
 await connectAccount(config,'test-credential',async()=>response({private:false,permissions:{push:true},default_branch:'main'}));
 await assert.rejects(()=>connectAccount(config,'test-credential',async()=>response({private:true,permissions:{push:true}})));
 await assert.rejects(()=>connectAccount(config,'test-credential',async()=>response({private:false,permissions:{push:false}})));
});
test('upload envia somente PNG e usa autenticação somente na API GitHub',async()=>{
 const calls=[];
 const result=await uploadPNG(config,'test-credential',png,async(url,options)=>{calls.push([url,options]);return options.method==='GET'?response({},404):response({commit:{sha:'x'}},201);});
 assert.equal(result.filename,filename);assert.equal(calls.length,2);
 const [url,options]=calls[1];assert.ok(url.startsWith('https://api.github.com/repos/happiness6769/'));assert.equal(options.method,'PUT');assert.equal(options.redirect,'error');
 assert.equal(options.headers.Authorization,'Bearer test-credential');const body=JSON.parse(options.body);
 assert.deepEqual(Buffer.from(body.content,'base64'),Buffer.from(png));assert.equal(body.branch,'main');assert.equal(options.body.includes('test-credential'),false);
});
test('duplicatas não são regravadas e colisões não substituem arquivos',async()=>{
 const gitHash=createHash('sha1').update(Buffer.from(`blob ${png.length}\0`)).update(png).digest('hex');
 let requests=0;const result=await uploadPNG(config,'test-credential',png,async()=>{requests++;return response({sha:gitHash});});
 assert.equal(requests,1);assert.equal(result.duplicate,true);
 await assert.rejects(()=>uploadPNG(config,'test-credential',png,async()=>response({sha:'different'})));
});
test('link precisa responder PNG com bytes e dimensões corretos, sem autenticação',async()=>{
 const url=urlsFor(config,filename).pages;
 const result=await verifyPNG(url,hash,async(request,options)=>{assert.equal(request,url);assert.equal(options.credentials,'omit');assert.equal(options.headers,undefined);return response(png,200,{'Content-Type':'image/png'});});
 assert.equal(result.ok,true);assert.equal(result.hash,hash);assert.equal(result.width,64);
 for(const [body,status,headers] of [[png,404,{'Content-Type':'image/png'}],['<html>Not Found</html>',200,{'Content-Type':'text/html'}],[png,200,{'Content-Type':'image/png','Content-Length':'9999999'}]]){
  assert.equal((await verifyPNG(url,hash,async()=>response(body,status,headers))).ok,false);
 }
 assert.equal((await verifyPNG(url,'0'.repeat(64),async()=>response(png,200,{'Content-Type':'image/png'}))).ok,false);
});
test('páginas, localhost, blob e links com token não são aceitos como PNG',async()=>{
 for(const url of [config.base,'http://localhost:8765/skin.png','blob:https://example.com/a',urlsFor(config,filename).pages+'?token=secret','https://github.com/owner/repo/blob/main/skin.png'])await assert.rejects(()=>verifyPNG(url));
});
test('erros de autenticação e de rede têm mensagem utilizável',async()=>{
 await assert.rejects(()=>githubRequest(config,'',{fetcher:async()=>response({},401)}),/Token inválido/);
 await assert.rejects(()=>githubRequest(config,'',{fetcher:async()=>{throw new Error('network');}}),/conexão/);
});

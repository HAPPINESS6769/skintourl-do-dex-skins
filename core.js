export const VERSION = '2.0.0';
export const MAX_BYTES = 2 * 1024 * 1024;
export function configFromLocation(location) {
  const hosted = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname || '');
  const owner = hosted ? hosted[1] : 'happiness6769';
  const repo = hosted ? location.pathname.split('/').filter(Boolean)[0] || `${owner}.github.io` : 'skintourl-do-dex-skins';
  if (!/^[a-z0-9-]+$/i.test(owner) || !/^[a-z0-9_.-]+$/i.test(repo)) throw new Error('Endereço do site inválido.');
  return {owner, repo, branch:'main', base:`https://${owner}.github.io/${repo.toLowerCase() === `${owner}.github.io` ? '' : repo + '/'}`};
}
export async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2,'0')).join('');
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit=0; bit<8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
export function inspectPNG(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('Use um PNG de até 2 MB.');
  if (![137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) throw new Error('O arquivo não é PNG. Escolha a textura original da skin.');
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let offset=8, width=0, height=0, image=false, end=false, palette=false, color;
  while (offset+12 <= bytes.length) {
    const size=view.getUint32(offset), next=offset+size+12;
    if (next>bytes.length) throw new Error('O PNG está incompleto.');
    const type=String.fromCharCode(...bytes.slice(offset+4,offset+8));
    if (view.getUint32(next-4) !== crc32(bytes.subarray(offset+4,next-4))) throw new Error('O PNG está corrompido. Exporte a skin novamente.');
    if (offset===8 && (type!=='IHDR' || size!==13)) throw new Error('Cabeçalho PNG inválido.');
    if (type==='IHDR') {
      if(offset!==8 || size!==13) throw new Error('Cabeçalho PNG inválido.');
      width=view.getUint32(offset+8); height=view.getUint32(offset+12);
      if (width!==64 || ![32,64].includes(height)) throw new Error('Use uma skin humanoide de 64 × 64 ou 64 × 32 pixels.');
      const depth=bytes[offset+16]; color=bytes[offset+17];
      const allowed={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
      if(!allowed[color]?.includes(depth) || bytes[offset+18] || bytes[offset+19] || bytes[offset+20]>1) throw new Error('Formato PNG inválido.');
    }
    if(type==='acTL') throw new Error('Use uma skin PNG estática, sem animação.');
    if(type==='PLTE') palette=true;
    if(type==='IDAT') image=true;
    if(type==='IEND') { if(size || next!==bytes.length) throw new Error('Final do PNG inválido.'); end=true; break; }
    offset=next;
  }
  if (!image || !end || (color===3 && !palette)) throw new Error('O PNG não contém uma imagem completa.');
  return {width,height,bytes};
}
export function urlsFor(config, filename) {
  if(!/^[a-f0-9]{24}(?:[a-f0-9]{40})?\.png$/.test(filename)) throw new Error('Nome de skin inválido.');
  return {pages:config.base+'skins/'+filename,
    raw:`https://raw.githubusercontent.com/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/skins/${filename}`};
}
export async function githubRequest(config,path,{token='',method='GET',body,fetcher=fetch}={}) {
  const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  if(token) headers.Authorization='Bearer '+token;
  if(body) headers['Content-Type']='application/json';
  let response;
  try { response=await fetcher(`https://api.github.com/repos/${config.owner}/${config.repo}${path}`,{method,headers,body:body?JSON.stringify(body):undefined,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(30000)}); }
  catch { throw new Error('Não foi possível acessar o GitHub. Confira sua conexão e tente novamente.'); }
  if(response.status===404 && method==='GET') return null;
  if(!response.ok) {
    const errors={401:'Token inválido ou expirado. Conecte sua conta novamente.',403:'Sem permissão de escrita ou limite do GitHub atingido. Confira Contents: Read and write e tente mais tarde.',409:'O repositório mudou durante o envio. Tente publicar novamente.',422:'O GitHub não aceitou o envio. Confira a branch e as permissões.'};
    throw new Error(errors[response.status] || `GitHub retornou HTTP ${response.status}.`);
  }
  return response.json();
}
export async function connectAccount(config,token,fetcher=fetch) {
  if(!token || token.length>512 || /\s/.test(token)) throw new Error('Informe um token GitHub válido.');
  const repo=await githubRequest(config,'',{token,fetcher});
  if(!repo || repo.private!==false || !repo.permissions?.push) throw new Error('Esta conta precisa ter acesso de escrita ao repositório público deste site.');
  if(repo.default_branch!==config.branch) throw new Error(`Este site publica pela branch ${config.branch}. Confira a configuração do repositório.`);
  return true;
}
export async function uploadPNG(config,token,bytes,fetcher=fetch) {
  inspectPNG(bytes);
  const hash=await sha256(bytes), filename=hash.slice(0,24)+'.png';
  const path='/contents/skins/'+filename;
  const existing=await githubRequest(config,path+'?ref='+encodeURIComponent(config.branch),{token,fetcher});
  if(existing) {
    const header=new TextEncoder().encode(`blob ${bytes.byteLength}\0`);
    const blob=new Uint8Array(header.length+bytes.byteLength);blob.set(header);blob.set(new Uint8Array(bytes),header.length);
    const expected=[...new Uint8Array(await crypto.subtle.digest('SHA-1',blob))].map(v=>v.toString(16).padStart(2,'0')).join('');
    if(existing.sha!==expected) throw new Error('Existe outro arquivo com esse nome. Nenhum arquivo foi substituído.');
    return {hash,filename,duplicate:true,...urlsFor(config,filename)};
  }
  let binary=''; for(let offset=0;offset<bytes.byteLength;offset+=8192) binary+=String.fromCharCode(...new Uint8Array(bytes).subarray(offset,offset+8192));
  await githubRequest(config,path,{token,method:'PUT',body:{message:'Publica skin '+hash.slice(0,12),content:btoa(binary),branch:config.branch},fetcher});
  return {hash,filename,duplicate:false,...urlsFor(config,filename)};
}
export async function verifyPNG(url,expectedHash='',fetcher=fetch) {
  const parsed=new URL(url);
  const trusted=parsed.protocol==='https:' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash &&
    (parsed.hostname.endsWith('.github.io') || parsed.hostname==='raw.githubusercontent.com') && /\/skins\/[a-f0-9]{24}(?:[a-f0-9]{40})?\.png$/.test(parsed.pathname);
  if(!trusted) throw new Error('Use o link direto .png gerado pelo site, não o endereço da página.');
  let response;
  try { response=await fetcher(url,{cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)}); }
  catch { return {ok:false,reason:'A imagem ainda não respondeu. Tente verificar novamente.'}; }
  if(!response.ok) return {ok:false,reason:`PNG ainda indisponível (HTTP ${response.status}). Aguarde a publicação.`};
  if(!(response.headers.get('content-type')||'').toLowerCase().startsWith('image/png')) return {ok:false,reason:'O endereço retornou uma página, não uma imagem PNG.'};
  const announced=Number(response.headers.get('content-length'));
  if(announced>MAX_BYTES) return {ok:false,reason:'Imagem maior que 2 MB.'};
  const bytes=new Uint8Array(await response.arrayBuffer());
  let dimensions;try { dimensions=inspectPNG(bytes); } catch(error) { return {ok:false,reason:error.message}; }
  if(typeof createImageBitmap==='function'){try{const image=await createImageBitmap(new Blob([bytes],{type:'image/png'}));image.close();}catch{return {ok:false,reason:'O PNG não pôde ser decodificado como imagem.'};}}
  const hash=await sha256(bytes);
  const filename=parsed.pathname.split('/').pop().slice(0,-4);
  if((expectedHash && hash!==expectedHash) || !hash.startsWith(filename)) return {ok:false,reason:'O conteúdo baixado não corresponde à skin selecionada.'};
  return {ok:true,url,hash,width:dimensions.width,height:dimensions.height,bytes:bytes.byteLength};
}

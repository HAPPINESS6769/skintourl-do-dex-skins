import {configFromLocation,inspectPNG,sha256,urlsFor,githubRequest,connectAccount,uploadPNG,verifyPNG} from './core.js?v=2.0.0';
const $=id=>document.getElementById(id), config=configFromLocation(location);
let accessToken='', selection=null, busy=false, previewURL='', generation=0, toastTimer, results={};
const target=`${config.owner}/${config.repo}`;
$('repo-name').textContent=target; $('connect-repo').textContent=target;
$('repo-link').href=`https://github.com/${target}`;
$('github-upload').href=`https://github.com/${target}/upload/${config.branch}/skins`;
function notify(message,error=false){$('toast').textContent=message;$('toast').className=error?'error':'';$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,error?8000:4500);}
function status(message,type=''){$('result-status').textContent=message;$('result-status').className='result-status '+type;}
function controls(){
  $('choose').disabled=busy;$('publish').disabled=busy||!selection?.bytes;
  $('publish').textContent=busy?'Processando…':'Publicar skin no GitHub';
  $('download-ready').disabled=busy||!selection?.bytes;
  $('verify').disabled=busy||!selection;
  $('account-button').disabled=busy;
}
function clearResult(){results={};$('npc-url').value='';$('copy-url').disabled=true;$('open-image').hidden=true;$('open-image').removeAttribute('href');$('alternative').hidden=true;$('alternative-url').value='';$('copy-alternative').disabled=true;}
function showResults(){
  const best=results.pages?.ok?results.pages:results.raw?.ok?results.raw:null;
  const alternate=results.pages?.ok&&results.raw?.ok?results.raw:null;
  if(!best){clearResult();status('O PNG ainda não está público. Publique a skin e verifique novamente.','error');return false;}
  $('npc-url').value=best.url;$('copy-url').disabled=false;$('open-image').href=best.url;$('open-image').hidden=false;
  $('result-heading').textContent='PNG público verificado.';
  status(`${best.width} × ${best.height} pixels · ${best.url.length} caracteres · ${results.pages?.ok?'GitHub Pages':'GitHub Raw (Pages ainda indisponível)'}. Cole esta URL no NPC.`,'ready');
  $('alternative').hidden=!alternate;$('alternative-url').value=alternate?.url||'';$('copy-alternative').disabled=!alternate;
  return true;
}
async function decode(bytes){const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));bitmap.close();}
async function pick(file){
  if(!file||busy)return;
  const seq=++generation;clearResult();selection=null;controls();$('selection').hidden=true;
  try{
    const bytes=new Uint8Array(await file.arrayBuffer()), info=inspectPNG(bytes);await decode(bytes);
    const hash=await sha256(bytes);if(seq!==generation)return;
    if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));
    selection={bytes,hash,filename:hash.slice(0,24)+'.png',name:file.name,...info};
    $('preview').src=previewURL;$('file-name').textContent=file.name;$('file-meta').textContent=`${info.width} × ${info.height} pixels · ${(bytes.length/1024).toFixed(1)} KB`;$('selection').hidden=false;
    $('result-heading').textContent='Pronta para publicar.';status('Sua skin está apenas nesta aba. Publique no GitHub para gerar o link público.');
    controls();
  }catch(error){notify(error.message||'Não foi possível abrir esse PNG.',true);status('Escolha uma textura PNG válida.','error');controls();}
  finally{$('file').value='';}
}
$('choose').onclick=()=>$('file').click();$('file').onchange=e=>pick(e.target.files[0]);
for(const type of ['dragenter','dragover'])$('dropzone').addEventListener(type,e=>{e.preventDefault();$('dropzone').classList.add('dragging');});
$('dropzone').addEventListener('dragleave',e=>{if(!$('dropzone').contains(e.relatedTarget))$('dropzone').classList.remove('dragging');});
$('dropzone').addEventListener('drop',e=>{e.preventDefault();$('dropzone').classList.remove('dragging');if(e.dataTransfer.files.length!==1)return notify('Envie uma skin por vez.',true);pick(e.dataTransfer.files[0]);});
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
function accountUI(){$('account-button').textContent=accessToken?'Conta conectada':'Conectar GitHub';$('account-status').textContent=accessToken?'Conectado nesta aba · pronto para publicar':'Conecte para publicar • links abrem sem login';$('disconnect').hidden=!accessToken;}
function connectDialog(){$('connect-error').textContent='';$('access-token').value='';$('connect-dialog').showModal();}
$('account-button').onclick=connectDialog;$('close-connect').onclick=()=>$('connect-dialog').close();
$('connect-dialog').addEventListener('close',()=>$('access-token').value='');
$('connect-form').onsubmit=async e=>{
  e.preventDefault();$('connect-submit').disabled=true;$('connect-error').textContent='';
  let candidate=$('access-token').value.trim();$('access-token').value='';
  try{await connectAccount(config,candidate);accessToken=candidate;accountUI();$('connect-dialog').close();notify('Conectado. Clique em Publicar skin para enviar o PNG.');}
  catch(error){$('connect-error').textContent=error.message;}
  finally{candidate='';$('connect-submit').disabled=false;}
};
$('disconnect').onclick=()=>{accessToken='';accountUI();$('connect-dialog').close();notify('Desconectado. As skins públicas continuam disponíveis.');};
async function checkSelection(){
  if(!selection)return false;
  const snapshot=selection, urls=urlsFor(config,snapshot.filename);
  const checked=await Promise.allSettled([verifyPNG(urls.pages,snapshot.hash||''),verifyPNG(urls.raw,snapshot.hash||'')]);
  if(selection!==snapshot)return false;
  results={pages:checked[0].status==='fulfilled'?checked[0].value:{ok:false},raw:checked[1].status==='fulfilled'?checked[1].value:{ok:false}};
  return showResults();
}
$('publish').onclick=async()=>{
  if(!selection?.bytes||busy)return;
  if(!accessToken)return connectDialog();
  busy=true;controls();clearResult();status('Enviando somente este PNG para o repositório público…');
  try{
    const published=await uploadPNG(config,accessToken,selection.bytes);selection.filename=published.filename;
    status(published.duplicate?'A skin já está no GitHub. Conferindo o link…':'PNG enviado. Conferindo o link público…');
    for(let attempt=0;attempt<8;attempt++){
      if(await checkSelection()){notify('Skin publicada e link verificado. Copie a URL para o NPC.');loadGallery();return;}
      status('O GitHub está disponibilizando o PNG. Aguarde…');await new Promise(r=>setTimeout(r,4000));
    }
    status('Envio concluído. O GitHub ainda está disponibilizando o arquivo. Use Verificar publicação em alguns minutos.');
  }catch(error){status(error.message,'error');notify(error.message,true);}
  finally{busy=false;controls();}
};
$('verify').onclick=async()=>{if(busy||!selection)return;busy=true;controls();status('Baixando e conferindo a imagem pública…');try{await checkSelection();}catch(error){status(error.message,'error');}finally{busy=false;controls();}};
async function copy(input){if(!input.value)return;try{await navigator.clipboard.writeText(input.value);notify('URL direta copiada. Cole no campo de skin por URL do NPC.');}catch{input.focus();input.select();notify('Link selecionado. Use Ctrl+C para copiar.');}}
$('copy-url').onclick=()=>copy($('npc-url'));$('copy-alternative').onclick=()=>copy($('alternative-url'));
$('download-ready').onclick=()=>{if(!selection?.bytes)return;const link=document.createElement('a');link.href=previewURL;link.download=selection.filename;link.click();notify('Envie esse PNG na pasta skins do GitHub e depois verifique a publicação.');};
let loadingGallery=false;
async function loadGallery(){
  if(loadingGallery)return;loadingGallery=true;$('refresh').disabled=true;$('gallery-status').textContent='Carregando coleção…';
  try{
    const listing=await githubRequest(config,'/contents/skins?ref='+config.branch);
    const files=(Array.isArray(listing)?listing:[]).filter(f=>f.type==='file'&&/^[a-f0-9]{24}(?:[a-f0-9]{40})?\.png$/.test(f.name));
    const short=new Set(files.filter(f=>f.name.length===28).map(f=>f.name.slice(0,24)));
    const visible=files.filter(f=>f.name.length===28||!short.has(f.name.slice(0,24))).slice(0,120);
    $('count').textContent=visible.length;$('gallery').replaceChildren();
    $('gallery-status').textContent=visible.length?'Clique em Verificar e usar. Os links são conferidos antes da cópia.':'Nenhuma skin publicada ainda. Escolha um PNG acima.';
    for(const file of visible){
      const card=document.createElement('button');card.className='skin-card';card.type='button';
      const img=document.createElement('img');img.alt='Textura da skin publicada';img.loading='lazy';img.src=urlsFor(config,file.name).raw;
      const name=document.createElement('strong');name.textContent=file.name.startsWith('2258fe98de19ee34ec6c001e')?'Amostra roxa de teste':file.name.slice(0,12)+'…';
      const detail=document.createElement('small');detail.textContent='Verificar e usar no NPC ↗';
      card.append(img,name,detail);card.onclick=async()=>{
        if(busy)return;generation++;selection={filename:file.name,hash:file.name.length===68?file.name.slice(0,-4):'',bytes:null};
        clearResult();$('selection').hidden=true;busy=true;controls();status('Verificando PNG, tamanho e acesso público…');
        try{await checkSelection();$('result-heading').scrollIntoView({behavior:'smooth',block:'center'});}catch(error){status(error.message,'error');}finally{busy=false;controls();}
      };$('gallery').append(card);
    }
  }catch(error){$('gallery-status').textContent=error.message+' Os links diretos já publicados continuam independentes da listagem.';}
  finally{loadingGallery=false;$('refresh').disabled=false;}
}
$('refresh').onclick=loadGallery;accountUI();controls();loadGallery();

'use strict';
(async () => {
  const loading = document.getElementById('loading'), gallery = document.getElementById('gallery');
  try {
    const response = await fetch('https://api.github.com/repos/JOCASFODAS/skintourl-do-dex-skins/contents/skins?ref=main', {headers:{Accept:'application/vnd.github+json'}});
    if (!response.ok) throw new Error('Coleção indisponível no momento. Os links diretos já publicados continuam independentes desta listagem.');
    const files = (await response.json()).filter(f => f.type === 'file' && /^[a-f0-9]{64}\.png$/.test(f.name)).slice(0,120);
    loading.textContent = files.length ? `${files.length} skin(s) nesta página. Se você acabou de publicar, aguarde alguns minutos.` : 'Nenhuma skin publicada ainda.';
    files.forEach(file => {
      const url = new URL('skins/' + file.name, location.href).href;
      const card = document.createElement('article'); card.className = 'skin';
      const img = document.createElement('img'); img.alt = 'Textura PNG da skin'; img.loading = 'lazy';
      const name = document.createElement('h3'); name.textContent = file.name.slice(0,12) + '…';
      const status = document.createElement('p'); status.textContent = 'Aguardando imagem pública…';
      const link = document.createElement('a'); link.href = url; link.textContent = 'Abrir PNG ↗'; link.target = '_blank'; link.rel = 'noopener';
      const copy = document.createElement('button'); copy.textContent = 'Copiar URL'; copy.disabled = true;
      img.onload = () => { status.textContent = `${img.naturalWidth} × ${img.naturalHeight} pixels · disponível`; copy.disabled = false; };
      img.onerror = () => { status.textContent = 'Publicação pendente. Recarregue em alguns minutos.'; };
      copy.onclick = async () => { const message = document.getElementById('message'); message.hidden = false; try { await navigator.clipboard.writeText(url); message.textContent = 'URL pública copiada!'; } catch { message.textContent = 'Copie o endereço pelo link Abrir PNG.'; } };
      img.src = url; card.append(img,name,status,link,copy); gallery.append(card);
    });
  } catch(error) { loading.textContent = error.message; }
})();

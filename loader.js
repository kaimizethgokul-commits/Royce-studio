(async()=>{
  try {
    const parts = await Promise.all([fetch('./app-0.b64').then(r=>r.text()),fetch('./app-1.b64').then(r=>r.text()),fetch('./app-2.b64').then(r=>r.text()),fetch('./app-3.b64').then(r=>r.text()),fetch('./app-4.b64').then(r=>r.text()),fetch('./app-5.b64').then(r=>r.text()),fetch('./app-6.b64').then(r=>r.text()),fetch('./app-7.b64').then(r=>r.text()),fetch('./app-8.b64').then(r=>r.text()),fetch('./app-9.b64').then(r=>r.text())]);
    const b64 = parts.join('').trim();
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    const code = new TextDecoder().decode(bytes);
    (0,eval)(code);
  } catch (e) { console.error('Royce Studio loader failed', e); document.body.insertAdjacentHTML('beforeend','<pre style="color:#fff;background:#600;padding:12px">Royce Studio failed to load. Check console.</pre>'); }
})();
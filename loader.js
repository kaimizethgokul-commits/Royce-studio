(async()=>{try{
 const ps=await Promise.all(['app-gz-0.b64','app-gz-1.b64','app-gz-2.b64'].map(p=>fetch('./'+p).then(r=>{if(!r.ok)throw new Error(p+' '+r.status);return r.text()})));
 const bin=atob(ps.join('').replace(/\s+/g,''));
 const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 if(!('DecompressionStream'in window))throw new Error('This browser does not support gzip decompression.');
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
 const code=await new Response(stream).text();
 (0,eval)(code);
}catch(e){console.error('Royce Studio loader failed',e);document.body.insertAdjacentHTML('beforeend','<pre style="color:#fff;background:#600;padding:12px;white-space:pre-wrap">Royce Studio failed to load: '+String(e.message||e)+'</pre>')}})();
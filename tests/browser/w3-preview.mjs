// W3 isolated desktop/mobile visual smoke test. No live Adult ASA service contacted.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const dest=resolve(process.env.REXY_PREVIEW_DIR||'w3-browser-preview');
await mkdir(dest,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://127.0.0.1').pathname;
    const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+sep)||!Object.hasOwn(mime,extname(file)))throw Error('DENIED');
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)],'Cache-Control':'no-store'});res.end(data);
  }catch(_){res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
await new Promise((yes,no)=>{
  server.once('error',no);server.listen(0,'127.0.0.1',yes);
});
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true});
  for(const spec of [
    {name:'desktop',viewport:{width:1440,height:900}},
    {name:'mobile',viewport:{width:390,height:844},isMobile:true}
  ]){
    const context=await browser.newContext({viewport:spec.viewport,deviceScaleFactor:1,
      isMobile:!!spec.isMobile,hasTouch:!!spec.isMobile});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/community.html',{waitUntil:'networkidle'});
    assert.equal(await page.locator('h1#community-title').count(),1);
    assert.ok(await page.locator('.community-signal').isVisible());
    assert.match(await page.locator('#community-shop-status').textContent(),/No approved shops/);
    assert.match(await page.locator('#community-event-status').textContent(),/No staff-reviewed updates/);
    assert.match(await page.locator('#community-gallery-status').textContent(),/No approved gallery photos/);
    if(spec.isMobile){
      const button=page.locator('.menu-button');
      assert.ok(await button.isVisible());await button.click();
      assert.ok(await page.getByRole('link',{name:'Community',exact:true}).first().isVisible());
    }
    await page.screenshot({path:join(dest,'community-'+spec.name+'.png'),fullPage:true});
    await page.goto(origin+'/mods.html',{waitUntil:'networkidle'});
    const count=await page.locator('.mod-card').count();
    assert.equal(count,44,'All 44 mod research entries must render');
    assert.equal(await page.locator('.mod-visual').count(),44);
    await page.screenshot({path:join(dest,'mods-'+spec.name+'.png'),fullPage:false});
    assert.deepEqual(errors,[],'No JavaScript page exceptions');
    await context.close();
  }
  console.log('W3_BROWSER_DESKTOP_MOBILE_RENDER_PASS · no production data or game access');
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}

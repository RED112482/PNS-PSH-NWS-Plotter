const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),s=fs.readFileSync('app.js','utf8');
test('county outlines use a separate black noninteractive SVG layer above fills',()=>{
 const renderer={},seen=[];const c={countyLayer:null,countyData:{features:[{}]},boundaryLayer:null,outlineRenderer:renderer,$:()=>({checked:true}),esc:String,map:{removeLayer:()=>{}},L:{geoJSON:(data,options)=>{seen.push(options);return {addTo(){return this;}}}}};vm.createContext(c);vm.runInContext(s.slice(s.indexOf('function showCountyLayer()'),s.indexOf("$('counties').onchange")),c);c.showCountyLayer();
 assert.equal(seen[0].pane,'referenceOutlines');assert.strictEqual(seen[0].renderer,renderer);assert.equal(seen[0].style.color,'#000000');assert.equal(seen[0].style.fill,false);assert.equal(seen[0].interactive,false);
 assert(s.includes("map.getPane('referenceOutlines').style.zIndex=600"));assert(s.includes("map.getPane('reportPoints').style.zIndex=650"));assert(fs.readFileSync('dat-ui.js','utf8').includes("map.getPane('datDensity').style.zIndex=550"));
});
test('counties still load when the CWA request fails',async()=>{
 const el={outlineStatus:{},cityStatus:{},reloadOutlines:{}},calls=[];const box={getWest:()=>-89,getEast:()=>-87,getSouth:()=>30,getNorth:()=>32};
 const c={$:id=>el[id],contextEpoch:0,contextOffice:null,boundary:null,countyData:null,wrapOffice:false,cities:[],mobCityFallback:[],boundaryLayer:null,countyLayer:null,data:null,map:{removeLayer:()=>{}},showCountyLayer:()=>{if(c.countyData)c.countyLayer={getBounds:()=>box};},renderCities:()=>{},draw:()=>{},unwrapOffice:x=>x,spansDateline:()=>false,officeCode:()=> 'MOB',call:async name=>{calls.push(name);if(name==='getBoundary')throw Error('test outage');if(name==='getCounties')return {features:[{}]};if(name==='getCities')return [];throw Error(name);}};
 vm.createContext(c);vm.runInContext(s.slice(s.indexOf('async function loadOfficeMap('),s.indexOf('function updateProductList(')),c);
 await c.loadOfficeMap('MOB');assert(calls.includes('getCounties'));assert(c.countyData);assert(c.countyLayer);assert(el.outlineStatus.textContent.includes('1 county outlines loaded'));assert(el.outlineStatus.textContent.includes('CWA outline unavailable'));
});
test('same-office outline refresh preserves visible geometry if both requests fail',async()=>{
 const oldBoundary={features:[{}]},oldCounties={features:[{}]},box={getWest:()=>-89,getEast:()=>-87,getSouth:()=>30,getNorth:()=>32},oldLayer={getBounds:()=>box},el={outlineStatus:{},cityStatus:{},reloadOutlines:{}},removed=[];
 const c={$:id=>el[id],contextEpoch:1,contextOffice:'MOB',boundary:oldBoundary,countyData:oldCounties,wrapOffice:false,cities:[],mobCityFallback:[],boundaryLayer:oldLayer,countyLayer:{getBounds:()=>box},data:null,map:{removeLayer:layer=>removed.push(layer)},showCountyLayer:()=>{},renderCities:()=>{},draw:()=>{},officeCode:()=> 'MOB',call:async name=>{if(name==='getCities')return [];throw Error('offline');}};
 vm.createContext(c);vm.runInContext(s.slice(s.indexOf('async function loadOfficeMap('),s.indexOf('function updateProductList(')),c);
 await c.loadOfficeMap('MOB');assert.strictEqual(c.boundary,oldBoundary);assert.strictEqual(c.countyData,oldCounties);assert.strictEqual(c.boundaryLayer,oldLayer);assert.equal(removed.length,0);assert(el.outlineStatus.textContent.includes('Keeping previous CWA'));assert(el.outlineStatus.textContent.includes('Keeping previous county'));
});
